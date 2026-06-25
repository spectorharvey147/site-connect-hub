import { Download, FileSpreadsheet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ATTENDANCE_STATUS_LABELS } from "@/constants/attendance";
import { attendanceService } from "@/services/attendanceService";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import type { AttendanceRecord, AttendanceStatus } from "@/types/attendance";

const selectClass =
  "h-11 rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function AttendanceRegisterPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState<AttendanceStatus | "all">("all");
  const [projectId, setProjectId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }
    void attendanceService
      .listAttendance(user, {
        fromDate: `${month}-01`,
        toDate: `${month}-31`,
        status,
        projectId: projectId || undefined,
      })
      .then(setRecords);
  }, [month, projectId, status, user]);

  const filteredRecords = useMemo(() => {
    const needle = userSearch.trim().toLowerCase();
    return records.filter(
      (record) =>
        !needle ||
        record.userName.toLowerCase().includes(needle) ||
        record.employeeId.toLowerCase().includes(needle),
    );
  }, [records, userSearch]);
  const calendarDays = useMemo(() => buildCalendarDays(month, filteredRecords), [month, filteredRecords]);
  const selectedDayRecords = selectedDate
    ? filteredRecords.filter((record) => record.date === selectedDate)
    : [];

  return (
    <>
      <PageHeader
        title="Attendance Register"
        description="Monthly attendance calendar with status, hours and export options."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Attendance", to: "/attendance" },
          { label: "Register" },
        ]}
        action={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={() => void exportAttendancePdf(records)}
            >
              PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              leftIcon={<FileSpreadsheet className="h-4 w-4" />}
              onClick={() => exportAttendanceCsv(records)}
            >
              CSV
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardContent className="grid gap-3 pt-4 md:grid-cols-4">
          <Input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
          <Input
            placeholder="Search employee"
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
          />
          <select
            className={selectClass}
            value={status}
            onChange={(event) => setStatus(event.target.value as AttendanceStatus | "all")}
          >
            <option value="all">All statuses</option>
            {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {calendarDays.map((day) => (
          <div
            key={day.date}
            className="min-h-28 rounded-lg border border-surface-border bg-white p-3 shadow-card"
            role="button"
            tabIndex={0}
            onClick={() => setSelectedDate(day.date)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setSelectedDate(day.date);
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-text-secondary">
                {day.date.slice(-2)}
              </p>
              <p className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-brand-success">
                {day.presentCount} present
              </p>
            </div>
            {day.records.slice(0, 3).map((record) => (
              <div key={record.id} className="mt-2 space-y-1">
                <AttendanceStatusBadge status={record.status} />
                <p className="truncate text-xs font-semibold text-text-primary">
                  {record.userName}
                </p>
                <p className="text-xs text-text-secondary">
                  {record.checkInTime ?? "-"} / {record.checkOutTime ?? "-"}
                </p>
              </div>
            ))}
            {day.records.length > 3 ? (
              <p className="mt-2 text-xs font-semibold text-brand-blue">
                +{day.records.length - 3} more — click for details
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {selectedDate ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{selectedDate} attendance detail</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceTable records={selectedDayRecords} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Register Table</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceTable records={filteredRecords} />
        </CardContent>
      </Card>
    </>
  );
}

export function AttendanceTable({ records }: { records: AttendanceRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-surface-border text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-text-secondary">
              Date
            </th>
            <th className="px-4 py-3 text-left font-semibold text-text-secondary">
              Employee
            </th>
            <th className="px-4 py-3 text-left font-semibold text-text-secondary">
              Project
            </th>
            <th className="px-4 py-3 text-left font-semibold text-text-secondary">
              Status
            </th>
            <th className="px-4 py-3 text-right font-semibold text-text-secondary">
              Hours
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border bg-white">
          {records.map((record) => (
            <tr key={record.id} className="hover:bg-brand-light/40">
              <td className="px-4 py-3 text-text-secondary">{record.date}</td>
              <td className="px-4 py-3 font-semibold text-text-primary">
                {record.userName}
                <span className="block text-xs font-normal text-text-secondary">
                  {record.employeeId}
                </span>
              </td>
              <td className="px-4 py-3 text-text-secondary">{record.projectName}</td>
              <td className="px-4 py-3">
                <AttendanceStatusBadge status={record.status} />
              </td>
              <td className="px-4 py-3 text-right font-bold">
                {record.workedHours.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildCalendarDays(month: string, records: AttendanceRecord[]) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: days }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    return {
      date,
      records: records.filter((record) => record.date === date),
      presentCount: records.filter(
        (record) =>
          record.date === date &&
          ["present", "late", "work_from_home", "travelling", "holiday_present", "week_off_present", "night_shift"].includes(record.status),
      ).length,
    };
  });
}

async function exportAttendancePdf(records: AttendanceRecord[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Site Connect Attendance Register", 20, 20);
  doc.setFontSize(10);
  records.slice(0, 28).forEach((record, index) => {
    doc.text(
      `${record.date} | ${record.userName} | ${record.status} | ${record.workedHours.toFixed(1)}h`,
      20,
      36 + index * 7,
    );
  });
  doc.save("attendance-register.pdf");
}

function exportAttendanceCsv(records: AttendanceRecord[]) {
  const escape = (value: unknown) =>
    `"${String(value ?? "").split('"').join('""')}"`;
  const rows = [
    [
      "Date",
      "Employee",
      "Employee ID",
      "Project",
      "Status",
      "Check In",
      "Check Out",
      "Hours",
    ],
    ...records.map((record) => [
      record.date,
      record.userName,
      record.employeeId,
      record.projectName,
      record.status,
      record.checkInTime,
      record.checkOutTime,
      record.workedHours.toFixed(1),
    ]),
  ];
  const blob = new Blob(
    [`\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\r\n")}`],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "attendance-register.csv";
  link.click();
  URL.revokeObjectURL(url);
}
