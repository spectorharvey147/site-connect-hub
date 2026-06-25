import type { AppUser, Role } from "@/types/auth";
import type { ApprovalPathStep } from "@/types/organization";

export type LeaveStatus =
  | "draft"
  | "submitted"
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn";

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  annualAllowance: number;
  carryForward: boolean;
  requiresDocument: boolean;
  status: "active" | "inactive";
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  location: string;
  type: "national" | "state" | "company";
}

export interface LeaveAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  uploadedAt: string;
}

export interface LeaveApplication {
  id: string;
  organizationId?: string;
  departmentId?: string;
  requesterUserId?: string;
  reportingManagerId?: string;
  hodUserId?: string;
  leaveNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  managerId?: string;
  leaveTypeId: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  numberOfDays: number;
  reason: string;
  status: LeaveStatus;
  attachments: LeaveAttachment[];
  approvalPath?: ApprovalPathStep[];
  appliedAt: string;
  approvedBy?: string;
  approvedByName?: string;
  approvalDate?: string;
  rejectionReason?: string;
  comments?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalance {
  userId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  annualAllowance: number;
  used: number;
  pending: number;
  available: number;
}

export interface LeaveInput {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason: string;
  attachments: LeaveAttachment[];
}

export interface LeaveFilters {
  userId?: string;
  status?: LeaveStatus | "all";
  fromDate?: string;
  toDate?: string;
}

export interface LeaveApprovalInput {
  leaveId: string;
  decision: "approved" | "rejected";
  comments: string;
}

export interface LeavePermissionContext {
  user: AppUser;
  application: LeaveApplication;
}

export interface LeaveApprovalHistoryItem {
  id: string;
  leaveId: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  decision: "submitted" | "approved" | "rejected" | "withdrawn";
  comments?: string;
  createdAt: string;
}
