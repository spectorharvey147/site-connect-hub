import type { AppUser } from "@/types/auth";
import type { Claim } from "@/types/claims";

export function canViewAccountsModule(user: AppUser) {
  return ["accounts_officer", "super_admin"].includes(user.role);
}

export function canMutateAccounts(user: AppUser) {
  return user.role === "accounts_officer";
}

export function canViewEmployeeLedger(user: AppUser) {
  return ["accounts_officer", "super_admin"].includes(user.role);
}

export function canVerifyClaimAsAccounts(user: AppUser, claim: Claim) {
  return (
    canMutateAccounts(user) &&
    ["accounts_verification_pending", "accounts_returned"].includes(claim.status)
  );
}

export function canGenerateVoucher(user: AppUser, claim?: Claim) {
  return (
    canMutateAccounts(user) &&
    (!claim || ["accounts_verified", "voucher_pending"].includes(claim.status))
  );
}

export function canPersistOfficialVoucherPdf(user: AppUser) {
  return canMutateAccounts(user);
}

export function canExportSap(user: AppUser) {
  return canMutateAccounts(user);
}

export function canRecordPayment(user: AppUser, claim?: Claim) {
  return (
    canMutateAccounts(user) &&
    (!claim ||
      [
        "voucher_generated",
        "sap_exported",
        "payment_pending",
        "partially_paid",
        "partial_paid",
        "pending_payment",
      ].includes(claim.status))
  );
}

export function canManageEmployeeAdvance(user: AppUser) {
  return canMutateAccounts(user);
}

export const canAddEmployeeAdvance = canManageEmployeeAdvance;
