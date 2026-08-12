import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendGmailMessage } from "../_shared/gmail-smtp.ts";
import { buildEmailContent } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = request.headers.get("Authorization") ?? "";
  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: caller } = await callerClient.auth.getUser();
  if (!caller.user) {
    return response(401, { error: "Unauthorized." });
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerProfile } = await admin
    .from("user_profiles")
    .select("organization_id, role_id")
    .eq("id", caller.user.id)
    .single();
  if (!callerProfile || !["admin_hr", "super_admin"].includes(callerProfile.role_id)) {
    return response(403, { error: "Admin permission is required." });
  }

  const input = await request.json();
  const { data: appSettings } = await admin.from("app_settings").select("notifications").eq("id", "default").maybeSingle();
  const configuredBaseUrl = String((appSettings?.notifications as { approvalBaseUrl?: string } | null)?.approvalBaseUrl ?? "").trim().replace(/\/$/, "");
  const applicationUrl = configuredBaseUrl || String(request.headers.get("origin") ?? "").replace(/\/$/, "");
  if (input.action === "resend_invite") {
    const userId = String(input.userId ?? "").trim();
    const { data: target } = await admin
      .from("user_profiles")
      .select("id, email, organization_id, status")
      .eq("id", userId)
      .eq("organization_id", callerProfile.organization_id)
      .maybeSingle();
    if (!target?.email) {
      return response(404, { error: "Invited user was not found." });
    }
    if (target.status !== "invited") {
      return response(400, { error: "Only invited users can receive a new setup link." });
    }
    const { error: inviteError } = await admin.auth.resetPasswordForEmail(target.email, {
      redirectTo: `${applicationUrl}/reset-password`,
    });
    if (inviteError) return response(400, { error: inviteError.message });
    return response(200, { message: "Invitation setup link resent." });
  }
  const email = String(input.email ?? "").trim().toLowerCase();
  const employeeCode = String(input.employeeCode ?? "").trim().toUpperCase();
  if (!email || !employeeCode || !input.firstName || !input.lastName || !input.departmentId) {
    return response(400, { error: "Required user fields are missing." });
  }
  let authUserId: string | undefined;
  try {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: input.password || crypto.randomUUID() + "Aa1!",
      email_confirm: Boolean(input.password),
      user_metadata: {
        full_name: `${input.firstName} ${input.lastName}`.trim(),
        invite_required: !input.password,
      },
    });
    if (authError || !authData.user) {
      throw authError ?? new Error("Unable to create Auth user.");
    }
    authUserId = authData.user.id;
    const { error: profileError } = await admin.from("user_profiles").insert({
      id: authUserId,
      organization_id: callerProfile.organization_id,
      employee_id: employeeCode,
      employee_code: employeeCode,
      first_name: input.firstName,
      last_name: input.lastName,
      full_name: `${input.firstName} ${input.lastName}`.trim(),
      email,
      phone: input.phone || null,
      role_id: input.role,
      department_id: input.departmentId,
      designation_id: input.designationId || null,
      reporting_manager_id: input.reportingManagerId || null,
      manager_id: input.reportingManagerId || null,
      hod_user_id: input.hodUserId || null,
      primary_project_id: input.primaryProjectId || null,
      employment_type: input.employmentType || "permanent",
      joining_date: input.joiningDate || null,
      status: input.password ? "active" : "invited",
      created_by: caller.user.id,
      updated_by: caller.user.id,
    });
    if (profileError) throw profileError;

    const projectIds = Array.from(
      new Set([input.primaryProjectId, ...(input.projectIds ?? [])].filter(Boolean)),
    );
    if (projectIds.length) {
      const { error: assignmentError } = await admin
        .from("user_project_assignments")
        .insert(
          projectIds.map((projectId: string) => ({
            organization_id: callerProfile.organization_id,
            user_id: authUserId,
            project_id: projectId,
            department_id: input.departmentId,
            assignment_type:
              projectId === input.primaryProjectId ? "primary" : "secondary",
            start_date: input.joiningDate || new Date().toISOString().slice(0, 10),
            status: "active",
            created_by: caller.user.id,
            updated_by: caller.user.id,
          })),
        );
      if (assignmentError) throw assignmentError;
    }
    if (!input.password) {
      const { error: inviteError } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo: `${applicationUrl}/reset-password`,
      });
      if (inviteError) throw inviteError;
    }
    if (input.password) try {
      const title = "Your Site Connect account is ready";
      const setupUrl = `${applicationUrl}/login`;
      const content = buildEmailContent(
        "user_created",
        `${input.firstName} ${input.lastName}`.trim(),
        title,
        `Your account ${email} has been created. Open Site Connect: ${setupUrl}`,
      );
      const messageId = await sendGmailMessage({ to: email, subject: title, ...content });
      const { data: notification } = await admin.from("notifications").insert({
        user_id: authUserId, type: "user_created", title,
        message: `Account created. Application: ${setupUrl}`,
        related_id: authUserId, related_type: "user_profile",
      }).select("id").single();
      await admin.from("notification_deliveries").insert({
        organization_id: callerProfile.organization_id, notification_id: notification?.id ?? null,
        recipient_user_id: authUserId, channel: "email", recipient_address: email,
        status: "sent", provider_message_id: messageId, attempts: 1,
      });
    } catch (emailError) {
      await admin.from("audit_logs").insert({ user_id: caller.user.id, action: "users.welcome_email_failed", entity_type: "user_profile", entity_id: authUserId,
        new_values: { email, error: emailError instanceof Error ? emailError.message : "Welcome email failed" } });
    }
    return response(201, { id: authUserId });
  } catch (error) {
    if (authUserId) await admin.auth.admin.deleteUser(authUserId);
    return response(400, {
      error: error instanceof Error ? error.message : "User provisioning failed.",
    });
  }
});

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
