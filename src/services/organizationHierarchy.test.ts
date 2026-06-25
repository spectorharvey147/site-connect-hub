import { beforeEach, describe, expect, it } from "vitest";

import {
  DEMO_DEPARTMENT_IDS,
  DEMO_ORGANIZATION_ID,
  DEMO_USERS,
  toAppUser,
} from "@/constants/demoData";
import { approvalMatrixService } from "@/services/approvalMatrixService";
import { delegationService } from "@/services/delegationService";
import { departmentService } from "@/services/departmentService";
import { organizationService } from "@/services/organizationService";
import { userHierarchyService } from "@/services/userHierarchyService";

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

const superAdmin = toAppUser(
  DEMO_USERS.find((item) => item.email === "super@siteconnect.local")!,
);
const admin = toAppUser(
  DEMO_USERS.find((item) => item.email === "admin@siteconnect.local")!,
);
const siteUser = toAppUser(
  DEMO_USERS.find((item) => item.email === "site@siteconnect.local")!,
);
const manager = toAppUser(
  DEMO_USERS.find((item) => item.email === "manager@siteconnect.local")!,
);

describe("organization hierarchy and approval matrix", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    departmentService.resetDemoData();
    userHierarchyService.resetDemoData();
    approvalMatrixService.resetDemoData();
    delegationService.resetDemoData();
  });

  it("creates an organization and department, then assigns an active HOD", async () => {
    const organization = await organizationService.createOrganization(
      {
        organizationCode: "QA",
        organizationName: "QA Projects",
        currency: "INR",
        timezone: "Asia/Kolkata",
      },
      superAdmin,
    );

    const department = await departmentService.createDepartment(
      {
        organizationId: organization.id,
        departmentCode: "QAC",
        departmentName: "Quality Control",
      },
      admin,
    );
    const updated = await departmentService.assignDepartmentHod(
      department.id,
      "00000000-0000-4000-8000-000000000008",
      admin,
    );

    expect(organization.organizationName).toBe("QA Projects");
    expect(updated.hodUserId).toBe("00000000-0000-4000-8000-000000000008");
  });

  it("prevents self-reporting and circular manager hierarchy", async () => {
    await expect(
      userHierarchyService.updateReportingManager(siteUser.id, siteUser.id, admin),
    ).rejects.toThrow("User cannot report to themselves.");

    await expect(
      userHierarchyService.updateReportingManager(
        "00000000-0000-4000-8000-000000000008",
        siteUser.id,
        admin,
      ),
    ).rejects.toThrow("Circular reporting hierarchy is not allowed.");
  });

  it("resolves claim and leave approval paths from hierarchy and matrix", async () => {
    const claimPath = await approvalMatrixService.resolveApprovalPath({
      organizationId: DEMO_ORGANIZATION_ID,
      workflowType: "claim",
      requesterUserId: siteUser.id,
      departmentId: DEMO_DEPARTMENT_IDS.operations,
      amount: 12000,
    });
    const leavePath = await approvalMatrixService.resolveApprovalPath({
      organizationId: DEMO_ORGANIZATION_ID,
      workflowType: "leave",
      requesterUserId: siteUser.id,
      departmentId: DEMO_DEPARTMENT_IDS.operations,
      leaveDays: 5,
    });

    expect(claimPath.steps.map((step) => step.role)).toEqual([
      "admin",
      "manager",
      "hod",
      "accounts",
    ]);
    expect(leavePath.steps.map((step) => step.role)).toEqual(["manager", "hod"]);
  });

  it("applies active delegation while resolving an approval path", async () => {
    await delegationService.createDelegation(
      {
        organizationId: DEMO_ORGANIZATION_ID,
        fromUserId: manager.id,
        delegatedToUserId: admin.id,
        workflowType: "claim",
        startDate: "2020-01-01",
        endDate: "2099-01-01",
        reason: "Manager travel",
      },
      superAdmin,
    );

    const claimPath = await approvalMatrixService.resolveApprovalPath({
      organizationId: DEMO_ORGANIZATION_ID,
      workflowType: "claim",
      requesterUserId: siteUser.id,
      departmentId: DEMO_DEPARTMENT_IDS.operations,
      amount: 12000,
    });
    const managerStep = claimPath.steps.find((step) => step.role === "manager");

    expect(managerStep?.delegatedFromUserId).toBe(manager.id);
    expect(managerStep?.userId).toBe(admin.id);
  });
});
