import { FilePlus2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  LABOUR_ATTENDANCE_STATUS_LABELS,
  LABOUR_CATEGORY_LABELS,
  LABOUR_VENDORS,
} from "@/constants/casualLabour";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import {
  calculateLabourCostSummary,
  casualLabourService,
} from "@/services/casualLabourService";
import { vendorContractService } from "@/services/vendorContractService";
import type { VendorContract } from "@/types/vendorContracts";
import type {
  CasualLabourWorker,
  LabourAttendanceInput,
  LabourAttendanceRow,
  LabourAttendanceStatus,
  LabourRecordStatus,
} from "@/types/casualLabour";
import { formatCurrency } from "@/utils/format";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function LabourAttendancePage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<CasualLabourWorker[]>(
    casualLabourService.listWorkers(),
  );
  const [form, setForm] = useState<LabourAttendanceInput>({
    projectId: "",
    vendorId: LABOUR_VENDORS[0]?.id ?? "",
    date: today(),
    rows: [],
    allocation: {
      workArea: "",
      workDescription: "",
      maleAllocated: 0,
      femaleAllocated: 0,
      supervisorAllocated: 0,
    },
  });
  const [saving, setSaving] = useState<LabourRecordStatus | null>(null);
  const [contracts, setContracts] = useState<VendorContract[]>([]);

  useEffect(() => {
    if (user) {
      void casualLabourService.loadWorkers(user).then(setWorkers);
      void vendorContractService.activeLabourContracts(user).then(setContracts);
    }
  }, [user]);

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

  const availableContracts = contracts.filter(
    (contract) =>
      (!form.projectId || contract.projectId === form.projectId) &&
      (!form.vendorId || contract.vendorId === form.vendorId),
  );
  const selectedContract = contracts.find(
    (contract) => contract.id === form.vendorContractId,
  );

  const vendorWorkers = useMemo(
    () => workers.filter((worker) => worker.vendorId === form.vendorId),
    [form.vendorId, workers],
  );
  const costSummary = useMemo(
    () => calculateLabourCostSummary({ rows: form.rows }),
    [form.rows],
  );

  if (!user) {
    return null;
  }

  function update<Key extends keyof LabourAttendanceInput>(
    key: Key,
    value: LabourAttendanceInput[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addRow(entryMode: LabourAttendanceRow["entryMode"] = "named_worker") {
    const worker = vendorWorkers[0] ?? workers[0];
    if (entryMode === "named_worker" && !worker) {
      toast.error("Create a labour worker first.");
      return;
    }
    const category = worker?.category ?? "male";
    const row: LabourAttendanceRow = {
      id: crypto.randomUUID(),
      entryMode,
      workerId: entryMode === "named_worker" ? worker?.id ?? "" : "",
      workerCode: entryMode === "named_worker" ? worker?.labourCode ?? "" : "",
      workerName: entryMode === "named_worker" ? worker?.fullName ?? "" : "Count-based labour",
      category,
      gender: category === "female" ? "female" : "male",
      skillType: category === "supervisor" ? "supervisor" : "unskilled",
      workerCount: entryMode === "count_based" ? 1 : undefined,
      startTime: "09:00",
      endTime: "18:00",
      status: "present",
      workedHours: selectedContract?.standardHours ?? 8,
      normalHours: selectedContract?.standardHours ?? 8,
      dailyRate: contractRate(category, selectedContract) ?? worker?.defaultDailyRate ?? 0,
      overtimeHours: 0,
      overtimeRate: selectedContract?.overtimeRate ?? 100,
      allowance: 0,
      deduction: 0,
      payeeType:
        selectedContract?.defaultPayeeType ??
        (selectedContract?.labourContractMode === "local_labour_incharge"
          ? "incharge"
          : selectedContract?.labourContractMode === "direct_individual_payment"
            ? "individual"
            : "vendor"),
      payeeName: selectedContract?.defaultInchargeName ?? "",
      remarks: "",
    };
    setForm((current) => ({ ...current, rows: [...current.rows, row] }));
  }

  function updateRow(
    rowId: string,
    updater: (row: LabourAttendanceRow) => LabourAttendanceRow,
  ) {
    setForm((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? updater(row) : row)),
    }));
  }

  function selectWorker(rowId: string, workerId: string) {
    const worker = workers.find((item) => item.id === workerId);
    if (!worker) {
      return;
    }
    updateRow(rowId, (row) => ({
      ...row,
      workerId: worker.id,
      workerCode: worker.labourCode,
      workerName: worker.fullName,
      category: worker.category,
      dailyRate: contractRate(worker.category, selectedContract) ?? worker.defaultDailyRate,
      overtimeRate: selectedContract?.overtimeRate ?? row.overtimeRate,
    }));
  }

  async function save(status: Extract<LabourRecordStatus, "draft" | "submitted">) {
    const currentUser = user;
    if (!currentUser) {
      return;
    }
    setSaving(status);
    try {
      await casualLabourService.saveAttendance(form, currentUser, status);
      toast.success(
        status === "submitted"
          ? "Labour attendance submitted."
          : "Labour draft saved.",
      );
      navigate("/casual-labour/register");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save labour attendance.",
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Casual Labour Attendance"
        description="Record contractor labour attendance, work allocation, overtime and daily wage cost."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Casual Labour", to: "/casual-labour" },
          { label: "Attendance" },
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
              <FormField label="Vendor / Contractor">
                <select
                  className={selectClass}
                  value={form.vendorId}
                  onChange={(event) => update("vendorId", event.target.value)}
                >
                  {Array.from(
                    new Map([
                      ...LABOUR_VENDORS.map((vendor) => [vendor.id, vendor.name] as const),
                      ...contracts.map((contract) => [contract.vendorId, contract.vendorName] as const),
                    ]),
                  ).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Active Labour Contract">
                <select
                  className={selectClass}
                  value={form.vendorContractId ?? ""}
                  onChange={(event) => {
                    const contract = contracts.find((item) => item.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      vendorContractId: event.target.value || undefined,
                      projectId: contract?.projectId ?? current.projectId,
                      vendorId: contract?.vendorId ?? current.vendorId,
                      rows: current.rows.map((row) => ({
                        ...row,
                        dailyRate: contractRate(row.category, contract) ?? row.dailyRate,
                        overtimeRate: contract?.overtimeRate ?? row.overtimeRate,
                      })),
                    }));
                  }}
                >
                  <option value="">Select contract</option>
                  {availableContracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.contractCode} · {contract.vendorName}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Labour Rows</CardTitle>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => addRow("named_worker")}
                >
                  Add Named Worker
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => addRow("count_based")}
                >
                  Add Count Entry
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.rows.length === 0 ? (
                <p className="text-sm text-text-secondary">No labour rows added.</p>
              ) : (
                form.rows.map((row, index) => (
                  <div
                    key={row.id}
                    className="rounded-lg border border-surface-border p-4"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-text-primary">
                        Labour {index + 1}
                      </h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 className="h-4 w-4" />}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            rows: current.rows.filter((item) => item.id !== row.id),
                          }))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField label={row.entryMode === "count_based" ? "Optional roster link" : "Labour"}>
                        <select
                          className={selectClass}
                          value={row.workerId}
                          onChange={(event) => selectWorker(row.id, event.target.value)}
                        >
                          {row.entryMode === "count_based" ? (
                            <option value="">No fixed worker</option>
                          ) : null}
                          {workers.map((worker) => (
                            <option key={worker.id} value={worker.id}>
                              {worker.labourCode} · {worker.fullName}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <Input
                        label="Category"
                        value={LABOUR_CATEGORY_LABELS[row.category]}
                        readOnly
                      />
                      {row.entryMode === "count_based" ? (
                        <Input
                          label="Count"
                          type="number"
                          min={1}
                          value={row.workerCount ?? 1}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({
                              ...current,
                              workerCount: Number(event.target.value),
                            }))
                          }
                        />
                      ) : null}
                      {row.entryMode === "count_based" ? (
                        <Input
                          label="Labour / Incharge label"
                          value={row.workerName}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({
                              ...current,
                              workerName: event.target.value,
                            }))
                          }
                        />
                      ) : null}
                      <FormField label="Gender">
                        <select
                          className={selectClass}
                          value={row.gender ?? "male"}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({
                              ...current,
                              gender: event.target.value as LabourAttendanceRow["gender"],
                            }))
                          }
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </FormField>
                      <FormField label="Skill type">
                        <select
                          className={selectClass}
                          value={row.skillType ?? "general"}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({
                              ...current,
                              skillType: event.target.value as LabourAttendanceRow["skillType"],
                            }))
                          }
                        >
                          <option value="general">General</option>
                          <option value="unskilled">Unskilled</option>
                          <option value="skilled">Skilled</option>
                          <option value="supervisor">Supervisor</option>
                        </select>
                      </FormField>
                      <FormField label="Status">
                        <select
                          className={selectClass}
                          value={row.status}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({
                              ...current,
                              status: event.target.value as LabourAttendanceStatus,
                            }))
                          }
                        >
                          {Object.entries(LABOUR_ATTENDANCE_STATUS_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </FormField>
                      <Input
                        label="Start time"
                        type="time"
                        value={row.startTime}
                        onChange={(event) =>
                          updateRow(row.id, (current) => ({
                            ...current,
                            startTime: event.target.value,
                          }))
                        }
                      />
                      <Input
                        label="End time"
                        type="time"
                        value={row.endTime}
                        onChange={(event) =>
                          updateRow(row.id, (current) => ({
                            ...current,
                            endTime: event.target.value,
                          }))
                        }
                      />
                      <Input
                        label={row.entryMode === "count_based" ? "Rate / worker" : "Daily rate"}
                        type="number"
                        min={0}
                        value={row.dailyRate}
                        onChange={(event) =>
                          updateRow(row.id, (current) => ({
                            ...current,
                            dailyRate: Number(event.target.value),
                          }))
                        }
                      />
                      <Input
                        label={row.entryMode === "count_based" ? "OT hours / worker" : "OT hours"}
                        type="number"
                        min={0}
                        step="0.5"
                        value={row.overtimeHours}
                        onChange={(event) =>
                          updateRow(row.id, (current) => ({
                            ...current,
                            overtimeHours: Number(event.target.value),
                          }))
                        }
                      />
                      <Input
                        label="OT rate"
                        type="number"
                        min={0}
                        value={row.overtimeRate}
                        onChange={(event) =>
                          updateRow(row.id, (current) => ({
                            ...current,
                            overtimeRate: Number(event.target.value),
                          }))
                        }
                      />
                      <Input
                        label={row.entryMode === "count_based" ? "Allowance / worker" : "Allowance"}
                        type="number"
                        min={0}
                        value={row.allowance ?? 0}
                        onChange={(event) =>
                          updateRow(row.id, (current) => ({
                            ...current,
                            allowance: Number(event.target.value),
                          }))
                        }
                      />
                      <Input
                        label={row.entryMode === "count_based" ? "Deduction / worker" : "Deduction"}
                        type="number"
                        min={0}
                        value={row.deduction ?? 0}
                        onChange={(event) =>
                          updateRow(row.id, (current) => ({
                            ...current,
                            deduction: Number(event.target.value),
                          }))
                        }
                      />
                      <FormField label="Payee type">
                        <select
                          className={selectClass}
                          value={row.payeeType ?? "vendor"}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({
                              ...current,
                              payeeType: event.target.value as LabourAttendanceRow["payeeType"],
                            }))
                          }
                        >
                          <option value="vendor">Vendor</option>
                          <option value="incharge">Incharge</option>
                          <option value="individual">Individual</option>
                        </select>
                      </FormField>
                      <Input
                        label="Payee"
                        value={row.payeeName ?? ""}
                        onChange={(event) =>
                          updateRow(row.id, (current) => ({
                            ...current,
                            payeeName: event.target.value,
                          }))
                        }
                      />
                      <Input
                        label="Remarks"
                        value={row.remarks ?? ""}
                        onChange={(event) =>
                          updateRow(row.id, (current) => ({
                            ...current,
                            remarks: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work Allocation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Input
                label="Work area"
                value={form.allocation.workArea}
                onChange={(event) =>
                  update("allocation", {
                    ...form.allocation,
                    workArea: event.target.value,
                  })
                }
              />
              <Input
                label="Male allocated"
                type="number"
                min={0}
                value={form.allocation.maleAllocated}
                onChange={(event) =>
                  update("allocation", {
                    ...form.allocation,
                    maleAllocated: Number(event.target.value),
                  })
                }
              />
              <Input
                label="Female allocated"
                type="number"
                min={0}
                value={form.allocation.femaleAllocated}
                onChange={(event) =>
                  update("allocation", {
                    ...form.allocation,
                    femaleAllocated: Number(event.target.value),
                  })
                }
              />
              <Input
                label="Supervisor allocated"
                type="number"
                min={0}
                value={form.allocation.supervisorAllocated}
                onChange={(event) =>
                  update("allocation", {
                    ...form.allocation,
                    supervisorAllocated: Number(event.target.value),
                  })
                }
              />
              <Input
                label="Skilled allocated"
                type="number"
                min={0}
                value={form.allocation.skilledAllocated ?? 0}
                onChange={(event) =>
                  update("allocation", {
                    ...form.allocation,
                    skilledAllocated: Number(event.target.value),
                  })
                }
              />
              <Input
                label="Unskilled allocated"
                type="number"
                min={0}
                value={form.allocation.unskilledAllocated ?? 0}
                onChange={(event) =>
                  update("allocation", {
                    ...form.allocation,
                    unskilledAllocated: Number(event.target.value),
                  })
                }
              />
              <div className="md:col-span-3">
                <Textarea
                  label="Work description"
                  value={form.allocation.workDescription}
                  onChange={(event) =>
                    update("allocation", {
                      ...form.allocation,
                      workDescription: event.target.value,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <StatCard
            metric={{
              label: "Workers",
              value: String(costSummary.workerCount),
              tone: "success",
            }}
          />
          <StatCard
            metric={{
              label: "Base cost",
              value: formatCurrency(costSummary.baseCost),
              tone: "info",
            }}
          />
          <StatCard
            metric={{
              label: "OT cost",
              value: formatCurrency(costSummary.overtimeCost),
              tone: "warning",
            }}
          />
          <StatCard
            metric={{
              label: "Net cost",
              value: formatCurrency(costSummary.totalCost),
              tone: "danger",
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
                Submit
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function contractRate(
  category: LabourAttendanceRow["category"],
  contract?: VendorContract,
) {
  if (!contract) return undefined;
  if (category === "male") return contract.maleLabourRate;
  if (category === "female") return contract.femaleLabourRate;
  return contract.supervisorRate;
}
