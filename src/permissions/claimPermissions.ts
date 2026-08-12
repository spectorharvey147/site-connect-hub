import { canViewAllClaims } from "@/permissions/rolePermissions";
import type { AppUser } from "@/types/auth";
import type { Claim } from "@/types/claims";

export const MASTER_INTERVENTION_ALLOWED_STATUSES: readonly Claim["status"][] = [
  "admin_verification_pending",
  "manager_approval_pending",
  "hod_approval_pending",
  "final_approval_pending",
  "changes_requested",
  "on_hold",
];

function isClaimOwner(user: AppUser, claim: Claim) {
  return claim.userId === user.id;
}

function approvalPathIncludes(claim: Claim, role: string) {
  return (claim.approvalPath ?? []).some((step) => step.role === role);
}

function isPathApprover(user: AppUser, claim: Claim, role: string) {
  return (claim.approvalPath ?? []).some(
    (step) =>
      step.role === role &&
      (step.userId === user.id || step.delegatedFromUserId === user.id),
  );
}

export function canViewClaim(user: AppUser, claim: Claim) {
  if (isClaimOwner(user, claim) || canViewAllClaims(user)) {
    return true;
  }
  if (user.role === "accounts_officer") {
    return [
      "accounts_verification_pending",
      "accounts_returned",
      "accounts_verified",
      "voucher_pending",
      "voucher_generated",
      "sap_export_pending",
      "sap_exported",
      "payment_pending",
      "partially_paid",
      "partial_paid",
      "pending_payment",
      "paid",
      "manager_approved",
      "hod_approved",
      "final_approval_pending",
      "final_approved",
    ].includes(claim.status);
  }
  if (user.role === "manager") {
    return (
      claim.reportingManagerId === user.id ||
      user.projectIds.includes(claim.projectId) ||
      isPathApprover(user, claim, "manager")
    );
  }
  if (user.role === "hod") {
    return (
      claim.hodUserId === user.id ||
      claim.departmentId === user.departmentId ||
      user.projectIds.includes(claim.projectId) ||
      isPathApprover(user, claim, "hod")
    );
  }
  return false;
}

export function canVerifyClaimAsAdmin(user: AppUser, claim: Claim) {
  return (
    user.role === "admin_hr" &&
    !isClaimOwner(user, claim) &&
    claim.status === "admin_verification_pending"
  );
}

export function canApproveClaimAsManager(user: AppUser, claim: Claim) {
  return (
    user.role === "manager" &&
    !isClaimOwner(user, claim) &&
    claim.status === "manager_approval_pending" &&
    (claim.reportingManagerId === user.id ||
      user.projectIds.includes(claim.projectId) ||
      isPathApprover(user, claim, "manager"))
  );
}

export function canApproveClaimAsHod(user: AppUser, claim: Claim) {
  return (
    user.role === "hod" &&
    !isClaimOwner(user, claim) &&
    claim.status === "hod_approval_pending" &&
    (claim.hodUserId === user.id ||
      claim.departmentId === user.departmentId ||
      user.projectIds.includes(claim.projectId) ||
      isPathApprover(user, claim, "hod"))
  );
}

export function canApproveClaimAsMaster(user: AppUser, claim: Claim) {
  return (
    user.role === "super_admin" &&
    claim.status === "final_approval_pending" &&
    approvalPathIncludes(claim, "super_admin")
  );
}

export function canUseMasterIntervention(user: AppUser, claim: Claim) {
  return (
    user.role === "super_admin" &&
    MASTER_INTERVENTION_ALLOWED_STATUSES.includes(claim.status)
  );
}
