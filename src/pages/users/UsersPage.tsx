import {
  GitBranch,
  MailPlus,
  Save,
  ShieldCheck,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ROLE_OPTIONS, ROLE_SHORT_LABELS } from "@/constants/roles";
import { useAuth } from "@/hooks/useAuth";
import { departmentService } from "@/services/departmentService";
import { designationService } from "@/services/designationService";
import { organizationService } from "@/services/organizationService";
import { projectService } from "@/services/projectService";
import { usersService } from "@/services/usersService";
import type { AppUser, EmploymentType, Role, UserStatus } from "@/types/auth";
import type {
  Department,
  Designation,
  Organization,
} from "@/types/organization";
import type { ProjectMaster } from "@/types/projects";
import type {
  ManagedUser,
  UserInviteInput,
  UserManagementSummary,
} from "@/types/users";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

const statusTone: Record<UserStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  active: "success",
  inactive: "neutral",
  invited: "info",
  locked: "danger",
  suspended: "warning",
};

function initialInvite(
  organizationId: string,
  departments: Department[],
  projects: ProjectMaster[],
): UserInviteInput {
  const department = departments[0];
  const primaryProjectId = projects[0]?.id ?? "";
  return {
    organizationId,
    employeeCode: "",
    firstName: "",
    lastName: "",
    fullName: "",
    email: "",
    phone: "",
    role: "site_staff",
    department: department?.departmentName ?? "",
    departmentId: department?.id ?? "",
    designationId: "",
    reportingManagerId: "",
    hodUserId: department?.hodUserId,
    primaryProjectId,
    employmentType: "permanent",
    projectIds: primaryProjectId ? [primaryProjectId] : [],
  };
}

