import { claimsService } from "@/services/claimsService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import { notificationService } from "@/services/notificationService";
import { storageService } from "@/services/storageService";
import type { AppUser } from "@/types/auth";
import type { Claim, ClaimAttachment, ClaimVoucherItem, DetailedClaimVoucher, PaymentVoucher } from "@/types/claims";

const LOCAL_KEY = "site-connect:detailed-claim-vouchers";

export function validateCombinedVoucherClaims(claims: Claim[]) {
  if (claims.length < 2) throw new Error("Select at least two claims for a combined voucher.");
  if (new Set(claims.map((claim) => claim.userId)).size !== 1) throw new Error("Combined vouchers require claims for the same employee.");
  if (claims.some((claim) => claim.status !== "voucher_pending")) throw new Error("Every claim must be in Voucher Pending before voucher generation.");
}

function localRows(): DetailedClaimVoucher[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "[]") as DetailedClaimVoucher[]; } catch { return []; }
}
function saveLocal(rows: DetailedClaimVoucher[]) { if (typeof window !== "undefined") window.localStorage.setItem(LOCAL_KEY, JSON.stringify(rows)); }

function itemRows(claims: Claim[], voucherId: string): ClaimVoucherItem[] {
  return claims.flatMap((claim) => claim.items.map((item, index) => {
    const ratio = claim.totalClaimed ? item.amount / claim.totalClaimed : 0;
    const approved = claim.totalApproved * ratio;
    return { id: `${voucherId}-${claim.id}-${item.id}`, voucherId, claimId: claim.id, claimItemId: item.id,
      claimNumber: claim.claimNumber, expenseDate: item.expenseDate, category: item.categoryName, projectName: item.projectName,
      customerName: claim.customerName, costCode: item.costCode, description: item.description, billReference: item.attachmentName,
      withBillAmount: item.billType === "with_bill" ? item.amount : 0, withoutBillAmount: item.billType === "without_bill" ? item.amount : 0,
      claimedAmount: item.amount, verifiedAmount: claim.totalVerified * ratio, managerApprovedAmount: approved, finalApprovedAmount: approved, approvedAmount: approved,
      deductionAmount: Math.max(item.amount - approved, 0), remarks: item.remarks, sortOrder: index } as ClaimVoucherItem & { sortOrder: number };
  }));
}

function detailedFromLocal(voucher: PaymentVoucher, claims: Claim[], user: AppUser): DetailedClaimVoucher {
  const first = claims[0];
  const claimed = claims.reduce((sum, claim) => sum + claim.totalClaimed, 0);
  const verified = claims.reduce((sum, claim) => sum + claim.totalVerified, 0);
  const payable = claims.reduce((sum, claim) => sum + claim.totalApproved, 0);
  const approvals = claims.flatMap((claim) => claim.approvals);
  return { ...voucher, voucherType: claims.length > 1 ? "combined_claim" : "single_claim", claimIds: claims.map((claim) => claim.id),
    employeeId: first.userId, employeeCode: first.userId, paidToName: first.userName, paidToEmail: first.userEmail,
    projectName: new Set(claims.map((claim) => claim.projectName)).size === 1 ? first.projectName : "Multiple projects",
    customerName: new Set(claims.map((claim) => claim.customerName)).size === 1 ? first.customerName : "Multiple customers",
    managerName: approvals.find((a) => a.stage === "manager_approval")?.actorName,
    hodName: approvals.find((a) => a.actorRole === "hod")?.actorName,
    finalApproverName: [...approvals].reverse().find((a) => a.stage === "final_approval")?.actorName,
    accountsVerifierName: user.fullName, grossClaimedAmount: claimed, grossVerifiedAmount: verified,
    approvedAmount: payable, deductionAmount: claimed - payable, netPayableAmount: payable,
    items: itemRows(claims, voucher.id), attachments: claims.flatMap((claim) => claim.attachments), preparedByName: user.fullName };
}

function financeSchemaError(error: { code?: string; message: string }) {
  return error.code === "PGRST205" || error.message.includes("schema cache")
    ? new Error("Claims finance migrations are not deployed to this Supabase project.") : new Error(error.message);
}

