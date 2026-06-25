import {
  AlertTriangle,
  ClipboardCheck,
  Flag,
  ListChecks,
  TimerReset,
} from "lucide-react";
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

import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { TaskTable } from "@/components/tasks/TaskTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/constants/tasks";
import { useAuth } from "@/hooks/useAuth";
import { isTaskOverdue, taskService } from "@/services/taskService";
import type { Task, TaskDashboardSummary } from "@/types/tasks";

const statusColors = ["#0066CC", "#009B72", "#F59E0B", "#D71920", "#64748B"];
const priorityColors = {
  high: "#D71920",
  medium: "#F59E0B",
  low: "#0066CC",
};

export function TaskDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TaskDashboardSummary | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void Promise.all([
      taskService.getDashboard(user),
      taskService.listTasks(user),
    ]).then(([dashboard, list]) => {
      setSummary(dashboard.summary);
      setTasks(list);
    });
  }, [user]);

  const statusData = useMemo(
    () =>
      Object.entries(TASK_STATUS_LABELS).map(([status, label]) => ({
        label,
        value: tasks.filter((task) => task.status === status).length,
      })),
    [tasks],
  );

  const priorityData = useMemo(
    () =>
      Object.entries(TASK_PRIORITY_LABELS).map(([priority, label]) => ({
        label,
        value: tasks.filter((task) => task.priority === priority).length,
        color: priorityColors[priority as keyof typeof priorityColors],
      })),
    [tasks],
  );

  const overdueTasks = useMemo(() => tasks.filter(isTaskOverdue), [tasks]);
  const workloadData = useMemo(() => {
    const grouped = tasks.reduce<Record<string, { assignee: string; open: number }>>(
      (acc, task) => {
        if (["completed", "cancelled"].includes(task.status)) {
          return acc;
        }
        acc[task.assignedTo] ??= { assignee: task.assignedToName, open: 0 };
        acc[task.assignedTo].open += 1;
        return acc;
      },
      {},
    );
    return Object.values(grouped).sort((left, right) => right.open - left.open);
  }, [tasks]);

  if (!user || !summary) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Tracking Dashboard"
        description="Monitor overdue work, status distribution, priorities, and team workload."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Tasks", to: "/tasks" },
          { label: "Dashboard" },
        ]}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          metric={{ label: "Total tasks", value: String(summary.total), tone: "info" }}
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
        <StatCard
          metric={{ label: "Open tasks", value: String(summary.open), tone: "info" }}
          icon={<TimerReset className="h-5 w-5" />}
        />
        <StatCard
          metric={{ label: "Overdue", value: String(summary.overdue), tone: "danger" }}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Completion",
            value: `${completionRate(summary)}%`,
            tone: "success",
          }}
          icon={<ListChecks className="h-5 w-5" />}
        />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {statusData.map((entry, index) => (
                      <Cell
                        key={entry.label}
                        fill={statusColors[index % statusColors.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Priority Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    dataKey="value"
                    nameKey="label"
                    outerRadius={92}
                    label={({ label, value }) => `${label}: ${value}`}
                  >
                    {priorityData.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Open Workload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workloadData.length === 0 ? (
              <p className="text-sm text-text-secondary">No open work assigned.</p>
            ) : (
              workloadData.map((item) => (
                <div
                  key={item.assignee}
                  className="flex items-center justify-between rounded-lg border border-surface-border p-3 text-sm"
                >
                  <span className="font-semibold text-text-primary">{item.assignee}</span>
                  <span className="inline-flex items-center gap-1 font-bold text-brand-blue">
                    <Flag className="h-4 w-4" />
                    {item.open}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overdue Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskTable tasks={overdueTasks} emptyTitle="No overdue tasks" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function completionRate(summary: TaskDashboardSummary) {
  if (summary.total === 0) {
    return 0;
  }
  return Math.round((summary.completed / summary.total) * 100);
}
