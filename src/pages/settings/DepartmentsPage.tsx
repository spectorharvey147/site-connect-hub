import { Building2, Save, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { departmentService } from "@/services/departmentService";
import { organizationService } from "@/services/organizationService";
import { userHierarchyService } from "@/services/userHierarchyService";
import type { AppUser } from "@/types/auth";
import type { Department, DepartmentInput, Organization } from "@/types/organization";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function emptyForm(organizationId: string): DepartmentInput {
  return {
    organizationId,
    departmentCode: "",
    departmentName: "",
    description: "",
    status: "active",
  };
}

export function DepartmentsPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [form, setForm] = useState<DepartmentInput | null>(null);
  const [saving, setSaving] = useState(false);

  const hodOptions = useMemo(
    () =>
      users.filter((item) =>
        ["hod", "manager", "super_admin"].includes(item.role),
      ),
    [users],
  );

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const org = await organizationService.getCurrentOrganization();
    const [departmentList, userList] = await Promise.all([
      departmentService.getDepartments(org.id),
      userHierarchyService.listUsers(org.id),
    ]);
    setOrganization(org);
    setDepartments(departmentList);
    setUsers(userList);
    setForm(emptyForm(org.id));
  }

  if (!user || !organization || !form) {
    return null;
  }

  function update<Key extends keyof DepartmentInput>(
    key: Key,
    value: DepartmentInput[Key],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveDepartment() {
    if (!form || !organization || !user) {
      return;
    }
    setSaving(true);
    try {
      await departmentService.createDepartment(form, user);
      setForm(emptyForm(organization.id));
      await load();
      toast.success("Department created.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save department.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(departmentId: string) {
    if (!user) {
      return;
    }
    try {
      await departmentService.deactivateDepartment(departmentId, user);
      await load();
      toast.success("Department deactivated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to deactivate department.",
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Department Master"
        description="Create nested departments, assign HODs and keep department status current."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Settings", to: "/settings" },
          { label: "Departments" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-blue" />
              Add Department
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Department Code"
                value={form.departmentCode}
                onChange={(event) => update("departmentCode", event.target.value)}
              />
              <Input
                label="Department Name"
                value={form.departmentName}
                onChange={(event) => update("departmentName", event.target.value)}
              />
              <FormField label="Parent Department">
                <select
                  className={selectClass}
                  value={form.parentDepartmentId ?? ""}
                  onChange={(event) =>
                    update("parentDepartmentId", event.target.value || undefined)
                  }
                >
                  <option value="">Root department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.departmentName}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="HOD">
                <select
                  className={selectClass}
                  value={form.hodUserId ?? ""}
                  onChange={(event) =>
                    update("hodUserId", event.target.value || undefined)
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
              <Input
                label="Description"
                value={form.description ?? ""}
                onChange={(event) => update("description", event.target.value)}
              />
            </div>
            <Button
              type="button"
              leftIcon={<Save className="h-4 w-4" />}
              isLoading={saving}
              onClick={() => void saveDepartment()}
            >
              Save Department
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Code</th>
                    <th className="px-4 py-3 font-semibold">Department</th>
                    <th className="px-4 py-3 font-semibold">Parent</th>
                    <th className="px-4 py-3 font-semibold">HOD</th>
                    <th className="px-4 py-3 font-semibold">Users</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border bg-white">
                  {departments.map((department) => (
                    <tr key={department.id}>
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        {department.departmentCode}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-text-primary">
                          {department.departmentName}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {department.description || "No description"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {departments.find(
                          (item) => item.id === department.parentDepartmentId,
                        )?.departmentName ?? "Root"}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        <span className="inline-flex items-center gap-1">
                          <UserRoundCheck className="h-3.5 w-3.5" />
                          {department.hodUserName ?? "Unassigned"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{department.userCount}</td>
                      <td className="px-4 py-3">
                        <Badge tone={department.status === "active" ? "success" : "neutral"}>
                          {department.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={department.status === "inactive"}
                          onClick={() => void deactivate(department.id)}
                        >
                          Deactivate
                        </Button>
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
