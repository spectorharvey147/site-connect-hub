import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { casualLabourService } from "@/services/casualLabourService";
import { formatCurrency } from "@/utils/format";

type LabourBillRow = Record<string, unknown>;
type LabourBillTotals = { gross: number; deduction: number; net: number };

function money(row: LabourBillRow, key: string) {
  return Number(row[key] ?? 0);
}

export function LabourBillsPage() {
  const { user } = useAuth();
  const [bills, setBills] = useState<LabourBillRow[]>([]);

  useEffect(() => {
    if (!user) return;
    void casualLabourService.listBills(user).then((rows) =>
      setBills(rows as LabourBillRow[]),
    );
  }, [user]);

  const totals = useMemo(
    () =>
      bills.reduce<LabourBillTotals>(
        (summary, bill) => ({
          gross:
            summary.gross +
            money(bill, "normal_amount") +
            money(bill, "overtime_amount") +
            money(bill, "allowance_amount"),
          deduction: summary.deduction + money(bill, "deduction_amount"),
          net: summary.net + money(bill, "net_amount"),
        }),
        { gross: 0, deduction: 0, net: 0 },
      ),
    [bills],
  );

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Casual Labour Bills"
        description="Preview generated labour bills from approved attendance and work allocation source data."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Casual Labour", to: "/casual-labour" },
          { label: "Bills" },
        ]}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard metric={{ label: "Gross", value: formatCurrency(totals.gross), tone: "info" }} />
        <StatCard metric={{ label: "Deductions", value: formatCurrency(totals.deduction), tone: "warning" }} />
        <StatCard metric={{ label: "Net payable", value: formatCurrency(totals.net), tone: "success" }} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bill source preview</CardTitle>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <EmptyState
              title="No labour bills generated"
              description="Approve submitted labour attendance to generate bill-ready source records."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">Period</th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">Project</th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">Vendor</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary">Gross</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary">Deduction</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary">Net</th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {bills.map((bill) => {
                    const gross =
                      money(bill, "normal_amount") +
                      money(bill, "overtime_amount") +
                      money(bill, "allowance_amount");
                    return (
                      <tr key={String(bill.id)} className="hover:bg-brand-light/40">
                        <td className="px-4 py-3">
                          {String(bill.period_from)} to {String(bill.period_to)}
                        </td>
                        <td className="px-4 py-3">{String(bill.project_id ?? "")}</td>
                        <td className="px-4 py-3">{String(bill.vendor_id ?? "")}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(gross)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(money(bill, "deduction_amount"))}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatCurrency(money(bill, "net_amount"))}</td>
                        <td className="px-4 py-3 capitalize">{String(bill.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
