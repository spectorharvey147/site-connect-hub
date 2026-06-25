import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { attendanceService } from "@/services/attendanceService";
import { leaveService } from "@/services/leaveService";
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

describe("attendanceService validations", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    attendanceService.resetDemoData();
    leaveService.resetDemoData();
  });

  it("blocks duplicate check-in for the same day", async () => {
    const siteUser = userByEmail("site@siteconnect.local");

    await expect(attendanceService.checkIn(siteUser)).rejects.toThrow(
      "Attendance already checked in for today.",
    );
  });

  it("blocks future manual attendance", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await expect(
      attendanceService.submitManualAttendance(
        {
          userId: siteUser.id,
          projectId: "project-metro",
          shiftId: "shift-general",
          date: tomorrow,
          checkInTime: "09:00",
          checkOutTime: "18:00",
          status: "present",
          remarks: "Future entry",
        },
        siteUser,
      ),
    ).rejects.toThrow("Future attendance cannot be submitted.");
  });

  it("supports overnight night shifts and grants comp off for holiday work", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const manager = userByEmail("manager@siteconnect.local");

    const nightShift = await attendanceService.submitManualAttendance(
      {
        userId: siteUser.id,
        projectId: "project-metro",
        shiftId: "shift-general",
        date: "2026-05-17",
        checkInTime: "22:00",
        checkOutTime: "06:00",
        status: "night_shift",
        remarks: "Overnight work",
      },
      manager,
    );
    const holidayWork = await attendanceService.submitManualAttendance(
      {
        userId: siteUser.id,
        projectId: "project-metro",
        shiftId: "shift-general",
        date: "2026-05-18",
        checkInTime: "09:00",
        checkOutTime: "18:00",
        status: "holiday_present",
        remarks: "Holiday work",
      },
      manager,
    );
    const leaves = await leaveService.listLeaves(siteUser);

    expect(nightShift.workedHours).toBe(8);
    expect(holidayWork.status).toBe("holiday_present");
    expect(
      leaves.some(
        (leave) =>
          leave.leaveTypeId === "comp_off" &&
          leave.fromDate === "2026-05-18" &&
          leave.status === "approved",
      ),
    ).toBe(true);
  });
});
