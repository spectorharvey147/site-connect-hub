import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { claimsService } from "@/services/claimsService";
import { reportsService } from "@/services/reportsService";
import { vendorsService } from "@/services/vendorsService";
import type {
  ClaimTransaction,
  EmployeeLedgerEntry,
  PaymentVoucher,
} from "@/types/claims";
import type { ReportsDashboard } from "@/types/reports";
import type {
  VendorLedgerEntry,
  VendorPayment,
  VendorPaymentVoucher,
} from "@/types/vendors";
import { formatCurrency } from "@/utils/format";

export type AccountsSection =
  | "payment-queue"
  | "vouchers"
  | "employee-ledger"
  | "vendor-ledger"
  | "reconciliation"
  | "reports";

type AccountsData = {
  claimVouchers: PaymentVoucher[];
  vendorVouchers: VendorPaymentVoucher[];
  employeeLedger: EmployeeLedgerEntry[];
  vendorLedger: VendorLedgerEntry[];
  transactions: ClaimTransaction[];
  vendorPayments: VendorPayment[];
  reports: ReportsDashboard | null;
};

const titles: Record<Exclude<AccountsSection, "payment-queue">, string> = {
  vouchers: "Accounts Vouchers",
  "employee-ledger": "Employee Ledger",
  "vendor-ledger": "Vendor Ledger",
  reconciliation: "Accounts Reconciliation",
  reports: "Accounts Reports",
};

export function AccountsSectionPage({
  section,
}: {
  section: Exclude<AccountsSection, "payment-queue">;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<AccountsData | null>(null);

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      claimsService.listVouchers(user),
      vendorsService.listVouchers(user),
      claimsService.listLedger(user),
      vendorsService.listLedger(user),
      claimsService.listTransactions(user),
      vendorsService.listPayments(user),
      reportsService.getDashboard(user),
    ]).then(
      ([
        claimVouchers,
        vendorVouchers,
        employeeStatement,
        vendorLedger,
        transactions,
        vendorPayments,
        reports,
      ]) =>
        setData({
          claimVouchers,
          vendorVouchers,
          employeeLedger: employeeStatement,
          vendorLedger,
          transactions,
          vendorPayments,
          reports,
        }),
    );
  }, [user]);

  if (!user || !data) return null;

  return (
    <>
      <PageHeader
        title={titles[section]}
        description="Dedicated accounts register with employee and vendor finance records."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Accounts", to: "/accounts" },
          { label: titles[section] },
        ]}
      />
      {section === "vouchers" ? <Vouchers data={data} /> : null}
      {section === "employee-ledger" ? (
        <Register
          title="Employee Ledger Entries"
          headers={["Date", "Employee", "Reference", "Description", "Debit", "Credit", "Balance"]}
          rows={data.employeeLedger.map((row) => [
            row.createdAt.slice(0, 10),
            row.userName ?? row.userId,
            row.claimNumber ?? row.voucherNumber ?? row.type,
            row.description,
            formatCurrency(row.debit),
            formatCurrency(row.credit),
            formatCurrency(row.balanceAfter),
          ])}
        />
      ) : null}
      {section === "vendor-ledger" ? (
        <Register
          title="Vendor Ledger Entries"
          headers={["Date", "Vendor", "Type", "Description", "Debit", "Credit", "Balance"]}
          rows={data.vendorLedger.map((row) => [
            row.createdAt.slice(0, 10),
            row.vendorName,
            row.type,
            row.description,
            formatCurrency(row.debit),
            formatCurrency(row.credit),
            formatCurrency(row.balanceAfter),
          ])}
        />
      ) : null}
      {section === "reconciliation" ? <Reconciliation data={data} /> : null}
      {section === "reports" && data.reports ? <AccountsReports report={data.reports} /> : null}
    </>
  );
}

function Vouchers({ data }: { data: AccountsData }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Register
        title="Employee Claim Vouchers"
        headers={["Voucher", "Payee", "Date", "Net", "Status"]}
        rows={data.claimVouchers.map((row) => [
          row.voucherNumber,
          row.paidToName,
          row.voucherDate,
          formatCurrency(row.netPayableAmount),
          row.status,
        ])}
      />
      <Register
        title="Vendor Payment Vouchers"
        headers={["Voucher", "Payee", "Date", "Net", "Status"]}
        rows={data.vendorVouchers.map((row) => [
          row.voucherNumber,
          row.paidToName,
          row.voucherDate,
          formatCurrency(row.netPayableAmount),
          row.status,
        ])}
      />
    </div>
  );
}

function Reconciliation({ data }: { data: AccountsData }) {
  const employeePaid = data.transactions
    .filter((row) => row.type === "payment_processed")
    .reduce((sum, row) => sum + row.amount, 0);
  const vendorPaid = data.vendorPayments.reduce((sum, row) => sum + row.amount, 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Employee payments" value={formatCurrency(employeePaid)} />
        <Metric label="Vendor payments" value={formatCurrency(vendorPaid)} />
        <Metric label="Combined processed" value={formatCurrency(employeePaid + vendorPaid)} />
      </div>
      <Register
        title="Vendor Payment Register"
        headers={["Date", "Reference", "Method", "Amount", "Status"]}
        rows={data.vendorPayments.map((row) => [
          row.paymentDate,
          row.referenceNumber,
          row.paymentMethod,
          formatCurrency(row.amount),
          row.status,
        ])}
      />
    </div>
  );
}

function AccountsReports({ report }: { report: ReportsDashboard }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {report.metrics.map((metric) => (
        <Card key={metric.label}>
          <CardContent>
            <Badge tone={metric.tone}>{metric.label}</Badge>
            <p className="mt-3 text-2xl font-bold text-text-primary">{metric.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs font-semibold uppercase text-text-secondary">{label}</p>
        <p className="mt-2 text-2xl font-bold text-text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}

function Register({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {!rows.length ? (
          <EmptyState title="No records" description="No matching finance records are available." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-border text-sm">
              <thead className="bg-slate-50">
                <tr>{headers.map((header) => <th key={header} className="px-3 py-3 text-left text-xs text-text-secondary">{header}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((row, index) => (
                  <tr key={`${title}-${index}`}>
                    {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-3">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
