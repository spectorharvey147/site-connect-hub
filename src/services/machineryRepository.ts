import {
  profileNameMap,
  projectNameMap,
  requireSupabase,
  type DataRow,
  vendorNameMap,
} from "@/services/normalizedDataUtils";
import type { AppUser } from "@/types/auth";
import type {
  MachineAsset,
  MachineLog,
  MachineLogInput,
  MachineLogStatus,
  MachineryContract,
  MachineryContractInput,
  MachineryFilters,
} from "@/types/machinery";

function contractRate(row: DataRow) {
  const billing = String(row.billing_type);
  return Number(
    billing === "monthly"
      ? row.monthly_rate
      : billing === "weekly"
        ? row.weekly_rate
        : billing === "daily"
          ? row.daily_rate
          : billing === "hourly"
            ? row.hourly_rate
            : row.trip_rate,
  );
}

export const machineryRepository = {
  async listAssets(actor: AppUser, filters?: MachineryFilters) {
    const client = requireSupabase();
    let query = client.from("machine_assets").select("*").order("machine_number");
    if (filters?.projectId) query = query.eq("project_id", filters.projectId);
    if (filters?.vendorId) query = query.eq("vendor_id", filters.vendorId);
    if (filters?.machineType && filters.machineType !== "all") {
      query = query.eq("machine_type", filters.machineType);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const [projects, vendors] = await Promise.all([
      projectNameMap(rows.map((row) => String(row.project_id ?? ""))),
      vendorNameMap(rows.map((row) => String(row.vendor_id ?? "")), "machinery_vendors"),
    ]);
    return rows.map((row): MachineAsset => ({
      id: String(row.id),
      machineNumber: String(row.machine_number),
      machineType: row.machine_type as MachineAsset["machineType"],
      ownership: row.ownership as MachineAsset["ownership"],
      vendorId: row.vendor_id ? String(row.vendor_id) : undefined,
      vendorName: row.vendor_id ? vendors.get(String(row.vendor_id)) : undefined,
      projectId: row.project_id ? String(row.project_id) : undefined,
      projectName: row.project_id ? projects.get(String(row.project_id)) : undefined,
      status: row.status as MachineAsset["status"],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  async listContracts(actor: AppUser, filters?: MachineryFilters) {
    const client = requireSupabase();
    let query = client
      .from("machinery_contract_terms")
      .select("*,machinery_contract_machines(machine_number,machine_type)")
      .eq("organization_id", actor.organizationId!)
      .order("created_at", { ascending: false });
    if (filters?.vendorId) query = query.eq("vendor_id", filters.vendorId);
    if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const [vendors, profiles] = await Promise.all([
      vendorNameMap(rows.map((row) => String(row.vendor_id))),
      profileNameMap(rows.map((row) => String(row.created_by))),
    ]);
    return rows.map((row): MachineryContract => {
      const machines = (row.machinery_contract_machines as DataRow[] | null) ?? [];
      return {
        id: String(row.id),
        contractNumber: String(row.contract_code),
        vendorId: String(row.vendor_id),
        vendorName: vendors.get(String(row.vendor_id)) ?? "Vendor",
        machineType: (machines[0]?.machine_type ?? "other") as MachineryContract["machineType"],
        machineNumbers: machines.map((machine) => String(machine.machine_number)),
        periodFrom: String(row.contract_start_date),
        periodTo: String(row.contract_end_date),
        billingCycle: row.billing_type as MachineryContract["billingCycle"],
        rate: contractRate(row),
        workingDaysPerMonth: Number(row.working_days_per_month ?? 26),
        overtimeRatePerHour: Number(row.ot_rate_per_hour ?? 0),
        fuelScope: row.fuel_scope as MachineryContract["fuelScope"],
        driverCostScope: row.driver_cost_scope as MachineryContract["driverCostScope"],
        specialTerms: String(row.remarks ?? ""),
        status: row.status as MachineryContract["status"],
        createdBy: String(row.created_by),
        createdByName: profiles.get(String(row.created_by)) ?? "User",
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      };
    });
  },

  async createContract(input: MachineryContractInput, actor: AppUser) {
    const client = requireSupabase();
    const projectId = actor.primaryProjectId ?? actor.projectIds[0] ?? null;
    const contractCode = `MC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const rates = {
      monthly_rate: input.billingCycle === "monthly" ? input.rate : 0,
      weekly_rate: input.billingCycle === "weekly" ? input.rate : 0,
      daily_rate: input.billingCycle === "daily" ? input.rate : 0,
      hourly_rate: input.billingCycle === "hourly" ? input.rate : 0,
      trip_rate: input.billingCycle === "per_trip" ? input.rate : 0,
    };
    const { data, error } = await client
      .from("machinery_contract_terms")
      .insert({
        organization_id: actor.organizationId,
        project_id: projectId,
        department_id: actor.departmentId ?? null,
        vendor_id: input.vendorId,
        contract_code: contractCode,
        billing_type: input.billingCycle,
        ...rates,
        working_days_per_month: input.workingDaysPerMonth,
        ot_rate_per_hour: input.overtimeRatePerHour,
        fuel_scope: input.fuelScope,
        driver_cost_scope: input.driverCostScope,
        contract_start_date: input.periodFrom,
        contract_end_date: input.periodTo,
        status: input.status,
        remarks: input.specialTerms.trim(),
        created_by: actor.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const contractId = String(data.id);
    const { error: machineError } = await client
      .from("machinery_contract_machines")
      .insert(
        input.machineNumbers.map((machineNumber) => ({
          organization_id: actor.organizationId,
          project_id: projectId,
          contract_id: contractId,
          vendor_id: input.vendorId,
          machine_type: input.machineType,
          machine_number: machineNumber,
          billing_type: input.billingCycle,
          ...rates,
          ot_rate_per_hour: input.overtimeRatePerHour,
          status: input.status,
          created_by: actor.id,
        })),
      );
    if (machineError) {
      await client.from("machinery_contract_terms").delete().eq("id", contractId);
      throw new Error(machineError.message);
    }
    return (await this.listContracts(actor)).find((row) => row.id === contractId)!;
  },

  async listLogs(actor: AppUser, filters?: MachineryFilters) {
    const client = requireSupabase();
    let query = client
      .from("machine_logs")
      .select("*,machine_log_sessions(*),machine_assets(machine_number,machine_type,ownership)")
      .eq("organization_id", actor.organizationId!)
      .order("log_date", { ascending: false });
    if (filters?.projectId) query = query.eq("project_id", filters.projectId);
    if (filters?.vendorId) query = query.eq("vendor_id", filters.vendorId);
    if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const [projects, vendors, profiles] = await Promise.all([
      projectNameMap(rows.map((row) => String(row.project_id))),
      vendorNameMap(rows.map((row) => String(row.vendor_id ?? "")), "machinery_vendors"),
      profileNameMap(rows.flatMap((row) => [String(row.submitted_by), String(row.approved_by ?? "")])),
    ]);
    return rows.map((row): MachineLog => {
      const asset = (row.machine_assets ?? {}) as DataRow;
      const sessions = (row.machine_log_sessions as DataRow[] | null) ?? [];
      return {
        id: String(row.id),
        logNumber: String(row.log_number),
        projectId: String(row.project_id),
        projectName: projects.get(String(row.project_id)) ?? "Project",
        date: String(row.log_date),
        machineAssetId: String(row.machine_asset_id),
        machineNumber: String(asset.machine_number ?? ""),
        machineType: (asset.machine_type ?? "other") as MachineLog["machineType"],
        vendorId: row.vendor_id ? String(row.vendor_id) : undefined,
        vendorName: row.vendor_id ? vendors.get(String(row.vendor_id)) : undefined,
        ownership: (asset.ownership ?? "rented") as MachineLog["ownership"],
        vendorContractId: row.contract_id ? String(row.contract_id) : undefined,
        billingType: row.billing_type ? String(row.billing_type) : undefined,
        billingRate: row.billing_rate ? Number(row.billing_rate) : undefined,
        calculatedCost: Number(row.calculated_cost ?? 0),
        tripCount: Number(row.trip_count ?? 0),
        sourceLocation: row.source_location ? String(row.source_location) : undefined,
        destinationLocation: row.destination_location ? String(row.destination_location) : undefined,
        loadType: row.load_type ? String(row.load_type) : undefined,
        operationalStatus: (row.operational_status ?? "active") as MachineLog["operationalStatus"],
        usageSessions: sessions.map((session) => ({
          id: String(session.id),
          startTime: String(session.start_time),
          endTime: String(session.end_time),
          hours: Number(session.hours ?? 0),
          remarks: session.remarks ? String(session.remarks) : undefined,
        })),
        meterStart: Number(row.meter_start),
        meterEnd: Number(row.meter_end),
        totalMeterHours: Number(row.total_meter_hours),
        breakdown: {
          isBreakdown: Boolean(row.breakdown),
          startTime: row.breakdown_start_time ? String(row.breakdown_start_time) : undefined,
          durationHours: Number(row.breakdown_duration_hours ?? 0),
          reason: String(row.breakdown_reason ?? ""),
          resolution: String(row.breakdown_resolution ?? ""),
        },
        remarks: String(row.remarks ?? ""),
        status: row.status as MachineLog["status"],
        submittedBy: String(row.submitted_by),
        submittedByName: profiles.get(String(row.submitted_by)) ?? "User",
        submittedByRole: actor.role,
        submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
        approvedBy: row.approved_by ? String(row.approved_by) : undefined,
        approvedByName: row.approved_by ? profiles.get(String(row.approved_by)) : undefined,
        approvedAt: row.approved_at ? String(row.approved_at) : undefined,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      };
    });
  },

  async saveLog(
    input: MachineLogInput,
    actor: AppUser,
    status: Extract<MachineLogStatus, "draft" | "submitted">,
    calculatedCost: number,
  ) {
    const client = requireSupabase();
    const { data: asset, error: assetError } = await client
      .from("machine_assets")
      .select("vendor_id")
      .eq("id", input.machineAssetId)
      .single();
    if (assetError) throw new Error(assetError.message);
    const totalMeterHours = Math.max(0, input.meterEnd - input.meterStart);
    const { data, error } = await client
      .from("machine_logs")
      .insert({
        organization_id: actor.organizationId,
        project_id: input.projectId,
        department_id: actor.departmentId ?? null,
        vendor_id: asset.vendor_id ?? null,
        contract_id: input.vendorContractId ?? null,
        log_number: `ML-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        machine_asset_id: input.machineAssetId,
        log_date: input.date,
        meter_start: input.meterStart,
        meter_end: input.meterEnd,
        total_meter_hours: totalMeterHours,
        trip_count: input.tripCount ?? input.usageSessions.length,
        source_location: input.sourceLocation ?? null,
        destination_location: input.destinationLocation ?? null,
        load_type: input.loadType ?? null,
        operational_status:
          input.operationalStatus ??
          (input.breakdown.isBreakdown ? "breakdown" : "active"),
        breakdown: input.breakdown.isBreakdown,
        breakdown_start_time: input.breakdown.startTime ?? null,
        breakdown_duration_hours: input.breakdown.durationHours,
        breakdown_reason: input.breakdown.reason || null,
        breakdown_resolution: input.breakdown.resolution || null,
        calculated_cost: calculatedCost,
        billing_type: null,
        billing_rate: null,
        remarks: input.remarks,
        status,
        submitted_by: actor.id,
        submitted_at: status === "submitted" ? new Date().toISOString() : null,
        created_by: actor.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const logId = String(data.id);
    const { error: sessionError } = await client.from("machine_log_sessions").insert(
      input.usageSessions.map((session) => ({
        id: session.id || crypto.randomUUID(),
        machine_log_id: logId,
        start_time: session.startTime,
        end_time: session.endTime,
        hours: session.hours,
        remarks: session.remarks ?? null,
      })),
    );
    if (sessionError) {
      await client.from("machine_logs").delete().eq("id", logId);
      throw new Error(sessionError.message);
    }
    if (input.breakdown.isBreakdown) {
      await client.from("machine_breakdowns").insert({
        organization_id: actor.organizationId,
        project_id: input.projectId,
        vendor_id: asset.vendor_id ?? null,
        machine_log_id: logId,
        breakdown_start: `${input.date}T${input.breakdown.startTime || "00:00"}:00`,
        breakdown_end: null,
        duration_hours: input.breakdown.durationHours,
        reason: input.breakdown.reason,
        deduction_amount: 0,
        resolution: input.breakdown.resolution || null,
        remarks: input.remarks || null,
        status: input.breakdown.resolution ? "resolved" : "open",
        created_by: actor.id,
      });
    }
    return (await this.listLogs(actor)).find((row) => row.id === logId)!;
  },

  async approveLog(id: string, actor: AppUser) {
    const client = requireSupabase();
    const { error } = await client
      .from("machine_logs")
      .update({
        status: "approved",
        approved_by: actor.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return (await this.listLogs(actor)).find((row) => row.id === id)!;
  },
};
