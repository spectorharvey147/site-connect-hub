import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ClaimSummaryCards } from "@/components/claims/ClaimSummaryCards";
import { ClaimsTable } from "@/components/claims/ClaimsTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { claimsService } from "@/services/claimsService";
import { useAuth } from "@/hooks/useAuth";
import type { Claim, ClaimReportSummary } from "@/types/claims";

export function ClaimReportsPage() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [summary, setSummary] = useState<ClaimReportSummary | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    void Promise.all([
      claimsService.listClaims(user),
      claimsService.getReportSummary(user),
    ]).then(([nextClaims, nextSummary]) => {
      setClaims(nextClaims);
      setSummary(nextSummary);
    });
  }, [user]);

  const chartData = Object.values(
    claims.reduce<Record<string, { status: string; amount: number }>>(
      (grouped, claim) => ({
        ...grouped,
        [claim.status]: {
          status: claim.status.split("_").join(" "),
          amount: (grouped[claim.status]?.amount ?? 0) + claim.totalClaimed,
        },
      }),
      {},
    ),
  );

  return (
    <>
      <PageHeader
        title="Claim Reports"
        description="Claim totals, approval load, paid value and exportable data."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Claims", to: "/claims" },
          { label: "Reports" },
        ]}
        action={
          <Button
            type="button"
            variant="secondary"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => exportClaimsCsv(claims)}
          >
            CSV
          </Button>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[["Claim Ageing","/reports/claims/ageing"],["Approval Delay","/reports/claims/approval-delay"],["Project Cost","/reports/claims/project-cost"],["Employee Ledger","/reports/claims/employee-ledger"],["Deductions","/reports/claims/deductions"],["Payment Pending","/reports/accounts/payment-pending"],["SAP Export","/reports/accounts/sap-export"]].map(([label,to])=><Link key={to} to={to} className="rounded-lg border border-surface-border bg-white p-4 font-semibold hover:border-brand-blue">{label}</Link>)}</div>
        {summary ? <ClaimSummaryCards summary={summary} /> : null}
        <Card>
          <CardHeader>
            <CardTitle>Claim Amount by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#0066CC" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <ClaimsTable claims={claims} />
      </div>
    </>
  );
}

function exportClaimsCsv(claims: Claim[]) {
  const rows = [
    ["Claim Number", "Employee", "Project", "Status", "Claimed", "Approved"],
    ...claims.map((claim) => [
      claim.claimNumber,
      claim.userName,
      claim.projectName,
      claim.status,
      String(claim.totalClaimed),
      String(claim.totalApproved),
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "claims-report.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
