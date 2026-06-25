import { CheckCircle2, CircleDot, XCircle } from "lucide-react";

import { CLAIM_STAGE_LABELS } from "@/constants/claims";
import type { ClaimApproval } from "@/types/claims";
import type { ApprovalPathStep } from "@/types/organization";
import { formatCurrency } from "@/utils/format";

function getIcon(decision: ClaimApproval["decision"]) {
  if (decision === "rejected" || decision === "changes_requested") {
    return <XCircle className="h-4 w-4 text-brand-danger" />;
  }

  if (decision === "submitted") {
    return <CircleDot className="h-4 w-4 text-brand-blue" />;
  }

  return <CheckCircle2 className="h-4 w-4 text-brand-success" />;
}

function stageLabel(approval: ClaimApproval) {
  if (approval.stage === "final_approval") {
    return approval.actorRole === "hod"
      ? "HOD Approval"
      : "Super Admin Approval";
  }
  if (approval.stage === "accounts_payment") {
    return approval.decision === "paid" ? "Paid" : "Accounts Payment";
  }
  return CLAIM_STAGE_LABELS[approval.stage];
}

export function ApprovalTimeline({
  approvals,
  approvalPath = [],
}: {
  approvals: ClaimApproval[];
  approvalPath?: ApprovalPathStep[];
}) {
  if (approvals.length === 0 && approvalPath.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-surface-border p-4 text-sm text-text-secondary">
        No approval activity yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {approvalPath.length > 0 ? (
        <div className="rounded-lg border border-blue-100 bg-brand-light p-4">
          <p className="text-xs font-bold uppercase tracking-normal text-text-secondary">
            Matrix path
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {approvalPath.map((step) => (
              <span
                key={step.id}
                className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-brand-blue"
              >
                {step.sequence}. {step.label}
                {step.userName ? ` - ${step.userName}` : ""}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {approvals.length > 0 ? (
        <ol className="space-y-4">
          {approvals.map((approval) => (
            <li key={approval.id} className="flex gap-3">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50">
                {getIcon(approval.decision)}
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-surface-border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-text-primary">
                    {stageLabel(approval)}
                  </p>
                  <span className="text-xs font-semibold text-text-secondary">
                    {new Date(approval.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {approval.actorName} - {approval.decision.split("_").join(" ")}
                </p>
                {approval.amountBefore !== undefined &&
                approval.amountAfter !== undefined ? (
                  <p className="mt-2 text-xs font-semibold text-text-secondary">
                    Amount: {formatCurrency(approval.amountBefore)} to{" "}
                    {formatCurrency(approval.amountAfter)}
                  </p>
                ) : null}
                {approval.remarks ? (
                  <p className="mt-2 text-sm leading-5 text-text-primary">
                    {approval.remarks}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
