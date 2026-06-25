import { MailCheck, RefreshCw, Save, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import {
  EMAIL_NOTIFICATION_EVENTS,
  emailSettingsService,
  type SmtpStatus,
} from "@/services/emailSettingsService";
import { settingsService } from "@/services/settingsService";
import type { NotificationSettings } from "@/types/settings";

export function EmailSettingsPage() {
  const { user } = useAuth();
  const [smtp, setSmtp] = useState<SmtpStatus | null>(null);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastTest, setLastTest] = useState<{ status: string; date: string } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [status, appSettings] = await Promise.all([
        emailSettingsService.getSmtpStatus(user),
        settingsService.loadSettings(),
      ]);
      setSmtp(status);
      setSettings(appSettings.notifications);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load email settings.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  async function save() {
    if (!settings || !user) return;
    setSaving(true);
    try {
      await settingsService.updateNotificationSettings(settings, user);
      toast.success("Email notification preferences saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save email settings.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!user) return;
    setTesting(true);
    try {
      const result = await emailSettingsService.sendTestEmail(user);
      setLastTest({ status: "Sent", date: new Date().toLocaleString() });
      toast.success(`Test email sent to ${result.recipient}.`);
      await load();
    } catch (error) {
      setLastTest({ status: "Failed", date: new Date().toLocaleString() });
      toast.error(error instanceof Error ? error.message : "Test email failed.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Email Settings"
        description="Configure notification events and verify the Gmail SMTP Edge Function setup."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Settings", to: "/settings" },
          { label: "Email Settings" },
        ]}
        action={
          <Button
            type="button"
            variant="secondary"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            isLoading={loading}
            onClick={() => void load()}
          >
            Refresh Status
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Gmail SMTP Status</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {smtp ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">Connection</span>
                  <Badge tone={smtp.configured ? "success" : "warning"}>
                    {smtp.configured ? "Configured" : "Secrets missing"}
                  </Badge>
                </div>
                <StatusRow label="Host" value={`${smtp.host}:${smtp.port}`} />
                <StatusRow label="Security" value={smtp.secure ? "SSL / TLS" : "STARTTLS"} />
                <StatusRow label="SMTP user" value={smtp.user ?? "Not configured"} />
                <StatusRow label="From name" value={smtp.fromName} />
                <StatusRow label="From address" value={smtp.fromAddress ?? "Not configured"} />
                <StatusRow label="Last test status" value={lastTest?.status ?? "Not run"} />
                <StatusRow label="Last test date" value={lastTest?.date ?? "-"} />
                {!smtp.configured ? (
                  <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-xs leading-5 text-[#9A5700]">
                    Add these Supabase Edge Function secrets:{" "}
                    {smtp.missingSecrets.join(", ")}. Password values are never displayed or stored in the app.
                  </div>
                ) : null}
                <Button
                  type="button"
                  className="w-full"
                  leftIcon={<Send className="h-4 w-4" />}
                  isLoading={testing}
                  disabled={!smtp.configured}
                  onClick={() => void sendTest()}
                >
                  Send Test Email
                </Button>
              </>
            ) : (
              <p className="text-sm text-text-secondary">Loading SMTP status…</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notification Events</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {settings ? (
              <>
                <label className="flex items-center justify-between rounded-lg border border-surface-border p-4">
                  <span>
                    <span className="block font-semibold text-text-primary">Email notifications</span>
                    <span className="mt-1 block text-xs text-text-secondary">
                      Keep in-app notifications while enabling Gmail delivery.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.emailEnabled}
                    onChange={(event) =>
                      setSettings({ ...settings, emailEnabled: event.target.checked })
                    }
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  {EMAIL_NOTIFICATION_EVENTS.map(([event, label]) => (
                    <label
                      key={event}
                      className="flex items-center gap-3 rounded-lg border border-surface-border p-3 text-sm font-semibold text-text-primary"
                    >
                      <input
                        type="checkbox"
                        checked={settings.emailEvents[event] !== false}
                        disabled={!settings.emailEnabled}
                        onChange={(input) =>
                          setSettings({
                            ...settings,
                            emailEvents: {
                              ...settings.emailEvents,
                              [event]: input.target.checked,
                            },
                          })
                        }
                      />
                      <MailCheck className="h-4 w-4 text-brand-blue" />
                      {label}
                    </label>
                  ))}
                </div>
                <Button
                  type="button"
                  leftIcon={<Save className="h-4 w-4" />}
                  isLoading={saving}
                  onClick={() => void save()}
                >
                  Save Email Preferences
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-surface-border pb-3 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-semibold text-text-primary">{value}</span>
    </div>
  );
}
