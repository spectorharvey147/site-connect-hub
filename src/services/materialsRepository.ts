import {
  profileNameMap,
  projectNameMap,
  requireSupabase,
  type DataRow,
  vendorNameMap,
} from "@/services/normalizedDataUtils";
import type { AppUser } from "@/types/auth";
import type {
  MaterialConsumption,
  MaterialConsumptionInput,
  MaterialDamageWastageInput,
  MaterialReceipt,
  MaterialReceiptInput,
  MaterialReceiptStatus,
  MaterialRequest,
  MaterialRequestInput,
  MaterialRequestStatus,
  MaterialsFilters,
  MaterialStockLedgerEntry,
} from "@/types/materials";

async function materialNameMap(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const client = requireSupabase();
  const { data, error } = await client.from("materials").select("id,name").in("id", unique);
  if (error) throw new Error(error.message);
  return new Map(((data as DataRow[] | null) ?? []).map((row) => [String(row.id), String(row.name)]));
}

export const materialsRepository = {
  async listRequests(actor: AppUser, filters?: MaterialsFilters) {
    const client = requireSupabase();
    let query = client
      .from("material_requests")
      .select("*,material_request_items(*),material_request_attachments(*)")
      .eq("organization_id", actor.organizationId!)
      .order("request_date", { ascending: false });
    if (filters?.projectId) query = query.eq("project_id", filters.projectId);
    if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);
    if (filters?.priority && filters.priority !== "all") query = query.eq("priority", filters.priority);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const materialIds = rows.flatMap((row) =>
      ((row.material_request_items as DataRow[] | null) ?? []).map((item) => String(item.material_id)),
    );
    const [projects, profiles, materials] = await Promise.all([
      projectNameMap(rows.map((row) => String(row.project_id))),
      profileNameMap(rows.flatMap((row) => [String(row.requested_by), String(row.approved_by ?? "")])),
      materialNameMap(materialIds),
    ]);
    return rows.map((row): MaterialRequest => ({
      id: String(row.id),
      requestNumber: String(row.request_number),
      projectId: String(row.project_id),
      projectName: projects.get(String(row.project_id)) ?? "Project",
      requestDate: String(row.request_date),
      requiredDate: String(row.required_date),
      priority: row.priority as MaterialRequest["priority"],
      items: ((row.material_request_items as DataRow[] | null) ?? []).map((item) => ({
        id: String(item.id),
        materialId: String(item.material_id),
        materialName: materials.get(String(item.material_id)) ?? "Material",
        quantity: Number(item.quantity),
        uom: String(item.uom),
        specification: String(item.specification ?? ""),
        estimatedCost: Number(item.estimated_cost ?? 0),
        remarks: String(item.remarks ?? ""),
      })),
      attachments: ((row.material_request_attachments as DataRow[] | null) ?? []).map((item) => String(item.file_url ?? item.file_name)),
      status: row.status as MaterialRequest["status"],
      requestedBy: String(row.requested_by),
      requestedByName: profiles.get(String(row.requested_by)) ?? "User",
      requestedByRole: actor.role,
      submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
      approvedBy: row.approved_by ? String(row.approved_by) : undefined,
      approvedByName: row.approved_by ? profiles.get(String(row.approved_by)) : undefined,
      approvedAt: row.approved_at ? String(row.approved_at) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  async listReceipts(actor: AppUser, filters?: MaterialsFilters) {
    const client = requireSupabase();
    let query = client
      .from("material_receipts")
      .select("*,material_receipt_items(*),material_receipt_attachments(*)")
      .eq("organization_id", actor.organizationId!)
      .order("receipt_date", { ascending: false });
    if (filters?.projectId) query = query.eq("project_id", filters.projectId);
    if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const materialIds = rows.flatMap((row) =>
      ((row.material_receipt_items as DataRow[] | null) ?? []).map((item) => String(item.material_id)),
    );
    const [projects, vendors, profiles, materials] = await Promise.all([
      projectNameMap(rows.map((row) => String(row.project_id))),
      vendorNameMap(rows.map((row) => String(row.vendor_id)), "material_vendors"),
      profileNameMap(rows.flatMap((row) => [String(row.received_by), String(row.verified_by ?? "")])),
      materialNameMap(materialIds),
    ]);
    return rows.map((row): MaterialReceipt => ({
      id: String(row.id),
      receiptNumber: String(row.receipt_number),
      linkedRequestId: row.linked_request_id ? String(row.linked_request_id) : undefined,
      projectId: String(row.project_id),
      projectName: projects.get(String(row.project_id)) ?? "Project",
      receiptDate: String(row.receipt_date),
      vendorId: String(row.vendor_id),
      vendorName: vendors.get(String(row.vendor_id)) ?? "Vendor",
      invoiceNumber: String(row.invoice_number ?? ""),
      invoiceDate: String(row.invoice_date ?? ""),
      deliveryChallanNumber: String(row.delivery_challan_number ?? ""),
      items: ((row.material_receipt_items as DataRow[] | null) ?? []).map((item) => ({
        id: String(item.id),
        materialId: String(item.material_id),
        materialName: materials.get(String(item.material_id)) ?? "Material",
        quantityOrdered: Number(item.qty_ordered),
        quantityReceived: Number(item.qty_received),
        uom: String(item.uom),
        condition: item.condition as MaterialReceipt["items"][number]["condition"],
        remarks: String(item.remarks ?? ""),
      })),
      checklist: {
        materialsChecked: Boolean(row.materials_checked),
        quantitiesMatchInvoice: Boolean(row.quantities_match_invoice),
        qualityAcceptable: Boolean(row.quality_acceptable),
        invoiceMatched: Boolean(row.invoice_matched),
      },
      inspectorName: String(row.inspector_name ?? ""),
      signatureName: String(row.signature_name ?? ""),
      attachments: ((row.material_receipt_attachments as DataRow[] | null) ?? []).map((item) => String(item.file_url ?? item.file_name)),
      status: row.status as MaterialReceipt["status"],
      receivedBy: String(row.received_by),
      receivedByName: profiles.get(String(row.received_by)) ?? "User",
      receivedByRole: actor.role,
      receivedAt: row.received_at ? String(row.received_at) : undefined,
      verifiedBy: row.verified_by ? String(row.verified_by) : undefined,
      verifiedByName: row.verified_by ? profiles.get(String(row.verified_by)) : undefined,
      verifiedAt: row.verified_at ? String(row.verified_at) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  async saveRequest(
    input: MaterialRequestInput,
    actor: AppUser,
    status: Extract<MaterialRequestStatus, "draft" | "submitted">,
  ) {
    const client = requireSupabase();
    const { data, error } = await client.from("material_requests").insert({
      organization_id: actor.organizationId,
      project_id: input.projectId,
      department_id: actor.departmentId ?? null,
      request_number: `MR-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      request_date: input.requestDate,
      required_date: input.requiredDate,
      priority: input.priority,
      status,
      requested_by: actor.id,
      submitted_at: status === "submitted" ? new Date().toISOString() : null,
      created_by: actor.id,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const requestId = String(data.id);
    const { error: itemError } = await client.from("material_request_items").insert(
      input.items.map((item) => ({
        id: item.id || crypto.randomUUID(),
        request_id: requestId,
        material_id: item.materialId,
        quantity: item.quantity,
        uom: item.uom,
        specification: item.specification,
        estimated_cost: item.estimatedCost,
        remarks: item.remarks,
      })),
    );
    if (itemError) {
      await client.from("material_requests").delete().eq("id", requestId);
      throw new Error(itemError.message);
    }
    return (await this.listRequests(actor)).find((row) => row.id === requestId)!;
  },

  async approveRequest(id: string, actor: AppUser) {
    const client = requireSupabase();
    const { error } = await client.from("material_requests").update({
      status: "approved",
      approved_by: actor.id,
      approved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw new Error(error.message);
    return (await this.listRequests(actor)).find((row) => row.id === id)!;
  },

  async saveReceipt(
    input: MaterialReceiptInput,
    actor: AppUser,
    status: Extract<MaterialReceiptStatus, "draft" | "received">,
  ) {
    const client = requireSupabase();
    const { data, error } = await client.from("material_receipts").insert({
      organization_id: actor.organizationId,
      project_id: input.projectId,
      department_id: actor.departmentId ?? null,
      receipt_number: `MRC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      linked_request_id: input.linkedRequestId ?? null,
      vendor_id: input.vendorId,
      receipt_date: input.receiptDate,
      invoice_number: input.invoiceNumber,
      invoice_date: input.invoiceDate,
      delivery_challan_number: input.deliveryChallanNumber,
      materials_checked: input.checklist.materialsChecked,
      quantities_match_invoice: input.checklist.quantitiesMatchInvoice,
      quality_acceptable: input.checklist.qualityAcceptable,
      invoice_matched: input.checklist.invoiceMatched,
      inspector_name: input.inspectorName,
      signature_name: input.signatureName,
      status,
      received_by: actor.id,
      received_at: status === "received" ? new Date().toISOString() : null,
      created_by: actor.id,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const receiptId = String(data.id);
    const { error: itemError } = await client.from("material_receipt_items").insert(
      input.items.map((item) => ({
        id: item.id || crypto.randomUUID(),
        receipt_id: receiptId,
        material_id: item.materialId,
        qty_ordered: item.quantityOrdered,
        qty_received: item.quantityReceived,
        uom: item.uom,
        condition: item.condition,
        remarks: item.remarks,
      })),
    );
    if (itemError) {
      await client.from("material_receipts").delete().eq("id", receiptId);
      throw new Error(itemError.message);
    }
    return (await this.listReceipts(actor)).find((row) => row.id === receiptId)!;
  },

  async verifyReceipt(id: string, actor: AppUser) {
    const client = requireSupabase();
    const receipt = (await this.listReceipts(actor)).find((row) => row.id === id);
    if (!receipt) throw new Error("Material receipt not found.");
    const { error } = await client.from("material_receipts").update({
      status: "verified",
      verified_by: actor.id,
      verified_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw new Error(error.message);
    for (const item of receipt.items) {
      const balance = await this.stockBalance(actor, receipt.projectId, item.materialId);
      await client.from("material_stock_ledger").insert({
        organization_id: actor.organizationId,
        project_id: receipt.projectId,
        department_id: actor.departmentId ?? null,
        material_id: item.materialId,
        transaction_date: receipt.receiptDate,
        transaction_type: item.condition === "damaged" ? "damage" : "receipt",
        reference_id: id,
        quantity_in: item.condition === "damaged" ? 0 : item.quantityReceived,
        quantity_out: item.condition === "damaged" ? item.quantityReceived : 0,
        balance_quantity:
          balance + (item.condition === "damaged" ? -item.quantityReceived : item.quantityReceived),
        created_by: actor.id,
      });
    }
    return (await this.listReceipts(actor)).find((row) => row.id === id)!;
  },

  async stockBalance(actor: AppUser, projectId: string, materialId: string) {
    const client = requireSupabase();
    const { data, error } = await client.from("material_stock_ledger")
      .select("balance_quantity")
      .eq("organization_id", actor.organizationId!)
      .eq("project_id", projectId)
      .eq("material_id", materialId)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Number(data?.balance_quantity ?? 0);
  },

  async saveConsumption(input: MaterialConsumptionInput, actor: AppUser) {
    const client = requireSupabase();
    const balance = await this.stockBalance(actor, input.projectId, input.materialId);
    if (input.quantity <= 0) throw new Error("Consumption quantity must be positive.");
    if (input.quantity > balance) throw new Error("Material consumption exceeds available stock.");
    const { data, error } = await client.from("material_consumption").insert({
      organization_id: actor.organizationId,
      project_id: input.projectId,
      department_id: actor.departmentId ?? null,
      cost_code_id: input.costCodeId ?? null,
      material_id: input.materialId,
      consumption_date: input.consumptionDate,
      quantity: input.quantity,
      work_area: input.workArea ?? null,
      purpose: input.purpose ?? null,
      issued_to: input.issuedTo ?? null,
      remarks: input.remarks ?? null,
      status: "posted",
      created_by: actor.id,
    }).select("*").single();
    if (error) throw new Error(error.message);
    await client.from("material_stock_ledger").insert({
      organization_id: actor.organizationId,
      project_id: input.projectId,
      department_id: actor.departmentId ?? null,
      cost_code_id: input.costCodeId ?? null,
      material_id: input.materialId,
      transaction_date: input.consumptionDate,
      transaction_type: "consumption",
      reference_id: data.id,
      quantity_out: input.quantity,
      balance_quantity: balance - input.quantity,
      created_by: actor.id,
    });
    const names = await materialNameMap([input.materialId]);
    return {
      id: String(data.id),
      projectId: input.projectId,
      materialId: input.materialId,
      materialName: names.get(input.materialId) ?? "Material",
      consumptionDate: input.consumptionDate,
      quantity: input.quantity,
      workArea: input.workArea,
      purpose: input.purpose,
      remarks: input.remarks,
      status: "posted",
      createdAt: String(data.created_at),
    } satisfies MaterialConsumption;
  },

  async saveDamageWastage(input: MaterialDamageWastageInput, actor: AppUser) {
    const client = requireSupabase();
    const balance = await this.stockBalance(actor, input.projectId, input.materialId);
    if (input.quantity <= 0) throw new Error("Damage/wastage quantity must be positive.");
    if (input.quantity > balance) throw new Error("Damage/wastage exceeds available stock.");
    const { data, error } = await client.from("material_damage_wastage").insert({
      organization_id: actor.organizationId,
      project_id: input.projectId,
      department_id: actor.departmentId ?? null,
      material_id: input.materialId,
      transaction_date: input.transactionDate,
      quantity: input.quantity,
      reason: input.reason,
      remarks: input.remarks ?? null,
      status: "posted",
      created_by: actor.id,
    }).select("*").single();
    if (error) throw new Error(error.message);
    await client.from("material_stock_ledger").insert({
      organization_id: actor.organizationId,
      project_id: input.projectId,
      department_id: actor.departmentId ?? null,
      material_id: input.materialId,
      transaction_date: input.transactionDate,
      transaction_type: "wastage",
      reference_id: data.id,
      quantity_out: input.quantity,
      balance_quantity: balance - input.quantity,
      created_by: actor.id,
    });
    return data as DataRow;
  },

  async listStockLedger(actor: AppUser, projectId?: string) {
    const client = requireSupabase();
    let query = client.from("material_stock_ledger")
      .select("*")
      .eq("organization_id", actor.organizationId!)
      .order("transaction_date", { ascending: false });
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data as DataRow[] | null) ?? []).map((row): MaterialStockLedgerEntry => ({
      id: String(row.id),
      projectId: String(row.project_id),
      materialId: String(row.material_id),
      transactionDate: String(row.transaction_date),
      transactionType: row.transaction_type as MaterialStockLedgerEntry["transactionType"],
      quantityIn: Number(row.quantity_in),
      quantityOut: Number(row.quantity_out),
      balanceQuantity: Number(row.balance_quantity),
      createdAt: String(row.created_at),
    }));
  },
};
