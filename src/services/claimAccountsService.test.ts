import { describe, expect, it } from "vitest";

import { validateAccountsVerification } from "@/services/claimAccountsService";

const input = {
  claimId: "claim-1",
  payableAmount: 900,
  paymentPriority: "normal" as const,
  requiresSapExport: false,
  accountsRemarks: "Bill shortfall",
  confirmed: true,
};

describe("claim Accounts verification", () => {
  it("calculates the deduction from the immutable final-approved amount", () => {
    expect(validateAccountsVerification(1000, input)).toBe(100);
  });

  it("blocks payable amounts above final approval", () => {
    expect(() => validateAccountsVerification(1000, { ...input, payableAmount: 1001 }))
      .toThrow("cannot exceed");
  });

  it("requires remarks for a reduction", () => {
    expect(() => validateAccountsVerification(1000, { ...input, accountsRemarks: "" }))
      .toThrow("remarks");
  });

  it("requires the explicit verification confirmation", () => {
    expect(() => validateAccountsVerification(1000, { ...input, confirmed: false }))
      .toThrow("Confirm");
  });
});
