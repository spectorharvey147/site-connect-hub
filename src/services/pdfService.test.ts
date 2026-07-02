import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { createUserVoucherPacketPdf, createVoucherPdf } from "@/services/pdfService";
import type { DetailedClaimVoucher } from "@/types/claims";

function voucher(itemCount: number): DetailedClaimVoucher {
  return {
    id: "voucher-1", claimId: "claim-1", claimIds: ["claim-1"], voucherNumber: "PV-2026-0001",
    voucherType: "single_claim", voucherDate: "2026-07-02", employeeId: "employee-1",
    employeeCode: "EMP-001", paidToName: "Test Employee", paidToEmail: "employee@example.com",
    projectName: "Site Alpha", customerName: "Customer Alpha", approvedAmount: itemCount * 90,
    grossClaimedAmount: itemCount * 100, grossVerifiedAmount: itemCount * 95,
    deductionAmount: itemCount * 10, netPayableAmount: itemCount * 90,
    preparedBy: "admin-1", preparedByName: "Admin User", managerName: "Manager User",
    hodName: "HOD User", accountsVerifierName: "Accounts User", status: "generated",
    createdAt: "2026-07-02T00:00:00Z", attachments: [],
    items: Array.from({ length: itemCount }, (_, index) => ({
      id: `item-${index}`, voucherId: "voucher-1", claimId: "claim-1", claimNumber: "CLM-2026-001",
      expenseDate: "2026-06-20", category: "Travel", projectName: "Site Alpha", costCode: "TRAVEL",
      description: `Expense line ${index + 1} with a sufficiently descriptive narration`,
      withBillAmount: 100, withoutBillAmount: 0, claimedAmount: 100, verifiedAmount: 95,
      managerApprovedAmount: 92, finalApprovedAmount: 90, approvedAmount: 90, deductionAmount: 0,
    })),
  };
}

describe("payment voucher PDF", () => {
  it("creates a readable multipage A4 voucher without table overflow", async () => {
    const bytes = await createVoucherPdf(voucher(30), { name: "IPI Construction", address: "Chennai, India" });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    pdf.getPages().forEach((page) => {
      expect(page.getWidth()).toBeCloseTo(595.28, 0);
      expect(page.getHeight()).toBeCloseTo(841.89, 0);
    });
    expect(bytes.byteLength).toBeGreaterThan(5000);
  });

  it("keeps an attachment reference when an image format cannot be embedded", async () => {
    const row=voucher(1);
    row.attachments=[{id:"a",fileName:"unsupported.webp",fileType:"image/webp",fileSize:4,url:"data:image/webp;base64,AAAA",uploadedAt:"2026-07-02T00:00:00Z"}];
    const bytes=await createUserVoucherPacketPdf([row],{name:"IPI Construction"});
    const pdf=await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
  });

});
