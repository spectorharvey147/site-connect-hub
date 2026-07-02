import { hierarchyDemoStore } from "@/services/hierarchyDemoStore";
import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type { Organization, OrganizationInput } from "@/types/organization";

interface OrganizationRow {
  id: string;
  organization_code: string;
  organization_name: string;
  legal_name: string | null;
  logo_url: string | null;
  voucher_logo_position: "left" | "right" | "hidden" | null;
  voucher_logo_size: number | null;
  gst_number: string | null;
  pan_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  support_email: string | null;
  support_phone: string | null;
  currency: string | null;
  timezone: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

function now() {
  return new Date().toISOString();
}

function assertSuperAdmin(actor?: AppUser) {
  if (actor && actor.role !== "super_admin") {
    throw new Error("Only Super Admin can manage organization settings.");
  }
}

function validateOrganization(input: OrganizationInput) {
  if (!input.organizationName.trim()) {
    throw new Error("Organization name is required.");
  }
  if (!input.organizationCode.trim()) {
    throw new Error("Organization code is required.");
  }
}

function mapOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    organizationCode: row.organization_code,
    organizationName: row.organization_name,
    legalName: row.legal_name ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    voucherLogoPosition: row.voucher_logo_position ?? "left",
    voucherLogoSize: row.voucher_logo_size ?? 18,
    gstNumber: row.gst_number ?? undefined,
    panNumber: row.pan_number ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    country: row.country ?? "India",
    pincode: row.pincode ?? undefined,
    supportEmail: row.support_email ?? undefined,
    supportPhone: row.support_phone ?? undefined,
    currency: row.currency ?? "INR",
    timezone: row.timezone ?? "Asia/Kolkata",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? undefined,
    updatedBy: row.updated_by ?? undefined,
  };
}

function toOrganizationRow(
  input: OrganizationInput,
  actor?: AppUser,
): Partial<OrganizationRow> {
  return {
    organization_code: input.organizationCode.trim().toUpperCase(),
    organization_name: input.organizationName.trim(),
    legal_name: input.legalName?.trim() || null,
    logo_url: input.logoUrl || null,
    voucher_logo_position: input.voucherLogoPosition ?? "left",
    voucher_logo_size: Math.min(28, Math.max(12, Number(input.voucherLogoSize ?? 18))),
    gst_number: input.gstNumber?.trim() || null,
    pan_number: input.panNumber?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    country: input.country?.trim() || "India",
    pincode: input.pincode?.trim() || null,
    support_email: input.supportEmail?.trim() || null,
    support_phone: input.supportPhone?.trim() || null,
    currency: input.currency.trim() || "INR",
    timezone: input.timezone.trim() || "Asia/Kolkata",
    status: "active",
    created_by: actor?.id ?? null,
    updated_by: actor?.id ?? null,
  };
}

function mergeOrganization(
  current: Organization,
  input: OrganizationInput,
  actor?: AppUser,
): Organization {
  return {
    ...current,
    organizationCode: input.organizationCode.trim().toUpperCase(),
    organizationName: input.organizationName.trim(),
    legalName: input.legalName?.trim() || undefined,
    logoUrl: input.logoUrl || current.logoUrl,
    voucherLogoPosition: input.voucherLogoPosition ?? current.voucherLogoPosition ?? "left",
    voucherLogoSize: Math.min(28, Math.max(12, Number(input.voucherLogoSize ?? current.voucherLogoSize ?? 18))),
    gstNumber: input.gstNumber?.trim() || undefined,
    panNumber: input.panNumber?.trim() || undefined,
    address: input.address?.trim() || undefined,
    city: input.city?.trim() || undefined,
    state: input.state?.trim() || undefined,
    country: input.country?.trim() || "India",
    pincode: input.pincode?.trim() || undefined,
    supportEmail: input.supportEmail?.trim() || undefined,
    supportPhone: input.supportPhone?.trim() || undefined,
    currency: input.currency.trim() || "INR",
    timezone: input.timezone.trim() || "Asia/Kolkata",
    updatedAt: now(),
    updatedBy: actor?.id,
  };
}

export const organizationService = {
  async createOrganization(input: OrganizationInput, actor?: AppUser) {
    assertSuperAdmin(actor);
    validateOrganization(input);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("organizations")
        .insert(toOrganizationRow(input, actor))
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const organization = mapOrganization(data as OrganizationRow);
      if (actor) {
        await recordAuditLog({
          userId: actor.id,
          action: "organization.created",
          entityType: "organization",
          entityId: organization.id,
          newValues: { organizationCode: organization.organizationCode },
        });
      }
      return organization;
    }

    const organization: Organization = {
      ...mergeOrganization(hierarchyDemoStore.getOrganization(), input, actor),
      id: crypto.randomUUID(),
      createdAt: now(),
      createdBy: actor?.id,
    };
    hierarchyDemoStore.setOrganization(organization);
    return organization;
  },

  async getCurrentOrganization() {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (data) {
        return mapOrganization(data as OrganizationRow);
      }
    }

    return hierarchyDemoStore.getOrganization();
  },

  async updateOrganization(
    organizationId: string,
    input: OrganizationInput,
    actor: AppUser,
  ) {
    assertSuperAdmin(actor);
    validateOrganization(input);

    if (isSupabaseConfigured && supabase) {
      const { data: currentData } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .maybeSingle();
      const { data, error } = await supabase
        .from("organizations")
        .update(toOrganizationRow(input, actor))
        .eq("id", organizationId)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const organization = mapOrganization(data as OrganizationRow);
      await recordAuditLog({
        userId: actor.id,
        action: "organization.updated",
        entityType: "organization",
        entityId: organization.id,
        oldValues: currentData
          ? (currentData as Record<string, unknown>)
          : undefined,
        newValues: { organizationCode: organization.organizationCode },
      });
      return organization;
    }

    const current = hierarchyDemoStore.getOrganization();
    if (current.id !== organizationId) {
      throw new Error("Organization not found.");
    }
    const updated = mergeOrganization(current, input, actor);
    hierarchyDemoStore.setOrganization(updated);
    await recordAuditLog({
      userId: actor.id,
      action: "organization.updated",
      entityType: "organization",
      entityId: updated.id,
      oldValues: { organizationName: current.organizationName },
      newValues: { organizationName: updated.organizationName },
    });
    return updated;
  },

  async uploadOrganizationLogo(
    organizationId: string,
    file: File,
    actor: AppUser,
  ) {
    assertSuperAdmin(actor);
    if (!file.type.startsWith("image/")) {
      throw new Error("Logo must be an image file.");
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("Logo must be below 2 MB.");
    }

    if (isSupabaseConfigured && supabase) {
      const extension = file.name.split(".").pop() ?? "png";
      const path = `${organizationId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from("organization-logos")
        .upload(path, file, { upsert: true });

      if (error) {
        throw new Error(error.message);
      }

      const { data } = supabase.storage
        .from("organization-logos")
        .getPublicUrl(path);
      return data.publicUrl;
    }

    return `/demo-uploads/${organizationId}/${file.name}`;
  },
};
