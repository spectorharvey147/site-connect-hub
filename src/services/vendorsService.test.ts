import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import {
  calculateVendorBillTotal,
  vendorsService,
} from "@/services/vendorsService";
import type { AppUser } from "@/types/auth";
import type { VendorBillInput, VendorInput } from "@/types/vendors";

function userByEmail(email: string): AppUser {
  const user = DEMO_USERS.find((item) => item.email === email);
  if (!user) {
    throw new Error(`Missing demo user ${email}`);
  }
  return toAppUser(user);
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

function vendorInput(): VendorInput {
  return {
    name: "Test Service Vendor",
    code: "VEN-SRV-999",
    vendorType: "service",
    contactPerson: "Tester",
    email: "vendor@test.local",
    phone: "+91 98765 00000",
    gstNumber: "29TEST9999Z5",
    address: "Bengaluru",
    paymentTerms: "7 days",
    status: "active",
  };
}

function billInput(): VendorBillInput {
  return {
    vendorId: "vendor-buildmart",
    projectId: "project-metro",
    billType: "material",
    billingPeriodFrom: "2026-06-21",
    billingPeriodTo: "2026-06-21",
    invoiceNumber: "TEST-BILL-001",
    invoiceDate: "2026-06-21",
    baseAmount: 10000,
    gstAmount: 1800,
    otherCharges: 200,
    processingType: "deduction",
    processingAmount: 500,
  };
}

describe("vendorsService workflow", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    vendorsService.resetDemoData();
  });

  it("calculates vendor bill totals", () => {
    expect(calculateVendorBillTotal(billInput())).toBe(11500);
  });

  it("restricts vendor master creation to admin roles", async () => {
    const manager = userByEmail("manager@siteconnect.local");
    const admin = userByEmail("admin@siteconnect.local");

    await expect(
      vendorsService.createVendor(vendorInput(), manager),
    ).rejects.toThrow("You do not have permission to create vendors.");

    const vendor = await vendorsService.createVendor(vendorInput(), admin);

    expect(vendor.code).toBe("VEN-SRV-999");
  });

  it("runs bill approval, voucher and payment lifecycle", async () => {
    const manager = userByEmail("manager@siteconnect.local");
    const admin = userByEmail("admin@siteconnect.local");
    const superAdmin = userByEmail("super@siteconnect.local");
    const accounts = userByEmail("accounts@siteconnect.local");

    const bill = await vendorsService.createBill(billInput(), manager, "submitted");
    const verified = await vendorsService.verifyBill(bill.id, admin);
    const approved = await vendorsService.approveBill(verified.id, superAdmin);
    const voucher = await vendorsService.generateVoucher(
      approved.id,
      accounts,
      "Ready for payment",
    );
    const payment = await vendorsService.markVoucherPaid(
      voucher.id,
      accounts,
      "UTR-TEST-001",
    );

    expect(bill.billNumber).toBe("VB-2026-0004");
    expect(verified.status).toBe("verified");
    expect(approved.status).toBe("approved");
    expect(voucher.voucherNumber).toBe("VPV-2026-0002");
    expect(payment.amount).toBe(11500);
  });

  it("prevents Accounts from creating vendor source bills", async () => {
    const accounts = userByEmail("accounts@siteconnect.local");

    await expect(
      vendorsService.createBill(billInput(), accounts, "submitted"),
    ).rejects.toThrow("You do not have permission to create vendor bills.");
  });
});
