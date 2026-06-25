import type {
  MaterialCondition,
  MaterialMaster,
  MaterialPriority,
  MaterialReceiptStatus,
  MaterialRequestStatus,
  MaterialVendor,
} from "@/types/materials";

export const MATERIAL_PRIORITIES: MaterialPriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
];

export const MATERIAL_PRIORITY_LABELS: Record<MaterialPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const MATERIAL_PRIORITY_TONES: Record<
  MaterialPriority,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  urgent: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
};

export const MATERIAL_REQUEST_STATUS_LABELS: Record<MaterialRequestStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  received: "Received",
  rejected: "Rejected",
};

export const MATERIAL_RECEIPT_STATUS_LABELS: Record<MaterialReceiptStatus, string> = {
  draft: "Draft",
  received: "Received",
  verified: "Verified",
  rejected: "Rejected",
};

export const MATERIAL_STATUS_TONES: Record<
  MaterialRequestStatus | MaterialReceiptStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  draft: "neutral",
  submitted: "warning",
  approved: "info",
  received: "success",
  verified: "success",
  rejected: "danger",
};

export const MATERIAL_CONDITION_LABELS: Record<MaterialCondition, string> = {
  good: "Good",
  damaged: "Damaged",
  partial: "Partial",
};

export const MATERIAL_CONDITIONS: MaterialCondition[] = [
  "good",
  "partial",
  "damaged",
];

export const MATERIAL_MASTER: MaterialMaster[] = [
  {
    id: "material-cement-opc",
    name: "OPC Cement",
    uom: "Bags",
    category: "Cement",
    status: "active",
  },
  {
    id: "material-tmt-16mm",
    name: "TMT Steel 16mm",
    uom: "KG",
    category: "Steel",
    status: "active",
  },
  {
    id: "material-river-sand",
    name: "River Sand",
    uom: "CFT",
    category: "Aggregates",
    status: "active",
  },
  {
    id: "material-aggregate-20mm",
    name: "20mm Aggregate",
    uom: "CFT",
    category: "Aggregates",
    status: "active",
  },
  {
    id: "material-admixture",
    name: "Concrete Admixture",
    uom: "L",
    category: "Chemicals",
    status: "active",
  },
];

export const MATERIAL_VENDORS: MaterialVendor[] = [
  {
    id: "vendor-buildmart",
    name: "BuildMart Supplies",
    contactPerson: "Sanjay Bhat",
    phone: "+91 98765 50101",
    status: "active",
  },
  {
    id: "vendor-steelhouse",
    name: "Steelhouse Traders",
    contactPerson: "Divya Nair",
    phone: "+91 98765 50102",
    status: "active",
  },
  {
    id: "vendor-aggregate-hub",
    name: "Aggregate Hub",
    contactPerson: "Mahesh Gowda",
    phone: "+91 98765 50103",
    status: "active",
  },
];
