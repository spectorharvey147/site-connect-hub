import {
  BarChart3,
  Droplets,
  FilePlus2,
  Fuel,
  IndianRupee,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { FuelIssueTable } from "@/components/fuel/FuelIssueTable";
import { FuelReceiptTable } from "@/components/fuel/FuelReceiptTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  FUEL_SOURCE_LABELS,
  FUEL_TYPE_LABELS,
  FUEL_TYPES,
  FUEL_VENDORS,
} from "@/constants/fuel";
import { MACHINE_TYPE_LABELS } from "@/constants/machinery";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import {
  calculateFuelIssueTotal,
  calculateFuelReceiptTotal,
  fuelService,
  getFuelUnit,
} from "@/services/fuelService";
import { machineryService } from "@/services/machineryService";
import type {
  FuelDashboard,
  FuelIssueInput,
  FuelIssueRow,
  FuelReceiptInput,
  FuelRecordStatus,
  FuelSource,
  FuelType,
} from "@/types/fuel";
import { formatCurrency } from "@/utils/format";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const initialReceipt: FuelReceiptInput = {
  projectId: "",
  date: today(),
  fuelType: "diesel",
  vendorId: FUEL_VENDORS[0]?.id ?? "",
  source: "cash",
  quantity: 100,
  ratePerUnit: 94,
  referenceNumber: "",
  remarks: "",
};

function initialIssue(projectId = ""): FuelIssueInput {
  return {
    projectId,
    date: today(),
    fuelType: "diesel",
    rows: [fuelService.createIssueRow()],
    remarks: "",
  };
}

