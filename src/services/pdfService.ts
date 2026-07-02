import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { jsPDF } from "jspdf";

import { organizationService } from "@/services/organizationService";
import type { DetailedClaimVoucher } from "@/types/claims";

export interface VoucherCompanyDetails {
  name: string;
  subtitle?: string;
  address?: string;
  contact?: string;
  logoDataUrl?: string;
  logoPosition?: "left" | "right" | "hidden";
  logoSize?: number;
}

export const VOUCHER_SIGNATURE_LABELS = [
  "Prepared By", "Admin Verified By", "Manager Approved By", "HOD Approved By",
  "Final Approved By", "Accounts Verified By", "Paid By / Cashier", "Employee Acknowledgement",
] as const;

const money = (value: number) => `Rs. ${Number(value || 0).toFixed(2)}`;
const shortDate = (value?: string) => value
  ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  : "-";

function amountInWords(value: number) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const small = (n: number) => n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`;
  const part = (n: number): string => n < 100 ? small(n) : `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${small(n % 100)}` : ""}`;
  let n = Math.floor(Math.abs(value));
  if (!n) return "Zero Rupees Only";
  const words: string[] = [];
  if (n >= 10000000) { words.push(`${part(Math.floor(n / 10000000))} Crore`); n %= 10000000; }
  if (n >= 100000) { words.push(`${part(Math.floor(n / 100000))} Lakh`); n %= 100000; }
  if (n >= 1000) { words.push(`${part(Math.floor(n / 1000))} Thousand`); n %= 1000; }
  if (n) words.push(part(n));
  return `${words.join(" ")} Rupees Only`;
}

async function imageDataUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

async function resolveCompany(company?: VoucherCompanyDetails): Promise<VoucherCompanyDetails> {
  if (company) return company;
  try {
    const organization = await organizationService.getCurrentOrganization();
    return {
      name: organization.legalName || organization.organizationName,
      subtitle: organization.organizationName !== organization.legalName ? organization.organizationName : undefined,
      address: [organization.address, organization.city, organization.state, organization.pincode].filter(Boolean).join(", "),
      contact: [organization.supportEmail, organization.supportPhone].filter(Boolean).join(" | "),
      logoDataUrl: await imageDataUrl(organization.logoUrl),
      logoPosition: organization.voucherLogoPosition ?? "left",
      logoSize: organization.voucherLogoSize ?? 18,
    };
  } catch {
    return { name: "IPI Site Connect", address: "India" };
  }
}

type Pdf = jsPDF;

function projectRows(voucher: DetailedClaimVoucher) {
  const rows = new Map<string, { withBill: number; withoutBill: number; submitted: number; payable: number }>();
  voucher.items.forEach((item) => {
    const key = item.costCode || item.projectName || "Uncoded";
    const row = rows.get(key) ?? { withBill: 0, withoutBill: 0, submitted: 0, payable: 0 };
    row.withBill += item.withBillAmount;
    row.withoutBill += item.withoutBillAmount;
    row.submitted += item.claimedAmount;
    row.payable += Math.max(item.approvedAmount - item.deductionAmount, 0);
    rows.set(key, row);
  });
  return [...rows.entries()].map(([code, row]) => [code, money(row.withBill), money(row.withoutBill), money(row.submitted), money(row.payable)]);
}

