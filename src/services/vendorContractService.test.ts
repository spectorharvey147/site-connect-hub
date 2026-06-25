import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { casualLabourService } from "@/services/casualLabourService";
import { machineryService } from "@/services/machineryService";
import { vendorContractService } from "@/services/vendorContractService";
import type { AppUser } from "@/types/auth";

function user(email: string): AppUser {
  const row = DEMO_USERS.find((item) => item.email === email);
  if (!row) throw new Error("Missing demo user");
  return toAppUser(row);
}

function storageMock() {
  const data = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      get length() { return data.size; },
      clear: () => data.clear(),
      getItem: (key: string) => data.get(key) ?? null,
      key: (index: number) => Array.from(data.keys())[index] ?? null,
      removeItem: (key: string) => data.delete(key),
      setItem: (key: string, value: string) => data.set(key, value),
    },
  });
}

describe("vendor contracts", () => {
  beforeEach(() => {
    storageMock();
    vendorContractService.resetForTests();
    casualLabourService.resetDemoData();
    machineryService.resetDemoData();
  });

  it("creates labour and machinery contracts", async () => {
    const admin = user("admin@siteconnect.local");
    const base = {
      vendorId: "vendor-buildmart",
      projectId: "project-metro",
      contractCode: "VC-TEST-01",
      startDate: "2026-06-01",
      endDate: "2026-12-31",
      status: "active" as const,
      paymentTerms: "30 days",
      gstApplicable: true,
      tdsApplicable: true,
      remarks: "",
    };
    const labour = await vendorContractService.save({
      ...base,
      contractType: "labour",
      maleLabourRate: 850,
      femaleLabourRate: 800,
      supervisorRate: 1100,
      overtimeRate: 150,
    }, admin);
    const machinery = await vendorContractService.save({
      ...base,
      contractCode: "VC-TEST-02",
      contractType: "machinery",
      machineType: "excavator",
      billingType: "hourly",
      rate: 2200,
      minimumHours: 8,
    }, admin);
    expect(labour.contractType).toBe("labour");
    expect(machinery.billingType).toBe("hourly");
  });

  it("loads contract rates into labour attendance and machinery cost", async () => {
    const admin = user("admin@siteconnect.local");
    const site = user("site@siteconnect.local");
    const labour = await vendorContractService.save({
      contractType: "labour", vendorId: "vendor-buildmart", projectId: "project-metro",
      contractCode: "LAB-RATE", startDate: "2026-06-01", endDate: "2026-12-31",
      status: "active", paymentTerms: "30 days", gstApplicable: true,
      tdsApplicable: true, remarks: "", maleLabourRate: 900, femaleLabourRate: 850,
      supervisorRate: 1200, overtimeRate: 175,
    }, admin);
    const worker = casualLabourService.listWorkers()[0];
    const attendance = await casualLabourService.saveAttendance({
      projectId: "project-metro", vendorId: labour.vendorId, vendorContractId: labour.id,
      date: "2026-06-21", allocation: { workArea: "A", workDescription: "Test", maleAllocated: 1, femaleAllocated: 0, supervisorAllocated: 0 },
      rows: [{ id: "r1", workerId: worker.id, workerCode: worker.labourCode, workerName: worker.fullName, category: "male", startTime: "09:00", endTime: "18:00", status: "present", dailyRate: 1, overtimeHours: 1, overtimeRate: 1 }],
    }, site, "submitted");
    expect(attendance.rows[0].dailyRate).toBe(900);

    const asset = machineryService
      .listAssets()
      .find((item) => item.projectId === "project-metro" && item.ownership !== "company_owned");
    if (!asset) throw new Error("Missing rented metro asset");
    const machinery = await vendorContractService.save({
      contractType: "machinery", vendorId: asset.vendorId ?? "vendor-buildmart",
      projectId: asset.projectId ?? "project-metro", contractCode: "MCH-RATE",
      startDate: "2026-06-01", endDate: "2026-12-31", status: "active",
      paymentTerms: "30 days", gstApplicable: true, tdsApplicable: true,
      remarks: "", machineNumber: asset.machineNumber, machineType: asset.machineType,
      billingType: "hourly", rate: 1000, minimumHours: 8,
    }, admin);
    const log = await machineryService.saveLog({
      projectId: asset.projectId ?? "project-metro", vendorContractId: machinery.id,
      date: "2026-06-21", machineAssetId: asset.id,
      usageSessions: [{ id: "s1", startTime: "09:00", endTime: "17:00", hours: 8 }],
      meterStart: 10, meterEnd: 18,
      breakdown: { isBreakdown: false, durationHours: 0, reason: "", resolution: "" },
      remarks: "",
    }, site, "submitted");
    expect(log.calculatedCost).toBe(8000);
  });

  it("keeps production contract terms in normalized detail tables", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src", "services", "vendorContractService.ts"),
      "utf8",
    );
    for (const tableName of [
      "labour_contract_terms",
      "machinery_contract_terms",
      "fuel_contracts",
      "vendor_contract_rate_cards",
    ]) {
      expect(source).toContain(`from("${tableName}")`);
    }
  });
});
