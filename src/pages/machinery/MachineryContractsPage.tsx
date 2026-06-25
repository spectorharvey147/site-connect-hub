import { FilePlus2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { MachineryContractTable } from "@/components/machinery/MachineryContractTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  BILLING_CYCLE_LABELS,
  DRIVER_COST_SCOPE_LABELS,
  FUEL_SCOPE_LABELS,
  MACHINERY_VENDORS,
  MACHINE_TYPE_LABELS,
  MACHINE_TYPE_OPTIONS,
} from "@/constants/machinery";
import { useAuth } from "@/hooks/useAuth";
import { machineryService } from "@/services/machineryService";
import type {
  MachineAsset,
  BillingCycle,
  DriverCostScope,
  FuelScope,
  MachineryContract,
  MachineryContractInput,
  MachineStatus,
  MachineType,
} from "@/types/machinery";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

const initialForm: MachineryContractInput = {
  vendorId: "vendor-apex-machinery",
  machineType: "excavator",
  machineNumbers: ["EXC-101"],
  periodFrom: "2026-06-01",
  periodTo: "2026-09-30",
  billingCycle: "monthly",
  rate: 180000,
  workingDaysPerMonth: 26,
  overtimeRatePerHour: 1800,
  fuelScope: "excluded",
  driverCostScope: "included",
  specialTerms: "",
  status: "active",
};

export function MachineryContractsPage() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<MachineryContract[]>([]);
  const [form, setForm] = useState<MachineryContractInput>(initialForm);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState<MachineAsset[]>(
    machineryService.listAssets(),
  );
  const canCreate = user ? ["admin_hr", "super_admin"].includes(user.role) : false;

  const selectableAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.status === "active" &&
          asset.machineType === form.machineType &&
          asset.vendorId === form.vendorId,
      ),
    [assets, form.machineType, form.vendorId],
  );

  useEffect(() => {
    if (!user) {
      return;
    }
    void Promise.all([
      machineryService.listContracts(user),
      machineryService.loadAssets(user),
    ]).then(([loadedContracts, loadedAssets]) => {
      setContracts(loadedContracts);
      setAssets(loadedAssets);
    });
  }, [user]);

  if (!user) {
    return null;
  }

  function update<Key extends keyof MachineryContractInput>(
    key: Key,
    value: MachineryContractInput[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleMachine(machineNumber: string) {
    setForm((current) => ({
      ...current,
      machineNumbers: current.machineNumbers.includes(machineNumber)
        ? current.machineNumbers.filter((item) => item !== machineNumber)
        : [...current.machineNumbers, machineNumber],
    }));
  }

  async function createContract() {
    if (!user) {
      return;
    }
    setSaving(true);
    try {
      const contract = await machineryService.createContract(form, user);
      setContracts((current) => [contract, ...current]);
      setForm(initialForm);
      toast.success("Machinery contract created.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to create machinery contract.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Machinery Contracts"
        description="Maintain vendor contracts with machine selection, billing terms, fuel scope and driver cost handling."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Machinery", to: "/machinery" },
          { label: "Contracts" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add Contract</CardTitle>
            <CardDescription>
              Admin and Super Admin users can create active or inactive machinery
              contracts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canCreate ? (
              <div className="rounded-lg border border-surface-border bg-slate-50 p-4 text-sm text-text-secondary">
                Contract creation is limited to Admin / HR and Super Admin roles.
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Vendor">
                <select
                  className={selectClass}
                  value={form.vendorId}
                  disabled={!canCreate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      vendorId: event.target.value,
                      machineNumbers: [],
                    }))
                  }
                >
                  {MACHINERY_VENDORS.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Machine Type">
                <select
                  className={selectClass}
                  value={form.machineType}
                  disabled={!canCreate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      machineType: event.target.value as MachineType,
                      machineNumbers: [],
                    }))
                  }
                >
                  {MACHINE_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {MACHINE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Period from"
                type="date"
                value={form.periodFrom}
                disabled={!canCreate}
                onChange={(event) => update("periodFrom", event.target.value)}
              />
              <Input
                label="Period to"
                type="date"
                value={form.periodTo}
                disabled={!canCreate}
                onChange={(event) => update("periodTo", event.target.value)}
              />
              <FormField label="Billing">
                <select
                  className={selectClass}
                  value={form.billingCycle}
                  disabled={!canCreate}
                  onChange={(event) =>
                    update("billingCycle", event.target.value as BillingCycle)
                  }
                >
                  {Object.entries(BILLING_CYCLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Rate"
                type="number"
                min={0}
                value={form.rate}
                disabled={!canCreate}
                onChange={(event) => update("rate", Number(event.target.value))}
              />
              <Input
                label="Working days / month"
                type="number"
                min={1}
                value={form.workingDaysPerMonth}
                disabled={!canCreate}
                onChange={(event) =>
                  update("workingDaysPerMonth", Number(event.target.value))
                }
              />
              <Input
                label="OT rate / hour"
                type="number"
                min={0}
                value={form.overtimeRatePerHour}
                disabled={!canCreate}
                onChange={(event) =>
                  update("overtimeRatePerHour", Number(event.target.value))
                }
              />
              <FormField label="Fuel Scope">
                <select
                  className={selectClass}
                  value={form.fuelScope}
                  disabled={!canCreate}
                  onChange={(event) =>
                    update("fuelScope", event.target.value as FuelScope)
                  }
                >
                  {Object.entries(FUEL_SCOPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Driver Cost">
                <select
                  className={selectClass}
                  value={form.driverCostScope}
                  disabled={!canCreate}
                  onChange={(event) =>
                    update("driverCostScope", event.target.value as DriverCostScope)
                  }
                >
                  {Object.entries(DRIVER_COST_SCOPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Status">
                <select
                  className={selectClass}
                  value={form.status}
                  disabled={!canCreate}
                  onChange={(event) =>
                    update("status", event.target.value as MachineStatus)
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </FormField>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-semibold text-text-primary">
                Machines
              </p>
              {selectableAssets.length === 0 ? (
                <p className="rounded-lg border border-dashed border-surface-border p-3 text-sm text-text-secondary">
                  No active machines match this vendor and type.
                </p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {selectableAssets.map((asset) => (
                    <label
                      key={asset.id}
                      className="flex items-center gap-2 rounded-lg border border-surface-border p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.machineNumbers.includes(asset.machineNumber)}
                        disabled={!canCreate}
                        onChange={() => toggleMachine(asset.machineNumber)}
                      />
                      <span className="font-semibold text-text-primary">
                        {asset.machineNumber}
                      </span>
                      <Badge tone="info">{asset.projectName ?? "Unassigned"}</Badge>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Textarea
              label="Special Terms"
              value={form.specialTerms}
              disabled={!canCreate}
              onChange={(event) => update("specialTerms", event.target.value)}
            />

            <Button
              type="button"
              leftIcon={<FilePlus2 className="h-4 w-4" />}
              isLoading={saving}
              disabled={!canCreate}
              onClick={() => void createContract()}
            >
              Create Contract
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contract Register</CardTitle>
          </CardHeader>
          <CardContent>
            <MachineryContractTable contracts={contracts} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
