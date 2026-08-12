import { describe, expect, it } from "vitest";

import { canAddEmployeeAdvance, canGenerateVoucher, canRecordPayment, canVerifyClaimAsAccounts } from "@/permissions/accountsPermissions";
import {
  canApproveClaimAsHod,
  canApproveClaimAsManager,
  canApproveClaimAsMaster,
  canUseMasterIntervention,
  canVerifyClaimAsAdmin,
  canViewClaim,
} from "@/permissions/claimPermissions";
import type { AppUser } from "@/types/auth";
import type { Claim } from "@/types/claims";

function user(role: AppUser["role"], overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: `${role}-id`,
    employeeId: `${role}-emp`,
    fullName: role,
    email: `${role}@example.com`,
    role,
    status: "active",
    projectIds: [],
    ...overrides,
  };
}

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: "claim-1",
    claimNumber: "SC-1",
    title: "Travel",
    userId: "employee-id",
    userName: "Employee",
    userEmail: "employee@example.com",
    projectId: "project-1",
    projectName: "Project",
    periodFrom: "2026-07-01",
    periodTo: "2026-07-02",
    status: "admin_verification_pending",
    items: [],
    attachments: [],
    approvals: [],
    totalClaimed: 100,
    totalVerified: 100,
    totalApproved: 100,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 1 centralized permissions", () => {
  it("allows Super Admin to view every claim but not normal operational actions", () => {
    const superAdmin = user("super_admin");
    const normalClaim = claim({
      status: "admin_verification_pending",
      reportingManagerId: "manager-id",
      hodUserId: "hod-id",
    });

    expect(canViewClaim(superAdmin, normalClaim)).toBe(true);
    expect(canVerifyClaimAsAdmin(superAdmin, normalClaim)).toBe(false);
    expect(canApproveClaimAsManager(superAdmin, { ...normalClaim, status: "manager_approval_pending" })).toBe(false);
    expect(canApproveClaimAsHod(superAdmin, { ...normalClaim, status: "hod_approval_pending" })).toBe(false);
    expect(canVerifyClaimAsAccounts(superAdmin, { ...normalClaim, status: "accounts_verification_pending" })).toBe(false);
    expect(canGenerateVoucher(superAdmin, { ...normalClaim, status: "voucher_pending" })).toBe(false);
    expect(canAddEmployeeAdvance(superAdmin)).toBe(false);
    expect(canRecordPayment(superAdmin, { ...normalClaim, status: "payment_pending" })).toBe(false);
  });

  it("allows Super Admin only for explicit Master Approval and Master Intervention", () => {
    const superAdmin = user("super_admin");
    const masterClaim = claim({
      status: "final_approval_pending",
      approvalPath: [
        { id: "1", sequence: 1, role: "admin", label: "Admin", source: "matrix" },
        { id: "2", sequence: 2, role: "manager", label: "Manager", source: "matrix" },
        { id: "3", sequence: 3, role: "hod", label: "HOD", source: "matrix" },
        { id: "4", sequence: 4, role: "super_admin", label: "Super Admin", source: "matrix" },
        { id: "5", sequence: 5, role: "accounts", label: "Accounts", source: "matrix" },
      ],
    });
    const fallbackClaim = claim({ status: "final_approval_pending", approvalPath: [] });

    expect(canApproveClaimAsMaster(superAdmin, masterClaim)).toBe(true);
    expect(canApproveClaimAsMaster(superAdmin, fallbackClaim)).toBe(false);
    expect(canUseMasterIntervention(superAdmin, masterClaim)).toBe(true);
  });

  it("restricts Admin, Manager, HOD and Accounts actions to the assigned stage", () => {
    const admin = user("admin_hr");
    const manager = user("manager", { id: "manager-id", projectIds: ["project-1"] });
    const hod = user("hod", { id: "hod-id", departmentId: "dept-1" });
    const accounts = user("accounts_officer");

    expect(canVerifyClaimAsAdmin(admin, claim())).toBe(true);
    expect(canVerifyClaimAsAdmin(admin, claim({ status: "manager_approval_pending" }))).toBe(false);
    expect(canApproveClaimAsManager(manager, claim({ status: "manager_approval_pending", reportingManagerId: "manager-id" }))).toBe(true);
    expect(canApproveClaimAsManager(manager, claim({ status: "manager_approval_pending", reportingManagerId: "other", projectId: "other" }))).toBe(false);
    expect(canApproveClaimAsHod(hod, claim({ status: "hod_approval_pending", departmentId: "dept-1" }))).toBe(true);
    expect(canApproveClaimAsHod(hod, claim({ status: "hod_approval_pending", departmentId: "other", projectId: "other" }))).toBe(false);
    expect(canVerifyClaimAsAccounts(accounts, claim({ status: "accounts_verification_pending" }))).toBe(true);
    expect(canGenerateVoucher(accounts, claim({ status: "voucher_pending" }))).toBe(true);
    expect(canRecordPayment(accounts, claim({ status: "payment_pending" }))).toBe(true);
  });
}
);
