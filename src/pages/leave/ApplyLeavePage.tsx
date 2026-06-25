import { FilePlus2, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { leaveService } from "@/services/leaveService";
import { useAuth } from "@/hooks/useAuth";
import type { LeaveAttachment, LeaveInput } from "@/types/leave";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function ApplyLeavePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const leaveTypes = leaveService.listLeaveTypes();
  const [attachments, setAttachments] = useState<LeaveAttachment[]>([]);
  const [form, setForm] = useState<LeaveInput>({
    leaveTypeId: leaveTypes[0]?.id ?? "",
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    reason: "",
    attachments: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const days = useMemo(
    () => leaveService.calculateLeaveDays(form.fromDate, form.toDate),
    [form.fromDate, form.toDate],
  );
  const selectedType = leaveTypes.find((type) => type.id === form.leaveTypeId);

  if (!user) {
    return null;
  }

  function update<Key extends keyof LeaveInput>(key: Key, value: LeaveInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addAttachments(files: FileList | null) {
    if (!files) {
      return;
    }
    setAttachments((current) => [
      ...current,
      ...Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        url: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString(),
      })),
    ]);
  }

  async function submit() {
    if (!user) {
      return;
    }
    const currentUser = user;
    if (!form.reason.trim()) {
      toast.error("Enter leave reason.");
      return;
    }
    setSubmitting(true);
    try {
      const application = await leaveService.applyLeave(
        { ...form, attachments },
        currentUser,
      );
      toast.success("Leave submitted.");
      navigate(`/leave/history?highlight=${application.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to apply leave.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Apply Leave"
        description="Select leave type, date range, upload documents and submit for approval."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Leave", to: "/leave" },
          { label: "Apply" },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Leave Application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Leave type">
              <select
                className={selectClass}
                value={form.leaveTypeId}
                onChange={(event) => update("leaveTypeId", event.target.value)}
              >
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="rounded-lg border border-surface-border bg-slate-50 p-3 text-sm">
              <p className="font-bold text-text-primary">{days} working days</p>
              <p className="mt-1 text-text-secondary">
                Weekends and configured holidays are excluded.
              </p>
            </div>
            <Input
              label="From date"
              type="date"
              value={form.fromDate}
              onChange={(event) => update("fromDate", event.target.value)}
            />
            <Input
              label="To date"
              type="date"
              value={form.toDate}
              onChange={(event) => update("toDate", event.target.value)}
            />
            <div className="md:col-span-2">
              <Textarea
                label="Reason"
                value={form.reason}
                onChange={(event) => update("reason", event.target.value)}
              />
            </div>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-slate-50 p-5 text-center hover:border-brand-blue">
            <Upload className="h-6 w-6 text-brand-blue" />
            <span className="mt-2 text-sm font-semibold text-text-primary">
              Upload supporting document
            </span>
            <span className="mt-1 text-xs text-text-secondary">
              {selectedType?.requiresDocument ? "Required for this leave type" : "Optional"}
            </span>
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => addAttachments(event.target.files)}
            />
          </label>
          {attachments.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center justify-between rounded-lg border border-surface-border p-3">
                  <span className="truncate text-sm font-semibold">{attachment.fileName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((item) => item.id !== attachment.id),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <Button
            type="button"
            leftIcon={<FilePlus2 className="h-4 w-4" />}
            isLoading={submitting}
            onClick={() => void submit()}
          >
            Submit Leave
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
