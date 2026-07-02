import { Eye, FileDown, ReceiptText, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { claimAccountsService } from "@/services/claimAccountsService";
import { claimsService } from "@/services/claimsService";
import { claimVoucherService } from "@/services/claimVoucherService";
import { employeeFinanceService } from "@/services/employeeFinanceService";
import { createVoucherPdf, downloadPdf } from "@/services/pdfService";
import type { Claim, DetailedClaimVoucher } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

export function AccountsPaymentQueuePage() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [vouchers, setVouchers] = useState<DetailedClaimVoucher[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewClaims, setPreviewClaims] = useState<Claim[]>([]);
  const load = useCallback(async () => {
    if (!user) return;
    const [queue, verificationRows, voucherRows] = await Promise.all([claimsService.listApprovalQueue(user,"payment"),claimAccountsService.list(user),claimVoucherService.list(user)]);
    const verifiedIds = new Set(verificationRows.filter((row) => row.verification?.verificationStatus === "verified").map((row) => row.claim.id));
    setClaims(queue.filter((claim) => verifiedIds.has(claim.id))); setVouchers(voucherRows);
  },[user]);
  useEffect(()=>void load(),[load]);
  const ready = claims.filter((claim)=>claim.status === "voucher_pending");
  const groups = useMemo(() => Object.values(ready.reduce<Record<string,{employeeId:string;employeeName:string;claims:Claim[]}>>((all,claim)=>{
    (all[claim.userId]??={employeeId:claim.userId,employeeName:claim.userName,claims:[]}).claims.push(claim); return all;
  },{})),[ready]);
  const selectedEmployeeId=ready.find((claim)=>selectedIds.includes(claim.id))?.userId;
  if (!user) return null;
  const actor = user;

  async function generate(selected: Claim[]) {
    try { await claimVoucherService.generate(selected,actor,selected.length>1?"Combined voucher from payment queue":"Accounts payment queue"); toast.success(selected.length>1?"Combined voucher generated.":"Payment voucher generated."); setSelectedIds([]); setPreviewClaims([]); await load(); }
    catch(error){toast.error(error instanceof Error?error.message:"Unable to generate voucher.");}
  }
  async function download(voucher: DetailedClaimVoucher){const bytes=await createVoucherPdf(voucher);await claimVoucherService.persistPdf(voucher,actor,bytes,false);downloadPdf(bytes,`${voucher.voucherNumber}.pdf`);}
  async function pay(voucher:DetailedClaimVoucher,full:boolean){const outstanding=voucher.netPayableAmount-(voucher.paidAmount??0);const amount=full?outstanding:Number(window.prompt("Partial payment amount",String(outstanding)));const reference=window.prompt("Payment reference")?.trim();if(!amount||!reference)return;try{await employeeFinanceService.recordPayment(actor,{voucherId:voucher.id,amount,date:new Date().toISOString().slice(0,10),mode:"bank_transfer",reference});toast.success(full?"Payment completed":"Partial payment recorded");await load()}catch(error){toast.error(error instanceof Error?error.message:"Payment failed")}}

  return <>
    <PageHeader title="Accounts Payment Queue" description="Generate vouchers only after Accounts verification moves claims to Voucher Pending." breadcrumbs={[{label:"Home",to:"/home"},{label:"Accounts",to:"/accounts"},{label:"Payment Queue"}]} />
    <div className="space-y-6">
      <Card><CardHeader><CardTitle>Verified Claims Ready for Voucher</CardTitle></CardHeader><CardContent className="space-y-3">
        {selectedIds.length>1?<div className="flex justify-end gap-2"><Button variant="outline" leftIcon={<Eye className="h-4 w-4"/>} onClick={()=>setPreviewClaims(ready.filter((claim)=>selectedIds.includes(claim.id)))}>Preview Combined Voucher</Button><Button onClick={()=>void generate(ready.filter((claim)=>selectedIds.includes(claim.id)))}>Generate Combined Voucher ({selectedIds.length})</Button></div>:null}
        {!ready.length?<EmptyState title="No verified claims waiting" description="Claims appear here only after Accounts verification is complete." />:groups.map((group)=><section key={group.employeeId} className="rounded-lg border border-surface-border"><div className="flex items-center justify-between bg-surface-muted px-4 py-3"><div><p className="font-bold">{group.employeeName}</p><p className="text-xs text-text-secondary">{group.claims.length} claim(s) ready</p></div><Badge tone="info">{formatCurrency(group.claims.reduce((sum,claim)=>sum+(claim.totalApproved||claim.totalClaimed),0))}</Badge></div><div className="divide-y divide-surface-border">{group.claims.map((claim)=><div key={claim.id} className="flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3"><input type="checkbox" disabled={Boolean(selectedEmployeeId&&selectedEmployeeId!==claim.userId)} checked={selectedIds.includes(claim.id)} onChange={(event)=>setSelectedIds((current)=>event.target.checked?[...current,claim.id]:current.filter((id)=>id!==claim.id))} aria-label={`Select ${claim.claimNumber}`} /><div><Link to={`/claims/${claim.id}`} className="font-bold">{claim.claimNumber}</Link><p className="mt-1 text-sm text-text-secondary">{claim.projectName} · {formatCurrency(claim.totalApproved||claim.totalClaimed)}</p></div></div>
          <div className="flex gap-2"><Button variant="outline" leftIcon={<Eye className="h-4 w-4"/>} onClick={()=>setPreviewClaims([claim])}>Preview</Button><Button leftIcon={<ReceiptText className="h-4 w-4" />} onClick={()=>void generate([claim])}>Generate Single Voucher</Button></div>
        </div>)}</div></section>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Open Voucher Register</CardTitle></CardHeader><CardContent className="space-y-4">
        {!vouchers.length?<EmptyState title="No vouchers generated" description="Generated claim vouchers appear here." />:vouchers.filter((voucher)=>!["paid","void"].includes(voucher.status)).map((voucher)=><div key={voucher.id} className="flex flex-col justify-between gap-3 rounded-md border border-surface-border p-4 md:flex-row md:items-center"><div><p className="font-bold">{voucher.voucherNumber} · {voucher.paidToName}</p><p className="text-sm text-text-secondary">{voucher.voucherType.replace("_"," ")} · Net {formatCurrency(voucher.netPayableAmount)} · Paid {formatCurrency(voucher.paidAmount??0)}</p></div><div className="flex flex-wrap items-center gap-2"><Badge tone={voucher.status==="partial_paid"?"warning":"info"}>{voucher.status.replace("_"," ")}</Badge><Button variant="secondary" leftIcon={<FileDown className="h-4 w-4" />} onClick={()=>void download(voucher)}>Download Voucher</Button><Button variant="outline" onClick={()=>void pay(voucher,false)}>Partial Payment</Button><Button onClick={()=>void pay(voucher,true)}>Pay Balance</Button></div></div>)}
      </CardContent></Card>
    </div>
    {previewClaims.length?<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Voucher preview"><Card className="max-h-[90vh] w-full max-w-5xl overflow-y-auto"><CardContent className="space-y-5 p-6"><div className="flex justify-between"><div><h2 className="text-xl font-bold">Voucher Preview</h2><p className="text-sm text-text-secondary">{previewClaims[0].userName} · {previewClaims.length} claim(s)</p></div><Button size="sm" variant="ghost" onClick={()=>setPreviewClaims([])}><X className="h-5 w-5"/></Button></div><div className="overflow-x-auto"><table className="min-w-[900px] w-full text-sm"><thead><tr>{["Claim","Project","Claimed","Admin Verified","Manager Approved","Final Approved","Deduction","Net Payable"].map(h=><th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{previewClaims.map(claim=><tr className="border-t" key={claim.id}><td className="p-2">{claim.claimNumber}</td><td>{claim.projectName}</td><td>{formatCurrency(claim.totalClaimed)}</td><td>{formatCurrency(claim.totalVerified)}</td><td>{formatCurrency(claim.approvals.find(a=>a.stage==="manager_approval")?.amountAfter??claim.totalApproved)}</td><td>{formatCurrency(claim.totalApproved)}</td><td>{formatCurrency(Math.max(claim.totalClaimed-claim.totalApproved,0))}</td><td className="font-bold">{formatCurrency(claim.totalApproved)}</td></tr>)}</tbody></table></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setPreviewClaims([])}>Close</Button><Button onClick={()=>void generate(previewClaims)}>Generate {previewClaims.length>1?"Combined":"Single"} Voucher</Button></div></CardContent></Card></div>:null}
  </>;
}
