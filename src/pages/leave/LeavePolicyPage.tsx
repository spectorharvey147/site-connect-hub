import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { leaveService } from "@/services/leaveService";
import type { LeaveType } from "@/types/leave";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

const blankLeaveType: LeaveType = {
  id: "",
  code: "",
  name: "",
  annualAllowance: 0,
  carryForward: false,
  requiresDocument: false,
  status: "active",
};

export function LeavePolicyPage() {
  const { user } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState(() => leaveService.listLeaveTypes());
  const [form, setForm] = useState<LeaveType>(blankLeaveType);

  useEffect(() => {
    void leaveService.loadLeaveTypes().then(setLeaveTypes).catch((error) => {
      toast.error(error instanceof Error ? error.message : "Unable to load leave types.");
    });
  }, []);

  async function save() {
    if (!user) return;
    try {
      const saved = await leaveService.saveLeaveType(
        { ...form, id: form.id || crypto.randomUUID() },
        user,
      );
      setLeaveTypes(leaveService.listLeaveTypes());
      setForm(blankLeaveType);
      toast.success(`${saved.name} saved.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save leave type.");
    }
  }

  return (
    <>
      <PageHeader
        title="Leave Policy Master"
        description="Leave types, annual entitlement, carry-forward and document requirements."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Leave", to: "/leave" },
          { label: "Policies" },
        ]}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{form.id ? "Edit Leave Type" : "Add Leave Type"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Input label="Code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
          <Input label="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          <Input label="Annual days" type="number" min={0} value={form.annualAllowance} onChange={(event) => setForm((current) => ({ ...current, annualAllowance: Number(event.target.value) }))} />
          <FormField label="Carry forward">
            <select className={selectClass} value={form.carryForward ? "yes" : "no"} onChange={(event) => setForm((current) => ({ ...current, carryForward: event.target.value === "yes" }))}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </FormField>
          <FormField label="Document">
            <select className={selectClass} value={form.requiresDocument ? "required" : "optional"} onChange={(event) => setForm((current) => ({ ...current, requiresDocument: event.target.value === "required" }))}>
              <option value="optional">Optional</option>
              <option value="required">Required</option>
            </select>
          </FormField>
          <FormField label="Status">
            <select className={selectClass} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as LeaveType["status"] }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>
          <div className="md:col-span-3">
            <Button type="button" leftIcon={<Save className="h-4 w-4" />} onClick={() => void save()}>
              Save Leave Type
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leave Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-border text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                    Name
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                    Annual Days
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                    Carry Forward
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                    Document
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border bg-white">
                {leaveTypes.map((type) => (
                  <tr key={type.id} className="cursor-pointer hover:bg-brand-light/40" onClick={() => setForm(type)}>
                    <td className="px-4 py-3 font-bold text-brand-blue">
                      {type.code}
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      {type.name}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {type.annualAllowance}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {type.carryForward ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {type.requiresDocument ? "Required" : "Optional"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
