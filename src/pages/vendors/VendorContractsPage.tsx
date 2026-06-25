import { Download, FilePlus2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { vendorContractService } from "@/services/vendorContractService";
import type { VendorContract, VendorContractType } from "@/types/vendorContracts";
import { formatCurrency } from "@/utils/format";

export function VendorContractsPage({
  contractType = "all",
}: {
  contractType?: VendorContractType | "all";
}) {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<VendorContract[]>([]);
  const [status, setStatus] = useState("all");
  useEffect(() => {
    if (user) void vendorContractService.list(user, { contractType }).then(setContracts);
  }, [contractType, user]);
  const filtered = useMemo(
    () => contracts.filter((item) => status === "all" || item.status === status),
    [contracts, status],
  );
  const canEdit = user && ["admin_hr", "super_admin"].includes(user.role);
  const expiring = contracts.filter((item) => {
    const days = (new Date(item.endDate).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  }).length;
  const totalValue = contracts.reduce((sum, item) => sum + (item.rate ?? item.maleLabourRate ?? 0), 0);

  function exportCsv() {
    const csv = [
      ["Contract", "Type", "Vendor", "Project", "Department", "Start", "End", "Rate", "Status"],
      ...filtered.map((item) => [item.contractCode, item.contractType, item.vendorName, item.projectName, item.departmentName ?? "", item.startDate, item.endDate, item.rate ?? item.maleLabourRate ?? 0, item.status]),
    ].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "vendor-contracts.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <PageHeader
        title={
          contractType === "labour"
            ? "Labour Contracts"
            : contractType === "machinery"
              ? "Machinery Contracts"
              : contractType === "fuel"
                ? "Fuel Contracts"
                : contractType === "material"
                  ? "Material Contracts"
                  : "Vendor Contracts"
        }
        description="Contract terms linked to site attendance, machine usage, billing and vendor ledgers."
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Vendors", to: "/vendors" }, { label: "Contracts" }]}
        action={<div className="flex gap-2">
          <Button type="button" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={exportCsv}>CSV</Button>
          {canEdit ? <Link to="/vendors/contracts/new"><Button type="button" leftIcon={<FilePlus2 className="h-4 w-4" />}>New Contract</Button></Link> : null}
        </div>}
      />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <Metric label="Active contracts" value={String(contracts.filter((item) => item.status === "active").length)} />
        <Metric label="Expiring in 30 days" value={String(expiring)} />
        <Metric label="Listed contract value" value={formatCurrency(totalValue)} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/vendors/contracts/labour"><Button type="button" variant="secondary">Labour</Button></Link>
        <Link to="/vendors/contracts/machinery"><Button type="button" variant="secondary">Machinery</Button></Link>
        <Link to="/vendors/contracts/fuel"><Button type="button" variant="secondary">Fuel</Button></Link>
        <Link to="/vendors/contracts/material"><Button type="button" variant="secondary">Material</Button></Link>
        <select className="h-10 rounded-md border border-surface-border bg-surface-card px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="expired">Expired</option><option value="inactive">Inactive</option>
        </select>
      </div>
      <Card>
        <CardHeader><CardTitle>Contract Register and Reports</CardTitle></CardHeader>
        <CardContent>
          {!filtered.length ? <EmptyState title="No vendor contracts" description="Contracts matching this scope will appear here." /> : (
            <div className="overflow-x-auto"><table className="min-w-full divide-y divide-surface-border text-sm"><thead className="bg-slate-50"><tr>{["Contract", "Type", "Vendor", "Project", "Department", "Period", "Commercial Rate", "Status"].map((item) => <th key={item} className="px-3 py-3 text-left text-xs font-semibold text-text-secondary">{item}</th>)}</tr></thead><tbody className="divide-y divide-surface-border bg-surface-card">{filtered.map((contract) => <tr key={contract.id}><td className="px-3 py-3"><Link to={`/vendors/contracts/${contract.id}`} className="font-bold">{contract.contractCode}</Link></td><td className="px-3 py-3">{contract.contractType}</td><td className="px-3 py-3">{contract.vendorName}</td><td className="px-3 py-3">{contract.projectName}</td><td className="px-3 py-3">{contract.departmentName ?? "-"}</td><td className="px-3 py-3">{contract.startDate} to {contract.endDate}</td><td className="px-3 py-3">{formatCurrency(contract.rate ?? contract.maleLabourRate ?? 0)}</td><td className="px-3 py-3"><Badge tone={contract.status === "active" ? "success" : "neutral"}>{contract.status}</Badge></td></tr>)}</tbody></table></div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><CardContent><p className="text-xs font-semibold text-text-secondary">{label}</p><p className="mt-2 text-2xl font-bold text-text-primary">{value}</p></CardContent></Card>;
}
