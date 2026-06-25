import {
  Download,
  FileText,
  MessageSquareText,
  Save,
  TimerReset,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/components/tasks/TaskStatusBadge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { TASK_STATUS_LABELS } from "@/constants/tasks";
import { useAuth } from "@/hooks/useAuth";
import { canPerformTaskAction, taskService } from "@/services/taskService";
import type { AppUser } from "@/types/auth";
import type { Task, TaskActivity, TaskStatus } from "@/types/tasks";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function TaskDetailPage() {
  const { taskId } = useParams();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TaskStatus>("not_started");
  const [progressPercent, setProgressPercent] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [quickComment, setQuickComment] = useState("");
  const [commenting, setCommenting] = useState(false);

  useEffect(() => {
    if (!user || !taskId) {
      return;
    }

    setLoading(true);
    void loadTask(user, taskId).then((result) => {
      setTask(result.task);
      setActivity(result.activity);
      if (result.task) {
        setStatus(result.task.status);
        setProgressPercent(result.task.progressPercent);
      }
      setLoading(false);
    });
  }, [taskId, user]);

  if (!user) {
    return null;
  }

  if (loading) {
    return <LoadingState label="Loading task" />;
  }

  if (!task || !taskId) {
    return (
      <EmptyState
        title="Task not found"
        description="This task does not exist or is not visible to your role."
      />
    );
  }

  const canUpdate = canPerformTaskAction({ user, task, action: "update" });

  async function refresh(currentUser: AppUser, currentTaskId: string) {
    const result = await loadTask(currentUser, currentTaskId);
    setTask(result.task);
    setActivity(result.activity);
    if (result.task) {
      setStatus(result.task.status);
      setProgressPercent(result.task.progressPercent);
    }
  }

  async function saveStatus() {
    const currentUser = user;
    const currentTaskId = taskId;
    if (!currentUser || !currentTaskId) {
      return;
    }
    setSaving(true);
    try {
      await taskService.updateTaskStatus(
        {
          taskId: currentTaskId,
          status,
          progressPercent,
          comment: comment.trim() || undefined,
        },
        currentUser,
      );
      setComment("");
      await refresh(currentUser, currentTaskId);
      toast.success("Task updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update task.");
    } finally {
      setSaving(false);
    }
  }

  async function addQuickComment() {
    const currentUser = user;
    const currentTaskId = taskId;
    if (!currentUser || !currentTaskId || !quickComment.trim()) {
      return;
    }
    setCommenting(true);
    try {
      await taskService.addComment(currentTaskId, quickComment.trim(), currentUser);
      setQuickComment("");
      await refresh(currentUser, currentTaskId);
      toast.success("Comment added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add comment.");
    } finally {
      setCommenting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={task.taskNumber}
        description={task.title}
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Tasks", to: "/tasks" },
          { label: task.taskNumber },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Task Summary</CardTitle>
              <CardDescription>
                Created by {task.createdByName} for {task.projectName}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <SummaryRow label="Status" value={<TaskStatusBadge status={task.status} />} />
              <SummaryRow
                label="Priority"
                value={<TaskPriorityBadge priority={task.priority} />}
              />
              <SummaryRow label="Assignee" value={task.assignedToName} />
              <SummaryRow label="Due" value={`${task.dueDate} ${task.dueTime ?? ""}`} />
              <SummaryRow label="Progress" value={`${task.progressPercent}%`} />
              <SummaryRow label="Estimated" value={`${task.estimatedHours} hours`} />
              {task.completedAt ? (
                <SummaryRow label="Completed" value={formatDateTime(task.completedAt)} />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
              <CardDescription>Supporting task documents and photos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {task.attachments.length === 0 ? (
                <p className="text-sm text-text-secondary">No attachments.</p>
              ) : (
                task.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-surface-border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-5 w-5 shrink-0 text-brand-blue" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text-primary">
                          {attachment.fileName}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {Math.round(attachment.fileSize / 1024)} KB
                        </p>
                      </div>
                    </div>
                    <a href={attachment.url} download={attachment.fileName}>
                      <Button type="button" variant="ghost" size="icon" title="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                {task.description}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Update Progress</CardTitle>
              <CardDescription>
                Change status, progress percentage and add an update note.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Status">
                  <select
                    className={selectClass}
                    value={status}
                    disabled={!canUpdate}
                    onChange={(event) => setStatus(event.target.value as TaskStatus)}
                  >
                    {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <Input
                  label="Progress"
                  type="number"
                  min={0}
                  max={100}
                  value={progressPercent}
                  disabled={!canUpdate}
                  rightIcon={<TimerReset className="h-4 w-4" />}
                  onChange={(event) =>
                    setProgressPercent(Number(event.target.value))
                  }
                />
              </div>
              <Textarea
                label="Update note"
                value={comment}
                disabled={!canUpdate}
                onChange={(event) => setComment(event.target.value)}
              />
              <Button
                type="button"
                leftIcon={<Save className="h-4 w-4" />}
                isLoading={saving}
                disabled={!canUpdate}
                onClick={() => void saveStatus()}
              >
                Save Update
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
              <CardDescription>Field updates and coordination notes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Textarea
                  label="Add comment"
                  value={quickComment}
                  onChange={(event) => setQuickComment(event.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<MessageSquareText className="h-4 w-4" />}
                  isLoading={commenting}
                  onClick={() => void addQuickComment()}
                >
                  Add Comment
                </Button>
              </div>
              <div className="space-y-3">
                {task.comments.length === 0 ? (
                  <p className="text-sm text-text-secondary">No comments yet.</p>
                ) : (
                  task.comments.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-surface-border p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-text-primary">
                          {item.userName}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                        {item.comment}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Audit trail for task lifecycle events.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activity.length === 0 ? (
                <p className="text-sm text-text-secondary">No activity recorded.</p>
              ) : (
                activity.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-surface-border p-3 text-sm"
                  >
                    <p className="font-semibold text-text-primary">
                      {formatAction(item.action)}
                    </p>
                    <p className="mt-1 text-text-secondary">
                      {item.actorName} on {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

async function loadTask(user: AppUser, taskId: string) {
  const [task, activity] = await Promise.all([
    taskService.getTask(taskId, user),
    taskService.listActivity(taskId, user),
  ]);
  return { task, activity };
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-surface-border pb-3 last:border-0 last:pb-0">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAction(value: string) {
  return value
    .split(".")
    .join(" ")
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
