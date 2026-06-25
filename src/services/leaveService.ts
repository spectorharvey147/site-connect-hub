import { DEMO_ORGANIZATION_ID, DEMO_USERS, toAppUser } from "@/constants/demoData";
import { HOLIDAYS, LEAVE_TYPES } from "@/constants/leave";
import { recordAuditLog } from "@/services/auditService";
import { approvalMatrixService } from "@/services/approvalMatrixService";
import { userHierarchyService } from "@/services/userHierarchyService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { AppUser, Role } from "@/types/auth";
import type {
  Holiday,
  LeaveApplication,
  LeaveApprovalHistoryItem,
  LeaveApprovalInput,
  LeaveAttachment,
  LeaveBalance,
  LeaveFilters,
  LeaveInput,
  LeaveType,
} from "@/types/leave";

const LEAVES_STORAGE_KEY = "site-connect:leave-applications";
const LEAVE_HISTORY_STORAGE_KEY = "site-connect:leave-approval-history";
const LEAVE_TYPES_STORAGE_KEY = "site-connect:leave-types";
const HOLIDAYS_STORAGE_KEY = "site-connect:holidays";

let memoryLeaves: LeaveApplication[] | null = null;
let memoryHistory: LeaveApprovalHistoryItem[] | null = null;
let memoryLeaveTypes: LeaveType[] | null = null;
let memoryHolidays: Holiday[] | null = null;

type SupabaseClient = NonNullable<typeof supabase>;

interface SupabaseProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface SupabaseLeaveTypeRow {
  id: string;
  code: string;
  name: string;
  annual_allowance: number | string;
  carry_forward: boolean;
  requires_document: boolean;
  status: "active" | "inactive";
}

interface SupabaseHolidayRow {
  id: string;
  name: string;
  date: string;
  location: string;
  holiday_type: Holiday["type"];
  status: "active" | "inactive";
}

interface SupabaseLeaveRow {
  id: string;
  organization_id: string | null;
  department_id: string | null;
  requester_user_id: string | null;
  reporting_manager_id: string | null;
  hod_user_id: string | null;
  approval_path?: unknown;
  leave_number: string;
  user_id: string;
  manager_id: string | null;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  number_of_days: number | string;
  reason: string;
  status: LeaveApplication["status"];
  applied_at: string;
  approved_by: string | null;
  approval_date: string | null;
  rejection_reason: string | null;
  comments: string | null;
  created_at: string;
  updated_at: string;
}

