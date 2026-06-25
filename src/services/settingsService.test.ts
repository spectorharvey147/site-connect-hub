import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { settingsService } from "@/services/settingsService";

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

describe("settingsService", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    settingsService.resetDemoData();
  });

  it("allows only super admin to update settings", async () => {
    const admin = toAppUser(
      DEMO_USERS.find((item) => item.email === "admin@siteconnect.local")!,
    );
    const superAdmin = toAppUser(
      DEMO_USERS.find((item) => item.email === "super@siteconnect.local")!,
    );
    const settings = settingsService.getSettings();

    await expect(
      settingsService.updateCompanySettings(settings.company, admin),
    ).rejects.toThrow("Only Super Admin can update system settings.");

    const updated = await settingsService.updateCompanySettings(
      { ...settings.company, companyName: "IPI BuildOps" },
      superAdmin,
    );

    expect(updated.company.companyName).toBe("IPI BuildOps");
  });
});
