import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { fuelService } from "@/services/fuelService";
import { vendorBillSourceService } from "@/services/vendorBillSourceService";
import type { VendorBillInput } from "@/types/vendors";

function installLocalStorageMock() {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      get length() { return store.size; },
      clear() { store.clear(); },
      getItem(key: string) { return store.get(key) ?? null; },
      key(index: number) { return Array.from(store.keys())[index] ?? null; },
      removeItem(key: string) { store.delete(key); },
      setItem(key: string, value: string) { store.set(key, value); },
    } satisfies Storage,
  });
}

describe("vendor bill source preview", () => {
  beforeEach(() => {
    installLocalStorageMock();
    fuelService.resetDemoData();
  });

  it("pulls fuel receipt quantities and amounts from source records", async () => {
    const actor = toAppUser(
      DEMO_USERS.find((user) => user.email === "manager@siteconnect.local")!,
    );
    const input: VendorBillInput = {
      vendorId: "vendor-apex-fuel",
      projectId: "project-metro",
      billType: "fuel",
      billingPeriodFrom: "2026-06-01",
      billingPeriodTo: "2026-06-30",
      invoiceNumber: "AFS-JUN-2026",
      invoiceDate: "2026-06-30",
      baseAmount: 0,
      gstAmount: 0,
      otherCharges: 0,
      processingType: "none",
      processingAmount: 0,
    };

    const preview = await vendorBillSourceService.preview(input, actor);

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({
      quantity: 150,
      rate: 92,
      amount: 13800,
    });
    expect(preview.grossAmount).toBe(13800);
  });
});
