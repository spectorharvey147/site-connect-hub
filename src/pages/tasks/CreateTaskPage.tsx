import { FilePlus2, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { TASK_PRIORITY_LABELS } from "@/constants/tasks";
import { taskService } from "@/services/taskService";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import type { AppUser } from "@/types/auth";
import type { TaskAttachment, TaskInput, TaskPriority } from "@/types/tasks";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function CreateTaskPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const navigate = useNavigate();
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [form, setForm] = useState<Omit<TaskInput, "attachments">>({
    title: "",
    description: "",
    projectId: "",
    assignedTo: assignableUsers[0]?.id ?? "",
    priority: "medium",
    dueDate: new Date().toISOString().slice(0, 10),
    dueTime: "18:00",
    estimatedHours: 2,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      setAssignableUsers([]);
      return;
    }
    void taskService.listAssignableUsers(user).then((users) => {
      setAssignableUsers(users);
      setForm((current) => ({
        ...current,
        assignedTo: current.assignedTo || users[0]?.id || "",
      }));
    });
  }, [user]);

  useEffect(() => {
    if (projects[0]) {
      setForm((current) => ({
        ...current,
        projectId: projects.some((project) => project.id === current.projectId)
          ? current.projectId
          : projects[0].id,
      }));
    }
  }, [projects]);

  if (!user) {
    return null;
  }

  function update<Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addAttachments(files: FileList | null) {
    const currentUser = user;
    if (!files || !currentUser) {
      return;
    }
    setAttachments((current) => [
      ...current,
      ...Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        url: URL.createObjectURL(file),
        uploadedBy: currentUser.id,
        uploadedByName: currentUser.fullName,
        createdAt: new Date().toISOString(),
      })),
    ]);
  }

  async function submit() {
    const currentUser = user;
    if (!currentUser) {
      return;
    }
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Enter task title and description.");
      return;
    }
    setSubmitting(true);
    try {
      const task = await taskService.createTask({ ...form, attachments }, currentUser);
      toast.success("Task created.");
      navigate(`/tasks/${task.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create task.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Create Task"
        description="Assign work with due date, priority, estimated hours and attachments."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Tasks", to: "/tasks" },
          { label: "Create" },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Title"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
            />
            <FormField label="Project">
              <select
                className={selectClass}
                value={form.projectId}
                onChange={(event) => update("projectId", event.target.value)}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Assign to">
              <select
                className={selectClass}
                value={form.assignedTo}
                onChange={(event) => update("assignedTo", event.target.value)}
              >
                {assignableUsers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Priority">
              <select
                className={selectClass}
                value={form.priority}
                onChange={(event) =>
                  update("priority", event.target.value as TaskPriority)
                }
              >
                {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <Input
              label="Due date"
              type="date"
              value={form.dueDate}
              onChange={(event) => update("dueDate", event.target.value)}
            />
            <Input
              label="Due time"
              type="time"
              value={form.dueTime ?? ""}
              onChange={(event) => update("dueTime", event.target.value)}
            />
            <Input
              label="Estimated hours"
              type="number"
              min={0}
              step="0.5"
              value={form.estimatedHours}
              onChange={(event) => update("estimatedHours", Number(event.target.value))}
            />
            <div className="md:col-span-2">
              <Textarea
                label="Description"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </div>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-slate-50 p-5 text-center hover:border-brand-blue">
            <Upload className="h-6 w-6 text-brand-blue" />
            <span className="mt-2 text-sm font-semibold text-text-primary">
              Add attachments
            </span>
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => addAttachments(event.target.files)}
            />
          </label>
          {attachments.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center justify-between rounded-lg border border-surface-border p-3">
                  <span className="truncate text-sm font-semibold">{attachment.fileName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((item) => item.id !== attachment.id),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <Button
            type="button"
            leftIcon={<FilePlus2 className="h-4 w-4" />}
            isLoading={submitting}
            onClick={() => void submit()}
          >
            Create Task
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
