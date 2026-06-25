import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import {
  calculateLabourCostSummary,
  casualLabourService,
} from "@/services/casualLabourService";
import type { AppUser } from "@/types/auth";
import type { LabourAttendanceInput } from "@/types/casualLabour";

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

function validInput(): LabourAttendanceInput {
  const workers = casualLabourService.listWorkers();
  const male = workers.find((worker) => worker.category === "male") ?? workers[0];
  const female =
    workers.find((worker) => worker.category === "female") ?? workers[1] ?? workers[0];

  return {
    projectId: "project-metro",
    vendorId: "vendor-shakti-labour",
    date: today(),
    rows: [
      {
        id: "labour-row-test-001",
        workerId: male.id,
        workerCode: male.labourCode,
        workerName: male.fullName,
        category: male.category,
        startTime: "09:00",
        endTime: "18:00",
        status: "present",
        dailyRate: 700,
        overtimeHours: 2,
        overtimeRate: 100,
        remarks: "",
      },
      {
        id: "labour-row-test-002",
        workerId: female.id,
        workerCode: female.labourCode,
        workerName: female.fullName,
        category: female.category,
        startTime: "09:00",
        endTime: "13:00",
        status: "half_day",
        dailyRate: 650,
        overtimeHours: 0,
        overtimeRate: 100,
        remarks: "",
      },
    ],
    allocation: {
      workArea: "Pier P12",
      workDescription: "Shuttering support.",
      maleAllocated: 1,
      femaleAllocated: 1,
      supervisorAllocated: 0,
    },
  };
}

describe("casualLabourService workflow", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    casualLabourService.resetDemoData();
  });

  it("creates a worker and calculates labour cost", async () => {
    const siteUser = userByEmail("site@siteconnect.local");

    const worker = await casualLabourService.createWorker(
      {
        fullName: "Ramesh Test",
        category: "male",
        vendorId: "vendor-shakti-labour",
        defaultDailyRate: 720,
      },
      siteUser,
    );

    const cost = calculateLabourCostSummary({ rows: validInput().rows });

    expect(worker.labourCode).toBe("CL-2026-0004");
    expect(cost.totalCost).toBe(1225);
    expect(cost.overtimeHours).toBe(2);
  });

  it("calculates count-based labour with allowance and deduction", () => {
    const cost = calculateLabourCostSummary({
      rows: [
        {
          id: "count-row-1",
          entryMode: "count_based",
          workerId: "",
          workerCode: "",
          workerName: "Kumar local gang",
          category: "male",
          gender: "male",
          skillType: "unskilled",
          workerCount: 5,
          startTime: "09:00",
          endTime: "18:00",
          status: "present",
          dailyRate: 700,
          overtimeHours: 1,
          overtimeRate: 120,
          allowance: 20,
          deduction: 10,
        },
      ],
    });

    expect(cost.workerCount).toBe(5);
    expect(cost.baseCost).toBe(3500);
    expect(cost.overtimeCost).toBe(600);
    expect(cost.allowance).toBe(100);
    expect(cost.deduction).toBe(50);
    expect(cost.totalCost).toBe(4150);
  });

  it("validates attendance permissions and dates", async () => {
    const accountsUser = userByEmail("accounts@siteconnect.local");
    const siteUser = userByEmail("site@siteconnect.local");

    await expect(
      casualLabourService.saveAttendance(validInput(), accountsUser, "draft"),
    ).rejects.toThrow("You do not have permission to save labour attendance.");

    await expect(
      casualLabourService.saveAttendance(
        { ...validInput(), date: "2099-01-01" },
        siteUser,
        "draft",
      ),
    ).rejects.toThrow("Labour attendance date cannot be in the future.");
  });

  it("submits and approves labour attendance", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const manager = userByEmail("manager@siteconnect.local");

    const record = await casualLabourService.saveAttendance(
      validInput(),
      siteUser,
      "submitted",
    );
    const approved = await casualLabourService.approveAttendance(
      record.id,
      manager,
    );

    expect(record.attendanceNumber).toBe("LAB-2026-0002");
    expect(approved.status).toBe("approved");
    expect(approved.approvedBy).toBe(manager.id);
  });
});
