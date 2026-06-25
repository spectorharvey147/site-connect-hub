import { ClipboardCheck, Clock3, FilePlus2, ListChecks } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { TaskTable } from "@/components/tasks/TaskTable";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { canPerformTaskAction, taskService } from "@/services/taskService";
import { useAuth } from "@/hooks/useAuth";
import type { Task, TaskDashboardSummary } from "@/types/tasks";

export function TasksLandingPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TaskDashboardSummary | null>(null);
  const [recent, setRecent] = useState<Task[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void taskService.getDashboard(user).then((dashboard) => {
      setSummary(dashboard.summary);
      setRecent(dashboard.recent);
    });
  }, [user]);

  if (!user || !summary) {
    return null;
  }

  const canCreate = canPerformTaskAction({ user, action: "create" });

  return (
    <>
      <PageHeader
        title="Task Management"
        description="Create, assign, track and close site work with comments, attachments and overdue visibility."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Tasks" },
        ]}
        action={
          canCreate ? (
            <Link to="/tasks/create">
              <Button type="button" leftIcon={<FilePlus2 className="h-4 w-4" />}>
                Create Task
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          metric={{ label: "Open tasks", value: String(summary.open), tone: "info" }}
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
        <StatCard
          metric={{ label: "Overdue", value: String(summary.overdue), tone: "danger" }}
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          metric={{ label: "Completed", value: String(summary.completed), tone: "success" }}
          icon={<ListChecks className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "High priority",
            value: String(summary.highPriority),
            tone: "warning",
          }}
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <ToolLink to="/tasks/list" title="Task List" />
        <ToolLink to="/tasks/dashboard" title="Tracking Dashboard" />
        {canCreate ? <ToolLink to="/tasks/create" title="Create Task" /> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskTable tasks={recent} />
        </CardContent>
      </Card>
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
