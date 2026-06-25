import { Link2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { projectService } from "@/services/projectService";
import { usersService } from "@/services/usersService";
import type {
  ProjectAssignmentType,
  ProjectMaster,
  ProjectUserAssignment,
} from "@/types/projects";
import type { ManagedUser } from "@/types/users";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function UserProjectAssignmentPage() {
  const { userId } = useParams();
  const { user: actor } = useAuth();
  const [target, setTarget] = useState<ManagedUser | null>(null);
  const [projects, setProjects] = useState<ProjectMaster[]>([]);
  const [assignments, setAssignments] = useState<ProjectUserAssignment[]>([]);
  const [projectId, setProjectId] = useState("");
  const [assignmentType, setAssignmentType] =
    useState<ProjectAssignmentType>("secondary");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!actor || !userId) {
      return;
    }
    const [profile, projectRows, assignmentRows] = await Promise.all([
      usersService.getUserById(userId, actor),
      projectService.getProjects(actor.organizationId),
      projectService.getUserProjects(userId),
    ]);
    setTarget(profile);
    setProjects(projectRows);
    setAssignments(assignmentRows);
    setProjectId((current) => current || projectRows[0]?.id || "");
  }, [actor, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!actor || !target) {
    return null;
  }

  async function assign() {
    const currentActor = actor;
    const currentTarget = target;
    if (!currentActor || !currentTarget || !projectId || !currentTarget.organizationId) {
      toast.error("Select a project.");
      return;
    }
    setSaving(true);
    try {
      await projectService.assignUser(
        {
          organizationId: currentTarget.organizationId,
          userId: currentTarget.id,
          projectId,
          departmentId: currentTarget.departmentId,
          assignmentType,
          startDate,
          endDate: endDate || undefined,
          status: "active",
        },
        currentActor,
      );
      await load();
      toast.success("Project assigned.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to assign project.");
    } finally {
      setSaving(false);
    }
  }

  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  return (
    <>
      <PageHeader
        title={`Project Assignments: ${target.fullName}`}
        description="Maintain primary, secondary and temporary site access."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Users", to: "/users" },
          { label: target.fullName, to: `/users/${target.id}` },
          { label: "Projects" },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Assign Project</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Project">
              <select className={selectClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">Select project</option>
                {projects.filter((project) => project.status === "active").map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Assignment Type">
              <select className={selectClass} value={assignmentType} onChange={(event) => setAssignmentType(event.target.value as ProjectAssignmentType)}>
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="temporary">Temporary</option>
              </select>
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Start Date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              <Input label="End Date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <Button type="button" leftIcon={<Link2 className="h-4 w-4" />} isLoading={saving} onClick={() => void assign()}>
              Assign Project
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Assignment History</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="grid gap-2 border-b border-surface-border pb-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <p className="font-semibold text-text-primary">{projectNames.get(assignment.projectId) ?? assignment.projectId}</p>
                  <p className="text-xs text-text-secondary">{assignment.startDate}{assignment.endDate ? ` to ${assignment.endDate}` : ""}</p>
                </div>
                <Badge tone="info">{assignment.assignmentType}</Badge>
                <Badge tone={assignment.status === "active" ? "success" : "neutral"}>{assignment.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
