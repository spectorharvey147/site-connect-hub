import { describe, expect, it } from "vitest";

import {
  CLAIM_ROLES,
  MESSAGE_ROLES,
  PEOPLE_ROLES,
  VENDOR_SOURCE_ENTRY_ROLES,
  VENDOR_ROLES,
} from "@/routes/routePermissions";

describe("authenticated child route role groups", () => {
  it("does not grant Accounts access to people operations or claim submission", () => {
    expect(PEOPLE_ROLES).not.toContain("accounts_officer");
    expect(CLAIM_ROLES).toContain("accounts_officer");
  });

  it("keeps messaging broad while restricting vendors to office roles", () => {
    expect(MESSAGE_ROLES).toContain("site_staff");
    expect(VENDOR_ROLES).not.toContain("site_staff");
    expect(VENDOR_ROLES).toContain("accounts_officer");
  });

  it("keeps Accounts read-only on vendor source records", () => {
    expect(VENDOR_ROLES).toContain("accounts_officer");
    expect(VENDOR_SOURCE_ENTRY_ROLES).not.toContain("accounts_officer");
    expect(VENDOR_SOURCE_ENTRY_ROLES).toContain("admin_hr");
  });
});
