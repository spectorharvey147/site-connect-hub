import {
  AlertTriangle,
  Camera,
  ClipboardList,
  FilePlus2,
  ListChecks,
  PenLine,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { DprTable } from "@/components/fieldOperations/DprTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { fieldOperationsService } from "@/services/fieldOperationsService";
import type {
  DailyProgressReport,
  FieldOperationsSummary,
} from "@/types/fieldOperations";

export function FieldOperationsLandingPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<FieldOperationsSummary | null>(null);
  const [recent, setRecent] = useState<DailyProgressReport[]>([]);
  const [issueReports, setIssueReports] = useState<DailyProgressReport[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void fieldOperationsService.getDashboard(user).then((dashboard) => {
      setSummary(dashboard.summary);
      setRecent(dashboard.recent);
      setIssueReports(dashboard.issueReports);
    });
  }, [user]);

  if (!user || !summary) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Field Operations"
        description="Submit DPRs, capture site progress, track labour, machinery, photos, issues and next-day plans."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Field Operations" },
        ]}
        action={
          <Link to="/field-operations/submit">
            <Button type="button" leftIcon={<FilePlus2 className="h-4 w-4" />}>
              Submit DPR
            </Button>
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          metric={{
            label: "DPR reports",
            value: String(summary.totalReports),
            tone: "info",
          }}
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "This month",
            value: String(summary.submittedThisMonth),
            tone: "success",
          }}
          icon={<ListChecks className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Pending issues",
            value: String(summary.pendingIssues),
            tone: summary.pendingIssues > 0 ? "danger" : "success",
          }}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Photos",
            value: String(summary.photoCount),
            tone: "neutral",
          }}
          icon={<Camera className="h-5 w-5" />}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <ToolLink to="/field-operations/submit" title="Submit DPR" />
        <ToolLink to="/field-operations/history" title="DPR History" />
        <ToolLink to="/field-operations/reports" title="Reports" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent DPRs</CardTitle>
          </CardHeader>
          <CardContent>
            <DprTable reports={recent} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {issueReports.length === 0 ? (
              <p className="text-sm text-text-secondary">No pending site issues.</p>
            ) : (
              issueReports.slice(0, 5).map((report) => (
                <Link
                  key={report.id}
                  to={`/field-operations/${report.id}`}
                  className="block rounded-lg border border-surface-border p-3 text-sm transition hover:border-brand-blue hover:bg-brand-light/40"
                >
                  <p className="font-bold text-brand-blue">{report.dprNumber}</p>
                  <p className="mt-1 font-semibold text-text-primary">
                    {report.projectName}
                  </p>
                  <p className="mt-1 text-text-secondary">
                    {report.issues.find((issue) => issue.status === "pending")
                      ?.description ?? "Pending issue"}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ToolLink({ to, title }: { to: string; title: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-surface-border bg-white p-4 text-sm font-bold text-text-primary shadow-card transition hover:border-brand-blue hover:bg-brand-light/40"
    >
      <PenLine className="h-4 w-4 text-brand-blue" />
      {title}
    </Link>
  );
}
