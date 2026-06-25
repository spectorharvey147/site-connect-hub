import { CheckCircle2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { LeaveStatusBadge } from "@/components/leave/LeaveStatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { leaveService } from "@/services/leaveService";
import { useAuth } from "@/hooks/useAuth";
import type { LeaveApplication } from "@/types/leave";

export function LeaveApprovalsPage() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<LeaveApplication[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});

  const loadQueue = useCallback(async () => {
    if (!user) {
      return;
    }
    setQueue(await leaveService.listApprovalQueue(user));
  }, [user]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  if (!user) {
    return null;
  }

  async function decide(leaveId: string, decision: "approved" | "rejected") {
    if (!user) {
      return;
    }
    const currentUser = user;
    try {
      await leaveService.decideLeave(
        {
          leaveId,
          decision,
          comments: comments[leaveId] ?? "",
        },
        currentUser,
      );
      toast.success(`Leave ${decision}.`);
      await loadQueue();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to decide leave.");
    }
  }

  return (
    <>
      <PageHeader
        title="Leave Approvals"
        description="Approve or reject pending team leave applications with comments."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Leave", to: "/leave" },
          { label: "Approvals" },
        ]}
      />

      {queue.length === 0 ? (
        <EmptyState
          title="No pending leave requests"
          description="Applications needing your approval will appear here."
        />
      ) : (
        <div className="space-y-4">
          {queue.map((leave) => (
            <Card key={leave.id}>
              <CardHeader>
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <CardTitle>
                      {leave.leaveNumber} · {leave.userName}
                    </CardTitle>
                    <p className="mt-1 text-sm text-text-secondary">
                      {leave.leaveTypeName} · {leave.fromDate} to {leave.toDate} ·{" "}
                      {leave.numberOfDays} days
                    </p>
                  </div>
                  <LeaveStatusBadge status={leave.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-text-primary">
                  {leave.reason}
                </p>
                <Textarea
                  label="Approval comments"
                  value={comments[leave.id] ?? ""}
                  onChange={(event) =>
                    setComments((current) => ({
                      ...current,
                      [leave.id]: event.target.value,
                    }))
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                    onClick={() => void decide(leave.id, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    leftIcon={<XCircle className="h-4 w-4" />}
                    onClick={() => void decide(leave.id, "rejected")}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
