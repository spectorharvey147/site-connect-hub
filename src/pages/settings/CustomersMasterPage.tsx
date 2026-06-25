import { Pencil, Plus, Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import {
  customerService,
  type CustomerInput,
} from "@/services/customerService";
import type { Customer } from "@/types/projects";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";
const textareaClass =
  "min-h-24 w-full rounded-md border border-[#D0D0D0] bg-white px-3 py-2 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function emptyCustomer(organizationId: string): CustomerInput {
  return {
    organizationId,
    customerCode: "",
    customerName: "",
    contactPerson: "",
    email: "",
    phone: "",
    billingAddress: "",
    shippingAddress: "",
    city: "",
    state: "",
    gstNumber: "",
    paymentTerms: "",
    status: "active",
    remarks: "",
  };
}

export function CustomersMasterPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState<CustomerInput | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.organizationId) {
      return;
    }
    setCustomers(await customerService.getCustomers(user.organizationId));
    setForm((current) => current ?? emptyCustomer(user.organizationId ?? ""));
  }, [user?.organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user || !form) {
    return null;
  }

  function update<Key extends keyof CustomerInput>(
    key: Key,
    value: CustomerInput[Key],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function edit(customer: Customer) {
    setEditingId(customer.id);
    setForm({ ...customer });
  }

  function reset() {
    if (!user) {
      return;
    }
    setEditingId(undefined);
    setForm(emptyCustomer(user.organizationId ?? ""));
  }

  async function save() {
    const currentUser = user;
    const currentForm = form;
    if (!currentUser || !currentForm) {
      return;
    }
    setSaving(true);
    try {
      await customerService.saveCustomer(currentForm, currentUser, editingId);
      toast.success(editingId ? "Customer updated." : "Customer created.");
      reset();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save customer.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(customer: Customer) {
    const currentUser = user;
    if (!currentUser) {
      return;
    }
    try {
      await customerService.setCustomerStatus(
        customer.id,
        customer.status === "active" ? "inactive" : "active",
        currentUser,
      );
      await load();
      toast.success("Customer status updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update customer.");
    }
  }

  return (
    <>
      <PageHeader
        title="Customer Master"
        description="Maintain project customers, contacts, billing details and payment terms."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Settings", to: "/settings" },
          { label: "Customers" },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Customer" : "Add Customer"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Customer Code" value={form.customerCode} onChange={(event) => update("customerCode", event.target.value)} />
              <Input label="Customer Name" value={form.customerName} onChange={(event) => update("customerName", event.target.value)} />
              <Input label="Contact Person" value={form.contactPerson ?? ""} onChange={(event) => update("contactPerson", event.target.value)} />
              <Input label="Phone" value={form.phone ?? ""} onChange={(event) => update("phone", event.target.value)} />
              <Input label="Email" type="email" value={form.email ?? ""} onChange={(event) => update("email", event.target.value)} />
              <Input label="GST Number" value={form.gstNumber ?? ""} onChange={(event) => update("gstNumber", event.target.value)} />
              <Input label="City" value={form.city ?? ""} onChange={(event) => update("city", event.target.value)} />
              <Input label="State" value={form.state ?? ""} onChange={(event) => update("state", event.target.value)} />
              <Input label="Payment Terms" value={form.paymentTerms ?? ""} onChange={(event) => update("paymentTerms", event.target.value)} />
              <FormField label="Status">
                <select className={selectClass} value={form.status} onChange={(event) => update("status", event.target.value as Customer["status"])}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </FormField>
            </div>
            <FormField label="Billing Address">
              <textarea className={textareaClass} value={form.billingAddress ?? ""} onChange={(event) => update("billingAddress", event.target.value)} />
            </FormField>
            <FormField label="Shipping Address">
              <textarea className={textareaClass} value={form.shippingAddress ?? ""} onChange={(event) => update("shippingAddress", event.target.value)} />
            </FormField>
            <FormField label="Remarks">
              <textarea className={textareaClass} value={form.remarks ?? ""} onChange={(event) => update("remarks", event.target.value)} />
            </FormField>
            <div className="flex gap-2">
              <Button type="button" leftIcon={editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />} isLoading={saving} onClick={() => void save()}>
                {editingId ? "Save Customer" : "Add Customer"}
              </Button>
              {editingId ? (
                <Button type="button" variant="secondary" leftIcon={<X className="h-4 w-4" />} onClick={reset}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Customer Register</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-4 py-3">Code / Customer</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-text-primary">{customer.customerName}</p>
                        <p className="text-xs text-text-secondary">{customer.customerCode}</p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        <p>{customer.contactPerson ?? "-"}</p>
                        <p className="text-xs">{customer.phone ?? customer.email ?? "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{[customer.city, customer.state].filter(Boolean).join(", ") || "-"}</td>
                      <td className="px-4 py-3"><Badge tone={customer.status === "active" ? "success" : "neutral"}>{customer.status}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="secondary" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => edit(customer)}>Edit</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => void toggleStatus(customer)}>
                            {customer.status === "active" ? "Deactivate" : "Activate"}
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
