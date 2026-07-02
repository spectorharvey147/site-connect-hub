import { describe, expect, it } from "vitest";

import { claimStageNotification } from "@/services/claimNotificationWorkflow";
import { EMAIL_NOTIFICATION_EVENTS } from "@/services/emailSettingsService";

describe("claim notification workflow", () => {
  it.each([
    ["admin_verification_pending", "admin", "claim_admin_verification_required"],
    ["manager_approval_pending", "manager", "claim_manager_approval_required"],
    ["final_approval_pending", "final", "claim_final_approval_required"],
    ["accounts_verification_pending", "accounts", "claim_accounts_verification_required"],
    ["voucher_pending", "accounts", "claim_voucher_ready"],
    ["sap_export_pending", "accounts", "claim_sap_export_required"],
    ["payment_pending", "accounts", "claim_payment_required"],
    ["partially_paid", "employee", "claim_payment_partial"],
    ["paid", "employee", "payment_processed"],
    ["rejected", "employee", "claim_rejected"],
    ["changes_requested", "employee", "claim_changes_requested"],
    ["accounts_returned", "employee", "claim_accounts_returned"],
  ] as const)("routes %s to %s", (status, audience, event) => {
    expect(claimStageNotification(status)).toMatchObject({ audience, event });
  });

  it("does not send workflow mail for a draft", () => {
    expect(claimStageNotification("draft")).toBeNull();
  });

  it("exposes every stage event in notification settings", () => {
    const configured = new Set<string>(EMAIL_NOTIFICATION_EVENTS.map(([event]) => event));
    const statuses = [
      "admin_verification_pending", "manager_approval_pending", "final_approval_pending",
      "accounts_verification_pending", "voucher_pending", "sap_export_pending",
      "payment_pending", "partially_paid", "paid", "rejected", "changes_requested",
      "accounts_returned",
    ] as const;
    statuses.forEach((status) => {
      expect(configured.has(claimStageNotification(status)!.event)).toBe(true);
    });
  });
});
