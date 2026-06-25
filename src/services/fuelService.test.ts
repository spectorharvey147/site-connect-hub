import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import {
  calculateFuelIssueTotal,
  calculateFuelReceiptTotal,
  fuelService,
  getFuelUnit,
  getStockOnDate,
} from "@/services/fuelService";
import type { AppUser } from "@/types/auth";
import type { FuelIssueInput, FuelReceiptInput } from "@/types/fuel";

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

function validReceipt(): FuelReceiptInput {
  return {
    projectId: "project-metro",
    date: today(),
    fuelType: "diesel",
    vendorId: "vendor-apex-fuel",
    source: "cash",
    quantity: 50,
    ratePerUnit: 95,
    referenceNumber: "TEST-001",
    remarks: "Test receipt",
  };
}

function validIssue(): FuelIssueInput {
  return {
    projectId: "project-metro",
    date: today(),
    fuelType: "diesel",
    rows: [
      {
        id: "fuel-row-test-001",
        machineAssetId: "machine-asset-demo-001",
        machineNumber: "EXC-101",
        machineType: "excavator",
        quantityIssued: 10,
        remarks: "Test issue",
      },
    ],
    remarks: "Issue test",
  };
}

describe("fuelService workflow", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    fuelService.resetDemoData();
  });

  it("calculates receipt totals, issue totals and units", () => {
    expect(getFuelUnit("diesel")).toBe("L");
    expect(calculateFuelReceiptTotal(validReceipt())).toBe(4750);
    expect(calculateFuelIssueTotal(validIssue())).toBe(10);
  });

  it("validates permissions and future dates", async () => {
    const accountsUser = userByEmail("accounts@siteconnect.local");
    const siteUser = userByEmail("site@siteconnect.local");

    await expect(
      fuelService.saveReceipt(validReceipt(), accountsUser, "draft"),
    ).rejects.toThrow("You do not have permission to save fuel receipts.");

    await expect(
      fuelService.saveIssue(
        { ...validIssue(), date: "2099-01-01" },
        siteUser,
        "draft",
      ),
    ).rejects.toThrow("Fuel issue date cannot be in the future.");
  });

  it("submits receipts and issues against stock", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const manager = userByEmail("manager@siteconnect.local");

    const receipt = await fuelService.saveReceipt(
      validReceipt(),
      siteUser,
      "submitted",
    );
    const issue = await fuelService.saveIssue(validIssue(), siteUser, "submitted");
    const approved = await fuelService.approveIssue(issue.id, manager);

    expect(receipt.receiptNumber).toBe("FRC-2026-0004");
    expect(issue.issueNumber).toBe("FIS-2026-0002");
    expect(approved.status).toBe("approved");
    expect(getStockOnDate("project-metro", "diesel", today())).toBe(230);
  });
});
