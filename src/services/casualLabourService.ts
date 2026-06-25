import { LABOUR_VENDORS } from "@/constants/casualLabour";
import { PROJECT_OPTIONS } from "@/constants/claims";
import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { recordAuditLog } from "@/services/auditService";
import { casualLabourRepository } from "@/services/casualLabourRepository";
import { isSupabaseConfigured } from "@/services/supabaseClient";
import { vendorContractService } from "@/services/vendorContractService";
import type { AppUser } from "@/types/auth";
import type {
  CasualLabourAttendance,
  CasualLabourSummary,
  CasualLabourWorker,
  LabourAttendanceInput,
  LabourAttendanceRow,
  LabourCostSummary,
  LabourEntryMode,
  LabourFilters,
  LabourRecordStatus,
  LabourWorkerInput,
} from "@/types/casualLabour";

const LABOUR_WORKERS_STORAGE_KEY = "site-connect:casual-labour-workers";
const LABOUR_ATTENDANCE_STORAGE_KEY = "site-connect:casual-labour-attendance";

let memoryWorkers: CasualLabourWorker[] | null = null;
let memoryAttendance: CasualLabourAttendance[] | null = null;

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
  const vendor = LABOUR_VENDORS.find((item) => item.id === vendorId);
  if (!vendor) {
    throw new Error("Vendor not found.");
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

function canManageLabour(user: AppUser) {
  return ["site_staff", "manager", "admin_hr", "super_admin"].includes(user.role);
}

function canApproveLabour(user: AppUser, record: CasualLabourAttendance) {
  if (["admin_hr", "super_admin"].includes(user.role)) {
    return true;
  }
  return user.role === "manager" && user.projectIds.includes(record.projectId);
}

function seedWorkers(): CasualLabourWorker[] {
  const createdAt = "2026-06-15T09:00:00.000Z";
  return [
    {
      id: "labour-worker-demo-001",
      labourCode: "CL-2026-0001",
      fullName: "Suresh Yadav",
      category: "male",
      vendorId: "vendor-shakti-labour",
      vendorName: "Shakti Labour Supply",
      defaultDailyRate: 700,
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "labour-worker-demo-002",
      labourCode: "CL-2026-0002",
      fullName: "Lata Devi",
      category: "female",
      vendorId: "vendor-shakti-labour",
      vendorName: "Shakti Labour Supply",
      defaultDailyRate: 650,
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "labour-worker-demo-003",
      labourCode: "CL-2026-0003",
      fullName: "Prakash Supervisor",
      category: "supervisor",
      vendorId: "vendor-metro-labour",
      vendorName: "Metro Workforce Services",
      defaultDailyRate: 950,
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function rowFor(
  worker: CasualLabourWorker,
  overrides: Partial<LabourAttendanceRow> = {},
): LabourAttendanceRow {
  return {
    id: crypto.randomUUID(),
    workerId: worker.id,
    workerCode: worker.labourCode,
    workerName: worker.fullName,
    category: worker.category,
    startTime: "09:00",
    endTime: "18:00",
    status: "present",
    dailyRate: worker.defaultDailyRate,
    overtimeHours: 0,
    overtimeRate: 100,
    remarks: "",
    ...overrides,
  };
}

function seedAttendance(): CasualLabourAttendance[] {
  const siteUser = getDemoUser("site@siteconnect.local");
  const workers = seedWorkers();
  const createdAt = "2026-06-20T18:10:00.000Z";
  return [
    {
      id: "labour-attendance-demo-001",
      attendanceNumber: "LAB-2026-0001",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      vendorId: "vendor-shakti-labour",
      vendorName: "Shakti Labour Supply",
      date: "2026-06-20",
      rows: [
        rowFor(workers[0], { id: "labour-row-demo-001", overtimeHours: 1 }),
        rowFor(workers[1], { id: "labour-row-demo-002", status: "half_day" }),
      ],
      allocation: {
        workArea: "Pier P12",
        workDescription: "Shuttering support and housekeeping.",
        maleAllocated: 1,
        femaleAllocated: 1,
        supervisorAllocated: 0,
      },
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

function readWorkers() {
  const workers = readCollection(
    LABOUR_WORKERS_STORAGE_KEY,
    seedWorkers,
    memoryWorkers,
  );
  memoryWorkers = workers;
  return workers;
}

function writeWorkers(workers: CasualLabourWorker[]) {
  memoryWorkers = workers;
  writeCollection(LABOUR_WORKERS_STORAGE_KEY, workers);
}

function readAttendance() {
  const records = readCollection(
    LABOUR_ATTENDANCE_STORAGE_KEY,
    seedAttendance,
    memoryAttendance,
  );
  memoryAttendance = records;
  return records;
}

function writeAttendance(records: CasualLabourAttendance[]) {
  memoryAttendance = records;
  writeCollection(LABOUR_ATTENDANCE_STORAGE_KEY, records);
}

function nextWorkerCode(workers: CasualLabourWorker[]) {
  const next =
    workers
      .map((worker) => Number(worker.labourCode.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `CL-2026-${String(next).padStart(4, "0")}`;
}

function nextAttendanceNumber(records: CasualLabourAttendance[]) {
  const next =
    records
      .map((record) => Number(record.attendanceNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `LAB-2026-${String(next).padStart(4, "0")}`;
}

function applyFilters(records: CasualLabourAttendance[], filters?: LabourFilters) {
  return records.filter((record) => {
    if (filters?.month && !record.date.startsWith(filters.month)) {
      return false;
    }
    if (filters?.projectId && record.projectId !== filters.projectId) {
      return false;
    }
    if (filters?.vendorId && record.vendorId !== filters.vendorId) {
      return false;
    }
    if (filters?.status && filters.status !== "all" && record.status !== filters.status) {
      return false;
    }
    return true;
  });
}

function validateAttendance(input: LabourAttendanceInput, status: LabourRecordStatus) {
  if (input.date > today()) {
    throw new Error("Labour attendance date cannot be in the future.");
  }
  if (status === "submitted" && input.rows.length === 0) {
    throw new Error("Add at least one labour row before submitting.");
  }
  for (const row of input.rows) {
    const entryMode: LabourEntryMode = row.entryMode ?? "named_worker";
    if (entryMode === "named_worker" && !row.workerId) {
      throw new Error("Every labour row needs a worker.");
    }
    if ((row.workerCount ?? 1) <= 0) {
      throw new Error("Labour count must be greater than zero.");
    }
    if (
      row.dailyRate < 0 ||
      row.overtimeHours < 0 ||
      row.overtimeRate < 0 ||
      (row.allowance ?? 0) < 0 ||
      (row.deduction ?? 0) < 0
    ) {
      throw new Error("Rates, allowances, deductions and overtime must be non-negative.");
    }
    if ((row.manualOverrideReason ?? "").trim() === "" && row.workedHours && row.normalHours && row.workedHours < row.normalHours) {
      throw new Error("Manual labour hour overrides need a reason.");
    }
  }
}

function summarize(records: CasualLabourAttendance[]): CasualLabourSummary {
  const month = today().slice(0, 7);
  const workers = readWorkers();
  return {
    totalWorkers: workers.length,
    activeWorkers: workers.filter((worker) => worker.status === "active").length,
    submittedRecords: records.filter((record) => record.status !== "draft").length,
    monthlyCost: records
      .filter((record) => record.date.startsWith(month))
      .reduce((total, record) => total + calculateLabourCostSummary(record).totalCost, 0),
    pendingApproval: records.filter((record) => record.status === "submitted").length,
  };
}

export function calculateLabourCostSummary(
  record: Pick<CasualLabourAttendance, "rows">,
): LabourCostSummary {
  return record.rows.reduce<LabourCostSummary>(
    (summary, row) => {
      const workerCount = row.workerCount ?? 1;
      const dayFactor =
        row.status === "present" ? 1 : row.status === "half_day" ? 0.5 : 0;
      const baseCost = row.dailyRate * dayFactor * workerCount;
      const overtimeCost =
        row.status === "present"
          ? row.overtimeHours * row.overtimeRate * workerCount
          : 0;
      const allowance = (row.allowance ?? 0) * workerCount;
      const deduction = (row.deduction ?? 0) * workerCount;
      return {
        presentCount: summary.presentCount + (row.status === "present" ? 1 : 0),
        workerCount: summary.workerCount + (row.status === "absent" ? 0 : workerCount),
        absentCount: summary.absentCount + (row.status === "absent" ? 1 : 0),
        halfDayCount: summary.halfDayCount + (row.status === "half_day" ? 1 : 0),
        overtimeHours: summary.overtimeHours + row.overtimeHours * workerCount,
        baseCost: summary.baseCost + baseCost,
        overtimeCost: summary.overtimeCost + overtimeCost,
        allowance: summary.allowance + allowance,
        deduction: summary.deduction + deduction,
        totalCost: summary.totalCost + baseCost + overtimeCost + allowance - deduction,
      };
    },
    {
      presentCount: 0,
      workerCount: 0,
      absentCount: 0,
      halfDayCount: 0,
      overtimeHours: 0,
      baseCost: 0,
      overtimeCost: 0,
      allowance: 0,
      deduction: 0,
      totalCost: 0,
    },
  );
}

export const casualLabourService = {
  listVendors() {
    return LABOUR_VENDORS;
  },

  listWorkers() {
    return readWorkers().sort((left, right) =>
      left.fullName.localeCompare(right.fullName),
    );
  },

  async loadWorkers(user: AppUser) {
    if (isSupabaseConfigured) {
      memoryWorkers = await casualLabourRepository.listWorkers(user);
    }
    return this.listWorkers();
  },

  async createWorker(input: LabourWorkerInput, actor: AppUser) {
    if (!canManageLabour(actor)) {
      throw new Error("You do not have permission to create labour workers.");
    }
    if (!input.fullName.trim()) {
      throw new Error("Enter labour worker name.");
    }
    if (isSupabaseConfigured) {
      const worker = await casualLabourRepository.createWorker(input, actor);
      memoryWorkers = [worker, ...(memoryWorkers ?? []).filter((item) => item.id !== worker.id)];
      return worker;
    }
    const vendor = getVendor(input.vendorId);
    const workers = readWorkers();
    const createdAt = now();
    const worker: CasualLabourWorker = {
      id: crypto.randomUUID(),
      labourCode: nextWorkerCode(workers),
      fullName: input.fullName.trim(),
      category: input.category,
      vendorId: vendor.id,
      vendorName: vendor.name,
      defaultDailyRate: input.defaultDailyRate,
      status: "active",
      createdAt,
      updatedAt: createdAt,
    };
    writeWorkers([worker, ...workers]);
    await recordAuditLog({
      userId: actor.id,
      action: "casual_labour.worker_created",
      entityType: "casual_labour_worker",
      entityId: worker.id,
      newValues: {
        labourCode: worker.labourCode,
        fullName: worker.fullName,
        category: worker.category,
        vendorId: worker.vendorId,
        defaultDailyRate: worker.defaultDailyRate,
      },
    });
    return worker;
  },

  async listAttendance(user: AppUser, filters?: LabourFilters) {
    if (isSupabaseConfigured) {
      [memoryAttendance, memoryWorkers] = await Promise.all([
        casualLabourRepository.listAttendance(user),
        casualLabourRepository.listWorkers(user),
      ]);
    }
    const visible = readAttendance().filter(
      (record) =>
        record.submittedBy === user.id ||
        ["manager", "admin_hr", "super_admin"].includes(user.role),
    );
    return applyFilters(visible, filters).sort((left, right) =>
      right.date.localeCompare(left.date) ||
      right.updatedAt.localeCompare(left.updatedAt),
    );
  },

  async getDashboard(user: AppUser) {
    const records = await this.listAttendance(user);
    return {
      summary: summarize(records),
      recent: records.slice(0, 6),
      pending: records.filter((record) => record.status === "submitted"),
    };
  },

  async saveAttendance(
    input: LabourAttendanceInput,
    actor: AppUser,
    status: Extract<LabourRecordStatus, "draft" | "submitted">,
  ) {
    if (!canManageLabour(actor)) {
      throw new Error("You do not have permission to save labour attendance.");
    }
    validateAttendance(input, status);
    if (isSupabaseConfigured) {
      const record = await casualLabourRepository.saveAttendance(input, actor, status);
      memoryAttendance = [record, ...(memoryAttendance ?? []).filter((item) => item.id !== record.id)];
      return record;
    }
    const contract = input.vendorContractId
      ? await vendorContractService.get(input.vendorContractId, actor)
      : null;
    const availableContracts = await vendorContractService.activeLabourContracts(
      actor,
      input.projectId,
      input.vendorId,
    );
    if (status === "submitted" && !contract && availableContracts.length > 0) {
      throw new Error("Select an active labour contract before submitting attendance.");
    }
    if (contract && (contract.contractType !== "labour" || contract.status !== "active")) {
      throw new Error("Selected labour contract is not active.");
    }
    const vendor = contract
      ? { id: contract.vendorId, name: contract.vendorName }
      : getVendor(input.vendorId);
    const records = readAttendance();
    if (
      status === "submitted" &&
      records.some(
        (record) =>
          record.projectId === input.projectId &&
          record.vendorId === input.vendorId &&
          record.date === input.date &&
          record.status !== "draft",
      )
    ) {
      throw new Error("Labour attendance already submitted for this vendor and date.");
    }
    const createdAt = now();
    const record: CasualLabourAttendance = {
      id: crypto.randomUUID(),
      attendanceNumber: nextAttendanceNumber(records),
      projectId: input.projectId,
      projectName: getProjectName(input.projectId),
      vendorId: vendor.id,
      vendorName: vendor.name,
      date: input.date,
      vendorContractId: contract?.id,
      vendorContractCode: contract?.contractCode,
      rows: input.rows.map((row) => ({
        ...row,
        dailyRate:
          row.category === "male"
            ? contract?.maleLabourRate ?? row.dailyRate
            : row.category === "female"
              ? contract?.femaleLabourRate ?? row.dailyRate
              : contract?.supervisorRate ?? row.dailyRate,
        overtimeRate: contract?.overtimeRate ?? row.overtimeRate,
      })),
      allocation: input.allocation,
      status,
      submittedBy: actor.id,
      submittedByName: actor.fullName,
      submittedByRole: actor.role,
      submittedAt: status === "submitted" ? createdAt : undefined,
      createdAt,
      updatedAt: createdAt,
    };
    writeAttendance([record, ...records]);
    await recordAuditLog({
      userId: actor.id,
      action:
        status === "submitted"
          ? "casual_labour.attendance_submitted"
          : "casual_labour.attendance_draft_saved",
      entityType: "casual_labour_attendance",
      entityId: record.id,
      newValues: {
        attendanceNumber: record.attendanceNumber,
        projectId: record.projectId,
        vendorId: record.vendorId,
        date: record.date,
        status: record.status,
      },
    });
    if (contract) {
      await recordAuditLog({
        userId: actor.id,
        action: "labour_contract.linked_to_attendance",
        entityType: "casual_labour_attendance",
        entityId: record.id,
        newValues: { contractId: contract.id, contractCode: contract.contractCode },
      });
    }
    return record;
  },

  async approveAttendance(recordId: string, actor: AppUser) {
    if (isSupabaseConfigured) {
      const updated = await casualLabourRepository.approveAttendance(recordId, actor);
      memoryAttendance = (memoryAttendance ?? []).map((item) =>
        item.id === recordId ? updated : item,
      );
      return updated;
    }
    const records = readAttendance();
    const record = records.find((item) => item.id === recordId);
    if (!record) {
      throw new Error("Labour attendance not found.");
    }
    if (!canApproveLabour(actor, record)) {
      throw new Error("You do not have permission to approve this attendance.");
    }
    const approvedAt = now();
    const updated: CasualLabourAttendance = {
      ...record,
      status: "approved",
      approvedBy: actor.id,
      approvedByName: actor.fullName,
      approvedAt,
      updatedAt: approvedAt,
    };
    writeAttendance(
      records.map((item) => (item.id === recordId ? updated : item)),
    );
    await recordAuditLog({
      userId: actor.id,
      action: "casual_labour.attendance_approved",
      entityType: "casual_labour_attendance",
      entityId: recordId,
      oldValues: { status: record.status },
      newValues: { status: updated.status },
    });
    return updated;
  },

  async listContractTerms(actor: AppUser) {
    return isSupabaseConfigured
      ? casualLabourRepository.listContractTerms(actor)
      : [];
  },

  async listPayees(actor: AppUser) {
    return isSupabaseConfigured ? casualLabourRepository.listPayees(actor) : [];
  },

  async listBills(actor: AppUser) {
    return isSupabaseConfigured ? casualLabourRepository.listBills(actor) : [];
  },

  resetDemoData() {
    writeWorkers(seedWorkers());
    writeAttendance(seedAttendance());
  },
};

export type { LabourAttendanceRow };
