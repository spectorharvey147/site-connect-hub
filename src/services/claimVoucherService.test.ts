import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

import { validateCombinedVoucherClaims } from "@/services/claimVoucherService";
import { createVoucherPdf, createVoucherWithAttachmentsPdf, VOUCHER_SIGNATURE_LABELS } from "@/services/pdfService";
import type { Claim, DetailedClaimVoucher } from "@/types/claims";

function claim(id:string,userId="employee-1"):Claim{return {id,claimNumber:`CLM-${id}`,title:"Travel",userId,userName:"Employee",userEmail:"employee@example.com",projectId:"project",projectName:"Site",periodFrom:"2026-06-01",periodTo:"2026-06-02",status:"voucher_pending",items:[],attachments:[],approvals:[],totalClaimed:100,totalVerified:100,totalApproved:90,createdAt:"2026-06-01T00:00:00Z",updatedAt:"2026-06-02T00:00:00Z"};}
const voucher:DetailedClaimVoucher={id:"voucher",claimId:"one",claimIds:["one"],voucherNumber:"CSV-1",voucherType:"single_claim",voucherDate:"2026-07-01",employeeId:"employee-1",paidToName:"Employee",paidToEmail:"employee@example.com",approvedAmount:90,grossClaimedAmount:100,grossVerifiedAmount:100,deductionAmount:10,netPayableAmount:90,preparedBy:"accounts",preparedByName:"Accounts User",status:"generated",createdAt:"2026-07-01T00:00:00Z",items:[{id:"item",voucherId:"voucher",claimId:"one",claimNumber:"CLM-1",expenseDate:"2026-06-01",category:"Travel",projectName:"Site",costCode:"TRV",description:"Taxi",withBillAmount:100,withoutBillAmount:0,claimedAmount:100,verifiedAmount:100,managerApprovedAmount:95,finalApprovedAmount:90,approvedAmount:90,deductionAmount:10}],attachments:[]};

describe("claim voucher generation",()=>{
  it("accepts multiple verified claims for the same employee",()=>expect(()=>validateCombinedVoucherClaims([claim("1"),claim("2")])).not.toThrow());
  it("rejects mixed-employee combined vouchers",()=>expect(()=>validateCombinedVoucherClaims([claim("1"),claim("2","employee-2")])).toThrow("same employee"));
  it("creates a voucher PDF with all required signature block definitions",async()=>{expect(VOUCHER_SIGNATURE_LABELS).toHaveLength(8);expect((await createVoucherPdf(voucher)).byteLength).toBeGreaterThan(1000);});
  it("keeps an attachment separator/reference page when the source cannot be embedded",async()=>{vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));const bytes=await createVoucherWithAttachmentsPdf({...voucher,attachments:[{id:"a",fileName:"bill.docx",fileType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",fileSize:20,url:"https://example.invalid/bill.docx",uploadedAt:"2026-06-01T00:00:00Z"}]});const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBeGreaterThan(1);vi.unstubAllGlobals();});
});
