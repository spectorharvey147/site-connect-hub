import { FuelStatusBadge } from "@/components/fuel/FuelStatusBadge";
import { FUEL_TYPE_LABELS } from "@/constants/fuel";
import type { FuelIssue } from "@/types/fuel";

export function FuelIssueTable({
  issues,
  emptyTitle = "No fuel issues found",
}: {
  issues: FuelIssue[];
  emptyTitle?: string;
}) {
  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-surface-border p-6 text-center text-sm text-text-secondary">
        {emptyTitle}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-surface-border text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-text-secondary">
          <tr>
            <th className="px-4 py-3 font-semibold">Issue</th>
            <th className="px-4 py-3 font-semibold">Fuel</th>
            <th className="px-4 py-3 font-semibold">Machines</th>
            <th className="px-4 py-3 font-semibold">Opening</th>
            <th className="px-4 py-3 font-semibold">Issued</th>
            <th className="px-4 py-3 font-semibold">Closing</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border bg-white">
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td className="px-4 py-3">
                <p className="font-bold text-brand-blue">{issue.issueNumber}</p>
                <p className="mt-1 text-xs text-text-secondary">{issue.date}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-text-primary">
                  {FUEL_TYPE_LABELS[issue.fuelType]}
                </p>
                <p className="mt-1 text-xs text-text-secondary">{issue.projectName}</p>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {issue.rows.map((row) => row.machineNumber).join(", ")}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {issue.openingStock} {issue.unit}
              </td>
              <td className="px-4 py-3 font-semibold text-text-primary">
                {issue.totalIssued} {issue.unit}
              </td>
              <td className="px-4 py-3 font-semibold text-text-primary">
                {issue.closingStock} {issue.unit}
              </td>
              <td className="px-4 py-3">
                <FuelStatusBadge status={issue.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
