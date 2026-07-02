import { Edit3, FileSignature, FolderKanban, Mail, PlusCircle, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ROLE_SHORT_LABELS } from "@/constants/roles";
import { useAuth } from "@/hooks/useAuth";
import { projectService } from "@/services/projectService";
import { usersService } from "@/services/usersService";
import type { ProjectMaster, ProjectUserAssignment } from "@/types/projects";
import type { ManagedUser } from "@/types/users";

export function UserDetailPage() {
  const { userId } = useParams();
  const { user: actor } = useAuth();
  const [target, setTarget] = useState<ManagedUser | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [projects, setProjects] = useState<ProjectMaster[]>([]);
  const [assignments, setAssignments] = useState<ProjectUserAssignment[]>([]);
  const [resending, setResending] = useState(false);

  const load = useCallback(async () => {
    if (!actor || !userId) {
      return;
    }
    const [profile, dashboard, projectRows, assignmentRows] = await Promise.all([
      usersService.getUserById(userId, actor),
      usersService.getDashboard(actor),
      projectService.getProjects(actor.organizationId),
      projectService.getUserProjects(userId),
    ]);
    setTarget(profile);
    setUsers(dashboard.users);
    setProjects(projectRows);
    setAssignments(assignmentRows);
  }, [actor, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const projectRows = useMemo(() => {
    const names = new Map(projects.map((project) => [project.id, project.name]));
    return assignments.map((assignment) => ({
      ...assignment,
      projectName: names.get(assignment.projectId) ?? assignment.projectId,
    }));
  }, [assignments, projects]);

  if (!target) {
    return null;
  }

  const manager = users.find((item) => item.id === target.reportingManagerId);
  const hod = users.find((item) => item.id === target.hodUserId);

  return (
    <>
      <PageHeader
        title={target.fullName}
        description={`${target.employeeCode ?? target.employeeId} | ${target.email}`}
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Users", to: "/users" },
          { label: target.fullName },
        ]}
        action={
          <div className="flex gap-2">
            {target.status === "invited" ? (
              <Button
                variant="secondary"
                disabled={resending}
                leftIcon={<Mail className="h-4 w-4" />}
                onClick={async () => {
                  if (!actor) return;
                  setResending(true);
                  try {
                    await usersService.resendInvite(target.id, actor);
                    toast.success("Invitation setup link resent.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Unable to resend invitation.");
                  } finally {
                    setResending(false);
                  }
                }}
              >
                {resending ? "Sending..." : "Resend Invite"}
              </Button>
            ) : null}
            <Link to={`/accounts/employee-ledger/${target.id}`}>
              <Button variant="secondary" leftIcon={<WalletCards className="h-4 w-4" />}>
                Finance Ledger
              </Button>
            </Link>
            {actor && ["accounts_officer", "super_admin"].includes(actor.role) ? (
              <Link to={`/users/${target.id}/advance`}>
                <Button variant="secondary" leftIcon={<PlusCircle className="h-4 w-4" />}>Add Advance</Button>
              </Link>
            ) : null}
            {actor && ["admin_hr", "super_admin"].includes(actor.role) ? (
              <Link to={`/users/${target.id}/signature`}>
                <Button variant="secondary" leftIcon={<FileSignature className="h-4 w-4" />}>Manage Signature</Button>
              </Link>
            ) : null}
            <Link to={`/users/${target.id}/assign-projects`}>
              <Button
                variant="secondary"
                leftIcon={<FolderKanban className="h-4 w-4" />}
              >
                Assign Projects
              </Button>
            </Link>
            <Link to={`/users/${target.id}/edit`}>
              <Button leftIcon={<Edit3 className="h-4 w-4" />}>Edit User</Button>
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profile Summary</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <Summary label="Role" value={<Badge tone="info">{ROLE_SHORT_LABELS[target.role]}</Badge>} />
            <Summary label="Status" value={<Badge tone={target.status === "active" ? "success" : "neutral"}>{target.status}</Badge>} />
            <Summary label="Department" value={target.department ?? "Unassigned"} />
            <Summary label="Employment Type" value={target.employmentType ?? "-"} />
            <Summary label="Reporting Manager" value={manager?.fullName ?? "None"} />
            <Summary label="HOD" value={hod?.fullName ?? "None"} />
            <Summary label="Phone" value={target.phone ?? "-"} />
            <Summary label="Joining Date" value={target.joiningDate ?? "-"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Assigned Projects</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {projectRows.map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between border-b border-surface-border pb-3">
                <div>
                  <p className="font-semibold text-text-primary">{assignment.projectName}</p>
                  <p className="text-xs text-text-secondary">{assignment.assignmentType} | from {assignment.startDate}</p>
                </div>
                <Badge tone={assignment.status === "active" ? "success" : "neutral"}>{assignment.status}</Badge>
              </div>
            ))}
            {!projectRows.length ? <p className="text-sm text-text-secondary">No project assignments.</p> : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Summary({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-text-secondary">{label}</p>
      <div className="mt-1 font-semibold text-text-primary">{value}</div>
    </div>
  );
}