function drawTable(
  doc: Pdf,
  startY: number,
  headers: string[],
  rows: string[][],
  widths: number[],
  options: { numericFrom?: number; repeatHeader?: boolean } = {},
) {
  const left = 10;
  let y = startY;
  const header = () => {
    doc.setFillColor("0.96");
    doc.setDrawColor(205, 205, 205);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    let x = left;
    headers.forEach((text, index) => {
      doc.setFillColor("0.96");
      doc.rect(x, y, widths[index], 10, "FD");
      doc.setTextColor("0.08");
      const lines = doc.splitTextToSize(text, widths[index] - 3);
      const numeric = index >= (options.numericFrom ?? 99);
      doc.text(lines, numeric ? x + widths[index] - 1.5 : x + 1.5, y + 4, { align: numeric ? "right" : "left" });
      x += widths[index];
    });
    y += 10;
  };
  header();
  rows.forEach((row) => {
    const lineCounts = row.map((text, index) => doc.splitTextToSize(text || "-", widths[index] - 3).length);
    const height = Math.max(8, Math.max(...lineCounts) * 3.4 + 3);
    if (y + height > 282) {
      doc.addPage();
      doc.setFillColor("1.0"); doc.rect(0, 0, 210, 297, "F");
      y = 12;
      if (options.repeatHeader !== false) header();
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setDrawColor(215, 215, 215);
    let x = left;
    row.forEach((text, index) => {
      doc.rect(x, y, widths[index], height);
      const align = index >= (options.numericFrom ?? 99) ? "right" : "left";
      doc.text(doc.splitTextToSize(text || "-", widths[index] - 3), align === "right" ? x + widths[index] - 1.5 : x + 1.5, y + 4.5, { align });
      x += widths[index];
    });
    y += height;
  });
  return y;
}

export async function createVoucherPdf(voucher: DetailedClaimVoucher, companyInput?: VoucherCompanyDetails) {
  const { jsPDF } = await import("jspdf");
  const company = await resolveCompany(companyInput);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const width = doc.internal.pageSize.getWidth();
  let y = 12;
  doc.setFillColor("1.0"); doc.rect(0, 0, 210, 297, "F");

  if (company.logoDataUrl && company.logoPosition !== "hidden") {
    const logoSize = Math.min(28, Math.max(12, company.logoSize ?? 18));
    const logoX = company.logoPosition === "right" ? width - 12 - logoSize : 12;
    try { doc.addImage(company.logoDataUrl, "PNG", logoX, 10, logoSize, logoSize, undefined, "FAST"); } catch { /* optional */ }
  }
  doc.setTextColor(37, 99, 235);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(company.name || "Company", width / 2, y + 4, { align: "center" });
  doc.setTextColor(70, 70, 70);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (company.subtitle) doc.text(company.subtitle, width / 2, y + 9, { align: "center" });
  const address = [company.address, company.contact].filter(Boolean).join(" | ");
  if (address) doc.text(address, width / 2, y + 13, { align: "center", maxWidth: 150 });
  y += 22;
  doc.setDrawColor(190, 190, 190);
  doc.line(10, y, width - 10, y);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PAYMENT VOUCHER", width / 2, y + 7, { align: "center" });
  doc.line(10, y + 10, width - 10, y + 10);
  y += 16;

  const claims = [...new Set(voucher.items.map((item) => item.claimNumber))];
  const dates = voucher.items.map((item) => item.expenseDate).filter(Boolean).sort();
  const meta = [
    ["Voucher No.", voucher.voucherNumber, "Generated On", shortDate(voucher.voucherDate)],
    ["Paid To", `${voucher.paidToName}${voucher.paidToEmail ? ` (${voucher.paidToEmail})` : ""}`, "Employee Code", voucher.employeeCode || "-"],
    ["Customer", voucher.customerName || "-", "Project / Site", voucher.projectName || "Multiple Projects"],
    ["Claim Count", String(claims.length), "Period", dates.length ? `${shortDate(dates[0])} to ${shortDate(dates.at(-1))}` : "-"],
    ["Claim IDs", claims.join(", "), "Voucher Type", voucher.voucherType === "combined_claim" ? "Combined Claim" : "Single Claim"],
  ];
  doc.setFontSize(8);
  meta.forEach(([l1, v1, l2, v2]) => {
    doc.setFont("helvetica", "bold"); doc.text(`${l1}:`, 12, y);
    doc.setFont("helvetica", "normal"); doc.text(String(v1), 38, y, { maxWidth: 66 });
    doc.setFont("helvetica", "bold"); doc.text(`${l2}:`, 108, y);
    doc.setFont("helvetica", "normal"); doc.text(String(v2), 137, y, { maxWidth: 60 });
    y += 6;
  });

  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("USER WISE SUMMARY", 10, y + 2); y += 5;
  y = drawTable(doc, y, ["Employee", "Claims", "Submitted", "Verified", "Deduction", "Payable"], [[
    `${voucher.paidToName}${voucher.paidToEmail ? `\n${voucher.paidToEmail}` : ""}`,
    String(claims.length), money(voucher.grossClaimedAmount), money(voucher.grossVerifiedAmount),
    money(voucher.deductionAmount), money(voucher.netPayableAmount),
  ]], [55, 15, 30, 30, 30, 30], { numericFrom: 1 });

  y += 5; doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("PROJECT / COST CODE WISE SUMMARY", 10, y); y += 3;
  y = drawTable(doc, y, ["Project / Cost Code", "With Bill", "Without Bill", "Submitted", "Verified Payable"], projectRows(voucher), [58, 33, 33, 33, 33], { numericFrom: 1 });

  y += 5; if (y > 265) { doc.addPage(); doc.setFillColor("1.0"); doc.rect(0, 0, 210, 297, "F"); y = 12; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("CLAIM EXPENSE DETAILS", 10, y); y += 3;
  const detailRows = voucher.items.map((item) => [
    item.claimNumber, item.category, item.description,
    money(item.claimedAmount), money(item.verifiedAmount), money(item.managerApprovedAmount),
    money(item.finalApprovedAmount), money(item.deductionAmount), money(Math.max(item.finalApprovedAmount - item.deductionAmount, 0)),
  ]);
  detailRows.push(["GRAND TOTAL", "", "", money(voucher.grossClaimedAmount), money(voucher.grossVerifiedAmount), money(voucher.items.reduce((s,i)=>s+i.managerApprovedAmount,0)), money(voucher.items.reduce((s,i)=>s+i.finalApprovedAmount,0)), money(voucher.deductionAmount), money(voucher.netPayableAmount)]);
  y = drawTable(doc, y, ["Claim", "Category", "Description", "Claimed", "Admin Verified", "Manager Approved", "Final Approved", "Deduction", "Net Payable"], detailRows, [18, 18, 40, 19, 19, 19, 19, 19, 19], { numericFrom: 3 });

  if (y + 72 > 282) { doc.addPage(); doc.setFillColor("1.0"); doc.rect(0, 0, 210, 297, "F"); y = 14; }
  y += 5;
  doc.setFillColor(248, 250, 252); doc.setDrawColor(220, 225, 230); doc.roundedRect(10, y, 190, 24, 2, 2, "FD");
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text(`Submitted Total: ${money(voucher.grossClaimedAmount)}`, 14, y + 7);
  doc.text(`Verified Total: ${money(voucher.grossVerifiedAmount)}`, 14, y + 13);
  doc.text(`Deductions: ${money(voucher.deductionAmount)}`, 108, y + 7);
  doc.setTextColor(37, 99, 235); doc.text(`FINAL PAYABLE: ${money(voucher.netPayableAmount)}`, 108, y + 13);
  doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "normal");
  doc.text(`Previous advance balance: ${money(voucher.previousAdvanceBalance ?? 0)} | Balance after payment: ${voucher.paidAmount ? money(voucher.balanceAfterPayment ?? 0) : "Pending payment"}`, 14, y + 18, { maxWidth: 180 });
  doc.text(`Amount in words: ${amountInWords(voucher.netPayableAmount)}`, 14, y + 22, { maxWidth: 180 });
  y += 34;

  const signatureBlocks = [
    ["Prepared By", voucher.preparedByName || "-", voucher.signatures?.["Prepared By"]],
    ["Admin Verified", voucher.preparedByName || "-", voucher.signatures?.["Admin Verified By"]],
    ["Approved by Manager", voucher.managerName || "-", voucher.signatures?.["Manager Approved By"]],
    ["Final Approval", voucher.hodName || voucher.finalApproverName || "-", voucher.signatures?.["HOD Approved By"] || voucher.signatures?.["Final Approved By"]],
    ["Accounts Verified", voucher.accountsVerifierName || "-", voucher.signatures?.["Accounts Verified By"]],
    ["Paid By / Cashier", voucher.paidByName || voucher.paymentReference || "Pending", voucher.signatures?.["Paid By / Cashier"]],
    ["Employee Acknowledgement", voucher.paidToName, voucher.signatures?.["Employee Acknowledgement"]],
    ["Payment Reference", voucher.paymentReference || "Pending", undefined],
  ] as const;
  const blockWidth = 42;
  for (let index = 0; index < signatureBlocks.length; index += 1) {
    const [label, name, signature] = signatureBlocks[index];
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 12 + column * 47;
    const top = y + row * 30;
    const data = await imageDataUrl(signature);
    if (data) { try { doc.addImage(data, "PNG", x + 14, top, 28, 10, undefined, "FAST"); } catch { /* optional */ } }
    doc.setDrawColor(80, 80, 80); doc.line(x, top + 13, x + blockWidth, top + 13);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.text(label, x + blockWidth / 2, top + 18, { align: "center", maxWidth: blockWidth });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.text(String(name), x + blockWidth / 2, top + 23, { align: "center", maxWidth: blockWidth });
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page); doc.setFontSize(6.5); doc.setTextColor(110, 110, 110);
    doc.text(`${voucher.voucherNumber} | Page ${page} of ${pages}`, width - 10, 292, { align: "right" });
  }
  return doc.output("arraybuffer");
}

