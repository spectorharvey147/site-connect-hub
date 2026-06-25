import {
  Camera,
  ClipboardCheck,
  FilePlus2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { FileUpload } from "@/components/shared/FileUpload";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { SHIFTS } from "@/constants/attendance";
import {
  ACTIVITY_OPTIONS,
  ISSUE_SEVERITY_LABELS,
  ISSUE_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  MACHINE_LABELS,
  WEATHER_LABELS,
} from "@/constants/fieldOperations";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import {
  calculateDprLaborSummary,
  fieldOperationsService,
} from "@/services/fieldOperationsService";
import type { StoredFile } from "@/services/storageService";
import type {
  DailyProgressReport,
  DprActivity,
  DprInput,
  DprIssue,
  DprIssueType,
  DprStatus,
  IssueSeverity,
  IssueStatus,
  MachineCode,
  WeatherCondition,
} from "@/types/fieldOperations";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function blankActivity(): DprActivity {
  return {
    id: crypto.randomUUID(),
    activityName: ACTIVITY_OPTIONS[0],
    description: "",
    completionPercent: 0,
    machinesUsed: [],
    customMachines: [],
    labor: {
      male: 0,
      female: 0,
      supervisors: 0,
      companyStaff: 0,
    },
    comments: "",
  };
}

function blankIssue(): DprIssue {
  return {
    id: crypto.randomUUID(),
    issueType: "material_shortage",
    severity: "medium",
    description: "",
    resolutionNotes: "",
    status: "pending",
  };
}

export function SubmitDprPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const navigate = useNavigate();
  const [form, setForm] = useState<DprInput>({
    projectId: "",
    reportDate: today(),
    shiftId: SHIFTS[0]?.id ?? "shift-general",
    weather: [],
    activities: [blankActivity()],
    issues: [],
    nextDayPlan: "",
    plannedManpower: 0,
    plannedEquipment: "",
    photos: [],
  });
  const [saving, setSaving] = useState<DprStatus | null>(null);

  const laborSummary = useMemo(
    () =>
      calculateDprLaborSummary({
        activities: form.activities,
      } as Pick<DailyProgressReport, "activities">),
    [form.activities],
  );

  useEffect(() => {
    setForm((current) => ({
      ...current,
      projectId: projects.some((project) => project.id === current.projectId)
        ? current.projectId
        : projects[0]?.id ?? "",
    }));
  }, [projects]);

  if (!user) {
    return null;
  }

  function update<Key extends keyof DprInput>(key: Key, value: DprInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateActivity(
    activityId: string,
    updater: (activity: DprActivity) => DprActivity,
  ) {
    setForm((current) => ({
      ...current,
      activities: current.activities.map((activity) =>
        activity.id === activityId ? updater(activity) : activity,
      ),
    }));
  }

  function toggleWeather(condition: WeatherCondition) {
    setForm((current) => ({
      ...current,
      weather: current.weather.includes(condition)
        ? current.weather.filter((item) => item !== condition)
        : [...current.weather, condition],
    }));
  }

  function toggleMachine(activityId: string, machine: MachineCode) {
    updateActivity(activityId, (activity) => ({
      ...activity,
      machinesUsed: activity.machinesUsed.includes(machine)
        ? activity.machinesUsed.filter((item) => item !== machine)
        : [...activity.machinesUsed, machine],
    }));
  }

  function updateLabor(
    activityId: string,
    key: keyof DprActivity["labor"],
    value: number,
  ) {
    updateActivity(activityId, (activity) => ({
      ...activity,
      labor: {
        ...activity.labor,
        [key]: value,
      },
    }));
  }

  function updateIssue(
    issueId: string,
    updater: (issue: DprIssue) => DprIssue,
  ) {
    setForm((current) => ({
      ...current,
      issues: current.issues.map((issue) =>
        issue.id === issueId ? updater(issue) : issue,
      ),
    }));
  }

  function updatePhotos(files: StoredFile[]) {
    const currentUser = user;
    if (!currentUser) {
      return;
    }
    setForm((current) => ({
      ...current,
      photos: files.map((file) => {
        const existing = current.photos.find((photo) => photo.id === file.path);
        return {
          id: file.path,
          fileName: file.fileName,
          fileType: file.fileType,
          fileSize: file.fileSize,
          url: file.signedUrl ?? file.path,
          caption: existing?.caption ?? "",
          uploadedBy: currentUser.id,
          uploadedByName: currentUser.fullName,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
      }),
    }));
  }

  async function save(status: Extract<DprStatus, "draft" | "submitted">) {
    const currentUser = user;
    if (!currentUser) {
      return;
    }
    setSaving(status);
    try {
      const report = await fieldOperationsService.saveDpr(
        form,
        currentUser,
        status,
      );
      toast.success(status === "submitted" ? "DPR submitted." : "Draft saved.");
      navigate(`/field-operations/${report.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save DPR.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Submit DPR"
        description="Capture daily site progress with activities, labour, machinery, issues, next-day plan and photos."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Field Operations", to: "/field-operations" },
          { label: "Submit DPR" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField label="Project / Site">
                <select
                  className={selectClass}
                  value={form.projectId}
                  onChange={(event) => update("projectId", event.target.value)}
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
                value={form.reportDate}
                onChange={(event) => update("reportDate", event.target.value)}
              />
              <FormField label="Shift">
                <select
                  className={selectClass}
                  value={form.shiftId}
                  onChange={(event) => update("shiftId", event.target.value)}
                >
                  {SHIFTS.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input label="Submitted by" value={user.fullName} readOnly />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weather Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(WEATHER_LABELS).map(([value, label]) => (
                  <label
                    key={value}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-surface-border p-3 text-sm font-semibold text-text-primary hover:border-brand-blue"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-surface-border text-brand-blue focus:ring-brand-blue"
                      checked={form.weather.includes(value as WeatherCondition)}
                      onChange={() => toggleWeather(value as WeatherCondition)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Activities</CardTitle>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      activities: [...current.activities, blankActivity()],
                    }))
                  }
                >
                  Add Activity
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className="rounded-lg border border-surface-border p-4"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-text-primary">
                      Activity {index + 1}
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon={<Trash2 className="h-4 w-4" />}
                      disabled={form.activities.length === 1}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          activities: current.activities.filter(
                            (item) => item.id !== activity.id,
                          ),
                        }))
                      }
                    >
                      Delete
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Activity name">
                      <select
                        className={selectClass}
                        value={activity.activityName}
                        onChange={(event) =>
                          updateActivity(activity.id, (current) => ({
                            ...current,
                            activityName: event.target.value,
                          }))
                        }
                      >
                        {ACTIVITY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    {activity.activityName === "Custom" ? (
                      <Input
                        label="Custom activity"
                        value={activity.customActivityName ?? ""}
                        onChange={(event) =>
                          updateActivity(activity.id, (current) => ({
                            ...current,
                            customActivityName: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      <Input
                        label="Completion"
                        type="number"
                        min={0}
                        max={100}
                        value={activity.completionPercent}
                        onChange={(event) =>
                          updateActivity(activity.id, (current) => ({
                            ...current,
                            completionPercent: Number(event.target.value),
                          }))
                        }
                      />
                    )}
                    <div className="md:col-span-2">
                      <Textarea
                        label="Description"
                        value={activity.description}
                        onChange={(event) =>
                          updateActivity(activity.id, (current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                    </div>
                    {activity.activityName === "Custom" ? (
                      <Input
                        label="Completion"
                        type="number"
                        min={0}
                        max={100}
                        value={activity.completionPercent}
                        onChange={(event) =>
                          updateActivity(activity.id, (current) => ({
                            ...current,
                            completionPercent: Number(event.target.value),
                          }))
                        }
                      />
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-[13px] font-semibold text-text-primary">
                      Machines Used
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(MACHINE_LABELS).map(([value, label]) => (
                        <label
                          key={value}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-surface-border p-3 text-sm font-semibold text-text-primary hover:border-brand-blue"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-surface-border text-brand-blue focus:ring-brand-blue"
                            checked={activity.machinesUsed.includes(
                              value as MachineCode,
                            )}
                            onChange={() =>
                              toggleMachine(activity.id, value as MachineCode)
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <Input
                      className="mt-3"
                      label="Custom / project-specific machines"
                      placeholder="Example: batching plant, tower crane 12T"
                      value={(activity.customMachines ?? []).join(", ")}
                      onChange={(event) =>
                        updateActivity(activity.id, (current) => ({
                          ...current,
                          customMachines: event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        }))
                      }
                    />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-4">
                    <Input
                      label="Male labour"
                      type="number"
                      min={0}
                      value={activity.labor.male}
                      onChange={(event) =>
                        updateLabor(activity.id, "male", Number(event.target.value))
                      }
                    />
                    <Input
                      label="Female labour"
                      type="number"
                      min={0}
                      value={activity.labor.female}
                      onChange={(event) =>
                        updateLabor(activity.id, "female", Number(event.target.value))
                      }
                    />
                    <Input
                      label="Supervisors"
                      type="number"
                      min={0}
                      value={activity.labor.supervisors}
                      onChange={(event) =>
                        updateLabor(
                          activity.id,
                          "supervisors",
                          Number(event.target.value),
                        )
                      }
                    />
                    <Input
                      label="Company staff"
                      type="number"
                      min={0}
                      value={activity.labor.companyStaff}
                      onChange={(event) =>
                        updateLabor(
                          activity.id,
                          "companyStaff",
                          Number(event.target.value),
                        )
                      }
                    />
                  </div>

                  <Textarea
                    className="mt-4"
                    label="Comments"
                    value={activity.comments ?? ""}
                    onChange={(event) =>
                      updateActivity(activity.id, (current) => ({
                        ...current,
                        comments: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Issues & Challenges</CardTitle>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      issues: [...current.issues, blankIssue()],
                    }))
                  }
                >
                  Add Issue
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.issues.length === 0 ? (
                <p className="text-sm text-text-secondary">No issues added.</p>
              ) : (
                form.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="rounded-lg border border-surface-border p-4"
                  >
                    <div className="mb-4 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 className="h-4 w-4" />}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            issues: current.issues.filter(
                              (item) => item.id !== issue.id,
                            ),
                          }))
                        }
                      >
                        Delete
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField label="Issue type">
                        <select
                          className={selectClass}
                          value={issue.issueType}
                          onChange={(event) =>
                            updateIssue(issue.id, (current) => ({
                              ...current,
                              issueType: event.target.value as DprIssueType,
                            }))
                          }
                        >
                          {Object.entries(ISSUE_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Severity">
                        <select
                          className={selectClass}
                          value={issue.severity}
                          onChange={(event) =>
                            updateIssue(issue.id, (current) => ({
                              ...current,
                              severity: event.target.value as IssueSeverity,
                            }))
                          }
                        >
                          {Object.entries(ISSUE_SEVERITY_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </FormField>
                      <FormField label="Status">
                        <select
                          className={selectClass}
                          value={issue.status}
                          onChange={(event) =>
                            updateIssue(issue.id, (current) => ({
                              ...current,
                              status: event.target.value as IssueStatus,
                            }))
                          }
                        >
                          {Object.entries(ISSUE_STATUS_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </FormField>
                      <div className="md:col-span-3">
                        <Textarea
                          label="Description"
                          value={issue.description}
                          onChange={(event) =>
                            updateIssue(issue.id, (current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Textarea
                          label="Resolution / notes"
                          value={issue.resolutionNotes ?? ""}
                          onChange={(event) =>
                            updateIssue(issue.id, (current) => ({
                              ...current,
                              resolutionNotes: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next Day Plan</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Textarea
                  label="Planned activities for tomorrow"
                  value={form.nextDayPlan}
                  onChange={(event) => update("nextDayPlan", event.target.value)}
                />
              </div>
              <Input
                label="Planned manpower"
                type="number"
                min={0}
                value={form.plannedManpower}
                onChange={(event) =>
                  update("plannedManpower", Number(event.target.value))
                }
              />
              <Input
                label="Planned equipment"
                value={form.plannedEquipment}
                onChange={(event) => update("plannedEquipment", event.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Site Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUpload
                bucket="dpr-photos"
                folder="daily-progress"
                accept="image/*"
                value={form.photos.map((photo) => ({
                  bucket: "dpr-photos",
                  path: photo.id,
                  fileName: photo.fileName,
                  fileType: photo.fileType,
                  fileSize: photo.fileSize,
                  signedUrl: photo.url,
                }))}
                onChange={updatePhotos}
              />

              {form.photos.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {form.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="rounded-lg border border-surface-border p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-text-primary">
                            {photo.fileName}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {Math.round(photo.fileSize / 1024)} KB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              photos: current.photos.filter(
                                (item) => item.id !== photo.id,
                              ),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        className="mt-3"
                        label="Caption"
                        value={photo.caption ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            photos: current.photos.map((item) =>
                              item.id === photo.id
                                ? { ...item, caption: event.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <StatCard
              metric={{
                label: "Total workforce",
                value: String(laborSummary.totalWorkforce),
                tone: "info",
              }}
              icon={<ClipboardCheck className="h-5 w-5" />}
            />
            <StatCard
              metric={{
                label: "Casual labour",
                value: String(laborSummary.casualLabor),
                tone: "success",
              }}
              icon={<ClipboardCheck className="h-5 w-5" />}
            />
            <StatCard
              metric={{
                label: "Machines",
                value: String(
                  new Set(
                    form.activities.flatMap((activity) => [
                      ...activity.machinesUsed,
                      ...(activity.customMachines ?? []),
                    ]),
                  ).size,
                ),
                tone: "neutral",
              }}
              icon={<ClipboardCheck className="h-5 w-5" />}
            />
            <StatCard
              metric={{
                label: "Photos",
                value: String(form.photos.length),
                tone: form.photos.length > 0 ? "success" : "warning",
              }}
              icon={<Camera className="h-5 w-5" />}
            />
          </div>

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
                Submit DPR
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
