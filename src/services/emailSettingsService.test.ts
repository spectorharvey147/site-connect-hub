import { describe, expect, it } from "vitest";

import {
  EMAIL_NOTIFICATION_EVENTS,
  describeSmtpConfiguration,
} from "@/services/emailSettingsService";

describe("Gmail SMTP settings", () => {
  it("reports missing secrets without exposing a password", () => {
    const status = describeSmtpConfiguration({});

    expect(status.configured).toBe(false);
    expect(status.missingSecrets).toContain("GMAIL_SMTP_USER");
    expect(status.missingSecrets).toContain("GMAIL_SMTP_APP_PASSWORD");
    expect(status).not.toHaveProperty("password");
  });

  it("supports Gmail STARTTLS and SSL modes", () => {
    const startTls = describeSmtpConfiguration({
      GMAIL_SMTP_USER: "siteconnect@gmail.com",
      GMAIL_SMTP_APP_PASSWORD: "app-password",
      EMAIL_FROM_ADDRESS: "siteconnect@gmail.com",
      GMAIL_SMTP_PORT: "587",
      GMAIL_SMTP_SECURE: "false",
    });
    const ssl = describeSmtpConfiguration({
      GMAIL_SMTP_USER: "siteconnect@gmail.com",
      GMAIL_SMTP_APP_PASSWORD: "app-password",
      EMAIL_FROM_ADDRESS: "siteconnect@gmail.com",
      GMAIL_SMTP_PORT: "465",
      GMAIL_SMTP_SECURE: "true",
    });

    expect(startTls).toMatchObject({ configured: true, port: 587, secure: false });
    expect(ssl).toMatchObject({ configured: true, port: 465, secure: true });
  });

  it("covers every required notification event", () => {
    expect(EMAIL_NOTIFICATION_EVENTS).toHaveLength(25);
    expect(EMAIL_NOTIFICATION_EVENTS.map(([event]) => event)).toContain(
      "message_mention",
    );
  });
});
