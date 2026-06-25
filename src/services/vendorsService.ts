import { PROJECT_OPTIONS } from "@/constants/claims";
import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured } from "@/services/supabaseClient";
import { vendorBillSourceService } from "@/services/vendorBillSourceService";
import { vendorsRepository } from "@/services/vendorsRepository";
import type { AppUser, Role } from "@/types/auth";
import type {
  Vendor,
  VendorBalance,
  VendorBill,
  VendorBillInput,
  VendorBillStatus,
  VendorInput,
  VendorLedgerEntry,
  VendorPayment,
  VendorPaymentMethod,
  VendorPaymentVoucher,
  VendorSummary,
} from "@/types/vendors";

const VENDORS_STORAGE_KEY = "site-connect:vendors";
const VENDOR_BILLS_STORAGE_KEY = "site-connect:vendor-bills";
const VENDOR_VOUCHERS_STORAGE_KEY = "site-connect:vendor-payment-vouchers";
const VENDOR_PAYMENTS_STORAGE_KEY = "site-connect:vendor-payments";
const VENDOR_LEDGER_STORAGE_KEY = "site-connect:vendor-ledger";

let memoryVendors: Vendor[] | null = null;
let memoryBills: VendorBill[] | null = null;
let memoryVouchers: VendorPaymentVoucher[] | null = null;
let memoryPayments: VendorPayment[] | null = null;
let memoryLedger: VendorLedgerEntry[] | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function now() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getProjectName(projectId: string) {
  if (isSupabaseConfigured) {
    throw new Error("Production project names must come from Supabase.");
  }
  return (
    PROJECT_OPTIONS.find((project) => project.id === projectId)?.name ??
    "Unknown project"
  );
}

function getDemoUser(email: string) {
  const user = DEMO_USERS.find((item) => item.email === email);
  if (!user) {
    throw new Error(`Missing demo user: ${email}`);
  }
  return toAppUser(user);
}

