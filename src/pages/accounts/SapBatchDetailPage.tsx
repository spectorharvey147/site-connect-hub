import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { downloadSapBatchArchive } from "@/services/sapBatchArchiveService";
import { downloadSapCsv, sapExportService } from "@/services/sapExportService";
import type { SapExportBatch } from "@/types/sap";
import { formatCurrency } from "@/utils/format";

export function SapBatchDetailPage(){
 const{user}=useAuth();const{batchId=""}=useParams();const[batch,setBatch]=useState<SapExportBatch|null>(null);const[zipping,setZipping]=useState(false);
 useEffect(()=>void sapExportService.getBatch(batchId).then(setBatch),[batchId]);if(!batch||!user)return null;
 async function downloadZip(){setZipping(true);try{await downloadSapBatchArchive(batch!,user!);toast.success("User-wise voucher ZIP created.")}catch(error){toast.error(error instanceof Error?error.message:"Unable to create ZIP")}finally{setZipping(false)}}
 return <><PageHeader title={batch.batchNumber} description={`${batch.exportType} SAP export batch`} breadcrumbs={[{label:"SAP Batches",to:"/accounts/sap-entry/batches"},{label:batch.batchNumber}]} action={<div className="flex gap-2"><Button variant="outline" onClick={()=>downloadSapCsv(batch)}>Download Excel CSV</Button><Button disabled={zipping} onClick={()=>void downloadZip()}>{zipping?"Creating ZIP...":"Download Vouchers ZIP"}</Button></div>}/><Card><CardContent><div className="overflow-x-auto"><table className="min-w-[1100px] w-full text-sm"><thead><tr>{["Document Date","Posting Date","Employee/Vendor","GL Code","Cost Center","Profit Center","Project","Customer","Category","Narration","Debit","Credit"].map(heading=><th className="p-3 text-left" key={heading}>{heading}</th>)}</tr></thead><tbody>{batch.items?.map(item=><tr className="border-t" key={item.id}><td>{item.documentDate}</td><td>{item.postingDate}</td><td>{item.employeeVendorCode}</td><td>{item.glCode}</td><td>{item.costCenter}</td><td>{item.profitCenter??"-"}</td><td>{item.projectId??"-"}</td><td>{item.customerId??"-"}</td><td>{item.expenseCategoryId??"Other Expenses"}</td><td>{item.narration}</td><td>{item.debitCredit==="debit"?formatCurrency(item.amount):"-"}</td><td>{item.debitCredit==="credit"?formatCurrency(item.amount):"-"}</td></tr>)}</tbody></table></div></CardContent></Card></>;
}
