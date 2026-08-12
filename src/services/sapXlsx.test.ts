import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { createSapWorkbook } from "@/services/sapXlsx";
import type { SapExportRow } from "@/types/sap";

describe("SAP XLSX export", () => {
  it("creates preview and final sheets with typed dates, currency styles, freeze pane and filter", async () => {
    const row: SapExportRow = { id:"1",batchId:"b",voucherId:"v",claimId:"c",employeeId:"e",glCode:"500100",costCenter:"CC01",employeeVendorCode:"EMP01",postingDate:"2026-07-06",documentDate:"2026-07-05",amount:1250.5,debitCredit:"debit",narration:"Travel claim" };
    const bytes = await createSapWorkbook([row]);
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file("xl/worksheets/sheet1.xml")).toBeTruthy();
    expect(zip.file("xl/worksheets/sheet2.xml")).toBeTruthy();
    const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain("<autoFilter");
    expect(sheet).toContain('r="A2" s="2"');
    expect(sheet).toContain('r="M2" s="3"');
  });
});
