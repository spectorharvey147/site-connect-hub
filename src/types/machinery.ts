import type { Role } from "@/types/auth";

export type MachineType =
  | "excavator"
  | "jcb"
  | "dumper"
  | "compactor"
  | "crane"
  | "concrete_mixer"
  | "pump"
  | "other";

export type MachineOwnership = "company_owned" | "rented" | "hired";
export type BillingCycle = "monthly" | "weekly" | "daily" | "hourly" | "per_trip";
export type FuelScope = "included" | "excluded" | "partial";
export type DriverCostScope = "included" | "additional" | "excluded";
export type MachineStatus = "active" | "inactive";
export type MachineLogStatus = "draft" | "submitted" | "approved";
export type MachineOperationalStatus = "active" | "idle" | "standby" | "breakdown";

export interface MachineVendor {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  status: MachineStatus;
}

export interface MachineAsset {
  id: string;
  machineNumber: string;
  machineType: MachineType;
  ownership: MachineOwnership;
  vendorId?: string;
  vendorName?: string;
  projectId?: string;
  projectName?: string;
  status: MachineStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MachineryContract {
  id: string;
  contractNumber: string;
  vendorId: string;
  vendorName: string;
  machineType: MachineType;
  machineNumbers: string[];
  periodFrom: string;
  periodTo: string;
  billingCycle: BillingCycle;
  rate: number;
  workingDaysPerMonth: number;
  overtimeRatePerHour: number;
  fuelScope: FuelScope;
  driverCostScope: DriverCostScope;
  specialTerms: string;
  status: MachineStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface MachineryContractInput {
  vendorId: string;
  machineType: MachineType;
  machineNumbers: string[];
  periodFrom: string;
  periodTo: string;
  billingCycle: BillingCycle;
  rate: number;
  workingDaysPerMonth: number;
  overtimeRatePerHour: number;
  fuelScope: FuelScope;
  driverCostScope: DriverCostScope;
  specialTerms: string;
  status: MachineStatus;
}

export interface UsageSession {
  id: string;
  startTime: string;
  endTime: string;
  hours: number;
  remarks?: string;
}

export interface MachineBreakdown {
  isBreakdown: boolean;
  startTime?: string;
  durationHours: number;
  reason: string;
  resolution: string;
}

export interface MachineLog {
  id: string;
  logNumber: string;
  projectId: string;
  projectName: string;
  date: string;
  machineAssetId: string;
  machineNumber: string;
  machineType: MachineType;
  vendorId?: string;
  vendorName?: string;
  ownership: MachineOwnership;
  vendorContractId?: string;
  vendorContractCode?: string;
  billingType?: string;
  billingRate?: number;
  calculatedCost?: number;
  tripCount?: number;
  sourceLocation?: string;
  destinationLocation?: string;
  loadType?: string;
  operationalStatus?: MachineOperationalStatus;
  usageSessions: UsageSession[];
  meterStart: number;
  meterEnd: number;
  totalMeterHours: number;
  breakdown: MachineBreakdown;
  remarks: string;
  status: MachineLogStatus;
  submittedBy: string;
  submittedByName: string;
  submittedByRole: Role;
  submittedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MachineLogInput {
  projectId: string;
  vendorContractId?: string;
  date: string;
  machineAssetId: string;
  tripCount?: number;
  sourceLocation?: string;
  destinationLocation?: string;
  loadType?: string;
  operationalStatus?: MachineOperationalStatus;
  usageSessions: UsageSession[];
  meterStart: number;
  meterEnd: number;
  breakdown: MachineBreakdown;
  remarks: string;
}

export interface MachineryFilters {
  month?: string;
  projectId?: string;
  vendorId?: string;
  machineType?: MachineType | "all";
  status?: MachineLogStatus | MachineStatus | "all";
  search?: string;
}

export interface MachineLogSummary {
  sessionHours: number;
  meterHours: number;
  billableHours: number;
}

export interface MachinerySummary {
  activeMachines: number;
  activeContracts: number;
  logsThisMonth: number;
  utilizationHours: number;
  breakdownCount: number;
  pendingApproval: number;
}