async function appendSeparator(output: PDFDocument, voucher: DetailedClaimVoucher, attachment: DetailedClaimVoucher["attachments"][number]) {
  const page = output.addPage([595, 842]);
  const font = await output.embedFont(StandardFonts.Helvetica);
  const bold = await output.embedFont(StandardFonts.HelveticaBold);
  page.drawText("CLAIM ATTACHMENT", { x: 50, y: 760, size: 18, font: bold, color: rgb(0.05, 0.3, 0.6) });
  page.drawText(`Voucher: ${voucher.voucherNumber}`, { x: 50, y: 720, size: 11, font });
  page.drawText(`File: ${attachment.fileName}`, { x: 50, y: 696, size: 11, font });
  page.drawText(`Uploaded: ${new Date(attachment.uploadedAt).toLocaleString("en-IN")}`, { x: 50, y: 672, size: 11, font });
}

async function normalizedImage(bytes: Uint8Array, mimeType: string) {
  if (mimeType.includes("png")) return { bytes, type: "png" as const };
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return { bytes, type: "jpg" as const };
  if (typeof createImageBitmap === "undefined" || typeof document === "undefined") return null;
  try {
    const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer], { type: mimeType }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return null;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type: "png" as const };
  } catch { return null; }
}

async function appendAttachment(output: PDFDocument, voucher: DetailedClaimVoucher, attachment: DetailedClaimVoucher["attachments"][number]) {
  await appendSeparator(output, voucher, attachment);
  try {
    const response = await fetch(attachment.url);
    if (!response.ok) throw new Error("download failed");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (attachment.fileType.includes("pdf")) {
      const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await output.copyPages(source, source.getPageIndices());
      pages.forEach((page) => output.addPage(page));
      return;
    }
    if (attachment.fileType.startsWith("image/")) {
      const normalized = await normalizedImage(bytes, attachment.fileType);
      if (!normalized) return;
      const image = normalized.type === "png" ? await output.embedPng(normalized.bytes) : await output.embedJpg(normalized.bytes);
      const page = output.addPage([595, 842]);
      const scale = Math.min(515 / image.width, 742 / image.height, 1);
      page.drawImage(image, { x: (595-image.width*scale)/2, y: (842-image.height*scale)/2, width:image.width*scale, height:image.height*scale });
    }
  } catch { /* separator page records unsupported, encrypted, corrupt or unavailable files */ }
}

