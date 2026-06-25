import { Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ATTENDANCE_STATUS_LABELS } from "@/constants/attendance";
import { attendanceService } from "@/services/attendanceService";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import type {
  AttendanceRecord,
  AttendanceStatus,
  ManualAttendanceInput,
} from "@/types/attendance";

const selectClass =
  "h-11 rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function AttendanceAdminPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const { projects } = useSelectableProjects(user, selected?.userId ?? user?.id);

  const loadRecords = useCallback(async () => {
    if (!user) {
      return;
    }
    setRecords(await attendanceService.listAttendance(user));
  }, [user]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  if (!user) {
    return null;
  }

  async function saveSelected() {
    if (!selected || !user) {
      return;
    }
    const currentUser = user;

    const input: ManualAttendanceInput = {
      userId: selected.userId,
      projectId: selected.projectId,
      shiftId: selected.shiftId,
      date: selected.date,
      checkInTime: selected.checkInTime,
      checkOutTime: selected.checkOutTime,
      status: selected.status,
      remarks: selected.remarks ?? "Admin correction",
    };
    setSaving(true);
    try {
      await attendanceService.submitManualAttendance(input, currentUser);
      toast.success("Attendance updated.");
      setSelected(null);
      await loadRecords();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update attendance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Attendance Admin Console"
        description="Review attendance records, correct statuses and keep an audit trail."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Attendance", to: "/attendance" },
          { label: "Admin" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {records.map((record) => (
              <button
                key={record.id}
                type="button"
                className="w-full rounded-lg border border-surface-border bg-white p-4 text-left transition hover:border-brand-blue hover:bg-brand-light/40"
                onClick={() => setSelected(record)}
              >
                <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                  <div>
                    <p className="font-bold text-text-primary">
                      {record.userName} · {record.date}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {record.projectName} · {record.checkInTime ?? "-"} /{" "}
                      {record.checkOutTime ?? "-"}
                    </p>
                  </div>
                  <AttendanceStatusBadge status={record.status} />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Correction Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected ? (
              <>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-sm font-bold text-text-primary">
                    {selected.userName}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {selected.employeeId} · {selected.date}
                  </p>
                </div>
                <select
                  className={selectClass}
                  value={selected.projectId}
                  onChange={(event) =>
                    setSelected((current) =>
                      current ? { ...current, projectId: event.target.value } : current,
                    )
                  }
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  value={selected.status}
                  onChange={(event) =>
                    setSelected((current) =>
                      current
                        ? {
                            ...current,
                            status: event.target.value as AttendanceStatus,
                          }
                        : current,
                    )
                  }
                >
                  {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Check-in"
                    type="time"
                    value={selected.checkInTime ?? ""}
                    onChange={(event) =>
                      setSelected((current) =>
                        current
                          ? { ...current, checkInTime: event.target.value }
                          : current,
                      )
                    }
                  />
                  <Input
                    label="Check-out"
                    type="time"
                    value={selected.checkOutTime ?? ""}
                    onChange={(event) =>
                      setSelected((current) =>
                        current
                          ? { ...current, checkOutTime: event.target.value }
                          : current,
                      )
                    }
                  />
                </div>
                <Textarea
                  label="Correction remarks"
                  value={selected.remarks ?? ""}
                  onChange={(event) =>
                    setSelected((current) =>
                      current ? { ...current, remarks: event.target.value } : current,
                    )
                  }
                />
                <Button
                  type="button"
                  leftIcon={<Save className="h-4 w-4" />}
                  isLoading={saving}
                  onClick={() => void saveSelected()}
                >
                  Save Correction
                </Button>
              </>
            ) : (
              <p className="text-sm text-text-secondary">
                Select a record to correct attendance.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
