import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import {
  calculateMachineryContractCost,
  calculateMachineLogSummary,
  calculateSessionHours,
  machineryService,
} from "@/services/machineryService";
import type { AppUser } from "@/types/auth";
import type { MachineLogInput } from "@/types/machinery";

function userByEmail(email: string): AppUser {
  const user = DEMO_USERS.find((item) => item.email === email);
  if (!user) {
    throw new Error(`Missing demo user ${email}`);
  }
  return toAppUser(user);
}

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };

  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
  });
}

function validInput(): MachineLogInput {
  const asset = machineryService.listAssets()[0];
  return {
    projectId: "project-metro",
    date: today(),
    machineAssetId: asset.id,
    usageSessions: [
      {
        id: "machine-session-test-001",
        startTime: "09:00",
        endTime: "13:00",
        hours: 4,
      },
      {
        id: "machine-session-test-002",
        startTime: "14:00",
        endTime: "17:30",
        hours: 3.5,
      },
    ],
    meterStart: 100,
    meterEnd: 107.5,
    breakdown: {
      isBreakdown: false,
      durationHours: 0,
      reason: "",
      resolution: "",
    },
    remarks: "Test usage log.",
  };
}

describe("machineryService workflow", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    machineryService.resetDemoData();
  });

  it("calculates session and billable hours", () => {
    expect(calculateSessionHours("09:00", "17:30")).toBe(8.5);
    expect(calculateMachineLogSummary(validInput()).billableHours).toBe(7.5);
  });

  it("calculates machinery contract cost with OT, driver beta and breakdown deduction", () => {
    const cost = calculateMachineryContractCost({
      contract: {
        id: "vc-machinery",
        contractType: "machinery",
        contractCode: "MCH-COST",
        vendorId: "vendor-apex-machinery",
        vendorName: "Apex",
        projectId: "project-metro",
        projectName: "Metro",
        startDate: "2026-06-01",
        endDate: "2026-12-31",
        status: "active",
        paymentTerms: "30 days",
        gstApplicable: true,
        tdsApplicable: true,
        remarks: "",
        billingType: "hourly",
        rate: 1000,
        minimumHours: 8,
        overtimeRate: 1500,
        driverCost: "additional",
        driverBetaAmount: 300,
        createdBy: "admin",
        createdByName: "Admin",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
      billableHours: 10,
      tripCount: 0,
      breakdownHours: 1,
    });

    expect(cost).toBe(9800);
  });

  it("validates log permissions and dates", async () => {
    const accountsUser = userByEmail("accounts@siteconnect.local");
    const siteUser = userByEmail("site@siteconnect.local");

    await expect(
      machineryService.saveLog(validInput(), accountsUser, "draft"),
    ).rejects.toThrow("You do not have permission to save machinery logs.");

    await expect(
      machineryService.saveLog(
        { ...validInput(), date: "2099-01-01" },
        siteUser,
        "draft",
      ),
    ).rejects.toThrow("Machine log date cannot be in the future.");
  });

  it("submits and approves a machine log", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const manager = userByEmail("manager@siteconnect.local");

    const log = await machineryService.saveLog(validInput(), siteUser, "submitted");
    const approved = await machineryService.approveLog(log.id, manager);

    expect(log.logNumber).toBe("MLOG-2026-0003");
    expect(approved.status).toBe("approved");
    expect(approved.approvedBy).toBe(manager.id);
  });

  it("restricts contract creation to admin roles", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const admin = userByEmail("admin@siteconnect.local");

    await expect(
      machineryService.createContract(
        {
          vendorId: "vendor-apex-machinery",
          machineType: "dumper",
          machineNumbers: ["DMP-18"],
          periodFrom: "2026-06-21",
          periodTo: "2026-08-31",
          billingCycle: "daily",
          rate: 7000,
          workingDaysPerMonth: 26,
          overtimeRatePerHour: 800,
          fuelScope: "excluded",
          driverCostScope: "included",
          specialTerms: "",
          status: "active",
        },
        siteUser,
      ),
    ).rejects.toThrow("You do not have permission to create machinery contracts.");

    const contract = await machineryService.createContract(
      {
        vendorId: "vendor-apex-machinery",
        machineType: "dumper",
        machineNumbers: ["DMP-18"],
        periodFrom: "2026-06-21",
        periodTo: "2026-08-31",
        billingCycle: "daily",
        rate: 7000,
        workingDaysPerMonth: 26,
        overtimeRatePerHour: 800,
        fuelScope: "excluded",
        driverCostScope: "included",
        specialTerms: "",
        status: "active",
      },
      admin,
    );

    expect(contract.contractNumber).toBe("MC-2026-0003");
    expect(contract.createdBy).toBe(admin.id);
  });
});
