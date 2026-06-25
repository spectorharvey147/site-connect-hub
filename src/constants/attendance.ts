import type { AttendanceStatus, Shift } from "@/types/attendance";

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
  on_leave: "On Leave",
  holiday: "Holiday",
  work_from_home: "Work From Home",
  comp_off: "Comp Off",
  travelling: "Travelling",
  holiday_present: "Holiday Present",
  week_off_present: "Week Off Present",
  night_shift: "Night Shift",
  missed_correction: "Missed Attendance Correction",
};

export const ATTENDANCE_STATUS_TONES: Record<
  AttendanceStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  present: "success",
  absent: "danger",
  late: "warning",
  half_day: "warning",
  on_leave: "info",
  holiday: "neutral",
  work_from_home: "info",
  comp_off: "neutral",
  travelling: "info",
  holiday_present: "success",
  week_off_present: "success",
  night_shift: "info",
  missed_correction: "warning",
};

export const SHIFTS: Shift[] = [
  {
    id: "shift-general",
    name: "General Shift",
    startTime: "09:00",
    endTime: "18:00",
    graceMinutes: 15,
    halfDayHours: 4,
    fullDayHours: 8,
    status: "active",
  },
  {
    id: "shift-early",
    name: "Early Site Shift",
    startTime: "07:00",
    endTime: "16:00",
    graceMinutes: 10,
    halfDayHours: 4,
    fullDayHours: 8,
    status: "active",
  },
  {
    id: "shift-night",
    name: "Night Shift",
    startTime: "20:00",
    endTime: "05:00",
    graceMinutes: 15,
    halfDayHours: 4,
    fullDayHours: 8,
    status: "active",
  },
];
