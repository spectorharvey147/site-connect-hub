import { DEMO_ORGANIZATION_ID, DEMO_USERS, toAppUser } from "@/constants/demoData";
import {
  CLAIM_PENDING_STATUSES,
  COST_CODE_OPTIONS,
  EXPENSE_CATEGORIES,
  PROJECT_OPTIONS,
} from "@/constants/claims";
import { recordAuditLog } from "@/services/auditService";
import { approvalMatrixService } from "@/services/approvalMatrixService";
import { notificationService } from "@/services/notificationService";
import { storageService } from "@/services/storageService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { AppUser, Role } from "@/types/auth";
import type {
  Claim,
  ClaimActionContext,
  ClaimApproval,
  ClaimApprovalStage,
  ClaimDecision,
  ClaimFilters,
  ClaimInput,
  ClaimItem,
  ClaimReportSummary,
  ClaimReviewInput,
  ClaimStatus,
  ClaimTransaction,
  ClaimsPermissionResult,
  EmployeeLedgerEntry,
  ExpenseBillType,
  LedgerFilters,
  LedgerStatement,
  PaymentVoucher,
  TransactionFilters,
  UserClaimBalance,
} from "@/types/claims";

const CLAIMS_STORAGE_KEY = "site-connect:claims";
const VOUCHERS_STORAGE_KEY = "site-connect:payment-vouchers";
const LEDGER_STORAGE_KEY = "site-connect:employee-ledger";
const TRANSACTIONS_STORAGE_KEY = "site-connect:claim-transactions";

let memoryClaims: Claim[] | null = null;
let memoryVouchers: PaymentVoucher[] | null = null;
let memoryLedger: EmployeeLedgerEntry[] | null = null;
let memoryTransactions: ClaimTransaction[] | null = null;

function now() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isBrowser() {
  return typeof window !== "undefined";
}

function getDemoUser(email: string) {
  const user = DEMO_USERS.find((item) => item.email === email);
  if (!user) {
    throw new Error(`Missing demo user: ${email}`);
  }

  return toAppUser(user);
}

function projectName(projectId: string) {
  if (isSupabaseConfigured) {
    throw new Error("Production project names must come from Supabase.");
  }
  return (
    PROJECT_OPTIONS.find((project) => project.id === projectId)?.name ??
    "Unknown project"
  );
}

function makeApproval(
  claimId: string,
  stage: ClaimApprovalStage,
  decision: ClaimDecision,
  actor: AppUser,
  remarks?: string,
  amountBefore?: number,
  amountAfter?: number,
): ClaimApproval {
  return {
    id: crypto.randomUUID(),
    claimId,
    stage,
    decision,
    actorId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    remarks,
    amountBefore,
    amountAfter,
    createdAt: now(),
  };
}

function seedClaims(): Claim[] {
  const siteUser = getDemoUser("site@siteconnect.local");
  const secondUser = getDemoUser("ishita@siteconnect.local");
  const admin = getDemoUser("admin@siteconnect.local");
  const manager = getDemoUser("manager@siteconnect.local");
  const superAdmin = getDemoUser("super@siteconnect.local");
  const accounts = getDemoUser("accounts@siteconnect.local");

  const baseItems = [
    {
      id: crypto.randomUUID(),
      categoryId: "travel",
      categoryName: "Travel",
      projectId: "project-metro",
      projectName: projectName("project-metro"),
      costCodeId: "metro-travel",
      costCode: "TRV-001",
      description: "Site visit local conveyance",
      billType: "without_bill" as const,
      amount: 1420,
      expenseDate: "2026-06-18",
      remarks: "Metro station package visit",
    },
    {
      id: crypto.randomUUID(),
      categoryId: "materials",
      categoryName: "Materials",
      projectId: "project-metro",
      projectName: projectName("project-metro"),
      costCodeId: "metro-civ",
      costCode: "CIV-001",
      description: "Urgent consumables for shuttering crew",
      billType: "with_bill" as const,
      amount: 6800,
      expenseDate: "2026-06-19",
      attachmentName: "material-bill-681.pdf",
    },
  ];

  const claimOneTotal = baseItems.reduce((sum, item) => sum + item.amount, 0);
  const claimOne: Claim = {
    id: "claim-demo-001",
    claimNumber: "SC-CLM-1028",
    title: "Metro site travel and consumables",
    userId: siteUser.id,
    userName: siteUser.fullName,
    userEmail: siteUser.email,
    projectId: "project-metro",
    projectName: projectName("project-metro"),
    periodFrom: "2026-06-18",
    periodTo: "2026-06-19",
    status: "manager_approval_pending",
    items: baseItems,
    attachments: [
      {
        id: crypto.randomUUID(),
        fileName: "material-bill-681.pdf",
        fileType: "application/pdf",
        fileSize: 184200,
        url: "demo://material-bill-681.pdf",
        uploadedAt: "2026-06-19T10:30:00.000Z",
      },
    ],
    approvals: [
      makeApproval(
        "claim-demo-001",
        "submission",
        "submitted",
        siteUser,
        "Submitted with receipts.",
      ),
      makeApproval(
        "claim-demo-001",
        "admin_verification",
        "approved",
        admin,
        "Bills verified.",
        claimOneTotal,
        claimOneTotal,
      ),
    ],
    totalClaimed: claimOneTotal,
    totalVerified: claimOneTotal,
    totalApproved: claimOneTotal,
    createdAt: "2026-06-19T10:20:00.000Z",
    updatedAt: "2026-06-20T09:10:00.000Z",
    submittedAt: "2026-06-19T10:32:00.000Z",
  };

  const claimTwoItems = [
    {
      id: crypto.randomUUID(),
      categoryId: "lodging",
      categoryName: "Lodging",
      projectId: "project-tower",
      projectName: projectName("project-tower"),
      costCodeId: "tower-materials",
      costCode: "MAT-001",
      description: "One night stay near Commercial Tower A",
      billType: "with_bill" as const,
      amount: 3200,
      expenseDate: "2026-06-14",
      attachmentName: "hotel-invoice.pdf",
    },
  ];
  const claimTwoTotal = claimTwoItems.reduce((sum, item) => sum + item.amount, 0);
  const claimTwo: Claim = {
    id: "claim-demo-002",
    claimNumber: "SC-CLM-1029",
    title: "Commercial Tower lodging",
    userId: secondUser.id,
    userName: secondUser.fullName,
    userEmail: secondUser.email,
    projectId: "project-tower",
    projectName: projectName("project-tower"),
    periodFrom: "2026-06-14",
    periodTo: "2026-06-15",
    status: "approved_for_payment",
    items: claimTwoItems,
    attachments: [
      {
        id: crypto.randomUUID(),
        fileName: "hotel-invoice.pdf",
        fileType: "application/pdf",
        fileSize: 98000,
        url: "demo://hotel-invoice.pdf",
        uploadedAt: "2026-06-15T11:30:00.000Z",
      },
    ],
    approvals: [
      makeApproval("claim-demo-002", "submission", "submitted", secondUser),
      makeApproval(
        "claim-demo-002",
        "admin_verification",
        "approved",
        admin,
        "Invoice checked.",
        claimTwoTotal,
        claimTwoTotal,
      ),
      makeApproval(
        "claim-demo-002",
        "manager_approval",
        "approved",
        manager,
        "Approved for finance.",
        claimTwoTotal,
        claimTwoTotal,
      ),
      makeApproval(
        "claim-demo-002",
        "final_approval",
        "approved",
        superAdmin,
        "Approved for payment.",
        claimTwoTotal,
        claimTwoTotal,
      ),
    ],
    totalClaimed: claimTwoTotal,
    totalVerified: claimTwoTotal,
    totalApproved: claimTwoTotal,
    createdAt: "2026-06-15T11:20:00.000Z",
    updatedAt: "2026-06-18T15:40:00.000Z",
    submittedAt: "2026-06-15T11:31:00.000Z",
  };

  const claimThreeItems = [
    {
      id: crypto.randomUUID(),
      categoryId: "tools",
      categoryName: "Tools & Repairs",
      projectId: "project-metro",
      projectName: projectName("project-metro"),
      costCodeId: "metro-civ",
      costCode: "CIV-001",
      description: "Emergency repair tools",
      billType: "with_bill" as const,
      amount: 5100,
      expenseDate: "2026-06-10",
      attachmentName: "tool-repair.pdf",
    },
  ];
  const claimThreeTotal = claimThreeItems.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const claimThree: Claim = {
    id: "claim-demo-003",
    claimNumber: "SC-CLM-1030",
    title: "Emergency repair tools",
    userId: siteUser.id,
    userName: siteUser.fullName,
    userEmail: siteUser.email,
    projectId: "project-metro",
    projectName: projectName("project-metro"),
    periodFrom: "2026-06-10",
    periodTo: "2026-06-10",
    status: "paid",
    items: claimThreeItems,
    attachments: [
      {
        id: crypto.randomUUID(),
        fileName: "tool-repair.pdf",
        fileType: "application/pdf",
        fileSize: 112000,
        url: "demo://tool-repair.pdf",
        uploadedAt: "2026-06-10T12:30:00.000Z",
      },
    ],
    approvals: [
      makeApproval("claim-demo-003", "submission", "submitted", siteUser),
      makeApproval("claim-demo-003", "admin_verification", "approved", admin),
      makeApproval("claim-demo-003", "manager_approval", "approved", manager),
      makeApproval("claim-demo-003", "final_approval", "approved", superAdmin),
      makeApproval(
        "claim-demo-003",
        "accounts_payment",
        "paid",
        accounts,
        "Paid by bank transfer.",
      ),
    ],
    totalClaimed: claimThreeTotal,
    totalVerified: claimThreeTotal,
    totalApproved: claimThreeTotal,
    createdAt: "2026-06-10T12:15:00.000Z",
    updatedAt: "2026-06-16T16:10:00.000Z",
    submittedAt: "2026-06-10T12:31:00.000Z",
    paidAt: "2026-06-16T16:10:00.000Z",
  };

  return [claimOne, claimTwo, claimThree];
}

function seedVouchers(): PaymentVoucher[] {
  const accounts = getDemoUser("accounts@siteconnect.local");
  return [
    {
      id: "voucher-demo-001",
      claimId: "claim-demo-003",
      voucherNumber: "PV-2026-0042",
      voucherDate: "2026-06-16",
      paidToName: "Rohan Site",
      paidToEmail: "site@siteconnect.local",
      approvedAmount: 5100,
      deductionAmount: 0,
      netPayableAmount: 5100,
      preparedBy: accounts.id,
      preparedByName: accounts.fullName,
      accountsNote: "Paid by bank transfer.",
      status: "paid",
      createdAt: "2026-06-16T15:30:00.000Z",
      paidAt: "2026-06-16T16:10:00.000Z",
      paymentReference: "BANK-UTR-77810",
    },
  ];
}

