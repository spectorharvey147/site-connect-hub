import { MessageCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { Button } from "@/components/ui/Button";
import { summarizeAttendance } from "@/hooks/useAttendanceSummary";
import { formatAttendanceDate, shareAttendanceOnWhatsApp, shareDailyAttendanceSummary } from "@/pages/attendance/components/attendanceShare";
import type { AttendanceRecord } from "@/types/attendance";

export function AttendanceDayDialog({ date, records, onClose }: { date: string; records: AttendanceRecord[]; onClose: () => void }) {
  const summary = summarizeAttendance(records);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="day-attendance-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-border p-5"><div><h2 id="day-attendance-title" className="text-xl font-bold">Daily Attendance Overview</h2><p className="mt-1 text-sm text-text-secondary">{formatAttendanceDate(date)}</p></div><div className="flex gap-2"><Button type="button" variant="secondary" aria-label="Share daily attendance summary on WhatsApp" leftIcon={<MessageCircle className="h-4 w-4" />} onClick={() => shareDailyAttendanceSummary(date, records)}>Share Daily Summary</Button><Button ref={closeRef} type="button" variant="ghost" size="icon" aria-label="Close daily attendance overview" onClick={onClose}><X className="h-5 w-5" /></Button></div></div>
    <div className="grid grid-cols-3 gap-3 border-b border-surface-border p-5"><Summary label="Present" value={summary.present} tone="bg-green-50 text-brand-success" /><Summary label="Absent" value={summary.absent} tone="bg-red-50 text-red-600" /><Summary label="Other" value={summary.total - summary.present - summary.absent} tone="bg-amber-50 text-amber-700" /></div>
    <div className="max-h-[58vh] space-y-3 overflow-y-auto p-5">{!records.length ? <p className="py-10 text-center text-sm text-text-secondary">No attendance submitted for this day.</p> : records.map((record) => <div key={record.id} className="rounded-lg border border-surface-border p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">{record.userName}</p><p className="text-xs text-text-secondary">{record.employeeId}</p></div><div className="flex items-center gap-2"><AttendanceStatusBadge status={record.status} /><Button type="button" variant="secondary" aria-label={`Share ${record.userName} attendance on WhatsApp`} leftIcon={<MessageCircle className="h-4 w-4" />} onClick={() => shareAttendanceOnWhatsApp(record)}>WhatsApp</Button></div></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><Detail label="Project" value={record.projectName || "—"} /><Detail label="Check in / out" value={`${record.checkInTime ?? "—"} / ${record.checkOutTime ?? "—"}`} /><Detail label="Worked hours" value={`${record.workedHours.toFixed(1)} hours`} /><Detail label="Remarks" value={record.remarks?.trim() || "—"} /></div></div>)}</div>
  </div></div>;
}
function Summary({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className={`rounded-lg p-3 text-center ${tone}`}><p className="text-2xl font-bold">{value}</p><p className="text-xs font-semibold">{label}</p></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p><p className="mt-1 break-words">{value}</p></div>; }
