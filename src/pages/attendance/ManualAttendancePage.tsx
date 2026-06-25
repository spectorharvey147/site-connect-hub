import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ATTENDANCE_STATUS_LABELS } from "@/constants/attendance";
import { attendanceService } from "@/services/attendanceService";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import type { AppUser } from "@/types/auth";
import type { AttendanceStatus, ManualAttendanceInput } from "@/types/attendance";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function ManualAttendancePage() {
  const { user } = useAuth();
  const shifts = attendanceService.listShifts();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [form, setForm] = useState<ManualAttendanceInput>({
    userId: user?.id ?? "",
    projectId: "",
    shiftId: shifts[0]?.id ?? "",
    date: new Date().toISOString().slice(0, 10),
    checkInTime: "09:00",
    checkOutTime: "18:00",
    status: "present",
    remarks: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const { projects } = useSelectableProjects(user, form.userId || user?.id);

  useEffect(() => {
    if (!user) {
      setUsers([]);
      return;
    }
    void attendanceService.listUsers(user).then((nextUsers) => {
      setUsers(nextUsers);
      setForm((current) => ({
        ...current,
        userId: current.userId || nextUsers[0]?.id || user.id,
      }));
    });
  }, [user]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      projectId: projects.some((project) => project.id === current.projectId)
        ? current.projectId
        : projects[0]?.id ?? "",
    }));
  }, [projects]);

  if (!user) {
    return null;
  }

  function update<Key extends keyof ManualAttendanceInput>(
    key: Key,
    value: ManualAttendanceInput[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    if (!user) {
      return;
    }
    const currentUser = user;
    setSubmitting(true);
    try {
      await attendanceService.submitManualAttendance(form, currentUser);
      toast.success("Attendance saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save attendance.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Manual Attendance"
        description="Submit or correct attendance with validation and audit logging."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Attendance", to: "/attendance" },
          { label: "Manual" },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Attendance Entry</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Employee">
            <select
              className={selectClass}
              value={form.userId}
              onChange={(event) => update("userId", event.target.value)}
            >
              {users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName} ({item.employeeId})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Project">
            <select
              className={selectClass}
              value={form.projectId}
              onChange={(event) => update("projectId", event.target.value)}
            >
              <option value="">Select assigned project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Shift">
            <select
              className={selectClass}
              value={form.shiftId}
              onChange={(event) => update("shiftId", event.target.value)}
            >
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Status">
            <select
              className={selectClass}
              value={form.status}
              onChange={(event) =>
                update("status", event.target.value as AttendanceStatus)
              }
            >
              {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={(event) => update("date", event.target.value)}
          />
          <Input
            label="Check-in time"
            type="time"
            value={form.checkInTime ?? ""}
            onChange={(event) => update("checkInTime", event.target.value)}
          />
          <Input
            label="Check-out time"
            type="time"
            value={form.checkOutTime ?? ""}
            onChange={(event) => update("checkOutTime", event.target.value)}
          />
          <div className="md:col-span-2">
            <Textarea
              label="Remarks"
              value={form.remarks}
              onChange={(event) => update("remarks", event.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Button
              type="button"
              leftIcon={<Save className="h-4 w-4" />}
              isLoading={submitting}
              onClick={() => void submit()}
            >
              Save Attendance
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
