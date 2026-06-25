import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import {
  buildExportRows,
  REPORT_DEFINITIONS,
  reportsService,
} from "@/services/reportsService";

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

describe("reportsService", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
  });

  it("builds cross-module dashboard and export rows", async () => {
    const user = toAppUser(
      DEMO_USERS.find((item) => item.email === "super@siteconnect.local")!,
    );
    const dashboard = await reportsService.getDashboard(user);
    const rows = buildExportRows(dashboard);

    expect(dashboard.moduleSummaries.length).toBeGreaterThanOrEqual(8);
    expect(rows[0]).toEqual(["Section", "Label", "Value"]);
  });

  it("publishes detailed operational and finance reports", () => {
    const requiredReportKeys = [
      "claim-ageing",
      "claim-approval-delay",
      "employee-claim-ledger",
      "project-claim-cost",
      "attendance-monthly",
      "department-attendance",
      "late-absent",
      "leave-balance",
      "leave-usage",
      "dpr-progress",
      "labour-attendance",
      "labour-ot",
      "labour-payment",
      "machinery-utilization",
      "machinery-breakdown",
      "machinery-reconciliation",
      "fuel-vendor-balance",
      "fuel-receipt",
      "fuel-issue",
      "fuel-efficiency",
      "material-stock",
      "material-consumption",
      "material-wastage",
      "vendor-outstanding",
      "vendor-bill-ageing",
      "vendor-payment",
      "accounts-reconciliation",
      "project-cost-summary",
      "cost-code-summary",
    ];

    expect(REPORT_DEFINITIONS.map((item) => item.key)).toEqual(requiredReportKeys);
  });
});
