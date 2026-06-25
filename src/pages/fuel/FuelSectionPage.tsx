import { useEffect, useState } from "react";

import { FuelIssueTable } from "@/components/fuel/FuelIssueTable";
import { FuelReceiptTable } from "@/components/fuel/FuelReceiptTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FUEL_TYPE_LABELS, FUEL_VENDORS } from "@/constants/fuel";
import { useAuth } from "@/hooks/useAuth";
import { fuelService } from "@/services/fuelService";
import type { FuelDashboard } from "@/types/fuel";
import { formatCurrency } from "@/utils/format";

export type FuelSection =
  | "vendors"
  | "deposits"
  | "receipts"
  | "issues"
  | "stock"
  | "ledger"
  | "reports";

const titles: Record<FuelSection, string> = {
  vendors: "Fuel Vendors",
  deposits: "Fuel Deposits",
  receipts: "Fuel Receipts",
  issues: "Fuel Issues",
  stock: "Fuel Stock",
  ledger: "Fuel Ledger",
  reports: "Fuel Reports",
};

export function FuelSectionPage({ section }: { section: FuelSection }) {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<FuelDashboard | null>(null);

  useEffect(() => {
    if (user) void fuelService.getDashboard(user).then(setDashboard);
  }, [user]);

  if (!dashboard) return null;

  return (
    <>
      <PageHeader
        title={titles[section]}
        description="Project-linked fuel purchasing, issue, stock and consumption records."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Fuel", to: "/fuel" },
          { label: titles[section] },
        ]}
      />
      {section === "receipts" ? (
        <FuelReceiptTable receipts={dashboard.recentReceipts} />
      ) : section === "issues" ? (
        <FuelIssueTable issues={dashboard.recentIssues} />
      ) : (
        <Card>
          <CardHeader><CardTitle>{titles[section]}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-text-secondary">
                  <tr>{headers(section).map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {rows(section, dashboard).map((row, index) => (
                    <tr key={`${section}-${index}`}>
                      {row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 text-text-primary">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function headers(section: FuelSection) {
  if (section === "vendors") return ["Vendor", "Contact", "Phone", "Status"];
  if (section === "deposits") return ["Reference", "Vendor", "Project", "Amount", "Status"];
  if (section === "stock") return ["Date", "Opening", "Received", "Issued", "Closing"];
  if (section === "reports") return ["Machine", "Type", "Quantity", "Cost", "Average/day"];
  return ["Date", "Reference", "Description", "In", "Out", "Balance"];
}

function rows(section: FuelSection, dashboard: FuelDashboard): Array<Array<string | number>> {
  if (section === "vendors") {
    return FUEL_VENDORS.map((vendor) => [vendor.name, vendor.contactPerson, vendor.phone, vendor.status]);
  }
  if (section === "deposits") {
    return dashboard.recentReceipts
      .filter((receipt) => receipt.source === "advance")
      .map((receipt) => [receipt.referenceNumber || receipt.receiptNumber, receipt.vendorName, receipt.projectName, formatCurrency(receipt.totalAmount), receipt.status]);
  }
  if (section === "stock") {
    return dashboard.dailySummary.map((item) => [item.date, item.opening, item.received, item.issued, item.closing]);
  }
  if (section === "reports") {
    return dashboard.machineConsumption.map((item) => [item.machineNumber, item.machineType, item.totalQuantity, formatCurrency(item.cost), item.averagePerDay]);
  }
  const movements = [
    ...dashboard.recentReceipts.map((item) => ({
      date: item.date, ref: item.receiptNumber, description: `${FUEL_TYPE_LABELS[item.fuelType]} received`, incoming: item.quantity, outgoing: 0, balance: 0,
    })),
    ...dashboard.recentIssues.map((item) => ({
      date: item.date, ref: item.issueNumber, description: `${FUEL_TYPE_LABELS[item.fuelType]} issued`, incoming: 0, outgoing: item.totalIssued, balance: item.closingStock,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let balance = 0;
  return movements.map((item) => {
    balance = item.balance || balance + item.incoming - item.outgoing;
    return [item.date, item.ref, item.description, item.incoming, item.outgoing, balance];
  });
}
