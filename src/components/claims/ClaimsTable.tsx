import { Link } from "react-router-dom";

import { ClaimStatusBadge } from "@/components/claims/ClaimStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Claim } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

export function ClaimsTable({
  claims,
  emptyTitle = "No claims found",
  emptyDescription = "Claims matching this view will appear here.",
}: {
  claims: Claim[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (claims.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-surface-border text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Claim
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Employee / Project
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Status
              </th>
              <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                Amount
              </th>
              <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {claims.map((claim) => (
              <tr key={claim.id} className="hover:bg-brand-light/40">
                <td className="px-4 py-3">
                  <Link
                    to={`/claims/${claim.id}`}
                    className="font-bold text-brand-blue hover:underline"
                  >
                    {claim.claimNumber}
                  </Link>
                  <p className="mt-1 max-w-xs truncate text-xs text-text-secondary">
                    {claim.title}
                  </p>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  <span className="block font-medium text-text-primary">
                    {claim.userName}
                  </span>
                  {claim.projectName}
                </td>
                <td className="px-4 py-3">
                  <ClaimStatusBadge status={claim.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="block font-bold text-text-primary">
                    {formatCurrency(claim.totalClaimed)}
                  </span>
                  <span className="text-xs text-text-secondary">
                    Approved {formatCurrency(claim.totalApproved)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/claims/${claim.id}`}
                    className="text-sm font-semibold text-brand-blue"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
