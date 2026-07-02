import type { AppUser, EmploymentType, Role, UserStatus } from "@/types/auth";

export type MasterStatus = "active" | "inactive";

export interface Organization {
  id: string;
  organizationCode: string;
  organizationName: string;
  legalName?: string;
  logoUrl?: string;
  voucherLogoPosition?: "left" | "right" | "hidden";
  voucherLogoSize?: number;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country: string;
  pincode?: string;
  supportEmail?: string;
  supportPhone?: string;
  currency: string;
  timezone: string;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface OrganizationInput {
  organizationCode: string;
  organizationName: string;
  legalName?: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  supportEmail?: string;
  supportPhone?: string;
  currency: string;
  timezone: string;
  logoUrl?: string;
  voucherLogoPosition?: "left" | "right" | "hidden";
  voucherLogoSize?: number;
}

export interface Department {
  id: string;
  organizationId: string;
  parentDepartmentId?: string;
  departmentCode: string;
  departmentName: string;
  description?: string;
  hodUserId?: string;
  hodUserName?: string;
  userCount: number;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface DepartmentInput {
  organizationId: string;
  parentDepartmentId?: string;
  departmentCode: string;
  departmentName: string;
  description?: string;
  hodUserId?: string;
  status?: MasterStatus;
}

export interface Designation {
  id: string;
  organizationId: string;
  departmentId?: string;
  designationCode: string;
  designationName: string;
  levelRank: number;
  description?: string;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DesignationInput {
  organizationId: string;
  departmentId?: string;
  designationCode: string;
  designationName: string;
  levelRank: number;
  description?: string;
  status?: MasterStatus;
}

export interface UserProjectAssignment {
  id: string;
  organizationId: string;
  userId: string;
  projectId: string;
  departmentId?: string;
  assignmentType: "primary" | "secondary" | "temporary";
  startDate: string;
  endDate?: string;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HierarchyUserInput {
  organizationId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  departmentId: string;
  designationId?: string;
  reportingManagerId?: string;
  hodUserId?: string;
  primaryProjectId?: string;
  projectIds: string[];
  employmentType: EmploymentType;
  joiningDate?: string;
  status?: UserStatus;
  password?: string;
}

export type ApprovalWorkflowType =
  | "claim"
  | "leave"
  | "material_request"
  | "vendor_bill"
  | "dpr"
  | "attendance_correction";

export type ApprovalApproverRole =
  | "admin"
  | "manager"
  | "hod"
  | "super_admin"
  | "accounts"
  | "store_admin"
  | "finance_head";

export interface ApprovalLevelConfig {
  role: ApprovalApproverRole;
  userId?: string;
}

export interface ApprovalMatrixRule {
  id: string;
  organizationId: string;
  workflowType: ApprovalWorkflowType;
  departmentId?: string;
  projectId?: string;
  expenseCategoryId?: string;
  minAmount?: number;
  maxAmount?: number;
  levels: ApprovalLevelConfig[];
  finalApprovalRole: ApprovalApproverRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalMatrixInput {
  organizationId: string;
  workflowType: ApprovalWorkflowType;
  departmentId?: string;
  projectId?: string;
  expenseCategoryId?: string;
  minAmount?: number;
  maxAmount?: number;
  levels: ApprovalLevelConfig[];
  finalApprovalRole: ApprovalApproverRole;
  isActive?: boolean;
}

export interface ApprovalDelegation {
  id: string;
  organizationId: string;
  fromUserId: string;
  fromUserName?: string;
  delegatedToUserId: string;
  delegatedToUserName?: string;
  workflowType?: ApprovalWorkflowType;
  startDate: string;
  endDate: string;
  reason: string;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalDelegationInput {
  organizationId: string;
  fromUserId: string;
  delegatedToUserId: string;
  workflowType?: ApprovalWorkflowType;
  startDate: string;
  endDate: string;
  reason: string;
  status?: MasterStatus;
}

export interface ApprovalPathInput {
  organizationId: string;
  workflowType: ApprovalWorkflowType;
  requesterUserId: string;
  departmentId?: string;
  projectId?: string;
  amount?: number;
  expenseCategoryId?: string;
  leaveDays?: number;
}

export interface ApprovalPathStep {
  id: string;
  sequence: number;
  role: ApprovalApproverRole;
  label: string;
  userId?: string;
  userName?: string;
  delegatedFromUserId?: string;
  delegatedFromUserName?: string;
  source: "matrix" | "default";
}

export interface ApprovalPathResult {
  workflowType: ApprovalWorkflowType;
  organizationId: string;
  requester: AppUser;
  matchedRuleId?: string;
  steps: ApprovalPathStep[];
}

export interface UserHierarchyNode {
  id: string;
  label: string;
  subtitle?: string;
  user?: AppUser;
  children: UserHierarchyNode[];
}

export interface HierarchyChangeLog {
  id: string;
  organizationId: string;
  userId: string;
  oldDepartmentId?: string;
  newDepartmentId?: string;
  oldReportingManagerId?: string;
  newReportingManagerId?: string;
  oldHodUserId?: string;
  newHodUserId?: string;
  changeReason: string;
  changedBy: string;
  changedAt: string;
}
