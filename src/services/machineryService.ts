import { PROJECT_OPTIONS } from "@/constants/claims";
import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { MACHINERY_VENDORS } from "@/constants/machinery";
import { recordAuditLog } from "@/services/auditService";
import { machineryRepository } from "@/services/machineryRepository";
import { isSupabaseConfigured } from "@/services/supabaseClient";
import { vendorContractService } from "@/services/vendorContractService";
import type { AppUser } from "@/types/auth";
import type {
  MachineAsset,
  MachineLog,
  MachineLogInput,
  MachineLogSummary,
  MachineLogStatus,
  MachineryContract,
  MachineryContractInput,
  MachineryFilters,
  MachinerySummary,
  UsageSession,
} from "@/types/machinery";
import type { VendorContract } from "@/types/vendorContracts";

const MACHINE_ASSETS_STORAGE_KEY = "site-connect:machine-assets";
const MACHINERY_CONTRACTS_STORAGE_KEY = "site-connect:machinery-contracts";
const MACHINE_LOGS_STORAGE_KEY = "site-connect:machine-logs";

let memoryAssets: MachineAsset[] | null = null;
let memoryContracts: MachineryContract[] | null = null;
let memoryLogs: MachineLog[] | null = null;

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
  const vendor = MACHINERY_VENDORS.find((item) => item.id === vendorId);
  if (!vendor) {
    throw new Error("Machinery vendor not found.");
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

function seedAssets(): MachineAsset[] {
  const createdAt = "2026-06-15T09:00:00.000Z";
  return [
    {
      id: "machine-asset-demo-001",
      machineNumber: "EXC-101",
      machineType: "excavator",
      ownership: "rented",
      vendorId: "vendor-apex-machinery",
      vendorName: "Apex Plant & Machinery",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "machine-asset-demo-002",
      machineNumber: "JCB-204",
      machineType: "jcb",
      ownership: "hired",
      vendorId: "vendor-steel-equip",
      vendorName: "Steel Equip Rentals",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "machine-asset-demo-003",
      machineNumber: "CRN-02",
      machineType: "crane",
      ownership: "company_owned",
      projectId: "project-tower",
      projectName: getProjectName("project-tower"),
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "machine-asset-demo-004",
      machineNumber: "DMP-18",
      machineType: "dumper",
      ownership: "rented",
      vendorId: "vendor-apex-machinery",
      vendorName: "Apex Plant & Machinery",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function seedContracts(): MachineryContract[] {
  const admin = getDemoUser("admin@siteconnect.local");
  const createdAt = "2026-06-16T11:00:00.000Z";
  return [
    {
      id: "machinery-contract-demo-001",
      contractNumber: "MC-2026-0001",
      vendorId: "vendor-apex-machinery",
      vendorName: "Apex Plant & Machinery",
      machineType: "excavator",
      machineNumbers: ["EXC-101", "DMP-18"],
      periodFrom: "2026-06-01",
      periodTo: "2026-09-30",
      billingCycle: "monthly",
      rate: 180000,
      workingDaysPerMonth: 26,
      overtimeRatePerHour: 1800,
      fuelScope: "excluded",
      driverCostScope: "included",
      specialTerms: "Preventive maintenance every 250 hours.",
      status: "active",
      createdBy: admin.id,
      createdByName: admin.fullName,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "machinery-contract-demo-002",
      contractNumber: "MC-2026-0002",
      vendorId: "vendor-steel-equip",
      vendorName: "Steel Equip Rentals",
      machineType: "jcb",
      machineNumbers: ["JCB-204"],
      periodFrom: "2026-06-10",
      periodTo: "2026-08-10",
      billingCycle: "daily",
      rate: 8500,
      workingDaysPerMonth: 26,
      overtimeRatePerHour: 900,
      fuelScope: "partial",
      driverCostScope: "additional",
      specialTerms: "Minimum billing of eight hours per working day.",
      status: "active",
      createdBy: admin.id,
      createdByName: admin.fullName,
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function session(
  id: string,
  startTime: string,
  endTime: string,
): UsageSession {
  return {
    id,
    startTime,
    endTime,
    hours: calculateSessionHours(startTime, endTime),
  };
}

function seedLogs(): MachineLog[] {
  const siteUser = getDemoUser("site@siteconnect.local");
  const manager = getDemoUser("manager@siteconnect.local");
  const createdAt = "2026-06-20T18:00:00.000Z";
  return [
    {
      id: "machine-log-demo-001",
      logNumber: "MLOG-2026-0001",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      date: "2026-06-20",
      machineAssetId: "machine-asset-demo-001",
      machineNumber: "EXC-101",
      machineType: "excavator",
      vendorId: "vendor-apex-machinery",
      vendorName: "Apex Plant & Machinery",
      ownership: "rented",
      usageSessions: [
        session("machine-session-demo-001", "08:30", "12:30"),
        session("machine-session-demo-002", "14:00", "17:30"),
      ],
      meterStart: 1250,
      meterEnd: 1257.5,
      totalMeterHours: 7.5,
      breakdown: {
        isBreakdown: false,
        durationHours: 0,
        reason: "",
        resolution: "",
      },
      remarks: "Drain excavation near chainage 160.",
      status: "approved",
      submittedBy: siteUser.id,
      submittedByName: siteUser.fullName,
      submittedByRole: siteUser.role,
      submittedAt: createdAt,
      approvedBy: manager.id,
      approvedByName: manager.fullName,
      approvedAt: "2026-06-20T19:00:00.000Z",
      createdAt,
      updatedAt: "2026-06-20T19:00:00.000Z",
    },
    {
      id: "machine-log-demo-002",
      logNumber: "MLOG-2026-0002",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      date: "2026-06-20",
      machineAssetId: "machine-asset-demo-002",
      machineNumber: "JCB-204",
      machineType: "jcb",
      vendorId: "vendor-steel-equip",
      vendorName: "Steel Equip Rentals",
      ownership: "hired",
      usageSessions: [session("machine-session-demo-003", "09:00", "15:30")],
      meterStart: 332,
      meterEnd: 338.5,
      totalMeterHours: 6.5,
      breakdown: {
        isBreakdown: true,
        startTime: "15:30",
        durationHours: 1,
        reason: "Hydraulic hose leak.",
        resolution: "Vendor mechanic replaced hose on site.",
      },
      remarks: "Backfilling support after repair.",
      status: "submitted",
      submittedBy: siteUser.id,
      submittedByName: siteUser.fullName,
      submittedByRole: siteUser.role,
      submittedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function readAssets() {
  const assets = readCollection(
    MACHINE_ASSETS_STORAGE_KEY,
    seedAssets,
    memoryAssets,
  );
  memoryAssets = assets;
  return assets;
}

function writeAssets(assets: MachineAsset[]) {
  memoryAssets = assets;
  writeCollection(MACHINE_ASSETS_STORAGE_KEY, assets);
}

function readContracts() {
  const contracts = readCollection(
    MACHINERY_CONTRACTS_STORAGE_KEY,
    seedContracts,
    memoryContracts,
  );
  memoryContracts = contracts;
  return contracts;
}

function writeContracts(contracts: MachineryContract[]) {
  memoryContracts = contracts;
  writeCollection(MACHINERY_CONTRACTS_STORAGE_KEY, contracts);
}

function readLogs() {
  const logs = readCollection(MACHINE_LOGS_STORAGE_KEY, seedLogs, memoryLogs);
  memoryLogs = logs;
  return logs;
}

function writeLogs(logs: MachineLog[]) {
  memoryLogs = logs;
  writeCollection(MACHINE_LOGS_STORAGE_KEY, logs);
}

function nextContractNumber(contracts: MachineryContract[]) {
  const next =
    contracts
      .map((contract) => Number(contract.contractNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `MC-2026-${String(next).padStart(4, "0")}`;
}

function nextLogNumber(logs: MachineLog[]) {
  const next =
    logs
      .map((log) => Number(log.logNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `MLOG-2026-${String(next).padStart(4, "0")}`;
}

function canUseMachinery(user: AppUser) {
  return ["site_staff", "manager", "admin_hr", "super_admin"].includes(user.role);
}

function canManageContracts(user: AppUser) {
  return ["admin_hr", "super_admin"].includes(user.role);
}

function canViewLog(user: AppUser, log: MachineLog) {
  if (log.submittedBy === user.id) {
    return true;
  }
  if (user.role === "manager") {
    return user.projectIds.includes(log.projectId);
  }
  return ["admin_hr", "super_admin"].includes(user.role);
}

function canApproveLog(user: AppUser, log: MachineLog) {
  if (["admin_hr", "super_admin"].includes(user.role)) {
    return true;
  }
  return user.role === "manager" && user.projectIds.includes(log.projectId);
}

function applyLogFilters(logs: MachineLog[], filters?: MachineryFilters) {
  return logs.filter((log) => {
    if (filters?.month && !log.date.startsWith(filters.month)) {
      return false;
    }
    if (filters?.projectId && log.projectId !== filters.projectId) {
      return false;
    }
    if (filters?.vendorId && log.vendorId !== filters.vendorId) {
      return false;
    }
    if (
      filters?.machineType &&
      filters.machineType !== "all" &&
      log.machineType !== filters.machineType
    ) {
      return false;
    }
    if (
      filters?.status &&
      filters.status !== "all" &&
      log.status !== filters.status
    ) {
      return false;
    }
    if (filters?.search?.trim()) {
      const query = filters.search.trim().toLowerCase();
      const haystack = [
        log.logNumber,
        log.projectName,
        log.machineNumber,
        log.vendorName,
        log.remarks,
        log.breakdown.reason,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    }
    return true;
  });
}

function applyContractFilters(
  contracts: MachineryContract[],
  filters?: MachineryFilters,
) {
  return contracts.filter((contract) => {
    if (filters?.vendorId && contract.vendorId !== filters.vendorId) {
      return false;
    }
    if (
      filters?.machineType &&
      filters.machineType !== "all" &&
      contract.machineType !== filters.machineType
    ) {
      return false;
    }
    if (
      filters?.status &&
      filters.status !== "all" &&
      contract.status !== filters.status
    ) {
      return false;
    }
    return true;
  });
}

function getAsset(assetId: string) {
  const asset = readAssets().find((item) => item.id === assetId);
  if (!asset) {
    throw new Error("Machine not found.");
  }
  return asset;
}

function validateContract(input: MachineryContractInput) {
  if (input.periodFrom > input.periodTo) {
    throw new Error("Contract end date must be after start date.");
  }
  if (input.machineNumbers.length === 0) {
    throw new Error("Select at least one machine for this contract.");
  }
  if (
    input.rate < 0 ||
    input.overtimeRatePerHour < 0 ||
    input.workingDaysPerMonth <= 0
  ) {
    throw new Error("Contract rates and working days must be valid.");
  }
}

function validateLog(input: MachineLogInput, status: MachineLogStatus) {
  if (input.date > today()) {
    throw new Error("Machine log date cannot be in the future.");
  }
  if (!input.machineAssetId) {
    throw new Error("Select a machine.");
  }
  if (status === "submitted" && input.usageSessions.length === 0) {
    throw new Error("Add at least one usage session before submitting.");
  }
  if (input.meterEnd < input.meterStart) {
    throw new Error("Meter end cannot be less than meter start.");
  }
  for (const item of input.usageSessions) {
    calculateSessionHours(item.startTime, item.endTime);
  }
  if (input.breakdown.durationHours < 0) {
    throw new Error("Breakdown duration must be non-negative.");
  }
  if (
    status === "submitted" &&
    input.breakdown.isBreakdown &&
    !input.breakdown.reason.trim()
  ) {
    throw new Error("Enter breakdown reason before submitting.");
  }
}

function summarize(logs: MachineLog[]): MachinerySummary {
  const month = today().slice(0, 7);
  const activeMachines = readAssets().filter((asset) => asset.status === "active");
  const activeContracts = readContracts().filter(
    (contract) => contract.status === "active",
  );
  return {
    activeMachines: activeMachines.length,
    activeContracts: activeContracts.length,
    logsThisMonth: logs.filter((log) => log.date.startsWith(month)).length,
    utilizationHours: logs.reduce(
      (total, log) => total + calculateMachineLogSummary(log).billableHours,
      0,
    ),
    breakdownCount: logs.filter((log) => log.breakdown.isBreakdown).length,
    pendingApproval: logs.filter((log) => log.status === "submitted").length,
  };
}

export function calculateSessionHours(startTime: string, endTime: string) {
  const [startHour = 0, startMinute = 0] = startTime.split(":").map(Number);
  const [endHour = 0, endMinute = 0] = endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const diff = end - start;
  if (!Number.isFinite(diff) || diff <= 0) {
    throw new Error("Usage session end time must be after start time.");
  }
  return Math.round((diff / 60) * 100) / 100;
}

export function calculateMachineLogSummary(
  log: Pick<MachineLogInput, "usageSessions" | "meterStart" | "meterEnd">,
): MachineLogSummary {
  const sessionHours = log.usageSessions.reduce(
    (total, item) => total + calculateSessionHours(item.startTime, item.endTime),
    0,
  );
  const meterHours = Math.max(0, log.meterEnd - log.meterStart);
  return {
    sessionHours: Math.round(sessionHours * 100) / 100,
    meterHours: Math.round(meterHours * 100) / 100,
    billableHours: Math.round(Math.max(sessionHours, meterHours) * 100) / 100,
  };
}

export function calculateMachineryContractCost({
  contract,
  billableHours,
  tripCount,
  breakdownHours,
}: {
  contract: VendorContract;
  billableHours: number;
  tripCount: number;
  breakdownHours: number;
}) {
  const rate = contract.rate ?? 0;
  const minimumHours = contract.minimumHours ?? 0;
  const workingDays = Math.max(contract.workingDaysPerMonth ?? 26, 1);
  const normalHours = Math.min(billableHours, minimumHours || billableHours);
  const overtimeHours = Math.max(billableHours - minimumHours, 0);
  const base =
    contract.billingType === "monthly"
      ? rate / workingDays
      : contract.billingType === "weekly"
        ? rate / 6
        : contract.billingType === "hourly"
          ? Math.max(normalHours, minimumHours) * rate
          : contract.billingType === "per_trip"
            ? tripCount * rate
            : rate;
  const overtime = overtimeHours * (contract.overtimeRate ?? 0);
  const driverBeta =
    contract.driverCost === "additional" ? contract.driverBetaAmount ?? 0 : 0;
  const breakdownDeduction = breakdownHours * (contract.overtimeRate ?? 0);
  return Math.max(0, Math.round((base + overtime + driverBeta - breakdownDeduction) * 100) / 100);
}

export const machineryService = {
  listVendors() {
    return MACHINERY_VENDORS;
  },

  listAssets(filters?: MachineryFilters) {
    return readAssets()
      .filter((asset) => {
        if (filters?.projectId && asset.projectId !== filters.projectId) {
          return false;
        }
        if (filters?.vendorId && asset.vendorId !== filters.vendorId) {
          return false;
        }
        if (
          filters?.machineType &&
          filters.machineType !== "all" &&
          asset.machineType !== filters.machineType
        ) {
          return false;
        }
        return true;
      })
      .sort((left, right) => left.machineNumber.localeCompare(right.machineNumber));
  },

  async loadAssets(user: AppUser, filters?: MachineryFilters) {
    if (isSupabaseConfigured) {
      memoryAssets = await machineryRepository.listAssets(user, filters);
    }
    return this.listAssets(filters);
  },

  async listContracts(user: AppUser, filters?: MachineryFilters) {
    if (!canUseMachinery(user)) {
      throw new Error("You do not have permission to view machinery contracts.");
    }
    if (isSupabaseConfigured) {
      [memoryContracts, memoryAssets] = await Promise.all([
        machineryRepository.listContracts(user, filters),
        machineryRepository.listAssets(user, filters),
      ]);
    }
    return applyContractFilters(readContracts(), filters).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  },

  async createContract(input: MachineryContractInput, actor: AppUser) {
    if (!canManageContracts(actor)) {
      throw new Error("You do not have permission to create machinery contracts.");
    }
    validateContract(input);
    if (isSupabaseConfigured) {
      const contract = await machineryRepository.createContract(input, actor);
      memoryContracts = [contract, ...(memoryContracts ?? []).filter((item) => item.id !== contract.id)];
      return contract;
    }
    const vendor = getVendor(input.vendorId);
    const contracts = readContracts();
    const createdAt = now();
    const contract: MachineryContract = {
      id: crypto.randomUUID(),
      contractNumber: nextContractNumber(contracts),
      vendorId: vendor.id,
      vendorName: vendor.name,
      machineType: input.machineType,
      machineNumbers: input.machineNumbers,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      billingCycle: input.billingCycle,
      rate: input.rate,
      workingDaysPerMonth: input.workingDaysPerMonth,
      overtimeRatePerHour: input.overtimeRatePerHour,
      fuelScope: input.fuelScope,
      driverCostScope: input.driverCostScope,
      specialTerms: input.specialTerms.trim(),
      status: input.status,
      createdBy: actor.id,
      createdByName: actor.fullName,
      createdAt,
      updatedAt: createdAt,
    };
    writeContracts([contract, ...contracts]);
    await recordAuditLog({
      userId: actor.id,
      action: "machinery.contract_created",
      entityType: "machinery_contract",
      entityId: contract.id,
      newValues: {
        contractNumber: contract.contractNumber,
        vendorId: contract.vendorId,
        machineType: contract.machineType,
        machineNumbers: contract.machineNumbers,
        status: contract.status,
      },
    });
    return contract;
  },

  async listLogs(user: AppUser, filters?: MachineryFilters) {
    if (!canUseMachinery(user)) {
      throw new Error("You do not have permission to view machinery logs.");
    }
    if (isSupabaseConfigured) {
      [memoryLogs, memoryAssets] = await Promise.all([
        machineryRepository.listLogs(user, filters),
        machineryRepository.listAssets(user, filters),
      ]);
    }
    const visible = readLogs().filter((log) => canViewLog(user, log));
    return applyLogFilters(visible, filters).sort((left, right) =>
      right.date.localeCompare(left.date) ||
      right.updatedAt.localeCompare(left.updatedAt),
    );
  },

  async getDashboard(user: AppUser) {
    const logs = await this.listLogs(user);
    const contracts = await this.listContracts(user);
    return {
      summary: summarize(logs),
      recentLogs: logs.slice(0, 6),
      pendingLogs: logs.filter((log) => log.status === "submitted"),
      activeContracts: contracts.filter((contract) => contract.status === "active"),
    };
  },

  async saveLog(
    input: MachineLogInput,
    actor: AppUser,
    status: Extract<MachineLogStatus, "draft" | "submitted">,
  ) {
    if (!canUseMachinery(actor)) {
      throw new Error("You do not have permission to save machinery logs.");
    }
    validateLog(input, status);
    const asset = getAsset(input.machineAssetId);
    const contract = input.vendorContractId
      ? await vendorContractService.get(input.vendorContractId, actor)
      : null;
    if (status === "submitted" && asset.ownership !== "company_owned" && !contract) {
      throw new Error("Select an active machinery contract before submitting this log.");
    }
    if (contract && (contract.contractType !== "machinery" || contract.status !== "active")) {
      throw new Error("Selected machinery contract is not active.");
    }
    const logs = readLogs();
    if (
      status === "submitted" &&
      logs.some(
        (log) =>
          log.machineAssetId === input.machineAssetId &&
          log.date === input.date &&
          log.status !== "draft",
      )
    ) {
      throw new Error("Machine log already submitted for this machine and date.");
    }
    const createdAt = now();
    const usageSessions = input.usageSessions.map((item) => ({
      ...item,
      hours: calculateSessionHours(item.startTime, item.endTime),
    }));
    const totalMeterHours = Math.round((input.meterEnd - input.meterStart) * 100) / 100;
    const billableHours = calculateMachineLogSummary(input).billableHours;
    const calculatedCost = contract
      ? calculateMachineryContractCost({
          contract,
          billableHours,
          tripCount: input.tripCount ?? input.usageSessions.length,
          breakdownHours: input.breakdown.durationHours,
        })
      : 0;
    if (isSupabaseConfigured) {
      const stored = await machineryRepository.saveLog(
        { ...input, usageSessions },
        actor,
        status,
        calculatedCost,
      );
      memoryLogs = [stored, ...(memoryLogs ?? []).filter((item) => item.id !== stored.id)];
      return stored;
    }
    const log: MachineLog = {
      id: crypto.randomUUID(),
      logNumber: nextLogNumber(logs),
      projectId: input.projectId,
      projectName: getProjectName(input.projectId),
      date: input.date,
      machineAssetId: asset.id,
      machineNumber: asset.machineNumber,
      machineType: asset.machineType,
      vendorId: asset.vendorId,
      vendorName: asset.vendorName,
      ownership: asset.ownership,
      vendorContractId: contract?.id,
      vendorContractCode: contract?.contractCode,
      billingType: contract?.billingType,
      billingRate: contract?.rate,
      calculatedCost,
      tripCount: input.tripCount ?? input.usageSessions.length,
      sourceLocation: input.sourceLocation,
      destinationLocation: input.destinationLocation,
      loadType: input.loadType,
      operationalStatus:
        input.operationalStatus ??
        (input.breakdown.isBreakdown ? "breakdown" : "active"),
      usageSessions,
      meterStart: input.meterStart,
      meterEnd: input.meterEnd,
      totalMeterHours,
      breakdown: input.breakdown,
      remarks: input.remarks.trim(),
      status,
      submittedBy: actor.id,
      submittedByName: actor.fullName,
      submittedByRole: actor.role,
      submittedAt: status === "submitted" ? createdAt : undefined,
      createdAt,
      updatedAt: createdAt,
    };
    writeLogs([log, ...logs]);
    await recordAuditLog({
      userId: actor.id,
      action:
        status === "submitted"
          ? "machinery.log_submitted"
          : "machinery.log_draft_saved",
      entityType: "machine_log",
      entityId: log.id,
      newValues: {
        logNumber: log.logNumber,
        projectId: log.projectId,
        machineNumber: log.machineNumber,
        date: log.date,
        status: log.status,
      },
    });
    if (contract) {
      await recordAuditLog({
        userId: actor.id,
        action: "machinery_contract.linked_to_machine_log",
        entityType: "machine_log",
        entityId: log.id,
        newValues: {
          contractId: contract.id,
          contractCode: contract.contractCode,
          calculatedCost,
        },
      });
    }
    return log;
  },

  async approveLog(logId: string, actor: AppUser) {
    if (isSupabaseConfigured) {
      const updated = await machineryRepository.approveLog(logId, actor);
      memoryLogs = (memoryLogs ?? []).map((item) => item.id === logId ? updated : item);
      return updated;
    }
    const logs = readLogs();
    const log = logs.find((item) => item.id === logId);
    if (!log) {
      throw new Error("Machine log not found.");
    }
    if (!canApproveLog(actor, log)) {
      throw new Error("You do not have permission to approve this machine log.");
    }
    if (log.status === "draft") {
      throw new Error("Draft machine logs cannot be approved.");
    }
    const approvedAt = now();
    const updated: MachineLog = {
      ...log,
      status: "approved",
      approvedBy: actor.id,
      approvedByName: actor.fullName,
      approvedAt,
      updatedAt: approvedAt,
    };
    writeLogs(logs.map((item) => (item.id === logId ? updated : item)));
    await recordAuditLog({
      userId: actor.id,
      action: "machinery.log_approved",
      entityType: "machine_log",
      entityId: logId,
      oldValues: { status: log.status },
      newValues: { status: updated.status },
    });
    return updated;
  },

  resetDemoData() {
    writeAssets(seedAssets());
    writeContracts(seedContracts());
    writeLogs(seedLogs());
  },
};

export type { UsageSession };
