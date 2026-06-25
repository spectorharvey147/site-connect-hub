import { Camera, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";

import { DprStatusBadge } from "@/components/fieldOperations/DprStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { calculateDprLaborSummary } from "@/services/fieldOperationsService";
import type { DailyProgressReport } from "@/types/fieldOperations";

export function DprTable({
  reports,
  emptyTitle = "No DPR reports found",
}: {
  reports: DailyProgressReport[];
  emptyTitle?: string;
}) {
  if (reports.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description="DPR reports matching this view will appear here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-surface-border text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                DPR
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Project
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Submitted
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Status
              </th>
              <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                Summary
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-white">
            {reports.map((report) => {
              const labor = calculateDprLaborSummary(report);
              const pendingIssues = report.issues.filter(
                (issue) => issue.status === "pending",
              ).length;
              return (
                <tr key={report.id} className="hover:bg-brand-light/40">
                  <td className="px-4 py-3">
                    <Link
                      to={`/field-operations/${report.id}`}
                      className="font-bold text-brand-blue hover:underline"
                    >
                      {report.dprNumber}
                    </Link>
                    <p className="mt-1 text-xs text-text-secondary">
                      {report.reportDate} · {report.shiftName}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-text-primary">
                      {report.projectName}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {report.activities.length} activities
                    </p>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    <span className="block font-semibold text-text-primary">
                      {report.submittedByName}
                    </span>
                    {report.submittedAt ? formatDateTime(report.submittedAt) : "Draft"}
                  </td>
                  <td className="px-4 py-3">
                    <DprStatusBadge status={report.status} />
                    {pendingIssues > 0 ? (
                      <p className="mt-1 text-xs font-semibold text-brand-danger">
                        {pendingIssues} pending issue(s)
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">
                    <span className="inline-flex items-center justify-end gap-1 font-semibold text-text-primary">
                      <UsersRound className="h-4 w-4" />
                      {labor.totalWorkforce}
                    </span>
                    <span className="ml-3 inline-flex items-center justify-end gap-1 font-semibold text-text-primary">
                      <Camera className="h-4 w-4" />
                      {report.photos.length}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
