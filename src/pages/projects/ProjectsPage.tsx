import { Building2, Plus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { projectService } from "@/services/projectService";
import type { ProjectMaster } from "@/types/projects";

export function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectMaster[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    setProjects(await projectService.getProjects(user.organizationId));
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) =>
      [
        project.code,
        project.name,
        project.customerName,
        project.location,
        project.projectManagerName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [projects, search]);

  return (
    <>
      <PageHeader
        title="Project / Site Master"
        description="Create sites and manage project managers, departments, users, budgets and cost codes."
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Projects" }]}
        action={
          <Link to="/projects/new">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Add Project</Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="pt-4">
          <Input
            label="Search Projects"
            placeholder="Project code, name, customer, location or manager"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-surface-border bg-white">
        <table className="min-w-full divide-y divide-surface-border text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-text-secondary">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Customer / Location</th>
              <th className="px-4 py-3">Department / Manager</th>
              <th className="px-4 py-3">Assignments</th>
              <th className="px-4 py-3 text-right">Budget</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {visible.map((project) => (
              <tr key={project.id}>
                <td className="px-4 py-3">
                  <Link
                    to={`/projects/${project.id}`}
                    className="font-bold text-brand-blue"
                  >
                    {project.code}
                  </Link>
                  <p className="mt-1 text-text-primary">{project.name}</p>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  <p>{project.customerName ?? "No customer"}</p>
                  <p className="mt-1">{project.location ?? project.city ?? "-"}</p>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  <p>{project.primaryDepartmentName ?? "Unassigned"}</p>
                  <p className="mt-1">{project.projectManagerName ?? "No manager"}</p>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  <p className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {project.assignedUserCount} users
                  </p>
                  <p className="mt-1 flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {project.assignedDepartmentCount} departments
                  </p>
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(project.projectBudget)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={project.status === "active" ? "success" : "neutral"}>
                    {project.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/projects/${project.id}`}>
                      <Button size="sm" variant="secondary">View</Button>
                    </Link>
                    <Link to={`/projects/${project.id}/edit`}>
                      <Button size="sm" variant="secondary">Edit</Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
