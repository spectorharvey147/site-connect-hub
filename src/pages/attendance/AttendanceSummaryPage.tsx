import { CalendarDays, Clock3, UserRoundCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { attendanceService } from "@/services/attendanceService";
import { useAuth } from "@/hooks/useAuth";
import type { AttendanceSummary } from "@/types/attendance";

export function AttendanceSummaryPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    void attendanceService.getMonthlySummary(user, month).then(setSummary);
  }, [month, user]);

  const chartData = summary
    ? [
        { label: "Present", value: summary.presentDays },
        { label: "Late", value: summary.lateDays },
        { label: "Half Day", value: summary.halfDays },
        { label: "Absent", value: summary.absentDays },
        { label: "Leave", value: summary.leaveDays },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Monthly Attendance Summary"
        description="Attendance totals, exceptions and worked-hour averages for the selected month."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Attendance", to: "/attendance" },
          { label: "Summary" },
        ]}
        action={
          <Input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        }
      />

      {summary ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              metric={{
                label: "Present",
                value: String(summary.presentDays),
                tone: "success",
              }}
              icon={<UserRoundCheck className="h-5 w-5" />}
            />
            <StatCard
              metric={{
                label: "Late",
                value: String(summary.lateDays),
                tone: "warning",
              }}
              icon={<Clock3 className="h-5 w-5" />}
            />
            <StatCard
              metric={{
                label: "Absent",
                value: String(summary.absentDays),
                tone: "danger",
              }}
              icon={<XCircle className="h-5 w-5" />}
            />
            <StatCard
              metric={{
                label: "Avg hours",
                value: summary.averageHours.toFixed(1),
                tone: "info",
              }}
              icon={<CalendarDays className="h-5 w-5" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0066CC" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
