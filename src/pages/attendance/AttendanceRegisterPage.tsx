import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { useAttendanceSummary } from "@/hooks/useAttendanceSummary";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import { AttendanceCalendar } from "@/pages/attendance/components/AttendanceCalendar";
import { AttendanceDayDialog } from "@/pages/attendance/components/AttendanceDayDialog";
import { AttendanceExportActions } from "@/pages/attendance/components/AttendanceExportActions";
import { AttendanceFilters } from "@/pages/attendance/components/AttendanceFilters";
import { AttendanceSummaryCards } from "@/pages/attendance/components/AttendanceSummaryCards";
import { AttendanceTable } from "@/pages/attendance/components/AttendanceTable";
import { attendanceService } from "@/services/attendanceService";
import { leaveService } from "@/services/leaveService";
import type { AttendanceRecord, AttendanceStatus } from "@/types/attendance";
import type { Holiday } from "@/types/leave";

export { AttendanceTable } from "@/pages/attendance/components/AttendanceTable";

export function AttendanceRegisterPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState<AttendanceStatus | "all">("all");
  const [projectId, setProjectId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    if (!user) return;
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    void Promise.all([
      attendanceService.listAttendance(user, { fromDate: `${month}-01`, toDate: `${month}-${String(lastDay).padStart(2, "0")}`, status, projectId: projectId || undefined }),
      leaveService.loadHolidays(),
    ]).then(([attendance, loadedHolidays]) => { setRecords(attendance); setHolidays(loadedHolidays); })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load attendance register."));
  }, [month, projectId, status, user]);

  const filteredRecords = useMemo(() => { const needle = userSearch.trim().toLowerCase(); return records.filter((record) => !needle || record.userName.toLowerCase().includes(needle) || record.employeeId.toLowerCase().includes(needle)); }, [records, userSearch]);
  const recordsByDate = useMemo(() => filteredRecords.reduce<Record<string, AttendanceRecord[]>>((lookup, record) => { (lookup[record.date] ??= []).push(record); return lookup; }, {}), [filteredRecords]);
  const holidaysByDate = useMemo(() => holidays.reduce<Record<string, Holiday>>((lookup, holiday) => { lookup[holiday.date] = holiday; return lookup; }, {}), [holidays]);
  const summary = useAttendanceSummary(filteredRecords);
  const employeeCount = useMemo(() => new Set(filteredRecords.map((record) => record.userId)).size, [filteredRecords]);
  const projectName = projects.find((project) => project.id === projectId)?.name ?? "All projects";

  return <>
    <PageHeader title="Attendance Register" description="Monthly attendance calendar with status, hours and export options." breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Attendance", to: "/attendance" }, { label: "Register" }]} action={<AttendanceExportActions records={filteredRecords} filters={{ month, search: userSearch, status, projectName }} />} />
    <Card className="mb-6"><CardContent className="pt-4"><AttendanceFilters month={month} search={userSearch} status={status} projectId={projectId} projects={projects} onMonth={setMonth} onSearch={setUserSearch} onStatus={setStatus} onProject={setProjectId} /></CardContent></Card>
    <AttendanceSummaryCards summary={summary} employeeCount={employeeCount} />
    <AttendanceCalendar month={month} recordsByDate={recordsByDate} holidaysByDate={holidaysByDate} selectedDate={selectedDate} onSelect={setSelectedDate} />
    {selectedDate ? <AttendanceDayDialog date={selectedDate} records={recordsByDate[selectedDate] ?? []} onClose={() => setSelectedDate("")} /> : null}
    <Card><CardHeader><CardTitle>Register Table</CardTitle></CardHeader><CardContent><AttendanceTable records={filteredRecords} /></CardContent></Card>
  </>;
}
