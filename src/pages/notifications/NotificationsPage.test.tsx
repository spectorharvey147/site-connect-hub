import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthContext } from "@/context/authContextValue";
import { NotificationsPage } from "@/pages/notifications/NotificationsPage";

vi.mock("@/services/notificationService", () => ({
  notificationService: {
    listNotifications: vi.fn().mockResolvedValue([]),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    markAllRead: vi.fn().mockResolvedValue(undefined),
    markRead: vi.fn().mockResolvedValue(undefined),
  },
}));

const user = {
  id: "user-1", employeeId: "E1", fullName: "Test User",
  email: "test@example.com", role: "site_staff" as const,
  status: "active" as const, projectIds: [],
};

describe("NotificationsPage", () => {
  it("renders an empty state instead of a blank page", async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={{
          user, session: null, loading: false,
          login: vi.fn(), logout: vi.fn(), createInitialAdmin: vi.fn(),
          refreshSession: vi.fn(),
        }}>
          <NotificationsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(await screen.findByText("No notifications yet.")).toBeVisible();
    expect(screen.getByText("Important updates, approvals and messages will appear here.")).toBeVisible();
  });
});
