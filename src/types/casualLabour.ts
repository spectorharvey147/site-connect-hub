import type { Role } from "@/types/auth";

export type LabourCategory = "male" | "female" | "supervisor";
export type LabourAttendanceStatus = "present" | "absent" | "half_day" | "on_leave";
export type LabourRecordStatus = "draft" | "submitted" | "approved";
export type LabourEntryMode = "named_worker" | "count_based";
export type LabourPayeeType = "vendor" | "incharge" | "individual";
export type LabourSkillType = "supervisor" | "skilled" | "unskilled" | "general";

export interface LabourVendor {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
}

export interface CasualLabourWorker {
  id: string;
  labourCode: string;
  fullName: string;
  category: LabourCategory;
  gender?: "male" | "female" | "other";
  skillType?: LabourSkillType;
  vendorId: string;
  vendorName: string;
  defaultDailyRate: number;
  defaultOvertimeRate?: number;
  defaultPayeeId?: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface LabourAttendanceRow {
  id: string;
  entryMode?: LabourEntryMode;
  workerId: string;
  workerCode: string;
  workerName: string;
  category: LabourCategory;
  gender?: "male" | "female" | "other";
  skillType?: LabourSkillType;
  workerCount?: number;
  startTime: string;
  endTime: string;
  status: LabourAttendanceStatus;
  workedHours?: number;
  normalHours?: number;
  dailyRate: number;
  overtimeHours: number;
  overtimeRate: number;
  allowance?: number;
  deduction?: number;
  payeeType?: LabourPayeeType;
  payeeId?: string;
  payeeName?: string;
  manualOverrideReason?: string;
  remarks?: string;
}

export interface LabourWorkAllocation {
  workArea: string;
  workDescription: string;
  maleAllocated: number;
  femaleAllocated: number;
  supervisorAllocated: number;
  skilledAllocated?: number;
  unskilledAllocated?: number;
  remarks?: string;
}

export interface CasualLabourAttendance {
  id: string;
  attendanceNumber: string;
  projectId: string;
  projectName: string;
  vendorId: string;
  vendorName: string;
  vendorContractId?: string;
  vendorContractCode?: string;
  date: string;
  rows: LabourAttendanceRow[];
  allocation: LabourWorkAllocation;
  status: LabourRecordStatus;
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

export interface LabourAttendanceInput {
  projectId: string;
  vendorId: string;
  vendorContractId?: string;
  date: string;
  rows: LabourAttendanceRow[];
  allocation: LabourWorkAllocation;
}

export interface LabourWorkerInput {
  fullName: string;
  category: LabourCategory;
  vendorId: string;
  defaultDailyRate: number;
}

export interface LabourFilters {
  month?: string;
  projectId?: string;
  vendorId?: string;
  status?: LabourRecordStatus | "all";
}

export interface LabourCostSummary {
  presentCount: number;
  workerCount: number;
  absentCount: number;
  halfDayCount: number;
  overtimeHours: number;
  baseCost: number;
  overtimeCost: number;
  allowance: number;
  deduction: number;
  totalCost: number;
}

export interface CasualLabourSummary {
  totalWorkers: number;
  activeWorkers: number;
  submittedRecords: number;
  monthlyCost: number;
  pendingApproval: number;
}
