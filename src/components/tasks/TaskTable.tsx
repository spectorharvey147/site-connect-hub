import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

import { TaskPriorityBadge, TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { isTaskOverdue } from "@/services/taskService";
import type { Task } from "@/types/tasks";

export function TaskTable({
  tasks,
  emptyTitle = "No tasks found",
}: {
  tasks: Task[];
  emptyTitle?: string;
}) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description="Tasks matching this view will appear here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-surface-border text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Task
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Assignment
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Priority
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Status
              </th>
              <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                Progress
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-white">
            {tasks.map((task) => {
              const overdue = isTaskOverdue(task);
              return (
                <tr key={task.id} className="hover:bg-brand-light/40">
                  <td className="px-4 py-3">
                    <Link
                      to={`/tasks/${task.id}`}
                      className="font-bold text-brand-blue hover:underline"
                    >
                      {task.taskNumber}
                    </Link>
                    <p className="mt-1 max-w-sm truncate font-semibold text-text-primary">
                      {task.title}
                    </p>
                    {overdue ? (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand-danger">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Overdue
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    <span className="block font-semibold text-text-primary">
                      {task.assignedToName}
                    </span>
                    {task.projectName}
                    <span className="block text-xs">
                      Due {task.dueDate} {task.dueTime ?? ""}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TaskPriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <TaskStatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {task.progressPercent}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
