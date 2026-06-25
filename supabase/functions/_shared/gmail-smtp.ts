import nodemailer from "npm:nodemailer@6.9.16";

export interface GmailSmtpStatus {
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  fromName: string;
  fromAddress: string | null;
  missingSecrets: string[];
}

function readBoolean(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function getGmailSmtpStatus(): GmailSmtpStatus {
  const host = Deno.env.get("GMAIL_SMTP_HOST")?.trim() || "smtp.gmail.com";
  const port = Number(Deno.env.get("GMAIL_SMTP_PORT") || "587");
  const secure = readBoolean(Deno.env.get("GMAIL_SMTP_SECURE"));
  const user = Deno.env.get("GMAIL_SMTP_USER")?.trim() || null;
  const password = Deno.env.get("GMAIL_SMTP_APP_PASSWORD")?.trim() || null;
  const fromName = Deno.env.get("EMAIL_FROM_NAME")?.trim() || "Site Connect";
  const fromAddress =
    Deno.env.get("EMAIL_FROM_ADDRESS")?.trim() || user || null;
  const missingSecrets = [
    !user ? "GMAIL_SMTP_USER" : null,
    !password ? "GMAIL_SMTP_APP_PASSWORD" : null,
    !fromAddress ? "EMAIL_FROM_ADDRESS" : null,
  ].filter((value): value is string => Boolean(value));

  return {
    configured: missingSecrets.length === 0,
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    user,
    fromName,
    fromAddress,
    missingSecrets,
  };
}

export async function sendGmailMessage(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const status = getGmailSmtpStatus();
  if (!status.configured) {
    throw new Error(
      `Gmail SMTP secrets are missing: ${status.missingSecrets.join(", ")}.`,
    );
  }

  const transporter = nodemailer.createTransport({
    host: status.host,
    port: status.port,
    secure: status.secure,
    auth: {
      user: Deno.env.get("GMAIL_SMTP_USER")!,
      pass: Deno.env.get("GMAIL_SMTP_APP_PASSWORD")!,
    },
  });
  const result = await transporter.sendMail({
    from: `"${status.fromName.replaceAll('"', "")}" <${status.fromAddress}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  return String(result.messageId || "");
}
