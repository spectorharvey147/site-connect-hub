import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { calculateLeaveDays, leaveService } from "@/services/leaveService";
import type { AppUser } from "@/types/auth";

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

describe("leaveService validations", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    leaveService.resetDemoData();
  });

  it("excludes weekends and holidays when calculating leave days", () => {
    expect(calculateLeaveDays("2026-12-24", "2026-12-28")).toBe(2);
  });

  it("blocks overlapping leave applications", async () => {
    const siteUser = userByEmail("site@siteconnect.local");

    await expect(
      leaveService.applyLeave(
        {
          leaveTypeId: "casual",
          fromDate: "2026-06-24",
          toDate: "2026-06-24",
          reason: "Overlap check",
          attachments: [],
        },
        siteUser,
      ),
    ).rejects.toThrow("Leave dates overlap with an existing application.");
  });

  it("scopes leave registers by user, manager, HOD and admin hierarchy", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const manager = userByEmail("manager@siteconnect.local");
    const hod = userByEmail("hod.ops@siteconnect.local");
    const admin = userByEmail("admin@siteconnect.local");

    const own = await leaveService.getLeaveRegister(siteUser);
    expect(own.users.every((item) => item.id === siteUser.id)).toBe(true);

    const team = await leaveService.getLeaveRegister(manager);
    expect(
      team.users.every(
        (item) => item.id === manager.id || item.reportingManagerId === manager.id,
      ),
    ).toBe(true);

    const department = await leaveService.getLeaveRegister(hod);
    expect(
      department.users.every(
        (item) => item.id === hod.id || item.departmentId === hod.departmentId,
      ),
    ).toBe(true);

    const allUsers = await leaveService.getLeaveRegister(admin);
    expect(allUsers.users.length).toBeGreaterThan(team.users.length);
  });

  it("allows Admin to edit leave masters and blocks ordinary users", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const admin = userByEmail("admin@siteconnect.local");

    await expect(
      leaveService.saveHoliday(
        {
          id: crypto.randomUUID(),
          name: "Site Foundation Day",
          date: "2026-09-09",
          location: "India",
          type: "company",
        },
        siteUser,
      ),
    ).rejects.toThrow("Only Admin / HR or Super Admin can manage holidays.");

    const saved = await leaveService.saveLeaveType(
      {
        id: crypto.randomUUID(),
        code: "BL",
        name: "Bereavement Leave",
        annualAllowance: 3,
        carryForward: false,
        requiresDocument: false,
        status: "active",
      },
      admin,
    );

    expect(leaveService.listLeaveTypes()).toContainEqual(saved);
  });
});
