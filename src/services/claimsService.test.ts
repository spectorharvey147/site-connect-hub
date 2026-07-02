import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import {
  COST_CODE_OPTIONS,
  EXPENSE_CATEGORIES,
  PROJECT_OPTIONS,
  claimsService,
} from "@/services/claimsService";
import type { AppUser } from "@/types/auth";
import type { ClaimInput, ClaimItem } from "@/types/claims";

function userByEmail(email: string): AppUser {
  const user = DEMO_USERS.find((item) => item.email === email);
  if (!user) {
    throw new Error(`Missing demo user ${email}`);
  }
  return toAppUser(user);
}

function makeClaimInput(): ClaimInput {
  const project = PROJECT_OPTIONS[0];
  const category = EXPENSE_CATEGORIES[0];
  const costCode = COST_CODE_OPTIONS.find((item) => item.projectId === project.id);

  if (!project || !category || !costCode) {
    throw new Error("Missing claim test constants.");
  }

  const item: ClaimItem = {
    id: crypto.randomUUID(),
    categoryId: category.id,
    categoryName: category.name,
    projectId: project.id,
    projectName: project.name,
    costCodeId: costCode.id,
    costCode: costCode.code,
    description: "Taxi fare to project site",
    billType: "without_bill",
    amount: 900,
    expenseDate: "2026-06-20",
  };

  return {
    title: "Site travel reimbursement",
    projectId: project.id,
    periodFrom: "2026-06-20",
    periodTo: "2026-06-20",
    remarks: "Submitted from workflow test.",
    items: [item],
    attachments: [],
  };
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

describe("claimsService workflow", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    claimsService.resetDemoData();
  });

  it("moves a submitted claim through admin verification into manager approval", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const admin = userByEmail("admin@siteconnect.local");
    const claim = await claimsService.submitClaim(makeClaimInput(), siteUser);

    expect(claim.status).toBe("admin_verification_pending");

    const reviewed = await claimsService.reviewClaim(
      {
        claimId: claim.id,
        stage: "admin_verification",
        decision: "approved",
        remarks: "Bills checked.",
      },
      admin,
    );

    expect(reviewed.status).toBe("manager_approval_pending");
    expect(reviewed.totalVerified).toBe(900);
    expect(reviewed.approvals).toHaveLength(2);
  });

  it("moves an HOD-final claim to Accounts after HOD approval", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const admin = userByEmail("admin@siteconnect.local");
    const manager = userByEmail("manager@siteconnect.local");
    const hod = userByEmail("hod.ops@siteconnect.local");
    const claim = await claimsService.submitClaim(makeClaimInput(), siteUser);
    await claimsService.reviewClaim({ claimId: claim.id, stage: "admin_verification", decision: "approved", remarks: "" }, admin);
    await claimsService.reviewClaim({ claimId: claim.id, stage: "manager_approval", decision: "approved", remarks: "" }, manager);
    const approved = await claimsService.reviewClaim({ claimId: claim.id, stage: "final_approval", decision: "approved", remarks: "" }, hod);
    expect(approved.status).toBe("accounts_verification_pending");

    const accounts = userByEmail("accounts@siteconnect.local");
    const verified = await claimsService.applyAccountsVerification(approved.id, accounts, {
      action: "verify",
      payableAmount: approved.totalApproved,
      paymentPriority: "normal",
      requiresSapExport: false,
      remarks: "Ready for settlement.",
    });
    expect(verified?.status).toBe("voucher_pending");
  });

  it("requires Super Admin after HOD for a high-value claim", async () => {
    const input = makeClaimInput();
    input.items[0].amount = 60000;
    const siteUser = userByEmail("site@siteconnect.local");
    const admin = userByEmail("admin@siteconnect.local");
    const manager = userByEmail("manager@siteconnect.local");
    const hod = userByEmail("hod.ops@siteconnect.local");
    const superAdmin = userByEmail("super@siteconnect.local");
    const claim = await claimsService.submitClaim(input, siteUser);
    await claimsService.reviewClaim({ claimId: claim.id, stage: "admin_verification", decision: "approved", remarks: "" }, admin);
    await claimsService.reviewClaim({ claimId: claim.id, stage: "manager_approval", decision: "approved", remarks: "" }, manager);
    const hodApproved = await claimsService.reviewClaim({ claimId: claim.id, stage: "final_approval", decision: "approved", remarks: "" }, hod);
    expect(hodApproved.status).toBe("final_approval_pending");
    const final = await claimsService.reviewClaim({ claimId: claim.id, stage: "final_approval", decision: "approved", remarks: "" }, superAdmin);
    expect(final.status).toBe("accounts_verification_pending");
  });
});
