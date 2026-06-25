import { Pencil, Power } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { vendorContractService } from "@/services/vendorContractService";
import type { VendorContract } from "@/types/vendorContracts";
import { formatCurrency } from "@/utils/format";

export function VendorContractDetailPage() {
  const { user } = useAuth();
  const { contractId } = useParams();
  const [contract, setContract] = useState<VendorContract | null>(null);
  useEffect(() => {
    if (user && contractId) void vendorContractService.get(contractId, user).then(setContract);
  }, [contractId, user]);
  if (!user || !contract) return null;
  const canEdit = ["admin_hr", "super_admin"].includes(user.role);
  return <>
    <PageHeader title={contract.contractCode} description={`${contract.vendorName} · ${contract.projectName}`} breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Vendors", to: "/vendors" }, { label: "Contracts", to: "/vendors/contracts" }, { label: contract.contractCode }]} action={canEdit ? <div className="flex gap-2"><Link to={`/vendors/contracts/${contract.id}/edit`}><Button type="button" variant="secondary" leftIcon={<Pencil className="h-4 w-4" />}>Edit</Button></Link><Button type="button" variant="danger" leftIcon={<Power className="h-4 w-4" />} onClick={() => void vendorContractService.deactivate(contract.id, user).then(setContract).then(() => toast.success("Contract deactivated."))}>Deactivate</Button></div> : null} />
    <Card><CardHeader><div className="flex justify-between"><CardTitle>Contract Terms</CardTitle><Badge tone={contract.status === "active" ? "success" : "neutral"}>{contract.status}</Badge></div></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Object.entries({
        Type: contract.contractType, Vendor: contract.vendorName, Project: contract.projectName,
        Department: contract.departmentName ?? "-", Period: `${contract.startDate} to ${contract.endDate}`,
        "Payment terms": contract.paymentTerms, "Commercial rate": formatCurrency(contract.rate ?? contract.maleLabourRate ?? 0),
        "Billing type": contract.billingType ?? "Daily labour rates", "Fuel scope": contract.fuelScope ?? "-",
        "GST applicable": contract.gstApplicable ? "Yes" : "No", "TDS applicable": contract.tdsApplicable ? "Yes" : "No",
        Remarks: contract.remarks || "-",
      }).map(([label, value]) => <div key={label}><p className="text-xs font-semibold text-text-secondary">{label}</p><p className="mt-1 font-semibold text-text-primary">{value}</p></div>)}
    </CardContent></Card>
  </>;
}
