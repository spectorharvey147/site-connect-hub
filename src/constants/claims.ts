import type {
  ClaimApprovalStage,
  ClaimStatus,
  CostCodeOption,
  ExpenseCategory,
  ProjectOption,
} from "@/types/claims";

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  admin_verification_pending: "Admin Verification Pending",
  admin_verified: "Admin Verified",
  manager_approval_pending: "Manager Approval Pending",
  manager_approved: "Manager Approved",
  hod_approval_pending: "HOD Approval Pending",
  hod_approved: "HOD Approved",
  final_approval_pending: "Final Approval Pending",
  final_approved: "Final Approved",
  accounts_verification_pending: "Accounts Verification Pending",
  accounts_verified: "Accounts Verified",
  accounts_returned: "Returned by Accounts",
  voucher_pending: "Accounts Processing",
  approved_for_payment: "Approved for Payment",
  voucher_generated: "Voucher Generated",
  sap_export_pending: "SAP Export Pending",
  sap_exported: "SAP Exported",
  payment_pending: "Payment Pending",
  partially_paid: "Partially Paid",
  partial_paid: "Partially Paid",
  pending_payment: "Pending Payment",
  paid: "Paid",
  rejected: "Rejected",
  changes_requested: "Changes Requested",
  cancelled: "Cancelled",
  withdrawn: "Withdrawn",
};

export const CLAIM_STATUS_TONES: Record<
  ClaimStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  draft: "neutral",
  submitted: "info",
  admin_verification_pending: "warning",
  admin_verified: "info",
  manager_approval_pending: "warning",
  manager_approved: "info",
  hod_approval_pending: "warning",
  hod_approved: "info",
  final_approval_pending: "warning",
  final_approved: "success",
  accounts_verification_pending: "warning",
  accounts_verified: "success",
  accounts_returned: "danger",
  voucher_pending: "warning",
  approved_for_payment: "success",
  voucher_generated: "success",
  sap_export_pending: "warning",
  sap_exported: "success",
  payment_pending: "warning",
  partially_paid: "warning",
  partial_paid: "warning",
  pending_payment: "warning",
  paid: "success",
  rejected: "danger",
  changes_requested: "danger",
  cancelled: "neutral",
  withdrawn: "neutral",
};

export const CLAIM_STAGE_LABELS: Record<ClaimApprovalStage, string> = {
  submission: "Submission",
  admin_verification: "Admin Verification",
  manager_approval: "Manager Approval",
  hod_approval: "HOD Approval",
  final_approval: "Final Approval",
  accounts_verification: "Accounts Verification",
  accounts_payment: "Accounts Payment",
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  {
    id: "travel",
    name: "Travel",
    description: "Local travel, conveyance and inter-city movement.",
    requiresBill: false,
    status: "active",
  },
  {
    id: "materials",
    name: "Materials",
    description: "Small consumables and urgent site purchases.",
    requiresBill: true,
    status: "active",
  },
  {
    id: "food",
    name: "Food & Refreshments",
    description: "Approved meals and refreshments for site work.",
    requiresBill: false,
    status: "active",
  },
  {
    id: "lodging",
    name: "Lodging",
    description: "Hotel and temporary accommodation.",
    requiresBill: true,
    status: "active",
  },
  {
    id: "tools",
    name: "Tools & Repairs",
    description: "Small tools, emergency repairs and hire items.",
    requiresBill: true,
    status: "active",
  },
  {
    id: "misc",
    name: "Miscellaneous",
    description: "Approved project-related expenses.",
    requiresBill: false,
    status: "active",
  },
];

export const PROJECT_OPTIONS: ProjectOption[] = [
  {
    id: "project-metro",
    code: "ERODE-SITE",
    name: "Erode Site",
    location: "Erode, Tamil Nadu",
  },
  {
    id: "project-tower",
    code: "SALEM-SITE",
    name: "Salem Site",
    location: "Salem, Tamil Nadu",
  },
];

export const COST_CODE_OPTIONS: CostCodeOption[] = [
  {
    id: "metro-civ",
    projectId: "project-metro",
    code: "LAB-001",
    name: "Labour",
  },
  {
    id: "metro-travel",
    projectId: "project-metro",
    code: "FUEL-001",
    name: "Fuel",
  },
  {
    id: "tower-materials",
    projectId: "project-tower",
    code: "MAT-001",
    name: "Material",
  },
  {
    id: "tower-labour",
    projectId: "project-tower",
    code: "MACH-001",
    name: "Machinery",
  },
];

export const CLAIM_TERMINAL_STATUSES: ClaimStatus[] = [
  "paid",
  "rejected",
  "cancelled",
  "withdrawn",
];

export const CLAIM_PENDING_STATUSES: ClaimStatus[] = [
  "admin_verification_pending",
  "manager_approval_pending",
  "final_approval_pending",
  "hod_approval_pending",
  "accounts_verification_pending",
  "accounts_returned",
  "accounts_verified",
  "voucher_pending",
  "sap_export_pending",
  "sap_exported",
  "payment_pending",
  "partially_paid",
  "approved_for_payment",
  "voucher_generated",
  "changes_requested",
];