function seedLedger(): EmployeeLedgerEntry[] {
  const siteUser = getDemoUser("site@siteconnect.local");
  const secondUser = getDemoUser("ishita@siteconnect.local");
  return [
    {
      id: "ledger-demo-000",
      userId: secondUser.id,
      userName: secondUser.fullName,
      claimId: "claim-demo-002",
      claimNumber: "SC-CLM-1029",
      type: "claim_approved",
      description: "Claim SC-CLM-1029 approved for payment",
      debit: 3200,
      credit: 0,
      balanceAfter: 3200,
      createdAt: "2026-06-18T15:40:00.000Z",
    },
    {
      id: "ledger-demo-001",
      userId: siteUser.id,
      userName: siteUser.fullName,
      claimId: "claim-demo-003",
      claimNumber: "SC-CLM-1030",
      type: "claim_approved",
      description: "Claim SC-CLM-1030 approved",
      debit: 5100,
      credit: 0,
      balanceAfter: 5100,
      createdAt: "2026-06-16T15:10:00.000Z",
    },
    {
      id: "ledger-demo-002",
      userId: siteUser.id,
      userName: siteUser.fullName,
      claimId: "claim-demo-003",
      claimNumber: "SC-CLM-1030",
      voucherId: "voucher-demo-001",
      voucherNumber: "PV-2026-0042",
      type: "payment",
      description: "Payment processed for PV-2026-0042",
      debit: 0,
      credit: 5100,
      balanceAfter: 0,
      createdAt: "2026-06-16T16:10:00.000Z",
    },
  ];
}

function seedTransactions(): ClaimTransaction[] {
  const siteUser = getDemoUser("site@siteconnect.local");
  const accounts = getDemoUser("accounts@siteconnect.local");
  const superAdmin = getDemoUser("super@siteconnect.local");
  const secondUser = getDemoUser("ishita@siteconnect.local");

  return [
    {
      id: "txn-demo-000",
      transactionNumber: "TXN-2026-0001",
      userId: secondUser.id,
      userName: secondUser.fullName,
      claimId: "claim-demo-002",
      claimNumber: "SC-CLM-1029",
      type: "final_approved",
      description: "Final approval recorded for SC-CLM-1029",
      amount: 3200,
      direction: "debit",
      balanceAfter: 3200,
      actorId: superAdmin.id,
      actorName: superAdmin.fullName,
      actorRole: superAdmin.role,
      createdAt: "2026-06-18T15:40:00.000Z",
    },
    {
      id: "txn-demo-001",
      transactionNumber: "TXN-2026-0002",
      userId: siteUser.id,
      userName: siteUser.fullName,
      claimId: "claim-demo-003",
      claimNumber: "SC-CLM-1030",
      type: "final_approved",
      description: "Final approval recorded for SC-CLM-1030",
      amount: 5100,
      direction: "debit",
      balanceAfter: 5100,
      actorId: superAdmin.id,
      actorName: superAdmin.fullName,
      actorRole: superAdmin.role,
      createdAt: "2026-06-16T15:10:00.000Z",
    },
    {
      id: "txn-demo-002",
      transactionNumber: "TXN-2026-0003",
      userId: siteUser.id,
      userName: siteUser.fullName,
      claimId: "claim-demo-003",
      claimNumber: "SC-CLM-1030",
      voucherId: "voucher-demo-001",
      voucherNumber: "PV-2026-0042",
      type: "payment_processed",
      description: "Payment processed for PV-2026-0042",
      amount: 5100,
      direction: "credit",
      balanceAfter: 0,
      actorId: accounts.id,
      actorName: accounts.fullName,
      actorRole: accounts.role,
      createdAt: "2026-06-16T16:10:00.000Z",
    },
  ];
}

function readCollection<T>(key: string, seed: () => T[], memory: T[] | null) {
  if (!isBrowser()) {
    return memory ?? seed();
  }

  const stored = window.localStorage.getItem(key);
  if (!stored) {
    const seeded = seed();
    window.localStorage.setItem(key, JSON.stringify(seeded));
    return seeded;
  }

  try {
    return JSON.parse(stored) as T[];
  } catch {
    const seeded = seed();
    window.localStorage.setItem(key, JSON.stringify(seeded));
    return seeded;
  }
}

