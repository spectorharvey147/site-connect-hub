import {
  AlertTriangle,
  ClipboardList,
  FilePlus2,
  IndianRupee,
  PackageCheck,
  PenLine,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { MaterialReceiptTable } from "@/components/materials/MaterialReceiptTable";
import { MaterialRequestTable } from "@/components/materials/MaterialRequestTable";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { materialsService } from "@/services/materialsService";
import type {
  MaterialInventoryRow,
  MaterialReceipt,
  MaterialRequest,
  MaterialsSummary,
} from "@/types/materials";
import { formatCurrency } from "@/utils/format";

export function MaterialsLandingPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<MaterialsSummary | null>(null);
  const [recentRequests, setRecentRequests] = useState<MaterialRequest[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<MaterialReceipt[]>([]);
  const [inventory, setInventory] = useState<MaterialInventoryRow[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void materialsService.getDashboard(user).then((dashboard) => {
      setSummary(dashboard.summary);
      setRecentRequests(dashboard.recentRequests);
      setRecentReceipts(dashboard.recentReceipts);
      setInventory(dashboard.inventory);
    });
  }, [user]);

  if (!user || !summary) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Materials"
        description="Raise material requests, receive supplier deliveries, inspect quality and monitor inventory movement."
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Materials" }]}
        action={
          <Link to="/material/request">
            <Button type="button" leftIcon={<FilePlus2 className="h-4 w-4" />}>
              Request Material
            </Button>
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          metric={{
            label: "Open requests",
            value: String(summary.openRequests),
            tone: summary.openRequests > 0 ? "warning" : "success",
          }}
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Approved requests",
            value: String(summary.approvedRequests),
            tone: "info",
          }}
          icon={<PackageCheck className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Received this month",
            value: String(summary.receivedThisMonth),
            tone: "success",
          }}
          icon={<PackageCheck className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Open estimate",
            value: formatCurrency(summary.estimatedOpenCost),
            tone: "neutral",
          }}
          icon={<IndianRupee className="h-5 w-5" />}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <ToolLink to="/material/request" title="Material Request" />
        <ToolLink to="/material/receipt" title="Material Receipt" />
        <ToolLink to="/materials" title="Inventory Report" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <MaterialRequestTable requests={recentRequests} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <MaterialReceiptTable receipts={recentReceipts} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Inventory Movement</CardTitle>
            {summary.damagedReceipts > 0 ? (
              <AlertTriangle className="h-4 w-4 text-brand-danger" />
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-border text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Material</th>
                  <th className="px-4 py-3 font-semibold">Requested</th>
                  <th className="px-4 py-3 font-semibold">Received</th>
                  <th className="px-4 py-3 font-semibold">Damaged</th>
                  <th className="px-4 py-3 font-semibold">Open</th>
                  <th className="px-4 py-3 font-semibold">Estimate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border bg-white">
                {inventory.map((row) => (
                  <tr key={row.materialId}>
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      {row.materialName}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {row.requestedQuantity} {row.uom}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {row.receivedQuantity} {row.uom}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {row.damagedQuantity} {row.uom}
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      {row.openQuantity} {row.uom}
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      {formatCurrency(row.estimatedCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function ToolLink({ to, title }: { to: string; title: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-surface-border bg-white p-4 text-sm font-bold text-text-primary shadow-card transition hover:border-brand-blue hover:bg-brand-light/40"
    >
      <PenLine className="h-4 w-4 text-brand-blue" />
      {title}
    </Link>
  );
}
