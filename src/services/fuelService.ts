import { PROJECT_OPTIONS } from "@/constants/claims";
import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import {
  FUEL_TYPE_UNITS,
  FUEL_VENDORS,
} from "@/constants/fuel";
import { recordAuditLog } from "@/services/auditService";
import {
  fuelRepository,
  type FuelDepositInput,
} from "@/services/fuelRepository";
import { isSupabaseConfigured } from "@/services/supabaseClient";
import { machineryService } from "@/services/machineryService";
import type { AppUser } from "@/types/auth";
import type {
  DailyFuelSummary,
  FuelDashboard,
  FuelFilters,
  FuelIssue,
  FuelIssueInput,
  FuelIssueRow,
  FuelReceipt,
  FuelReceiptInput,
  FuelRecordStatus,
  FuelSummary,
  FuelType,
  MachineFuelConsumption,
  VendorFuelTracking,
} from "@/types/fuel";

const FUEL_RECEIPTS_STORAGE_KEY = "site-connect:fuel-receipts";
const FUEL_ISSUES_STORAGE_KEY = "site-connect:fuel-issues";

let memoryReceipts: FuelReceipt[] | null = null;
let memoryIssues: FuelIssue[] | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function now() {
  return new Date().toISOString();
}

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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

function getVendor(vendorId: string) {
  const vendor = FUEL_VENDORS.find((item) => item.id === vendorId);
  if (!vendor) {
    throw new Error("Fuel vendor not found.");
  }
  return vendor;
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

function seedReceipts(): FuelReceipt[] {
  const siteUser = getDemoUser("site@siteconnect.local");
  const admin = getDemoUser("admin@siteconnect.local");
  return [
    {
      id: "fuel-receipt-demo-001",
      receiptNumber: "FRC-2026-0001",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      date: "2026-06-19",
      fuelType: "diesel",
      vendorId: "vendor-apex-fuel",
      vendorName: "Apex Fuel Supply",
      source: "advance",
      quantity: 150,
      unit: "L",
      ratePerUnit: 92,
      totalAmount: 13800,
      referenceNumber: "AFS-9182",
      remarks: "Initial bowser refill for Metro site.",
      status: "approved",
      submittedBy: siteUser.id,
      submittedByName: siteUser.fullName,
      submittedByRole: siteUser.role,
      submittedAt: "2026-06-19T09:30:00.000Z",
      approvedBy: admin.id,
      approvedByName: admin.fullName,
      approvedAt: "2026-06-19T12:00:00.000Z",
      createdAt: "2026-06-19T09:30:00.000Z",
      updatedAt: "2026-06-19T12:00:00.000Z",
    },
    {
      id: "fuel-receipt-demo-002",
      receiptNumber: "FRC-2026-0002",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      date: "2026-06-20",
      fuelType: "diesel",
      vendorId: "vendor-city-petroleum",
      vendorName: "City Petroleum Depot",
      source: "cash",
      quantity: 80,
      unit: "L",
      ratePerUnit: 94,
      totalAmount: 7520,
      referenceNumber: "CPD-4507",
      remarks: "Top-up purchase for excavation shift.",
      status: "submitted",
      submittedBy: siteUser.id,
      submittedByName: siteUser.fullName,
      submittedByRole: siteUser.role,
      submittedAt: "2026-06-20T08:40:00.000Z",
      createdAt: "2026-06-20T08:40:00.000Z",
      updatedAt: "2026-06-20T08:40:00.000Z",
    },
    {
      id: "fuel-receipt-demo-003",
      receiptNumber: "FRC-2026-0003",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      date: "2026-06-20",
      fuelType: "engine_oil",
      vendorId: "vendor-shakti-lubes",
      vendorName: "Shakti Lubricants",
      source: "cash",
      quantity: 20,
      unit: "L",
      ratePerUnit: 320,
      totalAmount: 6400,
      referenceNumber: "SL-1021",
      remarks: "Engine oil cans for preventive maintenance.",
      status: "approved",
      submittedBy: siteUser.id,
      submittedByName: siteUser.fullName,
      submittedByRole: siteUser.role,
      submittedAt: "2026-06-20T10:00:00.000Z",
      approvedBy: admin.id,
      approvedByName: admin.fullName,
      approvedAt: "2026-06-20T14:00:00.000Z",
      createdAt: "2026-06-20T10:00:00.000Z",
      updatedAt: "2026-06-20T14:00:00.000Z",
    },
  ];
}

function issueRow(overrides: Partial<FuelIssueRow>): FuelIssueRow {
  return {
    id: crypto.randomUUID(),
    machineType: "excavator",
    machineAssetId: "machine-asset-demo-001",
    machineNumber: "EXC-101",
    quantityIssued: 0,
    remarks: "",
    ...overrides,
  };
}

function seedIssues(): FuelIssue[] {
  const siteUser = getDemoUser("site@siteconnect.local");
  return [
    {
      id: "fuel-issue-demo-001",
      issueNumber: "FIS-2026-0001",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      date: "2026-06-20",
      fuelType: "diesel",
      unit: "L",
      openingStock: 150,
      rows: [
        issueRow({
          id: "fuel-issue-row-demo-001",
          machineAssetId: "machine-asset-demo-001",
          machineNumber: "EXC-101",
          machineType: "excavator",
          quantityIssued: 28,
          remarks: "Excavation shift.",
        }),
        issueRow({
          id: "fuel-issue-row-demo-002",
          machineAssetId: "machine-asset-demo-002",
          machineNumber: "JCB-204",
          machineType: "jcb",
          quantityIssued: 12,
          remarks: "Backfilling support.",
        }),
      ],
      totalIssued: 40,
      closingStock: 110,
      remarks: "Issued by site storekeeper.",
      status: "submitted",
      submittedBy: siteUser.id,
      submittedByName: siteUser.fullName,
      submittedByRole: siteUser.role,
      submittedAt: "2026-06-20T18:00:00.000Z",
      createdAt: "2026-06-20T18:00:00.000Z",
      updatedAt: "2026-06-20T18:00:00.000Z",
    },
  ];
}

function readReceipts() {
  const receipts = readCollection(
    FUEL_RECEIPTS_STORAGE_KEY,
    seedReceipts,
    memoryReceipts,
  );
  memoryReceipts = receipts;
  return receipts;
}

function writeReceipts(receipts: FuelReceipt[]) {
  memoryReceipts = receipts;
  writeCollection(FUEL_RECEIPTS_STORAGE_KEY, receipts);
}

function readIssues() {
  const issues = readCollection(FUEL_ISSUES_STORAGE_KEY, seedIssues, memoryIssues);
  memoryIssues = issues;
  return issues;
}

function writeIssues(issues: FuelIssue[]) {
  memoryIssues = issues;
  writeCollection(FUEL_ISSUES_STORAGE_KEY, issues);
}

function nextReceiptNumber(receipts: FuelReceipt[]) {
  const next =
    receipts
      .map((receipt) => Number(receipt.receiptNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `FRC-2026-${String(next).padStart(4, "0")}`;
}

function nextIssueNumber(issues: FuelIssue[]) {
  const next =
    issues
      .map((issue) => Number(issue.issueNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `FIS-2026-${String(next).padStart(4, "0")}`;
}

function canUseFuel(user: AppUser) {
  return ["site_staff", "manager", "admin_hr", "super_admin"].includes(user.role);
}

function canApproveFuel(user: AppUser, projectId: string) {
  if (["admin_hr", "super_admin"].includes(user.role)) {
    return true;
  }
  return user.role === "manager" && user.projectIds.includes(projectId);
}

function canViewProject(user: AppUser, projectId: string) {
  if (["admin_hr", "super_admin"].includes(user.role)) {
    return true;
  }
  return user.projectIds.includes(projectId);
}

function isFinalStockRecord(status: FuelRecordStatus) {
  return status === "submitted" || status === "approved";
}

function applyReceiptFilters(receipts: FuelReceipt[], filters?: FuelFilters) {
  return receipts.filter((receipt) => {
    if (filters?.projectId && receipt.projectId !== filters.projectId) {
      return false;
    }
    if (filters?.dateFrom && receipt.date < filters.dateFrom) {
      return false;
    }
    if (filters?.dateTo && receipt.date > filters.dateTo) {
      return false;
    }
    if (
      filters?.fuelType &&
      filters.fuelType !== "all" &&
      receipt.fuelType !== filters.fuelType
    ) {
      return false;
    }
    if (filters?.vendorId && receipt.vendorId !== filters.vendorId) {
      return false;
    }
    if (
      filters?.status &&
      filters.status !== "all" &&
      receipt.status !== filters.status
    ) {
      return false;
    }
    return true;
  });
}

function applyIssueFilters(issues: FuelIssue[], filters?: FuelFilters) {
  return issues.filter((issue) => {
    if (filters?.projectId && issue.projectId !== filters.projectId) {
      return false;
    }
    if (filters?.dateFrom && issue.date < filters.dateFrom) {
      return false;
    }
    if (filters?.dateTo && issue.date > filters.dateTo) {
      return false;
    }
    if (
      filters?.fuelType &&
      filters.fuelType !== "all" &&
      issue.fuelType !== filters.fuelType
    ) {
      return false;
    }
    if (
      filters?.status &&
      filters.status !== "all" &&
      issue.status !== filters.status
    ) {
      return false;
    }
    return true;
  });
}

function validateReceipt(input: FuelReceiptInput, status: FuelRecordStatus) {
  if (input.date > today()) {
    throw new Error("Fuel receipt date cannot be in the future.");
  }
  if (input.quantity < 0 || input.ratePerUnit < 0) {
    throw new Error("Fuel receipt quantity and rate must be non-negative.");
  }
  if (status === "submitted" && input.quantity <= 0) {
    throw new Error("Enter fuel quantity before submitting receipt.");
  }
}

function validateIssue(input: FuelIssueInput, status: FuelRecordStatus) {
  if (input.date > today()) {
    throw new Error("Fuel issue date cannot be in the future.");
  }
  if (status === "submitted" && input.rows.length === 0) {
    throw new Error("Add at least one machine row before submitting issue.");
  }
  for (const row of input.rows) {
    if (!row.machineAssetId) {
      throw new Error("Every fuel issue row needs a machine.");
    }
    if (row.quantityIssued < 0) {
      throw new Error("Fuel issue quantity must be non-negative.");
    }
    if (status === "submitted" && row.quantityIssued <= 0) {
      throw new Error("Submitted issue rows must have positive quantity.");
    }
  }
}

function getAverageRate(projectId: string, fuelType: FuelType) {
  const matching = readReceipts().filter(
    (receipt) =>
      receipt.projectId === projectId &&
      receipt.fuelType === fuelType &&
      isFinalStockRecord(receipt.status),
  );
  const quantity = matching.reduce((total, receipt) => total + receipt.quantity, 0);
  if (quantity <= 0) {
    return 0;
  }
  return (
    matching.reduce((total, receipt) => total + receipt.totalAmount, 0) / quantity
  );
}

function summarize(user: AppUser): FuelSummary {
  const month = today().slice(0, 7);
  const receipts = readReceipts().filter((receipt) =>
    canViewProject(user, receipt.projectId),
  );
  const issues = readIssues().filter((issue) => canViewProject(user, issue.projectId));
  const dieselStock = getStockOnDate("project-metro", "diesel", today());
  return {
    stockOnHand: dieselStock,
    receivedThisMonth: receipts
      .filter(
        (receipt) =>
          receipt.date.startsWith(month) &&
          receipt.fuelType === "diesel" &&
          isFinalStockRecord(receipt.status),
      )
      .reduce((total, receipt) => total + receipt.quantity, 0),
    issuedThisMonth: issues
      .filter(
        (issue) =>
          issue.date.startsWith(month) &&
          issue.fuelType === "diesel" &&
          isFinalStockRecord(issue.status),
      )
      .reduce((total, issue) => total + issue.totalIssued, 0),
    purchaseCostThisMonth: receipts
      .filter(
        (receipt) =>
          receipt.date.startsWith(month) && isFinalStockRecord(receipt.status),
      )
      .reduce((total, receipt) => total + receipt.totalAmount, 0),
    pendingApproval:
      receipts.filter((receipt) => receipt.status === "submitted").length +
      issues.filter((issue) => issue.status === "submitted").length,
  };
}

function buildDailySummary(user: AppUser): DailyFuelSummary[] {
  const receipts = readReceipts().filter((receipt) =>
    canViewProject(user, receipt.projectId),
  );
  const issues = readIssues().filter((issue) => canViewProject(user, issue.projectId));
  const dates = Array.from(
    new Set([
      ...receipts.map((receipt) => receipt.date),
      ...issues.map((issue) => issue.date),
    ]),
  ).sort((left, right) => right.localeCompare(left));

  return dates.slice(0, 8).map((date) => {
    const received = receipts
      .filter(
        (receipt) =>
          receipt.date === date &&
          receipt.fuelType === "diesel" &&
          isFinalStockRecord(receipt.status),
      )
      .reduce((total, receipt) => total + receipt.quantity, 0);
    const cost = receipts
      .filter(
        (receipt) =>
          receipt.date === date &&
          receipt.fuelType === "diesel" &&
          isFinalStockRecord(receipt.status),
      )
      .reduce((total, receipt) => total + receipt.totalAmount, 0);
    const issued = issues
      .filter(
        (issue) =>
          issue.date === date &&
          issue.fuelType === "diesel" &&
          isFinalStockRecord(issue.status),
      )
      .reduce((total, issue) => total + issue.totalIssued, 0);
    const opening = getStockBeforeDate("project-metro", "diesel", date);
    return {
      date,
      opening,
      received,
      issued,
      closing: opening + received - issued,
      cost,
    };
  });
}

function buildMachineConsumption(user: AppUser): MachineFuelConsumption[] {
  const issueRows = readIssues()
    .filter((issue) => canViewProject(user, issue.projectId) && isFinalStockRecord(issue.status))
    .flatMap((issue) =>
      issue.rows.map((row) => ({
        ...row,
        projectId: issue.projectId,
        fuelType: issue.fuelType,
      })),
    );
  const grouped = new Map<string, MachineFuelConsumption>();
  issueRows.forEach((row) => {
    const rate = getAverageRate(row.projectId, row.fuelType);
    const current = grouped.get(row.machineNumber) ?? {
      machineNumber: row.machineNumber,
      machineType: row.machineType,
      totalQuantity: 0,
      cost: 0,
      averagePerDay: 0,
    };
    current.totalQuantity += row.quantityIssued;
    current.cost += row.quantityIssued * rate;
    current.averagePerDay = Math.round((current.totalQuantity / 1) * 100) / 100;
    grouped.set(row.machineNumber, current);
  });
  return Array.from(grouped.values()).sort(
    (left, right) => right.totalQuantity - left.totalQuantity,
  );
}

function buildVendorTracking(user: AppUser): VendorFuelTracking[] {
  const grouped = new Map<string, VendorFuelTracking>();
  readReceipts()
    .filter((receipt) => canViewProject(user, receipt.projectId) && isFinalStockRecord(receipt.status))
    .forEach((receipt) => {
      const key = `${receipt.vendorId}:${receipt.fuelType}`;
      const current = grouped.get(key) ?? {
        vendorId: receipt.vendorId,
        vendorName: receipt.vendorName,
        fuelType: receipt.fuelType,
        totalPurchased: 0,
        cost: 0,
        balanceQuantity: 0,
      };
      current.totalPurchased += receipt.quantity;
      current.cost += receipt.totalAmount;
      current.balanceQuantity += receipt.quantity;
      grouped.set(key, current);
    });
  return Array.from(grouped.values()).sort((left, right) => right.cost - left.cost);
}

export function getFuelUnit(fuelType: FuelType) {
  return FUEL_TYPE_UNITS[fuelType];
}

export function calculateFuelReceiptTotal(
  input: Pick<FuelReceiptInput, "quantity" | "ratePerUnit">,
) {
  return Math.round(input.quantity * input.ratePerUnit * 100) / 100;
}

export function calculateFuelIssueTotal(input: Pick<FuelIssueInput, "rows">) {
  return input.rows.reduce((total, row) => total + row.quantityIssued, 0);
}

export function getStockBeforeDate(
  projectId: string,
  fuelType: FuelType,
  date: string,
) {
  const received = readReceipts()
    .filter(
      (receipt) =>
        receipt.projectId === projectId &&
        receipt.fuelType === fuelType &&
        receipt.date < date &&
        isFinalStockRecord(receipt.status),
    )
    .reduce((total, receipt) => total + receipt.quantity, 0);
  const issued = readIssues()
    .filter(
      (issue) =>
        issue.projectId === projectId &&
        issue.fuelType === fuelType &&
        issue.date < date &&
        isFinalStockRecord(issue.status),
    )
    .reduce((total, issue) => total + issue.totalIssued, 0);
  return Math.round((received - issued) * 100) / 100;
}

export function getStockOnDate(projectId: string, fuelType: FuelType, date: string) {
  const received = readReceipts()
    .filter(
      (receipt) =>
        receipt.projectId === projectId &&
        receipt.fuelType === fuelType &&
        receipt.date <= date &&
        isFinalStockRecord(receipt.status),
    )
    .reduce((total, receipt) => total + receipt.quantity, 0);
  const issued = readIssues()
    .filter(
      (issue) =>
        issue.projectId === projectId &&
        issue.fuelType === fuelType &&
        issue.date <= date &&
        isFinalStockRecord(issue.status),
    )
    .reduce((total, issue) => total + issue.totalIssued, 0);
  return Math.round((received - issued) * 100) / 100;
}

export const fuelService = {
  listVendors() {
    return FUEL_VENDORS;
  },

  async listReceipts(user: AppUser, filters?: FuelFilters) {
    if (!canUseFuel(user)) {
      throw new Error("You do not have permission to view fuel receipts.");
    }
    const stored = isSupabaseConfigured
      ? await fuelRepository.listReceipts(user, filters)
      : readReceipts();
    memoryReceipts = stored;
    const visible = stored.filter((receipt) =>
      canViewProject(user, receipt.projectId),
    );
    return applyReceiptFilters(visible, filters).sort((left, right) =>
      right.date.localeCompare(left.date) ||
      right.updatedAt.localeCompare(left.updatedAt),
    );
  },

  async listIssues(user: AppUser, filters?: FuelFilters) {
    if (!canUseFuel(user)) {
      throw new Error("You do not have permission to view fuel issues.");
    }
    const stored = isSupabaseConfigured
      ? await fuelRepository.listIssues(user, filters)
      : readIssues();
    memoryIssues = stored;
    const visible = stored.filter((issue) => canViewProject(user, issue.projectId));
    return applyIssueFilters(visible, filters).sort((left, right) =>
      right.date.localeCompare(left.date) ||
      right.updatedAt.localeCompare(left.updatedAt),
    );
  },

  async getDashboard(user: AppUser): Promise<FuelDashboard> {
    const receipts = await this.listReceipts(user);
    const issues = await this.listIssues(user);
    return {
      summary: summarize(user),
      recentReceipts: receipts.slice(0, 6),
      recentIssues: issues.slice(0, 6),
      dailySummary: buildDailySummary(user),
      machineConsumption: buildMachineConsumption(user),
      vendorTracking: buildVendorTracking(user),
    };
  },

  getOpeningStock(projectId: string, fuelType: FuelType, date: string) {
    return getStockBeforeDate(projectId, fuelType, date);
  },

  async saveReceipt(
    input: FuelReceiptInput,
    actor: AppUser,
    status: Extract<FuelRecordStatus, "draft" | "submitted">,
  ) {
    if (!canUseFuel(actor)) {
      throw new Error("You do not have permission to save fuel receipts.");
    }
    validateReceipt(input, status);
    if (isSupabaseConfigured) {
      const receipt = await fuelRepository.saveReceipt(input, actor, status);
      memoryReceipts = [receipt, ...(memoryReceipts ?? []).filter((item) => item.id !== receipt.id)];
      return receipt;
    }
    const vendor = getVendor(input.vendorId);
    const receipts = readReceipts();
    const createdAt = now();
    const receipt: FuelReceipt = {
      id: crypto.randomUUID(),
      receiptNumber: nextReceiptNumber(receipts),
      projectId: input.projectId,
      projectName: getProjectName(input.projectId),
      date: input.date,
      fuelType: input.fuelType,
      vendorId: vendor.id,
      vendorName: vendor.name,
      source: input.source,
      quantity: input.quantity,
      unit: getFuelUnit(input.fuelType),
      ratePerUnit: input.ratePerUnit,
      totalAmount: calculateFuelReceiptTotal(input),
      referenceNumber: input.referenceNumber.trim(),
      remarks: input.remarks.trim(),
      status,
      submittedBy: actor.id,
      submittedByName: actor.fullName,
      submittedByRole: actor.role,
      submittedAt: status === "submitted" ? createdAt : undefined,
      createdAt,
      updatedAt: createdAt,
    };
    writeReceipts([receipt, ...receipts]);
    await recordAuditLog({
      userId: actor.id,
      action:
        status === "submitted"
          ? "fuel.receipt_submitted"
          : "fuel.receipt_draft_saved",
      entityType: "fuel_receipt",
      entityId: receipt.id,
      newValues: {
        receiptNumber: receipt.receiptNumber,
        projectId: receipt.projectId,
        fuelType: receipt.fuelType,
        quantity: receipt.quantity,
        status: receipt.status,
      },
    });
    return receipt;
  },

  async saveIssue(
    input: FuelIssueInput,
    actor: AppUser,
    status: Extract<FuelRecordStatus, "draft" | "submitted">,
  ) {
    if (!canUseFuel(actor)) {
      throw new Error("You do not have permission to save fuel issues.");
    }
    validateIssue(input, status);
    if (isSupabaseConfigured) {
      const issue = await fuelRepository.saveIssue(input, actor, status);
      memoryIssues = [issue, ...(memoryIssues ?? []).filter((item) => item.id !== issue.id)];
      return issue;
    }
    const issues = readIssues();
    if (
      status === "submitted" &&
      issues.some(
        (issue) =>
          issue.projectId === input.projectId &&
          issue.fuelType === input.fuelType &&
          issue.date === input.date &&
          issue.status !== "draft",
      )
    ) {
      throw new Error("Fuel issue already submitted for this project, fuel type and date.");
    }
    const openingStock = getStockBeforeDate(input.projectId, input.fuelType, input.date);
    const totalIssued = calculateFuelIssueTotal(input);
    if (status === "submitted" && totalIssued > openingStock) {
      throw new Error("Fuel issue quantity exceeds opening stock.");
    }
    const createdAt = now();
    const issue: FuelIssue = {
      id: crypto.randomUUID(),
      issueNumber: nextIssueNumber(issues),
      projectId: input.projectId,
      projectName: getProjectName(input.projectId),
      date: input.date,
      fuelType: input.fuelType,
      unit: getFuelUnit(input.fuelType),
      openingStock,
      rows: input.rows,
      totalIssued,
      closingStock: Math.round((openingStock - totalIssued) * 100) / 100,
      remarks: input.remarks.trim(),
      status,
      submittedBy: actor.id,
      submittedByName: actor.fullName,
      submittedByRole: actor.role,
      submittedAt: status === "submitted" ? createdAt : undefined,
      createdAt,
      updatedAt: createdAt,
    };
    writeIssues([issue, ...issues]);
    await recordAuditLog({
      userId: actor.id,
      action:
        status === "submitted"
          ? "fuel.issue_submitted"
          : "fuel.issue_draft_saved",
      entityType: "fuel_issue",
      entityId: issue.id,
      newValues: {
        issueNumber: issue.issueNumber,
        projectId: issue.projectId,
        fuelType: issue.fuelType,
        totalIssued: issue.totalIssued,
        status: issue.status,
      },
    });
    return issue;
  },

  async approveReceipt(receiptId: string, actor: AppUser) {
    if (isSupabaseConfigured) {
      const updated = await fuelRepository.approveReceipt(receiptId, actor);
      memoryReceipts = (memoryReceipts ?? []).map((item) =>
        item.id === receiptId ? updated : item,
      );
      return updated;
    }
    const receipts = readReceipts();
    const receipt = receipts.find((item) => item.id === receiptId);
    if (!receipt) {
      throw new Error("Fuel receipt not found.");
    }
    if (!canApproveFuel(actor, receipt.projectId)) {
      throw new Error("You do not have permission to approve this fuel receipt.");
    }
    const approvedAt = now();
    const updated: FuelReceipt = {
      ...receipt,
      status: "approved",
      approvedBy: actor.id,
      approvedByName: actor.fullName,
      approvedAt,
      updatedAt: approvedAt,
    };
    writeReceipts(receipts.map((item) => (item.id === receiptId ? updated : item)));
    return updated;
  },

  async approveIssue(issueId: string, actor: AppUser) {
    if (isSupabaseConfigured) {
      const updated = await fuelRepository.approveIssue(issueId, actor);
      memoryIssues = (memoryIssues ?? []).map((item) =>
        item.id === issueId ? updated : item,
      );
      return updated;
    }
    const issues = readIssues();
    const issue = issues.find((item) => item.id === issueId);
    if (!issue) {
      throw new Error("Fuel issue not found.");
    }
    if (!canApproveFuel(actor, issue.projectId)) {
      throw new Error("You do not have permission to approve this fuel issue.");
    }
    const approvedAt = now();
    const updated: FuelIssue = {
      ...issue,
      status: "approved",
      approvedBy: actor.id,
      approvedByName: actor.fullName,
      approvedAt,
      updatedAt: approvedAt,
    };
    writeIssues(issues.map((item) => (item.id === issueId ? updated : item)));
    return updated;
  },

  async createDeposit(input: FuelDepositInput, actor: AppUser) {
    if (!isSupabaseConfigured) {
      throw new Error("Fuel deposits require Supabase.");
    }
    return fuelRepository.createDeposit(input, actor);
  },

  async listContracts(actor: AppUser) {
    return isSupabaseConfigured ? fuelRepository.listContracts(actor) : [];
  },

  async listDeposits(actor: AppUser) {
    return isSupabaseConfigured ? fuelRepository.listDeposits(actor) : [];
  },

  async listVendorLedger(actor: AppUser) {
    return isSupabaseConfigured ? fuelRepository.listVendorLedger(actor) : [];
  },

  createIssueRow(machineAssetId?: string): FuelIssueRow {
    const assets = machineryService.listAssets();
    const asset = assets.find((item) => item.id === machineAssetId) ?? assets[0];
    return {
      id: crypto.randomUUID(),
      machineAssetId: asset?.id ?? "",
      machineNumber: asset?.machineNumber ?? "",
      machineType: asset?.machineType ?? "other",
      quantityIssued: 0,
      remarks: "",
    };
  },

  resetDemoData() {
    writeReceipts(seedReceipts());
    writeIssues(seedIssues());
  },
};

export type { FuelIssueRow };
