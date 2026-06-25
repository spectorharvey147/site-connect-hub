import { Building2, Edit3, Tags, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type React from "react";
import { Link, useParams } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { projectService } from "@/services/projectService";
import type { ProjectMaster } from "@/types/projects";

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<ProjectMaster | null>(null);

  const load = useCallback(async () => {
    if (projectId) {
      setProject(await projectService.getProjectById(projectId));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!project) {
    return null;
  }

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${project.code} · ${project.location ?? project.city ?? "Location not set"}`}
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Projects", to: "/projects" },
          { label: project.code },
        ]}
        action={
          <Link to={`/projects/${project.id}/edit`}>
            <Button leftIcon={<Edit3 className="h-4 w-4" />}>Edit Project</Button>
          </Link>
        }
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard metric={{ label: "Assigned Users", value: String(project.assignedUserCount), tone: "info" }} icon={<Users className="h-5 w-5" />} />
        <StatCard metric={{ label: "Departments", value: String(project.assignedDepartmentCount), tone: "success" }} icon={<Building2 className="h-5 w-5" />} />
        <StatCard metric={{ label: "Cost Codes", value: String(project.costCodeCount), tone: "warning" }} icon={<Tags className="h-5 w-5" />} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle>Project Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <Summary label="Customer" value={project.customerName ?? "-"} />
            <Summary label="Status" value={<Badge tone={project.status === "active" ? "success" : "neutral"}>{project.status}</Badge>} />
            <Summary label="Project Manager" value={project.projectManagerName ?? "Unassigned"} />
            <Summary label="Primary Department" value={project.primaryDepartmentName ?? "Unassigned"} />
            <Summary label="Start Date" value={project.startDate ?? "-"} />
            <Summary label="End Date" value={project.endDate ?? "-"} />
            <Summary label="Geofence" value={`${project.geofenceRadius} m`} />
            <Summary label="Budget" value={new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(project.projectBudget)} />
            <div className="md:col-span-2"><Summary label="Description" value={project.description ?? "-"} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Manage Links</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Link to={`/projects/${project.id}/users`}><Button className="w-full" variant="secondary">Assign Users</Button></Link>
            <Link to={`/projects/${project.id}/departments`}><Button className="w-full" variant="secondary">Assign Departments</Button></Link>
            <Link to={`/projects/${project.id}/cost-codes`}><Button className="w-full" variant="secondary">Manage Cost Codes</Button></Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-text-secondary">{label}</p>
      <div className="mt-1 font-semibold text-text-primary">{value}</div>
    </div>
  );
}
