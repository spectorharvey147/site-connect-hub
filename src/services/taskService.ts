import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { PROJECT_OPTIONS } from "@/constants/claims";
import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import { userHierarchyService } from "@/services/userHierarchyService";
import type { AppUser, Role } from "@/types/auth";
import type {
  Task,
  TaskActivity,
  TaskAttachment,
  TaskComment,
  TaskDashboardSummary,
  TaskFilters,
  TaskInput,
  TaskPermissionContext,
  TaskStatusUpdateInput,
} from "@/types/tasks";

const TASKS_STORAGE_KEY = "site-connect:tasks";
const TASK_ACTIVITY_STORAGE_KEY = "site-connect:task-activity";

let memoryTasks: Task[] | null = null;
let memoryActivity: TaskActivity[] | null = null;

type SupabaseClient = NonNullable<typeof supabase>;

interface SupabaseProfileRow {
  id: string;
  full_name: string | null;
}

interface SupabaseProjectRow {
  id: string;
  code: string | null;
  name: string | null;
}

interface SupabaseTaskRow {
  id: string;
  task_number: string;
  title: string;
  description: string;
  project_id: string;
  created_by: string;
  assigned_to: string;
  priority: Task["priority"];
  status: Task["status"];
  due_date: string;
  due_time: string | null;
  estimated_hours: number | string;
  progress_percent: number;
  reminder_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SupabaseTaskCommentRow {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

interface SupabaseTaskAttachmentRow {
  id: string;
  task_id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

interface SupabaseTaskActivityRow {
  id: string;
  task_id: string;
  actor_id: string;
  actor_role: Role;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function now() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getProjectName(projectId: string) {
  if (isSupabaseConfigured) {
    throw new Error("Production project names must come from Supabase.");
  }
  return (
    PROJECT_OPTIONS.find((project) => project.id === projectId)?.name ??
    "Unknown project"
  );
}

function shouldUseSupabaseTasks() {
  return isSupabaseConfigured && Boolean(supabase);
}

function taskClient(): SupabaseClient {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function isUuid(value: string | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function localProjectId(project: SupabaseProjectRow | undefined, fallback?: string | null) {
  if (!project) {
    return fallback ?? "";
  }
  return project.id;
}

async function dbProjectId(projectId: string | undefined) {
  if (!projectId || isUuid(projectId)) {
    return projectId ?? null;
  }
  throw new Error("Production project selections must use database project IDs.");
}

function getDemoUser(email: string) {
  const user = DEMO_USERS.find((item) => item.email === email);
  if (!user) {
    throw new Error(`Missing demo user: ${email}`);
  }
  return toAppUser(user);
}

function getUserById(userId: string) {
  return DEMO_USERS.map(toAppUser).find((user) => user.id === userId);
}

export function isTaskOverdue(task: Task) {
  return (
    !["completed", "cancelled"].includes(task.status) &&
    task.dueDate < today()
  );
}

function seedTasks(): Task[] {
  const manager = getDemoUser("manager@siteconnect.local");
  const siteUser = getDemoUser("site@siteconnect.local");
  const secondUser = getDemoUser("ishita@siteconnect.local");

  const comment: TaskComment = {
    id: "task-comment-demo-001",
    taskId: "task-demo-001",
    userId: siteUser.id,
    userName: siteUser.fullName,
    comment: "Column shuttering is 60% complete. Need materials by tomorrow.",
    createdAt: "2026-06-19T15:20:00.000Z",
    updatedAt: "2026-06-19T15:20:00.000Z",
  };

  return [
    {
      id: "task-demo-001",
      taskNumber: "TSK-2026-0001",
      title: "Complete pier shuttering checklist",
      description:
        "Verify reinforcement, shuttering alignment and concrete pour readiness for pier P12.",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      createdBy: manager.id,
      createdByName: manager.fullName,
      assignedTo: siteUser.id,
      assignedToName: siteUser.fullName,
      priority: "high",
      status: "in_progress",
      dueDate: "2026-06-20",
      dueTime: "17:00",
      estimatedHours: 6,
      progressPercent: 60,
      comments: [comment],
      attachments: [],
      reminderAt: "2026-06-20T14:00:00.000Z",
      createdAt: "2026-06-18T10:00:00.000Z",
      updatedAt: "2026-06-19T15:20:00.000Z",
    },
    {
      id: "task-demo-002",
      taskNumber: "TSK-2026-0002",
      title: "Upload site safety photos",
      description: "Capture and upload weekly safety barricade photos.",
      projectId: "project-tower",
      projectName: getProjectName("project-tower"),
      createdBy: manager.id,
      createdByName: manager.fullName,
      assignedTo: secondUser.id,
      assignedToName: secondUser.fullName,
      priority: "medium",
      status: "not_started",
      dueDate: "2026-06-23",
      dueTime: "18:00",
      estimatedHours: 2,
      progressPercent: 0,
      comments: [],
      attachments: [],
      createdAt: "2026-06-19T09:00:00.000Z",
      updatedAt: "2026-06-19T09:00:00.000Z",
    },
    {
      id: "task-demo-003",
      taskNumber: "TSK-2026-0003",
      title: "Fuel log reconciliation",
      description: "Reconcile machine fuel issue log with receipt entries.",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      createdBy: manager.id,
      createdByName: manager.fullName,
      assignedTo: siteUser.id,
      assignedToName: siteUser.fullName,
      priority: "low",
      status: "completed",
      dueDate: "2026-06-17",
      dueTime: "16:00",
      estimatedHours: 3,
      progressPercent: 100,
      comments: [],
      attachments: [],
      createdAt: "2026-06-15T11:00:00.000Z",
      updatedAt: "2026-06-17T13:30:00.000Z",
      completedAt: "2026-06-17T13:30:00.000Z",
    },
  ];
}

function seedActivity(): TaskActivity[] {
  const manager = getDemoUser("manager@siteconnect.local");
  return [
    {
      id: "task-activity-demo-001",
      taskId: "task-demo-001",
      actorId: manager.id,
      actorName: manager.fullName,
      actorRole: manager.role,
      action: "task.created",
      newValues: { status: "not_started" },
      createdAt: "2026-06-18T10:00:00.000Z",
    },
  ];
}

function readCollection<T>(key: string, seed: () => T[], memory: T[] | null) {
  if (!isBrowser()) {
    return memory ?? seed();
  }
  const stored = window.localStorage.getItem(key);
  if (!stored) {
    const seeded = seed();
    window.localStorage.setItem(key, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return JSON.parse(stored) as T[];
  } catch {
    const seeded = seed();
    window.localStorage.setItem(key, JSON.stringify(seeded));
    return seeded;
  }
}

function writeCollection<T>(key: string, value: T[]) {
  if (isBrowser()) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function readTasks() {
  const tasks = readCollection(TASKS_STORAGE_KEY, seedTasks, memoryTasks);
  memoryTasks = tasks;
  return tasks;
}

function writeTasks(tasks: Task[]) {
  memoryTasks = tasks;
  writeCollection(TASKS_STORAGE_KEY, tasks);
}

function readActivity() {
  const activity = readCollection(
    TASK_ACTIVITY_STORAGE_KEY,
    seedActivity,
    memoryActivity,
  );
  memoryActivity = activity;
  return activity;
}

function writeActivity(activity: TaskActivity[]) {
  memoryActivity = activity;
  writeCollection(TASK_ACTIVITY_STORAGE_KEY, activity);
}

function canCreateTasks(user: AppUser) {
  return ["manager", "hod", "admin_hr", "super_admin"].includes(user.role);
}

function canViewTask(user: AppUser, task: Task) {
  if ([task.assignedTo, task.createdBy].includes(user.id)) {
    return true;
  }
  if (user.role === "manager") {
    return user.projectIds.includes(task.projectId);
  }
  if (user.role === "hod") {
    return user.projectIds.includes(task.projectId);
  }
  return ["admin_hr", "super_admin"].includes(user.role);
}

function canUpdateTask(user: AppUser, task: Task) {
  return (
    task.assignedTo === user.id ||
    task.createdBy === user.id ||
    ["manager", "hod", "admin_hr", "super_admin"].includes(user.role)
  );
}

export function canPerformTaskAction({
  user,
  task,
  action,
}: TaskPermissionContext) {
  if (action === "create") {
    return canCreateTasks(user);
  }
  if (!task) {
    return false;
  }
  if (action === "view") {
    return canViewTask(user, task);
  }
  if (action === "comment") {
    return canViewTask(user, task);
  }
  return canUpdateTask(user, task);
}

function applyFilters(tasks: Task[], filters?: TaskFilters) {
  return tasks.filter((task) => {
    if (filters?.status && filters.status !== "all" && task.status !== filters.status) {
      return false;
    }
    if (filters?.priority && filters.priority !== "all" && task.priority !== filters.priority) {
      return false;
    }
    if (filters?.assignedTo && task.assignedTo !== filters.assignedTo) {
      return false;
    }
    if (filters?.projectId && task.projectId !== filters.projectId) {
      return false;
    }
    if (filters?.overdueOnly && !isTaskOverdue(task)) {
      return false;
    }
    if (filters?.search) {
      const query = filters.search.trim().toLowerCase();
      const haystack = [
        task.taskNumber,
        task.title,
        task.description,
        task.assignedToName,
        task.projectName,
        task.status,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    }
    return true;
  });
}

function nextTaskNumber(tasks: Task[]) {
  const next =
    tasks
      .map((task) => Number(task.taskNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `TSK-2026-${String(next).padStart(4, "0")}`;
}

function addActivity(
  taskId: string,
  actor: AppUser,
  action: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>,
) {
  const activity: TaskActivity = {
    id: crypto.randomUUID(),
    taskId,
    actorId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    action,
    oldValues,
    newValues,
    createdAt: now(),
  };
  writeActivity([activity, ...readActivity()]);
  return activity;
}

function summarize(tasks: Task[]): TaskDashboardSummary {
  return {
    total: tasks.length,
    open: tasks.filter((task) => !["completed", "cancelled"].includes(task.status))
      .length,
    overdue: tasks.filter(isTaskOverdue).length,
    completed: tasks.filter((task) => task.status === "completed").length,
    highPriority: tasks.filter((task) => task.priority === "high").length,
  };
}

async function fetchProfiles(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return new Map<string, SupabaseProfileRow>();
  }
  const { data, error } = await taskClient()
    .from("user_profiles")
    .select("id, full_name")
    .in("id", uniqueIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map(
    (((data as unknown) as SupabaseProfileRow[] | null) ?? []).map((profile) => [
      profile.id,
      profile,
    ]),
  );
}

async function fetchProjects(ids: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (uniqueIds.length === 0) {
    return new Map<string, SupabaseProjectRow>();
  }
  const { data, error } = await taskClient()
    .from("projects")
    .select("id, code, name")
    .in("id", uniqueIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map(
    (((data as unknown) as SupabaseProjectRow[] | null) ?? []).map((project) => [
      project.id,
      project,
    ]),
  );
}

async function mapSupabaseTasks(rows: SupabaseTaskRow[]): Promise<Task[]> {
  if (rows.length === 0) {
    return [];
  }
  const taskIds = rows.map((row) => row.id);
  const [profiles, projects, commentsResult, attachmentsResult] = await Promise.all([
    fetchProfiles([
      ...rows.map((row) => row.created_by),
      ...rows.map((row) => row.assigned_to),
    ]),
    fetchProjects(rows.map((row) => row.project_id)),
    taskClient()
      .from("task_comments")
      .select("*")
      .in("task_id", taskIds)
      .order("created_at", { ascending: false }),
    taskClient().from("task_attachments").select("*").in("task_id", taskIds),
  ]);
  if (commentsResult.error) {
    throw new Error(commentsResult.error.message);
  }
  if (attachmentsResult.error) {
    throw new Error(attachmentsResult.error.message);
  }
  const comments =
    ((commentsResult.data as unknown) as SupabaseTaskCommentRow[] | null) ?? [];
  const attachments =
    ((attachmentsResult.data as unknown) as SupabaseTaskAttachmentRow[] | null) ?? [];
  const uploaders = await fetchProfiles(
    attachments.map((attachment) => attachment.uploaded_by ?? ""),
  );

  return rows.map((row) => {
    const project = projects.get(row.project_id);
    const projectId = localProjectId(project, row.project_id);
    return {
      id: row.id,
      taskNumber: row.task_number,
      title: row.title,
      description: row.description,
      projectId,
      projectName: project?.name ?? getProjectName(projectId),
      createdBy: row.created_by,
      createdByName: profiles.get(row.created_by)?.full_name ?? "Creator",
      assignedTo: row.assigned_to,
      assignedToName: profiles.get(row.assigned_to)?.full_name ?? "Assignee",
      priority: row.priority,
      status: row.status,
      dueDate: row.due_date,
      dueTime: row.due_time ?? undefined,
      estimatedHours: toNumber(row.estimated_hours),
      progressPercent: row.progress_percent,
      comments: comments
        .filter((comment) => comment.task_id === row.id)
        .map((comment) => ({
          id: comment.id,
          taskId: comment.task_id,
          userId: comment.user_id,
          userName: profiles.get(comment.user_id)?.full_name ?? "User",
          comment: comment.comment,
          createdAt: comment.created_at,
          updatedAt: comment.updated_at,
        })),
      attachments: attachments
        .filter((attachment) => attachment.task_id === row.id)
        .map((attachment) => ({
          id: attachment.id,
          fileName: attachment.file_name,
          fileType: attachment.file_type ?? "",
          fileSize: attachment.file_size ?? 0,
          url: attachment.file_url,
          uploadedBy: attachment.uploaded_by ?? "",
          uploadedByName: attachment.uploaded_by
            ? uploaders.get(attachment.uploaded_by)?.full_name ?? "Uploader"
            : "Uploader",
          createdAt: attachment.created_at,
        })),
      reminderAt: row.reminder_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at ?? undefined,
    };
  });
}

async function getSupabaseTask(taskId: string, user: AppUser) {
  const { data, error } = await taskClient()
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  const [task] = await mapSupabaseTasks(
    data ? [((data as unknown) as SupabaseTaskRow)] : [],
  );
  return task && canViewTask(user, task) ? task : null;
}

async function nextSupabaseTaskNumber() {
  const { data, error } = await taskClient()
    .from("tasks")
    .select("task_number")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) {
    throw new Error(error.message);
  }
  const next =
    (((data as unknown) as Array<{ task_number: string }> | null) ?? [])
      .map((row) => Number(row.task_number.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `TSK-2026-${String(next).padStart(4, "0")}-${crypto.randomUUID()
    .slice(0, 4)
    .toUpperCase()}`;
}

async function addSupabaseActivity(
  taskId: string,
  actor: AppUser,
  action: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>,
) {
  const { error } = await taskClient().from("task_activity").insert({
    task_id: taskId,
    actor_id: actor.id,
    actor_role: actor.role,
    action,
    old_values: oldValues ?? null,
    new_values: newValues ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export const taskService = {
  async listAssignableUsers(user: AppUser) {
    if (shouldUseSupabaseTasks()) {
      const users = await userHierarchyService.listUsers(user.organizationId);
      if (canCreateTasks(user)) {
        return users.filter((item) =>
          user.role === "manager"
            ? item.id === user.id || item.reportingManagerId === user.id
            : true,
        );
      }
      return users.filter((item) => item.id === user.id);
    }

    const users = DEMO_USERS.map(toAppUser);
    if (canCreateTasks(user)) {
      return users.filter((item) =>
        user.role === "manager"
          ? item.id === user.id || item.managerId === user.id
          : true,
      );
    }
    return users.filter((item) => item.id === user.id);
  },

  async listTasks(user: AppUser, filters?: TaskFilters) {
    if (shouldUseSupabaseTasks()) {
      let query = taskClient()
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.priority && filters.priority !== "all") {
        query = query.eq("priority", filters.priority);
      }
      if (filters?.assignedTo) {
        query = query.eq("assigned_to", filters.assignedTo);
      }
      if (filters?.projectId) {
        const projectId = await dbProjectId(filters.projectId);
        if (projectId) {
          query = query.eq("project_id", projectId);
        }
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      return applyFilters(
        await mapSupabaseTasks(
          ((data as unknown) as SupabaseTaskRow[] | null) ?? [],
        ),
        filters,
      );
    }

    const visible = readTasks().filter((task) => canViewTask(user, task));
    return applyFilters(visible, filters).sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  },

  async getTask(taskId: string, user: AppUser) {
    if (shouldUseSupabaseTasks()) {
      return getSupabaseTask(taskId, user);
    }

    const task = readTasks().find((item) => item.id === taskId);
    return task && canViewTask(user, task) ? task : null;
  },

  async getDashboard(user: AppUser) {
    const tasks = await this.listTasks(user);
    return {
      summary: summarize(tasks),
      overdue: tasks.filter(isTaskOverdue).slice(0, 5),
      recent: tasks.slice(0, 6),
    };
  },

  async createTask(input: TaskInput, actor: AppUser) {
    if (!canCreateTasks(actor)) {
      throw new Error("You do not have permission to create tasks.");
    }
    if (input.dueDate < today()) {
      throw new Error("Task due date cannot be in the past.");
    }
    const assignedUser = shouldUseSupabaseTasks()
      ? await userHierarchyService.getUserById(input.assignedTo)
      : getUserById(input.assignedTo);
    if (!assignedUser) {
      throw new Error("Assigned user not found.");
    }

    if (shouldUseSupabaseTasks()) {
      const projectId = await dbProjectId(input.projectId);
      if (!projectId) {
        throw new Error("Project not found.");
      }
      const taskNumber = await nextSupabaseTaskNumber();
      const { data, error } = await taskClient()
        .from("tasks")
        .insert({
          task_number: taskNumber,
          title: input.title.trim(),
          description: input.description.trim(),
          organization_id: actor.organizationId ?? assignedUser.organizationId ?? null,
          department_id: assignedUser.departmentId ?? actor.departmentId ?? null,
          project_id: projectId,
          created_by: actor.id,
          assigned_to: assignedUser.id,
          priority: input.priority,
          status: "not_started",
          due_date: input.dueDate,
          due_time: input.dueTime || null,
          estimated_hours: input.estimatedHours,
          progress_percent: 0,
        })
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const taskRow = (data as unknown) as SupabaseTaskRow;
      if (input.attachments.length > 0) {
        const { error: attachmentError } = await taskClient()
          .from("task_attachments")
          .insert(
            input.attachments.map((attachment) => ({
              task_id: taskRow.id,
              file_url: attachment.url,
              file_name: attachment.fileName,
              file_type: attachment.fileType,
              file_size: attachment.fileSize,
              uploaded_by: actor.id,
            })),
          );
        if (attachmentError) {
          throw new Error(attachmentError.message);
        }
      }
      await addSupabaseActivity(taskRow.id, actor, "task.created", undefined, {
        taskNumber,
        assignedTo: assignedUser.fullName,
      });
      const task = await getSupabaseTask(taskRow.id, actor);
      if (!task) {
        throw new Error("Task was saved but could not be loaded.");
      }
      await recordAuditLog({
        userId: actor.id,
        action: "task.created",
        entityType: "task",
        entityId: task.id,
        newValues: { ...task, comments: undefined, attachments: undefined },
      });
      return task;
    }

    const tasks = readTasks();
    const createdAt = now();
    const task: Task = {
      id: crypto.randomUUID(),
      taskNumber: nextTaskNumber(tasks),
      title: input.title.trim(),
      description: input.description.trim(),
      projectId: input.projectId,
      projectName: getProjectName(input.projectId),
      createdBy: actor.id,
      createdByName: actor.fullName,
      assignedTo: assignedUser.id,
      assignedToName: assignedUser.fullName,
      priority: input.priority,
      status: "not_started",
      dueDate: input.dueDate,
      dueTime: input.dueTime,
      estimatedHours: input.estimatedHours,
      progressPercent: 0,
      comments: [],
      attachments: input.attachments,
      createdAt,
      updatedAt: createdAt,
    };
    writeTasks([task, ...tasks]);
    addActivity(task.id, actor, "task.created", undefined, {
      taskNumber: task.taskNumber,
      assignedTo: task.assignedToName,
    });
    await recordAuditLog({
      userId: actor.id,
      action: "task.created",
      entityType: "task",
      entityId: task.id,
      newValues: { ...task, comments: undefined, attachments: undefined },
    });
    return task;
  },

  async updateTaskStatus(input: TaskStatusUpdateInput, actor: AppUser) {
    if (shouldUseSupabaseTasks()) {
      const task = await getSupabaseTask(input.taskId, actor);
      if (!task) {
        throw new Error("Task not found.");
      }
      if (!canUpdateTask(actor, task)) {
        throw new Error("You do not have permission to update this task.");
      }
      if (input.progressPercent < 0 || input.progressPercent > 100) {
        throw new Error("Progress must be between 0 and 100.");
      }
      const updatedAt = now();
      const progressPercent =
        input.status === "completed" ? 100 : input.progressPercent;
      const { error } = await taskClient()
        .from("tasks")
        .update({
          status: input.status,
          progress_percent: progressPercent,
          completed_at: input.status === "completed" ? updatedAt : task.completedAt ?? null,
        })
        .eq("id", task.id);
      if (error) {
        throw new Error(error.message);
      }
      if (input.comment) {
        const { error: commentError } = await taskClient()
          .from("task_comments")
          .insert({
            task_id: task.id,
            user_id: actor.id,
            comment: input.comment,
          });
        if (commentError) {
          throw new Error(commentError.message);
        }
      }
      await addSupabaseActivity(
        task.id,
        actor,
        "task.status_updated",
        { status: task.status, progressPercent: task.progressPercent },
        { status: input.status, progressPercent },
      );
      await recordAuditLog({
        userId: actor.id,
        action: "task.status_updated",
        entityType: "task",
        entityId: task.id,
        oldValues: { status: task.status, progressPercent: task.progressPercent },
        newValues: { status: input.status, progressPercent },
      });
      const updated = await getSupabaseTask(task.id, actor);
      if (!updated) {
        throw new Error("Task was updated but could not be loaded.");
      }
      return updated;
    }

    const tasks = readTasks();
    const task = tasks.find((item) => item.id === input.taskId);
    if (!task) {
      throw new Error("Task not found.");
    }
    if (!canUpdateTask(actor, task)) {
      throw new Error("You do not have permission to update this task.");
    }
    if (input.progressPercent < 0 || input.progressPercent > 100) {
      throw new Error("Progress must be between 0 and 100.");
    }

    const updatedAt = now();
    const nextTask: Task = {
      ...task,
      status: input.status,
      progressPercent:
        input.status === "completed" ? 100 : input.progressPercent,
      completedAt: input.status === "completed" ? updatedAt : task.completedAt,
      updatedAt,
      comments: input.comment
        ? [
            {
              id: crypto.randomUUID(),
              taskId: task.id,
              userId: actor.id,
              userName: actor.fullName,
              comment: input.comment,
              createdAt: updatedAt,
              updatedAt,
            },
            ...task.comments,
          ]
        : task.comments,
    };
    writeTasks(tasks.map((item) => (item.id === task.id ? nextTask : item)));
    addActivity(
      task.id,
      actor,
      "task.status_updated",
      { status: task.status, progressPercent: task.progressPercent },
      { status: nextTask.status, progressPercent: nextTask.progressPercent },
    );
    await recordAuditLog({
      userId: actor.id,
      action: "task.status_updated",
      entityType: "task",
      entityId: task.id,
      oldValues: { status: task.status, progressPercent: task.progressPercent },
      newValues: {
        status: nextTask.status,
        progressPercent: nextTask.progressPercent,
      },
    });
    return nextTask;
  },

  async addComment(taskId: string, comment: string, actor: AppUser) {
    if (shouldUseSupabaseTasks()) {
      const task = await getSupabaseTask(taskId, actor);
      if (!task) {
        throw new Error("Task not found.");
      }
      if (!canViewTask(actor, task)) {
        throw new Error("You cannot comment on this task.");
      }
      const { data, error } = await taskClient()
        .from("task_comments")
        .insert({
          task_id: taskId,
          user_id: actor.id,
          comment,
        })
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      await addSupabaseActivity(task.id, actor, "task.comment_added", undefined, {
        comment,
      });
      const row = (data as unknown) as SupabaseTaskCommentRow;
      return {
        id: row.id,
        taskId: row.task_id,
        userId: row.user_id,
        userName: actor.fullName,
        comment: row.comment,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }

    const tasks = readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error("Task not found.");
    }
    if (!canViewTask(actor, task)) {
      throw new Error("You cannot comment on this task.");
    }
    const createdAt = now();
    const taskComment: TaskComment = {
      id: crypto.randomUUID(),
      taskId,
      userId: actor.id,
      userName: actor.fullName,
      comment,
      createdAt,
      updatedAt: createdAt,
    };
    const updatedTask: Task = {
      ...task,
      comments: [taskComment, ...task.comments],
      updatedAt: createdAt,
    };
    writeTasks(tasks.map((item) => (item.id === taskId ? updatedTask : item)));
    addActivity(task.id, actor, "task.comment_added", undefined, { comment });
    return taskComment;
  },

  async listActivity(taskId: string, user: AppUser) {
    const task = await this.getTask(taskId, user);
    if (!task) {
      return [];
    }
    if (shouldUseSupabaseTasks()) {
      const { data, error } = await taskClient()
        .from("task_activity")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) {
        throw new Error(error.message);
      }
      const rows =
        ((data as unknown) as SupabaseTaskActivityRow[] | null) ?? [];
      const actors = await fetchProfiles(rows.map((row) => row.actor_id));
      return rows.map((row) => ({
        id: row.id,
        taskId: row.task_id,
        actorId: row.actor_id,
        actorName: actors.get(row.actor_id)?.full_name ?? "Actor",
        actorRole: row.actor_role,
        action: row.action,
        oldValues: row.old_values ?? undefined,
        newValues: row.new_values ?? undefined,
        createdAt: row.created_at,
      }));
    }
    return readActivity()
      .filter((activity) => activity.taskId === taskId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  },

  resetDemoData() {
    writeTasks(seedTasks());
    writeActivity(seedActivity());
  },
};

export type { TaskAttachment };
