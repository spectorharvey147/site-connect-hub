import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SetupInput = {
  organizationName: string;
  organizationCode?: string;
  legalName?: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeCode: string;
  password: string;
  supportEmail: string;
  supportPhone: string;
  currency: string;
  timezone: string;
  defaultWorkflow: "standard" | "manager_hod" | "amount_based";
};

function required(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server configuration is incomplete." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let authUserId: string | undefined;
  let organizationId: string | undefined;
  let lockAcquired = false;

  try {
    const input = (await request.json()) as SetupInput;
    const organizationName = required(input.organizationName, "Organization name");
    const organizationCode = required(input.organizationCode, "Organization code");
    const firstName = required(input.firstName, "First name");
    const lastName = required(input.lastName, "Last name");
    const email = required(input.email, "Email").toLowerCase();
    const employeeCode = required(input.employeeCode, "Employee code").toUpperCase();
    const password = required(input.password, "Password");

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const { data: hasAdmin, error: adminCheckError } = await admin.rpc(
      "has_initial_admin",
    );
    if (adminCheckError) {
      throw adminCheckError;
    }
    if (hasAdmin) {
      return new Response(JSON.stringify({ error: "Initial setup is already complete." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("bootstrap_state").delete().eq("id", true);

    const { error: lockError } = await admin.from("bootstrap_state").insert({
      id: true,
      status: "running",
    });
    if (lockError) {
      return new Response(JSON.stringify({ error: "Initial setup is already running." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    lockAcquired = true;

    organizationId = crypto.randomUUID();
    const departmentId = crypto.randomUUID();

    const { error: organizationError } = await admin.from("organizations").insert({
      id: organizationId,
      organization_code: organizationCode.toUpperCase(),
      organization_name: organizationName,
      legal_name: input.legalName?.trim() || organizationName,
      gst_number: input.gstNumber?.trim() || null,
      pan_number: input.panNumber?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      country: "India",
      pincode: input.pincode?.trim() || null,
      support_email: required(input.supportEmail, "Support email").toLowerCase(),
      support_phone: required(input.supportPhone, "Support phone"),
      currency: required(input.currency, "Currency"),
      timezone: required(input.timezone, "Timezone"),
      status: "active",
    });
    if (organizationError) {
      throw organizationError;
    }

    const { error: departmentError } = await admin.from("departments").insert({
      id: departmentId,
      organization_id: organizationId,
      name: "Administration",
      department_code: "ADMIN",
      department_name: "Administration",
      description: "Initial administration department.",
      status: "active",
    });
    if (departmentError) {
      throw departmentError;
    }

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `${firstName} ${lastName}`.trim() },
      });
    if (authError || !authData.user) {
      throw authError ?? new Error("Unable to create the first administrator.");
    }
    authUserId = authData.user.id;

    const { error: profileError } = await admin.from("user_profiles").insert({
      id: authUserId,
      organization_id: organizationId,
      employee_id: employeeCode,
      employee_code: employeeCode,
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
      email,
      phone: required(input.phone, "Phone"),
      role_id: "super_admin",
      department: "Administration",
      department_id: departmentId,
      employment_type: "permanent",
      status: "active",
      created_by: authUserId,
      updated_by: authUserId,
    });
    if (profileError) {
      throw profileError;
    }

    await admin
      .from("departments")
      .update({ hod_user_id: authUserId, updated_by: authUserId })
      .eq("id", departmentId);

    const { error: settingsError } = await admin.from("company_settings").insert({
      company_name: organizationName,
      support_email: required(input.supportEmail, "Support email").toLowerCase(),
      support_phone: required(input.supportPhone, "Support phone"),
      currency: required(input.currency, "Currency"),
      timezone: required(input.timezone, "Timezone"),
      require_admin_verification_claims: input.defaultWorkflow !== "standard",
      require_manager_approval_claims: true,
      require_super_admin_approval_claims: input.defaultWorkflow === "amount_based",
      require_manager_approval_leave: input.defaultWorkflow !== "standard",
      updated_by: authUserId,
    });
    if (settingsError) {
      throw settingsError;
    }

    await admin.from("bootstrap_state").update({
      status: "complete",
      completed_at: new Date().toISOString(),
      organization_id: organizationId,
      admin_user_id: authUserId,
    }).eq("id", true);

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId);
    }
    if (organizationId) {
      await admin.from("organizations").delete().eq("id", organizationId);
    }
    if (lockAcquired) {
      await admin.from("bootstrap_state").delete().eq("id", true);
    }
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Initial setup failed.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
