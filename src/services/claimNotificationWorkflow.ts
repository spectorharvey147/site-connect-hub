import type { ClaimStatus } from "@/types/claims";

export interface ClaimStageNotification {
  event: string;
  audience: "admin" | "manager" | "final" | "accounts" | "employee";
  label: string;
}

const STAGES: Partial<Record<ClaimStatus, ClaimStageNotification>> = {
  admin_verification_pending: { event: "claim_admin_verification_required", audience: "admin", label: "requires Admin/HR verification" },
  manager_approval_pending: { event: "claim_manager_approval_required", audience: "manager", label: "requires manager approval" },
  final_approval_pending: { event: "claim_final_approval_required", audience: "final", label: "requires final approval" },
  accounts_verification_pending: { event: "claim_accounts_verification_required", audience: "accounts", label: "requires Accounts verification" },
  voucher_pending: { event: "claim_voucher_ready", audience: "accounts", label: "is ready for voucher generation" },
  sap_export_pending: { event: "claim_sap_export_required", audience: "accounts", label: "requires SAP export" },
  payment_pending: { event: "claim_payment_required", audience: "accounts", label: "is ready for payment" },
  partially_paid: { event: "claim_payment_partial", audience: "employee", label: "was partially paid" },
  partial_paid: { event: "claim_payment_partial", audience: "employee", label: "was partially paid" },
  paid: { event: "payment_processed", audience: "employee", label: "was paid" },
  rejected: { event: "claim_rejected", audience: "employee", label: "was rejected" },
  changes_requested: { event: "claim_changes_requested", audience: "employee", label: "needs changes" },
  accounts_returned: { event: "claim_accounts_returned", audience: "employee", label: "was returned by Accounts" },
};

export function claimStageNotification(status: ClaimStatus) {
  return STAGES[status] ?? null;
}

export const CLAIM_STAGE_EMAIL_EVENTS = Array.from(
  new Set(Object.values(STAGES).map((stage) => stage.event)),
);
