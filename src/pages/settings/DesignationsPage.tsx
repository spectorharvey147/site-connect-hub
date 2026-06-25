import { BadgeCheck, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { departmentService } from "@/services/departmentService";
import { designationService } from "@/services/designationService";
import { organizationService } from "@/services/organizationService";
import type {
  Department,
  Designation,
  DesignationInput,
  Organization,
} from "@/types/organization";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function emptyForm(organizationId: string): DesignationInput {
  return {
    organizationId,
    designationCode: "",
    designationName: "",
    levelRank: 10,
    description: "",
    status: "active",
  };
}

export function DesignationsPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [form, setForm] = useState<DesignationInput | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const org = await organizationService.getCurrentOrganization();
    const [departmentList, designationList] = await Promise.all([
      departmentService.getDepartments(org.id),
      designationService.getDesignations(org.id),
    ]);
    setOrganization(org);
    setDepartments(departmentList);
    setDesignations(designationList);
    setForm(emptyForm(org.id));
  }

  if (!user || !organization || !form) {
    return null;
  }

  function update<Key extends keyof DesignationInput>(
    key: Key,
    value: DesignationInput[Key],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveDesignation() {
    if (!form || !organization || !user) {
      return;
    }
    setSaving(true);
    try {
      await designationService.createDesignation(form, user);
      setForm(emptyForm(organization.id));
      await load();
      toast.success("Designation created.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save designation.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(designationId: string) {
    if (!user) {
      return;
    }
    try {
      await designationService.deactivateDesignation(designationId, user);
      await load();
      toast.success("Designation deactivated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to deactivate designation.",
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Designation Master"
        description="Manage designations, optional department links and hierarchy level ranks."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Settings", to: "/settings" },
          { label: "Designations" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-brand-blue" />
              Add Designation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Designation Code"
                value={form.designationCode}
                onChange={(event) => update("designationCode", event.target.value)}
              />
              <Input
                label="Designation Name"
                value={form.designationName}
                onChange={(event) => update("designationName", event.target.value)}
              />
              <FormField label="Department">
                <select
                  className={selectClass}
                  value={form.departmentId ?? ""}
                  onChange={(event) =>
                    update("departmentId", event.target.value || undefined)
                  }
                >
                  <option value="">Any department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.departmentName}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Hierarchy Rank"
                type="number"
                value={form.levelRank}
                onChange={(event) => update("levelRank", Number(event.target.value))}
              />
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
              onClick={() => void saveDesignation()}
            >
              Save Designation
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Designation List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Code</th>
                    <th className="px-4 py-3 font-semibold">Designation</th>
                    <th className="px-4 py-3 font-semibold">Department</th>
                    <th className="px-4 py-3 font-semibold">Rank</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border bg-white">
                  {designations.map((designation) => (
                    <tr key={designation.id}>
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        {designation.designationCode}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-text-primary">
                          {designation.designationName}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {designation.description || "No description"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {departments.find(
                          (department) => department.id === designation.departmentId,
                        )?.departmentName ?? "Any"}
                      </td>
                      <td className="px-4 py-3">{designation.levelRank}</td>
                      <td className="px-4 py-3">
                        <Badge tone={designation.status === "active" ? "success" : "neutral"}>
                          {designation.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={designation.status === "inactive"}
                          onClick={() => void deactivate(designation.id)}
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
