export type Role =
  | "site_staff"
  | "manager"
  | "hod"
  | "admin_hr"
  | "super_admin"
  | "accounts_officer";

export type UserStatus = "active" | "inactive" | "invited" | "locked" | "suspended";

export type EmploymentType = "permanent" | "contract" | "casual";

export interface AppUser {
  id: string;
  organizationId?: string;
  employeeId: string;
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  managerId?: string;
  reportingManagerId?: string;
  department?: string;
  departmentId?: string;
  designationId?: string;
  hodUserId?: string;
  primaryProjectId?: string;
  employmentType?: EmploymentType;
  joiningDate?: string;
  avatarUrl?: string;
  profilePhotoPath?: string;
  signatureUrl?: string;
  signaturePath?: string;
  status: UserStatus;
  projectIds: string[];
}

export interface AuthSession {
  user: AppUser;
  accessToken: string;
  expiresAt: string;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
  rememberMe: boolean;
}

export interface PasswordResetRequest {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface InitialAdminInput {
  organizationName: string;
  organizationCode?: string;
  legalName?: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeCode: string;
  password: string;
  supportEmail: string;
  supportPhone: string;
  currency: string;
  timezone: string;
  defaultWorkflow: "standard" | "manager_hod" | "amount_based";
}
