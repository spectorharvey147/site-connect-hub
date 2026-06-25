import { Download, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
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
import type { ClaimTransaction, TransactionFilters, UserClaimBalance } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

const selectClass =
  "h-11 rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function ClaimTransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<ClaimTransaction[]>([]);
  const [balances, setBalances] = useState<UserClaimBalance[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>({});

  useEffect(() => {
    if (!user) {
      return;
    }

    void Promise.all([
      claimsService.listTransactions(user, filters),
      claimsService.listUserBalances(user),
    ]).then(([nextTransactions, nextBalances]) => {
      setTransactions(nextTransactions);
      setBalances(nextBalances);
    });
  }, [filters, user]);

  return (
    <>
      <PageHeader
        title="Claim Transactions"
        description="Audit-friendly transaction register for claim submissions, approvals, reductions, vouchers and payments."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Claims", to: "/claims" },
          { label: "Transactions" },
        ]}
        action={
          <Button
            type="button"
            variant="secondary"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => exportTransactionsCsv(transactions)}
          >
            CSV
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Register Filters</CardTitle>
          <CardDescription>
            Search by transaction, claim, voucher, employee or description.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1fr_220px_180px_180px]">
          <Input
            placeholder="Search transactions"
            value={filters.search ?? ""}
            leftIcon={<Search className="h-4 w-4" />}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value || undefined,
              }))
            }
          />
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
            <option value="">All visible users</option>
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
          <CardTitle>Transaction Register</CardTitle>
          <CardDescription>{transactions.length} transactions found.</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <EmptyState
              title="No transactions found"
              description="Claim actions will create transaction rows automatically."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Transaction
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Reference
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border bg-white">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-brand-light/40">
                      <td className="px-4 py-3">
                        <span className="font-bold text-brand-blue">
                          {transaction.transactionNumber}
                        </span>
                        <span className="mt-1 block text-xs text-text-secondary">
                          {new Date(transaction.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-primary">
                        {transaction.userName}
                        <span className="block text-xs text-text-secondary">
                          By {transaction.actorName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        <span className="block">{transaction.claimNumber ?? "-"}</span>
                        {transaction.voucherNumber ? (
                          <span className="block text-xs">
                            {transaction.voucherNumber}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-text-primary">
                          {transaction.type.split("_").join(" ")}
                        </span>
                        <span className="block max-w-xs truncate text-xs text-text-secondary">
                          {transaction.description}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            transaction.direction === "credit"
                              ? "font-bold text-brand-success"
                              : transaction.direction === "debit"
                                ? "font-bold text-brand-warning"
                                : "font-bold text-text-primary"
                          }
                        >
                          {formatCurrency(transaction.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {formatCurrency(transaction.balanceAfter)}
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

function exportTransactionsCsv(transactions: ClaimTransaction[]) {
  const rows = [
    [
      "Transaction",
      "Date",
      "Employee",
      "Claim",
      "Voucher",
      "Type",
      "Amount",
      "Direction",
      "Balance",
      "Actor",
      "Description",
    ],
    ...transactions.map((transaction) => [
      transaction.transactionNumber,
      transaction.createdAt.slice(0, 10),
      transaction.userName,
      transaction.claimNumber ?? "",
      transaction.voucherNumber ?? "",
      transaction.type,
      String(transaction.amount),
      transaction.direction,
      String(transaction.balanceAfter),
      transaction.actorName,
      transaction.description,
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "claim-transactions.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
