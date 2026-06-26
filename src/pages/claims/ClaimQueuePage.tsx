import { CheckCircle2, IndianRupee, RotateCcw, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ClaimItemsTable } from "@/components/claims/ClaimItemsTable";
import { ClaimAttachmentsList } from "@/components/claims/ClaimAttachmentsList";
import { ClaimStatusBadge } from "@/components/claims/ClaimStatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { claimsService } from "@/services/claimsService";
import { useAuth } from "@/hooks/useAuth";
import type { Claim, ClaimReviewInput } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

export type ClaimQueueStage = "admin" | "manager" | "final";

const stageCopy: Record<
  ClaimQueueStage,
  {
    title: string;
    description: string;
    routeLabel: string;
    reviewStage: ClaimReviewInput["stage"];
  }
> = {
  admin: {
    title: "Admin Verification",
    description: "Verify bills, reduce amounts, reject or request corrections.",
    routeLabel: "Admin Verification",
    reviewStage: "admin_verification",
  },
  manager: {
    title: "Manager Approval",
    description: "Review team claims and approve, reduce or return them.",
    routeLabel: "Manager Approval",
    reviewStage: "manager_approval",
  },
  final: {
    title: "Super Admin Final Approval",
    description: "Authorize claims for payment processing.",
    routeLabel: "Final Approval",
    reviewStage: "final_approval",
  },
};

export function ClaimQueuePage({ stage }: { stage: ClaimQueueStage }) {
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const copy =
    stage === "final" && user?.role === "hod"
      ? {
          ...stageCopy.final,
          title: "HOD Final Approval",
          description: "Approve claims for your department when the matrix assigns HOD final authority.",
        }
      : stageCopy[stage];

  const loadQueue = useCallback(async () => {
    if (!user) {
      return;
    }
    setClaims(await claimsService.listApprovalQueue(user, stage));
  }, [stage, user]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  if (!user) {
    return null;
  }

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Claims", to: "/claims" },
          { label: copy.routeLabel },
        ]}
      />

      {claims.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          description="Claims requiring your decision will appear here."
        />
      ) : (
        <div className="space-y-5">
          {claims.map((claim) => (
            <ReviewCard
              key={claim.id}
              claim={claim}
              stage={copy.reviewStage}
              onComplete={loadQueue}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ReviewCard({
  claim,
  stage,
  onComplete,
}: {
  claim: Claim;
  stage: ClaimReviewInput["stage"];
  onComplete: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [remarks, setRemarks] = useState("");
  const [amountAfter, setAmountAfter] = useState(
    String(claim.totalApproved || claim.totalVerified || claim.totalClaimed),
  );
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return null;
  }

  async function submitDecision(decision: ClaimReviewInput["decision"]) {
    if (!user) {
      return;
    }

    setSubmitting(true);
    try {
      await claimsService.reviewClaim(
        {
          claimId: claim.id,
          stage,
          decision,
          remarks,
          amountAfter:
            decision === "reduced" ? Number(amountAfter) : Number(amountAfter),
        },
        user,
      );
      toast.success("Claim updated.");
      await onComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update claim.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <CardTitle>
              {claim.claimNumber} · {claim.title}
            </CardTitle>
            <p className="mt-1 text-sm text-text-secondary">
              {claim.userName} · {claim.projectName} ·{" "}
              {formatCurrency(claim.totalClaimed)}
            </p>
            {claim.customerName ? (
              <p className="mt-1 text-xs font-medium text-text-secondary">
                Customer: {claim.customerName}
              </p>
            ) : null}
          </div>
          <ClaimStatusBadge status={claim.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ClaimItemsTable items={claim.items} />
        <div className="rounded-lg border border-surface-border bg-slate-50 p-4">
          <p className="mb-3 text-sm font-bold text-text-primary">
            Documents / bills ({claim.attachments.length})
          </p>
          <ClaimAttachmentsList attachments={claim.attachments} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <Input
            label="Approved amount"
            type="number"
            min={0}
            step="0.01"
            value={amountAfter}
            onChange={(event) => setAmountAfter(event.target.value)}
            leftIcon={<IndianRupee className="h-4 w-4" />}
          />
          <Textarea
            label="Remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Add verification or approval notes"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
            isLoading={submitting}
            onClick={() => void submitDecision("approved")}
          >
            Approve
          </Button>
          <Button
            type="button"
            variant="outline"
            leftIcon={<IndianRupee className="h-4 w-4" />}
            isLoading={submitting}
            onClick={() => void submitDecision("reduced")}
          >
            Reduce & Approve
          </Button>
          <Button
            type="button"
            variant="secondary"
            leftIcon={<RotateCcw className="h-4 w-4" />}
            isLoading={submitting}
            onClick={() => void submitDecision("changes_requested")}
          >
            Request Changes
          </Button>
          <Button
            type="button"
            variant="danger"
            leftIcon={<XCircle className="h-4 w-4" />}
            isLoading={submitting}
            onClick={() => void submitDecision("rejected")}
          >
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
