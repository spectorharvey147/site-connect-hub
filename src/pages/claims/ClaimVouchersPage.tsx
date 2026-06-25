import { FileDown, ReceiptText, WalletCards } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { claimsService } from "@/services/claimsService";
import { useAuth } from "@/hooks/useAuth";
import type { Claim, PaymentVoucher } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

export function ClaimVouchersPage() {
  const { user } = useAuth();
  const [paymentQueue, setPaymentQueue] = useState<Claim[]>([]);
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!user) {
      return;
    }
    const currentUser = user;

    const [queue, nextVouchers] = await Promise.all([
      claimsService.listApprovalQueue(currentUser, "payment"),
      claimsService.listVouchers(currentUser),
    ]);
    setPaymentQueue(queue);
    setVouchers(nextVouchers);
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!user) {
    return null;
  }

  async function generateVoucher(claimId: string) {
    if (!user) {
      return;
    }

    try {
      await claimsService.generateVoucher(claimId, user, "Generated from payment queue.");
      toast.success("Voucher generated.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate voucher.");
    }
  }

  async function markPaid(voucherId: string) {
    if (!user) {
      return;
    }

    try {
      await claimsService.markVoucherPaid(
        voucherId,
        user,
        paymentReferences[voucherId] || "PAYMENT-REF",
      );
      toast.success("Payment marked paid.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to mark paid.");
    }
  }

  return (
    <>
      <PageHeader
        title="Payment Vouchers"
        description="Generate employee payment vouchers and mark approved claims paid."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Claims", to: "/claims" },
          { label: "Vouchers" },
        ]}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Approved for Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentQueue.filter((claim) => claim.status === "approved_for_payment").length === 0 ? (
              <EmptyState
                title="No claims waiting for vouchers"
                description="Fully approved claims will appear here."
              />
            ) : (
              paymentQueue
                .filter((claim) => claim.status === "approved_for_payment")
                .map((claim) => (
                  <div
                    key={claim.id}
                    className="flex flex-col justify-between gap-3 rounded-lg border border-surface-border p-4 md:flex-row md:items-center"
                  >
                    <div>
                      <p className="font-bold text-text-primary">
                        {claim.claimNumber} · {claim.userName}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {claim.projectName} · {formatCurrency(claim.totalApproved)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      leftIcon={<ReceiptText className="h-4 w-4" />}
                      onClick={() => void generateVoucher(claim.id)}
                    >
                      Generate Voucher
                    </Button>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voucher Register</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {vouchers.length === 0 ? (
              <EmptyState
                title="No vouchers yet"
                description="Generated payment vouchers will appear here."
              />
            ) : (
              vouchers.map((voucher) => (
                <div
                  key={voucher.id}
                  className="rounded-lg border border-surface-border p-4"
                >
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                    <div>
                      <p className="font-bold text-text-primary">
                        {voucher.voucherNumber} · {voucher.paidToName}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Net payable {formatCurrency(voucher.netPayableAmount)} ·{" "}
                        {voucher.voucherDate}
                      </p>
                    </div>
                    <span className="rounded-full border border-surface-border px-2.5 py-1 text-xs font-semibold text-text-secondary">
                      {voucher.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
                    <Button
                      type="button"
                      variant="secondary"
                      leftIcon={<FileDown className="h-4 w-4" />}
                      onClick={() => downloadVoucherPdf(voucher)}
                    >
                      PDF
                    </Button>
                    {voucher.status === "generated" ? (
                      <>
                        <Input
                          label="Payment reference"
                          value={paymentReferences[voucher.id] ?? ""}
                          onChange={(event) =>
                            setPaymentReferences((current) => ({
                              ...current,
                              [voucher.id]: event.target.value,
                            }))
                          }
                        />
                        <Button
                          type="button"
                          leftIcon={<WalletCards className="h-4 w-4" />}
                          onClick={() => void markPaid(voucher.id)}
                        >
                          Mark Paid
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

async function downloadVoucherPdf(voucher: PaymentVoucher) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Site Connect Payment Voucher", 20, 20);
  doc.setFontSize(11);
  doc.text(`Voucher: ${voucher.voucherNumber}`, 20, 36);
  doc.text(`Date: ${voucher.voucherDate}`, 20, 44);
  doc.text(`Paid to: ${voucher.paidToName}`, 20, 52);
  doc.text(`Email: ${voucher.paidToEmail}`, 20, 60);
  doc.text(`Approved amount: ${formatCurrency(voucher.approvedAmount)}`, 20, 76);
  doc.text(`Deductions: ${formatCurrency(voucher.deductionAmount)}`, 20, 84);
  doc.text(`Net payable: ${formatCurrency(voucher.netPayableAmount)}`, 20, 92);
  doc.text(`Prepared by: ${voucher.preparedByName}`, 20, 108);
  if (voucher.accountsNote) {
    doc.text(`Note: ${voucher.accountsNote}`, 20, 116);
  }
  doc.save(`${voucher.voucherNumber}.pdf`);
}
