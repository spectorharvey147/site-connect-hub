import { departmentService } from "@/services/departmentService";
import { projectService } from "@/services/projectService";
import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import { vendorsService } from "@/services/vendorsService";
import type { AppUser } from "@/types/auth";
import type {
  VendorContract,
  VendorContractFilters,
  VendorContractInput,
} from "@/types/vendorContracts";
import { z } from "zod";

let memoryContracts: VendorContract[] = [];
type Row = Record<string, unknown>;

function mapContract(row: Row): VendorContract {
  const terms = (row.commercial_terms ?? {}) as Partial<VendorContract>;
  return {
    ...terms,
    id: String(row.id),
    organizationId: String(row.organization_id),
    contractType: row.contract_type as VendorContract["contractType"],
    contractCode: String(row.contract_code),
    contractTitle: String(row.contract_title ?? row.contract_code),
    vendorId: String(row.vendor_id),
    vendorName: String(row.vendor_name),
    projectId: String(row.project_id),
    projectName: String(row.project_name),
    departmentId: row.department_id ? String(row.department_id) : undefined,
    departmentName: row.department_name
      ? String(row.department_name)
      : undefined,
    costCodeId: row.cost_code_id ? String(row.cost_code_id) : undefined,
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    status: row.status as VendorContract["status"],
    paymentTerms: String(row.payment_terms ?? ""),
    gstApplicable: Boolean(row.gst_applicable),
    tdsApplicable: Boolean(row.tds_applicable),
    remarks: String(row.remarks ?? ""),
    createdBy: String(row.created_by),
    createdByName: String(row.created_by_name),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function commercialTerms(contract: VendorContract) {
  return {
    maleLabourRate: contract.maleLabourRate,
    labourContractMode: contract.labourContractMode,
    standardStartTime: contract.standardStartTime,
    standardEndTime: contract.standardEndTime,
    standardHours: contract.standardHours,
    overtimeAfterHours: contract.overtimeAfterHours,
    weeklyOffRule: contract.weeklyOffRule,
    femaleLabourRate: contract.femaleLabourRate,
    supervisorRate: contract.supervisorRate,
    skilledLabourRate: contract.skilledLabourRate,
    unskilledLabourRate: contract.unskilledLabourRate,
    overtimeRate: contract.overtimeRate,
    foodAllowance: contract.foodAllowance,
    transportAllowance: contract.transportAllowance,
    defaultPayeeType: contract.defaultPayeeType,
    defaultInchargeName: contract.defaultInchargeName,
    defaultInchargePhone: contract.defaultInchargePhone,
    defaultInchargePaymentMode: contract.defaultInchargePaymentMode,
    labourCategory: contract.labourCategory,
    machineType: contract.machineType,
    machineNumber: contract.machineNumber,
    billingType: contract.billingType,
    rate: contract.rate,
    minimumHours: contract.minimumHours,
    workingDaysPerMonth: contract.workingDaysPerMonth,
    sundayIncluded: contract.sundayIncluded,
    driverBetaAmount: contract.driverBetaAmount,
    fuelScope: contract.fuelScope,
    driverCost: contract.driverCost,
    driverFoodIncluded: contract.driverFoodIncluded,
    breakdownTerms: contract.breakdownTerms,
    idleDeductionRule: contract.idleDeductionRule,
    machineRegistrationNumber: contract.machineRegistrationNumber,
    machineCapacity: contract.machineCapacity,
    machineOwnership: contract.machineOwnership,
    machineRemarks: contract.machineRemarks,
    contractMachineNumbers: contract.contractMachineNumbers,
    fuelType: contract.fuelType,
    fuelRateType: contract.fuelRateType,
    fixedFuelRatePerUnit: contract.fixedFuelRatePerUnit,
    fuelUnit: contract.fuelUnit,
    fuelCreditLimit: contract.fuelCreditLimit,
    fuelAdvanceRequired: contract.fuelAdvanceRequired,
  };
}

const contractSchema = z
  .object({
    contractCode: z.string().trim().min(1, "Contract code is required."),
    vendorId: z.string().trim().min(1, "Vendor is required."),
    projectId: z.string().trim().min(1, "Project is required."),
    contractType: z.enum(["labour", "machinery", "fuel", "material", "service"]),
    startDate: z.string().trim().min(1, "Start date is required."),
    endDate: z.string().trim().min(1, "End date is required."),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "Contract end date must be after its start date.",
    path: ["endDate"],
  });

function validateContract(input: VendorContractInput) {
  const result = contractSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Invalid vendor contract.");
  }
}

function billingRates(contract: VendorContract) {
  const rate = contract.rate ?? 0;
  return {
    monthly_rate: contract.billingType === "monthly" ? rate : 0,
    weekly_rate: contract.billingType === "weekly" ? rate : 0,
    daily_rate: contract.billingType === "daily" ? rate : 0,
    hourly_rate: contract.billingType === "hourly" ? rate : 0,
    trip_rate: contract.billingType === "per_trip" ? rate : 0,
  };
}

async function saveNormalizedContractDetails(contract: VendorContract, actor: AppUser) {
  if (!supabase) return;
  if (contract.contractType === "labour") {
    const { error } = await supabase.from("labour_contract_terms").upsert(
      {
        organization_id: contract.organizationId,
        contract_id: contract.id,
        vendor_contract_id: contract.id,
        project_id: contract.projectId,
        department_id: contract.departmentId ?? null,
        cost_code_id: contract.costCodeId ?? null,
        vendor_id: contract.vendorId,
        contract_mode: contract.labourContractMode ?? "contractor_labour",
        standard_start_time: contract.standardStartTime || null,
        standard_end_time: contract.standardEndTime || null,
        standard_hours: contract.standardHours ?? 8,
        ot_after_hours: contract.overtimeAfterHours ?? contract.standardHours ?? 8,
        weekly_off_rule: contract.weeklyOffRule ?? null,
        male_labour_rate_day: contract.maleLabourRate ?? 0,
        female_labour_rate_day: contract.femaleLabourRate ?? 0,
        supervisor_rate_day: contract.supervisorRate ?? 0,
        skilled_labour_rate_day: contract.skilledLabourRate ?? 0,
        unskilled_labour_rate_day: contract.unskilledLabourRate ?? 0,
        ot_rate_per_hour: contract.overtimeRate ?? 0,
        food_allowance: contract.foodAllowance ?? 0,
        transport_allowance: contract.transportAllowance ?? 0,
        default_payee_type:
          contract.defaultPayeeType ??
          (contract.labourContractMode === "local_labour_incharge"
            ? "incharge"
            : contract.labourContractMode === "direct_individual_payment"
              ? "individual"
              : "vendor"),
        default_incharge_name: contract.defaultInchargeName ?? null,
        default_incharge_phone: contract.defaultInchargePhone ?? null,
        default_incharge_payment_mode: contract.defaultInchargePaymentMode ?? null,
        status: contract.status === "active" ? "active" : "inactive",
        remarks: contract.remarks,
        created_by: contract.createdBy,
        updated_by: actor.id,
      },
      { onConflict: "contract_id" },
    );
    if (error) throw new Error(error.message);
    const payeeType =
      contract.defaultPayeeType ??
      (contract.labourContractMode === "local_labour_incharge"
        ? "incharge"
        : contract.labourContractMode === "direct_individual_payment"
          ? "individual"
          : "vendor");
    if (payeeType !== "individual" || contract.defaultInchargeName) {
      const { error: payeeError } = await supabase.from("labour_payees").upsert(
        {
          organization_id: contract.organizationId,
          project_id: contract.projectId,
          contract_id: contract.id,
          vendor_contract_id: contract.id,
          vendor_id: contract.vendorId,
          payee_type: payeeType,
          payee_name:
            payeeType === "incharge"
              ? contract.defaultInchargeName || contract.vendorName
              : contract.vendorName,
          phone: payeeType === "incharge" ? contract.defaultInchargePhone ?? null : null,
          payment_mode: contract.defaultInchargePaymentMode ?? null,
          remarks: contract.remarks,
          status: contract.status === "active" ? "active" : "inactive",
          created_by: contract.createdBy,
        },
        { onConflict: "contract_id,payee_type,payee_name" },
      );
      if (payeeError) throw new Error(payeeError.message);
    }
  }

  if (contract.contractType === "machinery") {
    await supabase
      .from("machinery_contract_terms")
      .delete()
      .eq("vendor_contract_id", contract.id);
    const { error: termsError } = await supabase.from("machinery_contract_terms").insert({
      organization_id: contract.organizationId,
      project_id: contract.projectId,
      department_id: contract.departmentId ?? null,
      cost_code_id: contract.costCodeId ?? null,
      vendor_id: contract.vendorId,
      vendor_contract_id: contract.id,
      contract_code: contract.contractCode,
      billing_type: contract.billingType ?? "daily",
      ...billingRates(contract),
      working_days_per_month: contract.workingDaysPerMonth ?? 26,
      sunday_included: contract.sundayIncluded ?? false,
      minimum_hours_per_day: contract.minimumHours ?? 0,
      ot_rate_per_hour: contract.overtimeRate ?? 0,
      driver_cost_scope: contract.driverCost ?? "included",
      driver_beta_amount: contract.driverBetaAmount ?? 0,
      driver_food_scope: contract.driverFoodIncluded ? "included" : "not_included",
      fuel_scope: contract.fuelScope ?? "excluded",
      breakdown_deduction_rule: contract.breakdownTerms ?? null,
      idle_deduction_rule: contract.idleDeductionRule ?? null,
      contract_start_date: contract.startDate,
      contract_end_date: contract.endDate,
      status: contract.status === "active" ? "active" : "inactive",
      remarks: contract.remarks,
      created_by: contract.createdBy,
    });
    if (termsError) throw new Error(termsError.message);
    const machineNumbers =
      contract.contractMachineNumbers
        ?.split(",")
        .map((item) => item.trim())
        .filter(Boolean) ?? [];
    const uniqueMachineNumbers = Array.from(
      new Set([contract.machineNumber, ...machineNumbers].filter(Boolean)),
    ) as string[];
    if (uniqueMachineNumbers.length === 0 && contract.machineType) {
      uniqueMachineNumbers.push(contract.contractCode);
    }
    if (contract.machineType || uniqueMachineNumbers.length > 0) {
      const { error: machineError } = await supabase
        .from("machinery_contract_machines")
        .upsert(
          uniqueMachineNumbers.map((machineNumber) => ({
            organization_id: contract.organizationId,
            project_id: contract.projectId,
            contract_id: contract.id,
            vendor_id: contract.vendorId,
            vendor_contract_id: contract.id,
            machine_type: contract.machineType ?? "Machine",
            machine_number: machineNumber ?? contract.contractCode,
            registration_number: contract.machineRegistrationNumber ?? null,
            capacity: contract.machineCapacity ?? null,
            ownership: contract.machineOwnership ?? "rented",
            billing_type: contract.billingType ?? "daily",
            ...billingRates(contract),
            ot_rate_per_hour: contract.overtimeRate ?? 0,
            status: contract.status === "active" ? "active" : "inactive",
            remarks: contract.machineRemarks ?? contract.remarks,
            created_by: contract.createdBy,
            updated_by: actor.id,
          })),
          { onConflict: "contract_id,machine_number" },
        );
      if (machineError) throw new Error(machineError.message);
    }
  }

  if (contract.contractType === "fuel") {
    await supabase.from("fuel_contracts").delete().eq("vendor_contract_id", contract.id);
    const { error } = await supabase.from("fuel_contracts").insert({
      organization_id: contract.organizationId,
      project_id: contract.projectId,
      department_id: contract.departmentId ?? null,
      cost_code_id: contract.costCodeId ?? null,
      vendor_id: contract.vendorId,
      vendor_contract_id: contract.id,
      contract_code: contract.contractCode,
      fuel_type: contract.fuelType ?? "diesel",
      rate_type: contract.fuelRateType ?? "fixed",
      fixed_rate_per_unit: contract.fixedFuelRatePerUnit ?? contract.rate ?? 0,
      unit: contract.fuelUnit ?? "L",
      credit_limit: contract.fuelCreditLimit ?? 0,
      advance_required: contract.fuelAdvanceRequired ?? false,
      payment_terms: contract.paymentTerms,
      gst_applicable: contract.gstApplicable,
      status: contract.status === "active" ? "active" : "inactive",
      remarks: contract.remarks,
      created_by: contract.createdBy,
    });
    if (error) throw new Error(error.message);
  }

  const rateCards = [
    ["male_labour", "Male labour / day", "day", contract.maleLabourRate],
    ["female_labour", "Female labour / day", "day", contract.femaleLabourRate],
    ["supervisor", "Supervisor / day", "day", contract.supervisorRate],
    ["skilled_labour", "Skilled labour / day", "day", contract.skilledLabourRate],
    ["unskilled_labour", "Unskilled labour / day", "day", contract.unskilledLabourRate],
    ["standard_rate", "Standard contract rate", contract.billingType ?? "unit", contract.rate],
    ["fuel_rate", "Fuel rate", contract.fuelUnit ?? "L", contract.fixedFuelRatePerUnit],
  ].filter(([, , , rate]) => Number(rate ?? 0) > 0);
  if (rateCards.length) {
    const { error } = await supabase.from("vendor_contract_rate_cards").upsert(
      rateCards.map(([rateCode, description, unit, rate]) => ({
        organization_id: contract.organizationId,
        contract_id: contract.id,
        project_id: contract.projectId,
        department_id: contract.departmentId ?? null,
        cost_code_id: contract.costCodeId ?? null,
        rate_code: rateCode,
        description,
        unit,
        rate,
        overtime_rate: rateCode === "standard_rate" ? contract.overtimeRate ?? 0 : 0,
        status: contract.status === "active" ? "active" : "inactive",
        created_by: contract.createdBy,
      })),
      { onConflict: "contract_id,rate_code" },
    );
    if (error) throw new Error(error.message);
  }
}

function canView(actor: AppUser, contract: VendorContract) {
  if (actor.role === "site_staff") {
    return actor.projectIds.includes(contract.projectId);
  }
  if (actor.role === "manager") return actor.projectIds.includes(contract.projectId);
  if (actor.role === "hod") return contract.departmentId === actor.departmentId;
  return ["admin_hr", "super_admin", "accounts_officer"].includes(actor.role);
}

function filterContracts(
  contracts: VendorContract[],
  filters?: VendorContractFilters,
) {
  return contracts.filter((contract) =>
    (!filters?.vendorId || contract.vendorId === filters.vendorId) &&
    (!filters?.projectId || contract.projectId === filters.projectId) &&
    (!filters?.departmentId || contract.departmentId === filters.departmentId) &&
    (!filters?.contractType || filters.contractType === "all" || contract.contractType === filters.contractType) &&
    (!filters?.status || filters.status === "all" || contract.status === filters.status) &&
    (!filters?.fromDate || contract.endDate >= filters.fromDate) &&
    (!filters?.toDate || contract.startDate <= filters.toDate)
  );
}

export const vendorContractService = {
  async list(actor: AppUser, filters?: VendorContractFilters) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("vendor_contracts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      memoryContracts = ((data as Row[] | null) ?? []).map(mapContract);
    }
    return filterContracts(memoryContracts.filter((item) => canView(actor, item)), filters)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  },

  async get(contractId: string, actor: AppUser) {
    return (await this.list(actor)).find((item) => item.id === contractId) ?? null;
  },

  async save(input: VendorContractInput, actor: AppUser, contractId?: string) {
    if (!["admin_hr", "super_admin"].includes(actor.role)) {
      throw new Error("Only Admin or Super Admin can maintain vendor contracts.");
    }
    validateContract(input);
    const [vendors, projects, departments] = await Promise.all([
      vendorsService.listVendors(actor),
      projectService.getProjects(actor.organizationId),
      departmentService.getDepartments(actor.organizationId),
    ]);
    const vendor = vendors.find((item) => item.id === input.vendorId);
    const project = projects.find((item) => item.id === input.projectId);
    if (!vendor || !project) throw new Error("Vendor or project not found.");
    const existing = contractId
      ? (await this.list(actor)).find((item) => item.id === contractId)
      : undefined;
    const timestamp = new Date().toISOString();
    const contract: VendorContract = {
      ...input,
      id: contractId ?? crypto.randomUUID(),
      organizationId: actor.organizationId,
      vendorName: vendor.name,
      projectName: project.name,
      departmentName: departments.find((item) => item.id === input.departmentId)?.departmentName,
      createdBy: existing?.createdBy ?? actor.id,
      createdByName: existing?.createdByName ?? actor.fullName,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("vendor_contracts")
        .upsert({
          id: contract.id,
          organization_id: contract.organizationId,
          contract_type: contract.contractType,
          contract_code: contract.contractCode,
          contract_title: contract.contractTitle ?? contract.contractCode,
          vendor_id: contract.vendorId,
          vendor_name: contract.vendorName,
          project_id: contract.projectId,
          project_name: contract.projectName,
          department_id: contract.departmentId ?? null,
          department_name: contract.departmentName ?? null,
          cost_code_id: contract.costCodeId ?? null,
          start_date: contract.startDate,
          end_date: contract.endDate,
          status: contract.status,
          payment_terms: contract.paymentTerms,
          gst_applicable: contract.gstApplicable,
          tds_applicable: contract.tdsApplicable,
          remarks: contract.remarks,
          commercial_terms: commercialTerms(contract),
          created_by: contract.createdBy,
          created_by_name: contract.createdByName,
          updated_by: actor.id,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      Object.assign(contract, mapContract(data as Row));
      await saveNormalizedContractDetails(contract, actor);
    }
    memoryContracts = [contract, ...memoryContracts.filter((item) => item.id !== contract.id)];
    await recordAuditLog({
      userId: actor.id,
      action: existing ? "vendor_contract.updated" : "vendor_contract.created",
      entityType: "vendor_contract",
      entityId: contract.id,
      oldValues: existing as unknown as Record<string, unknown> | undefined,
      newValues: contract as unknown as Record<string, unknown>,
    });
    return contract;
  },

  async deactivate(contractId: string, actor: AppUser) {
    const contract = await this.get(contractId, actor);
    if (!contract) throw new Error("Vendor contract not found.");
    const updated = await this.save({ ...contract, status: "inactive" }, actor, contractId);
    await recordAuditLog({
      userId: actor.id,
      action: "vendor_contract.deactivated",
      entityType: "vendor_contract",
      entityId: contractId,
    });
    return updated;
  },

  async activeLabourContracts(actor: AppUser, projectId?: string, vendorId?: string) {
    return this.list(actor, { contractType: "labour", status: "active", projectId, vendorId });
  },

  async activeMachineryContracts(actor: AppUser, projectId?: string, vendorId?: string) {
    return this.list(actor, { contractType: "machinery", status: "active", projectId, vendorId });
  },

  resetForTests() {
    memoryContracts = [];
  },
};
