import type { AppUser, EmploymentType, Role, UserStatus } from "@/types/auth";

export interface ManagedUser extends AppUser {
  invitedAt?: string;
  lastLoginAt?: string;
}

export interface UserInviteInput {
  organizationId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  department: string;
  departmentId: string;
  designationId?: string;
  managerId?: string;
  reportingManagerId?: string;
  hodUserId?: string;
  primaryProjectId?: string;
  employmentType: EmploymentType;
  joiningDate?: string;
  projectIds: string[];
  password?: string;
}

export interface UserUpdateInput {
  role?: Role;
  status?: UserStatus;
  managerId?: string;
  reportingManagerId?: string;
  hodUserId?: string;
  projectIds?: string[];
  department?: string;
  departmentId?: string;
  designationId?: string;
  primaryProjectId?: string;
  employmentType?: EmploymentType;
}

export interface UserManagementSummary {
  totalUsers: number;
  activeUsers: number;
  invitedUsers: number;
  lockedUsers: number;
  adminUsers: number;
}
