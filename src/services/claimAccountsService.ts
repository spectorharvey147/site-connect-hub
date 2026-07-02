import { claimsService } from "@/services/claimsService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type { AccountsVerificationInput, Claim, ClaimAccountsVerification } from "@/types/claims";

const STORAGE_KEY = "site-connect:claim-accounts-verifications";
const VISIBLE_STATUSES = ["accounts_verification_pending", "accounts_returned", "voucher_pending"];

type VerificationRow = {
  id: string; organization_id: string; claim_id: string; verified_by: string | null;
  verification_status: ClaimAccountsVerification["verificationStatus"];
  verification_date: string | null; accounts_remarks: string | null;
  payable_amount: number | string; deduction_amount: number | string;
  payment_priority: ClaimAccountsVerification["paymentPriority"];
  requires_sap_export: boolean; sap_export_status: ClaimAccountsVerification["sapExportStatus"];
  created_at: string; updated_at: string;
};

function mapRow(row: VerificationRow): ClaimAccountsVerification {
  return {
    id: row.id, organizationId: row.organization_id, claimId: row.claim_id,
    verifiedBy: row.verified_by ?? undefined, verificationStatus: row.verification_status,
    verificationDate: row.verification_date ?? undefined, accountsRemarks: row.accounts_remarks ?? undefined,
    payableAmount: Number(row.payable_amount), deductionAmount: Number(row.deduction_amount),
    paymentPriority: row.payment_priority, requiresSapExport: row.requires_sap_export,
    sapExportStatus: row.sap_export_status, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function readLocal(): ClaimAccountsVerification[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as ClaimAccountsVerification[]; }
  catch { return []; }
}

function writeLocal(rows: ClaimAccountsVerification[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function validateAccountsVerification(finalApprovedAmount: number, input: AccountsVerificationInput) {
  if (!input.confirmed) throw new Error("Confirm that the bills and payable amount were checked.");
  if (!Number.isFinite(input.payableAmount) || input.payableAmount < 0) throw new Error("Enter a valid payable amount.");
  if (input.payableAmount > finalApprovedAmount) throw new Error("Payable amount cannot exceed the final approved amount.");
  if (input.payableAmount < finalApprovedAmount && !input.accountsRemarks.trim()) throw new Error("Add Accounts remarks for the deduction.");
  return finalApprovedAmount - input.payableAmount;
}

export const claimAccountsService = {
  async list(user: AppUser): Promise<Array<{ claim: Claim; verification?: ClaimAccountsVerification }>> {
    const claims = (await claimsService.listClaims(user)).filter((claim) => VISIBLE_STATUSES.includes(claim.status));
    let rows: ClaimAccountsVerification[];
    if (isSupabaseConfigured) {
      const { data, error } = await supabase!.from("claim_accounts_verifications").select("*").in("claim_id", claims.map((claim) => claim.id));
      if (error) {
        if (error.code === "PGRST205" || error.message.includes("schema cache")) {
          throw new Error("Claims finance migrations are not deployed to this Supabase project. Apply migrations 20260630004000 through 20260630004300, then reload the PostgREST schema cache.");
        }
        throw new Error(error.message);
      }
      rows = ((data ?? []) as VerificationRow[]).map(mapRow);
    } else rows = readLocal();
    return claims.map((claim) => ({ claim, verification: rows.find((row) => row.claimId === claim.id) }));
  },

  async verify(user: AppUser, claim: Claim, input: AccountsVerificationInput) {
    const deductionAmount = validateAccountsVerification(claim.totalApproved, input);
    const updated = await claimsService.applyAccountsVerification(claim.id, user, {
      action: "verify", payableAmount: input.payableAmount, paymentPriority: input.paymentPriority,
      requiresSapExport: input.requiresSapExport, remarks: input.accountsRemarks,
    });
    if (!updated) throw new Error("Accounts verification completed but the claim could not be reloaded.");
    if (!isSupabaseConfigured) {
      const timestamp = new Date().toISOString();
      const row: ClaimAccountsVerification = {
        id: crypto.randomUUID(), organizationId: claim.organizationId ?? user.organizationId ?? "local", claimId: claim.id,
        verifiedBy: user.id, verificationStatus: "verified", verificationDate: timestamp,
        accountsRemarks: input.accountsRemarks, payableAmount: input.payableAmount, deductionAmount,
        paymentPriority: input.paymentPriority, requiresSapExport: input.requiresSapExport,
        sapExportStatus: input.requiresSapExport ? "pending" : "not_required", createdAt: timestamp, updatedAt: timestamp,
      };
      writeLocal([...readLocal().filter((item) => item.claimId !== claim.id), row]);
    }
  },

  async returnForCorrection(user: AppUser, claim: Claim, remarks: string) {
    if (!remarks.trim()) throw new Error("Accounts remarks are required when returning a claim.");
    await claimsService.applyAccountsVerification(claim.id, user, {
      action: "return", payableAmount: claim.totalApproved, paymentPriority: "hold", requiresSapExport: false, remarks,
    });
  },
};
