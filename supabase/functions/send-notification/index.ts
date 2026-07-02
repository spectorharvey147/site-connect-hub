import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getGmailSmtpStatus,
  sendGmailMessage,
} from "../_shared/gmail-smtp.ts";
import { buildEmailContent } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supportedEmailEvents = new Set([
  "claim_submitted",
  "claim_approved",
  "claim_rejected",
  "claim_changes_requested",
  "claim_admin_verification_required",
  "claim_manager_approval_required",
  "claim_final_approval_required",
  "claim_accounts_verification_required",
  "claim_accounts_returned",
  "claim_voucher_ready",
  "claim_sap_export_required",
  "claim_payment_required",
  "claim_payment_partial",
  "claim_action_required",
  "leave_submitted",
  "leave_approved",
  "leave_rejected",
  "task_assigned",
  "dpr_submitted",
  "material_request_submitted",
  "vendor_bill_submitted",
  "vendor_bill_approved",
  "voucher_generated",
  "payment_processed",
  "message_mention",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    return json({ error: "Supabase server configuration is incomplete." }, 500);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: caller, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller.user) return json({ error: "Unauthorized." }, 401);

  const admin = createClient(url, serviceKey);
  const { data: callerProfile } = await admin
    .from("user_profiles")
    .select("id,organization_id,email,full_name,role_id")
    .eq("id", caller.user.id)
    .single();
  if (!callerProfile) return json({ error: "Caller profile was not found." }, 403);

  const body = await request.json();
  if (body.action === "smtp-status") {
    if (callerProfile.role_id !== "super_admin") {
      return json({ error: "Only Super Admin can view SMTP status." }, 403);
    }
    const smtp = getGmailSmtpStatus();
    return json({
      ...smtp,
      user: smtp.user ? smtp.user.replace(/(^.).*(@.*$)/, "$1***$2") : null,
    });
  }

  if (body.action === "test-email") {
    if (callerProfile.role_id !== "super_admin") {
      return json({ error: "Only Super Admin can send a test email." }, 403);
    }
    if (!callerProfile.email) return json({ error: "Your profile has no email address." }, 400);
    try {
      const content = buildEmailContent(
        "smtp_test",
        callerProfile.full_name || "Administrator",
        "Site Connect Gmail SMTP test",
        "Your Gmail SMTP configuration is working.",
      );
      const messageId = await sendGmailMessage({
        to: callerProfile.email,
        subject: "Site Connect Gmail SMTP test",
        ...content,
      });
      await admin.from("audit_logs").insert({
        user_id: callerProfile.id,
        action: "email.smtp_test_sent",
        entity_type: "email_settings",
        new_values: { recipient: callerProfile.email, messageId },
      });
      return json({ success: true, recipient: callerProfile.email });
    } catch (error) {
      await admin.from("audit_logs").insert({
        user_id: callerProfile.id,
        action: "email.smtp_test_failed",
        entity_type: "email_settings",
        new_values: {
          recipient: callerProfile.email,
          error: error instanceof Error ? error.message : "SMTP test failed.",
        },
      });
      return json(
        { error: error instanceof Error ? error.message : "SMTP test failed." },
        503,
      );
    }
  }

  if (!body.userId || !body.type || !body.title) {
    return json({ error: "Recipient, type and title are required." }, 400);
  }
  const { data: recipient } = await admin
    .from("user_profiles")
    .select("organization_id,email,full_name")
    .eq("id", body.userId)
    .single();
  if (!recipient || callerProfile.organization_id !== recipient.organization_id) {
    return json({ error: "Recipient is outside your organization." }, 403);
  }

  const { data: notification, error: notificationError } = await admin
    .from("notifications")
    .insert({
      user_id: body.userId,
      type: body.type,
      title: body.title,
      message: body.message ?? null,
      related_id: body.relatedId ?? null,
      related_type: body.relatedType ?? null,
    })
    .select("id")
    .single();
  if (notificationError) return json({ error: notificationError.message }, 400);

  const { data: settings } = await admin
    .from("app_settings")
    .select("notifications")
    .eq("id", "default")
    .maybeSingle();
  const notificationSettings = (settings?.notifications ?? {}) as {
    emailEnabled?: boolean;
    emailEvents?: Record<string, boolean>;
  };
  const eventEnabled =
    !supportedEmailEvents.has(body.type) ||
    notificationSettings.emailEvents?.[body.type] !== false;
  if (
    notificationSettings.emailEnabled === false ||
    !eventEnabled ||
    !recipient.email
  ) {
    return json({ success: true, emailStatus: "disabled" }, 201);
  }

  const { data: delivery, error: deliveryError } = await admin
    .from("notification_deliveries")
    .insert({
      organization_id: recipient.organization_id,
      notification_id: notification.id,
      recipient_user_id: body.userId,
      channel: "email",
      recipient_address: recipient.email,
      status: "pending",
      attempts: 0,
      next_retry_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (deliveryError || !delivery) {
    return json({ success: true, emailStatus: "queue_failed" }, 201);
  }

  try {
    const content = buildEmailContent(
      body.type,
      recipient.full_name || "there",
      body.title,
      body.message,
    );
    const messageId = await sendGmailMessage({
      to: recipient.email,
      subject: body.title,
      ...content,
    });
    await admin.from("notification_deliveries").update({
      status: "sent",
      attempts: 1,
      provider_message_id: messageId,
      last_error: null,
      next_retry_at: null,
    }).eq("id", delivery.id);
    return json({ success: true, emailStatus: "sent" }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail SMTP delivery failed.";
    await admin.from("notification_deliveries").update({
      status: "failed",
      attempts: 1,
      last_error: message,
      next_retry_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }).eq("id", delivery.id);
    return json({ success: true, emailStatus: "queued", emailError: message }, 201);
  }
});
