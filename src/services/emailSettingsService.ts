import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";

export const EMAIL_NOTIFICATION_EVENTS = [
  ["claim_submitted", "Claim submitted"],
  ["claim_approved", "Claim approved"],
  ["claim_rejected", "Claim rejected"],
  ["claim_changes_requested", "Claim changes requested"],
  ["claim_admin_verification_required", "Admin/HR verification required"],
  ["claim_manager_approval_required", "Manager approval required"],
  ["claim_final_approval_required", "Final approval required"],
  ["claim_accounts_verification_required", "Accounts verification required"],
  ["claim_accounts_returned", "Claim returned by Accounts"],
  ["claim_voucher_ready", "Voucher generation required"],
  ["claim_sap_export_required", "SAP export required"],
  ["claim_payment_required", "Claim payment required"],
  ["claim_payment_partial", "Claim partially paid"],
  ["claim_action_required", "Secure claim action required"],
  ["leave_submitted", "Leave submitted"],
  ["leave_approved", "Leave approved"],
  ["leave_rejected", "Leave rejected"],
  ["task_assigned", "Task assigned"],
  ["dpr_submitted", "DPR submitted"],
  ["material_request_submitted", "Material request submitted"],
  ["vendor_bill_submitted", "Vendor bill submitted"],
  ["vendor_bill_approved", "Vendor bill approved"],
  ["voucher_generated", "Voucher generated"],
  ["payment_processed", "Payment processed"],
  ["message_mention", "Message mention"],
] as const;

export interface SmtpStatus {
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  fromName: string;
  fromAddress: string | null;
  missingSecrets: string[];
}

export function describeSmtpConfiguration(
  values: Record<string, string | undefined>,
): SmtpStatus {
  const user = values.GMAIL_SMTP_USER?.trim() || null;
  const password = values.GMAIL_SMTP_APP_PASSWORD?.trim() || null;
  const fromAddress = values.EMAIL_FROM_ADDRESS?.trim() || user;
  const missingSecrets = [
    !user ? "GMAIL_SMTP_USER" : null,
    !password ? "GMAIL_SMTP_APP_PASSWORD" : null,
    !fromAddress ? "EMAIL_FROM_ADDRESS" : null,
  ].filter((value): value is string => Boolean(value));
  return {
    configured: missingSecrets.length === 0,
    host: values.GMAIL_SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(values.GMAIL_SMTP_PORT || "587"),
    secure: values.GMAIL_SMTP_SECURE?.toLowerCase() === "true",
    user,
    fromName: values.EMAIL_FROM_NAME?.trim() || "Site Connect",
    fromAddress,
    missingSecrets,
  };
}

const demoStatus = describeSmtpConfiguration({});

async function invoke(body: Record<string, unknown>) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke("send-notification", {
    body,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export const emailSettingsService = {
  async getSmtpStatus(actor: AppUser): Promise<SmtpStatus> {
    if (actor.role !== "super_admin") {
      throw new Error("Only Super Admin can view SMTP status.");
    }
    if (!isSupabaseConfigured) return demoStatus;
    return invoke({ action: "smtp-status" }) as Promise<SmtpStatus>;
  },

  async sendTestEmail(actor: AppUser) {
    if (actor.role !== "super_admin") {
      throw new Error("Only Super Admin can send a test email.");
    }
    if (!isSupabaseConfigured) {
      throw new Error(
        "Gmail SMTP is available after Supabase is configured and the Edge Function secrets are set.",
      );
    }
    return invoke({ action: "test-email" }) as Promise<{
      success: boolean;
      recipient: string;
    }>;
  },
};
