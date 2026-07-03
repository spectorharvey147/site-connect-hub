import { Eye } from "lucide-react";

import { summarizeAttendance } from "@/hooks/useAttendanceSummary";
import type { AttendanceRecord } from "@/types/attendance";
import type { Holiday } from "@/types/leave";
import { cn } from "@/utils/cn";

interface Props { month: string; recordsByDate: Record<string, AttendanceRecord[]>; holidaysByDate: Record<string, Holiday>; selectedDate: string; onSelect: (date: string) => void }

export function AttendanceCalendar({ month, recordsByDate, holidaysByDate, selectedDate, onSelect }: Props) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{Array.from({ length: days }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    const records = recordsByDate[date] ?? [];
    const summary = summarizeAttendance(records);
    const holiday = holidaysByDate[date];
    const isWeekend = [0, 6].includes(new Date(`${date}T00:00:00`).getDay());
    const heat = !records.length ? "" : summary.attendanceRate >= 90 ? "bg-green-50" : summary.attendanceRate >= 70 ? "bg-amber-50" : "bg-red-50";
    return <button key={date} type="button" aria-label={`View attendance for ${date}`} aria-pressed={selectedDate === date} onClick={() => onSelect(date)} onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onSelect(date); } }} className={cn("min-h-32 rounded-lg border border-surface-border p-3 text-left shadow-card transition hover:border-brand-blue/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue", isWeekend ? "bg-slate-100" : "bg-white", heat, selectedDate === date && "ring-2 ring-brand-blue")}>
      <div className="flex items-center justify-between border-b border-surface-border pb-2"><span className="text-sm font-bold">{date.slice(-2)}</span><Eye className="h-4 w-4 text-brand-blue" /></div>
      {holiday ? <p className="mt-4 text-xs font-bold text-brand-blue">🏖 {holiday.name}</p> : <div className="mt-3 space-y-1.5 text-xs"><Count label="Present" value={summary.present} tone="text-brand-success" /><Count label="Absent" value={summary.absent} tone="text-red-600" /><Count label="Other" value={summary.total - summary.present - summary.absent} tone="text-amber-700" /></div>}
    </button>;
  })}</div>;
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className="flex justify-between"><span className="text-text-secondary">{label}</span><span className={`font-bold ${tone}`}>{value}</span></div>; }
