import { Link } from "react-router-dom";

import { LabourStatusBadge } from "@/components/casualLabour/LabourStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { calculateLabourCostSummary } from "@/services/casualLabourService";
import type { CasualLabourAttendance } from "@/types/casualLabour";
import { formatCurrency } from "@/utils/format";

export function LabourAttendanceTable({
  records,
  emptyTitle = "No labour attendance found",
}: {
  records: CasualLabourAttendance[];
  emptyTitle?: string;
}) {
  if (records.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description="Labour attendance matching this view will appear here."
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
                Attendance
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Project / Vendor
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Labour
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Status
              </th>
              <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                Cost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-white">
            {records.map((record) => {
              const cost = calculateLabourCostSummary(record);
              return (
                <tr key={record.id} className="hover:bg-brand-light/40">
                  <td className="px-4 py-3">
                    <Link
                      to="/casual-labour/register"
                      className="font-bold text-brand-blue"
                    >
                      {record.attendanceNumber}
                    </Link>
                    <p className="mt-1 text-xs text-text-secondary">{record.date}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-text-primary">
                      {record.projectName}
                    </p>
                    <p className="text-xs text-text-secondary">{record.vendorName}</p>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    <span className="font-semibold text-text-primary">
                      {cost.workerCount}
                    </span>{" "}
                    workers
                    <span className="block text-xs">
                      {cost.halfDayCount} half day · {cost.absentCount} absent
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <LabourStatusBadge status={record.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-text-primary">
                    {formatCurrency(cost.totalCost)}
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
