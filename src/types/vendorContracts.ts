export type VendorContractType =
  | "labour"
  | "machinery"
  | "fuel"
  | "material"
  | "service";
export type VendorContractStatus = "draft" | "active" | "expired" | "inactive";
export type MachineryBillingType =
  | "monthly"
  | "weekly"
  | "daily"
  | "hourly"
  | "per_trip";
export type LabourContractMode =
  | "contractor_labour"
  | "fixed_individual_labour"
  | "local_labour_incharge"
  | "direct_individual_payment";

export interface VendorContract {
  id: string;
  organizationId?: string;
  contractType: VendorContractType;
  contractCode: string;
  contractTitle?: string;
  vendorId: string;
  vendorName: string;
  projectId: string;
  projectName: string;
  departmentId?: string;
  departmentName?: string;
  costCodeId?: string;
  startDate: string;
  endDate: string;
  status: VendorContractStatus;
  paymentTerms: string;
  gstApplicable: boolean;
  tdsApplicable: boolean;
  remarks: string;
  labourContractMode?: LabourContractMode;
  standardStartTime?: string;
  standardEndTime?: string;
  standardHours?: number;
  overtimeAfterHours?: number;
  weeklyOffRule?: string;
  maleLabourRate?: number;
  femaleLabourRate?: number;
  supervisorRate?: number;
  skilledLabourRate?: number;
  unskilledLabourRate?: number;
  overtimeRate?: number;
  foodAllowance?: number;
  transportAllowance?: number;
  defaultPayeeType?: "vendor" | "incharge" | "individual";
  defaultInchargeName?: string;
  defaultInchargePhone?: string;
  defaultInchargePaymentMode?: string;
  labourCategory?: string;
  machineType?: string;
  machineNumber?: string;
  billingType?: MachineryBillingType;
  rate?: number;
  minimumHours?: number;
  workingDaysPerMonth?: number;
  sundayIncluded?: boolean;
  driverBetaAmount?: number;
  fuelScope?: "included" | "excluded" | "partial";
  driverCost?: "included" | "excluded" | "additional";
  driverFoodIncluded?: boolean;
  breakdownTerms?: string;
  idleDeductionRule?: string;
  machineRegistrationNumber?: string;
  machineCapacity?: string;
  machineOwnership?: "company" | "rented" | "hired";
  machineRemarks?: string;
  contractMachineNumbers?: string;
  fuelType?: string;
  fuelRateType?: "fixed" | "market" | "slip_based";
  fixedFuelRatePerUnit?: number;
  fuelUnit?: string;
  fuelCreditLimit?: number;
  fuelAdvanceRequired?: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type VendorContractInput = Omit<
  VendorContract,
  | "id"
  | "organizationId"
  | "vendorName"
  | "projectName"
  | "departmentName"
  | "createdBy"
  | "createdByName"
  | "createdAt"
  | "updatedAt"
>;

export interface VendorContractFilters {
  vendorId?: string;
  projectId?: string;
  departmentId?: string;
  contractType?: VendorContractType | "all";
  status?: VendorContractStatus | "all";
  fromDate?: string;
  toDate?: string;
}