export function FuelLandingPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [dashboard, setDashboard] = useState<FuelDashboard | null>(null);
  const [receiptForm, setReceiptForm] =
    useState<FuelReceiptInput>(initialReceipt);
  const [issueForm, setIssueForm] = useState<FuelIssueInput>(initialIssue);
  const [savingReceipt, setSavingReceipt] = useState<FuelRecordStatus | null>(null);
  const [savingIssue, setSavingIssue] = useState<FuelRecordStatus | null>(null);
  const assets = machineryService.listAssets();

  const receiptTotal = useMemo(
    () => calculateFuelReceiptTotal(receiptForm),
    [receiptForm],
  );
  const issueTotal = useMemo(() => calculateFuelIssueTotal(issueForm), [issueForm]);
  const openingStock = fuelService.getOpeningStock(
    issueForm.projectId,
    issueForm.fuelType,
    issueForm.date,
  );
  const closingStock = Math.round((openingStock - issueTotal) * 100) / 100;

  useEffect(() => {
    if (!user) {
      return;
    }
    void fuelService.getDashboard(user).then(setDashboard);
  }, [user]);

  useEffect(() => {
    const projectId = projects[0]?.id ?? "";
    setReceiptForm((current) => ({
      ...current,
      projectId: projects.some((project) => project.id === current.projectId)
        ? current.projectId
        : projectId,
    }));
    setIssueForm((current) => ({
      ...current,
      projectId: projects.some((project) => project.id === current.projectId)
        ? current.projectId
        : projectId,
    }));
  }, [projects]);

  if (!user || !dashboard) {
    return null;
  }

  function reloadDashboard() {
    if (!user) {
      return;
    }
    void fuelService.getDashboard(user).then(setDashboard);
  }

  function updateReceipt<Key extends keyof FuelReceiptInput>(
    key: Key,
    value: FuelReceiptInput[Key],
  ) {
    setReceiptForm((current) => ({ ...current, [key]: value }));
  }

  function updateIssue<Key extends keyof FuelIssueInput>(
    key: Key,
    value: FuelIssueInput[Key],
  ) {
    setIssueForm((current) => ({ ...current, [key]: value }));
  }

  function updateIssueRow(
    rowId: string,
    updater: (row: FuelIssueRow) => FuelIssueRow,
  ) {
    setIssueForm((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? updater(row) : row)),
    }));
  }

  function selectMachine(rowId: string, machineAssetId: string) {
    const asset = assets.find((item) => item.id === machineAssetId);
    if (!asset) {
      return;
    }
    updateIssueRow(rowId, (row) => ({
      ...row,
      machineAssetId: asset.id,
      machineNumber: asset.machineNumber,
      machineType: asset.machineType,
    }));
  }

  async function saveReceipt(status: Extract<FuelRecordStatus, "draft" | "submitted">) {
    if (!user) {
      return;
    }
    setSavingReceipt(status);
    try {
      await fuelService.saveReceipt(receiptForm, user, status);
      toast.success(
        status === "submitted"
          ? "Fuel receipt submitted."
          : "Fuel receipt draft saved.",
      );
      setReceiptForm({ ...initialReceipt, projectId: projects[0]?.id ?? "" });
      reloadDashboard();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save fuel receipt.",
      );
    } finally {
      setSavingReceipt(null);
    }
  }

  async function saveIssue(status: Extract<FuelRecordStatus, "draft" | "submitted">) {
    if (!user) {
      return;
    }
    setSavingIssue(status);
    try {
      await fuelService.saveIssue(issueForm, user, status);
      toast.success(
        status === "submitted" ? "Fuel issue submitted." : "Fuel issue draft saved.",
      );
      setIssueForm(initialIssue(projects[0]?.id));
      reloadDashboard();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save fuel issue.",
      );
    } finally {
      setSavingIssue(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Fuel Management"
        description="Record fuel receipts, dispense fuel to machines, and monitor stock, cost and consumption."
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Fuel" }]}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          metric={{
            label: "Diesel stock",
            value: `${dashboard.summary.stockOnHand} L`,
            tone: dashboard.summary.stockOnHand > 0 ? "success" : "danger",
          }}
          icon={<Fuel className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Received this month",
            value: `${dashboard.summary.receivedThisMonth} L`,
            tone: "info",
          }}
          icon={<Droplets className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Issued this month",
            value: `${dashboard.summary.issuedThisMonth} L`,
            tone: "warning",
          }}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Purchase cost",
            value: formatCurrency(dashboard.summary.purchaseCostThisMonth),
            tone: "neutral",
          }}
          icon={<IndianRupee className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fuel Receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Project">
                <select
                  className={selectClass}
                  value={receiptForm.projectId}
                  onChange={(event) =>
                    updateReceipt("projectId", event.target.value)
                  }
                >
                  <option value="">Select assigned project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Date"
                type="date"
                value={receiptForm.date}
                onChange={(event) => updateReceipt("date", event.target.value)}
              />
              <FormField label="Fuel Type">
                <select
                  className={selectClass}
                  value={receiptForm.fuelType}
                  onChange={(event) =>
                    updateReceipt("fuelType", event.target.value as FuelType)
                  }
                >
                  {FUEL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {FUEL_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Vendor">
                <select
                  className={selectClass}
                  value={receiptForm.vendorId}
                  onChange={(event) =>
                    updateReceipt("vendorId", event.target.value)
                  }
                >
                  {FUEL_VENDORS.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Source">
                <select
                  className={selectClass}
                  value={receiptForm.source}
                  onChange={(event) =>
                    updateReceipt("source", event.target.value as FuelSource)
                  }
                >
                  {Object.entries(FUEL_SOURCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label={`Quantity (${getFuelUnit(receiptForm.fuelType)})`}
                type="number"
                min={0}
                step="0.1"
                value={receiptForm.quantity}
                onChange={(event) =>
                  updateReceipt("quantity", Number(event.target.value))
                }
              />
              <Input
                label="Rate / unit"
                type="number"
                min={0}
                step="0.01"
                value={receiptForm.ratePerUnit}
                onChange={(event) =>
                  updateReceipt("ratePerUnit", Number(event.target.value))
                }
              />
              <Input
                label="Total"
                value={formatCurrency(receiptTotal)}
                readOnly
              />
              <Input
                label="Reference #"
                value={receiptForm.referenceNumber}
                onChange={(event) =>
                  updateReceipt("referenceNumber", event.target.value)
                }
              />
            </div>
            <Textarea
              label="Remarks"
              value={receiptForm.remarks}
              onChange={(event) => updateReceipt("remarks", event.target.value)}
            />
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<Save className="h-4 w-4" />}
                isLoading={savingReceipt === "draft"}
                onClick={() => void saveReceipt("draft")}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                leftIcon={<FilePlus2 className="h-4 w-4" />}
                isLoading={savingReceipt === "submitted"}
                onClick={() => void saveReceipt("submitted")}
              >
                Submit
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fuel Issue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Project">
                <select
                  className={selectClass}
                  value={issueForm.projectId}
                  onChange={(event) => updateIssue("projectId", event.target.value)}
                >
                  <option value="">Select assigned project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Date"
                type="date"
                value={issueForm.date}
                onChange={(event) => updateIssue("date", event.target.value)}
              />
              <FormField label="Fuel Type">
                <select
                  className={selectClass}
                  value={issueForm.fuelType}
                  onChange={(event) =>
                    updateIssue("fuelType", event.target.value as FuelType)
                  }
                >
                  {FUEL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {FUEL_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Opening Stock"
                value={`${openingStock} ${getFuelUnit(issueForm.fuelType)}`}
                readOnly
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-text-primary">
                  Machine Dispensing
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() =>
                    updateIssue("rows", [
                      ...issueForm.rows,
                      fuelService.createIssueRow(),
                    ])
                  }
                >
                  Add Machine
                </Button>
              </div>
              {issueForm.rows.map((row, index) => (
                <div
                  key={row.id}
                  className="grid gap-4 rounded-lg border border-surface-border p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <FormField label={`Machine ${index + 1}`}>
                    <select
                      className={selectClass}
                      value={row.machineAssetId}
                      onChange={(event) =>
                        selectMachine(row.id, event.target.value)
                      }
                    >
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.machineNumber} -{" "}
                          {MACHINE_TYPE_LABELS[asset.machineType]}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <Input
                    label="Machine Type"
                    value={MACHINE_TYPE_LABELS[row.machineType]}
                    readOnly
                  />
                  <Input
                    label={`Qty (${getFuelUnit(issueForm.fuelType)})`}
                    type="number"
                    min={0}
                    step="0.1"
                    value={row.quantityIssued}
                    onChange={(event) =>
                      updateIssueRow(row.id, (current) => ({
                        ...current,
                        quantityIssued: Number(event.target.value),
                      }))
                    }
                  />
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      leftIcon={<Trash2 className="h-4 w-4" />}
                      onClick={() =>
                        updateIssue(
                          "rows",
                          issueForm.rows.filter((item) => item.id !== row.id),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="md:col-span-4">
                    <Input
                      label="Remarks"
                      value={row.remarks}
                      onChange={(event) =>
                        updateIssueRow(row.id, (current) => ({
                          ...current,
                          remarks: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                metric={{
                  label: "Opening",
                  value: `${openingStock} ${getFuelUnit(issueForm.fuelType)}`,
                  tone: "info",
                }}
              />
              <StatCard
                metric={{
                  label: "Total issues",
                  value: `${issueTotal} ${getFuelUnit(issueForm.fuelType)}`,
                  tone: "warning",
                }}
              />
              <StatCard
                metric={{
                  label: "Closing",
                  value: `${closingStock} ${getFuelUnit(issueForm.fuelType)}`,
                  tone: closingStock >= 0 ? "success" : "danger",
                }}
              />
            </div>

            <Textarea
              label="Issue Remarks"
              value={issueForm.remarks}
              onChange={(event) => updateIssue("remarks", event.target.value)}
            />
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<Save className="h-4 w-4" />}
                isLoading={savingIssue === "draft"}
                onClick={() => void saveIssue("draft")}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                leftIcon={<FilePlus2 className="h-4 w-4" />}
                isLoading={savingIssue === "submitted"}
                onClick={() => void saveIssue("submitted")}
              >
                Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <FuelReceiptTable receipts={dashboard.recentReceipts} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <FuelIssueTable issues={dashboard.recentIssues} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Daily Fuel Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Opening</th>
                    <th className="px-4 py-3 font-semibold">Received</th>
                    <th className="px-4 py-3 font-semibold">Issued</th>
                    <th className="px-4 py-3 font-semibold">Closing</th>
                    <th className="px-4 py-3 font-semibold">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border bg-white">
                  {dashboard.dailySummary.map((row) => (
                    <tr key={row.date}>
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        {row.date}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {row.opening} L
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {row.received} L
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {row.issued} L
                      </td>
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        {row.closing} L
                      </td>
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        {formatCurrency(row.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Machine-wise Consumption</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.machineConsumption.length === 0 ? (
              <p className="text-sm text-text-secondary">
                No machine fuel consumption yet.
              </p>
            ) : (
              dashboard.machineConsumption.map((item) => (
                <div key={item.machineNumber}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-text-primary">
                      {item.machineNumber}
                    </span>
                    <span className="text-text-secondary">
                      {item.totalQuantity} L
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    {MACHINE_TYPE_LABELS[item.machineType]} -{" "}
                    {formatCurrency(item.cost)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