export function UsersPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [projects, setProjects] = useState<ProjectMaster[]>([]);
  const [summary, setSummary] = useState<UserManagementSummary | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [invite, setInvite] = useState<UserInviteInput | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === invite?.departmentId),
    [departments, invite?.departmentId],
  );
  const managerOptions = users.filter((item) =>
    ["manager", "hod", "super_admin"].includes(item.role),
  );
  const hodOptions = users.filter((item) =>
    ["hod", "super_admin"].includes(item.role),
  );

  const load = useCallback(async (currentUser: AppUser) => {
    const org = await organizationService.getCurrentOrganization();
    const [departmentList, designationList, projectList, dashboard] = await Promise.all([
      departmentService.getDepartments(org.id),
      designationService.getDesignations(org.id),
      projectService.getProjects(org.id),
      usersService.getDashboard(currentUser),
    ]);
    setOrganization(org);
    setDepartments(departmentList);
    setDesignations(designationList);
    setProjects(projectList);
    setSummary(dashboard.summary);
    setUsers(dashboard.users);
    setInvite(
      (current) => current ?? initialInvite(org.id, departmentList, projectList),
    );
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }
    void load(user);
  }, [load, user]);

  if (!user || !summary || !organization || !invite) {
    return null;
  }

  function updateInvite<Key extends keyof UserInviteInput>(
    key: Key,
    value: UserInviteInput[Key],
  ) {
    setInvite((current) => {
      if (!current) {
        return current;
      }
      const next = { ...current, [key]: value };
      if (key === "departmentId") {
        const department = departments.find((item) => item.id === value);
        next.department = department?.departmentName ?? "";
        next.hodUserId = department?.hodUserId;
      }
      if (key === "primaryProjectId") {
        next.projectIds = value ? [String(value)] : [];
      }
      return next;
    });
  }

  async function sendInvite() {
    if (!invite || !organization || !user) {
      return;
    }
    setSaving(true);
    try {
      await usersService.inviteUser(invite, user);
      setInvite(initialInvite(organization.id, departments, projects));
      await load(user);
      toast.success("User invitation created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to invite user.");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(
    targetId: string,
    patch: {
      role?: Role;
      status?: UserStatus;
      departmentId?: string;
      reportingManagerId?: string;
      hodUserId?: string;
      projectIds?: string[];
    },
  ) {
    if (!user) {
      return;
    }
    try {
      await usersService.updateUser(targetId, patch, user);
      await load(user);
      toast.success("User updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update user.");
    }
  }

  return (
    <>
      <PageHeader
        title="User Management"
        description="Invite users, assign roles, departments, designations, reporting managers, HODs and project access."
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Users" }]}
        action={
          <div className="flex gap-2">
            <Link to="/users/hierarchy">
              <Button type="button" variant="secondary" leftIcon={<GitBranch className="h-4 w-4" />}>Hierarchy</Button>
            </Link>
            <Link to="/users/new">
              <Button type="button" leftIcon={<MailPlus className="h-4 w-4" />}>Create User</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          metric={{ label: "Total users", value: String(summary.totalUsers), tone: "info" }}
          icon={<UsersRound className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Active users",
            value: String(summary.activeUsers),
            tone: "success",
          }}
          icon={<UserCheck className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Invited users",
            value: String(summary.invitedUsers),
            tone: "warning",
          }}
          icon={<MailPlus className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Admin/HOD users",
            value: String(summary.adminUsers),
            tone: "neutral",
          }}
          icon={<ShieldCheck className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Invite User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-100 bg-brand-light p-3 text-xs leading-5 text-text-secondary">
              <p>Reporting Manager controls first-level approval.</p>
              <p>HOD controls department-level approval.</p>
              <p>Super Admin controls system-wide settings.</p>
              <p>Accounts can process payments after approvals.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Organization"
                value={organization.organizationName}
                disabled
              />
              <Input
                label="Employee Code"
                value={invite.employeeCode}
                onChange={(event) =>
                  updateInvite("employeeCode", event.target.value)
                }
              />
              <Input
                label="First Name"
                value={invite.firstName}
                onChange={(event) => updateInvite("firstName", event.target.value)}
              />
              <Input
                label="Last Name"
                value={invite.lastName}
                onChange={(event) => updateInvite("lastName", event.target.value)}
              />
              <Input
                label="Email"
                value={invite.email}
                onChange={(event) => updateInvite("email", event.target.value)}
              />
              <Input
                label="Phone"
                value={invite.phone}
                onChange={(event) => updateInvite("phone", event.target.value)}
              />
              <FormField label="Role">
                <select
                  className={selectClass}
                  value={invite.role}
                  onChange={(event) =>
                    updateInvite("role", event.target.value as Role)
                  }
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Department">
                <select
                  className={selectClass}
                  value={invite.departmentId}
                  onChange={(event) =>
                    updateInvite("departmentId", event.target.value)
                  }
                >
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.departmentName}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Designation">
                <select
                  className={selectClass}
                  value={invite.designationId ?? ""}
                  onChange={(event) =>
                    updateInvite("designationId", event.target.value || undefined)
                  }
                >
                  <option value="">Select designation</option>
                  {designations
                    .filter(
                      (designation) =>
                        !designation.departmentId ||
                        designation.departmentId === invite.departmentId,
                    )
                    .map((designation) => (
                      <option key={designation.id} value={designation.id}>
                        {designation.designationName}
                      </option>
                    ))}
                </select>
              </FormField>
              <FormField label="Reporting Manager">
                <select
                  className={selectClass}
                  value={invite.reportingManagerId ?? ""}
                  onChange={(event) =>
                    updateInvite(
                      "reportingManagerId",
                      event.target.value || undefined,
                    )
                  }
                >
                  <option value="">No reporting manager</option>
                  {managerOptions.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.fullName}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="HOD">
                <select
                  className={selectClass}
                  value={invite.hodUserId ?? selectedDepartment?.hodUserId ?? ""}
                  onChange={(event) =>
                    updateInvite("hodUserId", event.target.value || undefined)
                  }
                >
                  <option value="">Assign later</option>
                  {hodOptions.map((hod) => (
                    <option key={hod.id} value={hod.id}>
                      {hod.fullName}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Primary Project">
                <select
                  className={selectClass}
                  value={invite.primaryProjectId ?? ""}
                  onChange={(event) =>
                    updateInvite("primaryProjectId", event.target.value)
                  }
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Employment Type">
                <select
                  className={selectClass}
                  value={invite.employmentType}
                  onChange={(event) =>
                    updateInvite(
                      "employmentType",
                      event.target.value as EmploymentType,
                    )
                  }
                >
                  {["permanent", "contract", "casual"].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <Button
              type="button"
              leftIcon={<MailPlus className="h-4 w-4" />}
              isLoading={saving}
              onClick={() => void sendInvite()}
            >
              Invite User
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Register</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Department</th>
                    <th className="px-4 py-3 font-semibold">Manager / HOD</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border bg-white">
                  {users.map((managedUser) => (
                    <tr key={managedUser.id}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-text-primary">
                          {managedUser.fullName}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {managedUser.employeeCode ?? managedUser.employeeId} |{" "}
                          {managedUser.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={managedUser.role === "hod" ? "warning" : "info"}>
                          {ROLE_SHORT_LABELS[managedUser.role]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {managedUser.department ?? "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        <p>
                          Manager:{" "}
                          {users.find(
                            (item) => item.id === managedUser.reportingManagerId,
                          )?.fullName ?? "None"}
                        </p>
                        <p className="mt-1">
                          HOD:{" "}
                          {users.find((item) => item.id === managedUser.hodUserId)
                            ?.fullName ?? "None"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone[managedUser.status]}>
                          {managedUser.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link to={`/users/${managedUser.id}`}>
                            <Button type="button" size="sm" variant="secondary">
                              View
                            </Button>
                          </Link>
                          <Link to={`/users/${managedUser.id}/assign-projects`}>
                            <Button type="button" size="sm" variant="secondary">
                              Projects
                            </Button>
                          </Link>
                          <select
                            className="h-9 rounded-md border border-[#D0D0D0] bg-white px-2 text-xs"
                            value={managedUser.role}
                            onChange={(event) =>
                              void updateUser(managedUser.id, {
                                role: event.target.value as Role,
                              })
                            }
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.shortLabel}
                              </option>
                            ))}
                          </select>
                          <select
                            className="h-9 rounded-md border border-[#D0D0D0] bg-white px-2 text-xs"
                            value={managedUser.status}
                            onChange={(event) =>
                              void updateUser(managedUser.id, {
                                status: event.target.value as UserStatus,
                              })
                            }
                          >
                            {["active", "inactive", "invited", "locked", "suspended"].map(
                              (status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ),
                            )}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            leftIcon={<Save className="h-4 w-4" />}
                            onClick={() =>
                              void updateUser(managedUser.id, {
                                projectIds: managedUser.projectIds,
                              })
                            }
                          >
                            Save
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
