import { FileArchive, FileDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card,CardContent } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { claimVoucherService } from "@/services/claimVoucherService";
import { createVoucherPdf,createVoucherWithAttachmentsPdf,downloadPdf } from "@/services/pdfService";
import type { DetailedClaimVoucher } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

export function ClaimVouchersPage(){const{user}=useAuth();const[rows,setRows]=useState<DetailedClaimVoucher[]>([]);const load=useCallback(async()=>{if(!user)return;try{setRows(await claimVoucherService.list(user));}catch(error){toast.error(error instanceof Error?error.message:"Unable to load vouchers.");}},[user]);useEffect(()=>void load(),[load]);if(!user)return null;const actor=user;
async function download(v:DetailedClaimVoucher,withFiles:boolean){const bytes=withFiles?await createVoucherWithAttachmentsPdf(v):await createVoucherPdf(v);if(["accounts_officer","super_admin"].includes(actor.role))await claimVoucherService.persistPdf(v,actor,bytes,withFiles);downloadPdf(bytes,`${v.voucherNumber}${withFiles?"-with-attachments":""}.pdf`);}
return <><PageHeader title="Claim Vouchers" description="View detailed settlement vouchers available for your claims." breadcrumbs={[{label:"Home",to:"/home"},{label:"Claims",to:"/claims"},{label:"Vouchers"}]} /><Card><CardContent className="space-y-3">{!rows.length?<EmptyState title="No vouchers available" description="Your generated claim vouchers will appear here." />:rows.map((v)=><div key={v.id} className="flex flex-col justify-between gap-3 rounded-md border border-surface-border p-4 md:flex-row md:items-center"><div><p className="font-bold">{v.voucherNumber} · {v.paidToName}</p><p className="text-sm text-text-secondary">{v.voucherDate} · Net {formatCurrency(v.netPayableAmount)}</p></div><div className="flex gap-2"><Button variant="secondary" leftIcon={<FileDown className="h-4 w-4" />} onClick={()=>void download(v,false)}>Voucher PDF</Button><Button variant="outline" leftIcon={<FileArchive className="h-4 w-4" />} onClick={()=>void download(v,true)}>With Attachments</Button></div></div>)}</CardContent></Card></>}
