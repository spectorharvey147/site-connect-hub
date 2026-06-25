import { GitBranch, Save, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { approvalMatrixService } from "@/services/approvalMatrixService";
import { departmentService } from "@/services/departmentService";
import { organizationService } from "@/services/organizationService";
import type {
  ApprovalApproverRole,
  ApprovalMatrixInput,
  ApprovalMatrixRule,
  ApprovalPathStep,
  ApprovalWorkflowType,
  Department,
  Organization,
} from "@/types/organization";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

const workflowTypes: ApprovalWorkflowType[] = [
  "claim",
  "leave",
  "material_request",
  "vendor_bill",
  "dpr",
  "attendance_correction",
];

const approverRoles: ApprovalApproverRole[] = [
  "admin",
  "manager",
  "hod",
  "super_admin",
  "accounts",
  "store_admin",
  "finance_head",
];

function emptyForm(organizationId: string): ApprovalMatrixInput {
  return {
    organizationId,
    workflowType: "claim",
    levels: [{ role: "admin" }, { role: "manager" }, { role: "hod" }],
    finalApprovalRole: "hod",
    isActive: true,
  };
}

export function ApprovalMatrixPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rules, setRules] = useState<ApprovalMatrixRule[]>([]);
  const [form, setForm] = useState<ApprovalMatrixInput | null>(null);
  const [preview, setPreview] = useState<ApprovalPathStep[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const org = await organizationService.getCurrentOrganization();
    const [departmentList, ruleList] = await Promise.all([
      departmentService.getDepartments(org.id),
      approvalMatrixService.getApprovalRules(org.id),
    ]);
    setOrganization(org);
    setDepartments(departmentList);
    setRules(ruleList);
    setForm(emptyForm(org.id));
  }

  if (!user || !organization || !form) {
    return null;
  }

  function update<Key extends keyof ApprovalMatrixInput>(
    key: Key,
    value: ApprovalMatrixInput[Key],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateLevel(index: number, role: ApprovalApproverRole | "") {
    setForm((current) => {
      if (!current) {
        return current;
      }
      const levels = [...current.levels];
      if (!role) {
        levels.splice(index, 1);
      } else {
        levels[index] = { role };
      }
      return { ...current, levels: levels.filter(Boolean) };
    });
  }

  async function saveRule() {
    if (!form || !organization || !user) {
      return;
    }
    setSaving(true);
    try {
      await approvalMatrixService.createApprovalRule(form, user);
      setForm(emptyForm(organization.id));
      setPreview([]);
      await load();
      toast.success("Approval rule created.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save approval rule.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function previewRule() {
    if (!form || !organization || !user) {
      return;
    }
    try {
      const result = await approvalMatrixService.previewApprovalPath({
        organizationId: organization.id,
        workflowType: form.workflowType,
        requesterUserId: user.id,
        departmentId: form.departmentId || user.departmentId,
        amount: form.minAmount ?? 10000,
      });
      setPreview(result.steps);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to preview path.",
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Approval Matrix"
        description="Configure department, project and amount-based workflow rules with role or user-specific levels."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Settings", to: "/settings" },
          { label: "Approval Matrix" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-brand-blue" />
              Create Workflow Rule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Workflow Type">
                <select
                  className={selectClass}
                  value={form.workflowType}
                  onChange={(event) =>
                    update("workflowType", event.target.value as ApprovalWorkflowType)
                  }
                >
                  {workflowTypes.map((workflow) => (
                    <option key={workflow} value={workflow}>
                      {workflow.split("_").join(" ")}
                    </option>
                  ))}
                </select>
              </FormField>
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
                label="Minimum Amount"
                type="number"
                value={form.minAmount ?? ""}
                onChange={(event) =>
                  update(
                    "minAmount",
                    event.target.value ? Number(event.target.value) : undefined,
                  )
                }
              />
              <Input
                label="Maximum Amount"
                type="number"
                value={form.maxAmount ?? ""}
                onChange={(event) =>
                  update(
                    "maxAmount",
                    event.target.value ? Number(event.target.value) : undefined,
                  )
                }
              />
              {[0, 1, 2, 3].map((index) => (
                <FormField key={index} label={`Approval Level ${index + 1}`}>
                  <select
                    className={selectClass}
                    value={form.levels[index]?.role ?? ""}
                    onChange={(event) =>
                      updateLevel(
                        index,
                        event.target.value as ApprovalApproverRole | "",
                      )
                    }
                  >
                    <option value="">Not used</option>
                    {approverRoles.map((role) => (
                      <option key={role} value={role}>
                        {role.split("_").join(" ")}
                      </option>
                    ))}
                  </select>
                </FormField>
              ))}
              <FormField label="Final Approval Role">
                <select
                  className={selectClass}
                  value={form.finalApprovalRole}
                  onChange={(event) =>
                    update(
                      "finalApprovalRole",
                      event.target.value as ApprovalApproverRole,
                    )
                  }
                >
                  {approverRoles.map((role) => (
                    <option key={role} value={role}>
                      {role.split("_").join(" ")}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                leftIcon={<Save className="h-4 w-4" />}
                isLoading={saving}
                onClick={() => void saveRule()}
              >
                Save Rule
              </Button>
              <Button
                type="button"
                variant="secondary"
                leftIcon={<Wand2 className="h-4 w-4" />}
                onClick={() => void previewRule()}
              >
                Preview Path
              </Button>
            </div>
            {preview.length > 0 ? (
              <div className="rounded-lg border border-surface-border bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-normal text-text-secondary">
                  Preview
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {preview.map((step) => (
                    <Badge key={step.id} tone="info">
                      {step.sequence}. {step.label}
                      {step.userName ? ` - ${step.userName}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-lg border border-surface-border bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold capitalize text-text-primary">
                        {rule.workflowType.split("_").join(" ")}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {rule.departmentId
                          ? departments.find(
                              (department) => department.id === rule.departmentId,
                            )?.departmentName
                          : "Any department"}{" "}
                        | {rule.minAmount ?? 0} to {rule.maxAmount ?? "No limit"}
                      </p>
                    </div>
                    <Badge tone={rule.isActive ? "success" : "neutral"}>
                      {rule.isActive ? "active" : "inactive"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {rule.levels.map((level, index) => (
                      <Badge key={`${rule.id}-${index}`} tone="info">
                        {index + 1}. {level.role.split("_").join(" ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
