import JSZip from "jszip";
import { claimVoucherService } from "@/services/claimVoucherService";
import { createUserVoucherPacketPdf } from "@/services/pdfService";
import { sapRowsToCsv } from "@/services/sapExportService";
import type { AppUser } from "@/types/auth";
import type { SapExportBatch } from "@/types/sap";

const safeName=(value:string)=>value.split("").map(character=>character.charCodeAt(0)<32?"_":character).join("").replace(/[<>:"/\\|?*]/g,"_").trim()||"employee";
export async function buildSapBatchArchive(batch:SapExportBatch,actor:AppUser){
 const ids=[...new Set((batch.items??[]).map(row=>row.voucherId))];
 const vouchers=(await Promise.all(ids.map(id=>claimVoucherService.get(id,actor)))).filter(voucher=>voucher!==null);
 if(!vouchers.length)throw new Error("No vouchers were found for this SAP batch.");
 const groups=new Map<string,typeof vouchers>();
 vouchers.forEach(voucher=>{const rows=groups.get(voucher.employeeId)??[];rows.push(voucher);groups.set(voucher.employeeId,rows)});
 const zip=new JSZip();zip.file(`${safeName(batch.batchNumber)}.csv`,sapRowsToCsv(batch.items??[]));
 const manifest=[`SAP batch: ${batch.batchNumber}`,`Generated: ${batch.exportDate}`,""];
 for(const rows of groups.values()){const employee=safeName(rows[0].paidToName);zip.folder(employee)?.file(`${employee}-claim-vouchers.pdf`,await createUserVoucherPacketPdf(rows));manifest.push(`${employee}: ${rows.length} voucher(s), ${rows.reduce((sum,row)=>sum+row.claimIds.length,0)} claim(s)`)}
 zip.file("manifest.txt",manifest.join("\r\n"));return zip.generateAsync({type:"uint8array",compression:"DEFLATE",compressionOptions:{level:6}});
}
export async function downloadSapBatchArchive(batch:SapExportBatch,actor:AppUser){const bytes=await buildSapBatchArchive(batch,actor);const url=URL.createObjectURL(new Blob([bytes.slice().buffer],{type:"application/zip"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=`${safeName(batch.batchNumber)}-vouchers.zip`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
