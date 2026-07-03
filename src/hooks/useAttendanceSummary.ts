import { useMemo } from "react";

import type { AttendanceRecord } from "@/types/attendance";

export function summarizeAttendance(records: AttendanceRecord[]) {
  const present = records.filter((record) => ["present", "late", "work_from_home", "travelling", "holiday_present", "week_off_present", "night_shift"].includes(record.status)).length;
  const absent = records.filter((record) => record.status === "absent").length;
  const late = records.filter((record) => record.status === "late").length;
  const workFromHome = records.filter((record) => record.status === "work_from_home").length;
  const travelling = records.filter((record) => record.status === "travelling").length;
  const nightShift = records.filter((record) => record.status === "night_shift").length;
  const total = records.length;
  return {
    total,
    present,
    absent,
    late,
    workFromHome,
    travelling,
    nightShift,
    attendanceRate: total ? (present / total) * 100 : 0,
    averageHours: total ? records.reduce((sum, record) => sum + record.workedHours, 0) / total : 0,
    latePercentage: total ? (late / total) * 100 : 0,
  };
}

export function useAttendanceSummary(records: AttendanceRecord[]) {
  return useMemo(() => summarizeAttendance(records), [records]);
}
