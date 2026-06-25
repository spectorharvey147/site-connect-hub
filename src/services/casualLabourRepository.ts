import {
  profileNameMap,
  projectNameMap,
  requireSupabase,
  type DataRow,
  vendorNameMap,
} from "@/services/normalizedDataUtils";
import type { AppUser } from "@/types/auth";
import type {
  CasualLabourAttendance,
  CasualLabourWorker,
  LabourAttendanceInput,
  LabourRecordStatus,
  LabourWorkerInput,
} from "@/types/casualLabour";

function workerFromRow(row: DataRow, vendors: Map<string, string>): CasualLabourWorker {
  return {
    id: String(row.id),
    labourCode: String(row.worker_code),
    fullName: String(row.worker_name),
    category: row.category as CasualLabourWorker["category"],
    gender: row.gender as CasualLabourWorker["gender"],
    skillType: row.skill_type as CasualLabourWorker["skillType"],
    vendorId: String(row.vendor_id ?? ""),
    vendorName: vendors.get(String(row.vendor_id ?? "")) ?? "Direct labour",
    defaultDailyRate: Number(row.daily_rate_override ?? 0),
    defaultOvertimeRate: Number(row.ot_rate_override ?? 0),
    defaultPayeeId: row.default_payee_id ? String(row.default_payee_id) : undefined,
    status: row.status as CasualLabourWorker["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function hoursBetween(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return 0;
  const [startHour = 0, startMinute = 0] = startTime.split(":").map(Number);
  const [endHour = 0, endMinute = 0] = endTime.split(":").map(Number);
  const start = startHour + startMinute / 60;
  let end = endHour + endMinute / 60;
  if (end < start) end += 24;
  return Math.max(end - start, 0);
}

function calculateItemAmounts(
  item: LabourAttendanceInput["rows"][number],
  standardHours: number,
) {
  const workerCount = item.workerCount ?? 1;
  const statusFactor =
    item.status === "present" ? 1 : item.status === "half_day" ? 0.5 : 0;
  const workedHours = item.workedHours ?? hoursBetween(item.startTime, item.endTime);
  const normalHours = item.normalHours ?? Math.min(workedHours, standardHours);
  const overtimeHours =
    item.overtimeHours || Math.max(workedHours - standardHours, 0);
  const normalAmount = item.dailyRate * statusFactor * workerCount;
  const overtimeAmount =
    item.status === "present" ? overtimeHours * item.overtimeRate * workerCount : 0;
  const allowance = (item.allowance ?? 0) * workerCount;
  const deduction = (item.deduction ?? 0) * workerCount;
  return {
    workerCount,
    workedHours,
    normalHours,
    overtimeHours,
    normalAmount,
    overtimeAmount,
    allowance,
    deduction,
    netAmount: normalAmount + overtimeAmount + allowance - deduction,
  };
}

export const casualLabourRepository = {
  async listContractTerms(actor: AppUser) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("labour_contract_terms")
      .select("*")
      .eq("organization_id", actor.organizationId!)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as DataRow[] | null) ?? [];
  },

  async listPayees(actor: AppUser) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("labour_payees")
      .select("*")
      .eq("organization_id", actor.organizationId!)
      .eq("status", "active")
      .order("payee_name");
    if (error) throw new Error(error.message);
    return (data as DataRow[] | null) ?? [];
  },

  async listBills(actor: AppUser) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("casual_labour_bills")
      .select("*")
      .eq("organization_id", actor.organizationId!)
      .order("period_from", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as DataRow[] | null) ?? [];
  },

  async listWorkers(actor: AppUser) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("labour_rosters")
      .select("*")
      .eq("organization_id", actor.organizationId!)
      .order("worker_name");
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const vendors = await vendorNameMap(rows.map((row) => String(row.vendor_id ?? "")));
    return rows.map((row) => workerFromRow(row, vendors));
  },

  async createWorker(input: LabourWorkerInput, actor: AppUser) {
    const client = requireSupabase();
    const projectId = actor.primaryProjectId ?? actor.projectIds[0];
    if (!actor.organizationId || !projectId) {
      throw new Error("Assign the user to a project before creating labour.");
    }
    const code = `CL-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data, error } = await client
      .from("labour_rosters")
      .insert({
        organization_id: actor.organizationId,
        project_id: projectId,
        department_id: actor.departmentId ?? null,
        vendor_id: input.vendorId || null,
        worker_code: code,
        worker_name: input.fullName.trim(),
        category: input.category,
        daily_rate_override: input.defaultDailyRate,
        status: "active",
        created_by: actor.id,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const vendors = await vendorNameMap([input.vendorId]);
    return workerFromRow(data as DataRow, vendors);
  },

  async listAttendance(actor: AppUser) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("casual_labour_attendance")
      .select("*,casual_labour_attendance_items(*),casual_labour_attendance_rows(*)")
      .eq("organization_id", actor.organizationId!)
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const [projects, vendors, profiles] = await Promise.all([
      projectNameMap(rows.map((row) => String(row.project_id))),
      vendorNameMap(rows.map((row) => String(row.vendor_id)), "casual_labour_vendors"),
      profileNameMap(
        rows.flatMap((row) => [
          String(row.submitted_by ?? ""),
          String(row.approved_by ?? ""),
        ]),
      ),
    ]);
    return rows.map((row): CasualLabourAttendance => {
      const canonicalItems =
        (row.casual_labour_attendance_items as DataRow[] | null) ?? [];
      const legacyItems = (row.casual_labour_attendance_rows as DataRow[] | null) ?? [];
      const items = canonicalItems.length > 0 ? canonicalItems : legacyItems;
      return {
        id: String(row.id),
        attendanceNumber: String(row.attendance_number),
        projectId: String(row.project_id),
        projectName: projects.get(String(row.project_id)) ?? "Project",
        vendorId: String(row.vendor_id),
        vendorName: vendors.get(String(row.vendor_id)) ?? "Vendor",
        vendorContractId: row.contract_id ? String(row.contract_id) : undefined,
        date: String(row.date),
        rows: items.map((item) => ({
          id: String(item.id),
          workerId: String(item.roster_id ?? item.worker_id ?? ""),
          workerCode: String(item.worker_code ?? ""),
          workerName: String(item.worker_name ?? "Worker"),
          entryMode: String(item.entry_mode ?? "named_worker") as CasualLabourAttendance["rows"][number]["entryMode"],
          category: item.category as CasualLabourAttendance["rows"][number]["category"],
          gender: item.gender as CasualLabourAttendance["rows"][number]["gender"],
          skillType: item.skill_type as CasualLabourAttendance["rows"][number]["skillType"],
          workerCount: Number(item.worker_count ?? 1),
          startTime: String(item.start_time ?? ""),
          endTime: String(item.end_time ?? ""),
          status: item.status as CasualLabourAttendance["rows"][number]["status"],
          workedHours: Number(item.worked_hours ?? 0),
          normalHours: Number(item.normal_hours ?? 0),
          dailyRate: Number(item.normal_rate ?? item.daily_rate ?? 0),
          overtimeHours: Number(item.overtime_hours ?? 0),
          overtimeRate: Number(item.overtime_rate ?? 0),
          allowance: Number(item.allowance ?? 0),
          deduction: Number(item.deduction ?? 0),
          payeeType: item.payee_type as CasualLabourAttendance["rows"][number]["payeeType"],
          payeeId: item.payee_id ? String(item.payee_id) : undefined,
          payeeName: item.payee_name ? String(item.payee_name) : undefined,
          manualOverrideReason: item.manual_override_reason ? String(item.manual_override_reason) : undefined,
          remarks: item.remarks ? String(item.remarks) : undefined,
        })),
        allocation: {
          workArea: String(row.work_area ?? ""),
          workDescription: String(row.work_description ?? ""),
          maleAllocated: Number(row.male_allocated ?? 0),
          femaleAllocated: Number(row.female_allocated ?? 0),
          supervisorAllocated: Number(row.supervisor_allocated ?? 0),
          skilledAllocated: Number(row.skilled_allocated ?? 0),
          unskilledAllocated: Number(row.unskilled_allocated ?? 0),
          remarks: row.remarks ? String(row.remarks) : undefined,
        },
        status: row.status as CasualLabourAttendance["status"],
        submittedBy: String(row.submitted_by),
        submittedByName: profiles.get(String(row.submitted_by)) ?? "User",
        submittedByRole: actor.role,
        submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
        approvedBy: row.approved_by ? String(row.approved_by) : undefined,
        approvedByName: row.approved_by
          ? profiles.get(String(row.approved_by))
          : undefined,
        approvedAt: row.approved_at ? String(row.approved_at) : undefined,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      };
    });
  },

  async saveAttendance(
    input: LabourAttendanceInput,
    actor: AppUser,
    status: Extract<LabourRecordStatus, "draft" | "submitted">,
  ) {
    const client = requireSupabase();
    if (!actor.organizationId) throw new Error("Organization is required.");
    let contractMode = "contractor_labour";
    let standardHours = 8;
    let configuredPayee: DataRow | undefined;
    if (input.vendorContractId) {
      const [{ data: terms, error: termsError }, { data: payees, error: payeesError }] =
        await Promise.all([
          client
            .from("labour_contract_terms")
            .select("*")
            .eq("organization_id", actor.organizationId)
            .eq("contract_id", input.vendorContractId)
            .eq("status", "active")
            .maybeSingle(),
          client
            .from("labour_payees")
            .select("*")
            .eq("organization_id", actor.organizationId)
            .eq("contract_id", input.vendorContractId)
            .eq("status", "active")
            .order("created_at")
            .limit(1),
        ]);
      if (termsError) throw new Error(termsError.message);
      if (payeesError) throw new Error(payeesError.message);
      contractMode = String(terms?.contract_mode ?? contractMode);
      standardHours = Number(terms?.standard_hours ?? 8);
      configuredPayee = (payees as DataRow[] | null)?.[0];
    }
    const payeeType =
      contractMode === "local_labour_incharge"
        ? "incharge"
        : contractMode === "contractor_labour"
          ? "vendor"
          : "individual";
    const attendanceNumber = `LAB-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: header, error } = await client
      .from("casual_labour_attendance")
      .insert({
        organization_id: actor.organizationId,
        project_id: input.projectId,
        department_id: actor.departmentId ?? null,
        vendor_id: input.vendorId,
        contract_id: input.vendorContractId ?? null,
        attendance_number: attendanceNumber,
        date: input.date,
        work_area: input.allocation.workArea,
        work_description: input.allocation.workDescription,
        male_allocated: input.allocation.maleAllocated,
        female_allocated: input.allocation.femaleAllocated,
        supervisor_allocated: input.allocation.supervisorAllocated,
        status,
        submitted_by: actor.id,
        submitted_at: status === "submitted" ? new Date().toISOString() : null,
        created_by: actor.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const attendanceId = String(header.id);
    const itemRows = input.rows.map((item) => {
      const amounts = calculateItemAmounts(item, standardHours);
      return {
        id: item.id || crypto.randomUUID(),
        attendance_id: attendanceId,
        project_id: input.projectId,
        vendor_id: input.vendorId,
        contract_id: input.vendorContractId ?? null,
        worker_id: null,
        roster_id: item.entryMode === "count_based" ? null : item.workerId,
        worker_code: item.workerCode,
        worker_name: item.workerName,
        entry_mode: item.entryMode ?? "named_worker",
        category: item.category,
        gender: item.gender ?? (item.category === "female" ? "female" : "male"),
        skill_type: item.skillType ?? (item.category === "supervisor" ? "supervisor" : "general"),
        worker_count: amounts.workerCount,
        start_time: item.startTime || null,
        end_time: item.endTime || null,
        status: item.status,
        daily_rate: item.dailyRate,
        worked_hours: amounts.workedHours,
        normal_hours: amounts.normalHours,
        overtime_hours: amounts.overtimeHours,
        overtime_rate: item.overtimeRate,
        allowance: item.allowance ?? 0,
        deduction: item.deduction ?? 0,
        normal_amount: amounts.normalAmount,
        overtime_amount: amounts.overtimeAmount,
        net_amount: amounts.netAmount,
        payee_type: item.payeeType ?? payeeType,
        payee_id: item.payeeId ?? configuredPayee?.id ?? null,
        payee_name:
          item.payeeName ??
          (item.payeeType === "individual" || payeeType === "individual"
            ? item.workerName
            : String(configuredPayee?.payee_name ?? "")),
        manual_override_reason: item.manualOverrideReason ?? null,
        remarks: item.remarks ?? null,
      };
    });
    const legacyRows = itemRows
      .filter((item) => item.entry_mode === "named_worker")
      .map((item) => ({
        id: item.id,
        attendance_id: item.attendance_id,
        worker_id: item.roster_id,
        category: item.category,
        start_time: item.start_time,
        end_time: item.end_time,
        status: item.status,
        daily_rate: item.daily_rate,
        overtime_hours: item.overtime_hours,
        overtime_rate: item.overtime_rate,
        remarks: item.remarks,
      }));
    if (legacyRows.length > 0) {
      const { error: itemError } = await client
        .from("casual_labour_attendance_rows")
        .insert(legacyRows);
      if (itemError) {
        await client.from("casual_labour_attendance").delete().eq("id", attendanceId);
        throw new Error(itemError.message);
      }
    }
    const { error: canonicalItemError } = await client
      .from("casual_labour_attendance_items")
      .insert(
        itemRows.map((item) => ({
          organization_id: actor.organizationId,
          project_id: input.projectId,
          department_id: actor.departmentId ?? null,
          vendor_id: input.vendorId,
          contract_id: input.vendorContractId ?? null,
          attendance_id: attendanceId,
          roster_id: item.roster_id,
          worker_code: item.worker_code,
          worker_name: item.worker_name,
          entry_mode: item.entry_mode,
          category: item.category,
          gender: item.gender,
          skill_type: item.skill_type,
          worker_count: item.worker_count,
          start_time: item.start_time,
          end_time: item.end_time,
          worked_hours: item.worked_hours,
          normal_hours: item.normal_hours,
          overtime_hours: item.overtime_hours,
          normal_rate: item.daily_rate,
          overtime_rate: item.overtime_rate,
          allowance: item.allowance,
          deduction: item.deduction,
          normal_amount: item.normal_amount,
          overtime_amount: item.overtime_amount,
          net_amount: item.net_amount,
          payee_type: item.payee_type,
          payee_id: item.payee_id,
          payee_name: item.payee_name,
          manual_override_reason: item.manual_override_reason,
          remarks: item.remarks,
          status,
          created_by: actor.id,
        })),
      );
    if (canonicalItemError) {
      await client.from("casual_labour_attendance").delete().eq("id", attendanceId);
      throw new Error(canonicalItemError.message);
    }
    await client.from("casual_labour_work_allocations").insert({
      organization_id: actor.organizationId,
      project_id: input.projectId,
      department_id: actor.departmentId ?? null,
      vendor_id: input.vendorId,
      contract_id: input.vendorContractId ?? null,
      allocation_date: input.date,
      work_area: input.allocation.workArea,
      work_description: input.allocation.workDescription,
      male_count: input.allocation.maleAllocated,
      female_count: input.allocation.femaleAllocated,
      supervisor_count: input.allocation.supervisorAllocated,
      skilled_count: input.allocation.skilledAllocated ?? 0,
      unskilled_count: input.allocation.unskilledAllocated ?? 0,
      linked_attendance_ids: [attendanceId],
      remarks: input.allocation.remarks ?? null,
      status,
      created_by: actor.id,
    });
    return (await this.listAttendance(actor)).find((row) => row.id === attendanceId)!;
  },

  async approveAttendance(id: string, actor: AppUser) {
    const client = requireSupabase();
    const { data: attendance, error: readError } = await client
      .from("casual_labour_attendance")
      .select("*,casual_labour_attendance_items(*),casual_labour_attendance_rows(*)")
      .eq("organization_id", actor.organizationId!)
      .eq("id", id)
      .single();
    if (readError) throw new Error(readError.message);
    const { error } = await client
      .from("casual_labour_attendance")
      .update({
        status: "approved",
        approved_by: actor.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    const canonicalRows =
      (attendance.casual_labour_attendance_items as DataRow[] | null) ?? [];
    const legacyRows = (attendance.casual_labour_attendance_rows as DataRow[] | null) ?? [];
    const rows = canonicalRows.length > 0 ? canonicalRows : legacyRows;
    const normalAmount = rows.reduce((sum, row) => sum + Number(row.normal_amount ?? 0), 0);
    const overtimeAmount = rows.reduce(
      (sum, row) => sum + Number(row.overtime_amount ?? 0),
      0,
    );
    const allowanceAmount = rows.reduce(
      (sum, row) => sum + Number(row.allowance ?? 0),
      0,
    );
    const deductionAmount = rows.reduce(
      (sum, row) => sum + Number(row.deduction ?? 0),
      0,
    );
    const { error: billError } = await client.from("casual_labour_bills").upsert(
      {
        organization_id: actor.organizationId,
        project_id: attendance.project_id,
        department_id: attendance.department_id ?? actor.departmentId ?? null,
        vendor_id: attendance.vendor_id,
        contract_id: attendance.contract_id,
        attendance_id: id,
        period_from: attendance.date,
        period_to: attendance.date,
        normal_amount: normalAmount,
        overtime_amount: overtimeAmount,
        allowance_amount: allowanceAmount,
        deduction_amount: deductionAmount,
        net_amount:
          normalAmount + overtimeAmount + allowanceAmount - deductionAmount,
        status: "approved",
        created_by: actor.id,
      },
      { onConflict: "attendance_id" },
    );
    if (billError) throw new Error(billError.message);
    return (await this.listAttendance(actor)).find((row) => row.id === id)!;
  },
};
