import { Download, FileText, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { claimsService } from "@/services/claimsService";
import { useAuth } from "@/hooks/useAuth";
import type { LedgerFilters, LedgerStatement, UserClaimBalance } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

const selectClass =
  "h-11 rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function ClaimLedgerPage() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<UserClaimBalance[]>([]);
  const [statement, setStatement] = useState<LedgerStatement | null>(null);
  const [filters, setFilters] = useState<LedgerFilters>({});

  useEffect(() => {
    if (!user) {
      return;
    }

    void Promise.all([
      claimsService.listUserBalances(user),
      claimsService.getLedgerStatement(user, filters),
    ]).then(([nextBalances, nextStatement]) => {
      setBalances(nextBalances);
      setStatement(nextStatement);
    });
  }, [filters, user]);

  if (!user) {
    return null;
  }

  const selectedBalance =
    balances.find((balance) => balance.userId === statement?.userId) ??
    balances[0];

  return (
    <>
      <PageHeader
        title="Ledger Statement"
        description="Employee balance, payable movements, voucher references and payment settlement history."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Claims", to: "/claims" },
          { label: "Ledger Statement" },
        ]}
        action={
          <Button
            type="button"
            variant="secondary"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => statement && exportLedgerCsv(statement)}
          >
            CSV
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          metric={{
            label: "User balance",
            value: formatCurrency(selectedBalance?.outstandingBalance ?? 0),
            tone:
              (selectedBalance?.outstandingBalance ?? 0) > 0
                ? "warning"
                : "success",
          }}
          icon={<UserRound className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Total claimed",
            value: formatCurrency(selectedBalance?.totalClaimed ?? 0),
            tone: "info",
          }}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Total paid",
            value: formatCurrency(selectedBalance?.totalPaid ?? 0),
            tone: "success",
          }}
          icon={<Download className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Pending claims",
            value: String(selectedBalance?.pendingClaims ?? 0),
            tone: "warning",
          }}
          icon={<FileText className="h-5 w-5" />}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Statement Filters</CardTitle>
          <CardDescription>
            Select employee and date range to generate a ledger statement.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <select
            className={selectClass}
            value={filters.userId ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                userId: event.target.value || undefined,
              }))
            }
          >
            <option value="">Current user / all visible</option>
            {balances.map((balance) => (
              <option key={balance.userId} value={balance.userId}>
                {balance.userName}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={filters.fromDate ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                fromDate: event.target.value || undefined,
              }))
            }
          />
          <Input
            type="date"
            value={filters.toDate ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                toDate: event.target.value || undefined,
              }))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {statement?.userName ?? "Employee"} Statement
          </CardTitle>
          <CardDescription>
            Opening {formatCurrency(statement?.openingBalance ?? 0)} · Closing{" "}
            {formatCurrency(statement?.closingBalance ?? 0)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!statement || statement.entries.length === 0 ? (
            <EmptyState
              title="No statement entries"
              description="Ledger entries will appear after final approval, voucher generation or payment."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Reference
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Description
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                      Debit
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                      Credit
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border bg-white">
                  {statement.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-brand-light/40">
                      <td className="px-4 py-3 text-text-secondary">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        <span className="block font-semibold text-brand-blue">
                          {entry.claimNumber ?? entry.claimId ?? "-"}
                        </span>
                        {entry.voucherNumber ? (
                          <span className="block text-xs">{entry.voucherNumber}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {entry.description}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(entry.debit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(entry.credit)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {formatCurrency(entry.balanceAfter)}
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

function exportLedgerCsv(statement: LedgerStatement) {
  const rows = [
    [
      "Date",
      "Employee",
      "Claim",
      "Voucher",
      "Type",
      "Description",
      "Debit",
      "Credit",
      "Balance",
    ],
    ...statement.entries.map((entry) => [
      entry.createdAt.slice(0, 10),
      statement.userName,
      entry.claimNumber ?? "",
      entry.voucherNumber ?? "",
      entry.type,
      entry.description,
      String(entry.debit),
      String(entry.credit),
      String(entry.balanceAfter),
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${statement.userName}-ledger-statement.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
