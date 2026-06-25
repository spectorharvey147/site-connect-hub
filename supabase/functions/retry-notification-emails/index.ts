import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendGmailMessage } from "../_shared/gmail-smtp.ts";
import { buildEmailContent } from "../_shared/email-templates.ts";

Deno.serve(async (request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: deliveries, error } = await admin
    .from("notification_deliveries")
    .select(
      "id,attempts,recipient_address,notifications(type,title,message),user_profiles!notification_deliveries_recipient_user_id_fkey(full_name)",
    )
    .in("status", ["pending", "failed"])
    .lte("next_retry_at", new Date().toISOString())
    .lt("attempts", 5)
    .limit(50);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  for (const delivery of deliveries ?? []) {
    const notification = delivery.notifications as unknown as {
      title: string;
      type: string;
      message: string | null;
    };
    const profile = delivery.user_profiles as unknown as { full_name: string };
    const content = buildEmailContent(
      notification.type,
      profile.full_name,
      notification.title,
      notification.message,
    );
    const attempts = Number(delivery.attempts) + 1;
    try {
      const messageId = await sendGmailMessage({
        to: delivery.recipient_address,
        subject: notification.title,
        ...content,
      });
      await admin.from("notification_deliveries").update({
        status: "sent",
        attempts,
        provider_message_id: messageId,
        last_error: null,
        next_retry_at: null,
      }).eq("id", delivery.id);
      sent += 1;
    } catch (sendError) {
      await admin.from("notification_deliveries").update({
        status: "failed",
        attempts,
        last_error:
          sendError instanceof Error ? sendError.message : "Gmail SMTP delivery failed.",
        next_retry_at: new Date(
          Date.now() + Math.min(60, 2 ** attempts * 5) * 60_000,
        ).toISOString(),
      }).eq("id", delivery.id);
    }
  }

  return new Response(JSON.stringify({ processed: deliveries?.length ?? 0, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
