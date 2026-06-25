import type { Role } from "@/types/auth";

export type DprStatus = "draft" | "submitted" | "reviewed" | "returned";

export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "rainy"
  | "stormy"
  | "hot"
  | "cold"
  | "foggy";

export type MachineCode =
  | "excavator"
  | "jcb"
  | "dumper"
  | "compactor"
  | "crane"
  | "concrete_mixer"
  | "vibrator"
  | "pump"
  | "other";

export type DprIssueType =
  | "safety"
  | "weather"
  | "material_shortage"
  | "manpower"
  | "equipment_breakdown"
  | "quality"
  | "other";

export type IssueSeverity = "low" | "medium" | "high";
export type IssueStatus = "resolved" | "pending";

export interface DprLaborCount {
  male: number;
  female: number;
  supervisors: number;
  companyStaff: number;
}

export interface DprActivity {
  id: string;
  activityName: string;
  customActivityName?: string;
  description: string;
  completionPercent: number;
  machinesUsed: MachineCode[];
  customMachines?: string[];
  labor: DprLaborCount;
  comments?: string;
}

export interface DprIssue {
  id: string;
  issueType: DprIssueType;
  severity: IssueSeverity;
  description: string;
  resolutionNotes?: string;
  status: IssueStatus;
}

export interface DprPhoto {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  caption?: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
}

export interface DailyProgressReport {
  id: string;
  dprNumber: string;
  projectId: string;
  projectName: string;
  reportDate: string;
  shiftId: string;
  shiftName: string;
  submittedBy: string;
  submittedByName: string;
  submittedByRole: Role;
  weather: WeatherCondition[];
  activities: DprActivity[];
  issues: DprIssue[];
  nextDayPlan: string;
  plannedManpower: number;
  plannedEquipment: string;
  photos: DprPhoto[];
  status: DprStatus;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewComments?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DprInput {
  projectId: string;
  reportDate: string;
  shiftId: string;
  weather: WeatherCondition[];
  activities: DprActivity[];
  issues: DprIssue[];
  nextDayPlan: string;
  plannedManpower: number;
  plannedEquipment: string;
  photos: DprPhoto[];
}

export interface DprFilters {
  month?: string;
  projectId?: string;
  status?: DprStatus | "all";
  search?: string;
}

export interface DprLaborSummary {
  male: number;
  female: number;
  supervisors: number;
  companyStaff: number;
  casualLabor: number;
  totalWorkforce: number;
}

export interface FieldOperationsSummary {
  totalReports: number;
  submittedThisMonth: number;
  draftReports: number;
  pendingIssues: number;
  photoCount: number;
}
