import type { TaskPriority, TaskStatus } from "@/types/tasks";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

export const TASK_STATUS_TONES: Record<
  TaskStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  not_started: "neutral",
  in_progress: "info",
  completed: "success",
  on_hold: "warning",
  cancelled: "danger",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const TASK_PRIORITY_TONES: Record<
  TaskPriority,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  high: "danger",
  medium: "warning",
  low: "info",
};
