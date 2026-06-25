import { FileDown, ReceiptText, WalletCards } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { claimsService } from "@/services/claimsService";
import type { Claim, PaymentVoucher } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

export function AccountsPaymentQueuePage() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);
  const [references, setReferences] = useState<Record<string, string>>({});
  const [partialAmounts, setPartialAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!user) return;
    const [queue, voucherRows] = await Promise.all([
      claimsService.listApprovalQueue(user, "payment"),
      claimsService.listVouchers(user),
    ]);
    setClaims(queue);
    setVouchers(voucherRows);
  }, [user]);

  useEffect(() => void load(), [load]);
  if (!user) return null;

  async function generateVoucher(claimId: string) {
    if (!user) return;
    const actor = user;
    try {
      await claimsService.generateVoucher(claimId, actor, "Accounts payment queue");
      toast.success("Payment voucher generated.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate voucher.");
    }
  }

  async function markPaid(voucher: PaymentVoucher, partial: boolean) {
    if (!user) return;
    const actor = user;
    const reference = references[voucher.id]?.trim();
    if (!reference) {
      toast.error("Add a payment reference.");
      return;
    }
    try {
      if (partial) {
        await claimsService.markVoucherPartialPaid(
          voucher.id,
          actor,
          Number(partialAmounts[voucher.id]),
          reference,
        );
      } else {
        await claimsService.markVoucherPaid(voucher.id, actor, reference);
      }
      toast.success(partial ? "Partial payment recorded." : "Payment completed.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to process payment.");
    }
  }

  return (
    <>
      <PageHeader
        title="Accounts Payment Queue"
        description="Finally approved claims ready for voucher and payment processing."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Accounts", to: "/accounts" },
          { label: "Payment Queue" },
        ]}
      />
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Ready for Voucher</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {claims.filter((claim) => claim.status === "approved_for_payment").length === 0 ? (
              <EmptyState title="No approved claims waiting" description="Claims appear here only after their configured final approval is complete." />
            ) : claims
              .filter((claim) => claim.status === "approved_for_payment")
              .map((claim) => (
                <div key={claim.id} className="flex flex-col justify-between gap-3 rounded-md border border-surface-border p-4 md:flex-row md:items-center">
                  <div>
                    <Link to={`/claims/${claim.id}`} className="font-bold">{claim.claimNumber}</Link>
                    <p className="mt-1 text-sm text-text-secondary">{claim.userName} · {claim.projectName} · {formatCurrency(claim.totalApproved || claim.totalClaimed)}</p>
                  </div>
                  <Button type="button" leftIcon={<ReceiptText className="h-4 w-4" />} onClick={() => void generateVoucher(claim.id)}>Generate Voucher</Button>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Voucher and Payment Register</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {vouchers.length === 0 ? (
              <EmptyState title="No vouchers generated" description="Generated claim vouchers will appear here for payment." />
            ) : vouchers.map((voucher) => (
              <div key={voucher.id} className="rounded-md border border-surface-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-text-primary">{voucher.voucherNumber} · {voucher.paidToName}</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Net {formatCurrency(voucher.netPayableAmount)}
                      {voucher.paidAmount ? ` · Paid ${formatCurrency(voucher.paidAmount)}` : ""}
                    </p>
                  </div>
                  <Badge tone={voucher.status === "paid" ? "success" : voucher.status === "partial_paid" ? "warning" : "info"}>
                    {voucher.status.split("_").join(" ")}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-[auto_1fr_180px_auto_auto] lg:items-end">
                  <Button type="button" variant="secondary" leftIcon={<FileDown className="h-4 w-4" />} onClick={() => void downloadVoucher(voucher)}>Download Voucher</Button>
                  <Input label="Payment reference" value={references[voucher.id] ?? voucher.paymentReference ?? ""} onChange={(event) => setReferences((current) => ({ ...current, [voucher.id]: event.target.value }))} />
                  <Input label="Partial amount" type="number" min={0} value={partialAmounts[voucher.id] ?? ""} onChange={(event) => setPartialAmounts((current) => ({ ...current, [voucher.id]: event.target.value }))} />
                  {voucher.status !== "paid" ? (
                    <>
                      <Button type="button" variant="outline" onClick={() => void markPaid(voucher, true)}>Mark Partial Paid</Button>
                      <Button type="button" leftIcon={<WalletCards className="h-4 w-4" />} onClick={() => void markPaid(voucher, false)}>Mark Paid</Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

async function downloadVoucher(voucher: PaymentVoucher) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Site Connect Payment Voucher", 20, 20);
  doc.setFontSize(11);
  doc.text(`Voucher: ${voucher.voucherNumber}`, 20, 38);
  doc.text(`Paid to: ${voucher.paidToName}`, 20, 48);
  doc.text(`Net payable: ${formatCurrency(voucher.netPayableAmount)}`, 20, 58);
  doc.text(`Status: ${voucher.status}`, 20, 68);
  if (voucher.paymentReference) doc.text(`Reference: ${voucher.paymentReference}`, 20, 78);
  doc.save(`${voucher.voucherNumber}.pdf`);
}
