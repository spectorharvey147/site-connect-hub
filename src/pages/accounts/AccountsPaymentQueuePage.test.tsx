import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthContext } from "@/context/authContextValue";
import { AccountsPaymentQueuePage } from "@/pages/accounts/AccountsPaymentQueuePage";

vi.mock("@/services/claimsService", () => ({
  claimsService: {
    listApprovalQueue: vi.fn().mockResolvedValue([]),
    listVouchers: vi.fn().mockResolvedValue([]),
  },
}));

const user = {
  id: "accounts-1", employeeId: "A1", fullName: "Accounts User",
  email: "accounts@example.com", role: "accounts_officer" as const,
  status: "active" as const, projectIds: [],
};

describe("AccountsPaymentQueuePage", () => {
  it("contains payment actions and no claim approval action", async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={{
          user, session: null, loading: false,
          login: vi.fn(), logout: vi.fn(), createInitialAdmin: vi.fn(),
          refreshSession: vi.fn(),
        }}>
          <AccountsPaymentQueuePage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Accounts Payment Queue")).toBeVisible();
    expect(screen.queryByText("Approve Claim")).not.toBeInTheDocument();
  });
});
