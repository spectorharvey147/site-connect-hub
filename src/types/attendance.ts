import type { AppUser } from "@/types/auth";

export type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "half_day"
  | "on_leave"
  | "holiday"
  | "work_from_home"
  | "comp_off"
  | "travelling"
  | "holiday_present"
  | "week_off_present"
  | "night_shift"
  | "missed_correction";

export interface GeoLocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  halfDayHours: number;
  fullDayHours: number;
  status: "active" | "inactive";
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  employeeId: string;
  projectId: string;
  projectName: string;
  shiftId: string;
  shiftName: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: AttendanceStatus;
  location?: GeoLocationPoint;
  checkoutLocation?: GeoLocationPoint;
  workedHours: number;
  remarks?: string;
  approvedBy?: string;
  approvedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManualAttendanceInput {
  userId: string;
  projectId: string;
  shiftId: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: AttendanceStatus;
  remarks: string;
}

export interface AttendanceFilters {
  userId?: string;
  projectId?: string;
  status?: AttendanceStatus | "all";
  fromDate?: string;
  toDate?: string;
}

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  leaveDays: number;
  averageHours: number;
}

export interface AttendanceDashboard {
  today?: AttendanceRecord;
  summary: AttendanceSummary;
  recent: AttendanceRecord[];
}

export interface AttendanceActionContext {
  user: AppUser;
  record?: AttendanceRecord;
}
