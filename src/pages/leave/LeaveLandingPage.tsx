import { CalendarDays, ClipboardCheck, FilePlus2, Plane } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { leaveService } from "@/services/leaveService";
import { useAuth } from "@/hooks/useAuth";
import type { LeaveApplication, LeaveBalance } from "@/types/leave";

export function LeaveLandingPage() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void Promise.all([
      leaveService.getBalances(user),
      leaveService.listLeaves(user),
    ]).then(([nextBalances, nextLeaves]) => {
      setBalances(nextBalances);
      setLeaves(nextLeaves);
    });
  }, [user]);

  if (!user) {
    return null;
  }

  const totalAvailable = balances.reduce((sum, balance) => sum + balance.available, 0);
  const pendingCount = leaves.filter((leave) => leave.status === "pending").length;
  const canApprove = ["manager", "hod", "super_admin"].includes(user.role);
  const canManagePolicy = leaveService.canManagePolicy(user);

  return (
    <>
      <PageHeader
        title="Leave Management"
        description="Apply leave, track balances, approve requests and manage holidays and policies."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Leave" },
        ]}
        action={
          <Link to="/leave/apply">
            <Button type="button" leftIcon={<FilePlus2 className="h-4 w-4" />}>
              Apply Leave
            </Button>
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          metric={{ label: "Available balance", value: String(totalAvailable), tone: "success" }}
          icon={<Plane className="h-5 w-5" />}
        />
        <StatCard
          metric={{ label: "Pending requests", value: String(pendingCount), tone: "warning" }}
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
        <StatCard
          metric={{ label: "Holiday count", value: String(leaveService.listHolidays().length), tone: "info" }}
          icon={<CalendarDays className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Leave Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {balances.map((balance) => (
              <div key={balance.leaveTypeId} className="rounded-lg border border-surface-border p-4">
                <div className="flex justify-between gap-3">
                  <p className="font-bold text-text-primary">{balance.leaveTypeName}</p>
                  <p className="font-bold text-brand-blue">{balance.available} left</p>
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  Used {balance.used} · Pending {balance.pending} · Annual {balance.annualAllowance}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave Tools</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <ToolLink to="/leave/apply" title="Apply Leave" />
            <ToolLink to="/leave/history" title="Leave History" />
            <ToolLink to="/leave/register" title="Leave Register" />
            <ToolLink to="/leave/register/balance" title="Balance Register" />
            <ToolLink to="/leave/holidays" title="Holiday Calendar" />
            {canApprove ? <ToolLink to="/leave/approvals" title="Approvals" /> : null}
            {canManagePolicy ? <ToolLink to="/leave/policies" title="Policy Master" /> : null}
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
      className="rounded-lg border border-surface-border p-4 text-sm font-bold text-text-primary transition hover:border-brand-blue hover:bg-brand-light/40"
    >
      {title}
    </Link>
  );
}
