import type { MasterStatus } from "@/types/organization";

export type ProjectAssignmentType = "primary" | "secondary" | "temporary";
export type DepartmentProjectAssignmentType = "primary" | "support";
export type ProjectExpenseType =
  | "Labour"
  | "Machinery"
  | "Fuel"
  | "Material"
  | "Travel"
  | "Food"
  | "Accommodation"
  | "Miscellaneous"
  | "Vendor Bill"
  | "Other";

export interface Customer {
  id: string;
  organizationId: string;
  customerCode: string;
  customerName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  city?: string;
  state?: string;
  gstNumber?: string;
  paymentTerms?: string;
  status: MasterStatus;
  remarks?: string;
}

export interface ProjectMaster {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  customerId?: string;
  customerName?: string;
  location?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadius: number;
  startDate?: string;
  endDate?: string;
  projectBudget: number;
  projectManagerId?: string;
  projectManagerName?: string;
  primaryDepartmentId?: string;
  primaryDepartmentName?: string;
  description?: string;
  status: MasterStatus;
  assignedUserCount: number;
  assignedDepartmentCount: number;
  costCodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  organizationId: string;
  code: string;
  name: string;
  customerId?: string;
  customerName?: string;
  location?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadius: number;
  startDate?: string;
  endDate?: string;
  projectBudget: number;
  projectManagerId?: string;
  primaryDepartmentId?: string;
  description?: string;
  status: MasterStatus;
}

export interface ProjectCostCode {
  id: string;
  organizationId: string;
  projectId: string;
  commonCostCodeId?: string;
  code: string;
  name: string;
  expenseType: ProjectExpenseType;
  customerIds: string[];
  expenseCategoryIds: string[];
  description?: string;
  budgetAllocated: number;
  responsibleDepartmentId?: string;
  responsibleDepartmentName?: string;
  status: MasterStatus;
}

export interface ProjectCostCodeInput {
  organizationId: string;
  projectId: string;
  commonCostCodeId?: string;
  code: string;
  name: string;
  expenseType: ProjectExpenseType;
  customerIds?: string[];
  expenseCategoryIds?: string[];
  description?: string;
  budgetAllocated: number;
  responsibleDepartmentId?: string;
  status: MasterStatus;
}

export interface CommonCostCode {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  expenseType: ProjectExpenseType;
  customerIds: string[];
  expenseCategoryIds: string[];
  description?: string;
  status: MasterStatus;
}

export interface CommonCostCodeInput {
  organizationId: string;
  code: string;
  name: string;
  expenseType: ProjectExpenseType;
  customerIds?: string[];
  expenseCategoryIds?: string[];
  description?: string;
  status: MasterStatus;
}

export interface ProjectUserAssignment {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  employeeCode: string;
  projectId: string;
  departmentId?: string;
  departmentName?: string;
  assignmentType: ProjectAssignmentType;
  startDate: string;
  endDate?: string;
  status: MasterStatus;
}

export interface ProjectDepartmentAssignment {
  id: string;
  organizationId: string;
  departmentId: string;
  departmentName: string;
  projectId: string;
  assignmentType: DepartmentProjectAssignmentType;
  startDate: string;
  endDate?: string;
  status: MasterStatus;
}