function readCollection<T>(key: string, seed: () => T[], memory: T[] | null) {
  if (isSupabaseConfigured) {
    return memory ?? [];
  }
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
  if (isSupabaseConfigured) {
    return;
  }
  if (isBrowser()) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function seedVendors(): Vendor[] {
  const createdAt = "2026-06-15T09:00:00.000Z";
  return [
    vendorSeed("vendor-apex-fuel", "Apex Fuel Supply", "VEN-FUEL-001", "fuel", "Nikhil Rao", createdAt),
    vendorSeed("vendor-buildmart", "BuildMart Supplies", "VEN-MAT-001", "material", "Sanjay Bhat", createdAt),
    vendorSeed("vendor-apex-machinery", "Apex Plant & Machinery", "VEN-MCH-001", "machinery", "Rajat Menon", createdAt),
    vendorSeed("vendor-shakti-labour", "Shakti Labour Supply", "VEN-LAB-001", "labor", "Mahesh Patel", createdAt),
    vendorSeed("vendor-site-services", "Site Services Co.", "VEN-SRV-001", "service", "Anita Joseph", createdAt),
  ];
}

function vendorSeed(
  id: string,
  name: string,
  code: string,
  vendorType: Vendor["vendorType"],
  contactPerson: string,
  createdAt: string,
): Vendor {
  return {
    id,
    name,
    code,
    vendorType,
    contactPerson,
    email: `${code.toLowerCase()}@siteconnect.local`,
    phone: "+91 98765 60001",
    gstNumber: `29AABCV${code.slice(-3)}1Z5`,
    address: "Bengaluru",
    paymentTerms: "15 days",
    status: "active",
    createdAt,
    updatedAt: createdAt,
  };
}

function seedBills(): VendorBill[] {
  const manager = getDemoUser("manager@siteconnect.local");
  const admin = getDemoUser("admin@siteconnect.local");
  const superAdmin = getDemoUser("super@siteconnect.local");
  return [
    {
      id: "vendor-bill-demo-001",
      billNumber: "VB-2026-0001",
      vendorId: "vendor-buildmart",
      vendorName: "BuildMart Supplies",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      billType: "material",
      billingPeriodFrom: "2026-06-01",
      billingPeriodTo: "2026-06-20",
      invoiceNumber: "BM-8891",
      invoiceDate: "2026-06-20",
      baseAmount: 169000,
      gstAmount: 30420,
      otherCharges: 0,
      processingType: "none",
      processingAmount: 0,
      totalAmount: 199420,
      status: "approved",
      submittedBy: manager.id,
      submittedByName: manager.fullName,
      submittedByRole: manager.role,
      submittedAt: "2026-06-20T12:00:00.000Z",
      verifiedBy: admin.id,
      verifiedByName: admin.fullName,
      verifiedAt: "2026-06-20T15:00:00.000Z",
      approvedBy: superAdmin.id,
      approvedByName: superAdmin.fullName,
      approvedAt: "2026-06-20T17:00:00.000Z",
      createdAt: "2026-06-20T12:00:00.000Z",
      updatedAt: "2026-06-20T17:00:00.000Z",
    },
    {
      id: "vendor-bill-demo-002",
      billNumber: "VB-2026-0002",
      vendorId: "vendor-apex-machinery",
      vendorName: "Apex Plant & Machinery",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      billType: "machinery",
      billingPeriodFrom: "2026-06-01",
      billingPeriodTo: "2026-06-15",
      invoiceNumber: "APM-2218",
      invoiceDate: "2026-06-16",
      baseAmount: 90000,
      gstAmount: 16200,
      otherCharges: 0,
      processingType: "deduction",
      processingAmount: 1200,
      totalAmount: 105000,
      status: "paid",
      submittedBy: manager.id,
      submittedByName: manager.fullName,
      submittedByRole: manager.role,
      submittedAt: "2026-06-16T10:00:00.000Z",
      verifiedBy: admin.id,
      verifiedByName: admin.fullName,
      verifiedAt: "2026-06-16T14:00:00.000Z",
      approvedBy: superAdmin.id,
      approvedByName: superAdmin.fullName,
      approvedAt: "2026-06-16T16:00:00.000Z",
      createdAt: "2026-06-16T10:00:00.000Z",
      updatedAt: "2026-06-17T12:00:00.000Z",
    },
    {
      id: "vendor-bill-demo-003",
      billNumber: "VB-2026-0003",
      vendorId: "vendor-apex-fuel",
      vendorName: "Apex Fuel Supply",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      billType: "fuel",
      billingPeriodFrom: "2026-06-19",
      billingPeriodTo: "2026-06-20",
      invoiceNumber: "AFS-9182",
      invoiceDate: "2026-06-20",
      baseAmount: 13800,
      gstAmount: 2484,
      otherCharges: 0,
      processingType: "none",
      processingAmount: 0,
      totalAmount: 16284,
      status: "submitted",
      submittedBy: manager.id,
      submittedByName: manager.fullName,
      submittedByRole: manager.role,
      submittedAt: "2026-06-20T18:30:00.000Z",
      createdAt: "2026-06-20T18:30:00.000Z",
      updatedAt: "2026-06-20T18:30:00.000Z",
    },
  ];
}

function seedVouchers(): VendorPaymentVoucher[] {
  const accounts = getDemoUser("accounts@siteconnect.local");
  return [
    {
      id: "vendor-voucher-demo-001",
      vendorBillId: "vendor-bill-demo-002",
      vendorId: "vendor-apex-machinery",
      voucherNumber: "VPV-2026-0001",
      voucherDate: "2026-06-17",
      paidToName: "Apex Plant & Machinery",
      approvedAmount: 106200,
      deductionAmount: 1200,
      netPayableAmount: 105000,
      preparedBy: accounts.id,
      preparedByName: accounts.fullName,
      accountsNote: "Paid after maintenance deduction.",
      status: "paid",
      createdAt: "2026-06-17T10:00:00.000Z",
      paidAt: "2026-06-17T12:00:00.000Z",
      paymentReference: "UTR-APM-7742",
    },
  ];
}

function seedPayments(): VendorPayment[] {
  const accounts = getDemoUser("accounts@siteconnect.local");
  return [
    {
      id: "vendor-payment-demo-001",
      vendorId: "vendor-apex-machinery",
      vendorBillId: "vendor-bill-demo-002",
      voucherId: "vendor-voucher-demo-001",
      amount: 105000,
      paymentMethod: "bank_transfer",
      paymentDate: "2026-06-17",
      referenceNumber: "UTR-APM-7742",
      status: "processed",
      processedBy: accounts.id,
      processedByName: accounts.fullName,
      createdAt: "2026-06-17T12:00:00.000Z",
    },
  ];
}

function seedLedger(): VendorLedgerEntry[] {
  return [
    {
      id: "vendor-ledger-demo-001",
      vendorId: "vendor-apex-machinery",
      vendorName: "Apex Plant & Machinery",
      billId: "vendor-bill-demo-002",
      billNumber: "VB-2026-0002",
      type: "bill_approved",
      description: "Bill VB-2026-0002 approved",
      debit: 105000,
      credit: 0,
      balanceAfter: 105000,
      createdAt: "2026-06-16T16:00:00.000Z",
    },
    {
      id: "vendor-ledger-demo-002",
      vendorId: "vendor-apex-machinery",
      vendorName: "Apex Plant & Machinery",
      billId: "vendor-bill-demo-002",
      billNumber: "VB-2026-0002",
      voucherId: "vendor-voucher-demo-001",
      voucherNumber: "VPV-2026-0001",
      type: "payment",
      description: "Payment processed for VPV-2026-0001",
      debit: 0,
      credit: 105000,
      balanceAfter: 0,
      createdAt: "2026-06-17T12:00:00.000Z",
    },
    {
      id: "vendor-ledger-demo-003",
      vendorId: "vendor-buildmart",
      vendorName: "BuildMart Supplies",
      billId: "vendor-bill-demo-001",
      billNumber: "VB-2026-0001",
      type: "bill_approved",
      description: "Bill VB-2026-0001 approved",
      debit: 199420,
      credit: 0,
      balanceAfter: 199420,
      createdAt: "2026-06-20T17:00:00.000Z",
    },
  ];
}

function readVendors() {
  const vendors = readCollection(VENDORS_STORAGE_KEY, seedVendors, memoryVendors);
  memoryVendors = vendors;
  return vendors;
}

function writeVendors(vendors: Vendor[]) {
  memoryVendors = vendors;
  writeCollection(VENDORS_STORAGE_KEY, vendors);
}

function readBills() {
  const bills = readCollection(VENDOR_BILLS_STORAGE_KEY, seedBills, memoryBills);
  memoryBills = bills;
  return bills;
}

function writeBills(bills: VendorBill[]) {
  memoryBills = bills;
  writeCollection(VENDOR_BILLS_STORAGE_KEY, bills);
}

function readVouchers() {
  const vouchers = readCollection(
    VENDOR_VOUCHERS_STORAGE_KEY,
    seedVouchers,
    memoryVouchers,
  );
  memoryVouchers = vouchers;
  return vouchers;
}

function writeVouchers(vouchers: VendorPaymentVoucher[]) {
  memoryVouchers = vouchers;
  writeCollection(VENDOR_VOUCHERS_STORAGE_KEY, vouchers);
}

function readPayments() {
  const payments = readCollection(
    VENDOR_PAYMENTS_STORAGE_KEY,
    seedPayments,
    memoryPayments,
  );
  memoryPayments = payments;
  return payments;
}

function writePayments(payments: VendorPayment[]) {
  memoryPayments = payments;
  writeCollection(VENDOR_PAYMENTS_STORAGE_KEY, payments);
}

function readLedger() {
  const ledger = readCollection(VENDOR_LEDGER_STORAGE_KEY, seedLedger, memoryLedger);
  memoryLedger = ledger;
  return ledger;
}

function writeLedger(ledger: VendorLedgerEntry[]) {
  memoryLedger = ledger;
  writeCollection(VENDOR_LEDGER_STORAGE_KEY, ledger);
}

function canSeeVendors(role: Role) {
  return ["manager", "hod", "admin_hr", "super_admin", "accounts_officer"].includes(role);
}

function canManageVendors(role: Role) {
  return ["admin_hr", "super_admin"].includes(role);
}

function canCreateBills(role: Role) {
  return ["manager", "hod", "admin_hr", "super_admin"].includes(role);
}

function canVerifyBills(role: Role) {
  return ["admin_hr", "super_admin"].includes(role);
}

function canApproveBills(role: Role) {
  return role === "super_admin";
}

function canPayBills(role: Role) {
  return ["accounts_officer", "super_admin"].includes(role);
}

function nextBillNumber(bills: VendorBill[]) {
  const next =
    bills
      .map((bill) => Number(bill.billNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `VB-2026-${String(next).padStart(4, "0")}`;
}

function nextVoucherNumber(vouchers: VendorPaymentVoucher[]) {
  const next =
    vouchers
      .map((voucher) => Number(voucher.voucherNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `VPV-2026-${String(next).padStart(4, "0")}`;
}

function getVendor(vendorId: string) {
  const vendor = readVendors().find((item) => item.id === vendorId);
  if (!vendor) {
    throw new Error("Vendor not found.");
  }
  return vendor;
}

function vendorBalance(vendorId: string) {
  return readLedger()
    .filter((entry) => entry.vendorId === vendorId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1)?.balanceAfter ?? 0;
}

function addLedgerEntry(entry: Omit<VendorLedgerEntry, "id">) {
  const value = { id: crypto.randomUUID(), ...entry };
  if (isSupabaseConfigured) {
    memoryLedger = [value, ...readLedger()];
  } else {
    writeLedger([value, ...readLedger()]);
  }
  return value;
}

function updateBillStatus(
  billId: string,
  status: VendorBillStatus,
  actor: AppUser,
  fields: Partial<VendorBill> = {},
) {
  const bills = readBills();
  const bill = bills.find((item) => item.id === billId);
  if (!bill) {
    throw new Error("Vendor bill not found.");
  }
  const updatedAt = now();
  const updated: VendorBill = {
    ...bill,
    ...fields,
    status,
    updatedAt,
  };
  writeBills(bills.map((item) => (item.id === billId ? updated : item)));
  return { bill, updated, updatedAt, actor };
}

function summarize(): VendorSummary {
  const vendors = readVendors();
  const bills = readBills();
  const payments = readPayments();
  const month = today().slice(0, 7);
  return {
    totalVendors: vendors.length,
    activeVendors: vendors.filter((vendor) => vendor.status === "active").length,
    pendingBills: bills.filter((bill) =>
      ["submitted", "verified", "approved", "voucher_generated"].includes(bill.status),
    ).length,
    outstandingBalance: readLedger().reduce((total, entry, _, ledger) => {
      const isLatest =
        ledger
          .filter((item) => item.vendorId === entry.vendorId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
          ?.id === entry.id;
      return isLatest ? total + entry.balanceAfter : total;
    }, 0),
    paidThisMonth: payments
      .filter((payment) => payment.paymentDate.startsWith(month))
      .reduce((total, payment) => total + payment.amount, 0),
  };
}

export function calculateVendorBillTotal(
  input: Pick<
    VendorBillInput,
    "baseAmount" | "gstAmount" | "otherCharges" | "processingType" | "processingAmount"
  >,
) {
  const adjustment =
    input.processingType === "deduction"
      ? -input.processingAmount
      : input.processingType === "addition"
        ? input.processingAmount
        : 0;
  return Math.max(
    0,
    Math.round(
      (input.baseAmount + input.gstAmount + input.otherCharges + adjustment) * 100,
    ) / 100,
  );
}

export const vendorsService = {
  async listVendors(user: AppUser) {
    if (!canSeeVendors(user.role)) {
      throw new Error("You do not have permission to view vendors.");
    }
    const stored = isSupabaseConfigured
      ? await vendorsRepository.listVendors()
      : readVendors();
    memoryVendors = stored;
    return [...stored].sort((left, right) => left.name.localeCompare(right.name));
  },

  async createVendor(input: VendorInput, actor: AppUser) {
    if (!canManageVendors(actor.role)) {
      throw new Error("You do not have permission to create vendors.");
    }
    if (!input.name.trim() || !input.code.trim()) {
      throw new Error("Enter vendor name and code.");
    }
    if (isSupabaseConfigured) {
      const vendor = await vendorsRepository.createVendor(input);
      memoryVendors = [vendor, ...(memoryVendors ?? []).filter((item) => item.id !== vendor.id)];
      return vendor;
    }
    const vendors = readVendors();
    if (vendors.some((vendor) => vendor.code === input.code.trim())) {
      throw new Error("Vendor code already exists.");
    }
    const createdAt = now();
    const vendor: Vendor = {
      id: crypto.randomUUID(),
      ...input,
      name: input.name.trim(),
      code: input.code.trim(),
      createdAt,
      updatedAt: createdAt,
    };
    writeVendors([vendor, ...vendors]);
    await recordAuditLog({
      userId: actor.id,
      action: "vendors.vendor_created",
      entityType: "vendor",
      entityId: vendor.id,
      newValues: {
        name: vendor.name,
        code: vendor.code,
        vendorType: vendor.vendorType,
      },
    });
    return vendor;
  },

  async listBills(user: AppUser) {
    if (!canSeeVendors(user.role)) {
      throw new Error("You do not have permission to view vendor bills.");
    }
    const stored = isSupabaseConfigured
      ? await vendorsRepository.listBills(user)
      : readBills();
    memoryBills = stored;
    return [...stored].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  },

  async createBill(
    input: VendorBillInput,
    actor: AppUser,
    status: Extract<VendorBillStatus, "draft" | "submitted">,
  ) {
    if (!canCreateBills(actor.role)) {
      throw new Error("You do not have permission to create vendor bills.");
    }
    if (input.billingPeriodFrom > input.billingPeriodTo) {
      throw new Error("Billing period end must be after start.");
    }
    if (input.invoiceDate > today()) {
      throw new Error("Invoice date cannot be in the future.");
    }
    if (
      input.baseAmount < 0 ||
      input.gstAmount < 0 ||
      input.otherCharges < 0 ||
      input.processingAmount < 0
    ) {
      throw new Error("Vendor bill amounts must be non-negative.");
    }
    if (isSupabaseConfigured) {
      const preview = await vendorBillSourceService.preview(input, actor);
      const normalizedInput = {
        ...input,
        baseAmount:
          preview.grossAmount > 0 ? preview.grossAmount : input.baseAmount,
      };
      const bill = await vendorsRepository.createBill(
        normalizedInput,
        actor,
        status,
        preview.rows,
      );
      memoryBills = [bill, ...(memoryBills ?? []).filter((item) => item.id !== bill.id)];
      return bill;
    }
    const vendor = getVendor(input.vendorId);
    const bills = readBills();
    const createdAt = now();
    const bill: VendorBill = {
      id: crypto.randomUUID(),
      billNumber: nextBillNumber(bills),
      vendorId: vendor.id,
      vendorName: vendor.name,
      projectId: input.projectId,
      projectName: getProjectName(input.projectId),
      billType: input.billType,
      billingPeriodFrom: input.billingPeriodFrom,
      billingPeriodTo: input.billingPeriodTo,
      invoiceNumber: input.invoiceNumber.trim(),
      invoiceDate: input.invoiceDate,
      baseAmount: input.baseAmount,
      gstAmount: input.gstAmount,
      otherCharges: input.otherCharges,
      processingType: input.processingType,
      processingAmount: input.processingAmount,
      totalAmount: calculateVendorBillTotal(input),
      status,
      submittedBy: actor.id,
      submittedByName: actor.fullName,
      submittedByRole: actor.role,
      submittedAt: status === "submitted" ? createdAt : undefined,
      createdAt,
      updatedAt: createdAt,
    };
    writeBills([bill, ...bills]);
    await recordAuditLog({
      userId: actor.id,
      action:
        status === "submitted"
          ? "vendors.bill_submitted"
          : "vendors.bill_draft_saved",
      entityType: "vendor_bill",
      entityId: bill.id,
      newValues: {
        billNumber: bill.billNumber,
        vendorId: bill.vendorId,
        totalAmount: bill.totalAmount,
        status: bill.status,
      },
    });
    return bill;
  },

  async verifyBill(billId: string, actor: AppUser) {
    if (!canVerifyBills(actor.role)) {
      throw new Error("You do not have permission to verify vendor bills.");
    }
    if (isSupabaseConfigured) {
      const updated = await vendorsRepository.updateBillStatus(billId, "verified", actor);
      memoryBills = (memoryBills ?? []).map((item) => item.id === billId ? updated : item);
      return updated;
    }
    const { bill, updated, updatedAt } = updateBillStatus(billId, "verified", actor, {
      verifiedBy: actor.id,
      verifiedByName: actor.fullName,
      verifiedAt: now(),
    });
    const ledgerEntry = addLedgerEntry({
      vendorId: bill.vendorId,
      vendorName: bill.vendorName,
      billId: bill.id,
      billNumber: bill.billNumber,
      type: "bill_verified",
      description: `Bill ${bill.billNumber} verified`,
      debit: 0,
      credit: 0,
      balanceAfter: vendorBalance(bill.vendorId),
      createdAt: updatedAt,
    });
    void ledgerEntry;
    return updated;
  },

  async approveBill(billId: string, actor: AppUser) {
    if (!canApproveBills(actor.role)) {
      throw new Error("You do not have permission to approve vendor bills.");
    }
    if (isSupabaseConfigured) {
      const updated = await vendorsRepository.updateBillStatus(billId, "approved", actor);
      memoryBills = (memoryBills ?? []).map((item) => item.id === billId ? updated : item);
      return updated;
    }
    const { bill, updated, updatedAt } = updateBillStatus(billId, "approved", actor, {
      approvedBy: actor.id,
      approvedByName: actor.fullName,
      approvedAt: now(),
    });
    const balanceAfter = vendorBalance(bill.vendorId) + bill.totalAmount;
    const ledgerEntry = addLedgerEntry({
      vendorId: bill.vendorId,
      vendorName: bill.vendorName,
      billId: bill.id,
      billNumber: bill.billNumber,
      type: "bill_approved",
      description: `Bill ${bill.billNumber} approved`,
      debit: bill.totalAmount,
      credit: 0,
      balanceAfter,
      createdAt: updatedAt,
    });
    void ledgerEntry;
    return updated;
  },

  async generateVoucher(billId: string, actor: AppUser, accountsNote = "") {
    if (!canPayBills(actor.role)) {
      throw new Error("You do not have permission to generate vendor vouchers.");
    }
    const bills = isSupabaseConfigured
      ? await vendorsRepository.listBills(actor)
      : readBills();
    const bill = bills.find((item) => item.id === billId);
    if (!bill) {
      throw new Error("Vendor bill not found.");
    }
    if (bill.status !== "approved") {
      throw new Error("Only approved vendor bills can generate vouchers.");
    }
    if (isSupabaseConfigured) {
      const voucher = await vendorsRepository.generateVoucher(
        bill,
        actor,
        accountsNote,
      );
      memoryVouchers = [voucher, ...(memoryVouchers ?? []).filter((item) => item.id !== voucher.id)];
      memoryBills = await vendorsRepository.listBills(actor);
      return voucher;
    }
    const vouchers = readVouchers();
    const createdAt = now();
    const deductionAmount =
      bill.processingType === "deduction" ? bill.processingAmount : 0;
    const voucher: VendorPaymentVoucher = {
      id: crypto.randomUUID(),
      vendorBillId: bill.id,
      vendorId: bill.vendorId,
      voucherNumber: nextVoucherNumber(vouchers),
      voucherDate: today(),
      paidToName: bill.vendorName,
      approvedAmount: bill.baseAmount + bill.gstAmount + bill.otherCharges,
      deductionAmount,
      netPayableAmount: bill.totalAmount,
      preparedBy: actor.id,
      preparedByName: actor.fullName,
      accountsNote,
      status: "generated",
      createdAt,
    };
    const updatedBills = bills.map((item) =>
        item.id === billId
          ? { ...item, status: "voucher_generated", updatedAt: createdAt }
          : item,
      ) as VendorBill[];
    writeVouchers([voucher, ...vouchers]);
    writeBills(updatedBills);
    const ledgerEntry = addLedgerEntry({
      vendorId: bill.vendorId,
      vendorName: bill.vendorName,
      billId: bill.id,
      billNumber: bill.billNumber,
      voucherId: voucher.id,
      voucherNumber: voucher.voucherNumber,
      type: "voucher_generated",
      description: `Voucher ${voucher.voucherNumber} generated`,
      debit: 0,
      credit: 0,
      balanceAfter: vendorBalance(bill.vendorId),
      createdAt,
    });
    void ledgerEntry;
    return voucher;
  },

  async markVoucherPaid(
    voucherId: string,
    actor: AppUser,
    paymentReference: string,
    paymentMethod: VendorPaymentMethod = "bank_transfer",
  ) {
    if (!canPayBills(actor.role)) {
      throw new Error("You do not have permission to pay vendor vouchers.");
    }
    const vouchers = isSupabaseConfigured
      ? await vendorsRepository.listVouchers(actor)
      : readVouchers();
    const voucher = vouchers.find((item) => item.id === voucherId);
    if (!voucher) {
      throw new Error("Vendor voucher not found.");
    }
    const bills = isSupabaseConfigured
      ? await vendorsRepository.listBills(actor)
      : readBills();
    const bill = bills.find((item) => item.id === voucher.vendorBillId);
    if (!bill) {
      throw new Error("Vendor bill not found.");
    }
    if (isSupabaseConfigured) {
      return vendorsRepository.recordPayment(
        voucher,
        bill,
        actor,
        voucher.netPayableAmount,
        paymentReference,
        paymentMethod,
      );
    }
    const paidAt = now();
    const payment: VendorPayment = {
      id: crypto.randomUUID(),
      vendorId: voucher.vendorId,
      vendorBillId: bill.id,
      voucherId,
      amount: voucher.netPayableAmount,
      paymentMethod,
      paymentDate: today(),
      referenceNumber: paymentReference,
      status: "processed",
      processedBy: actor.id,
      processedByName: actor.fullName,
      createdAt: paidAt,
    };
    const updatedVouchers = vouchers.map((item) =>
        item.id === voucherId
          ? {
              ...item,
              status: "paid",
              paidAt,
              paymentReference,
            }
          : item,
      ) as VendorPaymentVoucher[];
    const updatedBills = bills.map((item) =>
        item.id === bill.id ? { ...item, status: "paid", updatedAt: paidAt } : item,
      ) as VendorBill[];
    writePayments([payment, ...readPayments()]);
    writeVouchers(updatedVouchers);
    writeBills(updatedBills);
    const balanceAfter = vendorBalance(bill.vendorId) - voucher.netPayableAmount;
    const ledgerEntry = addLedgerEntry({
      vendorId: bill.vendorId,
      vendorName: bill.vendorName,
      billId: bill.id,
      billNumber: bill.billNumber,
      voucherId,
      voucherNumber: voucher.voucherNumber,
      type: "payment",
      description: `Payment processed for ${voucher.voucherNumber}`,
      debit: 0,
      credit: voucher.netPayableAmount,
      balanceAfter,
      createdAt: paidAt,
    });
    void ledgerEntry;
    return payment;
  },

  async listVouchers(user: AppUser) {
    if (!canSeeVendors(user.role)) {
      throw new Error("You do not have permission to view vendor vouchers.");
    }
    const stored = isSupabaseConfigured
      ? await vendorsRepository.listVouchers(user)
      : readVouchers();
    memoryVouchers = stored;
    return [...stored].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  },

  async listLedger(user: AppUser, vendorId?: string) {
    if (!canSeeVendors(user.role)) {
      throw new Error("You do not have permission to view vendor ledger.");
    }
    const stored = isSupabaseConfigured
      ? await vendorsRepository.listLedger(user, vendorId)
      : readLedger();
    memoryLedger = stored;
    return stored
      .filter((entry) => (vendorId ? entry.vendorId === vendorId : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  },

  async listBalances(user: AppUser): Promise<VendorBalance[]> {
    const vendors = await this.listVendors(user);
    const bills = await this.listBills(user);
    const ledger = await this.listLedger(user);
    return vendors.map((vendor) => {
      const vendorBills = bills.filter((bill) => bill.vendorId === vendor.id);
      const vendorLedger = ledger
        .filter((entry) => entry.vendorId === vendor.id)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorType: vendor.vendorType,
        totalBilled: vendorBills.reduce((total, bill) => total + bill.totalAmount, 0),
        totalPaid: vendorLedger.reduce((total, entry) => total + entry.credit, 0),
        outstandingBalance: vendorLedger.at(-1)?.balanceAfter ?? 0,
        pendingBills: vendorBills.filter((bill) => bill.status !== "paid").length,
      };
    });
  },

  async listPayments(user: AppUser) {
    if (!canSeeVendors(user.role)) {
      throw new Error("You do not have permission to view vendor payments.");
    }
    if (isSupabaseConfigured) return vendorsRepository.listPayments(user);
    return readPayments();
  },

  async markVoucherPartialPaid(
    voucherId: string,
    actor: AppUser,
    amount: number,
    paymentReference: string,
    paymentMethod: VendorPaymentMethod = "bank_transfer",
  ) {
    if (!isSupabaseConfigured) {
      throw new Error("Vendor partial payments require Supabase.");
    }
    const voucher = (await vendorsRepository.listVouchers(actor)).find(
      (row) => row.id === voucherId,
    );
    if (!voucher) throw new Error("Vendor voucher not found.");
    const bill = (await vendorsRepository.listBills(actor)).find(
      (row) => row.id === voucher.vendorBillId,
    );
    if (!bill) throw new Error("Vendor bill not found.");
    return vendorsRepository.recordPayment(
      voucher,
      bill,
      actor,
      amount,
      paymentReference,
      paymentMethod,
    );
  },

  async getDashboard(user: AppUser) {
    const [vendors, bills, vouchers, ledger, balances] = await Promise.all([
      this.listVendors(user),
      this.listBills(user),
      this.listVouchers(user),
      this.listLedger(user),
      this.listBalances(user),
    ]);
    return {
      summary: summarize(),
      vendors,
      bills,
      vouchers,
      ledger: ledger.slice(0, 8),
      balances,
    };
  },

  resetDemoData() {
    writeVendors(seedVendors());
    writeBills(seedBills());
    writeVouchers(seedVouchers());
    writePayments(seedPayments());
    writeLedger(seedLedger());
  },
};
