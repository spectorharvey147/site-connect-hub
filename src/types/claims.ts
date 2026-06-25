import type { AppUser, Role } from "@/types/auth";
import type { ApprovalPathStep } from "@/types/organization";

export type ClaimStatus =
  | "draft"
  | "submitted"
  | "admin_verification_pending"
  | "admin_verified"
  | "manager_approval_pending"
  | "manager_approved"
  | "final_approval_pending"
  | "approved_for_payment"
  | "voucher_generated"
  | "partial_paid"
  | "pending_payment"
  | "paid"
  | "rejected"
  | "changes_requested"
  | "withdrawn";

export type ExpenseBillType = "with_bill" | "without_bill";

export type ClaimApprovalStage =
  | "submission"
  | "admin_verification"
  | "manager_approval"
  | "final_approval"
  | "accounts_payment";

export type ClaimDecision =
  | "submitted"
  | "approved"
  | "reduced"
  | "rejected"
  | "changes_requested"
  | "voucher_generated"
  | "paid"
  | "withdrawn";

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string;
  requiresBill: boolean;
  status: "active" | "inactive";
}

export interface ProjectOption {
  id: string;
  code: string;
  name: string;
  location: string;
}

export interface CostCodeOption {
  id: string;
  projectId: string;
  code: string;
  name: string;
}

export interface ClaimItem {
  id: string;
  categoryId: string;
  categoryName: string;
  projectId: string;
  projectName: string;
  costCodeId: string;
  costCode: string;
  description: string;
  billType: ExpenseBillType;
  amount: number;
  expenseDate: string;
  attachmentName?: string;
  remarks?: string;
}

export interface ClaimAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  uploadedAt: string;
}

export interface ClaimApproval {
  id: string;
  claimId: string;
  stage: ClaimApprovalStage;
  decision: ClaimDecision;
  actorId: string;
  actorName: string;
  actorRole: Role;
  remarks?: string;
  amountBefore?: number;
  amountAfter?: number;
  createdAt: string;
}

export interface PaymentVoucher {
  id: string;
  claimId: string;
  voucherNumber: string;
  voucherDate: string;
  paidToName: string;
  paidToEmail: string;
  approvedAmount: number;
  deductionAmount: number;
  netPayableAmount: number;
  preparedBy: string;
  preparedByName: string;
  accountsNote?: string;
  status: "draft" | "generated" | "printed" | "partial_paid" | "paid" | "void";
  paidAmount?: number;
  createdAt: string;
  paidAt?: string;
  paymentReference?: string;
}

export interface EmployeeLedgerEntry {
  id: string;
  userId: string;
  userName?: string;
  claimId?: string;
  claimNumber?: string;
  voucherId?: string;
  voucherNumber?: string;
  type:
    | "claim_submitted"
    | "claim_approved"
    | "voucher_generated"
    | "payment"
    | "deduction";
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  createdAt: string;
}

export interface ClaimTransaction {
  id: string;
  transactionNumber: string;
  userId: string;
  userName: string;
  claimId?: string;
  claimNumber?: string;
  voucherId?: string;
  voucherNumber?: string;
  type:
    | "claim_submitted"
    | "admin_verified"
    | "manager_approved"
    | "final_approved"
    | "amount_reduced"
    | "claim_rejected"
    | "changes_requested"
    | "voucher_generated"
    | "payment_processed";
  description: string;
  amount: number;
  direction: "none" | "debit" | "credit";
  balanceAfter: number;
  actorId: string;
  actorName: string;
  actorRole: Role;
  createdAt: string;
}

export interface UserClaimBalance {
  userId: string;
  userName: string;
  userEmail: string;
  totalClaimed: number;
  totalApproved: number;
  totalPaid: number;
  outstandingBalance: number;
  pendingClaims: number;
  lastTransactionAt?: string;
}

export interface LedgerStatement {
  userId: string;
  userName: string;
  userEmail: string;
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  entries: EmployeeLedgerEntry[];
}

export interface Claim {
  id: string;
  organizationId?: string;
  departmentId?: string;
  requesterUserId?: string;
  reportingManagerId?: string;
  hodUserId?: string;
  claimNumber: string;
  title: string;
  userId: string;
  userName: string;
  userEmail: string;
  projectId: string;
  projectName: string;
  periodFrom: string;
  periodTo: string;
  status: ClaimStatus;
  items: ClaimItem[];
  attachments: ClaimAttachment[];
  approvals: ClaimApproval[];
  approvalPath?: ApprovalPathStep[];
  totalClaimed: number;
  totalVerified: number;
  totalApproved: number;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  paidAt?: string;
}

export interface ClaimInput {
  title: string;
  projectId: string;
  periodFrom: string;
  periodTo: string;
  remarks?: string;
  items: ClaimItem[];
  attachments: ClaimAttachment[];
}

export interface ClaimFilters {
  search?: string;
  status?: ClaimStatus | "all";
  projectId?: string;
}

export interface LedgerFilters {
  userId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface TransactionFilters extends LedgerFilters {
  search?: string;
}

export interface ClaimReviewInput {
  claimId: string;
  stage: Exclude<ClaimApprovalStage, "submission" | "accounts_payment">;
  decision: Extract<ClaimDecision, "approved" | "reduced" | "rejected" | "changes_requested">;
  remarks: string;
  amountAfter?: number;
}

export interface ClaimReportSummary {
  totalClaims: number;
  totalClaimed: number;
  totalApproved: number;
  pendingApprovals: number;
  paidAmount: number;
}

export interface ClaimsPermissionResult {
  allowed: boolean;
  reason?: string;
}

export type ClaimAction =
  | "submit"
  | "admin_review"
  | "manager_review"
  | "final_review"
  | "generate_voucher"
  | "mark_paid"
  | "withdraw";

export interface ClaimActionContext {
  user: AppUser;
  claim: Claim;
  action: ClaimAction;
}
