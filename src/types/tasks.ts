import type { AppUser, Role } from "@/types/auth";

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "on_hold"
  | "cancelled";

export type TaskPriority = "high" | "medium" | "low";

export interface TaskAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  taskNumber: string;
  title: string;
  description: string;
  projectId: string;
  projectName: string;
  createdBy: string;
  createdByName: string;
  assignedTo: string;
  assignedToName: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  dueTime?: string;
  estimatedHours: number;
  progressPercent: number;
  comments: TaskComment[];
  attachments: TaskAttachment[];
  reminderAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TaskInput {
  title: string;
  description: string;
  projectId: string;
  assignedTo: string;
  priority: TaskPriority;
  dueDate: string;
  dueTime?: string;
  estimatedHours: number;
  attachments: TaskAttachment[];
}

export interface TaskFilters {
  search?: string;
  status?: TaskStatus | "all";
  priority?: TaskPriority | "all";
  assignedTo?: string;
  projectId?: string;
  overdueOnly?: boolean;
}

export interface TaskDashboardSummary {
  total: number;
  open: number;
  overdue: number;
  completed: number;
  highPriority: number;
}

export interface TaskStatusUpdateInput {
  taskId: string;
  status: TaskStatus;
  progressPercent: number;
  comment?: string;
}

export interface TaskPermissionContext {
  user: AppUser;
  task?: Task;
  action: "create" | "update" | "comment" | "view";
}

export interface TaskActivity {
  id: string;
  taskId: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  createdAt: string;
}
