import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { vendorsService } from "@/services/vendorsService";
import type { VendorBalance, VendorBill, VendorLedgerEntry, VendorPaymentVoucher, VendorSummary, Vendor } from "@/types/vendors";
import { formatCurrency } from "@/utils/format";

export type VendorSection = "master" | "detail" | "contracts" | "bills" | "vouchers" | "payments" | "ledger" | "reports";
const titles: Record<VendorSection, string> = {
  master: "Vendor Master", detail: "Vendor Detail", contracts: "Vendor Contracts",
  bills: "Vendor Bills", vouchers: "Vendor Vouchers", payments: "Vendor Payments",
  ledger: "Vendor Ledger", reports: "Vendor Reports",
};

export function VendorSectionPage({ section }: { section: VendorSection }) {
  const { user } = useAuth();
  const { vendorId } = useParams();
  const [data, setData] = useState<{ vendors: Vendor[]; bills: VendorBill[]; vouchers: VendorPaymentVoucher[]; ledger: VendorLedgerEntry[]; balances: VendorBalance[]; summary: VendorSummary } | null>(null);
  useEffect(() => {
    if (user) void vendorsService.getDashboard(user).then(setData);
  }, [user]);
  if (!data) return null;

  const selectedVendor = data.vendors.find((item) => item.id === vendorId);
  const rows: Array<Array<string | number>> =
    section === "master" || section === "detail"
      ? data.vendors.filter((item) => !vendorId || item.id === vendorId).map((item) => [item.code, item.name, item.vendorType, item.contactPerson, item.phone, item.status])
      : section === "bills" || section === "contracts"
        ? data.bills.map((item) => [item.billNumber, item.vendorName, item.projectName, item.invoiceNumber, formatCurrency(item.totalAmount), item.status])
        : section === "vouchers" || section === "payments"
          ? data.vouchers.map((item) => [item.voucherNumber, item.paidToName, item.voucherDate, formatCurrency(item.netPayableAmount), item.status])
          : section === "ledger"
            ? data.ledger.map((item) => [item.createdAt.slice(0, 10), item.vendorName, item.description, formatCurrency(item.debit), formatCurrency(item.credit), formatCurrency(item.balanceAfter)])
            : data.balances.map((item) => [item.vendorName, item.vendorType, formatCurrency(item.totalBilled), formatCurrency(item.totalPaid), formatCurrency(item.outstandingBalance), item.pendingBills]);
  const headers = section === "master" || section === "detail"
    ? ["Code", "Vendor", "Type", "Contact", "Phone", "Status"]
    : section === "bills" || section === "contracts"
      ? ["Bill", "Vendor", "Project", "Invoice", "Amount", "Status"]
      : section === "vouchers" || section === "payments"
        ? ["Voucher", "Payee", "Date", "Net payable", "Status"]
        : section === "ledger"
          ? ["Date", "Vendor", "Description", "Debit", "Credit", "Balance"]
          : ["Vendor", "Type", "Billed", "Paid", "Outstanding", "Pending bills"];

  return (
    <>
      <PageHeader title={selectedVendor?.name ?? titles[section]} description="Vendor onboarding, billing, payment and balance records." breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Vendors", to: "/vendors" }, { label: selectedVendor?.name ?? titles[section] }]} />
      <Card><CardHeader><CardTitle>{selectedVendor?.name ?? titles[section]}</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="min-w-full divide-y divide-surface-border text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-text-secondary"><tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-surface-border">{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody></table></div></CardContent></Card>
    </>
  );
}
