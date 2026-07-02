import { FileArchive, FileDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { claimVoucherService } from "@/services/claimVoucherService";
import { createVoucherPdf, createVoucherWithAttachmentsPdf, downloadPdf } from "@/services/pdfService";
import type { DetailedClaimVoucher } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

export function AccountsVouchersPage() {
  const { user } = useAuth(); const [vouchers,setVouchers]=useState<DetailedClaimVoucher[]>([]);
  const load=useCallback(async()=>{if(!user)return;try{setVouchers(await claimVoucherService.list(user));}catch(error){toast.error(error instanceof Error?error.message:"Unable to load vouchers.");}},[user]);
  useEffect(()=>void load(),[load]); if(!user)return null; const actor=user;
  async function download(voucher:DetailedClaimVoucher,attachments:boolean){try{const bytes=attachments?await createVoucherWithAttachmentsPdf(voucher):await createVoucherPdf(voucher);await claimVoucherService.persistPdf(voucher,actor,bytes,attachments);downloadPdf(bytes,`${voucher.voucherNumber}${attachments?"-with-attachments":""}.pdf`);}catch(error){toast.error(error instanceof Error?error.message:"Unable to create PDF.");}}
  return <><PageHeader title="Accounts Vouchers" description="Detailed single and combined Claim Settlement Vouchers with bill attachments." breadcrumbs={[{label:"Home",to:"/home"},{label:"Accounts",to:"/accounts"},{label:"Vouchers"}]} />
    <Card><CardContent className="space-y-4">{!vouchers.length?<EmptyState title="No vouchers" description="Generate a voucher from the payment queue." />:vouchers.map((voucher)=><div key={voucher.id} className="rounded-md border border-surface-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{voucher.voucherNumber} · {voucher.paidToName}</p><p className="mt-1 text-sm text-text-secondary">{voucher.voucherType.replace("_"," ")} · {voucher.claimIds.length} claim(s) · {formatCurrency(voucher.netPayableAmount)}</p></div><Badge tone={voucher.status==="paid"?"success":voucher.status==="partial_paid"?"warning":"info"}>{voucher.status.replace("_"," ")}</Badge></div>
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" leftIcon={<FileDown className="h-4 w-4" />} onClick={()=>void download(voucher,false)}>Download Voucher PDF</Button><Button variant="outline" leftIcon={<FileArchive className="h-4 w-4" />} onClick={()=>void download(voucher,true)}>Voucher + Attachments</Button></div>
    </div>)}</CardContent></Card></>;
}
