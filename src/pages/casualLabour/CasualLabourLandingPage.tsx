import {
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  IndianRupee,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { LabourAttendanceTable } from "@/components/casualLabour/LabourAttendanceTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { casualLabourService } from "@/services/casualLabourService";
import type {
  CasualLabourAttendance,
  CasualLabourSummary,
} from "@/types/casualLabour";
import { formatCurrency } from "@/utils/format";

export function CasualLabourLandingPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<CasualLabourSummary | null>(null);
  const [recent, setRecent] = useState<CasualLabourAttendance[]>([]);
  const [pending, setPending] = useState<CasualLabourAttendance[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void casualLabourService.getDashboard(user).then((dashboard) => {
      setSummary(dashboard.summary);
      setRecent(dashboard.recent);
      setPending(dashboard.pending);
    });
  }, [user]);

  if (!user || !summary) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Casual Labour"
        description="Maintain temporary worker master data, daily attendance, work allocation and wage costs."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Casual Labour" },
        ]}
        action={
          <Link to="/casual-labour/attendance">
            <Button type="button" leftIcon={<FilePlus2 className="h-4 w-4" />}>
              Mark Attendance
            </Button>
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          metric={{
            label: "Active workers",
            value: String(summary.activeWorkers),
            tone: "success",
          }}
          icon={<UsersRound className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Submitted records",
            value: String(summary.submittedRecords),
            tone: "info",
          }}
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Monthly cost",
            value: formatCurrency(summary.monthlyCost),
            tone: "warning",
          }}
          icon={<IndianRupee className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Pending approval",
            value: String(summary.pendingApproval),
            tone: summary.pendingApproval > 0 ? "danger" : "success",
          }}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ToolLink to="/casual-labour/contracts" title="Labour Contracts" />
        <ToolLink to="/casual-labour/attendance" title="Mark Attendance" />
        <ToolLink to="/casual-labour/work-allocation" title="Work Allocation" />
        <ToolLink to="/casual-labour/register" title="Wage Register" />
        <ToolLink to="/casual-labour/master" title="Labour Master" />
        <ToolLink to="/casual-labour/bills" title="Labour Bills" />
        <ToolLink to="/casual-labour/reports" title="Labour Reports" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <LabourAttendanceTable records={recent} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <LabourAttendanceTable
              records={pending.slice(0, 4)}
              emptyTitle="No pending labour approvals"
            />
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
      className="rounded-lg border border-surface-border bg-white p-4 text-sm font-bold text-text-primary shadow-card transition hover:border-brand-blue hover:bg-brand-light/40"
    >
      {title}
    </Link>
  );
}
