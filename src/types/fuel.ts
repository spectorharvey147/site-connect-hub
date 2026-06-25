import type { Role } from "@/types/auth";
import type { MachineType } from "@/types/machinery";

export type FuelType =
  | "diesel"
  | "petrol"
  | "engine_oil"
  | "hydraulic_oil"
  | "grease"
  | "other";

export type FuelUnit = "L" | "KG" | "Units";
export type FuelSource = "advance" | "cash" | "credit";
export type FuelRecordStatus = "draft" | "submitted" | "approved";

export interface FuelVendor {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  status: "active" | "inactive";
}

export interface FuelReceipt {
  id: string;
  receiptNumber: string;
  projectId: string;
  projectName: string;
  date: string;
  fuelType: FuelType;
  vendorId: string;
  vendorName: string;
  fuelContractId?: string;
  source: FuelSource;
  quantity: number;
  unit: FuelUnit;
  ratePerUnit: number;
  totalAmount: number;
  referenceNumber: string;
  remarks: string;
  status: FuelRecordStatus;
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

export interface FuelReceiptInput {
  projectId: string;
  date: string;
  fuelType: FuelType;
  vendorId: string;
  fuelContractId?: string;
  source: FuelSource;
  quantity: number;
  ratePerUnit: number;
  referenceNumber: string;
  remarks: string;
}

export interface FuelIssueRow {
  id: string;
  machineType: MachineType;
  machineAssetId: string;
  machineNumber: string;
  quantityIssued: number;
  remarks: string;
}

export interface FuelIssue {
  id: string;
  issueNumber: string;
  projectId: string;
  projectName: string;
  date: string;
  fuelType: FuelType;
  unit: FuelUnit;
  openingStock: number;
  rows: FuelIssueRow[];
  totalIssued: number;
  closingStock: number;
  remarks: string;
  status: FuelRecordStatus;
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

export interface FuelIssueInput {
  projectId: string;
  date: string;
  fuelType: FuelType;
  rows: FuelIssueRow[];
  remarks: string;
}

export interface FuelFilters {
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  fuelType?: FuelType | "all";
  vendorId?: string;
  status?: FuelRecordStatus | "all";
}

export interface DailyFuelSummary {
  date: string;
  opening: number;
  received: number;
  issued: number;
  closing: number;
  cost: number;
}

export interface MachineFuelConsumption {
  machineNumber: string;
  machineType: MachineType;
  totalQuantity: number;
  cost: number;
  averagePerDay: number;
}

export interface VendorFuelTracking {
  vendorId: string;
  vendorName: string;
  fuelType: FuelType;
  totalPurchased: number;
  cost: number;
  balanceQuantity: number;
}

export interface FuelSummary {
  stockOnHand: number;
  receivedThisMonth: number;
  issuedThisMonth: number;
  purchaseCostThisMonth: number;
  pendingApproval: number;
}

export interface FuelDashboard {
  summary: FuelSummary;
  recentReceipts: FuelReceipt[];
  recentIssues: FuelIssue[];
  dailySummary: DailyFuelSummary[];
  machineConsumption: MachineFuelConsumption[];
  vendorTracking: VendorFuelTracking[];
}
