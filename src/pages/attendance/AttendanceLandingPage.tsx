import { CalendarDays, Clock3, FileSpreadsheet, MapPin, UserRoundCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { attendanceService } from "@/services/attendanceService";
import { useAuth } from "@/hooks/useAuth";
import type { AttendanceDashboard } from "@/types/attendance";

export function AttendanceLandingPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<AttendanceDashboard | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    void attendanceService.getDashboard(user).then(setDashboard);
  }, [user]);

  if (!user || !dashboard) {
    return null;
  }

  const canAdmin = ["admin_hr", "super_admin"].includes(user.role);

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Quick check-in, checkout, register, manual attendance and monthly summaries."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Attendance" },
        ]}
        action={
          <Link to="/attendance/check-in">
            <Button type="button" leftIcon={<Clock3 className="h-4 w-4" />}>
              Quick Check-In
            </Button>
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          metric={{
            label: "Present days",
            value: String(dashboard.summary.presentDays),
            tone: "success",
          }}
          icon={<UserRoundCheck className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Late marks",
            value: String(dashboard.summary.lateDays),
            tone: "warning",
          }}
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Average hours",
            value: dashboard.summary.averageHours.toFixed(1),
            tone: "info",
          }}
          icon={<FileSpreadsheet className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Absent days",
            value: String(dashboard.summary.absentDays),
            tone: "danger",
          }}
          icon={<CalendarDays className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.today ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-text-primary">
                      {dashboard.today.projectName}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      In {dashboard.today.checkInTime ?? "-"} · Out{" "}
                      {dashboard.today.checkOutTime ?? "-"}
                    </p>
                  </div>
                  <AttendanceStatusBadge status={dashboard.today.status} />
                </div>
                {dashboard.today.location ? (
                  <p className="flex items-center gap-2 text-xs text-text-secondary">
                    <MapPin className="h-4 w-4 text-brand-blue" />
                    GPS accuracy {dashboard.today.location.accuracy}m
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-text-secondary">
                No attendance recorded for today.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Link to="/attendance/check-in">
                <Button type="button">Open Check-In</Button>
              </Link>
              <Link to="/attendance/manual">
                <Button type="button" variant="secondary">
                  Manual Attendance
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Tools</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <ToolLink
              to="/attendance/register"
              title="Register Calendar"
              description="Daily register with status and exports."
            />
            <ToolLink
              to="/attendance/summary"
              title="Monthly Summary"
              description="Present, late, absent and worked-hours summary."
            />
            <ToolLink
              to="/attendance/manual"
              title="Manual Submission"
              description="Submit or correct attendance with remarks."
            />
            {canAdmin ? (
              <ToolLink
                to="/attendance/admin"
                title="Admin Console"
                description="Review, correct and audit attendance entries."
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ToolLink({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-surface-border p-4 transition hover:border-brand-blue hover:bg-brand-light/40"
    >
      <p className="text-sm font-bold text-text-primary">{title}</p>
      <p className="mt-1 text-sm leading-5 text-text-secondary">{description}</p>
    </Link>
  );
}
