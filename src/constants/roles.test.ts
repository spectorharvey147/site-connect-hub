import { describe, expect, it } from "vitest";

import { MODULES, getVisibleModules } from "@/constants/modules";
import { canAccessModule } from "@/constants/roles";

describe("role-based module access", () => {
  it("shows settings and master data only to administration roles", () => {
    const settings = MODULES.find((module) => module.key === "settings");

    expect(settings).toBeDefined();
    expect(settings ? canAccessModule("super_admin", settings) : false).toBe(
      true,
    );
    expect(settings ? canAccessModule("admin_hr", settings) : false).toBe(true);
    expect(settings ? canAccessModule("manager", settings) : true).toBe(false);
  });

  it("keeps HOD home navigation aligned with department routes", () => {
    const visibleKeys = getVisibleModules("hod").map((module) => module.key);

    expect(visibleKeys).toEqual(
      expect.arrayContaining([
        "leave",
        "tasks",
        "field_operations",
        "casual_labour",
        "machinery",
        "fuel",
        "materials",
      ]),
    );
  });

  it("keeps site staff focused on field workflows", () => {
    const visibleKeys = getVisibleModules("site_staff").map(
      (module) => module.key,
    );

    expect(visibleKeys).toContain("attendance");
    expect(visibleKeys).toContain("claims");
    expect(visibleKeys).not.toContain("settings");
    expect(visibleKeys).not.toContain("users");
  });
  it("limits the Accounts module to Accounts and Super Admin",()=>{const accounts=MODULES.find(module=>module.key==="accounts")!;expect(canAccessModule("accounts_officer",accounts)).toBe(true);expect(canAccessModule("super_admin",accounts)).toBe(true);expect(canAccessModule("manager",accounts)).toBe(false);expect(canAccessModule("admin_hr",accounts)).toBe(false);});
});
