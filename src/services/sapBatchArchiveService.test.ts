import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DetailedClaimVoucher } from "@/types/claims";

const {get}=vi.hoisted(()=>({get:vi.fn()}));
vi.mock("@/services/claimVoucherService",()=>({claimVoucherService:{get}}));
vi.mock("@/services/pdfService",()=>({createUserVoucherPacketPdf:vi.fn().mockResolvedValue(new Uint8Array([37,80,68,70]))}));
import { buildSapBatchArchive } from "@/services/sapBatchArchiveService";

const actor={id:"accounts",employeeId:"A",fullName:"Accounts",email:"a@example.com",role:"accounts_officer" as const,status:"active" as const,projectIds:[]};
function voucher(id:string,employeeId:string,name:string):DetailedClaimVoucher{return{id,claimId:`c-${id}`,claimIds:[`c-${id}`],voucherNumber:`PV-${id}`,voucherType:"single_claim",voucherDate:"2026-07-02",employeeId,paidToName:name,paidToEmail:"",approvedAmount:100,grossClaimedAmount:100,grossVerifiedAmount:100,deductionAmount:0,netPayableAmount:100,preparedBy:"a",preparedByName:"A",status:"generated",createdAt:"2026-07-02",items:[],attachments:[]}}
describe("SAP batch voucher ZIP",()=>{beforeEach(()=>get.mockReset());it("creates one user-wise PDF per employee plus CSV and manifest",async()=>{get.mockImplementation((id:string)=>Promise.resolve(id==="v1"?voucher("v1","e1","User One"):id==="v2"?voucher("v2","e1","User One"):voucher("v3","e2","User Two")));const row=(id:string,voucherId:string,employeeId:string)=>({id,batchId:"b",voucherId,claimId:`c-${id}`,employeeId,glCode:"1",costCenter:"C",employeeVendorCode:employeeId,postingDate:"2026-07-02",documentDate:"2026-07-02",amount:100,debitCredit:"debit" as const,narration:"Claim"});const bytes=await buildSapBatchArchive({id:"b",batchNumber:"SAP-1",exportDate:"2026-07-02",exportedBy:"a",exportType:"final",totalClaims:3,totalVouchers:3,totalAmount:300,status:"generated",items:[row("1","v1","e1"),row("2","v2","e1"),row("3","v3","e2")]},actor);const zip=await JSZip.loadAsync(bytes);expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(["SAP-1.csv","manifest.txt","User One/User One-claim-vouchers.pdf","User Two/User Two-claim-vouchers.pdf"]));});});
