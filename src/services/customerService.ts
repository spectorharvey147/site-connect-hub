import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type { Customer } from "@/types/projects";

export type CustomerInput = Omit<Customer, "id">;

type CustomerRow = {
  id: string;
  organization_id: string;
  customer_code: string;
  customer_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  city: string | null;
  state: string | null;
  gst_number: string | null;
  payment_terms: string | null;
  status: Customer["status"];
  remarks: string | null;
};

function assertCanManage(actor: AppUser) {
  if (!["admin_hr", "super_admin"].includes(actor.role)) {
    throw new Error("Only Admin / HR or Super Admin can manage customers.");
  }
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    organizationId: row.organization_id,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    contactPerson: row.contact_person ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    billingAddress: row.billing_address ?? undefined,
    shippingAddress: row.shipping_address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    gstNumber: row.gst_number ?? undefined,
    paymentTerms: row.payment_terms ?? undefined,
    status: row.status,
    remarks: row.remarks ?? undefined,
  };
}

function payload(input: CustomerInput, actor: AppUser) {
  if (!input.organizationId || !input.customerCode.trim() || !input.customerName.trim()) {
    throw new Error("Organization, customer code and customer name are required.");
  }
  return {
    organization_id: input.organizationId,
    customer_code: input.customerCode.trim().toUpperCase(),
    customer_name: input.customerName.trim(),
    contact_person: input.contactPerson?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    billing_address: input.billingAddress?.trim() || null,
    shipping_address: input.shippingAddress?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    gst_number: input.gstNumber?.trim().toUpperCase() || null,
    payment_terms: input.paymentTerms?.trim() || null,
    status: input.status,
    remarks: input.remarks?.trim() || null,
    updated_by: actor.id,
  };
}

export const customerService = {
  async getCustomers(organizationId: string): Promise<Customer[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("organization_id", organizationId)
      .order("customer_name");
    if (error) {
      throw new Error(error.message);
    }
    return ((data as CustomerRow[] | null) ?? []).map(mapCustomer);
  },

  async saveCustomer(input: CustomerInput, actor: AppUser, customerId?: string) {
    assertCanManage(actor);
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }
    const values = payload(input, actor);
    const mutation = customerId
      ? supabase.from("customers").update(values).eq("id", customerId)
      : supabase
          .from("customers")
          .insert({ ...values, created_by: actor.id });
    const { error } = await mutation;
    if (error) {
      throw new Error(error.message);
    }
    await recordAuditLog({
      userId: actor.id,
      action: customerId ? "customer.updated" : "customer.created",
      entityType: "customer",
      entityId: customerId,
      newValues: input as unknown as Record<string, unknown>,
    });
  },

  async setCustomerStatus(
    customerId: string,
    status: Customer["status"],
    actor: AppUser,
  ) {
    assertCanManage(actor);
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }
    const { error } = await supabase
      .from("customers")
      .update({ status, updated_by: actor.id })
      .eq("id", customerId);
    if (error) {
      throw new Error(error.message);
    }
    await recordAuditLog({
      userId: actor.id,
      action: status === "active" ? "customer.activated" : "customer.deactivated",
      entityType: "customer",
      entityId: customerId,
      newValues: { status },
    });
  },
};
