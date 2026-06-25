import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { materialsService } from "@/services/materialsService";
import type { MaterialInventoryRow, MaterialReceipt, MaterialRequest } from "@/types/materials";
import { formatCurrency } from "@/utils/format";

export type MaterialsSection = "master" | "consumption" | "stock" | "ledger" | "reports";
const titles: Record<MaterialsSection, string> = {
  master: "Material Master",
  consumption: "Material Consumption",
  stock: "Material Stock",
  ledger: "Material Ledger",
  reports: "Material Reports",
};

export function MaterialsSectionPage({ section }: { section: MaterialsSection }) {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<MaterialInventoryRow[]>([]);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [receipts, setReceipts] = useState<MaterialReceipt[]>([]);

  useEffect(() => {
    if (!user) return;
    void materialsService.getDashboard(user).then((data) => {
      setInventory(data.inventory);
      setRequests(data.recentRequests);
      setReceipts(data.recentReceipts);
    });
  }, [user]);

  const tableRows = section === "master"
    ? materialsService.listMaterials().map((item) => [item.id, item.name, item.category, item.uom, item.status])
    : section === "ledger"
      ? [
          ...requests.map((item) => [item.requestDate, item.requestNumber, "Request", item.projectName, formatCurrency(item.items.reduce((total, row) => total + row.estimatedCost, 0)), item.status]),
          ...receipts.map((item) => [item.receiptDate, item.receiptNumber, "Receipt", item.projectName, item.vendorName, item.status]),
        ]
      : inventory.map((item) => [item.materialName, item.requestedQuantity, item.receivedQuantity, item.damagedQuantity, item.openQuantity, formatCurrency(item.estimatedCost)]);

  const tableHeaders = section === "master"
    ? ["Code", "Material", "Category", "UOM", "Status"]
    : section === "ledger"
      ? ["Date", "Reference", "Movement", "Project", "Value / Party", "Status"]
      : ["Material", "Requested", "Received", "Damaged", "Available / Open", "Value"];

  return (
    <>
      <PageHeader title={titles[section]} description="Organization material catalogue, movement, stock and reporting." breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Materials", to: "/materials" }, { label: titles[section] }]} />
      <Card>
        <CardHeader><CardTitle>{titles[section]}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-border text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-text-secondary"><tr>{tableHeaders.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead>
              <tbody className="divide-y divide-surface-border">{tableRows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
