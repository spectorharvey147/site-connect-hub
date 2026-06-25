import { Plus, UserRoundPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  DEFAULT_LABOUR_RATES,
  LABOUR_CATEGORY_LABELS,
  LABOUR_VENDORS,
} from "@/constants/casualLabour";
import { useAuth } from "@/hooks/useAuth";
import { casualLabourService } from "@/services/casualLabourService";
import type {
  CasualLabourWorker,
  LabourCategory,
  LabourWorkerInput,
} from "@/types/casualLabour";
import { formatCurrency } from "@/utils/format";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function LabourMasterPage() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<CasualLabourWorker[]>(
    casualLabourService.listWorkers(),
  );
  const [form, setForm] = useState<LabourWorkerInput>({
    fullName: "",
    category: "male",
    vendorId: LABOUR_VENDORS[0]?.id ?? "",
    defaultDailyRate: DEFAULT_LABOUR_RATES.male,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      void casualLabourService.loadWorkers(user).then(setWorkers);
    }
  }, [user]);

  if (!user) {
    return null;
  }

  function update<Key extends keyof LabourWorkerInput>(
    key: Key,
    value: LabourWorkerInput[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createWorker() {
    if (!user) {
      return;
    }
    setSaving(true);
    try {
      await casualLabourService.createWorker(form, user);
      setWorkers(await casualLabourService.loadWorkers(user));
      setForm((current) => ({ ...current, fullName: "" }));
      toast.success("Labour worker created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create worker.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Labour Master"
        description="Create and maintain temporary workers linked to vendors and daily wage rates."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Casual Labour", to: "/casual-labour" },
          { label: "Master" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add Labour</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Full name"
              value={form.fullName}
              onChange={(event) => update("fullName", event.target.value)}
            />
            <FormField label="Category">
              <select
                className={selectClass}
                value={form.category}
                onChange={(event) => {
                  const category = event.target.value as LabourCategory;
                  setForm((current) => ({
                    ...current,
                    category,
                    defaultDailyRate: DEFAULT_LABOUR_RATES[category],
                  }));
                }}
              >
                {Object.entries(LABOUR_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Vendor">
              <select
                className={selectClass}
                value={form.vendorId}
                onChange={(event) => update("vendorId", event.target.value)}
              >
                {LABOUR_VENDORS.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </FormField>
            <Input
              label="Daily rate"
              type="number"
              min={0}
              value={form.defaultDailyRate}
              onChange={(event) =>
                update("defaultDailyRate", Number(event.target.value))
              }
            />
            <Button
              type="button"
              leftIcon={<UserRoundPlus className="h-4 w-4" />}
              isLoading={saving}
              onClick={() => void createWorker()}
            >
              Create Labour
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Worker
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Vendor
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border bg-white">
                  {workers.map((worker) => (
                    <tr key={worker.id} className="hover:bg-brand-light/40">
                      <td className="px-4 py-3">
                        <p className="font-bold text-brand-blue">
                          {worker.labourCode}
                        </p>
                        <p className="text-sm font-semibold text-text-primary">
                          {worker.fullName}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {worker.vendorName}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {LABOUR_CATEGORY_LABELS[worker.category]}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-text-primary">
                        {formatCurrency(worker.defaultDailyRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <Plus className="h-3.5 w-3.5" />
              {workers.length} workers in master
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
