import { Download } from "lucide-react";
import { useEffect, useState } from "react";

import { LeaveStatusBadge } from "@/components/leave/LeaveStatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { leaveService } from "@/services/leaveService";
import { useAuth } from "@/hooks/useAuth";
import type { LeaveApplication } from "@/types/leave";

export function LeaveHistoryPage() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void leaveService.listLeaves(user).then(setLeaves);
  }, [user]);

  return (
    <>
      <PageHeader
        title="Leave History"
        description="Track leave applications, approval decisions and exported leave slips."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Leave", to: "/leave" },
          { label: "History" },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {leaves.length === 0 ? (
            <EmptyState
              title="No leave applications"
              description="Submitted leaves will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Leave
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Dates
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                      Slip
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border bg-white">
                  {leaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-brand-light/40">
                      <td className="px-4 py-3">
                        <p className="font-bold text-brand-blue">{leave.leaveNumber}</p>
                        <p className="text-xs text-text-secondary">{leave.leaveTypeName}</p>
                      </td>
                      <td className="px-4 py-3 text-text-primary">{leave.userName}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {leave.fromDate} to {leave.toDate}
                        <span className="block text-xs">{leave.numberOfDays} days</span>
                      </td>
                      <td className="px-4 py-3">
                        <LeaveStatusBadge status={leave.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          leftIcon={<Download className="h-4 w-4" />}
                          onClick={() => void downloadLeaveSlip(leave)}
                        >
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

async function downloadLeaveSlip(leave: LeaveApplication) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Site Connect Leave Slip", 20, 20);
  doc.setFontSize(11);
  doc.text(`Leave Number: ${leave.leaveNumber}`, 20, 36);
  doc.text(`Employee: ${leave.userName}`, 20, 44);
  doc.text(`Leave Type: ${leave.leaveTypeName}`, 20, 52);
  doc.text(`Dates: ${leave.fromDate} to ${leave.toDate}`, 20, 60);
  doc.text(`Days: ${leave.numberOfDays}`, 20, 68);
  doc.text(`Status: ${leave.status}`, 20, 76);
  doc.text(`Reason: ${leave.reason}`, 20, 92);
  if (leave.approvedByName) {
    doc.text(`Approved by: ${leave.approvedByName}`, 20, 108);
  }
  doc.save(`${leave.leaveNumber}.pdf`);
}
