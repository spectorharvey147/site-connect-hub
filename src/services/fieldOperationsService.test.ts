import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import {
  calculateDprLaborSummary,
  fieldOperationsService,
} from "@/services/fieldOperationsService";
import type { AppUser } from "@/types/auth";
import type { DprInput } from "@/types/fieldOperations";

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

function validInput(user: AppUser): DprInput {
  return {
    projectId: "project-metro",
    reportDate: today(),
    shiftId: "shift-general",
    weather: ["clear"],
    activities: [
      {
        id: "activity-test-001",
        activityName: "Concrete Works",
        description: "Concrete pour completed for test bay.",
        completionPercent: 100,
        machinesUsed: ["concrete_mixer", "vibrator"],
        labor: {
          male: 8,
          female: 2,
          supervisors: 1,
          companyStaff: 3,
        },
        comments: "Cube samples prepared.",
      },
    ],
    issues: [],
    nextDayPlan: "Curing and surface protection.",
    plannedManpower: 12,
    plannedEquipment: "Water pump",
    photos: [
      {
        id: "photo-test-001",
        fileName: "pour-photo.jpg",
        fileType: "image/jpeg",
        fileSize: 120000,
        url: "#",
        caption: "Concrete pour",
        uploadedBy: user.id,
        uploadedByName: user.fullName,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

describe("fieldOperationsService workflow", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    fieldOperationsService.resetDemoData();
  });

  it("submits a DPR and calculates labour summary", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const report = await fieldOperationsService.saveDpr(
      validInput(siteUser),
      siteUser,
      "submitted",
    );

    expect(report.dprNumber).toBe("DPR-2026-0004");
    expect(report.status).toBe("submitted");
    expect(calculateDprLaborSummary(report).totalWorkforce).toBe(14);
  });

  it("requires photos for submitted DPRs and blocks future dates", async () => {
    const siteUser = userByEmail("site@siteconnect.local");

    await expect(
      fieldOperationsService.saveDpr(
        { ...validInput(siteUser), photos: [] },
        siteUser,
        "submitted",
      ),
    ).rejects.toThrow("Attach at least one site photo before submitting DPR.");

    await expect(
      fieldOperationsService.saveDpr(
        { ...validInput(siteUser), reportDate: "2099-01-01" },
        siteUser,
        "draft",
      ),
    ).rejects.toThrow("DPR date cannot be in the future.");
  });

  it("blocks accounts users from saving and allows managers to review", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const accountsUser = userByEmail("accounts@siteconnect.local");
    const manager = userByEmail("manager@siteconnect.local");

    await expect(
      fieldOperationsService.saveDpr(validInput(accountsUser), accountsUser, "draft"),
    ).rejects.toThrow("You do not have permission to save DPR.");

    const report = await fieldOperationsService.saveDpr(
      validInput(siteUser),
      siteUser,
      "submitted",
    );
    const reviewed = await fieldOperationsService.reviewDpr(
      report.id,
      manager,
      "reviewed",
      "Accepted.",
    );

    expect(reviewed.status).toBe("reviewed");
    expect(reviewed.reviewedBy).toBe(manager.id);
  });
});
