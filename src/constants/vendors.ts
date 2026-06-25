import type {
  VendorBillStatus,
  VendorProcessingType,
  VendorStatus,
  VendorType,
  VendorVoucherStatus,
} from "@/types/vendors";

export const VENDOR_TYPES: VendorType[] = [
  "labor",
  "machinery",
  "fuel",
  "material",
  "service",
];

export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  labor: "Labor",
  machinery: "Machinery",
  fuel: "Fuel",
  material: "Material",
  service: "Service",
};

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

export const VENDOR_BILL_STATUS_LABELS: Record<VendorBillStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  verified: "Verified",
  approved: "Approved",
  voucher_generated: "Voucher Generated",
  partially_paid: "Partially Paid",
  paid: "Paid",
  rejected: "Rejected",
};

export const VENDOR_VOUCHER_STATUS_LABELS: Record<VendorVoucherStatus, string> = {
  generated: "Generated",
  printed: "Printed",
  paid: "Paid",
  void: "Void",
};

export const VENDOR_STATUS_TONES: Record<
  VendorBillStatus | VendorVoucherStatus | VendorStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  draft: "neutral",
  submitted: "warning",
  verified: "info",
  approved: "success",
  voucher_generated: "info",
  partially_paid: "warning",
  paid: "success",
  rejected: "danger",
  generated: "info",
  printed: "warning",
  void: "danger",
  active: "success",
  inactive: "neutral",
};

export const VENDOR_PROCESSING_TYPE_LABELS: Record<VendorProcessingType, string> = {
  none: "None",
  addition: "Addition",
  deduction: "Deduction",
};
