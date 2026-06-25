import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { vendorsService } from "@/services/vendorsService";
import type { VendorBill, VendorLedgerEntry, VendorPayment, VendorPaymentVoucher } from "@/types/vendors";
import { formatCurrency } from "@/utils/format";

export type VendorWorkflowSection = "bills" | "source-preview" | "vouchers" | "payments" | "ledger";

const titles: Record<VendorWorkflowSection, string> = {
  bills: "Vendor Bills",
  "source-preview": "Vendor Bill Source Preview",
  vouchers: "Vendor Payment Vouchers",
  payments: "Vendor Payments",
  ledger: "Vendor Ledger",
};

export function VendorBillsWorkflowPage({ section }: { section: VendorWorkflowSection }) {
  const { user } = useAuth();
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [vouchers, setVouchers] = useState<VendorPaymentVoucher[]>([]);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [ledger, setLedger] = useState<VendorLedgerEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      vendorsService.listBills(user),
      vendorsService.listVouchers(user),
      vendorsService.listPayments(user),
      vendorsService.listLedger(user),
    ]).then(([billRows, voucherRows, paymentRows, ledgerRows]) => {
      setBills(billRows);
      setVouchers(voucherRows);
      setPayments(paymentRows);
      setLedger(ledgerRows);
    });
  }, [user]);

  if (!user) return null;

  const rows = section === "vouchers"
    ? vouchers.map((row) => [row.voucherNumber, row.voucherDate, row.paidToName, formatCurrency(row.netPayableAmount), row.status])
    : section === "payments"
      ? payments.map((row) => [row.paymentDate, row.referenceNumber, row.vendorId, formatCurrency(row.amount), row.status])
      : section === "ledger"
        ? ledger.map((row) => [row.createdAt.slice(0, 10), row.vendorName, row.type, formatCurrency(row.debit), formatCurrency(row.credit), formatCurrency(row.balanceAfter)])
        : bills.map((row) => [row.billNumber, row.vendorName, row.billType, `${row.billingPeriodFrom} to ${row.billingPeriodTo}`, formatCurrency(row.totalAmount), row.status]);

  const headers = section === "ledger"
    ? ["Date", "Vendor", "Type", "Debit", "Credit", "Balance"]
    : section === "vouchers"
      ? ["Voucher", "Date", "Paid to", "Net payable", "Status"]
      : section === "payments"
        ? ["Date", "Reference", "Vendor", "Amount", "Status"]
        : ["Bill", "Vendor", "Type", "Period", "Amount", "Status"];

  return (
    <>
      <PageHeader
        title={titles[section]}
        description="Vendor billing, source-backed vouchers, payments and outstanding ledger."
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Vendors", to: "/vendors" }, { label: titles[section] }]}
        action={section === "bills" ? <Button type="button" onClick={() => window.location.assign("/vendors")}>Create / Preview Bill</Button> : null}
      />
      <Card>
        <CardHeader><CardTitle>{titles[section]}</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title={`No ${titles[section].toLowerCase()}`} description="Records from the production vendor workflow will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-text-secondary">
                  <tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {rows.map((row, index) => (
                    <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3">{cell}</td>)}</tr>
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
