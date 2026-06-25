import { Save, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ROLE_OPTIONS } from "@/constants/roles";
import { useAuth } from "@/hooks/useAuth";
import { departmentService } from "@/services/departmentService";
import { organizationService } from "@/services/organizationService";
import { projectService } from "@/services/projectService";
import { usersService } from "@/services/usersService";
import type { EmploymentType, Role, UserStatus } from "@/types/auth";
import type { Department } from "@/types/organization";
import type { ProjectMaster } from "@/types/projects";
import type { ManagedUser, UserInviteInput } from "@/types/users";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function UserFormPage({ mode }: { mode: "create" | "edit" }) {
  const { user } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<ProjectMaster[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState<UserInviteInput | null>(null);
  const [status, setStatus] = useState<UserStatus>("active");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const organization = await organizationService.getCurrentOrganization();
      const [departmentList, projectList, userList] = await Promise.all([
        departmentService.getDepartments(organization.id),
        projectService.getProjects(organization.id),
        usersService.listUsers(user),
      ]);
      setDepartments(departmentList);
      setProjects(projectList);
      setUsers(userList);
      const target = mode === "edit" && userId
        ? await usersService.getUserById(userId, user)
        : null;
      const departmentId = target?.departmentId ?? departmentList[0]?.id ?? "";
      const primaryProjectId = target?.primaryProjectId ?? projectList[0]?.id ?? "";
      setStatus(target?.status ?? "active");
      setForm({
        organizationId: organization.id,
        employeeCode: target?.employeeCode ?? "",
        firstName: target?.firstName ?? target?.fullName.split(" ")[0] ?? "",
        lastName: target?.lastName ?? target?.fullName.split(" ").slice(1).join(" ") ?? "",
        fullName: target?.fullName ?? "",
        email: target?.email ?? "",
        phone: target?.phone ?? "",
        role: target?.role ?? "site_staff",
        department: target?.department ?? departmentList[0]?.departmentName ?? "",
        departmentId,
        designationId: target?.designationId,
        reportingManagerId: target?.reportingManagerId ?? "",
        hodUserId: target?.hodUserId,
        primaryProjectId,
        employmentType: target?.employmentType ?? "permanent",
        joiningDate: target?.joiningDate,
        projectIds: target?.projectIds.length ? target.projectIds : primaryProjectId ? [primaryProjectId] : [],
        password: "",
      });
    })().catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load user form."));
  }, [mode, user, userId]);

  if (!user || !form) return null;
  const update = <K extends keyof UserInviteInput>(key: K, value: UserInviteInput[K]) =>
    setForm((current) => current ? { ...current, [key]: value } : current);

  async function save() {
    if (!user || !form) return;
    setSaving(true);
    try {
      if (mode === "create") {
        await usersService.inviteUser(form, user);
        toast.success(form.password ? "Active user created." : "User invitation sent.");
      } else if (userId) {
        await usersService.updateUser(userId, {
          role: form.role,
          status,
          departmentId: form.departmentId,
          designationId: form.designationId,
          reportingManagerId: form.reportingManagerId,
          hodUserId: form.hodUserId,
          primaryProjectId: form.primaryProjectId,
          projectIds: form.projectIds,
          employmentType: form.employmentType,
        }, user);
        toast.success("User profile updated.");
      }
      navigate("/users");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={mode === "create" ? "Create User" : "Edit User"}
        description="Maintain identity, role, reporting line and project access."
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Users", to: "/users" }, { label: mode === "create" ? "Create" : "Edit" }]}
      />
      <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
        <Input label="Employee code" value={form.employeeCode} disabled={mode === "edit"} onChange={(event) => update("employeeCode", event.target.value)} />
        <Input label="Email" type="email" value={form.email} disabled={mode === "edit"} onChange={(event) => update("email", event.target.value)} />
        <Input label="First name" value={form.firstName} disabled={mode === "edit"} onChange={(event) => update("firstName", event.target.value)} />
        <Input label="Last name" value={form.lastName} disabled={mode === "edit"} onChange={(event) => update("lastName", event.target.value)} />
        <Input label="Phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
        {mode === "create" ? <Input label="Initial password (leave blank to invite)" type="password" value={form.password ?? ""} onChange={(event) => update("password", event.target.value)} /> : null}
        <Select label="Role" value={form.role} onChange={(value) => update("role", value as Role)} options={ROLE_OPTIONS.map((item) => [item.id, item.label])} />
        <Select label="Department" value={form.departmentId} onChange={(value) => update("departmentId", value)} options={departments.map((item) => [item.id, item.departmentName])} />
        <Select label="Reporting manager" value={form.reportingManagerId ?? ""} onChange={(value) => update("reportingManagerId", value || undefined)} options={[["", "No manager"], ...users.filter((item) => item.id !== userId).map((item) => [item.id, item.fullName])]} />
        <Select label="Primary project" value={form.primaryProjectId ?? ""} onChange={(value) => { update("primaryProjectId", value); update("projectIds", value ? [value] : []); }} options={[["", "No project"], ...projects.map((item) => [item.id, item.name])]} />
        <Select label="Employment type" value={form.employmentType} onChange={(value) => update("employmentType", value as EmploymentType)} options={[["permanent", "Permanent"], ["contract", "Contract"], ["casual", "Casual"]]} />
        {mode === "edit" ? <Select label="Status" value={status} onChange={(value) => setStatus(value as UserStatus)} options={[["active", "Active"], ["inactive", "Inactive"], ["suspended", "Suspended"], ["locked", "Locked"], ["invited", "Invited"]]} /> : null}
        <div className="md:col-span-2 flex justify-end"><Button type="button" onClick={save} disabled={saving} leftIcon={mode === "create" ? <UserPlus className="h-4 w-4" /> : <Save className="h-4 w-4" />}>{saving ? "Saving..." : "Save User"}</Button></div>
      </CardContent></Card>
    </>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <FormField label={label}><select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></FormField>;
}
