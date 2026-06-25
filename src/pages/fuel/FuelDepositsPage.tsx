import { IndianRupee, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FUEL_VENDORS } from "@/constants/fuel";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import { fuelService } from "@/services/fuelService";
import type { FuelDepositInput } from "@/services/fuelRepository";
import { formatCurrency } from "@/utils/format";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus-brand-blue/15";

function today() {
  return new Date().toISOString().slice(0, 10);
}

type DataRow = Record<string, unknown>;

export function FuelDepositsPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [form, setForm] = useState<FuelDepositInput>({
    projectId: "",
    vendorId: FUEL_VENDORS[0]?.id ?? "",
    depositDate: today(),
    depositAmount: 0,
    paymentMode: "bank_transfer",
    paymentReference: "",
    remarks: "",
  });
  const [deposits, setDeposits] = useState<DataRow[]>([]);
  const [ledger, setLedger] = useState<DataRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projects[0]) return;
    setForm((current) => ({
      ...current,
      projectId: projects.some((project) => project.id === current.projectId)
        ? current.projectId
        : projects[0].id,
    }));
  }, [projects]);

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      fuelService.listDeposits(user),
      fuelService.listVendorLedger(user),
    ]).then(([depositRows, ledgerRows]) => {
      setDeposits(depositRows as DataRow[]);
      setLedger(ledgerRows as DataRow[]);
    });
  }, [user]);

  if (!user) return null;

  function update<Key extends keyof FuelDepositInput>(
    key: Key,
    value: FuelDepositInput[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await fuelService.createDeposit(form, user);
      const [depositRows, ledgerRows] = await Promise.all([
        fuelService.listDeposits(user),
        fuelService.listVendorLedger(user),
      ]);
      setDeposits(depositRows as DataRow[]);
      setLedger(ledgerRows as DataRow[]);
      toast.success("Fuel vendor deposit saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save fuel deposit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Fuel Deposits"
        description="Record vendor advances and review the fuel vendor advance ledger."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Fuel", to: "/fuel" },
          { label: "Deposits" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>New vendor deposit</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField label="Project">
              <select className={selectClass} value={form.projectId} onChange={(event) => update("projectId", event.target.value)}>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Vendor">
              <select className={selectClass} value={form.vendorId} onChange={(event) => update("vendorId", event.target.value)}>
                {FUEL_VENDORS.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
            </FormField>
            <Input label="Deposit date" type="date" value={form.depositDate} onChange={(event) => update("depositDate", event.target.value)} />
            <Input label="Deposit amount" type="number" min={0} value={form.depositAmount} onChange={(event) => update("depositAmount", Number(event.target.value))} />
            <Input label="Payment mode" value={form.paymentMode} onChange={(event) => update("paymentMode", event.target.value)} />
            <Input label="Payment reference" value={form.paymentReference ?? ""} onChange={(event) => update("paymentReference", event.target.value)} />
            <Textarea className="md:col-span-2" label="Remarks" value={form.remarks ?? ""} onChange={(event) => update("remarks", event.target.value)} />
            <div className="md:col-span-2 flex justify-end">
              <Button type="button" leftIcon={<Save className="h-4 w-4" />} isLoading={saving} onClick={() => void save()}>
                Save Deposit
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Advance ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {ledger.length === 0 ? (
              <EmptyState title="No ledger entries" description="Deposits and approved advance receipts will appear here." />
            ) : (
              <div className="space-y-3">
                {ledger.slice(0, 8).map((entry) => (
                  <div key={String(entry.id)} className="rounded-lg border border-surface-border p-3">
                    <p className="text-sm font-bold capitalize text-text-primary">{String(entry.transaction_type)}</p>
                    <p className="text-xs text-text-secondary">{String(entry.transaction_date)} · {String(entry.vendor_id)}</p>
                    <p className="mt-2 flex items-center gap-1 text-sm font-semibold">
                      <IndianRupee className="h-4 w-4" />
                      Balance {formatCurrency(Number(entry.balance_after ?? 0))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent deposits</CardTitle>
        </CardHeader>
        <CardContent>
          {deposits.length === 0 ? (
            <EmptyState title="No deposits" description="Fuel advance deposits saved for this organization will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">Vendor</th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">Reference</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {deposits.map((deposit) => (
                    <tr key={String(deposit.id)}>
                      <td className="px-4 py-3">{String(deposit.deposit_date)}</td>
                      <td className="px-4 py-3">{String(deposit.vendor_id)}</td>
                      <td className="px-4 py-3">{String(deposit.payment_reference ?? "")}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(Number(deposit.deposit_amount ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
