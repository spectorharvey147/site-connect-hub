import { PencilLine, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useParams } from "react-router-dom";

import { ApprovalTimeline } from "@/components/claims/ApprovalTimeline";
import { ClaimAuditTimeline } from "@/components/claims/ClaimAuditTimeline";
import { ClaimAttachmentsList } from "@/components/claims/ClaimAttachmentsList";
import { ClaimItemsTable } from "@/components/claims/ClaimItemsTable";
import { ClaimQueriesPanel } from "@/components/claims/ClaimQueriesPanel";
import { ClaimStatusBadge } from "@/components/claims/ClaimStatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { canPerformClaimAction, claimsService } from "@/services/claimsService";
import { canUseMasterIntervention } from "@/permissions/claimPermissions";
import { listClaimAuditLogs,type ClaimAuditEvent } from "@/services/auditService";
import { useAuth } from "@/hooks/useAuth";
import type { AppUser } from "@/types/auth";
import type { Claim } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

export function ClaimDetailPage() {
  const { claimId } = useParams();
  const { user } = useAuth();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditEvents,setAuditEvents]=useState<ClaimAuditEvent[]>([]);
  const [interventionOpen,setInterventionOpen]=useState(false);
  const [interventionAction,setInterventionAction]=useState<"place_on_hold"|"return_to_admin"|"return_to_manager"|"return_to_hod"|"cancel_claim"|"release_hold">("place_on_hold");
  const [interventionReason,setInterventionReason]=useState("");
  const [intervening,setIntervening]=useState(false);

  useEffect(() => {
    if (!user || !claimId) {
      return;
    }

    setLoading(true);
    void claimsService.getClaim(claimId, user).then((nextClaim) => {
      setClaim(nextClaim);
      setLoading(false);
    });
    void listClaimAuditLogs(claimId).then(setAuditEvents).catch(()=>setAuditEvents([]));
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
  const canResubmit =
    claim.status === "changes_requested" && claim.userId === user.id;

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
          <div className="flex flex-wrap gap-2">
            {canResubmit ? (
              <Button type="button" leftIcon={<PencilLine className="h-4 w-4" />}>
                <Link className="text-white" to={`/claims/submit?fromClaim=${claim.id}`}>
                  Edit & resubmit
                </Link>
              </Button>
            ) : null}
            {routeForAction ? (
              <Button type="button" leftIcon={<ReceiptText className="h-4 w-4" />}>
                <Link className="text-white" to={routeForAction}>
                  Open Action Queue
                </Link>
              </Button>
            ) : null}
            {canUseMasterIntervention(user, claim) ? <Button type="button" variant="danger" onClick={()=>setInterventionOpen(true)}>Master Intervention</Button> : null}
          </div>
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
              <SummaryRow label="Customer" value={claim.customerName ?? "-"} />
              <SummaryRow label="Period" value={`${claim.periodFrom} to ${claim.periodTo}`} />
              <SummaryRow label="Claimed" value={formatCurrency(claim.totalClaimed)} />
              <SummaryRow label="Verified" value={formatCurrency(claim.totalVerified)} />
              <SummaryRow label="Approved" value={formatCurrency(claim.totalApproved)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Queries & Missing Documents</CardTitle><CardDescription>Reviewers can ask for clarification or missing attachments; responses remain linked to this claim.</CardDescription></CardHeader>
            <CardContent><ClaimQueriesPanel claim={claim} user={user} onAttachmentAdded={() => { if (claimId) void claimsService.getClaim(claimId, user).then((next) => next && setClaim(next)); }} /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Claim receipts and supporting files.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ClaimAttachmentsList attachments={claim.attachments} />
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
              <div className="mt-6 border-t border-surface-border pt-5"><h3 className="mb-3 font-bold">System Audit Events</h3><ClaimAuditTimeline events={auditEvents}/></div>
            </CardContent>
          </Card>
        </div>
      </div>
      {interventionOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><Card className="w-full max-w-lg"><CardHeader><CardTitle>Master Intervention</CardTitle><CardDescription>This exceptional action is separate from approval history and fully audited.</CardDescription></CardHeader><CardContent className="space-y-4"><label className="block text-sm font-semibold">Action<select className="mt-1 h-11 w-full rounded-md border border-surface-border px-3" value={interventionAction} onChange={event=>setInterventionAction(event.target.value as typeof interventionAction)}><option value="place_on_hold">Place on hold</option><option value="return_to_admin">Return to Admin</option><option value="return_to_manager">Return to Manager</option><option value="return_to_hod">Return to HOD</option><option value="cancel_claim">Cancel claim</option>{claim.status==="on_hold"?<option value="release_hold">Release hold</option>:null}</select></label><Textarea label="Mandatory reason" value={interventionReason} onChange={event=>setInterventionReason(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setInterventionOpen(false)}>Close</Button><Button variant="danger" isLoading={intervening} onClick={()=>{if(!interventionReason.trim()){toast.error("Enter a reason.");return}if(!window.confirm(`Confirm Master Intervention: ${interventionAction.replace(/_/g," ")}?`))return;setIntervening(true);void claimsService.masterIntervention(claim.id,interventionAction,interventionReason,user).then(updated=>{setClaim(updated);setInterventionOpen(false);setInterventionReason("");toast.success("Master Intervention recorded.");return listClaimAuditLogs(claim.id)}).then(setAuditEvents).catch(error=>toast.error(error instanceof Error?error.message:"Intervention failed.")).finally(()=>setIntervening(false))}}>Confirm Intervention</Button></div></CardContent></Card></div> : null}
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
  if (canPerformClaimAction({ user, claim, action: user.role === "hod" ? "hod_review" : "final_review" }).allowed) {
    return "/claims/final-approval";
  }
  if (canPerformClaimAction({ user, claim, action: "generate_voucher" }).allowed) {
    return "/claims/vouchers";
  }
  return null;
}