export async function createVoucherWithAttachmentsPdf(voucher: DetailedClaimVoucher, company?: VoucherCompanyDetails) {
  const output = await PDFDocument.load(await createVoucherPdf(voucher, company));
  for (const attachment of voucher.attachments) {
    await appendAttachment(output, voucher, attachment);
  }
  return output.save();
}

async function createUserBatchCover(vouchers: DetailedClaimVoucher[], companyInput?: VoucherCompanyDetails) {
  const { jsPDF } = await import("jspdf");
  const company = await resolveCompany(companyInput);
  const doc = new jsPDF({ unit:"mm", format:"a4" });
  doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(37,99,235);
  doc.text(company.name,105,22,{align:"center"});
  doc.setTextColor(20,20,20); doc.setFontSize(15); doc.text("COMBINED CLAIM VOUCHER PACK",105,36,{align:"center"});
  doc.setFontSize(10); doc.setFont("helvetica","normal");
  doc.text(`Employee: ${vouchers[0]?.paidToName ?? "-"}`,15,50);
  doc.text(`Employee Code: ${vouchers[0]?.employeeCode ?? "-"}`,15,57);
  doc.text(`Claims: ${vouchers.reduce((sum,voucher)=>sum+voucher.claimIds.length,0)} | Vouchers: ${vouchers.length}`,15,64);
  doc.setFont("helvetica","bold"); doc.text("Voucher",15,78); doc.text("Date",70,78); doc.text("Claim(s)",105,78); doc.text("Net Payable",190,78,{align:"right"});
  let y=85; doc.setFont("helvetica","normal");
  vouchers.forEach((voucher)=>{doc.text(voucher.voucherNumber,15,y);doc.text(shortDate(voucher.voucherDate),70,y);doc.text(String(voucher.claimIds.length),105,y);doc.text(money(voucher.netPayableAmount),190,y,{align:"right"});y+=8;});
  doc.line(15,y,195,y);doc.setFont("helvetica","bold");doc.text("Combined Payable",105,y+7);doc.text(money(vouchers.reduce((sum,voucher)=>sum+voucher.netPayableAmount,0)),190,y+7,{align:"right"});
  return doc.output("arraybuffer");
}

export async function createUserVoucherPacketPdf(vouchers: DetailedClaimVoucher[], company?: VoucherCompanyDetails) {
  if (!vouchers.length) throw new Error("No vouchers were supplied for the employee packet.");
  const output = await PDFDocument.create();
  if (vouchers.length > 1 || vouchers.reduce((sum,voucher)=>sum+voucher.claimIds.length,0)>1) {
    const cover=await PDFDocument.load(await createUserBatchCover(vouchers,company));
    const pages=await output.copyPages(cover,cover.getPageIndices());pages.forEach((page)=>output.addPage(page));
  }
  for (const voucher of vouchers) {
    const source=await PDFDocument.load(await createVoucherPdf(voucher,company));
    const pages=await output.copyPages(source,source.getPageIndices());pages.forEach((page)=>output.addPage(page));
    for (const attachment of voucher.attachments) await appendAttachment(output,voucher,attachment);
  }
  return output.save();
}

export function downloadPdf(bytes: ArrayBuffer | Uint8Array, fileName: string) {
  const body = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes;
  const url = URL.createObjectURL(new Blob([body], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
