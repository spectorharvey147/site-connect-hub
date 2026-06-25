import { FilePlus2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { MachineLogTable } from "@/components/machinery/MachineLogTable";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  MACHINE_OWNERSHIP_LABELS,
  MACHINE_TYPE_LABELS,
} from "@/constants/machinery";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import {
  calculateMachineLogSummary,
  machineryService,
} from "@/services/machineryService";
import { vendorContractService } from "@/services/vendorContractService";
import type {
  MachineAsset,
  MachineLog,
  MachineLogInput,
  MachineLogStatus,
  UsageSession,
} from "@/types/machinery";
import type { VendorContract } from "@/types/vendorContracts";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function defaultSession(): UsageSession {
  return {
    id: crypto.randomUUID(),
    startTime: "09:00",
    endTime: "17:00",
    hours: 8,
  };
}

export function MachineLogsPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [assets, setAssets] = useState<MachineAsset[]>(
    machineryService.listAssets(),
  );
  const firstAsset = assets[0];
  const [logs, setLogs] = useState<MachineLog[]>([]);
  const [saving, setSaving] = useState<MachineLogStatus | null>(null);
  const [contracts, setContracts] = useState<VendorContract[]>([]);
  const [form, setForm] = useState<MachineLogInput>({
    projectId: firstAsset?.projectId ?? "",
    date: today(),
    machineAssetId: firstAsset?.id ?? "",
    tripCount: 0,
    sourceLocation: "",
    destinationLocation: "",
    loadType: "",
    operationalStatus: "active",
    usageSessions: [defaultSession()],
    meterStart: 0,
    meterEnd: 8,
    breakdown: {
      isBreakdown: false,
      durationHours: 0,
      reason: "",
      resolution: "",
    },
    remarks: "",
  });

  const selectedAsset = assets.find((asset) => asset.id === form.machineAssetId);
  const availableContracts = contracts.filter(
    (contract) =>
      contract.projectId === form.projectId &&
      (!selectedAsset?.vendorId || contract.vendorId === selectedAsset.vendorId) &&
      (!contract.machineNumber ||
        contract.machineNumber === selectedAsset?.machineNumber),
  );
  const selectedContract = contracts.find(
    (contract) => contract.id === form.vendorContractId,
  );
  const summary = useMemo(() => {
    try {
      return calculateMachineLogSummary(form);
    } catch {
      return { sessionHours: 0, meterHours: 0, billableHours: 0 };
    }
  }, [form]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void Promise.all([
      machineryService.listLogs(user),
      machineryService.loadAssets(user),
      vendorContractService.activeMachineryContracts(user),
    ]).then(([loadedLogs, loadedAssets, loadedContracts]) => {
      setLogs(loadedLogs);
      setAssets(loadedAssets);
      setContracts(loadedContracts);
      if (!form.machineAssetId && loadedAssets[0]) {
        setForm((current) => ({
          ...current,
          projectId: loadedAssets[0].projectId ?? current.projectId,
          machineAssetId: loadedAssets[0].id,
        }));
      }
    });
  }, [form.machineAssetId, user]);

  useEffect(() => {
    if (projects[0]) {
      setForm((current) => ({
        ...current,
        projectId: projects.some((project) => project.id === current.projectId)
          ? current.projectId
          : projects[0].id,
      }));
    }
  }, [projects]);

  if (!user) {
    return null;
  }

  function update<Key extends keyof MachineLogInput>(
    key: Key,
    value: MachineLogInput[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectAsset(assetId: string) {
    const asset = assets.find((item) => item.id === assetId);
    setForm((current) => ({
      ...current,
      machineAssetId: assetId,
      projectId: asset?.projectId ?? current.projectId,
    }));
  }

  function updateSession(
    sessionId: string,
    updater: (session: UsageSession) => UsageSession,
  ) {
    setForm((current) => ({
      ...current,
      usageSessions: current.usageSessions.map((session) =>
        session.id === sessionId ? updater(session) : session,
      ),
    }));
  }

  async function save(status: Extract<MachineLogStatus, "draft" | "submitted">) {
    if (!user) {
      return;
    }
    setSaving(status);
    try {
      const log = await machineryService.saveLog(form, user, status);
      setLogs((current) => [log, ...current]);
      toast.success(
        status === "submitted" ? "Machine log submitted." : "Machine draft saved.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save machine log.",
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Machine Logs"
        description="Capture project, machine usage sessions, meter readings, breakdown details and daily remarks."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Machinery", to: "/machinery" },
          { label: "Logs" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FormField label="Project">
                <select
                  className={selectClass}
                  value={form.projectId}
                  onChange={(event) => update("projectId", event.target.value)}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Active Machinery Contract">
                <select
                  className={selectClass}
                  value={form.vendorContractId ?? ""}
                  onChange={(event) =>
                    update("vendorContractId", event.target.value || undefined)
                  }
                >
                  <option value="">Select contract</option>
                  {availableContracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.contractCode} · {contract.billingType} · {contract.rate}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Machine">
                <select
                  className={selectClass}
                  value={form.machineAssetId}
                  onChange={(event) => selectAsset(event.target.value)}
                >
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.machineNumber} - {MACHINE_TYPE_LABELS[asset.machineType]}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Date"
                type="date"
                value={form.date}
                onChange={(event) => update("date", event.target.value)}
              />
              <Input
                label="Vendor"
                value={selectedAsset?.vendorName ?? "Company fleet"}
                readOnly
              />
              <Input
                label="Ownership"
                value={
                  selectedAsset
                    ? MACHINE_OWNERSHIP_LABELS[selectedAsset.ownership]
                    : ""
                }
                readOnly
              />
              <Input
                label="Machine type"
                value={
                  selectedAsset
                    ? MACHINE_TYPE_LABELS[selectedAsset.machineType]
                    : ""
                }
                readOnly
              />
              <Input
                label="Contract billing"
                value={
                  selectedContract
                    ? `${selectedContract.billingType} @ ${selectedContract.rate}`
                    : "No contract selected"
                }
                readOnly
              />
              <Input
                label="Trip count"
                type="number"
                min={0}
                value={form.tripCount ?? 0}
                onChange={(event) => update("tripCount", Number(event.target.value))}
              />
              <Input
                label="Source location"
                value={form.sourceLocation ?? ""}
                onChange={(event) => update("sourceLocation", event.target.value)}
              />
              <Input
                label="Destination location"
                value={form.destinationLocation ?? ""}
                onChange={(event) => update("destinationLocation", event.target.value)}
              />
              <Input
                label="Load type"
                value={form.loadType ?? ""}
                onChange={(event) => update("loadType", event.target.value)}
              />
              <FormField label="Machine status">
                <select
                  className={selectClass}
                  value={form.operationalStatus ?? "active"}
                  onChange={(event) =>
                    update(
                      "operationalStatus",
                      event.target.value as MachineLogInput["operationalStatus"],
                    )
                  }
                >
                  <option value="active">Active</option>
                  <option value="idle">Idle</option>
                  <option value="standby">Standby</option>
                  <option value="breakdown">Breakdown</option>
                </select>
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Usage Sessions</CardTitle>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() =>
                    update("usageSessions", [...form.usageSessions, defaultSession()])
                  }
                >
                  Add Session
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.usageSessions.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  No usage sessions added.
                </p>
              ) : (
                form.usageSessions.map((session, index) => (
                  <div
                    key={session.id}
                    className="grid gap-4 rounded-lg border border-surface-border p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <Input
                      label={`Session ${index + 1} start`}
                      type="time"
                      value={session.startTime}
                      onChange={(event) =>
                        updateSession(session.id, (current) => ({
                          ...current,
                          startTime: event.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Session remarks"
                      value={session.remarks ?? ""}
                      onChange={(event) =>
                        updateSession(session.id, (current) => ({
                          ...current,
                          remarks: event.target.value,
                        }))
                      }
                    />
                    <Input
                      label="End"
                      type="time"
                      value={session.endTime}
                      onChange={(event) =>
                        updateSession(session.id, (current) => ({
                          ...current,
                          endTime: event.target.value,
                        }))
                      }
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        leftIcon={<Trash2 className="h-4 w-4" />}
                        onClick={() =>
                          update(
                            "usageSessions",
                            form.usageSessions.filter(
                              (item) => item.id !== session.id,
                            ),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Meter Readings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Input
                label="Meter start"
                type="number"
                min={0}
                step="0.1"
                value={form.meterStart}
                onChange={(event) => update("meterStart", Number(event.target.value))}
              />
              <Input
                label="Meter end"
                type="number"
                min={0}
                step="0.1"
                value={form.meterEnd}
                onChange={(event) => update("meterEnd", Number(event.target.value))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <input
                  type="checkbox"
                  checked={form.breakdown.isBreakdown}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      operationalStatus: event.target.checked
                        ? "breakdown"
                        : current.operationalStatus === "breakdown"
                          ? "active"
                          : current.operationalStatus,
                      breakdown: {
                        ...current.breakdown,
                        isBreakdown: event.target.checked,
                      },
                    }))
                  }
                />
                Breakdown occurred
              </label>
              {form.breakdown.isBreakdown ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Breakdown time"
                    type="time"
                    value={form.breakdown.startTime ?? ""}
                    onChange={(event) =>
                      update("breakdown", {
                        ...form.breakdown,
                        startTime: event.target.value,
                      })
                    }
                  />
                  <Input
                    label="Duration hours"
                    type="number"
                    min={0}
                    step="0.25"
                    value={form.breakdown.durationHours}
                    onChange={(event) =>
                      update("breakdown", {
                        ...form.breakdown,
                        durationHours: Number(event.target.value),
                      })
                    }
                  />
                  <Textarea
                    label="Reason"
                    value={form.breakdown.reason}
                    onChange={(event) =>
                      update("breakdown", {
                        ...form.breakdown,
                        reason: event.target.value,
                      })
                    }
                  />
                  <Textarea
                    label="Resolution"
                    value={form.breakdown.resolution}
                    onChange={(event) =>
                      update("breakdown", {
                        ...form.breakdown,
                        resolution: event.target.value,
                      })
                    }
                  />
                </div>
              ) : null}
              <Textarea
                label="Remarks"
                value={form.remarks}
                onChange={(event) => update("remarks", event.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <MachineLogTable logs={logs} />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <StatCard
            metric={{
              label: "Session hours",
              value: summary.sessionHours.toFixed(2),
              tone: "info",
            }}
          />
          <StatCard
            metric={{
              label: "Meter hours",
              value: summary.meterHours.toFixed(2),
              tone: "warning",
            }}
          />
          <StatCard
            metric={{
              label: "Billable hours",
              value: summary.billableHours.toFixed(2),
              tone: "success",
            }}
          />
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                leftIcon={<Save className="h-4 w-4" />}
                isLoading={saving === "draft"}
                onClick={() => void save("draft")}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                className="w-full"
                leftIcon={<FilePlus2 className="h-4 w-4" />}
                isLoading={saving === "submitted"}
                onClick={() => void save("submitted")}
              >
                Submit Log
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
