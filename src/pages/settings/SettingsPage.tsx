import { Save, Settings as SettingsIcon, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SHIFTS } from "@/constants/attendance";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import { settingsService } from "@/services/settingsService";
import type { AppSettings } from "@/types/settings";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function SettingsPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (user?.role !== "super_admin") return;
    setLoadError("");
    void settingsService
      .loadSettings()
      .then(setSettings)
      .catch((error: unknown) =>
        setLoadError(
          error instanceof Error ? error.message : "Unable to load settings.",
        ),
      );
  }, [user?.role]);

  if (!user) {
    return null;
  }

  async function save(section: "company" | "workflow" | "notifications" | "masters") {
    if (!user || !settings) {
      return;
    }
    setSaving(section);
    try {
      const updated =
        section === "company"
          ? await settingsService.updateCompanySettings(settings.company, user)
          : section === "workflow"
            ? await settingsService.updateWorkflowSettings(settings.workflow, user)
            : section === "notifications"
              ? await settingsService.updateNotificationSettings(
                  settings.notifications,
                  user,
                )
              : await settingsService.updateMasterSettings(settings.masters, user);
      setSettings(updated);
      toast.success("Settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save settings.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <PageHeader
        title={user.role === "super_admin" ? "Settings" : "Master Data"}
        description={
          user.role === "super_admin"
            ? "Configure company profile, approval workflow, notifications and default master data."
            : "Maintain customers, departments, designations, approval rules and project cost codes."
        }
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Settings" }]}
      />

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ...(user.role === "super_admin"
            ? [{ label: "Organization", to: "/settings/organization" }]
            : []),
          { label: "Customers", to: "/settings/customers" },
          { label: "Departments", to: "/settings/departments" },
          { label: "Designations", to: "/settings/designations" },
          { label: "Approval Matrix", to: "/settings/approval-matrix" },
          { label: "Delegations", to: "/settings/delegations" },
          { label: "Claim Expense Categories", to: "/settings/expense-categories" },
          { label: "Project Cost Codes", to: "/settings/project-cost-codes" },
          ...(user.role === "super_admin"
            ? [{ label: "Email Settings", to: "/settings/email" }]
            : []),
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-lg border border-surface-border bg-white px-4 py-3 text-sm font-semibold text-text-primary shadow-sm transition hover:border-brand-blue hover:text-brand-blue"
          >
            {item.label}
          </Link>
        ))}
      </div>

      {user.role === "super_admin" && !settings && !loadError ? (
        <LoadingState label="Loading system settings" />
      ) : null}
      {user.role === "super_admin" && loadError ? (
        <ErrorState message={loadError} />
      ) : null}
      {user.role === "super_admin" && settings ? (
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Company Name"
                value={settings.company.companyName}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          company: {
                            ...current.company,
                            companyName: event.target.value,
                          },
                        }
                      : current,
                  )
                }
              />
              <Input
                label="Support Email"
                value={settings.company.supportEmail}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          company: {
                            ...current.company,
                            supportEmail: event.target.value,
                          },
                        }
                      : current,
                  )
                }
              />
              <Input
                label="Support Phone"
                value={settings.company.supportPhone}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          company: {
                            ...current.company,
                            supportPhone: event.target.value,
                          },
                        }
                      : current,
                  )
                }
              />
              <Input
                label="Timezone"
                value={settings.company.timezone}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          company: {
                            ...current.company,
                            timezone: event.target.value,
                          },
                        }
                      : current,
                  )
                }
              />
            </div>
            <Button
              type="button"
              leftIcon={<Save className="h-4 w-4" />}
              isLoading={saving === "company"}
              onClick={() => void save("company")}
            >
              Save Company
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={settings.workflow.claimAdminVerificationRequired}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          workflow: {
                            ...current.workflow,
                            claimAdminVerificationRequired: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
              Claim admin verification required
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={settings.workflow.leaveManagerApprovalRequired}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          workflow: {
                            ...current.workflow,
                            leaveManagerApprovalRequired: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
              Leave manager approval required
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Manager Approval Limit"
                type="number"
                value={settings.workflow.claimManagerApprovalLimit}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          workflow: {
                            ...current.workflow,
                            claimManagerApprovalLimit: Number(event.target.value),
                          },
                        }
                      : current,
                  )
                }
              />
              <Input
                label="Geo Fence Meters"
                type="number"
                value={settings.workflow.attendanceGeoFenceMeters}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          workflow: {
                            ...current.workflow,
                            attendanceGeoFenceMeters: Number(event.target.value),
                          },
                        }
                      : current,
                  )
                }
              />
            </div>
            <Button
              type="button"
              leftIcon={<SlidersHorizontal className="h-4 w-4" />}
              isLoading={saving === "workflow"}
              onClick={() => void save("workflow")}
            >
              Save Workflow
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={settings.notifications.emailEnabled}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          notifications: {
                            ...current.notifications,
                            emailEnabled: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
              Email notifications
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={settings.notifications.pushEnabled}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          notifications: {
                            ...current.notifications,
                            pushEnabled: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
              Push notifications
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Daily Digest Time"
                type="time"
                value={settings.notifications.dailyDigestTime}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          notifications: {
                            ...current.notifications,
                            dailyDigestTime: event.target.value,
                          },
                        }
                      : current,
                  )
                }
              />
              <Input
                label="Escalation Hours"
                type="number"
                value={settings.notifications.escalationHours}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          notifications: {
                            ...current.notifications,
                            escalationHours: Number(event.target.value),
                          },
                        }
                      : current,
                  )
                }
              />
            </div>
            <Button
              type="button"
              leftIcon={<Save className="h-4 w-4" />}
              isLoading={saving === "notifications"}
              onClick={() => void save("notifications")}
            >
              Save Notifications
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Master Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Default Project">
              <select
                className={selectClass}
                value={settings.masters.defaultProjectId}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          masters: {
                            ...current.masters,
                            defaultProjectId: event.target.value,
                          },
                        }
                      : current,
                  )
                }
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Default Shift">
              <select
                className={selectClass}
                value={settings.masters.defaultShiftId}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          masters: {
                            ...current.masters,
                            defaultShiftId: event.target.value,
                          },
                        }
                      : current,
                  )
                }
              >
                {SHIFTS.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name}
                  </option>
                ))}
              </select>
            </FormField>
            <Input
              label="Default Payment Terms"
              value={settings.masters.defaultPaymentTerms}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? {
                        ...current,
                        masters: {
                          ...current.masters,
                          defaultPaymentTerms: event.target.value,
                        },
                      }
                    : current,
                )
              }
            />
            <Button
              type="button"
              leftIcon={<SettingsIcon className="h-4 w-4" />}
              isLoading={saving === "masters"}
              onClick={() => void save("masters")}
            >
              Save Masters
            </Button>
          </CardContent>
        </Card>
      </div>
      ) : null}
    </>
  );
}