function writeCollection<T>(key: string, value: T[]) {
  if (isBrowser()) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function readClaims() {
  const claims = readCollection(CLAIMS_STORAGE_KEY, seedClaims, memoryClaims);
  memoryClaims = claims;
  return claims;
}

function writeClaims(claims: Claim[]) {
  memoryClaims = claims;
  writeCollection(CLAIMS_STORAGE_KEY, claims);
}

function readVouchers() {
  const vouchers = readCollection(
    VOUCHERS_STORAGE_KEY,
    seedVouchers,
    memoryVouchers,
  );
  memoryVouchers = vouchers;
  return vouchers;
}

function writeVouchers(vouchers: PaymentVoucher[]) {
  memoryVouchers = vouchers;
  writeCollection(VOUCHERS_STORAGE_KEY, vouchers);
}

function readLedger() {
  const ledger = readCollection(LEDGER_STORAGE_KEY, seedLedger, memoryLedger);
  memoryLedger = ledger;
  return ledger;
}

function writeLedger(ledger: EmployeeLedgerEntry[]) {
  memoryLedger = ledger;
  writeCollection(LEDGER_STORAGE_KEY, ledger);
}

function readTransactions() {
  const transactions = readCollection(
    TRANSACTIONS_STORAGE_KEY,
    seedTransactions,
    memoryTransactions,
  );
  memoryTransactions = transactions;
  return transactions;
}

function writeTransactions(transactions: ClaimTransaction[]) {
  memoryTransactions = transactions;
  writeCollection(TRANSACTIONS_STORAGE_KEY, transactions);
}

function canSeeFinancialData(role: Role) {
  return ["admin_hr", "accounts_officer", "super_admin"].includes(role);
}

function canViewClaim(user: AppUser, claim: Claim) {
  if (claim.userId === user.id) {
    return true;
  }

  if (user.role === "super_admin" || user.role === "admin_hr") {
    return true;
  }

  if (user.role === "accounts_officer") {
    return [
      "approved_for_payment",
      "voucher_generated",
      "partial_paid",
      "pending_payment",
      "paid",
      "manager_approved",
      "final_approval_pending",
    ].includes(claim.status);
  }

  if (user.role === "manager") {
    return user.projectIds.includes(claim.projectId);
  }

  if (user.role === "hod") {
    return claim.departmentId === user.departmentId || user.projectIds.includes(claim.projectId);
  }

  return false;
}

function finalApprovalRoles(claim: Claim) {
  return (claim.approvalPath ?? [])
    .filter((step) => ["hod", "super_admin"].includes(step.role))
    .map((step) => step.role as "hod" | "super_admin");
}

function completedFinalRoles(claim: Claim) {
  return claim.approvals
    .filter(
      (approval) =>
        approval.stage === "final_approval" &&
        ["approved", "reduced"].includes(approval.decision),
    )
    .map((approval) => approval.actorRole)
    .filter(
      (role): role is "hod" | "super_admin" =>
        role === "hod" || role === "super_admin",
    );
}

export function getNextClaimFinalApprover(claim: Claim) {
  const configured = finalApprovalRoles(claim);
  const roles = configured.length > 0 ? configured : ["hod" as const];
  const completed = completedFinalRoles(claim);
  return roles.find((role) => !completed.includes(role));
}

export function canPerformClaimAction({
  user,
  claim,
  action,
}: ClaimActionContext): ClaimsPermissionResult {
  if (action === "submit") {
    return {
      allowed: claim.userId === user.id && claim.status === "draft",
      reason: "Only a draft owner can submit this claim.",
    };
  }

  if (action === "withdraw") {
    return {
      allowed:
        claim.userId === user.id &&
        ["draft", "submitted", "admin_verification_pending"].includes(
          claim.status,
        ),
      reason: "Claims can only be withdrawn before approval starts.",
    };
  }

  if (action === "admin_review") {
    return {
      allowed:
        ["admin_hr", "super_admin"].includes(user.role) &&
        claim.userId !== user.id &&
        claim.status === "admin_verification_pending",
      reason: "Admin verification is available only to Admin or Super Admin.",
    };
  }

  if (action === "manager_review") {
    return {
      allowed:
        ["manager", "hod", "super_admin"].includes(user.role) &&
        claim.userId !== user.id &&
        claim.status === "manager_approval_pending",
      reason: "Manager approval is available only to Manager or Super Admin.",
    };
  }

  if (action === "final_review") {
    const expectedRole = getNextClaimFinalApprover(claim);
    return {
      allowed:
        claim.userId !== user.id &&
        user.role === expectedRole &&
        claim.status === "final_approval_pending" &&
        (user.role !== "hod" || claim.departmentId === user.departmentId),
      reason:
        expectedRole === "super_admin"
          ? "This claim requires Super Admin final approval."
          : "This claim requires its department HOD approval.",
    };
  }

  if (action === "generate_voucher") {
    return {
      allowed:
        ["accounts_officer", "super_admin"].includes(user.role) &&
        claim.status === "approved_for_payment",
      reason: "Voucher generation requires Accounts or Super Admin.",
    };
  }

  if (action === "mark_paid") {
    return {
      allowed:
        ["accounts_officer", "super_admin"].includes(user.role) &&
        ["voucher_generated", "partial_paid", "pending_payment"].includes(
          claim.status,
        ),
      reason: "Only Accounts or Super Admin can mark payment complete.",
    };
  }

  return { allowed: false, reason: "Unsupported action." };
}

function applyFilters(claims: Claim[], filters?: ClaimFilters) {
  return claims.filter((claim) => {
    if (filters?.status && filters.status !== "all" && claim.status !== filters.status) {
      return false;
    }

    if (filters?.projectId && claim.projectId !== filters.projectId) {
      return false;
    }

    if (filters?.search) {
      const query = filters.search.trim().toLowerCase();
      const haystack = [
        claim.claimNumber,
        claim.title,
        claim.userName,
        claim.projectName,
        claim.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    }

    return true;
  });
}

function sortClaims(claims: Claim[]) {
  return [...claims].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function nextClaimNumber(claims: Claim[]) {
  const next =
    claims
      .map((claim) => Number(claim.claimNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 1029) + 1;

  return `SC-CLM-${next}`;
}

function nextVoucherNumber(vouchers: PaymentVoucher[]) {
  const next =
    vouchers
      .map((voucher) => Number(voucher.voucherNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 42) + 1;

  return `PV-2026-${String(next).padStart(4, "0")}`;
}

function getStageAction(stage: ClaimApprovalStage) {
  if (stage === "admin_verification") {
    return "admin_review" as const;
  }
  if (stage === "manager_approval") {
    return "manager_review" as const;
  }
  return "final_review" as const;
}

function getNextStatus(
  claim: Claim,
  stage: ClaimReviewInput["stage"],
  decision: ClaimReviewInput["decision"],
  actor: AppUser,
): ClaimStatus {
  if (decision === "rejected") {
    return "rejected";
  }

  if (decision === "changes_requested") {
    return "changes_requested";
  }

  if (stage === "admin_verification") {
    return "manager_approval_pending";
  }

  if (stage === "manager_approval") {
    return "final_approval_pending";
  }

  const roles = finalApprovalRoles(claim);
  const currentIndex = roles.indexOf(actor.role as "hod" | "super_admin");
  const hasNext = currentIndex >= 0 && currentIndex < roles.length - 1;
  return hasNext ? "final_approval_pending" : "approved_for_payment";
}

function getApprovedAmount(
  claim: Claim,
  stage: ClaimReviewInput["stage"],
  amountAfter?: number,
) {
  const baseline =
    stage === "admin_verification"
      ? claim.totalClaimed
      : claim.totalApproved || claim.totalVerified || claim.totalClaimed;

  return amountAfter ?? baseline;
}

function ledgerBalanceForUser(userId: string) {
  const entries = readLedger()
    .filter((entry) => entry.userId === userId)
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );

  return entries.at(-1)?.balanceAfter ?? 0;
}

function nextTransactionNumber(transactions: ClaimTransaction[]) {
  const next =
    transactions
      .map((transaction) =>
        Number(transaction.transactionNumber.split("-").at(-1)),
      )
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `TXN-2026-${String(next).padStart(4, "0")}`;
}

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function sortByCreatedAtAsc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

function addTransaction(input: Omit<ClaimTransaction, "id" | "transactionNumber">) {
  const transactions = readTransactions();
  const transaction: ClaimTransaction = {
    id: crypto.randomUUID(),
    transactionNumber: nextTransactionNumber(transactions),
    ...input,
  };
  writeTransactions([transaction, ...transactions]);
  return transaction;
}

function addLedgerEntry(input: Omit<EmployeeLedgerEntry, "id">) {
  const ledgerEntry: EmployeeLedgerEntry = {
    id: crypto.randomUUID(),
    ...input,
  };
  writeLedger([ledgerEntry, ...readLedger()]);
  return ledgerEntry;
}

function applyLedgerFilters(entries: EmployeeLedgerEntry[], filters?: LedgerFilters) {
  return entries.filter((entry) => {
    if (filters?.userId && entry.userId !== filters.userId) {
      return false;
    }
    if (filters?.fromDate && entry.createdAt.slice(0, 10) < filters.fromDate) {
      return false;
    }
    if (filters?.toDate && entry.createdAt.slice(0, 10) > filters.toDate) {
      return false;
    }
    return true;
  });
}

function applyTransactionFilters(
  transactions: ClaimTransaction[],
  filters?: TransactionFilters,
) {
  return transactions.filter((transaction) => {
    if (filters?.userId && transaction.userId !== filters.userId) {
      return false;
    }
    if (
      filters?.fromDate &&
      transaction.createdAt.slice(0, 10) < filters.fromDate
    ) {
      return false;
    }
    if (filters?.toDate && transaction.createdAt.slice(0, 10) > filters.toDate) {
      return false;
    }
    if (filters?.search) {
      const query = filters.search.trim().toLowerCase();
      const haystack = [
        transaction.transactionNumber,
        transaction.claimNumber,
        transaction.voucherNumber,
        transaction.userName,
        transaction.description,
        transaction.type,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    }
    return true;
  });
}

function userById(userId: string) {
  return DEMO_USERS.map(toAppUser).find((user) => user.id === userId);
}

type SupabaseClient = NonNullable<typeof supabase>;

interface SupabaseProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role_id: Role | null;
  employee_code: string | null;
  employee_id: string | null;
}

interface SupabaseProjectRow {
  id: string;
  code: string | null;
  name: string | null;
  location: string | null;
}

interface SupabaseCostCodeRow {
  id: string;
  project_id: string;
  code: string | null;
  name: string | null;
}

interface SupabaseClaimRow {
  id: string;
  organization_id: string | null;
  department_id: string | null;
  requester_user_id: string | null;
  reporting_manager_id: string | null;
  hod_user_id: string | null;
  claim_number: string;
  title: string;
  user_id: string;
  project_id: string | null;
  period_from: string;
  period_to: string;
  status: ClaimStatus;
  total_claimed: number | string;
  total_verified: number | string;
  total_approved: number | string;
  remarks: string | null;
  approval_path?: unknown;
  submitted_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SupabaseClaimItemRow {
  id: string;
  claim_id: string;
  category_id: string | null;
  project_id: string | null;
  project_cost_code_id: string | null;
  description: string;
  bill_type: ExpenseBillType;
  amount: number | string;
  expense_date: string;
  attachment_link: string | null;
  remarks: string | null;
}

interface SupabaseClaimAttachmentRow {
  id: string;
  claim_id: string;
  file_url: string;
  file_bucket: string | null;
  file_path: string | null;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface SupabaseClaimApprovalRow {
  id: string;
  claim_id: string;
  stage: ClaimApprovalStage;
  decision: ClaimDecision;
  actor_id: string;
  actor_role: Role;
  remarks: string | null;
  amount_before: number | string | null;
  amount_after: number | string | null;
  created_at: string;
}

interface SupabaseVoucherRow {
  id: string;
  claim_id: string | null;
  voucher_number: string;
  voucher_date: string;
  paid_to_name: string;
  paid_to_email: string | null;
  approved_amount: number | string;
  deduction_amount: number | string;
  net_payable_amount: number | string;
  prepared_by: string | null;
  accounts_note: string | null;
  status: PaymentVoucher["status"];
  paid_at: string | null;
  payment_reference: string | null;
  paid_amount?: number | string | null;
  created_at: string;
}

interface SupabaseLedgerRow {
  id: string;
  user_id: string;
  claim_id: string | null;
  claim_number: string | null;
  voucher_id: string | null;
  voucher_number: string | null;
  transaction_type: EmployeeLedgerEntry["type"];
  description: string;
  debit: number | string;
  credit: number | string;
  balance_after: number | string;
  created_at: string;
}

interface SupabaseTransactionRow {
  id: string;
  transaction_number: string;
  user_id: string;
  claim_id: string | null;
  claim_number: string | null;
  voucher_id: string | null;
  voucher_number: string | null;
  transaction_type: ClaimTransaction["type"];
  description: string;
  amount: number | string;
  direction: ClaimTransaction["direction"];
  balance_after: number | string;
  actor_id: string | null;
  actor_role: Role | null;
  created_at: string;
}

interface SupabaseWorkflowScope {
  organizationId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
}

function shouldUseSupabaseClaims() {
  return isSupabaseConfigured && Boolean(supabase);
}

function claimsClient(): SupabaseClient {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function isUuid(value: string | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

function localProjectId(project: SupabaseProjectRow | undefined, fallback?: string | null) {
  if (!project) {
    return fallback ?? "";
  }
  return project.id;
}

function localCostCodeId(
  costCode: SupabaseCostCodeRow | undefined,
  projectId: string,
  fallback?: string | null,
) {
  if (!costCode) {
    return fallback ?? "";
  }
  return (
    COST_CODE_OPTIONS.find(
      (option) => option.projectId === projectId && option.code === costCode.code,
    )?.id ?? costCode.id
  );
}

async function dbProjectId(projectId: string | undefined) {
  if (!projectId || isUuid(projectId)) {
    return projectId ?? null;
  }
  throw new Error("Production project selections must use database project IDs.");
}

async function dbCostCodeId(costCodeId: string | undefined, projectDbId: string | null) {
  if (!costCodeId || isUuid(costCodeId) || !projectDbId) {
    return costCodeId ?? null;
  }
  const costCode = COST_CODE_OPTIONS.find((option) => option.id === costCodeId);
  if (!costCode) {
    return null;
  }
  const { data, error } = await claimsClient()
    .from("project_cost_codes")
    .select("id")
    .eq("project_id", projectDbId)
    .eq("code", costCode.code)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as { id: string } | null)?.id ?? null;
}

async function fetchProfiles(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return new Map<string, SupabaseProfileRow>();
  }
  const { data, error } = await claimsClient()
    .from("user_profiles")
    .select("id, full_name, email, role_id, employee_code, employee_id")
    .in("id", uniqueIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map(
    (data as SupabaseProfileRow[]).map((profile) => [profile.id, profile]),
  );
}

async function fetchProjects(ids: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (uniqueIds.length === 0) {
    return new Map<string, SupabaseProjectRow>();
  }
  const { data, error } = await claimsClient()
    .from("projects")
    .select("id, code, name, location")
    .in("id", uniqueIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map((data as SupabaseProjectRow[]).map((project) => [project.id, project]));
}

async function fetchCostCodes(ids: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (uniqueIds.length === 0) {
    return new Map<string, SupabaseCostCodeRow>();
  }
  const { data, error } = await claimsClient()
    .from("project_cost_codes")
    .select("id, project_id, code, name")
    .in("id", uniqueIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map(
    (data as SupabaseCostCodeRow[]).map((costCode) => [costCode.id, costCode]),
  );
}

function parseApprovalPath(value: unknown): Claim["approvalPath"] {
  return Array.isArray(value) ? (value as Claim["approvalPath"]) : [];
}

function supabaseScopeFromUser(
  user: AppUser,
  projectId?: string | null,
): SupabaseWorkflowScope {
  return {
    organizationId: user.organizationId ?? DEMO_ORGANIZATION_ID,
    departmentId: user.departmentId ?? null,
    projectId: projectId ?? user.primaryProjectId ?? null,
  };
}

function supabaseScopeFromClaim(
  claim: Claim,
  user?: AppUser,
): SupabaseWorkflowScope {
  return {
    organizationId: claim.organizationId ?? user?.organizationId ?? DEMO_ORGANIZATION_ID,
    departmentId: claim.departmentId ?? user?.departmentId ?? null,
    projectId: claim.projectId ?? user?.primaryProjectId ?? null,
  };
}

async function mapSupabaseClaims(rows: SupabaseClaimRow[]): Promise<Claim[]> {
  if (rows.length === 0) {
    return [];
  }
  const claimIds = rows.map((claim) => claim.id);
  const [profiles, projects, itemsResult, attachmentsResult, approvalsResult] =
    await Promise.all([
      fetchProfiles(rows.map((claim) => claim.user_id)),
      fetchProjects(rows.map((claim) => claim.project_id)),
      claimsClient().from("claim_items").select("*").in("claim_id", claimIds),
      claimsClient().from("claim_attachments").select("*").in("claim_id", claimIds),
      claimsClient()
        .from("claim_approvals")
        .select("*")
        .in("claim_id", claimIds)
        .order("created_at", { ascending: true }),
    ]);

  if (itemsResult.error) {
    throw new Error(itemsResult.error.message);
  }
  if (attachmentsResult.error) {
    throw new Error(attachmentsResult.error.message);
  }
  if (approvalsResult.error) {
    throw new Error(approvalsResult.error.message);
  }

  const items = (itemsResult.data ?? []) as SupabaseClaimItemRow[];
  const attachments = (attachmentsResult.data ?? []) as SupabaseClaimAttachmentRow[];
  const approvals = (approvalsResult.data ?? []) as SupabaseClaimApprovalRow[];
  const [itemProjects, costCodes, approvalActors] = await Promise.all([
    fetchProjects(items.map((item) => item.project_id)),
    fetchCostCodes(items.map((item) => item.project_cost_code_id)),
    fetchProfiles(approvals.map((approval) => approval.actor_id)),
  ]);

  const attachmentUrls = new Map<string, string>();
  await Promise.all(
    attachments.map(async (attachment) => {
      if (!attachment.file_bucket || !attachment.file_path) {
        attachmentUrls.set(attachment.id, attachment.file_url);
        return;
      }
      try {
        attachmentUrls.set(
          attachment.id,
          await storageService.createSignedUrl(
            attachment.file_bucket as Parameters<typeof storageService.createSignedUrl>[0],
            attachment.file_path,
          ),
        );
      } catch {
        attachmentUrls.set(attachment.id, attachment.file_url);
      }
    }),
  );

  return rows.map((row) => {
    const profile = profiles.get(row.user_id);
    const project = row.project_id ? projects.get(row.project_id) : undefined;
    const mappedProjectId = localProjectId(project, row.project_id);
    const claimItems: ClaimItem[] = items
      .filter((item) => item.claim_id === row.id)
      .map((item) => {
        const itemProject = item.project_id ? itemProjects.get(item.project_id) : project;
        const projectId = localProjectId(itemProject, item.project_id);
        const costCode = item.project_cost_code_id
          ? costCodes.get(item.project_cost_code_id)
          : undefined;
        const category = EXPENSE_CATEGORIES.find(
          (candidate) => candidate.id === item.category_id,
        );
        return {
          id: item.id,
          categoryId: item.category_id ?? "",
          categoryName: category?.name ?? item.category_id ?? "Uncategorized",
          projectId,
          projectName: itemProject?.name ?? project?.name ?? "Project",
          costCodeId: localCostCodeId(costCode, projectId, item.project_cost_code_id),
          costCode: costCode?.code ?? "",
          description: item.description,
          billType: item.bill_type,
          amount: toNumber(item.amount),
          expenseDate: item.expense_date,
          attachmentName: item.attachment_link ?? undefined,
          remarks: item.remarks ?? undefined,
        };
      });

    return {
      id: row.id,
      organizationId: row.organization_id ?? undefined,
      departmentId: row.department_id ?? undefined,
      requesterUserId: row.requester_user_id ?? row.user_id,
      reportingManagerId: row.reporting_manager_id ?? undefined,
      hodUserId: row.hod_user_id ?? undefined,
      claimNumber: row.claim_number,
      title: row.title,
      userId: row.user_id,
      userName: profile?.full_name ?? "User",
      userEmail: profile?.email ?? "",
      projectId: mappedProjectId,
      projectName: project?.name ?? "Project",
      periodFrom: row.period_from,
      periodTo: row.period_to,
      status: row.status,
      items: claimItems,
      attachments: attachments
        .filter((attachment) => attachment.claim_id === row.id)
        .map((attachment) => ({
          id: attachment.id,
          fileName: attachment.file_name,
          fileType: attachment.file_type ?? "",
          fileSize: attachment.file_size ?? 0,
          url: attachmentUrls.get(attachment.id) ?? attachment.file_url,
          bucket: attachment.file_bucket ?? undefined,
          path: attachment.file_path ?? undefined,
          uploadedAt: attachment.created_at,
        })),
      approvals: approvals
        .filter((approval) => approval.claim_id === row.id)
        .map((approval) => {
          const actor = approvalActors.get(approval.actor_id);
          return {
            id: approval.id,
            claimId: approval.claim_id,
            stage: approval.stage,
            decision: approval.decision,
            actorId: approval.actor_id,
            actorName: actor?.full_name ?? "Approver",
            actorRole: approval.actor_role,
            remarks: approval.remarks ?? undefined,
            amountBefore:
              approval.amount_before === null
                ? undefined
                : toNumber(approval.amount_before),
            amountAfter:
              approval.amount_after === null
                ? undefined
                : toNumber(approval.amount_after),
            createdAt: approval.created_at,
          };
        }),
      approvalPath: parseApprovalPath(row.approval_path),
      totalClaimed: toNumber(row.total_claimed),
      totalVerified: toNumber(row.total_verified),
      totalApproved: toNumber(row.total_approved),
      remarks: row.remarks ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      submittedAt: row.submitted_at ?? undefined,
      paidAt: row.paid_at ?? undefined,
    };
  });
}

async function getSupabaseClaim(claimId: string, user: AppUser) {
  const { data, error } = await claimsClient()
    .from("claims")
    .select("*")
    .eq("id", claimId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  const [claim] = await mapSupabaseClaims([data as SupabaseClaimRow]);
  return claim && canViewClaim(user, claim) ? claim : null;
}

async function nextSupabaseNumber(
  table: "claims" | "payment_vouchers" | "transactions",
  column: string,
  prefix: string,
  fallback: number,
) {
  const { data, error } = await claimsClient()
    .from(table)
    .select(column)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) {
    throw new Error(error.message);
  }
  const paddedLength = prefix.includes("PV") || prefix.includes("TXN") ? 4 : 0;
  const next =
    (((data as unknown) as Record<string, string>[] | null) ?? [])
      .map((row) => {
        const value = String(row[column]);
        const suffix = value.startsWith(prefix)
          ? value.slice(prefix.length)
          : value.split("-").at(-1) ?? "";
        return Number(suffix.split("-")[0]);
      })
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), fallback) + 1;
  const sequence = String(next).padStart(paddedLength, "0");
  const entropy =
    table === "payment_vouchers" ? "" : `-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  return `${prefix}${sequence}${entropy}`;
}

async function insertSupabaseClaim(
  input: ClaimInput,
  user: AppUser,
  status: ClaimStatus,
) {
  const total = input.items.reduce((sum, item) => sum + item.amount, 0);
  const projectId = await dbProjectId(input.projectId);
  const createdAt = now();
  const organizationId = user.organizationId ?? DEMO_ORGANIZATION_ID;
  const approvalPath =
    status === "draft"
      ? []
      : await approvalMatrixService
          .resolveApprovalPath({
            organizationId,
            workflowType: "claim",
            requesterUserId: user.id,
            departmentId: user.departmentId,
            projectId: input.projectId,
            amount: total,
            expenseCategoryId: input.items[0]?.categoryId,
          })
          .then((result) => result.steps)
          .catch(() => []);
  const claimNumber = await nextSupabaseNumber(
    "claims",
    "claim_number",
    "SC-CLM-",
    1029,
  );
  const { data, error } = await claimsClient()
    .from("claims")
    .insert({
      claim_number: claimNumber,
      title: input.title,
      user_id: user.id,
      organization_id: organizationId,
      department_id: user.departmentId ?? null,
      requester_user_id: user.id,
      reporting_manager_id: user.reportingManagerId ?? user.managerId ?? null,
      hod_user_id: user.hodUserId ?? null,
      project_id: projectId,
      period_from: input.periodFrom,
      period_to: input.periodTo,
      status,
      total_claimed: total,
      total_verified: 0,
      total_approved: 0,
      remarks: input.remarks ?? null,
      approval_path: approvalPath,
      submitted_at: status === "draft" ? null : createdAt,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(error.message);
  }
  const claimRow = data as SupabaseClaimRow;
  const itemRows = await Promise.all(
    input.items.map(async (item) => {
      const itemProjectId = await dbProjectId(item.projectId);
      return {
        claim_id: claimRow.id,
        organization_id: organizationId,
        department_id: user.departmentId ?? null,
        category_id: item.categoryId,
        project_id: itemProjectId,
        project_cost_code_id: await dbCostCodeId(item.costCodeId, itemProjectId),
        description: item.description,
        bill_type: item.billType,
        amount: item.amount,
        expense_date: item.expenseDate,
        attachment_link: item.attachmentName ?? null,
        remarks: item.remarks ?? null,
      };
    }),
  );
  if (itemRows.length > 0) {
    const { error: itemsError } = await claimsClient().from("claim_items").insert(itemRows);
    if (itemsError) {
      throw new Error(itemsError.message);
    }
  }
  if (input.attachments.length > 0) {
    const { error: attachmentsError } = await claimsClient()
      .from("claim_attachments")
      .insert(
        input.attachments.map((attachment) => ({
          claim_id: claimRow.id,
          organization_id: organizationId,
          file_url: attachment.path ?? attachment.url,
          file_bucket: attachment.bucket ?? "claim-attachments",
          file_path: attachment.path ?? attachment.url,
          file_name: attachment.fileName,
          file_type: attachment.fileType,
          file_size: attachment.fileSize,
          uploaded_by: user.id,
        })),
      );
    if (attachmentsError) {
      throw new Error(attachmentsError.message);
    }
  }
  if (status !== "draft") {
    const { error: approvalError } = await claimsClient()
      .from("claim_approvals")
      .insert({
        claim_id: claimRow.id,
        organization_id: organizationId,
        department_id: user.departmentId ?? null,
        stage: "submission",
        decision: "submitted",
        actor_id: user.id,
        actor_role: user.role,
        remarks: input.remarks ?? null,
      });
    if (approvalError) {
      throw new Error(approvalError.message);
    }
    await addSupabaseTransaction(
      {
        userId: user.id,
        userName: user.fullName,
        claimId: claimRow.id,
        claimNumber,
        type: "claim_submitted",
        description: `Claim ${claimNumber} submitted`,
        amount: total,
        direction: "none",
        balanceAfter: await ledgerBalanceForSupabaseUser(user.id),
        actorId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        createdAt,
      },
      supabaseScopeFromUser(user, input.projectId),
    );
  }
  const claim = await getSupabaseClaim(claimRow.id, user);
  if (!claim) {
    throw new Error("Claim was saved but could not be loaded.");
  }
  return claim;
}

async function ledgerBalanceForSupabaseUser(userId: string) {
  const { data, error } = await claimsClient()
    .from("employee_ledgers")
    .select("balance_after")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return toNumber((data as { balance_after?: number | string } | null)?.balance_after);
}

async function addSupabaseLedgerEntry(
  input: Omit<EmployeeLedgerEntry, "id">,
  scope?: SupabaseWorkflowScope,
) {
  const fallbackUser = userById(input.userId);
  const projectId = await dbProjectId(scope?.projectId ?? fallbackUser?.primaryProjectId);
  const { error } = await claimsClient()
    .from("employee_ledgers")
    .insert({
      user_id: input.userId,
      organization_id:
        scope?.organizationId ?? fallbackUser?.organizationId ?? DEMO_ORGANIZATION_ID,
      department_id: scope?.departmentId ?? fallbackUser?.departmentId ?? null,
      project_id: projectId,
      claim_id: input.claimId ?? null,
      claim_number: input.claimNumber ?? null,
      voucher_id: input.voucherId ?? null,
      voucher_number: input.voucherNumber ?? null,
      transaction_type: input.type,
      description: input.description,
      debit: input.debit,
      credit: input.credit,
      balance_after: input.balanceAfter,
      created_at: input.createdAt,
    });
  if (error) {
    throw new Error(error.message);
  }
  return {
    id: crypto.randomUUID(),
    ...input,
  };
}

async function addSupabaseTransaction(
  input: Omit<ClaimTransaction, "id" | "transactionNumber">,
  scope?: SupabaseWorkflowScope,
) {
  const fallbackUser = userById(input.userId);
  const projectId = await dbProjectId(scope?.projectId ?? fallbackUser?.primaryProjectId);
  const transactionNumber = await nextSupabaseNumber(
    "transactions",
    "transaction_number",
    "TXN-2026-",
    0,
  );
  const { data, error } = await claimsClient()
    .from("transactions")
    .insert({
      transaction_number: transactionNumber,
      organization_id:
        scope?.organizationId ?? fallbackUser?.organizationId ?? DEMO_ORGANIZATION_ID,
      department_id: scope?.departmentId ?? fallbackUser?.departmentId ?? null,
      project_id: projectId,
      user_id: input.userId,
      claim_id: input.claimId ?? null,
      claim_number: input.claimNumber ?? null,
      voucher_id: input.voucherId ?? null,
      voucher_number: input.voucherNumber ?? null,
      transaction_type: input.type,
      description: input.description,
      amount: input.amount,
      direction: input.direction,
      balance_after: input.balanceAfter,
      actor_id: input.actorId,
      actor_role: input.actorRole,
      created_at: input.createdAt,
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return mapSupabaseTransactionRows([data as SupabaseTransactionRow], new Map(), new Map())[0];
}

function mapSupabaseVoucherRows(
  rows: SupabaseVoucherRow[],
  preparers: Map<string, SupabaseProfileRow>,
): PaymentVoucher[] {
  return rows.map((row) => ({
    id: row.id,
    claimId: row.claim_id ?? "",
    voucherNumber: row.voucher_number,
    voucherDate: row.voucher_date,
    paidToName: row.paid_to_name,
    paidToEmail: row.paid_to_email ?? "",
    approvedAmount: toNumber(row.approved_amount),
    deductionAmount: toNumber(row.deduction_amount),
    netPayableAmount: toNumber(row.net_payable_amount),
    preparedBy: row.prepared_by ?? "",
    preparedByName: row.prepared_by
      ? preparers.get(row.prepared_by)?.full_name ?? "Accounts"
      : "Accounts",
    accountsNote: row.accounts_note ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at ?? undefined,
    paymentReference: row.payment_reference ?? undefined,
    paidAmount: toNumber(row.paid_amount),
  }));
}

function mapSupabaseLedgerRows(
  rows: SupabaseLedgerRow[],
  profiles: Map<string, SupabaseProfileRow>,
): EmployeeLedgerEntry[] {
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: profiles.get(row.user_id)?.full_name ?? undefined,
    claimId: row.claim_id ?? undefined,
    claimNumber: row.claim_number ?? undefined,
    voucherId: row.voucher_id ?? undefined,
    voucherNumber: row.voucher_number ?? undefined,
    type: row.transaction_type,
    description: row.description,
    debit: toNumber(row.debit),
    credit: toNumber(row.credit),
    balanceAfter: toNumber(row.balance_after),
    createdAt: row.created_at,
  }));
}

function mapSupabaseTransactionRows(
  rows: SupabaseTransactionRow[],
  profiles: Map<string, SupabaseProfileRow>,
  actors: Map<string, SupabaseProfileRow>,
): ClaimTransaction[] {
  return rows.map((row) => ({
    id: row.id,
    transactionNumber: row.transaction_number,
    userId: row.user_id,
    userName: profiles.get(row.user_id)?.full_name ?? "User",
    claimId: row.claim_id ?? undefined,
    claimNumber: row.claim_number ?? undefined,
    voucherId: row.voucher_id ?? undefined,
    voucherNumber: row.voucher_number ?? undefined,
    type: row.transaction_type,
    description: row.description,
    amount: toNumber(row.amount),
    direction: row.direction,
    balanceAfter: toNumber(row.balance_after),
    actorId: row.actor_id ?? "",
    actorName: row.actor_id ? actors.get(row.actor_id)?.full_name ?? "Actor" : "Actor",
    actorRole: row.actor_role ?? "site_staff",
    createdAt: row.created_at,
  }));
}

export const claimsService = {
  async listClaims(user: AppUser, filters?: ClaimFilters) {
    if (shouldUseSupabaseClaims()) {
      let query = claimsClient()
        .from("claims")
        .select("*")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.projectId) {
        const projectId = await dbProjectId(filters.projectId);
        if (projectId) {
          query = query.eq("project_id", projectId);
        }
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      const claims = (await mapSupabaseClaims(data as SupabaseClaimRow[])).filter(
        (claim) => canViewClaim(user, claim),
      );
      return sortClaims(applyFilters(claims, filters));
    }

    const claims = readClaims().filter((claim) => canViewClaim(user, claim));
    return sortClaims(applyFilters(claims, filters));
  },

  async getClaim(claimId: string, user: AppUser) {
    if (shouldUseSupabaseClaims()) {
      const claim = await getSupabaseClaim(claimId, user);
      if (!claim || claim.approvalPath?.length) {
        return claim;
      }
      const approvalPath = await approvalMatrixService
        .resolveApprovalPath({
          organizationId: claim.organizationId ?? user.organizationId ?? DEMO_ORGANIZATION_ID,
          workflowType: "claim",
          requesterUserId: claim.userId,
          departmentId: claim.departmentId,
          projectId: claim.projectId,
          amount: claim.totalClaimed,
          expenseCategoryId: claim.items[0]?.categoryId,
        })
        .then((result) => result.steps)
        .catch(() => []);
      return { ...claim, approvalPath };
    }

    const claim = readClaims().find((item) => item.id === claimId);
    if (!claim || !canViewClaim(user, claim)) {
      return null;
    }

    return claim;
  },

  async listApprovalQueue(
    user: AppUser,
    stage: "admin" | "manager" | "final" | "payment",
  ) {
    const statusByStage: Record<typeof stage, ClaimStatus[]> = {
      admin: ["admin_verification_pending"],
      manager: ["manager_approval_pending"],
      final: ["final_approval_pending"],
      payment: [
        "approved_for_payment",
        "voucher_generated",
        "partial_paid",
        "pending_payment",
      ],
    };
    if (shouldUseSupabaseClaims()) {
      const { data, error } = await claimsClient()
        .from("claims")
        .select("*")
        .in("status", statusByStage[stage])
        .is("deleted_at", null)
        .order("submitted_at", { ascending: true, nullsFirst: false })
        .limit(50);
      if (error) {
        throw new Error(error.message);
      }
      const actionByStage = {
        admin: "admin_review",
        manager: "manager_review",
        final: "final_review",
        payment: "generate_voucher",
      } as const;
      const mappedClaims = await mapSupabaseClaims(data as SupabaseClaimRow[]);
      return mappedClaims.filter((claim) =>
        canPerformClaimAction({
          user,
          claim,
          action: actionByStage[stage],
        }).allowed,
      );
    }

    const actionByStage = {
      admin: "admin_review",
      manager: "manager_review",
      final: "final_review",
      payment: "generate_voucher",
    } as const;
    const claims = readClaims();
    return claims.filter(
      (claim) =>
        statusByStage[stage].includes(claim.status) &&
        canPerformClaimAction({
          user,
          claim,
          action: actionByStage[stage],
        }).allowed,
    );
  },

  async saveDraft(input: ClaimInput, user: AppUser) {
    if (shouldUseSupabaseClaims()) {
      const claim = await insertSupabaseClaim(input, user, "draft");
      await recordAuditLog({
        userId: user.id,
        action: "claims.draft_saved",
        entityType: "claim",
        entityId: claim.id,
        newValues: {
          claimNumber: claim.claimNumber,
          totalClaimed: claim.totalClaimed,
        },
      });
      const recipientId = user.reportingManagerId ?? user.managerId;
      if (recipientId) {
        await notificationService.send({
          userId: recipientId,
          type: "claim_submitted",
          title: `Claim ${claim.claimNumber} submitted`,
          message: `${user.fullName} submitted a claim for review.`,
          relatedId: claim.id,
          relatedType: "claim",
        }).catch(() => undefined);
      }
      return claim;
    }

    const claims = readClaims();
    const total = input.items.reduce((sum, item) => sum + item.amount, 0);
    const id = crypto.randomUUID();
    const claim: Claim = {
      id,
      organizationId: user.organizationId ?? DEMO_ORGANIZATION_ID,
      departmentId: user.departmentId,
      requesterUserId: user.id,
      reportingManagerId: user.reportingManagerId ?? user.managerId,
      hodUserId: user.hodUserId,
      claimNumber: nextClaimNumber(claims),
      title: input.title,
      userId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      projectId: input.projectId,
      projectName: projectName(input.projectId),
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      status: "draft",
      items: input.items,
      attachments: input.attachments,
      approvals: [],
      totalClaimed: total,
      totalVerified: 0,
      totalApproved: 0,
      remarks: input.remarks,
      createdAt: now(),
      updatedAt: now(),
    };

    writeClaims([claim, ...claims]);
    await recordAuditLog({
      userId: user.id,
      action: "claims.draft_saved",
      entityType: "claim",
      entityId: claim.id,
      newValues: { claimNumber: claim.claimNumber, totalClaimed: total },
    });
    return claim;
  },

  async submitClaim(input: ClaimInput, user: AppUser) {
    if (shouldUseSupabaseClaims()) {
      const claim = await insertSupabaseClaim(
        input,
        user,
        "admin_verification_pending",
      );
      await recordAuditLog({
        userId: user.id,
        action: "claims.submitted",
        entityType: "claim",
        entityId: claim.id,
        newValues: {
          claimNumber: claim.claimNumber,
          totalClaimed: claim.totalClaimed,
        },
      });
      return claim;
    }

    const claims = readClaims();
    const total = input.items.reduce((sum, item) => sum + item.amount, 0);
    const id = crypto.randomUUID();
    const createdAt = now();
    const organizationId = user.organizationId ?? DEMO_ORGANIZATION_ID;
    const approvalPath = await approvalMatrixService
      .resolveApprovalPath({
        organizationId,
        workflowType: "claim",
        requesterUserId: user.id,
        departmentId: user.departmentId,
        projectId: input.projectId,
        amount: total,
        expenseCategoryId: input.items[0]?.categoryId,
      })
      .then((result) => result.steps)
      .catch(() => []);
    const claim: Claim = {
      id,
      organizationId,
      departmentId: user.departmentId,
      requesterUserId: user.id,
      reportingManagerId: user.reportingManagerId ?? user.managerId,
      hodUserId: user.hodUserId,
      claimNumber: nextClaimNumber(claims),
      title: input.title,
      userId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      projectId: input.projectId,
      projectName: projectName(input.projectId),
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      status: "admin_verification_pending",
      items: input.items,
      attachments: input.attachments,
      approvals: [
        makeApproval(id, "submission", "submitted", user, input.remarks),
      ],
      approvalPath,
      totalClaimed: total,
      totalVerified: 0,
      totalApproved: 0,
      remarks: input.remarks,
      createdAt,
      updatedAt: createdAt,
      submittedAt: createdAt,
    };

    writeClaims([claim, ...claims]);
    addTransaction({
      userId: user.id,
      userName: user.fullName,
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      type: "claim_submitted",
      description: `Claim ${claim.claimNumber} submitted`,
      amount: total,
      direction: "none",
      balanceAfter: ledgerBalanceForUser(user.id),
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      createdAt,
    });
    await recordAuditLog({
      userId: user.id,
      action: "claims.submitted",
      entityType: "claim",
      entityId: claim.id,
      newValues: { claimNumber: claim.claimNumber, totalClaimed: total },
    });
    return claim;
  },

  async reviewClaim(input: ClaimReviewInput, user: AppUser) {
    if (shouldUseSupabaseClaims()) {
      const claim = await getSupabaseClaim(input.claimId, user);
      if (!claim) {
        throw new Error("Claim not found.");
      }
      const permission = canPerformClaimAction({
        user,
        claim,
        action: getStageAction(input.stage),
      });
      if (!permission.allowed) {
        throw new Error(permission.reason ?? "Action not allowed.");
      }

      const amountBefore =
        claim.totalApproved || claim.totalVerified || claim.totalClaimed;
      const amountAfter = getApprovedAmount(
        claim,
        input.stage,
        input.amountAfter,
      );
      const nextStatus = getNextStatus(claim, input.stage, input.decision, user);
      const decision: ClaimDecision =
        input.decision === "reduced" ? "reduced" : input.decision;
      const updatePayload = {
        status: nextStatus,
        total_verified:
          input.stage === "admin_verification" &&
          !["rejected", "changes_requested"].includes(input.decision)
            ? amountAfter
            : claim.totalVerified,
        total_approved:
          input.stage !== "admin_verification" &&
          !["rejected", "changes_requested"].includes(input.decision)
            ? amountAfter
            : input.stage === "admin_verification" &&
                !["rejected", "changes_requested"].includes(input.decision)
              ? amountAfter
              : claim.totalApproved,
        updated_by: user.id,
      };
      const { error: updateError } = await claimsClient()
        .from("claims")
        .update(updatePayload)
        .eq("id", claim.id);
      if (updateError) {
        throw new Error(updateError.message);
      }
      const { error: approvalError } = await claimsClient()
        .from("claim_approvals")
        .insert({
          claim_id: claim.id,
          organization_id: claim.organizationId ?? user.organizationId ?? DEMO_ORGANIZATION_ID,
          department_id: claim.departmentId ?? null,
          stage: input.stage,
          decision,
          actor_id: user.id,
          actor_role: user.role,
          remarks: input.remarks,
          amount_before: amountBefore,
          amount_after: amountAfter,
        });
      if (approvalError) {
        throw new Error(approvalError.message);
      }

      const transactionType =
        input.decision === "rejected"
          ? "claim_rejected"
          : input.decision === "changes_requested"
            ? "changes_requested"
            : input.decision === "reduced"
              ? "amount_reduced"
              : input.stage === "admin_verification"
                ? "admin_verified"
                : input.stage === "manager_approval"
                  ? "manager_approved"
                  : "final_approved";
      const balanceAfter =
        input.stage === "final_approval" &&
        !["rejected", "changes_requested"].includes(input.decision)
          ? (await ledgerBalanceForSupabaseUser(claim.userId)) + amountAfter
          : await ledgerBalanceForSupabaseUser(claim.userId);

      if (
        input.stage === "final_approval" &&
        !["rejected", "changes_requested"].includes(input.decision)
      ) {
        await addSupabaseLedgerEntry(
          {
            userId: claim.userId,
            userName: claim.userName,
            claimId: claim.id,
            claimNumber: claim.claimNumber,
            type: "claim_approved",
            description: `Claim ${claim.claimNumber} approved for payment`,
            debit: amountAfter,
            credit: 0,
            balanceAfter,
            createdAt: now(),
          },
          supabaseScopeFromClaim(claim, user),
        );
      }

      await addSupabaseTransaction(
        {
          userId: claim.userId,
          userName: claim.userName,
          claimId: claim.id,
          claimNumber: claim.claimNumber,
          type: transactionType,
          description: `${claim.claimNumber}: ${input.stage.split("_").join(" ")} ${input.decision.split("_").join(" ")}`,
          amount: amountAfter,
          direction:
            input.stage === "final_approval" &&
            !["rejected", "changes_requested"].includes(input.decision)
              ? "debit"
              : input.decision === "reduced"
                ? "credit"
                : "none",
          balanceAfter,
          actorId: user.id,
          actorName: user.fullName,
          actorRole: user.role,
          createdAt: now(),
        },
        supabaseScopeFromClaim(claim, user),
      );
      await recordAuditLog({
        userId: user.id,
        action: `claims.${input.stage}.${input.decision}`,
        entityType: "claim",
        entityId: claim.id,
        oldValues: { status: claim.status, totalApproved: claim.totalApproved },
        newValues: updatePayload as Record<string, unknown>,
      });
      if (
        input.stage === "final_approval" &&
        nextStatus === "approved_for_payment"
      ) {
        await recordAuditLog({
          userId: user.id,
          action: "claims.moved_to_accounts",
          entityType: "claim",
          entityId: claim.id,
          newValues: { finalApproverRole: user.role },
        });
      }
      const updated = await getSupabaseClaim(claim.id, user);
      if (!updated) {
        throw new Error("Claim was updated but could not be loaded.");
      }
      await notificationService.send({
        userId: claim.userId,
        type: `claim_${input.decision}`,
        title: `Claim ${claim.claimNumber} ${input.decision.split("_").join(" ")}`,
        message: input.remarks || `${user.fullName} completed ${input.stage.split("_").join(" ")}.`,
        relatedId: claim.id,
        relatedType: "claim",
      }).catch(() => undefined);
      return updated;
    }

    const claims = readClaims();
    const claim = claims.find((item) => item.id === input.claimId);
    if (!claim) {
      throw new Error("Claim not found.");
    }

    const permission = canPerformClaimAction({
      user,
      claim,
      action: getStageAction(input.stage),
    });
    if (!permission.allowed) {
      throw new Error(permission.reason ?? "Action not allowed.");
    }

    const amountBefore =
      claim.totalApproved || claim.totalVerified || claim.totalClaimed;
    const amountAfter = getApprovedAmount(
      claim,
      input.stage,
      input.amountAfter,
    );
    const decision: ClaimDecision =
      input.decision === "reduced" ? "reduced" : input.decision;
    const nextStatus = getNextStatus(claim, input.stage, input.decision, user);
    const updatedClaim: Claim = {
      ...claim,
      status: nextStatus,
      totalVerified:
        input.stage === "admin_verification" &&
        !["rejected", "changes_requested"].includes(input.decision)
          ? amountAfter
          : claim.totalVerified,
      totalApproved:
        input.stage !== "admin_verification" &&
        !["rejected", "changes_requested"].includes(input.decision)
          ? amountAfter
          : input.stage === "admin_verification" &&
              !["rejected", "changes_requested"].includes(input.decision)
            ? amountAfter
            : claim.totalApproved,
      approvals: [
        ...claim.approvals,
        makeApproval(
          claim.id,
          input.stage,
          decision,
          user,
          input.remarks,
          amountBefore,
          amountAfter,
        ),
      ],
      updatedAt: now(),
    };

    writeClaims(
      claims.map((item) => (item.id === claim.id ? updatedClaim : item)),
    );
    const transactionType =
      input.decision === "rejected"
        ? "claim_rejected"
        : input.decision === "changes_requested"
          ? "changes_requested"
          : input.decision === "reduced"
            ? "amount_reduced"
            : input.stage === "admin_verification"
              ? "admin_verified"
              : input.stage === "manager_approval"
                ? "manager_approved"
                : "final_approved";
    const balanceAfter =
      input.stage === "final_approval" &&
      !["rejected", "changes_requested"].includes(input.decision)
        ? ledgerBalanceForUser(claim.userId) + amountAfter
        : ledgerBalanceForUser(claim.userId);

    if (
      input.stage === "final_approval" &&
      !["rejected", "changes_requested"].includes(input.decision)
    ) {
      addLedgerEntry({
        userId: claim.userId,
        userName: claim.userName,
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        type: "claim_approved",
        description: `Claim ${claim.claimNumber} approved for payment`,
        debit: amountAfter,
        credit: 0,
        balanceAfter,
        createdAt: updatedClaim.updatedAt,
      });
    }

    addTransaction({
      userId: claim.userId,
      userName: claim.userName,
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      type: transactionType,
      description: `${claim.claimNumber}: ${input.stage.split("_").join(" ")} ${input.decision.split("_").join(" ")}`,
      amount: amountAfter,
      direction:
        input.stage === "final_approval" &&
        !["rejected", "changes_requested"].includes(input.decision)
          ? "debit"
          : input.decision === "reduced"
            ? "credit"
            : "none",
      balanceAfter,
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      createdAt: updatedClaim.updatedAt,
    });
    await recordAuditLog({
      userId: user.id,
      action: `claims.${input.stage}.${input.decision}`,
      entityType: "claim",
      entityId: claim.id,
      oldValues: { status: claim.status, totalApproved: claim.totalApproved },
      newValues: {
        status: updatedClaim.status,
        totalApproved: updatedClaim.totalApproved,
      },
    });
    if (
      input.stage === "final_approval" &&
      nextStatus === "approved_for_payment"
    ) {
      await recordAuditLog({
        userId: user.id,
        action: "claims.moved_to_accounts",
        entityType: "claim",
        entityId: claim.id,
        newValues: { finalApproverRole: user.role },
      });
    }
    return updatedClaim;
  },

  async generateVoucher(claimId: string, user: AppUser, accountsNote?: string) {
    if (shouldUseSupabaseClaims()) {
      const claim = await getSupabaseClaim(claimId, user);
      if (!claim) {
        throw new Error("Claim not found.");
      }
      const permission = canPerformClaimAction({
        user,
        claim,
        action: "generate_voucher",
      });
      if (!permission.allowed) {
        throw new Error(permission.reason ?? "Action not allowed.");
      }

      const approvedAmount = claim.totalApproved || claim.totalClaimed;
      const deductionAmount = Math.max(claim.totalClaimed - approvedAmount, 0);
      const voucherNumber = await nextSupabaseNumber(
        "payment_vouchers",
        "voucher_number",
        "PV-2026-",
        42,
      );
      const { data, error } = await claimsClient()
        .from("payment_vouchers")
        .insert({
          organization_id: claim.organizationId ?? user.organizationId ?? DEMO_ORGANIZATION_ID,
          department_id: claim.departmentId ?? null,
          project_id: await dbProjectId(claim.projectId),
          claim_id: claim.id,
          voucher_number: voucherNumber,
          voucher_date: today(),
          paid_to_name: claim.userName,
          paid_to_email: claim.userEmail,
          approved_amount: approvedAmount,
          deduction_amount: deductionAmount,
          net_payable_amount: approvedAmount,
          prepared_by: user.id,
          accounts_note: accountsNote ?? null,
          status: "generated",
        })
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const { error: claimError } = await claimsClient()
        .from("claims")
        .update({ status: "voucher_generated", updated_by: user.id })
        .eq("id", claim.id);
      if (claimError) {
        throw new Error(claimError.message);
      }
      const { error: approvalError } = await claimsClient()
        .from("claim_approvals")
        .insert({
          claim_id: claim.id,
          organization_id: claim.organizationId ?? user.organizationId ?? DEMO_ORGANIZATION_ID,
          department_id: claim.departmentId ?? null,
          stage: "accounts_payment",
          decision: "voucher_generated",
          actor_id: user.id,
          actor_role: user.role,
          remarks: accountsNote ?? null,
          amount_before: approvedAmount,
          amount_after: approvedAmount,
        });
      if (approvalError) {
        throw new Error(approvalError.message);
      }

      const voucher = mapSupabaseVoucherRows(
        [data as SupabaseVoucherRow],
        new Map([[user.id, { id: user.id, full_name: user.fullName, email: user.email, role_id: user.role, employee_code: user.employeeCode ?? null, employee_id: user.employeeId }]]),
      )[0];
      const currentBalance = await ledgerBalanceForSupabaseUser(claim.userId);
      const scope = supabaseScopeFromClaim(claim, user);
      const ledgerEntry = await addSupabaseLedgerEntry(
        {
          userId: claim.userId,
          userName: claim.userName,
          claimId: claim.id,
          claimNumber: claim.claimNumber,
          voucherId: voucher.id,
          voucherNumber: voucher.voucherNumber,
          type: "voucher_generated",
          description: `Voucher ${voucher.voucherNumber} generated`,
          debit: 0,
          credit: 0,
          balanceAfter: currentBalance,
          createdAt: now(),
        },
        scope,
      );
      await addSupabaseTransaction(
        {
          userId: claim.userId,
          userName: claim.userName,
          claimId: claim.id,
          claimNumber: claim.claimNumber,
          voucherId: voucher.id,
          voucherNumber: voucher.voucherNumber,
          type: "voucher_generated",
          description: `Voucher ${voucher.voucherNumber} generated`,
          amount: voucher.netPayableAmount,
          direction: "none",
          balanceAfter: ledgerEntry.balanceAfter,
          actorId: user.id,
          actorName: user.fullName,
          actorRole: user.role,
          createdAt: ledgerEntry.createdAt,
        },
        scope,
      );
      await recordAuditLog({
        userId: user.id,
        action: "claims.voucher_generated",
        entityType: "payment_voucher",
        entityId: voucher.id,
        newValues: {
          claimId: claim.id,
          voucherNumber: voucher.voucherNumber,
          netPayableAmount: voucher.netPayableAmount,
        },
      });
      return voucher;
    }

    const claims = readClaims();
    const claim = claims.find((item) => item.id === claimId);
    if (!claim) {
      throw new Error("Claim not found.");
    }

    const permission = canPerformClaimAction({
      user,
      claim,
      action: "generate_voucher",
    });
    if (!permission.allowed) {
      throw new Error(permission.reason ?? "Action not allowed.");
    }

    const vouchers = readVouchers();
    const approvedAmount = claim.totalApproved || claim.totalClaimed;
    const deductionAmount = Math.max(claim.totalClaimed - approvedAmount, 0);
    const voucher: PaymentVoucher = {
      id: crypto.randomUUID(),
      claimId: claim.id,
      voucherNumber: nextVoucherNumber(vouchers),
      voucherDate: today(),
      paidToName: claim.userName,
      paidToEmail: claim.userEmail,
      approvedAmount,
      deductionAmount,
      netPayableAmount: approvedAmount,
      preparedBy: user.id,
      preparedByName: user.fullName,
      accountsNote,
      status: "generated",
      createdAt: now(),
    };
    const updatedClaim: Claim = {
      ...claim,
      status: "voucher_generated",
      approvals: [
        ...claim.approvals,
        makeApproval(
          claim.id,
          "accounts_payment",
          "voucher_generated",
          user,
          accountsNote,
          approvedAmount,
          approvedAmount,
        ),
      ],
      updatedAt: now(),
    };
    const currentBalance = ledgerBalanceForUser(claim.userId);
    const ledgerEntry = {
      userId: claim.userId,
      userName: claim.userName,
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      voucherId: voucher.id,
      voucherNumber: voucher.voucherNumber,
      type: "voucher_generated",
      description: `Voucher ${voucher.voucherNumber} generated`,
      debit: 0,
      credit: 0,
      balanceAfter: currentBalance,
      createdAt: now(),
    } satisfies Omit<EmployeeLedgerEntry, "id">;

    writeVouchers([voucher, ...vouchers]);
    addLedgerEntry(ledgerEntry);
    addTransaction({
      userId: claim.userId,
      userName: claim.userName,
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      voucherId: voucher.id,
      voucherNumber: voucher.voucherNumber,
      type: "voucher_generated",
      description: `Voucher ${voucher.voucherNumber} generated`,
      amount: voucher.netPayableAmount,
      direction: "none",
      balanceAfter: ledgerEntry.balanceAfter,
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      createdAt: ledgerEntry.createdAt,
    });
    writeClaims(
      claims.map((item) => (item.id === claim.id ? updatedClaim : item)),
    );
    await recordAuditLog({
      userId: user.id,
      action: "claims.voucher_generated",
      entityType: "payment_voucher",
      entityId: voucher.id,
      newValues: {
        claimId: claim.id,
        voucherNumber: voucher.voucherNumber,
        netPayableAmount: voucher.netPayableAmount,
      },
    });
    return voucher;
  },

  async markVoucherPaid(
    voucherId: string,
    user: AppUser,
    paymentReference: string,
  ) {
    if (shouldUseSupabaseClaims()) {
      const { data: voucherData, error: voucherFetchError } = await claimsClient()
        .from("payment_vouchers")
        .select("*")
        .eq("id", voucherId)
        .maybeSingle();
      if (voucherFetchError) {
        throw new Error(voucherFetchError.message);
      }
      if (!voucherData) {
        throw new Error("Voucher not found.");
      }
      const voucher = mapSupabaseVoucherRows(
        [voucherData as SupabaseVoucherRow],
        new Map([[user.id, { id: user.id, full_name: user.fullName, email: user.email, role_id: user.role, employee_code: user.employeeCode ?? null, employee_id: user.employeeId }]]),
      )[0];
      const claim = await getSupabaseClaim(voucher.claimId, user);
      if (!claim) {
        throw new Error("Claim not found.");
      }
      const permission = canPerformClaimAction({
        user,
        claim,
        action: "mark_paid",
      });
      if (!permission.allowed) {
        throw new Error(permission.reason ?? "Action not allowed.");
      }

      const paidAt = now();
      const { data, error } = await claimsClient()
        .from("payment_vouchers")
        .update({
          status: "paid",
          paid_at: paidAt,
          payment_reference: paymentReference,
        })
        .eq("id", voucherId)
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const { error: paymentError } = await claimsClient().from("payments").insert({
        reference_type: "claim_voucher",
        reference_id: voucherId,
        amount: voucher.netPayableAmount,
        payment_method: "bank_transfer",
        payment_date: today(),
        reference_number: paymentReference,
        status: "processed",
        processed_by: user.id,
      });
      if (paymentError) {
        throw new Error(paymentError.message);
      }
      const { error: claimError } = await claimsClient()
        .from("claims")
        .update({ status: "paid", paid_at: paidAt, updated_by: user.id })
        .eq("id", claim.id);
      if (claimError) {
        throw new Error(claimError.message);
      }
      const { error: approvalError } = await claimsClient()
        .from("claim_approvals")
        .insert({
          claim_id: claim.id,
          organization_id: claim.organizationId ?? user.organizationId ?? DEMO_ORGANIZATION_ID,
          department_id: claim.departmentId ?? null,
          stage: "accounts_payment",
          decision: "paid",
          actor_id: user.id,
          actor_role: user.role,
          remarks: paymentReference,
        });
      if (approvalError) {
        throw new Error(approvalError.message);
      }
      const currentBalance = await ledgerBalanceForSupabaseUser(claim.userId);
      const scope = supabaseScopeFromClaim(claim, user);
      const ledgerEntry = await addSupabaseLedgerEntry(
        {
          userId: claim.userId,
          userName: claim.userName,
          claimId: claim.id,
          claimNumber: claim.claimNumber,
          voucherId,
          voucherNumber: voucher.voucherNumber,
          type: "payment",
          description: `Payment processed for ${voucher.voucherNumber}`,
          debit: 0,
          credit: voucher.netPayableAmount,
          balanceAfter: currentBalance - voucher.netPayableAmount,
          createdAt: paidAt,
        },
        scope,
      );
      await addSupabaseTransaction(
        {
          userId: claim.userId,
          userName: claim.userName,
          claimId: claim.id,
          claimNumber: claim.claimNumber,
          voucherId,
          voucherNumber: voucher.voucherNumber,
          type: "payment_processed",
          description: `Payment processed for ${voucher.voucherNumber}`,
          amount: voucher.netPayableAmount,
          direction: "credit",
          balanceAfter: ledgerEntry.balanceAfter,
          actorId: user.id,
          actorName: user.fullName,
          actorRole: user.role,
          createdAt: paidAt,
        },
        scope,
      );
      const updatedVoucher = mapSupabaseVoucherRows(
        [data as SupabaseVoucherRow],
        new Map([[user.id, { id: user.id, full_name: user.fullName, email: user.email, role_id: user.role, employee_code: user.employeeCode ?? null, employee_id: user.employeeId }]]),
      )[0];
      await recordAuditLog({
        userId: user.id,
        action: "claims.payment_marked_paid",
        entityType: "payment_voucher",
        entityId: voucher.id,
        newValues: { paymentReference, paidAt },
      });
      return updatedVoucher;
    }

    const vouchers = readVouchers();
    const voucher = vouchers.find((item) => item.id === voucherId);
    if (!voucher) {
      throw new Error("Voucher not found.");
    }

    const claims = readClaims();
    const claim = claims.find((item) => item.id === voucher.claimId);
    if (!claim) {
      throw new Error("Claim not found.");
    }

    const permission = canPerformClaimAction({
      user,
      claim,
      action: "mark_paid",
    });
    if (!permission.allowed) {
      throw new Error(permission.reason ?? "Action not allowed.");
    }

    const paidAt = now();
    const updatedVoucher: PaymentVoucher = {
      ...voucher,
      status: "paid",
      paidAt,
      paymentReference,
    };
    const updatedClaim: Claim = {
      ...claim,
      status: "paid",
      paidAt,
      updatedAt: paidAt,
      approvals: [
        ...claim.approvals,
        makeApproval(
          claim.id,
          "accounts_payment",
          "paid",
          user,
          paymentReference,
        ),
      ],
    };
    const currentBalance = ledgerBalanceForUser(claim.userId);
    const ledgerEntry = {
      userId: claim.userId,
      userName: claim.userName,
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      voucherId,
      voucherNumber: voucher.voucherNumber,
      type: "payment",
      description: `Payment processed for ${voucher.voucherNumber}`,
      debit: 0,
      credit: voucher.netPayableAmount,
      balanceAfter: currentBalance - voucher.netPayableAmount,
      createdAt: paidAt,
    } satisfies Omit<EmployeeLedgerEntry, "id">;

    writeVouchers(
      vouchers.map((item) => (item.id === voucherId ? updatedVoucher : item)),
    );
    writeClaims(
      claims.map((item) => (item.id === claim.id ? updatedClaim : item)),
    );
    addLedgerEntry(ledgerEntry);
    addTransaction({
      userId: claim.userId,
      userName: claim.userName,
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      voucherId,
      voucherNumber: voucher.voucherNumber,
      type: "payment_processed",
      description: `Payment processed for ${voucher.voucherNumber}`,
      amount: voucher.netPayableAmount,
      direction: "credit",
      balanceAfter: ledgerEntry.balanceAfter,
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      createdAt: paidAt,
    });
    await recordAuditLog({
      userId: user.id,
      action: "claims.payment_marked_paid",
      entityType: "payment_voucher",
      entityId: voucher.id,
      newValues: { paymentReference, paidAt },
    });
    return updatedVoucher;
  },

  async markVoucherPartialPaid(
    voucherId: string,
    user: AppUser,
    amount: number,
    paymentReference: string,
  ) {
    if (!["accounts_officer", "super_admin"].includes(user.role)) {
      throw new Error("Only Accounts can process partial payments.");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Enter a valid partial payment amount.");
    }

    if (shouldUseSupabaseClaims()) {
      const { data: voucherRow, error: fetchError } = await claimsClient()
        .from("payment_vouchers")
        .select("*")
        .eq("id", voucherId)
        .maybeSingle();
      if (fetchError) throw new Error(fetchError.message);
      if (!voucherRow) throw new Error("Voucher not found.");
      const voucher = mapSupabaseVoucherRows(
        [voucherRow as SupabaseVoucherRow],
        new Map(),
      )[0];
      const nextPaidAmount = (voucher.paidAmount ?? 0) + amount;
      if (nextPaidAmount >= voucher.netPayableAmount) {
        return this.markVoucherPaid(voucherId, user, paymentReference);
      }
      const { data, error } = await claimsClient()
        .from("payment_vouchers")
        .update({
          status: "partial_paid",
          paid_amount: nextPaidAmount,
          payment_reference: paymentReference,
        })
        .eq("id", voucherId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await claimsClient().from("payments").insert({
        reference_type: "claim_voucher",
        reference_id: voucherId,
        amount,
        payment_method: "bank_transfer",
        payment_date: today(),
        reference_number: paymentReference,
        status: "partial",
        processed_by: user.id,
      });
      await claimsClient()
        .from("claims")
        .update({ status: "partial_paid", updated_by: user.id })
        .eq("id", voucher.claimId);
      await recordAuditLog({
        userId: user.id,
        action: "claims.payment_marked_partial",
        entityType: "payment_voucher",
        entityId: voucherId,
        newValues: { amount, paymentReference, paidAmount: nextPaidAmount },
      });
      return mapSupabaseVoucherRows([data as SupabaseVoucherRow], new Map())[0];
    }

    const vouchers = readVouchers();
    const voucher = vouchers.find((item) => item.id === voucherId);
    if (!voucher) throw new Error("Voucher not found.");
    const nextPaidAmount = (voucher.paidAmount ?? 0) + amount;
    if (nextPaidAmount >= voucher.netPayableAmount) {
      return this.markVoucherPaid(voucherId, user, paymentReference);
    }
    const updated: PaymentVoucher = {
      ...voucher,
      status: "partial_paid",
      paidAmount: nextPaidAmount,
      paymentReference,
    };
    writeVouchers(
      vouchers.map((item) => (item.id === voucherId ? updated : item)),
    );
    const claims = readClaims();
    writeClaims(
      claims.map((claim) =>
        claim.id === voucher.claimId
          ? { ...claim, status: "partial_paid", updatedAt: now() }
          : claim,
      ),
    );
    await recordAuditLog({
      userId: user.id,
      action: "claims.payment_marked_partial",
      entityType: "payment_voucher",
      entityId: voucherId,
      newValues: { amount, paymentReference, paidAmount: nextPaidAmount },
    });
    return updated;
  },

  async listVouchers(user: AppUser) {
    if (!canSeeFinancialData(user.role)) {
      return [];
    }

    if (shouldUseSupabaseClaims()) {
      const { data, error } = await claimsClient()
        .from("payment_vouchers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        throw new Error(error.message);
      }
      const rows = (data ?? []) as SupabaseVoucherRow[];
      const preparers = await fetchProfiles(
        rows.map((voucher) => voucher.prepared_by).filter((id): id is string => Boolean(id)),
      );
      return mapSupabaseVoucherRows(rows, preparers);
    }

    return [...readVouchers()].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  },

  async listLedger(user: AppUser, requestedUserId?: string) {
    if (shouldUseSupabaseClaims()) {
      let query = claimsClient()
        .from("employee_ledgers")
        .select("*")
        .order("created_at", { ascending: false });
      if (canSeeFinancialData(user.role) && requestedUserId) {
        query = query.eq("user_id", requestedUserId);
      } else if (!canSeeFinancialData(user.role)) {
        query = query.eq("user_id", user.id);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      const rows = (data ?? []) as SupabaseLedgerRow[];
      const profiles = await fetchProfiles(rows.map((entry) => entry.user_id));
      return mapSupabaseLedgerRows(rows, profiles);
    }

    const ledger = readLedger();

    if (canSeeFinancialData(user.role)) {
      return sortByCreatedAtDesc(ledger.filter((entry) =>
        requestedUserId ? entry.userId === requestedUserId : true,
      ));
    }

    return sortByCreatedAtDesc(ledger.filter((entry) => entry.userId === user.id));
  },

  async getLedgerStatement(
    user: AppUser,
    filters?: LedgerFilters,
  ): Promise<LedgerStatement> {
    const visibleLedger = await this.listLedger(user, filters?.userId);
    const filteredEntries = sortByCreatedAtAsc(
      applyLedgerFilters(visibleLedger, filters),
    );
    const targetUser =
      userById(filters?.userId ?? user.id) ??
      userById(filteredEntries[0]?.userId ?? user.id) ??
      user;
    const allEntriesForUser = sortByCreatedAtAsc(
      visibleLedger.filter((entry) => entry.userId === targetUser.id),
    );
    const firstFilteredDate = filteredEntries[0]?.createdAt;
    const openingBalance = firstFilteredDate
      ? allEntriesForUser
          .filter(
            (entry) =>
              new Date(entry.createdAt).getTime() <
              new Date(firstFilteredDate).getTime(),
          )
          .at(-1)?.balanceAfter ?? 0
      : 0;

    return {
      userId: targetUser.id,
      userName: targetUser.fullName,
      userEmail: targetUser.email,
      openingBalance,
      closingBalance: filteredEntries.at(-1)?.balanceAfter ?? openingBalance,
      totalDebit: filteredEntries.reduce((sum, entry) => sum + entry.debit, 0),
      totalCredit: filteredEntries.reduce((sum, entry) => sum + entry.credit, 0),
      entries: sortByCreatedAtDesc(filteredEntries),
    };
  },

  async listTransactions(user: AppUser, filters?: TransactionFilters) {
    if (shouldUseSupabaseClaims()) {
      let query = claimsClient()
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (filters?.userId) {
        query = query.eq("user_id", filters.userId);
      } else if (!canSeeFinancialData(user.role)) {
        query = query.eq("user_id", user.id);
      }
      if (filters?.fromDate) {
        query = query.gte("created_at", `${filters.fromDate}T00:00:00.000Z`);
      }
      if (filters?.toDate) {
        query = query.lte("created_at", `${filters.toDate}T23:59:59.999Z`);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      const rows = (data ?? []) as SupabaseTransactionRow[];
      const [profiles, actors] = await Promise.all([
        fetchProfiles(rows.map((transaction) => transaction.user_id)),
        fetchProfiles(
          rows
            .map((transaction) => transaction.actor_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ]);
      return sortByCreatedAtDesc(
        applyTransactionFilters(
          mapSupabaseTransactionRows(rows, profiles, actors),
          filters,
        ),
      );
    }

    const transactions = readTransactions();
    const visibleTransactions = canSeeFinancialData(user.role)
      ? transactions
      : transactions.filter((transaction) => transaction.userId === user.id);

    return sortByCreatedAtDesc(
      applyTransactionFilters(visibleTransactions, filters),
    );
  },

  async listUserBalances(user: AppUser): Promise<UserClaimBalance[]> {
    const claims = await this.listClaims(user);
    const ledger = await this.listLedger(user);
    const visibleUsers = shouldUseSupabaseClaims()
      ? canSeeFinancialData(user.role)
        ? await fetchProfiles(
            Array.from(
              new Set([
                ...claims.map((claim) => claim.userId),
                ...ledger.map((entry) => entry.userId),
              ]),
            ),
          ).then((profiles) =>
            Array.from(profiles.values()).map((profile) => ({
              id: profile.id,
              employeeId: profile.employee_code ?? profile.employee_id ?? "",
              fullName: profile.full_name ?? "User",
              email: profile.email ?? "",
              role: profile.role_id ?? "site_staff",
              status: "active",
              projectIds: [],
            })),
          )
        : [user]
      : canSeeFinancialData(user.role)
        ? DEMO_USERS.map(toAppUser)
        : [user];

    return visibleUsers
      .map((balanceUser) => {
        const userClaims = claims.filter((claim) => claim.userId === balanceUser.id);
        const userLedger = sortByCreatedAtAsc(
          ledger.filter((entry) => entry.userId === balanceUser.id),
        );
        const totalPaid = userLedger.reduce((sum, entry) => sum + entry.credit, 0);
        return {
          userId: balanceUser.id,
          userName: balanceUser.fullName,
          userEmail: balanceUser.email,
          totalClaimed: userClaims.reduce(
            (sum, claim) => sum + claim.totalClaimed,
            0,
          ),
          totalApproved: userClaims.reduce(
            (sum, claim) => sum + claim.totalApproved,
            0,
          ),
          totalPaid,
          outstandingBalance: userLedger.at(-1)?.balanceAfter ?? 0,
          pendingClaims: userClaims.filter((claim) =>
            CLAIM_PENDING_STATUSES.includes(claim.status),
          ).length,
          lastTransactionAt: userLedger.at(-1)?.createdAt,
        };
      })
      .filter(
        (balance) =>
          balance.totalClaimed > 0 ||
          balance.totalApproved > 0 ||
          balance.totalPaid > 0 ||
          balance.outstandingBalance !== 0 ||
          balance.userId === user.id,
      );
  },

  async getReportSummary(user: AppUser): Promise<ClaimReportSummary> {
    const claims = await this.listClaims(user);
    return {
      totalClaims: claims.length,
      totalClaimed: claims.reduce((sum, claim) => sum + claim.totalClaimed, 0),
      totalApproved: claims.reduce((sum, claim) => sum + claim.totalApproved, 0),
      pendingApprovals: claims.filter((claim) =>
        CLAIM_PENDING_STATUSES.includes(claim.status),
      ).length,
      paidAmount: claims
        .filter((claim) => claim.status === "paid")
        .reduce((sum, claim) => sum + claim.totalApproved, 0),
    };
  },

  resetDemoData() {
    writeClaims(seedClaims());
    writeVouchers(seedVouchers());
    writeLedger(seedLedger());
    writeTransactions(seedTransactions());
  },
};

export { COST_CODE_OPTIONS, EXPENSE_CATEGORIES, PROJECT_OPTIONS };
