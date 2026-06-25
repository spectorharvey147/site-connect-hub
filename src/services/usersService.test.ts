import { beforeEach, describe, expect, it } from "vitest";

import {
  DEMO_DEPARTMENT_IDS,
  DEMO_DESIGNATION_IDS,
  DEMO_ORGANIZATION_ID,
  DEMO_USERS,
  toAppUser,
} from "@/constants/demoData";
import { usersService } from "@/services/usersService";

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

describe("usersService", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    usersService.resetDemoData();
  });

  it("invites and updates users with admin permissions", async () => {
    const admin = toAppUser(
      DEMO_USERS.find((item) => item.email === "admin@siteconnect.local")!,
    );
    const site = toAppUser(
      DEMO_USERS.find((item) => item.email === "site@siteconnect.local")!,
    );

    await expect(usersService.listUsers(site)).rejects.toThrow(
      "You do not have permission to manage users.",
    );

    const invited = await usersService.inviteUser(
      {
        organizationId: DEMO_ORGANIZATION_ID,
        employeeCode: "SC-USR-999",
        firstName: "New",
        lastName: "Site User",
        fullName: "New Site User",
        email: "new.site@siteconnect.local",
        phone: "+91 98765 99999",
        role: "site_staff",
        department: "Site Operations",
        departmentId: DEMO_DEPARTMENT_IDS.operations,
        designationId: DEMO_DESIGNATION_IDS.siteEngineer,
        reportingManagerId: "00000000-0000-4000-8000-000000000003",
        hodUserId: "00000000-0000-4000-8000-000000000008",
        primaryProjectId: "project-metro",
        employmentType: "permanent",
        projectIds: ["project-metro"],
      },
      admin,
    );
    const updated = await usersService.updateUser(
      invited.id,
      { status: "active" },
      admin,
    );

    expect(invited.status).toBe("invited");
    expect(updated.status).toBe("active");
  });
});
