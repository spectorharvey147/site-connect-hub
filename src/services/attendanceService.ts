import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { PROJECT_OPTIONS } from "@/constants/claims";
import {
  ATTENDANCE_STATUS_LABELS,
  SHIFTS,
} from "@/constants/attendance";
import { recordAuditLog } from "@/services/auditService";
import { leaveService } from "@/services/leaveService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import { userHierarchyService } from "@/services/userHierarchyService";
import type { AppUser } from "@/types/auth";
import type {
  AttendanceDashboard,
  AttendanceFilters,
  AttendanceRecord,
  AttendanceStatus,
  GeoLocationPoint,
  ManualAttendanceInput,
} from "@/types/attendance";

const ATTENDANCE_STORAGE_KEY = "site-connect:attendance";

let memoryAttendance: AttendanceRecord[] | null = null;

type SupabaseClient = NonNullable<typeof supabase>;

interface SupabaseProfileRow {
  id: string;
  full_name: string | null;
  employee_id: string | null;
  employee_code: string | null;
}

interface SupabaseProjectRow {
  id: string;
  code: string | null;
  name: string | null;
  location: string | null;
}

interface SupabaseShiftRow {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  half_day_hours: number | string;
  full_day_hours: number | string;
  status: ShiftStatus;
}

type ShiftStatus = "active" | "inactive";

