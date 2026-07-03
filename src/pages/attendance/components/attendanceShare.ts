import { ATTENDANCE_STATUS_LABELS } from "@/constants/attendance";
import { summarizeAttendance } from "@/hooks/useAttendanceSummary";
import type { AttendanceRecord } from "@/types/attendance";

export function formatAttendanceDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}-${month}-${year}`;
}

export function shareAttendanceOnWhatsApp(record: AttendanceRecord) {
  const submittedAt = record.updatedAt || record.createdAt;
  const submissionTime = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(submittedAt));
  openWhatsApp([
    "\u2705 Attendance Submitted", "",
    `Date: ${formatAttendanceDate(record.date)}`,
    `Employee: ${record.userName}`,
    `Project: ${record.projectName || "-"}`,
    `Status: ${ATTENDANCE_STATUS_LABELS[record.status]}`,
    `Submitted Time: ${submissionTime}`,
    `Remarks: ${record.remarks?.trim() || "-"}`,
  ].join("\n"));
}

export function shareDailyAttendanceSummary(date: string, records: AttendanceRecord[]) {
  const summary = summarizeAttendance(records);
  const projects = [...new Set(records.map((record) => record.projectName).filter(Boolean))];
  const project = projects.length === 1 ? projects[0] : projects.length ? "Multiple Sites" : "-";
  openWhatsApp([
    "\ud83d\udccb Daily Attendance Report",
    `Date: ${formatAttendanceDate(date)}`,
    `Project: ${project}`, "",
    `\u2705 Present: ${summary.present}`,
    `\u274c Absent: ${summary.absent}`,
    `\ud83c\udfe0 Work From Home: ${summary.workFromHome}`,
    `\ud83d\udd52 Late: ${summary.late}`,
    `\ud83d\ude9a Travelling: ${summary.travelling}`,
    `\ud83c\udf19 Night Shift: ${summary.nightShift}`, "",
    `Attendance Rate: ${summary.attendanceRate.toFixed(1)}%`, "",
    "Generated from Site Connect",
  ].join("\n"));
}

function openWhatsApp(message: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}
