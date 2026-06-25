import type { Role } from "@/types/auth";

export type MaterialPriority = "urgent" | "high" | "medium" | "low";
export type MaterialRequestStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "received"
  | "rejected";
export type MaterialReceiptStatus = "draft" | "received" | "verified" | "rejected";
export type MaterialCondition = "good" | "damaged" | "partial";

export interface MaterialMaster {
  id: string;
  name: string;
  uom: string;
  category: string;
  status: "active" | "inactive";
}

export interface MaterialVendor {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  status: "active" | "inactive";
}

export interface MaterialRequestItem {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number;
  uom: string;
  specification: string;
  estimatedCost: number;
  remarks: string;
}

export interface MaterialRequest {
  id: string;
  requestNumber: string;
  projectId: string;
  projectName: string;
  requestDate: string;
  requiredDate: string;
  priority: MaterialPriority;
  items: MaterialRequestItem[];
  attachments: string[];
  approverId?: string;
  approverName?: string;
  status: MaterialRequestStatus;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: Role;
  submittedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialRequestInput {
  projectId: string;
  requestDate: string;
  requiredDate: string;
  priority: MaterialPriority;
  items: MaterialRequestItem[];
  attachments: string[];
}

export interface MaterialReceiptItem {
  id: string;
  materialId: string;
  materialName: string;
  quantityOrdered: number;
  quantityReceived: number;
  uom: string;
  condition: MaterialCondition;
  remarks: string;
}

export interface InspectionChecklist {
  materialsChecked: boolean;
  quantitiesMatchInvoice: boolean;
  qualityAcceptable: boolean;
  invoiceMatched: boolean;
}

export interface MaterialReceipt {
  id: string;
  receiptNumber: string;
  linkedRequestId?: string;
  linkedRequestNumber?: string;
  projectId: string;
  projectName: string;
  receiptDate: string;
  vendorId: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  deliveryChallanNumber: string;
  items: MaterialReceiptItem[];
  checklist: InspectionChecklist;
  inspectorName: string;
  signatureName: string;
  attachments: string[];
  status: MaterialReceiptStatus;
  receivedBy: string;
  receivedByName: string;
  receivedByRole: Role;
  receivedAt?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialReceiptInput {
  linkedRequestId?: string;
  projectId: string;
  receiptDate: string;
  vendorId: string;
  invoiceNumber: string;
  invoiceDate: string;
  deliveryChallanNumber: string;
  items: MaterialReceiptItem[];
  checklist: InspectionChecklist;
  inspectorName: string;
  signatureName: string;
  attachments: string[];
}

export interface MaterialsFilters {
  projectId?: string;
  status?: MaterialRequestStatus | MaterialReceiptStatus | "all";
  priority?: MaterialPriority | "all";
  search?: string;
}

export interface MaterialInventoryRow {
  materialId: string;
  materialName: string;
  uom: string;
  requestedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  openQuantity: number;
  estimatedCost: number;
}

export interface MaterialsSummary {
  openRequests: number;
  approvedRequests: number;
  receivedThisMonth: number;
  damagedReceipts: number;
  estimatedOpenCost: number;
}

export interface MaterialConsumption {
  id: string;
  projectId: string;
  materialId: string;
  materialName: string;
  consumptionDate: string;
  quantity: number;
  workArea?: string;
  purpose?: string;
  remarks?: string;
  status: string;
  createdAt: string;
}

export interface MaterialConsumptionInput {
  projectId: string;
  materialId: string;
  consumptionDate: string;
  quantity: number;
  costCodeId?: string;
  workArea?: string;
  purpose?: string;
  issuedTo?: string;
  remarks?: string;
}

export interface MaterialDamageWastageInput {
  projectId: string;
  materialId: string;
  transactionDate: string;
  quantity: number;
  reason: string;
  remarks?: string;
}

export interface MaterialStockLedgerEntry {
  id: string;
  projectId: string;
  materialId: string;
  transactionDate: string;
  transactionType: "receipt" | "consumption" | "damage" | "wastage" | "adjustment";
  quantityIn: number;
  quantityOut: number;
  balanceQuantity: number;
  createdAt: string;
}