export const claimVoucherService = {
  async generate(claims: Claim[], user: AppUser, notes = "") {
    if (!claims.length) throw new Error("Select at least one claim.");
    if (claims.length > 1) validateCombinedVoucherClaims(claims);
    else if (claims[0].status !== "voucher_pending") throw new Error("The claim must be in Voucher Pending.");
    if (!['accounts_officer','super_admin'].includes(user.role)) throw new Error("Voucher generation permission denied.");

    if (isSupabaseConfigured) {
      const { data, error } = await supabase!.rpc("generate_claim_payment_voucher", { p_claim_ids: claims.map((claim) => claim.id), p_notes: notes || null });
      if (error) throw financeSchemaError(error);
      const generated = await this.get(String(data), user);
      if (generated) {
        await notificationService.send({
          userId: generated.employeeId,
          type: "voucher_generated",
          title: `Voucher ${generated.voucherNumber} generated`,
          message: `Net payable amount: ${generated.netPayableAmount}. The voucher is moving to payment processing.`,
          relatedId: generated.id,
          relatedType: "claim_voucher",
        }).catch(() => undefined);
      }
      return generated;
    }
    let voucher: PaymentVoucher;
    if (claims.length === 1) voucher = await claimsService.generateVoucher(claims[0].id, user, notes);
    else voucher = { id: crypto.randomUUID(), claimId: claims[0].id, voucherNumber: `CSV-${new Date().getFullYear()}-${String(localRows().length + 1).padStart(6,"0")}`,
      voucherDate: new Date().toISOString().slice(0,10), paidToName: claims[0].userName, paidToEmail: claims[0].userEmail,
      approvedAmount: 0, deductionAmount: 0, netPayableAmount: 0, preparedBy: user.id, preparedByName: user.fullName, status: "generated", createdAt: new Date().toISOString() };
    const detailed = detailedFromLocal(voucher, claims, user);
    saveLocal([detailed, ...localRows().filter((row) => row.id !== detailed.id)]);
    return detailed;
  },

  async list(user: AppUser): Promise<DetailedClaimVoucher[]> {
    if (!isSupabaseConfigured) return localRows();
    const { data, error } = await supabase!.from("claim_payment_vouchers").select("*").order("created_at", { ascending: false });
    if (error) throw financeSchemaError(error);
    return Promise.all((data ?? []).map((row) => this.get(String(row.id), user))).then((rows) => rows.filter(Boolean) as DetailedClaimVoucher[]);
  },

  async get(voucherId: string, user: AppUser): Promise<DetailedClaimVoucher | null> {
    if (!isSupabaseConfigured) return localRows().find((row) => row.id === voucherId) ?? null;
    const [voucherResult, itemsResult, attachmentsResult,paymentsResult] = await Promise.all([
      supabase!.from("claim_payment_vouchers").select("*").eq("id", voucherId).single(),
      supabase!.from("claim_payment_voucher_items").select("*").eq("voucher_id", voucherId).order("sort_order"),
      supabase!.from("claim_payment_voucher_attachments").select("*").eq("voucher_id", voucherId),
      supabase!.from("claim_payments").select("payment_amount,created_by,created_at").eq("voucher_id",voucherId).order("created_at",{ascending:false}),
    ]);
    if (voucherResult.error) throw financeSchemaError(voucherResult.error);
    if (itemsResult.error) throw financeSchemaError(itemsResult.error);
    if (attachmentsResult.error) throw financeSchemaError(attachmentsResult.error);
    const v = voucherResult.data; const itemData = itemsResult.data ?? []; const attachmentData = attachmentsResult.data ?? [];
    const ledgerResult=await supabase!.from("employee_ledger_entries").select("entry_type,credit_amount,balance_after,created_at").eq("employee_id",v.employee_id).order("created_at",{ascending:true});
    const employeeResult = await supabase!.from("user_profiles").select("employee_code,employee_id,department_id,designation_id").eq("id",v.employee_id).maybeSingle();
    const claimIds = [...new Set(itemData.map((row) => String(row.claim_id)))];
    const claims = (await Promise.all(claimIds.map((id) => claimsService.getClaim(id, user)))).filter(Boolean) as Claim[];
    const accountsResult=await supabase!.from("claim_accounts_verifications").select("verified_by").in("claim_id",claimIds).eq("verification_status","verified");
    const accountsVerifierId=accountsResult.data?.find(row=>row.verified_by)?.verified_by;const paidById=paymentsResult.data?.find(row=>row.created_by)?.created_by;
    const approvals=claims.flatMap(claim=>claim.approvals);const signatureActors=[v.prepared_by,accountsVerifierId,paidById,v.employee_id,...approvals.map(a=>a.actorId)].filter(Boolean);
    const signatureResult=await supabase!.from("user_signatures").select("user_id,signature_path").in("user_id",signatureActors).eq("is_active",true);
    const signatures:Record<string,string>={};
    for(const row of signatureResult.data??[]){const url=await storageService.createSignedUrl("user-signatures",row.signature_path).catch(()=>undefined);if(!url)continue;if(row.user_id===v.prepared_by)signatures["Prepared By"]=url;if(row.user_id===accountsVerifierId)signatures["Accounts Verified By"]=url;if(row.user_id===paidById)signatures["Paid By / Cashier"]=url;if(row.user_id===v.employee_id&&(paymentsResult.data??[]).length)signatures["Employee Acknowledgement"]=url;const approval=approvals.find(a=>a.actorId===row.user_id);if(approval?.stage==="admin_verification")signatures["Admin Verified By"]=url;if(approval?.stage==="manager_approval")signatures["Manager Approved By"]=url;if(approval?.actorRole==="hod")signatures["HOD Approved By"]=url;if(approval?.stage==="final_approval")signatures["Final Approved By"]=url;}
    const actorIds=[accountsVerifierId,paidById].filter(Boolean);const actorResult=actorIds.length?await supabase!.from("user_profiles").select("id,full_name").in("id",actorIds):{data:[]};
    const items: ClaimVoucherItem[] = itemData.map((row) => ({ id: row.id, voucherId, claimId: row.claim_id, claimItemId: row.claim_item_id ?? undefined,
      claimNumber: row.claim_number, expenseDate: row.expense_date, category: row.expense_category_snapshot ?? "", projectName: row.project_name_snapshot ?? "",
      customerName: row.customer_name_snapshot ?? undefined, costCode: row.project_cost_code_snapshot ?? "", description: row.description ?? "",
      billReference: row.bill_reference ?? undefined, withBillAmount: Number(row.with_bill_amount), withoutBillAmount: Number(row.without_bill_amount),
      claimedAmount: Number(row.claimed_amount), verifiedAmount: Number(row.admin_verified_amount), managerApprovedAmount: Number(row.manager_approved_amount), finalApprovedAmount: Number(row.final_approved_amount), approvedAmount: Number(row.final_approved_amount),
      deductionAmount: Number(row.deduction_amount), remarks: row.remarks ?? undefined }));
    const attachments: ClaimAttachment[] = await Promise.all(attachmentData.map(async (row) => {
      const signedUrl = await storageService.createSignedUrl("claim-attachments", row.file_path).catch(() => row.file_path);
      return { id: row.source_attachment_id ?? row.id, fileName: row.file_name,
        fileType: row.mime_type ?? "application/octet-stream", fileSize: 0, url: signedUrl, path: row.file_path, uploadedAt: row.created_at };
    }));
    const first = claims[0];
    return { id: v.id, claimId: claimIds[0] ?? "", claimIds, voucherNumber: v.voucher_number, voucherType: v.voucher_type,
      voucherDate: v.voucher_date, employeeId: v.employee_id, paidToName: v.employee_name_snapshot, paidToEmail: v.employee_email_snapshot ?? "",
      employeeCode: employeeResult.data?.employee_code ?? employeeResult.data?.employee_id ?? undefined, projectName: first?.projectName, customerName: first?.customerName,
      approvedAmount: Number(v.net_payable_amount), grossClaimedAmount: Number(v.gross_claimed_amount), grossVerifiedAmount: Number(v.gross_verified_amount),
      deductionAmount: Number(v.gross_deduction_amount), netPayableAmount: Number(v.net_payable_amount), preparedBy: v.prepared_by ?? user.id,
      preparedByName: user.fullName, accountsVerifierName:actorResult.data?.find(row=>row.id===accountsVerifierId)?.full_name,paidByName:actorResult.data?.find(row=>row.id===paidById)?.full_name,status: v.payment_status === "partially_paid" ? "partial_paid" : v.payment_status === "cancelled" ? "void" : v.payment_status,
      createdAt: v.created_at, paymentReference: v.payment_reference ?? undefined, paidAt: v.payment_date ?? undefined, paidAmount:(paymentsResult.data??[]).reduce((sum,row)=>sum+Number(row.payment_amount),0),previousAdvanceBalance:Number((ledgerResult.data??[]).filter(row=>["opening_balance","advance_added"].includes(row.entry_type)&&row.created_at<=v.created_at).at(-1)?.balance_after??0),balanceAfterPayment:Number((ledgerResult.data??[]).filter(row=>["payment_processed","partial_payment"].includes(row.entry_type)).at(-1)?.balance_after??0),items, attachments, signatures };
  },

  async persistPdf(voucher: DetailedClaimVoucher, user: AppUser, bytes: ArrayBuffer | Uint8Array, withAttachments: boolean) {
    const field = withAttachments ? "voucher_with_attachments_pdf_path" : "voucher_pdf_path";
    const fileName = `${voucher.voucherNumber}${withAttachments ? "-with-attachments" : ""}.pdf`;
    if (!isSupabaseConfigured) {
      const rows = localRows().map((row) => row.id === voucher.id ? { ...row, [withAttachments ? "voucherWithAttachmentsPdfPath" : "voucherPdfPath"]: `local://${fileName}` } : row);
      saveLocal(rows); return `local://${fileName}`;
    }
    const arrayBuffer = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes;
    const [stored] = await storageService.uploadFiles("claim-vouchers", [new File([arrayBuffer], fileName, { type: "application/pdf" })], user, voucher.id);
    const { error } = await supabase!.from("claim_payment_vouchers").update({ [field]: stored.path }).eq("id", voucher.id);
    if (error) throw new Error(error.message);
    return stored.path;
  },
};
