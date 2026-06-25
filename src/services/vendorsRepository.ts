import {
  profileNameMap,
  projectNameMap,
  requireSupabase,
  type DataRow,
  vendorNameMap,
} from "@/services/normalizedDataUtils";
import type { VendorBillSourceRow } from "@/services/vendorBillSourceService";
import type { AppUser } from "@/types/auth";
import type {
  Vendor,
  VendorBill,
  VendorBillInput,
  VendorBillStatus,
  VendorInput,
  VendorLedgerEntry,
  VendorPayment,
  VendorPaymentMethod,
  VendorPaymentVoucher,
} from "@/types/vendors";

export const vendorsRepository = {
  async listVendors() {
    const client = requireSupabase();
    const { data, error } = await client.from("vendors").select("*").order("name");
    if (error) throw new Error(error.message);
    return ((data as DataRow[] | null) ?? []).map((row): Vendor => ({
      id: String(row.id),
      name: String(row.name),
      code: String(row.code),
      vendorType: row.vendor_type as Vendor["vendorType"],
      contactPerson: String(row.contact_person ?? ""),
      email: String(row.email ?? ""),
      phone: String(row.phone ?? ""),
      gstNumber: String(row.gst_number ?? ""),
      address: String(row.address ?? ""),
      paymentTerms: String(row.payment_terms ?? ""),
      status: row.status as Vendor["status"],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  async createVendor(input: VendorInput) {
    const client = requireSupabase();
    const { data, error } = await client.from("vendors").insert({
      id: crypto.randomUUID(),
      name: input.name.trim(),
      code: input.code.trim(),
      vendor_type: input.vendorType,
      contact_person: input.contactPerson,
      email: input.email,
      phone: input.phone,
      gst_number: input.gstNumber,
      address: input.address,
      payment_terms: input.paymentTerms,
      status: input.status,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return (await this.listVendors()).find((row) => row.id === String(data.id))!;
  },

  async listBills(actor: AppUser) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("vendor_bills")
      .select("*")
      .eq("organization_id", actor.organizationId!)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const [vendors, projects, profiles] = await Promise.all([
      vendorNameMap(rows.map((row) => String(row.vendor_id))),
      projectNameMap(rows.map((row) => String(row.project_id))),
      profileNameMap(rows.flatMap((row) => [
        String(row.submitted_by),
        String(row.verified_by ?? ""),
        String(row.approved_by ?? ""),
      ])),
    ]);
    return rows.map((row): VendorBill => ({
      id: String(row.id),
      billNumber: String(row.bill_number),
      vendorId: String(row.vendor_id),
      vendorName: vendors.get(String(row.vendor_id)) ?? "Vendor",
      projectId: String(row.project_id),
      projectName: projects.get(String(row.project_id)) ?? "Project",
      billType: row.bill_type as VendorBill["billType"],
      billingPeriodFrom: String(row.billing_period_from ?? ""),
      billingPeriodTo: String(row.billing_period_to ?? ""),
      invoiceNumber: String(row.invoice_number ?? ""),
      invoiceDate: String(row.invoice_date ?? ""),
      baseAmount: Number(row.base_amount),
      gstAmount: Number(row.gst_amount),
      otherCharges: Number(row.other_charges),
      processingType: row.processing_type as VendorBill["processingType"],
      processingAmount: Number(row.processing_amount),
      totalAmount: Number(row.total_amount),
      status: row.status as VendorBill["status"],
      submittedBy: String(row.submitted_by),
      submittedByName: profiles.get(String(row.submitted_by)) ?? "User",
      submittedByRole: actor.role,
      submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
      verifiedBy: row.verified_by ? String(row.verified_by) : undefined,
      verifiedByName: row.verified_by ? profiles.get(String(row.verified_by)) : undefined,
      verifiedAt: row.verified_at ? String(row.verified_at) : undefined,
      approvedBy: row.approved_by ? String(row.approved_by) : undefined,
      approvedByName: row.approved_by ? profiles.get(String(row.approved_by)) : undefined,
      approvedAt: row.approved_at ? String(row.approved_at) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  async createBill(
    input: VendorBillInput,
    actor: AppUser,
    status: Extract<VendorBillStatus, "draft" | "submitted">,
    items: VendorBillSourceRow[],
  ) {
    const client = requireSupabase();
    const adjustment =
      input.processingType === "deduction"
        ? -input.processingAmount
        : input.processingType === "addition"
          ? input.processingAmount
          : 0;
    const total = Math.max(
      0,
      input.baseAmount + input.gstAmount + input.otherCharges + adjustment,
    );
    const { data, error } = await client.from("vendor_bills").insert({
      organization_id: actor.organizationId,
      project_id: input.projectId,
      department_id: actor.departmentId ?? null,
      vendor_id: input.vendorId,
      bill_number: `VB-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      bill_type: input.billType,
      billing_period_from: input.billingPeriodFrom,
      billing_period_to: input.billingPeriodTo,
      invoice_number: input.invoiceNumber,
      invoice_date: input.invoiceDate,
      base_amount: input.baseAmount,
      gst_amount: input.gstAmount,
      other_charges: input.otherCharges,
      processing_type: input.processingType,
      processing_amount: input.processingAmount,
      total_amount: total,
      outstanding_amount: total,
      status,
      submitted_by: actor.id,
      submitted_at: status === "submitted" ? new Date().toISOString() : null,
      created_by: actor.id,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const billId = String(data.id);
    if (items.length) {
      const { error: itemError } = await client.from("vendor_bill_items").insert(
        items.map((item) => ({
          organization_id: actor.organizationId,
          project_id: input.projectId,
          department_id: actor.departmentId ?? null,
          vendor_id: input.vendorId,
          vendor_bill_id: billId,
          source_type:
            input.billType === "labor"
              ? "labour"
              : input.billType === "service"
                ? "general"
                : input.billType,
          source_id: /^[0-9a-f-]{36}$/i.test(item.id.split(":")[0])
            ? item.id.split(":")[0]
            : null,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          amount: item.amount,
          created_by: actor.id,
        })),
      );
      if (itemError) {
        await client.from("vendor_bills").delete().eq("id", billId);
        throw new Error(itemError.message);
      }
    }
    return (await this.listBills(actor)).find((row) => row.id === billId)!;
  },

  async updateBillStatus(
    id: string,
    status: VendorBillStatus,
    actor: AppUser,
  ) {
    const patch: DataRow = { status };
    if (status === "verified") {
      patch.verified_by = actor.id;
      patch.verified_at = new Date().toISOString();
    }
    if (status === "approved") {
      patch.approved_by = actor.id;
      patch.approved_at = new Date().toISOString();
    }
    const client = requireSupabase();
    const { error } = await client.from("vendor_bills").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    const bill = (await this.listBills(actor)).find((row) => row.id === id)!;
    if (status === "approved") {
      const balance = await this.vendorBalance(actor, bill.vendorId);
      await this.addLedger(actor, bill, {
        type: "bill_approved",
        description: `Bill ${bill.billNumber} approved`,
        debit: bill.totalAmount,
        credit: 0,
        balanceAfter: balance + bill.totalAmount,
      });
    }
    return bill;
  },

  async listVouchers(actor: AppUser) {
    void actor;
    const client = requireSupabase();
    const { data, error } = await client
      .from("vendor_payment_vouchers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const [vendors, profiles] = await Promise.all([
      vendorNameMap(rows.map((row) => String(row.vendor_id))),
      profileNameMap(rows.map((row) => String(row.prepared_by))),
    ]);
    return rows.map((row): VendorPaymentVoucher => ({
      id: String(row.id),
      vendorBillId: String(row.vendor_bill_id),
      vendorId: String(row.vendor_id),
      voucherNumber: String(row.voucher_number),
      voucherDate: String(row.voucher_date),
      paidToName: String(row.paid_to_name ?? vendors.get(String(row.vendor_id)) ?? "Vendor"),
      approvedAmount: Number(row.approved_amount),
      deductionAmount: Number(row.deduction_amount),
      netPayableAmount: Number(row.net_payable_amount),
      preparedBy: String(row.prepared_by),
      preparedByName: profiles.get(String(row.prepared_by)) ?? "User",
      accountsNote: String(row.accounts_note ?? ""),
      status: row.status as VendorPaymentVoucher["status"],
      createdAt: String(row.created_at),
      paidAt: row.paid_at ? String(row.paid_at) : undefined,
      paymentReference: row.payment_reference ? String(row.payment_reference) : undefined,
    }));
  },

  async generateVoucher(bill: VendorBill, actor: AppUser, accountsNote: string) {
    const client = requireSupabase();
    const deduction = bill.processingType === "deduction" ? bill.processingAmount : 0;
    const { data, error } = await client.from("vendor_payment_vouchers").insert({
      vendor_bill_id: bill.id,
      vendor_id: bill.vendorId,
      voucher_number: `VPV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      voucher_date: new Date().toISOString().slice(0, 10),
      paid_to_name: bill.vendorName,
      approved_amount: bill.baseAmount + bill.gstAmount + bill.otherCharges,
      deduction_amount: deduction,
      net_payable_amount: bill.totalAmount,
      prepared_by: actor.id,
      accounts_note: accountsNote,
      status: "generated",
    }).select("id").single();
    if (error) throw new Error(error.message);
    await client.from("vendor_bills").update({ status: "voucher_generated" }).eq("id", bill.id);
    return (await this.listVouchers(actor)).find((row) => row.id === String(data.id))!;
  },

  async listPayments(actor: AppUser) {
    void actor;
    const client = requireSupabase();
    const { data, error } = await client
      .from("vendor_payments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const profiles = await profileNameMap(rows.map((row) => String(row.processed_by)));
    return rows.map((row): VendorPayment => ({
      id: String(row.id),
      vendorId: String(row.vendor_id),
      vendorBillId: String(row.vendor_bill_id),
      voucherId: String(row.voucher_id),
      amount: Number(row.amount),
      paymentMethod: row.payment_method as VendorPayment["paymentMethod"],
      paymentDate: String(row.payment_date),
      referenceNumber: String(row.reference_number ?? ""),
      status: row.status as VendorPayment["status"],
      processedBy: String(row.processed_by),
      processedByName: profiles.get(String(row.processed_by)) ?? "User",
      createdAt: String(row.created_at),
    }));
  },

  async recordPayment(
    voucher: VendorPaymentVoucher,
    bill: VendorBill,
    actor: AppUser,
    amount: number,
    reference: string,
    method: VendorPaymentMethod,
  ) {
    const client = requireSupabase();
    const existing = (await this.listPayments(actor))
      .filter((row) => row.vendorBillId === bill.id && row.status !== "void")
      .reduce((sum, row) => sum + row.amount, 0);
    const remaining = Math.max(0, bill.totalAmount - existing);
    if (amount <= 0 || amount > remaining) throw new Error("Payment amount exceeds outstanding balance.");
    const { data, error } = await client.from("vendor_payments").insert({
      vendor_id: bill.vendorId,
      vendor_bill_id: bill.id,
      voucher_id: voucher.id,
      amount,
      payment_method: method,
      payment_date: new Date().toISOString().slice(0, 10),
      reference_number: reference,
      status: amount < remaining ? "partial" : "processed",
      processed_by: actor.id,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const paidAmount = existing + amount;
    const complete = paidAmount >= bill.totalAmount;
    await client.from("vendor_bills").update({
      status: complete ? "paid" : "partially_paid",
      paid_amount: paidAmount,
      outstanding_amount: Math.max(0, bill.totalAmount - paidAmount),
    }).eq("id", bill.id);
    await client.from("vendor_payment_vouchers").update({
      status: complete ? "paid" : "generated",
      paid_at: complete ? new Date().toISOString() : null,
      payment_reference: reference,
    }).eq("id", voucher.id);
    const balance = await this.vendorBalance(actor, bill.vendorId);
    const paymentId = String(data.id);
    await this.addLedger(actor, bill, {
      voucherId: voucher.id,
      paymentId,
      type: amount < remaining ? "partial_payment" : "payment",
      description: `Payment ${reference}`,
      debit: 0,
      credit: amount,
      balanceAfter: Math.max(0, balance - amount),
    });
    return (await this.listPayments(actor)).find((row) => row.id === paymentId)!;
  },

  async listLedger(actor: AppUser, vendorId?: string) {
    const client = requireSupabase();
    let query = client.from("vendor_ledgers")
      .select("*")
      .eq("organization_id", actor.organizationId!)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (vendorId) query = query.eq("vendor_id", vendorId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const vendors = await vendorNameMap(rows.map((row) => String(row.vendor_id)));
    return rows.map((row): VendorLedgerEntry => ({
      id: String(row.id),
      vendorId: String(row.vendor_id),
      vendorName: vendors.get(String(row.vendor_id)) ?? "Vendor",
      billId: row.bill_id ? String(row.bill_id) : undefined,
      voucherId: row.voucher_id ? String(row.voucher_id) : undefined,
      type: row.transaction_type as VendorLedgerEntry["type"],
      description: String(row.description ?? ""),
      debit: Number(row.debit),
      credit: Number(row.credit),
      balanceAfter: Number(row.balance_after),
      createdAt: String(row.created_at),
    }));
  },

  async vendorBalance(actor: AppUser, vendorId: string) {
    const rows = await this.listLedger(actor, vendorId);
    return rows[0]?.balanceAfter ?? 0;
  },

  async addLedger(
    actor: AppUser,
    bill: VendorBill,
    entry: {
      voucherId?: string;
      paymentId?: string;
      type: string;
      description: string;
      debit: number;
      credit: number;
      balanceAfter: number;
    },
  ) {
    const client = requireSupabase();
    const { error } = await client.from("vendor_ledgers").insert({
      organization_id: actor.organizationId,
      project_id: bill.projectId,
      department_id: actor.departmentId ?? null,
      vendor_id: bill.vendorId,
      bill_id: bill.id,
      voucher_id: entry.voucherId ?? null,
      payment_id: entry.paymentId ?? null,
      transaction_date: new Date().toISOString().slice(0, 10),
      transaction_type: entry.type,
      description: entry.description,
      debit: entry.debit,
      credit: entry.credit,
      balance_after: entry.balanceAfter,
      created_by: actor.id,
    });
    if (error) throw new Error(error.message);
  },
};
