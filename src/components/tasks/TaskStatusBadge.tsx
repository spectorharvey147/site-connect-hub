import { Badge } from "@/components/ui/Badge";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_TONES,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONES,
} from "@/constants/tasks";
import type { TaskPriority, TaskStatus } from "@/types/tasks";

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={TASK_STATUS_TONES[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge tone={TASK_PRIORITY_TONES[priority]}>
      {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
