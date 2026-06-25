import {
  CheckCircle2,
  Download,
  FileText,
  RotateCcw,
  UsersRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { DprStatusBadge } from "@/components/fieldOperations/DprStatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import {
  ISSUE_SEVERITY_LABELS,
  ISSUE_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  MACHINE_LABELS,
  WEATHER_LABELS,
} from "@/constants/fieldOperations";
import { useAuth } from "@/hooks/useAuth";
import {
  calculateDprLaborSummary,
  fieldOperationsService,
} from "@/services/fieldOperationsService";
import type { DailyProgressReport } from "@/types/fieldOperations";

export function DprDetailPage() {
  const { reportId } = useParams();
  const { user } = useAuth();
  const [report, setReport] = useState<DailyProgressReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewComments, setReviewComments] = useState("");
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (!user || !reportId) {
      return;
    }
    setLoading(true);
    void fieldOperationsService.getReport(reportId, user).then((nextReport) => {
      setReport(nextReport);
      setLoading(false);
    });
  }, [reportId, user]);

  if (!user) {
    return null;
  }

  if (loading) {
    return <LoadingState label="Loading DPR" />;
  }

  if (!report || !reportId) {
    return (
      <EmptyState
        title="DPR not found"
        description="This DPR does not exist or is not visible to your role."
      />
    );
  }

  const labor = calculateDprLaborSummary(report);
  const canReview =
    ["admin_hr", "super_admin"].includes(user.role) ||
    (user.role === "manager" && user.projectIds.includes(report.projectId));

  async function review(decision: "reviewed" | "returned") {
    const currentUser = user;
    const currentReportId = reportId;
    if (!currentUser || !currentReportId) {
      return;
    }
    setReviewing(true);
    try {
      const updated = await fieldOperationsService.reviewDpr(
        currentReportId,
        currentUser,
        decision,
        reviewComments,
      );
      setReport(updated);
      setReviewComments("");
      toast.success(decision === "reviewed" ? "DPR reviewed." : "DPR returned.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to review DPR.");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <>
      <PageHeader
        title={report.dprNumber}
        description={`${report.projectName} · ${report.reportDate}`}
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Field Operations", to: "/field-operations" },
          { label: report.dprNumber },
        ]}
        action={
          <Button
            type="button"
            variant="secondary"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => void downloadDprPdf(report)}
          >
            PDF
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>DPR Summary</CardTitle>
              <CardDescription>
                Submitted by {report.submittedByName} for {report.shiftName}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <SummaryRow label="Status" value={<DprStatusBadge status={report.status} />} />
              <SummaryRow label="Project" value={report.projectName} />
              <SummaryRow label="Date" value={report.reportDate} />
              <SummaryRow label="Weather" value={weatherLabel(report)} />
              <SummaryRow label="Activities" value={String(report.activities.length)} />
              <SummaryRow label="Photos" value={String(report.photos.length)} />
              {report.reviewedByName ? (
                <SummaryRow
                  label="Reviewed by"
                  value={`${report.reviewedByName} · ${
                    report.reviewedAt ? formatDateTime(report.reviewedAt) : ""
                  }`}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Labour Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <Metric label="Male labour" value={labor.male} />
              <Metric label="Female labour" value={labor.female} />
              <Metric label="Supervisors" value={labor.supervisors} />
              <Metric label="Company staff" value={labor.companyStaff} />
              <Metric label="Casual labour" value={labor.casualLabor} />
              <Metric label="Total workforce" value={labor.totalWorkforce} />
            </CardContent>
          </Card>

          {canReview ? (
            <Card>
              <CardHeader>
                <CardTitle>Review</CardTitle>
                <CardDescription>
                  Mark the DPR reviewed or return it with comments.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  label="Review comments"
                  value={reviewComments}
                  onChange={(event) => setReviewComments(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                    isLoading={reviewing}
                    onClick={() => void review("reviewed")}
                  >
                    Mark Reviewed
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    leftIcon={<RotateCcw className="h-4 w-4" />}
                    isLoading={reviewing}
                    onClick={() => void review("returned")}
                  >
                    Return
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="rounded-lg border border-surface-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-text-primary">
                        {activity.activityName === "Custom"
                          ? activity.customActivityName
                          : activity.activityName}
                      </h3>
                      <p className="mt-1 text-sm text-text-secondary">
                        {activity.description}
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-bold text-brand-blue">
                      {activity.completionPercent}%
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-secondary">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <UsersRound className="h-3.5 w-3.5" />
                      {activity.labor.male +
                        activity.labor.female +
                        activity.labor.supervisors +
                        activity.labor.companyStaff}{" "}
                      workers
                    </span>
                    {activity.machinesUsed.length > 0 || (activity.customMachines ?? []).length > 0 ? (
                      <span>
                        Machines:{" "}
                        {[
                          ...activity.machinesUsed.map((machine) => MACHINE_LABELS[machine]),
                          ...(activity.customMachines ?? []),
                        ].join(", ")}
                      </span>
                    ) : (
                      <span>Machines: None</span>
                    )}
                  </div>
                  {activity.comments ? (
                    <p className="mt-3 text-sm text-text-secondary">
                      {activity.comments}
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Issues & Next Day Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.issues.length === 0 ? (
                <p className="text-sm text-text-secondary">No issues reported.</p>
              ) : (
                report.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="rounded-lg border border-surface-border p-4 text-sm"
                  >
                    <p className="font-bold text-text-primary">
                      {ISSUE_TYPE_LABELS[issue.issueType]} ·{" "}
                      {ISSUE_SEVERITY_LABELS[issue.severity]} ·{" "}
                      {ISSUE_STATUS_LABELS[issue.status]}
                    </p>
                    <p className="mt-2 text-text-secondary">{issue.description}</p>
                    {issue.resolutionNotes ? (
                      <p className="mt-2 text-text-secondary">
                        {issue.resolutionNotes}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
              <div className="rounded-lg border border-surface-border p-4 text-sm">
                <p className="font-bold text-text-primary">Tomorrow</p>
                <p className="mt-2 whitespace-pre-wrap text-text-secondary">
                  {report.nextDayPlan}
                </p>
                <p className="mt-3 text-text-secondary">
                  Planned manpower: {report.plannedManpower}
                </p>
                <p className="text-text-secondary">
                  Planned equipment: {report.plannedEquipment || "Not specified"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent>
              {report.photos.length === 0 ? (
                <p className="text-sm text-text-secondary">No photos attached.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {report.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="rounded-lg border border-surface-border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 shrink-0 text-brand-blue" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-text-primary">
                            {photo.fileName}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {Math.round(photo.fileSize / 1024)} KB
                          </p>
                        </div>
                      </div>
                      {photo.caption ? (
                        <p className="mt-2 text-sm text-text-secondary">
                          {photo.caption}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-surface-border pb-3 last:border-0 last:pb-0">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-surface-border p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-text-secondary">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

function weatherLabel(report: DailyProgressReport) {
  return report.weather.length > 0
    ? report.weather.map((condition) => WEATHER_LABELS[condition]).join(", ")
    : "Not recorded";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function downloadDprPdf(report: DailyProgressReport) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Site Connect DPR", 20, 20);
  doc.setFontSize(11);
  doc.text(`DPR: ${report.dprNumber}`, 20, 36);
  doc.text(`Project: ${report.projectName}`, 20, 44);
  doc.text(`Date: ${report.reportDate}`, 20, 52);
  doc.text(`Submitted By: ${report.submittedByName}`, 20, 60);
  doc.text(`Status: ${report.status}`, 20, 68);
  doc.text(`Activities: ${report.activities.length}`, 20, 76);
  doc.text(`Photos: ${report.photos.length}`, 20, 84);
  doc.text(`Next Day Plan: ${report.nextDayPlan.slice(0, 120)}`, 20, 100);
  doc.save(`${report.dprNumber}.pdf`);
}
