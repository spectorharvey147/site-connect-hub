import { AlertTriangle, ClipboardList, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DprTable } from "@/components/fieldOperations/DprTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ISSUE_TYPE_LABELS } from "@/constants/fieldOperations";
import { useAuth } from "@/hooks/useAuth";
import {
  calculateDprLaborSummary,
  fieldOperationsService,
} from "@/services/fieldOperationsService";
import type { DailyProgressReport } from "@/types/fieldOperations";

const issueColors = ["#D71920", "#F59E0B", "#0066CC", "#009B72", "#64748B"];

export function FieldOperationsReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<DailyProgressReport[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void fieldOperationsService.listReports(user).then(setReports);
  }, [user]);

  const workforce = useMemo(
    () =>
      reports.reduce(
        (total, report) =>
          total + calculateDprLaborSummary(report).totalWorkforce,
        0,
      ),
    [reports],
  );

  const activityData = useMemo(() => {
    const grouped = reports
      .flatMap((report) => report.activities)
      .reduce<Record<string, { activity: string; count: number; progress: number }>>(
        (acc, activity) => {
          const label =
            activity.activityName === "Custom"
              ? activity.customActivityName || "Custom"
              : activity.activityName;
          acc[label] ??= { activity: label, count: 0, progress: 0 };
          acc[label].count += 1;
          acc[label].progress += activity.completionPercent;
          return acc;
        },
        {},
      );
    return Object.values(grouped).map((item) => ({
      activity: item.activity,
      count: item.count,
      averageProgress: Math.round(item.progress / item.count),
    }));
  }, [reports]);

  const issueData = useMemo(() => {
    const grouped = reports
      .flatMap((report) => report.issues)
      .reduce<Record<string, { label: string; value: number }>>((acc, issue) => {
        const label = ISSUE_TYPE_LABELS[issue.issueType];
        acc[label] ??= { label, value: 0 };
        acc[label].value += 1;
        return acc;
      }, {});
    return Object.values(grouped);
  }, [reports]);

  const pendingReports = reports.filter((report) =>
    report.issues.some((issue) => issue.status === "pending"),
  );

  if (!user) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Field Reports"
        description="Analyze DPR activity mix, workforce deployment and open issue patterns."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Field Operations", to: "/field-operations" },
          { label: "Reports" },
        ]}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          metric={{
            label: "Reports",
            value: String(reports.length),
            tone: "info",
          }}
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Workforce captured",
            value: String(workforce),
            tone: "success",
          }}
          icon={<UsersRound className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Pending issue DPRs",
            value: String(pendingReports.length),
            tone: pendingReports.length > 0 ? "danger" : "success",
          }}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activity Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="activity" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar
                    dataKey="averageProgress"
                    fill="#0066CC"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issue Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={issueData}
                    dataKey="value"
                    nameKey="label"
                    outerRadius={92}
                    label={({ label, value }) => `${label}: ${value}`}
                  >
                    {issueData.map((entry, index) => (
                      <Cell
                        key={entry.label}
                        fill={issueColors[index % issueColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Issue DPRs</CardTitle>
        </CardHeader>
        <CardContent>
          <DprTable reports={pendingReports} emptyTitle="No pending issue DPRs" />
        </CardContent>
      </Card>
    </>
  );
}
