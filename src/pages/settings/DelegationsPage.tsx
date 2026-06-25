import { Repeat2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { delegationService } from "@/services/delegationService";
import { organizationService } from "@/services/organizationService";
import { userHierarchyService } from "@/services/userHierarchyService";
import type { AppUser } from "@/types/auth";
import type {
  ApprovalDelegation,
  ApprovalDelegationInput,
  ApprovalWorkflowType,
  Organization,
} from "@/types/organization";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

const workflowTypes: Array<ApprovalWorkflowType | ""> = [
  "",
  "claim",
  "leave",
  "material_request",
  "vendor_bill",
  "dpr",
  "attendance_correction",
];

function emptyForm(organizationId: string): ApprovalDelegationInput {
  const today = new Date().toISOString().slice(0, 10);
  return {
    organizationId,
    fromUserId: "",
    delegatedToUserId: "",
    startDate: today,
    endDate: today,
    reason: "",
    status: "active",
  };
}

export function DelegationsPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [delegations, setDelegations] = useState<ApprovalDelegation[]>([]);
  const [form, setForm] = useState<ApprovalDelegationInput | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const org = await organizationService.getCurrentOrganization();
    const [userList, delegationList] = await Promise.all([
      userHierarchyService.listUsers(org.id),
      delegationService.getActiveDelegations(org.id),
    ]);
    setOrganization(org);
    setUsers(userList);
    setDelegations(delegationList);
    setForm(emptyForm(org.id));
  }

  if (!user || !organization || !form) {
    return null;
  }

  function update<Key extends keyof ApprovalDelegationInput>(
    key: Key,
    value: ApprovalDelegationInput[Key],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveDelegation() {
    if (!form || !organization || !user) {
      return;
    }
    setSaving(true);
    try {
      await delegationService.createDelegation(form, user);
      setForm(emptyForm(organization.id));
      await load();
      toast.success("Delegation created.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save delegation.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(delegationId: string) {
    if (!user) {
      return;
    }
    try {
      await delegationService.deactivateDelegation(delegationId, user);
      await load();
      toast.success("Delegation deactivated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to deactivate delegation.",
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Approval Delegations"
        description="Assign alternate approvers for a date range and optional workflow type."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Settings", to: "/settings" },
          { label: "Delegations" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Repeat2 className="h-4 w-4 text-brand-blue" />
              Create Delegation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="From User">
                <select
                  className={selectClass}
                  value={form.fromUserId}
                  onChange={(event) => update("fromUserId", event.target.value)}
                >
                  <option value="">Select approver</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Delegated To">
                <select
                  className={selectClass}
                  value={form.delegatedToUserId}
                  onChange={(event) =>
                    update("delegatedToUserId", event.target.value)
                  }
                >
                  <option value="">Select alternate</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Workflow Type">
                <select
                  className={selectClass}
                  value={form.workflowType ?? ""}
                  onChange={(event) =>
                    update(
                      "workflowType",
                      (event.target.value || undefined) as
                        | ApprovalWorkflowType
                        | undefined,
                    )
                  }
                >
                  {workflowTypes.map((workflow) => (
                    <option key={workflow || "all"} value={workflow}>
                      {workflow ? workflow.split("_").join(" ") : "All workflows"}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Start Date"
                type="date"
                value={form.startDate}
                onChange={(event) => update("startDate", event.target.value)}
              />
              <Input
                label="End Date"
                type="date"
                value={form.endDate}
                onChange={(event) => update("endDate", event.target.value)}
              />
              <Input
                label="Reason"
                value={form.reason}
                onChange={(event) => update("reason", event.target.value)}
              />
            </div>
            <Button
              type="button"
              leftIcon={<Save className="h-4 w-4" />}
              isLoading={saving}
              onClick={() => void saveDelegation()}
            >
              Save Delegation
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Delegations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {delegations.map((delegation) => (
                <div
                  key={delegation.id}
                  className="rounded-lg border border-surface-border bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-text-primary">
                        {delegation.fromUserName ?? delegation.fromUserId} to{" "}
                        {delegation.delegatedToUserName ??
                          delegation.delegatedToUserId}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {delegation.workflowType
                          ? delegation.workflowType.split("_").join(" ")
                          : "All workflows"}{" "}
                        | {delegation.startDate} to {delegation.endDate}
                      </p>
                      <p className="mt-2 text-sm text-text-secondary">
                        {delegation.reason}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="success">{delegation.status}</Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void deactivate(delegation.id)}
                      >
                        Deactivate
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {delegations.length === 0 ? (
                <p className="rounded-lg border border-dashed border-surface-border p-4 text-sm text-text-secondary">
                  No active delegations.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