interface SupabaseAttendanceRow {
  id: string;
  user_id: string;
  project_id: string | null;
  shift_id: string | null;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: AttendanceStatus;
  location_lat: number | string | null;
  location_lon: number | string | null;
  location_accuracy: number | null;
  checkout_location_lat: number | string | null;
  checkout_location_lon: number | string | null;
  checkout_location_accuracy: number | null;
  worked_hours: number | string;
  remarks: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function now() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getTimeValue(date: string, time: string) {
  return new Date(`${date}T${time}:00`).getTime();
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

function getShift(shiftId: string) {
  return SHIFTS.find((shift) => shift.id === shiftId) ?? SHIFTS[0];
}

function shouldUseSupabaseAttendance() {
  return isSupabaseConfigured && Boolean(supabase);
}

function attendanceClient(): SupabaseClient {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function isUuid(value: string | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function cleanTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : undefined;
}

function localProjectId(project: SupabaseProjectRow | undefined, fallback?: string | null) {
  if (!project) {
    return fallback ?? "";
  }
  return project.id;
}

function localShiftId(shift: SupabaseShiftRow | undefined, fallback?: string | null) {
  if (!shift) {
    return fallback ?? "shift-general";
  }
  return SHIFTS.find((option) => option.name === shift.name)?.id ?? shift.id;
}

async function dbProjectId(projectId: string | undefined) {
  if (!projectId || isUuid(projectId)) {
    return projectId ?? null;
  }
  throw new Error("Production project selections must use database project IDs.");
}

async function dbShiftId(shiftId: string | undefined) {
  if (!shiftId || isUuid(shiftId)) {
    return shiftId ?? null;
  }
  const shift = SHIFTS.find((option) => option.id === shiftId);
  if (!shift) {
    return null;
  }
  const { data, error } = await attendanceClient()
    .from("shifts")
    .select("id")
    .eq("name", shift.name)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return ((data as unknown) as { id: string } | null)?.id ?? null;
}

function calculateWorkedHours(date: string, checkIn?: string, checkOut?: string) {
  if (!checkIn || !checkOut) {
    return 0;
  }

  const checkInValue = getTimeValue(date, checkIn);
  let checkOutValue = getTimeValue(date, checkOut);
  if (checkOutValue < checkInValue) {
    checkOutValue += 24 * 60 * 60 * 1000;
  }

  return Math.max((checkOutValue - checkInValue) / (1000 * 60 * 60), 0);
}

function calculateStatus(
  date: string,
  shiftId: string,
  checkIn?: string,
  checkOut?: string,
): AttendanceStatus {
  const shift = getShift(shiftId);
  if (!checkIn) {
    return "absent";
  }

  const shiftStart = getTimeValue(date, shift.startTime);
  const checkInValue = getTimeValue(date, checkIn);
  const lateAfter = shiftStart + shift.graceMinutes * 60 * 1000;
  const workedHours = calculateWorkedHours(date, checkIn, checkOut);

  if (checkOut && workedHours < shift.halfDayHours) {
    return "half_day";
  }

  return checkInValue > lateAfter ? "late" : "present";
}

function shouldGenerateCompOff(status: AttendanceStatus) {
  return status === "holiday_present" || status === "week_off_present";
}

function seedAttendance(): AttendanceRecord[] {
  const users = DEMO_USERS.map(toAppUser);
  const siteUser = users.find((user) => user.email === "site@siteconnect.local");
  const secondUser = users.find((user) => user.email === "ishita@siteconnect.local");
  const manager = users.find((user) => user.email === "manager@siteconnect.local");
  if (!siteUser || !secondUser || !manager) {
    return [];
  }

  const baseDate = new Date();
  const records: AttendanceRecord[] = [];
  const siteDates = [0, -1, -2, -3, -4, -5, -6];

  siteDates.forEach((offset, index) => {
    const date = addDays(baseDate, offset).toISOString().slice(0, 10);
    const checkIn = index === 2 ? "09:28" : "09:04";
    const checkOut = offset === 0 ? undefined : "18:10";
    records.push({
      id: `att-site-${index}`,
      userId: siteUser.id,
      userName: siteUser.fullName,
      employeeId: siteUser.employeeId,
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      shiftId: "shift-general",
      shiftName: "General Shift",
      date,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      status: calculateStatus(date, "shift-general", checkIn, checkOut),
      workedHours: calculateWorkedHours(date, checkIn, checkOut),
      location: {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 28,
        capturedAt: `${date}T${checkIn}:00.000Z`,
      },
      remarks: index === 2 ? "Traffic delay noted." : undefined,
      createdAt: `${date}T${checkIn}:00.000Z`,
      updatedAt: `${date}T${checkIn}:00.000Z`,
    });
  });

  records.push({
    id: "att-ishita-1",
    userId: secondUser.id,
    userName: secondUser.fullName,
    employeeId: secondUser.employeeId,
    projectId: "project-tower",
    projectName: getProjectName("project-tower"),
    shiftId: "shift-general",
    shiftName: "General Shift",
    date: today(),
    checkInTime: "09:12",
    status: "present",
    workedHours: 0,
    location: {
      latitude: 17.385,
      longitude: 78.4867,
      accuracy: 35,
      capturedAt: now(),
    },
    createdAt: now(),
    updatedAt: now(),
  });

  records.push({
    id: "att-manager-1",
    userId: manager.id,
    userName: manager.fullName,
    employeeId: manager.employeeId,
    projectId: "project-metro",
    projectName: getProjectName("project-metro"),
    shiftId: "shift-general",
    shiftName: "General Shift",
    date: today(),
    checkInTime: "08:52",
    status: "present",
    workedHours: 0,
    location: {
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 20,
      capturedAt: now(),
    },
    createdAt: now(),
    updatedAt: now(),
  });

  return records;
}

function readAttendance() {
  if (!isBrowser()) {
    memoryAttendance = memoryAttendance ?? seedAttendance();
    return memoryAttendance;
  }

  const stored = window.localStorage.getItem(ATTENDANCE_STORAGE_KEY);
  if (!stored) {
    const seeded = seedAttendance();
    window.localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    return JSON.parse(stored) as AttendanceRecord[];
  } catch {
    const seeded = seedAttendance();
    window.localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeAttendance(records: AttendanceRecord[]) {
  memoryAttendance = records;
  if (isBrowser()) {
    window.localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(records));
  }
}

function canSeeAllAttendance(user: AppUser) {
  return ["manager", "hod", "admin_hr", "super_admin"].includes(user.role);
}

function canEditAttendanceTarget(actor: AppUser, target: AppUser) {
  if (actor.id === target.id) return true;
  if (["admin_hr", "super_admin"].includes(actor.role)) return true;
  if (actor.role === "manager") {
    return target.reportingManagerId === actor.id || target.managerId === actor.id;
  }
  if (actor.role === "hod") {
    return Boolean(actor.departmentId && target.departmentId === actor.departmentId);
  }
  return false;
}

function canSeeRecord(user: AppUser, record: AttendanceRecord) {
  if (record.userId === user.id) {
    return true;
  }
  if (user.role === "manager") {
    return user.projectIds.includes(record.projectId);
  }
  if (user.role === "hod") {
    return user.projectIds.includes(record.projectId);
  }
  return ["admin_hr", "super_admin"].includes(user.role);
}

function applyFilters(records: AttendanceRecord[], filters?: AttendanceFilters) {
  return records.filter((record) => {
    if (filters?.userId && record.userId !== filters.userId) {
      return false;
    }
    if (filters?.projectId && record.projectId !== filters.projectId) {
      return false;
    }
    if (filters?.status && filters.status !== "all" && record.status !== filters.status) {
      return false;
    }
    if (filters?.fromDate && record.date < filters.fromDate) {
      return false;
    }
    if (filters?.toDate && record.date > filters.toDate) {
      return false;
    }
    return true;
  });
}

function summarize(records: AttendanceRecord[]) {
  const totalHours = records.reduce((sum, record) => sum + record.workedHours, 0);
  return {
    totalDays: records.length,
    presentDays: records.filter((record) => record.status === "present").length,
    absentDays: records.filter((record) => record.status === "absent").length,
    lateDays: records.filter((record) => record.status === "late").length,
    halfDays: records.filter((record) => record.status === "half_day").length,
    leaveDays: records.filter((record) => record.status === "on_leave").length,
    averageHours: records.length > 0 ? totalHours / records.length : 0,
  };
}

function userById(userId: string) {
  return DEMO_USERS.map(toAppUser).find((user) => user.id === userId);
}

async function fetchProfiles(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return new Map<string, SupabaseProfileRow>();
  }
  const { data, error } = await attendanceClient()
    .from("user_profiles")
    .select("id, full_name, employee_id, employee_code")
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

async function fetchProjects(ids: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (uniqueIds.length === 0) {
    return new Map<string, SupabaseProjectRow>();
  }
  const { data, error } = await attendanceClient()
    .from("projects")
    .select("id, code, name, location")
    .in("id", uniqueIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map(
    (((data as unknown) as SupabaseProjectRow[] | null) ?? []).map((project) => [
      project.id,
      project,
    ]),
  );
}

async function fetchShifts(ids: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (uniqueIds.length === 0) {
    return new Map<string, SupabaseShiftRow>();
  }
  const { data, error } = await attendanceClient()
    .from("shifts")
    .select(
      "id, name, start_time, end_time, grace_minutes, half_day_hours, full_day_hours, status",
    )
    .in("id", uniqueIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map(
    (((data as unknown) as SupabaseShiftRow[] | null) ?? []).map((shift) => [
      shift.id,
      shift,
    ]),
  );
}

function locationPointFromRow(
  latitude: number | string | null,
  longitude: number | string | null,
  accuracy: number | null,
  capturedAt: string,
) {
  if (latitude === null || longitude === null) {
    return undefined;
  }
  return {
    latitude: toNumber(latitude),
    longitude: toNumber(longitude),
    accuracy: accuracy ?? 0,
    capturedAt,
  };
}

async function mapSupabaseAttendance(
  rows: SupabaseAttendanceRow[],
): Promise<AttendanceRecord[]> {
  if (rows.length === 0) {
    return [];
  }
  const [profiles, projects, shifts, approvers] = await Promise.all([
    fetchProfiles(rows.map((row) => row.user_id)),
    fetchProjects(rows.map((row) => row.project_id)),
    fetchShifts(rows.map((row) => row.shift_id)),
    fetchProfiles(
      rows.map((row) => row.approved_by).filter((id): id is string => Boolean(id)),
    ),
  ]);

  return rows.map((row) => {
    const profile = profiles.get(row.user_id);
    const project = row.project_id ? projects.get(row.project_id) : undefined;
    const shift = row.shift_id ? shifts.get(row.shift_id) : undefined;
    const projectId = localProjectId(project, row.project_id);
    const shiftId = localShiftId(shift, row.shift_id);
    const checkInTime = cleanTime(row.check_in_time);
    const checkOutTime = cleanTime(row.check_out_time);
    return {
      id: row.id,
      userId: row.user_id,
      userName: profile?.full_name ?? "User",
      employeeId: profile?.employee_code ?? profile?.employee_id ?? "",
      projectId,
      projectName: project?.name ?? getProjectName(projectId),
      shiftId,
      shiftName: shift?.name ?? getShift(shiftId).name,
      date: row.date,
      checkInTime,
      checkOutTime,
      status: row.status,
      location: locationPointFromRow(
        row.location_lat,
        row.location_lon,
        row.location_accuracy,
        row.created_at,
      ),
      checkoutLocation: locationPointFromRow(
        row.checkout_location_lat,
        row.checkout_location_lon,
        row.checkout_location_accuracy,
        row.updated_at,
      ),
      workedHours: toNumber(row.worked_hours),
      remarks: row.remarks ?? undefined,
      approvedBy: row.approved_by ?? undefined,
      approvedByName: row.approved_by
        ? approvers.get(row.approved_by)?.full_name ?? undefined
        : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export const attendanceService = {
  listShifts() {
    return SHIFTS.filter((shift) => shift.status === "active");
  },

  async listUsers(user: AppUser) {
    if (shouldUseSupabaseAttendance()) {
      const users = await userHierarchyService.listUsers(user.organizationId);
      if (canSeeAllAttendance(user)) {
        return users;
      }
      return users.filter((item) => item.id === user.id);
    }

    const users = DEMO_USERS.map(toAppUser);
    if (canSeeAllAttendance(user)) {
      return users;
    }
    return users.filter((item) => item.id === user.id);
  },

  async listAttendance(user: AppUser, filters?: AttendanceFilters) {
    if (shouldUseSupabaseAttendance()) {
      let query = attendanceClient()
        .from("attendance")
        .select("*")
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters?.userId) {
        query = query.eq("user_id", filters.userId);
      }
      if (filters?.projectId) {
        const projectId = await dbProjectId(filters.projectId);
        if (projectId) {
          query = query.eq("project_id", projectId);
        }
      }
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.fromDate) {
        query = query.gte("date", filters.fromDate);
      }
      if (filters?.toDate) {
        query = query.lte("date", filters.toDate);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      return mapSupabaseAttendance(
        ((data as unknown) as SupabaseAttendanceRow[] | null) ?? [],
      );
    }

    const visible = readAttendance().filter((record) => canSeeRecord(user, record));
    return applyFilters(visible, filters).sort((left, right) =>
      right.date.localeCompare(left.date),
    );
  },

  async getTodayAttendance(user: AppUser) {
    if (shouldUseSupabaseAttendance()) {
      const { data, error } = await attendanceClient()
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today())
        .is("deleted_at", null)
        .maybeSingle();
      if (error) {
        throw new Error(error.message);
      }
      const [record] = await mapSupabaseAttendance(
        data ? [((data as unknown) as SupabaseAttendanceRow)] : [],
      );
      return record;
    }

    return readAttendance().find(
      (record) => record.userId === user.id && record.date === today(),
    );
  },

  async getDashboard(user: AppUser): Promise<AttendanceDashboard> {
    const monthStart = today().slice(0, 8) + "01";
    const records = await this.listAttendance(user, {
      fromDate: monthStart,
      toDate: today(),
    });
    return {
      today: await this.getTodayAttendance(user),
      summary: summarize(records),
      recent: records.slice(0, 6),
    };
  },

  async checkIn(
    user: AppUser,
    location?: GeoLocationPoint,
    selectedProjectId?: string,
  ) {
    if (shouldUseSupabaseAttendance()) {
      const existing = await this.getTodayAttendance(user);
      if (existing?.checkInTime) {
        throw new Error("Attendance already checked in for today.");
      }

      const projectId = await dbProjectId(
        selectedProjectId ?? user.primaryProjectId ?? user.projectIds[0],
      );
      const { data, error } = await attendanceClient().rpc("attendance_punch", {
        p_action: "check_in",
        p_project_id: projectId,
        p_latitude: location?.latitude ?? null,
        p_longitude: location?.longitude ?? null,
        p_accuracy: location?.accuracy ?? null,
      });
      if (error) {
        throw new Error(error.message);
      }
      const [record] = await mapSupabaseAttendance([
        ((data as unknown) as SupabaseAttendanceRow),
      ]);
      await recordAuditLog({
        userId: user.id,
        action: "attendance.check_in",
        entityType: "attendance",
        entityId: record.id,
        newValues: {
          status: record.status,
          checkInTime: record.checkInTime,
          location,
          timestampSource: "database",
        },
      });
      return record;
    }

    const records = readAttendance();
    const existing = records.find(
      (record) => record.userId === user.id && record.date === today(),
    );
    if (existing?.checkInTime) {
      throw new Error("Attendance already checked in for today.");
    }

    const projectId = selectedProjectId ?? user.projectIds[0] ?? "project-metro";
    const shift = getShift("shift-general");
    const checkInTime = new Date().toTimeString().slice(0, 5);
    const status = calculateStatus(today(), shift.id, checkInTime);
    const record: AttendanceRecord = {
      id: crypto.randomUUID(),
      userId: user.id,
      userName: user.fullName,
      employeeId: user.employeeId,
      projectId,
      projectName: getProjectName(projectId),
      shiftId: shift.id,
      shiftName: shift.name,
      date: today(),
      checkInTime,
      status,
      location,
      workedHours: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    writeAttendance([record, ...records]);
    await recordAuditLog({
      userId: user.id,
      action: "attendance.check_in",
      entityType: "attendance",
      entityId: record.id,
      newValues: { status, checkInTime, location },
    });
    return record;
  },

  async checkOut(user: AppUser, location?: GeoLocationPoint) {
    if (shouldUseSupabaseAttendance()) {
      const record = await this.getTodayAttendance(user);
      if (!record?.checkInTime) {
        throw new Error("Check in before checking out.");
      }
      if (record.checkOutTime) {
        throw new Error("Attendance already checked out for today.");
      }

      const { data, error } = await attendanceClient().rpc("attendance_punch", {
        p_action: "check_out",
        p_project_id: null,
        p_latitude: location?.latitude ?? null,
        p_longitude: location?.longitude ?? null,
        p_accuracy: location?.accuracy ?? null,
      });
      if (error) {
        throw new Error(error.message);
      }
      const [updatedRecord] = await mapSupabaseAttendance([
        ((data as unknown) as SupabaseAttendanceRow),
      ]);
      await recordAuditLog({
        userId: user.id,
        action: "attendance.check_out",
        entityType: "attendance",
        entityId: record.id,
        oldValues: { checkOutTime: record.checkOutTime },
        newValues: {
          checkOutTime: updatedRecord.checkOutTime,
          workedHours: updatedRecord.workedHours,
          location,
          timestampSource: "database",
        },
      });
      return updatedRecord;
    }

    const records = readAttendance();
    const record = records.find(
      (item) => item.userId === user.id && item.date === today(),
    );
    if (!record?.checkInTime) {
      throw new Error("Check in before checking out.");
    }
    if (record.checkOutTime) {
      throw new Error("Attendance already checked out for today.");
    }

    const checkOutTime = new Date().toTimeString().slice(0, 5);
    if (getTimeValue(record.date, checkOutTime) <= getTimeValue(record.date, record.checkInTime)) {
      throw new Error("Check-out must be after check-in.");
    }

    const workedHours = calculateWorkedHours(
      record.date,
      record.checkInTime,
      checkOutTime,
    );
    const updatedRecord: AttendanceRecord = {
      ...record,
      checkOutTime,
      checkoutLocation: location,
      workedHours,
      status: calculateStatus(
        record.date,
        record.shiftId,
        record.checkInTime,
        checkOutTime,
      ),
      updatedAt: now(),
    };

    writeAttendance(
      records.map((item) => (item.id === record.id ? updatedRecord : item)),
    );
    await recordAuditLog({
      userId: user.id,
      action: "attendance.check_out",
      entityType: "attendance",
      entityId: record.id,
      oldValues: { checkOutTime: record.checkOutTime },
      newValues: { checkOutTime, workedHours, location },
    });
    return updatedRecord;
  },

  async submitManualAttendance(input: ManualAttendanceInput, actor: AppUser) {
    if (input.date > today()) {
      throw new Error("Future attendance cannot be submitted.");
    }

    const shift = getShift(input.shiftId);
    const allowsOvernightCheckout =
      input.status === "night_shift" || getTimeValue(input.date, shift.endTime) < getTimeValue(input.date, shift.startTime);
    if (
      input.checkInTime &&
      input.checkOutTime &&
      !allowsOvernightCheckout &&
      getTimeValue(input.date, input.checkOutTime) <=
        getTimeValue(input.date, input.checkInTime)
    ) {
      throw new Error("Check-out must be after check-in.");
    }

    const targetUser = shouldUseSupabaseAttendance()
      ? await userHierarchyService.getUserById(input.userId)
      : userById(input.userId);
    const attendanceUser = targetUser ?? actor;
    if (!targetUser || !canEditAttendanceTarget(actor, attendanceUser)) {
      throw new Error("You cannot submit attendance for this user.");
    }
    const existing = shouldUseSupabaseAttendance()
      ? await this.listAttendance(actor, {
          userId: input.userId,
          fromDate: input.date,
          toDate: input.date,
        }).then((records) => records[0])
      : readAttendance().find(
          (record) => record.userId === input.userId && record.date === input.date,
        );
    const workedHours = calculateWorkedHours(
      input.date,
      input.checkInTime,
      input.checkOutTime,
    );
    const status =
      input.status === "present" || input.status === "late" || input.status === "half_day"
        ? calculateStatus(input.date, input.shiftId, input.checkInTime, input.checkOutTime)
        : input.status;

    if (shouldUseSupabaseAttendance()) {
      const projectId = await dbProjectId(input.projectId);
      const shiftId = await dbShiftId(input.shiftId);
      const payload = {
        user_id: input.userId,
        organization_id: attendanceUser.organizationId ?? actor.organizationId ?? null,
        department_id: attendanceUser.departmentId ?? actor.departmentId ?? null,
        project_id: projectId,
        reporting_manager_id:
          attendanceUser.reportingManagerId ?? attendanceUser.managerId ?? null,
        hod_user_id: attendanceUser.hodUserId ?? null,
        shift_id: shiftId,
        date: input.date,
        check_in_time: input.checkInTime || null,
        check_out_time: input.checkOutTime || null,
        status,
        worked_hours: workedHours,
        remarks: input.remarks,
        approved_by: actor.id,
        updated_by: actor.id,
      };
      const mutation = existing
        ? attendanceClient()
            .from("attendance")
            .update(payload)
            .eq("id", existing.id)
            .select("*")
            .single()
        : attendanceClient()
            .from("attendance")
            .insert({ ...payload, created_by: actor.id })
            .select("*")
            .single();
      const { data, error } = await mutation;
      if (error) {
        throw new Error(error.message);
      }
      const [record] = await mapSupabaseAttendance([
        ((data as unknown) as SupabaseAttendanceRow),
      ]);
      await recordAuditLog({
        userId: actor.id,
        action: existing ? "attendance.manual_update" : "attendance.manual_create",
        entityType: "attendance",
        entityId: record.id,
        oldValues: existing ? { ...existing } : undefined,
        newValues: { ...record },
      });
      if (shouldGenerateCompOff(status)) {
        await leaveService.grantCompOffForAttendance({
          beneficiary: attendanceUser,
          actor,
          attendanceDate: input.date,
          sourceAttendanceId: record.id,
          reason: `${ATTENDANCE_STATUS_LABELS[status]} on ${input.date}`,
        });
      }
      return record;
    }

    const record: AttendanceRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      userId: attendanceUser.id,
      userName: attendanceUser.fullName,
      employeeId: attendanceUser.employeeId,
      projectId: input.projectId,
      projectName: getProjectName(input.projectId),
      shiftId: shift.id,
      shiftName: shift.name,
      date: input.date,
      checkInTime: input.checkInTime,
      checkOutTime: input.checkOutTime,
      status,
      workedHours,
      remarks: input.remarks,
      approvedBy: actor.id,
      approvedByName: actor.fullName,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    };
    const records = readAttendance();
    writeAttendance(
      existing
        ? records.map((item) => (item.id === existing.id ? record : item))
        : [record, ...records],
    );
    await recordAuditLog({
      userId: actor.id,
      action: existing ? "attendance.manual_update" : "attendance.manual_create",
      entityType: "attendance",
      entityId: record.id,
      oldValues: existing ? { ...existing } : undefined,
      newValues: { ...record },
    });
    if (shouldGenerateCompOff(status)) {
      await leaveService.grantCompOffForAttendance({
        beneficiary: attendanceUser,
        actor,
        attendanceDate: input.date,
        sourceAttendanceId: record.id,
        reason: `${ATTENDANCE_STATUS_LABELS[status]} on ${input.date}`,
      });
    }
    return record;
  },

  async getMonthlySummary(user: AppUser, month: string) {
    const records = await this.listAttendance(user, {
      fromDate: `${month}-01`,
      toDate: `${month}-31`,
    });
    return summarize(records);
  },

  getStatusLabel(status: AttendanceStatus) {
    return ATTENDANCE_STATUS_LABELS[status];
  },

  resetDemoData() {
    writeAttendance(seedAttendance());
  },
};
