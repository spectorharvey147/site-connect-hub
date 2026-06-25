import { Download, FileText, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApprovalTimeline } from "@/components/claims/ApprovalTimeline";
import { ClaimItemsTable } from "@/components/claims/ClaimItemsTable";
import { ClaimStatusBadge } from "@/components/claims/ClaimStatusBadge";
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
import { canPerformClaimAction, claimsService } from "@/services/claimsService";
import { useAuth } from "@/hooks/useAuth";
import type { AppUser } from "@/types/auth";
import type { Claim } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

export function ClaimDetailPage() {
  const { claimId } = useParams();
  const { user } = useAuth();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !claimId) {
      return;
    }

    setLoading(true);
    void claimsService.getClaim(claimId, user).then((nextClaim) => {
      setClaim(nextClaim);
      setLoading(false);
    });
  }, [claimId, user]);

  if (!user) {
    return null;
  }

  if (loading) {
    return <LoadingState label="Loading claim" />;
  }

  if (!claim) {
    return (
      <EmptyState
        title="Claim not found"
        description="This claim does not exist or is not visible to your role."
      />
    );
  }

  const routeForAction = getActionRoute(user, claim);

  return (
    <>
      <PageHeader
        title={claim.claimNumber}
        description={claim.title}
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Claims", to: "/claims" },
          { label: claim.claimNumber },
        ]}
        action={
          routeForAction ? (
            <Button type="button" leftIcon={<ReceiptText className="h-4 w-4" />}>
              <Link className="text-white" to={routeForAction}>
                Open Action Queue
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Claim Summary</CardTitle>
              <CardDescription>
                Submitted by {claim.userName} for {claim.projectName}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <SummaryRow label="Status" value={<ClaimStatusBadge status={claim.status} />} />
              <SummaryRow label="Employee" value={claim.userName} />
              <SummaryRow label="Project" value={claim.projectName} />
              <SummaryRow label="Period" value={`${claim.periodFrom} to ${claim.periodTo}`} />
              <SummaryRow label="Claimed" value={formatCurrency(claim.totalClaimed)} />
              <SummaryRow label="Verified" value={formatCurrency(claim.totalVerified)} />
              <SummaryRow label="Approved" value={formatCurrency(claim.totalApproved)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Claim receipts and supporting files.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {claim.attachments.length === 0 ? (
                <p className="text-sm text-text-secondary">No attachments.</p>
              ) : (
                claim.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between rounded-lg border border-surface-border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-5 w-5 shrink-0 text-brand-blue" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text-primary">
                          {attachment.fileName}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {Math.round(attachment.fileSize / 1024)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Preview / download"
                      onClick={() => window.open(attachment.url, "_blank", "noopener,noreferrer")}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Expense Items</CardTitle>
              <CardDescription>
                Category, bill type, project cost code and claimed value.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClaimItemsTable items={claim.items} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval Timeline</CardTitle>
              <CardDescription>
                Full audit history for submission, approvals and payment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApprovalTimeline
                approvals={claim.approvals}
                approvalPath={claim.approvalPath}
              />
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
  value: string | JSX.Element;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-surface-border pb-3 last:border-0 last:pb-0">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function getActionRoute(user: AppUser, claim: Claim) {
  if (canPerformClaimAction({ user, claim, action: "admin_review" }).allowed) {
    return "/claims/admin-verification";
  }
  if (canPerformClaimAction({ user, claim, action: "manager_review" }).allowed) {
    return "/claims/manager-approval";
  }
  if (canPerformClaimAction({ user, claim, action: "final_review" }).allowed) {
    return "/claims/final-approval";
  }
  if (canPerformClaimAction({ user, claim, action: "generate_voucher" }).allowed) {
    return "/claims/vouchers";
  }
  return null;
}