interface SupabaseLeaveAttachmentRow {
  id: string;
  leave_id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface SupabaseLeaveHistoryRow {
  id: string;
  leave_id: string;
  actor_id: string;
  actor_role: Role;
  decision: LeaveApprovalHistoryItem["decision"];
  comments: string | null;
  created_at: string;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function now() {
  return new Date().toISOString();
}

function getLeaveType(leaveTypeId: string) {
  const leaveType = readLeaveTypes().find((type) => type.id === leaveTypeId);
  if (!leaveType) {
    throw new Error("Leave type not found.");
  }
  return leaveType;
}

function shouldUseSupabaseLeave() {
  return isSupabaseConfigured && Boolean(supabase);
}

function leaveClient(): SupabaseClient {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function parseApprovalPath(value: unknown): LeaveApplication["approvalPath"] {
  return Array.isArray(value) ? (value as LeaveApplication["approvalPath"]) : [];
}

function localLeaveTypeId(row: SupabaseLeaveTypeRow | undefined, fallback?: string | null) {
  if (!row) {
    return fallback ?? "";
  }
  return LEAVE_TYPES.find((type) => type.code === row.code)?.id ?? row.id;
}

async function dbLeaveTypeId(leaveTypeId: string) {
  const type = LEAVE_TYPES.find((item) => item.id === leaveTypeId);
  if (!type) {
    return leaveTypeId;
  }
  const { data, error } = await leaveClient()
    .from("leave_types")
    .select("id")
    .eq("code", type.code)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return ((data as unknown) as { id: string } | null)?.id ?? leaveTypeId;
}

function toDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(date: string) {
  return readHolidays().some((holiday) => holiday.date === date);
}

export function calculateLeaveDays(fromDate: string, toDateValue: string) {
  if (toDateValue < fromDate) {
    return 0;
  }

  let days = 0;
  const cursor = toDate(fromDate);
  const end = toDate(toDateValue);
  while (cursor <= end) {
    const key = dateKey(cursor);
    if (!isWeekend(cursor) && !isHoliday(key)) {
      days += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function seedLeaves(): LeaveApplication[] {
  const siteUser = DEMO_USERS.find((user) => user.email === "site@siteconnect.local");
  const secondUser = DEMO_USERS.find((user) => user.email === "ishita@siteconnect.local");
  const manager = DEMO_USERS.find((user) => user.email === "manager@siteconnect.local");
  if (!siteUser || !secondUser || !manager) {
    return [];
  }
  const user = toAppUser(siteUser);
  const otherUser = toAppUser(secondUser);
  const managerUser = toAppUser(manager);

  return [
    {
      id: "leave-demo-001",
      leaveNumber: "LV-2026-0001",
      userId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      managerId: user.managerId,
      leaveTypeId: "casual",
      leaveTypeName: "Casual Leave",
      fromDate: "2026-06-24",
      toDate: "2026-06-25",
      numberOfDays: 2,
      reason: "Family function",
      status: "pending",
      attachments: [],
      appliedAt: "2026-06-20T08:30:00.000Z",
      createdAt: "2026-06-20T08:30:00.000Z",
      updatedAt: "2026-06-20T08:30:00.000Z",
    },
    {
      id: "leave-demo-002",
      leaveNumber: "LV-2026-0002",
      userId: otherUser.id,
      userName: otherUser.fullName,
      userEmail: otherUser.email,
      managerId: otherUser.managerId,
      leaveTypeId: "sick",
      leaveTypeName: "Sick Leave",
      fromDate: "2026-06-12",
      toDate: "2026-06-12",
      numberOfDays: 1,
      reason: "Fever",
      status: "approved",
      attachments: [],
      appliedAt: "2026-06-11T08:30:00.000Z",
      approvedBy: managerUser.id,
      approvedByName: managerUser.fullName,
      approvalDate: "2026-06-11T14:30:00.000Z",
      comments: "Approved.",
      createdAt: "2026-06-11T08:30:00.000Z",
      updatedAt: "2026-06-11T14:30:00.000Z",
    },
  ];
}

function seedHistory(): LeaveApprovalHistoryItem[] {
  const siteUser = DEMO_USERS.find((user) => user.email === "site@siteconnect.local");
  const secondUser = DEMO_USERS.find((user) => user.email === "ishita@siteconnect.local");
  const manager = DEMO_USERS.find((user) => user.email === "manager@siteconnect.local");
  if (!siteUser || !secondUser || !manager) {
    return [];
  }
  const user = toAppUser(siteUser);
  const otherUser = toAppUser(secondUser);
  const managerUser = toAppUser(manager);

  return [
    {
      id: "leave-history-001",
      leaveId: "leave-demo-001",
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      decision: "submitted",
      comments: "Family function",
      createdAt: "2026-06-20T08:30:00.000Z",
    },
    {
      id: "leave-history-002",
      leaveId: "leave-demo-002",
      actorId: otherUser.id,
      actorName: otherUser.fullName,
      actorRole: otherUser.role,
      decision: "submitted",
      comments: "Fever",
      createdAt: "2026-06-11T08:30:00.000Z",
    },
    {
      id: "leave-history-003",
      leaveId: "leave-demo-002",
      actorId: managerUser.id,
      actorName: managerUser.fullName,
      actorRole: managerUser.role,
      decision: "approved",
      comments: "Approved.",
      createdAt: "2026-06-11T14:30:00.000Z",
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

function readLeaves() {
  const leaves = readCollection(LEAVES_STORAGE_KEY, seedLeaves, memoryLeaves);
  memoryLeaves = leaves;
  return leaves;
}

function writeLeaves(leaves: LeaveApplication[]) {
  memoryLeaves = leaves;
  writeCollection(LEAVES_STORAGE_KEY, leaves);
}

function readHistory() {
  const history = readCollection(
    LEAVE_HISTORY_STORAGE_KEY,
    seedHistory,
    memoryHistory,
  );
  memoryHistory = history;
  return history;
}

function writeHistory(history: LeaveApprovalHistoryItem[]) {
  memoryHistory = history;
  writeCollection(LEAVE_HISTORY_STORAGE_KEY, history);
}

function readLeaveTypes() {
  const types = readCollection(LEAVE_TYPES_STORAGE_KEY, () => LEAVE_TYPES, memoryLeaveTypes);
  memoryLeaveTypes = types;
  return types;
}

function writeLeaveTypes(types: LeaveType[]) {
  memoryLeaveTypes = types;
  writeCollection(LEAVE_TYPES_STORAGE_KEY, types);
}

function readHolidays() {
  const holidays = readCollection(HOLIDAYS_STORAGE_KEY, () => HOLIDAYS, memoryHolidays);
  memoryHolidays = holidays;
  return holidays;
}

function writeHolidays(holidays: Holiday[]) {
  memoryHolidays = holidays;
  writeCollection(HOLIDAYS_STORAGE_KEY, holidays);
}

function canApproveLeaves(user: AppUser) {
  return ["manager", "hod", "super_admin"].includes(user.role);
}

function canManagePolicy(user: AppUser) {
  return ["admin_hr", "super_admin"].includes(user.role);
}

function canViewLeave(user: AppUser, application: LeaveApplication) {
  if (application.userId === user.id) {
    return true;
  }
  if (user.role === "manager") {
    return application.managerId === user.id || user.projectIds.length > 0;
  }
  if (user.role === "hod") {
    return (
      application.departmentId === user.departmentId ||
      application.hodUserId === user.id
    );
  }
  return ["admin_hr", "super_admin"].includes(user.role);
}

function applyFilters(leaves: LeaveApplication[], filters?: LeaveFilters) {
  return leaves.filter((leave) => {
    if (filters?.userId && leave.userId !== filters.userId) {
      return false;
    }
    if (filters?.status && filters.status !== "all" && leave.status !== filters.status) {
      return false;
    }
    if (filters?.fromDate && leave.toDate < filters.fromDate) {
      return false;
    }
    if (filters?.toDate && leave.fromDate > filters.toDate) {
      return false;
    }
    return true;
  });
}

function hasOverlap(
  leaves: LeaveApplication[],
  userId: string,
  fromDate: string,
  toDateValue: string,
) {
  return leaves.some(
    (leave) =>
      leave.userId === userId &&
      ["pending", "approved", "submitted"].includes(leave.status) &&
      fromDate <= leave.toDate &&
      toDateValue >= leave.fromDate,
  );
}

function nextLeaveNumber(leaves: LeaveApplication[]) {
  const next =
    leaves
      .map((leave) => Number(leave.leaveNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `LV-2026-${String(next).padStart(4, "0")}`;
}

function makeHistory(
  leaveId: string,
  actor: AppUser,
  decision: LeaveApprovalHistoryItem["decision"],
  comments?: string,
): LeaveApprovalHistoryItem {
  return {
    id: crypto.randomUUID(),
    leaveId,
    actorId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    decision,
    comments,
    createdAt: now(),
  };
}

async function fetchProfiles(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return new Map<string, SupabaseProfileRow>();
  }
  const { data, error } = await leaveClient()
    .from("user_profiles")
    .select("id, full_name, email")
    .in("id", uniqueIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map(
    (((data as unknown) as SupabaseProfileRow[] | null) ?? []).map((profile) => [
      profile.id,
      profile,
    ]),
  );
}

async function fetchLeaveTypes(ids: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (uniqueIds.length === 0) {
    return new Map<string, SupabaseLeaveTypeRow>();
  }
  const { data, error } = await leaveClient()
    .from("leave_types")
    .select("id, code, name, annual_allowance, carry_forward, requires_document, status")
    .in("id", uniqueIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map(
    (((data as unknown) as SupabaseLeaveTypeRow[] | null) ?? []).map((type) => [
      type.id,
      type,
    ]),
  );
}

async function mapSupabaseLeaves(rows: SupabaseLeaveRow[]): Promise<LeaveApplication[]> {
  if (rows.length === 0) {
    return [];
  }
  const leaveIds = rows.map((row) => row.id);
  const [profiles, approvers, leaveTypes, attachmentsResult] = await Promise.all([
    fetchProfiles(rows.map((row) => row.user_id)),
    fetchProfiles(rows.map((row) => row.approved_by).filter((id): id is string => Boolean(id))),
    fetchLeaveTypes(rows.map((row) => row.leave_type_id)),
    leaveClient().from("leave_attachments").select("*").in("leave_id", leaveIds),
  ]);
  if (attachmentsResult.error) {
    throw new Error(attachmentsResult.error.message);
  }
  const attachments =
    ((attachmentsResult.data as unknown) as SupabaseLeaveAttachmentRow[] | null) ?? [];

  return rows.map((row) => {
    const profile = profiles.get(row.user_id);
    const approver = row.approved_by ? approvers.get(row.approved_by) : undefined;
    const leaveType = leaveTypes.get(row.leave_type_id);
    const leaveTypeId = localLeaveTypeId(leaveType, row.leave_type_id);
    return {
      id: row.id,
      organizationId: row.organization_id ?? undefined,
      departmentId: row.department_id ?? undefined,
      requesterUserId: row.requester_user_id ?? row.user_id,
      reportingManagerId: row.reporting_manager_id ?? undefined,
      hodUserId: row.hod_user_id ?? undefined,
      leaveNumber: row.leave_number,
      userId: row.user_id,
      userName: profile?.full_name ?? "User",
      userEmail: profile?.email ?? "",
      managerId: row.manager_id ?? undefined,
      leaveTypeId,
      leaveTypeName: leaveType?.name ?? getLeaveType(leaveTypeId).name,
      fromDate: row.from_date,
      toDate: row.to_date,
      numberOfDays: toNumber(row.number_of_days),
      reason: row.reason,
      status: row.status,
      attachments: attachments
        .filter((attachment) => attachment.leave_id === row.id)
        .map((attachment) => ({
          id: attachment.id,
          fileName: attachment.file_name,
          fileType: attachment.file_type ?? "",
          fileSize: attachment.file_size ?? 0,
          url: attachment.file_url,
          uploadedAt: attachment.created_at,
        })),
      approvalPath: parseApprovalPath(row.approval_path),
      appliedAt: row.applied_at,
      approvedBy: row.approved_by ?? undefined,
      approvedByName: approver?.full_name ?? undefined,
      approvalDate: row.approval_date ?? undefined,
      rejectionReason: row.rejection_reason ?? undefined,
      comments: row.comments ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

async function getSupabaseLeave(leaveId: string, user: AppUser) {
  const { data, error } = await leaveClient()
    .from("leave_applications")
    .select("*")
    .eq("id", leaveId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  const [leave] = await mapSupabaseLeaves(
    data ? [((data as unknown) as SupabaseLeaveRow)] : [],
  );
  return leave && canViewLeave(user, leave) ? leave : null;
}

async function nextSupabaseLeaveNumber() {
  const { data, error } = await leaveClient()
    .from("leave_applications")
    .select("leave_number")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) {
    throw new Error(error.message);
  }
  const next =
    (((data as unknown) as Array<{ leave_number: string }> | null) ?? [])
      .map((row) => Number(row.leave_number.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `LV-2026-${String(next).padStart(4, "0")}-${crypto.randomUUID()
    .slice(0, 4)
    .toUpperCase()}`;
}

async function insertSupabaseHistory(
  leaveId: string,
  actor: AppUser,
  decision: LeaveApprovalHistoryItem["decision"],
  comments?: string,
) {
  const { error } = await leaveClient().from("leave_approval_history").insert({
    leave_id: leaveId,
    actor_id: actor.id,
    actor_role: actor.role,
    decision,
    comments: comments ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export const leaveService = {
  listLeaveTypes() {
    return readLeaveTypes().filter((type) => type.status === "active");
  },

  listHolidays() {
    return [...readHolidays()].sort((left, right) => left.date.localeCompare(right.date));
  },

  async loadLeaveTypes() {
    if (!shouldUseSupabaseLeave()) {
      return this.listLeaveTypes();
    }
    const { data, error } = await leaveClient()
      .from("leave_types")
      .select("id,code,name,annual_allowance,carry_forward,requires_document,status")
      .order("code");
    if (error) throw new Error(error.message);
    const types = (((data as unknown) as SupabaseLeaveTypeRow[] | null) ?? []).map(
      (row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        annualAllowance: toNumber(row.annual_allowance),
        carryForward: row.carry_forward,
        requiresDocument: row.requires_document,
        status: row.status,
      }),
    );
    writeLeaveTypes(types);
    return types.filter((type) => type.status === "active");
  },

  async loadHolidays() {
    if (!shouldUseSupabaseLeave()) {
      return this.listHolidays();
    }
    const { data, error } = await leaveClient()
      .from("holidays")
      .select("id,name,date,location,holiday_type,status")
      .eq("status", "active")
      .order("date");
    if (error) throw new Error(error.message);
    const holidays = (((data as unknown) as SupabaseHolidayRow[] | null) ?? []).map(
      (row) => ({
        id: row.id,
        name: row.name,
        date: row.date,
        location: row.location,
        type: row.holiday_type,
      }),
    );
    writeHolidays(holidays);
    return holidays;
  },

  async saveLeaveType(input: LeaveType, actor: AppUser) {
    if (!canManagePolicy(actor)) {
      throw new Error("Only Admin / HR or Super Admin can manage leave policy.");
    }
    const types = readLeaveTypes();
    const normalized: LeaveType = {
      ...input,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      annualAllowance: Number(input.annualAllowance),
    };
    if (!normalized.code || !normalized.name || normalized.annualAllowance < 0) {
      throw new Error("Leave code, name and non-negative annual allowance are required.");
    }
    if (shouldUseSupabaseLeave()) {
      const { data, error } = await leaveClient()
        .from("leave_types")
        .upsert({
          id: normalized.id,
          code: normalized.code,
          name: normalized.name,
          annual_allowance: normalized.annualAllowance,
          carry_forward: normalized.carryForward,
          requires_document: normalized.requiresDocument,
          status: normalized.status,
          updated_by: actor.id,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      normalized.id = ((data as unknown) as { id: string }).id;
    }
    const next = types.some((type) => type.id === normalized.id)
      ? types.map((type) => (type.id === normalized.id ? normalized : type))
      : [normalized, ...types];
    writeLeaveTypes(next);
    return normalized;
  },

  async saveHoliday(input: Holiday, actor: AppUser) {
    if (!canManagePolicy(actor)) {
      throw new Error("Only Admin / HR or Super Admin can manage holidays.");
    }
    const normalized: Holiday = {
      ...input,
      name: input.name.trim(),
      location: input.location.trim() || "India",
    };
    if (!normalized.name || !normalized.date) {
      throw new Error("Holiday name and date are required.");
    }
    if (shouldUseSupabaseLeave()) {
      const { data, error } = await leaveClient()
        .from("holidays")
        .upsert({
          id: normalized.id,
          name: normalized.name,
          date: normalized.date,
          location: normalized.location,
          holiday_type: normalized.type,
          status: "active",
          updated_by: actor.id,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      normalized.id = ((data as unknown) as { id: string }).id;
    }
    const holidays = readHolidays();
    const next = holidays.some((holiday) => holiday.id === normalized.id)
      ? holidays.map((holiday) => (holiday.id === normalized.id ? normalized : holiday))
      : [normalized, ...holidays];
    writeHolidays(next);
    return normalized;
  },

  calculateLeaveDays,

  async listLeaves(user: AppUser, filters?: LeaveFilters) {
    if (shouldUseSupabaseLeave()) {
      let query = leaveClient()
        .from("leave_applications")
        .select("*")
        .is("deleted_at", null)
        .order("applied_at", { ascending: false });
      if (filters?.userId) {
        query = query.eq("user_id", filters.userId);
      }
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.fromDate) {
        query = query.gte("to_date", filters.fromDate);
      }
      if (filters?.toDate) {
        query = query.lte("from_date", filters.toDate);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      return mapSupabaseLeaves(
        ((data as unknown) as SupabaseLeaveRow[] | null) ?? [],
      );
    }

    const visible = readLeaves().filter((leave) => canViewLeave(user, leave));
    return applyFilters(visible, filters).sort((left, right) =>
      right.appliedAt.localeCompare(left.appliedAt),
    );
  },

  async getLeave(leaveId: string, user: AppUser) {
    if (shouldUseSupabaseLeave()) {
      return getSupabaseLeave(leaveId, user);
    }

    const leave = readLeaves().find((application) => application.id === leaveId);
    return leave && canViewLeave(user, leave) ? leave : null;
  },

  async listApprovalQueue(user: AppUser) {
    if (!canApproveLeaves(user)) {
      return [];
    }
    const leaves = await this.listLeaves(user);
    return leaves.filter((leave) => leave.status === "pending");
  },

  async listHistory(leaveId: string) {
    if (shouldUseSupabaseLeave()) {
      const { data, error } = await leaveClient()
        .from("leave_approval_history")
        .select("*")
        .eq("leave_id", leaveId)
        .order("created_at", { ascending: true });
      if (error) {
        throw new Error(error.message);
      }
      const rows =
        ((data as unknown) as SupabaseLeaveHistoryRow[] | null) ?? [];
      const actors = await fetchProfiles(rows.map((row) => row.actor_id));
      return rows.map((row) => ({
        id: row.id,
        leaveId: row.leave_id,
        actorId: row.actor_id,
        actorName: actors.get(row.actor_id)?.full_name ?? "Approver",
        actorRole: row.actor_role,
        decision: row.decision,
        comments: row.comments ?? undefined,
        createdAt: row.created_at,
      }));
    }

    return readHistory()
      .filter((item) => item.leaveId === leaveId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  },

  async getBalances(user: AppUser): Promise<LeaveBalance[]> {
    const leaves = shouldUseSupabaseLeave()
      ? await this.listLeaves(user, { userId: user.id })
      : readLeaves().filter((leave) => leave.userId === user.id);
    return this.listLeaveTypes().map((type) => {
      const approved = leaves
        .filter(
          (leave) =>
            leave.leaveTypeId === type.id && leave.status === "approved",
        )
        .reduce((sum, leave) => sum + leave.numberOfDays, 0);
      const pending = leaves
        .filter((leave) => leave.leaveTypeId === type.id && leave.status === "pending")
        .reduce((sum, leave) => sum + leave.numberOfDays, 0);
      return {
        userId: user.id,
        leaveTypeId: type.id,
        leaveTypeName: type.name,
        annualAllowance: type.annualAllowance,
        used: approved,
        pending,
        available: Math.max(type.annualAllowance - approved - pending, 0),
      };
    });
  },

  async listRegisterUsers(actor: AppUser) {
    const users = await userHierarchyService.listUsers(actor.organizationId);
    if (actor.role === "site_staff" || actor.role === "accounts_officer") {
      return users.filter((user) => user.id === actor.id);
    }
    if (actor.role === "manager") {
      return users.filter(
        (user) =>
          user.id === actor.id || user.reportingManagerId === actor.id,
      );
    }
    if (actor.role === "hod") {
      return users.filter(
        (user) =>
          user.id === actor.id ||
          (actor.departmentId && user.departmentId === actor.departmentId),
      );
    }
    return users;
  },

  async getLeaveRegister(actor: AppUser, filters?: LeaveFilters) {
    const users = await this.listRegisterUsers(actor);
    const visibleUserIds = new Set(users.map((user) => user.id));
    const applications = (await this.listLeaves(actor, filters)).filter(
      (leave) => visibleUserIds.has(leave.userId),
    );
    const balances = (
      await Promise.all(
        users.map(async (user) => ({
          user,
          balances: await this.getBalances(user),
        })),
      )
    ).flatMap(({ user, balances: userBalances }) =>
      userBalances.map((balance) => ({
        ...balance,
        employeeCode: user.employeeCode ?? user.employeeId,
        employeeName: user.fullName,
        department: user.department ?? "",
        designation: user.designationId ?? "",
        openingBalance: balance.annualAllowance,
        carryForward: this.listLeaveTypes().find(
          (type) => type.id === balance.leaveTypeId,
        )?.carryForward
          ? balance.available
          : 0,
      })),
    );
    return { users, applications, balances };
  },

  async applyLeave(input: LeaveInput, user: AppUser) {
    const leaveType = getLeaveType(input.leaveTypeId);
    const leaves = shouldUseSupabaseLeave()
      ? await this.listLeaves(user, { userId: user.id })
      : readLeaves();
    const numberOfDays = calculateLeaveDays(input.fromDate, input.toDate);

    if (numberOfDays <= 0) {
      throw new Error("Leave range has no working days.");
    }
    if (hasOverlap(leaves, user.id, input.fromDate, input.toDate)) {
      throw new Error("Leave dates overlap with an existing application.");
    }

    const balances = await this.getBalances(user);
    const balance = balances.find((item) => item.leaveTypeId === input.leaveTypeId);
    if (!balance || balance.available < numberOfDays) {
      throw new Error("Insufficient leave balance.");
    }
    if (leaveType.requiresDocument && input.attachments.length === 0) {
      throw new Error("This leave type requires a supporting document.");
    }

    const createdAt = now();
    const organizationId = user.organizationId ?? DEMO_ORGANIZATION_ID;
    const approvalPath = await approvalMatrixService
      .resolveApprovalPath({
        organizationId,
        workflowType: "leave",
        requesterUserId: user.id,
        departmentId: user.departmentId,
        leaveDays: numberOfDays,
      })
      .then((result) => result.steps)
      .catch(() => []);

    if (shouldUseSupabaseLeave()) {
      const leaveNumber = await nextSupabaseLeaveNumber();
      const leaveTypeId = await dbLeaveTypeId(input.leaveTypeId);
      const { data, error } = await leaveClient()
        .from("leave_applications")
        .insert({
          leave_number: leaveNumber,
          user_id: user.id,
          organization_id: organizationId,
          department_id: user.departmentId ?? null,
          requester_user_id: user.id,
          reporting_manager_id: user.reportingManagerId ?? user.managerId ?? null,
          hod_user_id: user.hodUserId ?? null,
          manager_id: user.reportingManagerId ?? user.managerId ?? null,
          leave_type_id: leaveTypeId,
          from_date: input.fromDate,
          to_date: input.toDate,
          number_of_days: numberOfDays,
          reason: input.reason,
          status: "pending",
          approval_path: approvalPath,
          applied_at: createdAt,
          created_by: user.id,
          updated_by: user.id,
        })
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const leaveRow = (data as unknown) as SupabaseLeaveRow;
      if (input.attachments.length > 0) {
        const { error: attachmentError } = await leaveClient()
          .from("leave_attachments")
          .insert(
            input.attachments.map((attachment) => ({
              leave_id: leaveRow.id,
              file_url: attachment.url,
              file_name: attachment.fileName,
              file_type: attachment.fileType,
              file_size: attachment.fileSize,
              uploaded_by: user.id,
            })),
          );
        if (attachmentError) {
          throw new Error(attachmentError.message);
        }
      }
      await insertSupabaseHistory(leaveRow.id, user, "submitted", input.reason);
      const application = await getSupabaseLeave(leaveRow.id, user);
      if (!application) {
        throw new Error("Leave was saved but could not be loaded.");
      }
      await recordAuditLog({
        userId: user.id,
        action: "leave.applied",
        entityType: "leave_application",
        entityId: application.id,
        newValues: { ...application },
      });
      return application;
    }

    const application: LeaveApplication = {
      id: crypto.randomUUID(),
      organizationId,
      departmentId: user.departmentId,
      requesterUserId: user.id,
      reportingManagerId: user.reportingManagerId ?? user.managerId,
      hodUserId: user.hodUserId,
      leaveNumber: nextLeaveNumber(leaves),
      userId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      managerId: user.managerId,
      leaveTypeId: leaveType.id,
      leaveTypeName: leaveType.name,
      fromDate: input.fromDate,
      toDate: input.toDate,
      numberOfDays,
      reason: input.reason,
      status: "pending",
      attachments: input.attachments,
      approvalPath,
      appliedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };
    writeLeaves([application, ...leaves]);
    writeHistory([makeHistory(application.id, user, "submitted", input.reason), ...readHistory()]);
    await recordAuditLog({
      userId: user.id,
      action: "leave.applied",
      entityType: "leave_application",
      entityId: application.id,
      newValues: { ...application },
    });
    return application;
  },

  async grantCompOffForAttendance({
    beneficiary,
    actor,
    attendanceDate,
    sourceAttendanceId,
    reason,
  }: {
    beneficiary: AppUser;
    actor: AppUser;
    attendanceDate: string;
    sourceAttendanceId: string;
    reason: string;
  }) {
    const compOffType = getLeaveType("comp_off");
    const existingLeaves = shouldUseSupabaseLeave()
      ? await this.listLeaves(actor, { userId: beneficiary.id })
      : readLeaves().filter((leave) => leave.userId === beneficiary.id);
    const existing = existingLeaves.find(
      (leave) =>
        leave.leaveTypeId === compOffType.id &&
        leave.fromDate === attendanceDate &&
        leave.toDate === attendanceDate &&
        leave.status === "approved",
    );
    if (existing) {
      return existing;
    }

    const createdAt = now();
    const organizationId =
      beneficiary.organizationId ?? actor.organizationId ?? DEMO_ORGANIZATION_ID;

    if (shouldUseSupabaseLeave()) {
      const leaveNumber = await nextSupabaseLeaveNumber();
      const leaveTypeId = await dbLeaveTypeId(compOffType.id);
      const { data, error } = await leaveClient()
        .from("leave_applications")
        .insert({
          leave_number: leaveNumber,
          user_id: beneficiary.id,
          organization_id: organizationId,
          department_id: beneficiary.departmentId ?? actor.departmentId ?? null,
          requester_user_id: beneficiary.id,
          reporting_manager_id:
            beneficiary.reportingManagerId ?? beneficiary.managerId ?? null,
          hod_user_id: beneficiary.hodUserId ?? null,
          manager_id: beneficiary.reportingManagerId ?? beneficiary.managerId ?? null,
          leave_type_id: leaveTypeId,
          from_date: attendanceDate,
          to_date: attendanceDate,
          number_of_days: 1,
          reason,
          status: "approved",
          applied_at: createdAt,
          approved_by: actor.id,
          approval_date: createdAt,
          comments: `Generated from attendance ${sourceAttendanceId}.`,
          created_by: actor.id,
          updated_by: actor.id,
        })
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      await insertSupabaseHistory(
        ((data as unknown) as SupabaseLeaveRow).id,
        actor,
        "approved",
        reason,
      );
      const application = await getSupabaseLeave(
        ((data as unknown) as SupabaseLeaveRow).id,
        actor,
      );
      if (!application) {
        throw new Error("Comp-off leave was saved but could not be loaded.");
      }
      await recordAuditLog({
        userId: actor.id,
        action: "leave.comp_off_generated",
        entityType: "leave_application",
        entityId: application.id,
        newValues: { ...application, sourceAttendanceId },
      });
      return application;
    }

    const application: LeaveApplication = {
      id: crypto.randomUUID(),
      organizationId,
      departmentId: beneficiary.departmentId,
      requesterUserId: beneficiary.id,
      reportingManagerId: beneficiary.reportingManagerId ?? beneficiary.managerId,
      hodUserId: beneficiary.hodUserId,
      leaveNumber: nextLeaveNumber(readLeaves()),
      userId: beneficiary.id,
      userName: beneficiary.fullName,
      userEmail: beneficiary.email,
      managerId: beneficiary.managerId,
      leaveTypeId: compOffType.id,
      leaveTypeName: compOffType.name,
      fromDate: attendanceDate,
      toDate: attendanceDate,
      numberOfDays: 1,
      reason,
      status: "approved",
      attachments: [],
      appliedAt: createdAt,
      approvedBy: actor.id,
      approvedByName: actor.fullName,
      approvalDate: createdAt,
      comments: `Generated from attendance ${sourceAttendanceId}.`,
      createdAt,
      updatedAt: createdAt,
    };
    writeLeaves([application, ...readLeaves()]);
    writeHistory([
      makeHistory(application.id, actor, "approved", reason),
      ...readHistory(),
    ]);
    await recordAuditLog({
      userId: actor.id,
      action: "leave.comp_off_generated",
      entityType: "leave_application",
      entityId: application.id,
      newValues: { ...application, sourceAttendanceId },
    });
    return application;
  },

  async decideLeave(input: LeaveApprovalInput, actor: AppUser) {
    if (!canApproveLeaves(actor)) {
      throw new Error("You do not have permission to approve leave.");
    }
    const leaves = shouldUseSupabaseLeave() ? [] : readLeaves();
    const leave = shouldUseSupabaseLeave()
      ? await getSupabaseLeave(input.leaveId, actor)
      : leaves.find((application) => application.id === input.leaveId);
    if (!leave) {
      throw new Error("Leave application not found.");
    }
    if (leave.status !== "pending") {
      throw new Error("Only pending leave can be decided.");
    }

    if (shouldUseSupabaseLeave()) {
      const approvalDate = now();
      const { error } = await leaveClient()
        .from("leave_applications")
        .update({
          status: input.decision,
          approved_by: actor.id,
          approval_date: approvalDate,
          rejection_reason:
            input.decision === "rejected" ? input.comments : null,
          comments: input.comments,
          updated_by: actor.id,
        })
        .eq("id", leave.id);
      if (error) {
        throw new Error(error.message);
      }
      await insertSupabaseHistory(
        leave.id,
        actor,
        input.decision,
        input.comments,
      );
      const updated = await getSupabaseLeave(leave.id, actor);
      if (!updated) {
        throw new Error("Leave was updated but could not be loaded.");
      }
      await recordAuditLog({
        userId: actor.id,
        action: `leave.${input.decision}`,
        entityType: "leave_application",
        entityId: leave.id,
        oldValues: { status: leave.status },
        newValues: { status: updated.status, comments: input.comments },
      });
      return updated;
    }

    const updated: LeaveApplication = {
      ...leave,
      status: input.decision,
      approvedBy: actor.id,
      approvedByName: actor.fullName,
      approvalDate: now(),
      rejectionReason: input.decision === "rejected" ? input.comments : undefined,
      comments: input.comments,
      updatedAt: now(),
    };
    writeLeaves(leaves.map((item) => (item.id === leave.id ? updated : item)));
    writeHistory([
      makeHistory(leave.id, actor, input.decision, input.comments),
      ...readHistory(),
    ]);
    await recordAuditLog({
      userId: actor.id,
      action: `leave.${input.decision}`,
      entityType: "leave_application",
      entityId: leave.id,
      oldValues: { status: leave.status },
      newValues: { status: updated.status, comments: input.comments },
    });
    return updated;
  },

  canManagePolicy,

  resetDemoData() {
    writeLeaves(seedLeaves());
    writeHistory(seedHistory());
    writeLeaveTypes(LEAVE_TYPES);
    writeHolidays(HOLIDAYS);
  },
};

export type { LeaveAttachment };
