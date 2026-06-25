import { Filter, RotateCcw, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskTable } from "@/components/tasks/TaskTable";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/constants/tasks";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import { taskService } from "@/services/taskService";
import type { AppUser } from "@/types/auth";
import type {
  Task,
  TaskFilters,
  TaskPriority,
  TaskStatus,
} from "@/types/tasks";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

const defaultFilters: TaskFilters = {
  search: "",
  status: "all",
  priority: "all",
  assignedTo: "",
  projectId: "",
  overdueOnly: false,
};

export function TaskListPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [filters, setFilters] = useState<TaskFilters>(defaultFilters);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void taskService.listTasks(user, filters).then(setTasks);
  }, [filters, user]);

  useEffect(() => {
    if (!user) {
      setAssignableUsers([]);
      return;
    }
    void taskService.listAssignableUsers(user).then(setAssignableUsers);
  }, [user]);

  if (!user) {
    return null;
  }

  function update<Key extends keyof TaskFilters>(
    key: Key,
    value: TaskFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <PageHeader
        title="Task List"
        description="Filter tasks by assignment, project, status, priority, and overdue state."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Tasks", to: "/tasks" },
          { label: "List" },
        ]}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Input
              label="Search"
              value={filters.search ?? ""}
              leftIcon={<Search className="h-4 w-4" />}
              onChange={(event) => update("search", event.target.value)}
            />
            <FormField label="Status">
              <select
                className={selectClass}
                value={filters.status ?? "all"}
                onChange={(event) =>
                  update("status", event.target.value as TaskStatus | "all")
                }
              >
                <option value="all">All Statuses</option>
                {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Priority">
              <select
                className={selectClass}
                value={filters.priority ?? "all"}
                onChange={(event) =>
                  update("priority", event.target.value as TaskPriority | "all")
                }
              >
                <option value="all">All Priorities</option>
                {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Assignee">
              <select
                className={selectClass}
                value={filters.assignedTo ?? ""}
                onChange={(event) => update("assignedTo", event.target.value)}
              >
                <option value="">All Assignees</option>
                {assignableUsers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Project">
              <select
                className={selectClass}
                value={filters.projectId ?? ""}
                onChange={(event) => update("projectId", event.target.value)}
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-surface-border text-brand-blue focus:ring-brand-blue"
                checked={Boolean(filters.overdueOnly)}
                onChange={(event) => update("overdueOnly", event.target.checked)}
              />
              Overdue only
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<RotateCcw className="h-4 w-4" />}
                onClick={() => setFilters(defaultFilters)}
              >
                Reset
              </Button>
              <Button
                type="button"
                variant="outline"
                leftIcon={<Filter className="h-4 w-4" />}
              >
                {tasks.length} Results
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <TaskTable tasks={tasks} emptyTitle="No tasks match the filters" />
    </>
  );
}
