import {
  profileNameMap,
  projectNameMap,
  requireSupabase,
  type DataRow,
  vendorNameMap,
} from "@/services/normalizedDataUtils";
import type { AppUser } from "@/types/auth";
import type {
  FuelFilters,
  FuelIssue,
  FuelIssueInput,
  FuelReceipt,
  FuelReceiptInput,
  FuelRecordStatus,
  FuelType,
} from "@/types/fuel";

export interface FuelDepositInput {
  projectId: string;
  vendorId: string;
  fuelContractId?: string;
  depositDate: string;
  depositAmount: number;
  paymentMode: string;
  paymentReference?: string;
  remarks?: string;
}

export const fuelRepository = {
  async listContracts(actor: AppUser) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("fuel_contracts")
      .select("*")
      .eq("organization_id", actor.organizationId!)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as DataRow[] | null) ?? [];
  },

  async listDeposits(actor: AppUser) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("fuel_vendor_deposits")
      .select("*")
      .eq("organization_id", actor.organizationId!)
      .order("deposit_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as DataRow[] | null) ?? [];
  },

  async listVendorLedger(actor: AppUser) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("fuel_vendor_ledger")
      .select("*")
      .eq("organization_id", actor.organizationId!)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as DataRow[] | null) ?? [];
  },

  async vendorBalance(actor: AppUser, projectId: string, vendorId: string) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("fuel_vendor_ledger")
      .select("balance_after")
      .eq("organization_id", actor.organizationId!)
      .eq("project_id", projectId)
      .eq("vendor_id", vendorId)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Number(data?.balance_after ?? 0);
  },

  async listReceipts(actor: AppUser, filters?: FuelFilters) {
    const client = requireSupabase();
    let query = client
      .from("fuel_receipts")
      .select("*")
      .eq("organization_id", actor.organizationId!)
      .order("receipt_date", { ascending: false });
    if (filters?.projectId) query = query.eq("project_id", filters.projectId);
    if (filters?.vendorId) query = query.eq("vendor_id", filters.vendorId);
    if (filters?.fuelType && filters.fuelType !== "all") query = query.eq("fuel_type", filters.fuelType);
    if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);
    if (filters?.dateFrom) query = query.gte("receipt_date", filters.dateFrom);
    if (filters?.dateTo) query = query.lte("receipt_date", filters.dateTo);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const [projects, vendors, profiles] = await Promise.all([
      projectNameMap(rows.map((row) => String(row.project_id))),
      vendorNameMap(rows.map((row) => String(row.vendor_id)), "fuel_vendors"),
      profileNameMap(rows.flatMap((row) => [String(row.submitted_by), String(row.approved_by ?? "")])),
    ]);
    return rows.map((row): FuelReceipt => ({
      id: String(row.id),
      receiptNumber: String(row.receipt_number),
      projectId: String(row.project_id),
      projectName: projects.get(String(row.project_id)) ?? "Project",
      date: String(row.receipt_date),
      fuelType: row.fuel_type as FuelReceipt["fuelType"],
      vendorId: String(row.vendor_id),
      vendorName: vendors.get(String(row.vendor_id)) ?? "Vendor",
      fuelContractId: row.fuel_contract_id ? String(row.fuel_contract_id) : undefined,
      source: row.source as FuelReceipt["source"],
      quantity: Number(row.quantity),
      unit: row.unit as FuelReceipt["unit"],
      ratePerUnit: Number(row.rate_per_unit),
      totalAmount: Number(row.total_amount),
      referenceNumber: String(row.reference_number ?? ""),
      remarks: String(row.remarks ?? ""),
      status: row.status as FuelReceipt["status"],
      submittedBy: String(row.submitted_by),
      submittedByName: profiles.get(String(row.submitted_by)) ?? "User",
      submittedByRole: actor.role,
      submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
      approvedBy: row.approved_by ? String(row.approved_by) : undefined,
      approvedByName: row.approved_by ? profiles.get(String(row.approved_by)) : undefined,
      approvedAt: row.approved_at ? String(row.approved_at) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  async listIssues(actor: AppUser, filters?: FuelFilters) {
    const client = requireSupabase();
    let query = client
      .from("fuel_issues")
      .select("*,fuel_issue_rows(*)")
      .eq("organization_id", actor.organizationId!)
      .order("issue_date", { ascending: false });
    if (filters?.projectId) query = query.eq("project_id", filters.projectId);
    if (filters?.fuelType && filters.fuelType !== "all") query = query.eq("fuel_type", filters.fuelType);
    if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);
    if (filters?.dateFrom) query = query.gte("issue_date", filters.dateFrom);
    if (filters?.dateTo) query = query.lte("issue_date", filters.dateTo);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const [projects, profiles] = await Promise.all([
      projectNameMap(rows.map((row) => String(row.project_id))),
      profileNameMap(rows.flatMap((row) => [String(row.submitted_by), String(row.approved_by ?? "")])),
    ]);
    return rows.map((row): FuelIssue => ({
      id: String(row.id),
      issueNumber: String(row.issue_number),
      projectId: String(row.project_id),
      projectName: projects.get(String(row.project_id)) ?? "Project",
      date: String(row.issue_date),
      fuelType: row.fuel_type as FuelIssue["fuelType"],
      unit: row.unit as FuelIssue["unit"],
      openingStock: Number(row.opening_stock),
      rows: ((row.fuel_issue_rows as DataRow[] | null) ?? []).map((item) => ({
        id: String(item.id),
        machineType: item.machine_type as FuelIssue["rows"][number]["machineType"],
        machineAssetId: String(item.machine_asset_id ?? ""),
        machineNumber: String(item.machine_number),
        quantityIssued: Number(item.quantity_issued),
        remarks: String(item.remarks ?? ""),
      })),
      totalIssued: Number(row.total_issued),
      closingStock: Number(row.closing_stock),
      remarks: String(row.remarks ?? ""),
      status: row.status as FuelIssue["status"],
      submittedBy: String(row.submitted_by),
      submittedByName: profiles.get(String(row.submitted_by)) ?? "User",
      submittedByRole: actor.role,
      submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
      approvedBy: row.approved_by ? String(row.approved_by) : undefined,
      approvedByName: row.approved_by ? profiles.get(String(row.approved_by)) : undefined,
      approvedAt: row.approved_at ? String(row.approved_at) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  async stockBalance(actor: AppUser, projectId: string, fuelType: FuelType) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("fuel_stock_ledger")
      .select("balance_quantity")
      .eq("organization_id", actor.organizationId!)
      .eq("project_id", projectId)
      .eq("fuel_type", fuelType)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Number(data?.balance_quantity ?? 0);
  },

  async saveReceipt(
    input: FuelReceiptInput,
    actor: AppUser,
    status: Extract<FuelRecordStatus, "draft" | "submitted">,
  ) {
    const client = requireSupabase();
    const totalAmount = Math.round(input.quantity * input.ratePerUnit * 100) / 100;
    let fuelContractId = input.fuelContractId;
    if (!fuelContractId) {
      const { data: contract, error: contractError } = await client
        .from("fuel_contracts")
        .select("id")
        .eq("organization_id", actor.organizationId!)
        .eq("project_id", input.projectId)
        .eq("vendor_id", input.vendorId)
        .eq("fuel_type", input.fuelType)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (contractError) throw new Error(contractError.message);
      fuelContractId = contract?.id ? String(contract.id) : undefined;
    }
    const { data, error } = await client
      .from("fuel_receipts")
      .insert({
        organization_id: actor.organizationId,
        project_id: input.projectId,
        department_id: actor.departmentId ?? null,
        receipt_number: `FRC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        receipt_date: input.date,
        fuel_type: input.fuelType,
        vendor_id: input.vendorId,
        fuel_contract_id: fuelContractId ?? null,
        source: input.source,
        quantity: input.quantity,
        unit: input.fuelType === "grease" ? "KG" : "L",
        rate_per_unit: input.ratePerUnit,
        total_amount: totalAmount,
        reference_number: input.referenceNumber,
        remarks: input.remarks,
        status,
        submitted_by: actor.id,
        submitted_at: status === "submitted" ? new Date().toISOString() : null,
        created_by: actor.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return (await this.listReceipts(actor)).find((row) => row.id === String(data.id))!;
  },

  async saveIssue(
    input: FuelIssueInput,
    actor: AppUser,
    status: Extract<FuelRecordStatus, "draft" | "submitted">,
  ) {
    const client = requireSupabase();
    const opening = await this.stockBalance(actor, input.projectId, input.fuelType);
    const issued = input.rows.reduce((sum, row) => sum + row.quantityIssued, 0);
    if (status === "submitted" && issued > opening) {
      throw new Error("Fuel issue quantity exceeds opening stock.");
    }
    const { data, error } = await client
      .from("fuel_issues")
      .insert({
        organization_id: actor.organizationId,
        project_id: input.projectId,
        department_id: actor.departmentId ?? null,
        issue_number: `FIS-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        issue_date: input.date,
        fuel_type: input.fuelType,
        unit: input.fuelType === "grease" ? "KG" : "L",
        opening_stock: opening,
        total_issued: issued,
        closing_stock: opening - issued,
        remarks: input.remarks,
        status,
        submitted_by: actor.id,
        submitted_at: status === "submitted" ? new Date().toISOString() : null,
        created_by: actor.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const issueId = String(data.id);
    const { error: rowError } = await client.from("fuel_issue_rows").insert(
      input.rows.map((row) => ({
        id: row.id || crypto.randomUUID(),
        fuel_issue_id: issueId,
        machine_asset_id: row.machineAssetId || null,
        machine_type: row.machineType,
        machine_number: row.machineNumber,
        quantity_issued: row.quantityIssued,
        remarks: row.remarks,
      })),
    );
    if (rowError) {
      await client.from("fuel_issues").delete().eq("id", issueId);
      throw new Error(rowError.message);
    }
    return (await this.listIssues(actor)).find((row) => row.id === issueId)!;
  },

  async approveReceipt(id: string, actor: AppUser) {
    const client = requireSupabase();
    const { data: receipt, error: readError } = await client
      .from("fuel_receipts")
      .select("*")
      .eq("id", id)
      .single();
    if (readError) throw new Error(readError.message);
    const current = await this.stockBalance(
      actor,
      String(receipt.project_id),
      receipt.fuel_type as FuelType,
    );
    const vendorBalance = await this.vendorBalance(
      actor,
      String(receipt.project_id),
      String(receipt.vendor_id),
    );
    if (receipt.source === "advance" && Number(receipt.total_amount) > vendorBalance) {
      throw new Error("Fuel receipt amount exceeds the available vendor advance.");
    }
    const approvedAt = new Date().toISOString();
    const { error } = await client.from("fuel_receipts").update({
      status: "approved",
      approved_by: actor.id,
      approved_at: approvedAt,
    }).eq("id", id);
    if (error) throw new Error(error.message);
    await client.from("fuel_stock_ledger").insert({
      organization_id: actor.organizationId,
      project_id: receipt.project_id,
      department_id: actor.departmentId ?? null,
      fuel_type: receipt.fuel_type,
      transaction_date: receipt.receipt_date,
      transaction_type: "receipt",
      reference_id: id,
      quantity_in: receipt.quantity,
      balance_quantity: current + Number(receipt.quantity),
      unit_rate: receipt.rate_per_unit,
      created_by: actor.id,
    });
    const ledgerType =
      receipt.source === "advance"
        ? "advance_receipt"
        : receipt.source === "credit"
          ? "credit_receipt"
          : "cash_receipt";
    await client.from("fuel_vendor_ledger").insert({
      organization_id: actor.organizationId,
      project_id: receipt.project_id,
      vendor_id: receipt.vendor_id,
      fuel_contract_id: receipt.fuel_contract_id,
      transaction_date: receipt.receipt_date,
      transaction_type: ledgerType,
      reference_id: id,
      debit:
        receipt.source === "advance" || receipt.source === "credit"
          ? receipt.total_amount
          : 0,
      balance_after:
        receipt.source === "cash"
          ? vendorBalance
          : vendorBalance - Number(receipt.total_amount),
      created_by: actor.id,
    });
    if (receipt.source === "cash") {
      await client.from("fuel_cash_expenses").insert({
        organization_id: actor.organizationId,
        project_id: receipt.project_id,
        department_id: actor.departmentId ?? null,
        vendor_id: receipt.vendor_id,
        contract_id: null,
        fuel_receipt_id: id,
        expense_date: receipt.receipt_date,
        fuel_type: receipt.fuel_type,
        quantity: receipt.quantity,
        rate_per_unit: receipt.rate_per_unit,
        total_amount: receipt.total_amount,
        paid_by: actor.id,
        payment_mode: "cash",
        payment_reference: receipt.reference_number,
        remarks: receipt.remarks,
        status: "approved",
        created_by: actor.id,
      });
    }
    return (await this.listReceipts(actor)).find((row) => row.id === id)!;
  },

  async approveIssue(id: string, actor: AppUser) {
    const client = requireSupabase();
    const { data: issue, error: readError } = await client
      .from("fuel_issues")
      .select("*")
      .eq("id", id)
      .single();
    if (readError) throw new Error(readError.message);
    const current = await this.stockBalance(
      actor,
      String(issue.project_id),
      issue.fuel_type as FuelType,
    );
    if (Number(issue.total_issued) > current) {
      throw new Error("Fuel issue quantity exceeds available stock.");
    }
    const { error } = await client.from("fuel_issues").update({
      status: "approved",
      approved_by: actor.id,
      approved_at: new Date().toISOString(),
      opening_stock: current,
      closing_stock: current - Number(issue.total_issued),
    }).eq("id", id);
    if (error) throw new Error(error.message);
    await client.from("fuel_stock_ledger").insert({
      organization_id: actor.organizationId,
      project_id: issue.project_id,
      department_id: actor.departmentId ?? null,
      fuel_type: issue.fuel_type,
      transaction_date: issue.issue_date,
      transaction_type: "issue",
      reference_id: id,
      quantity_out: issue.total_issued,
      balance_quantity: current - Number(issue.total_issued),
      created_by: actor.id,
    });
    return (await this.listIssues(actor)).find((row) => row.id === id)!;
  },

  async createDeposit(input: FuelDepositInput, actor: AppUser) {
    const client = requireSupabase();
    const currentBalance = await this.vendorBalance(
      actor,
      input.projectId,
      input.vendorId,
    );
    const { data, error } = await client.from("fuel_vendor_deposits").insert({
      organization_id: actor.organizationId,
      project_id: input.projectId,
      vendor_id: input.vendorId,
      fuel_contract_id: input.fuelContractId ?? null,
      deposit_date: input.depositDate,
      deposit_amount: input.depositAmount,
      payment_mode: input.paymentMode,
      payment_reference: input.paymentReference ?? null,
      remarks: input.remarks ?? null,
      created_by: actor.id,
    }).select("*").single();
    if (error) throw new Error(error.message);
    await client.from("fuel_vendor_ledger").insert({
      organization_id: actor.organizationId,
      project_id: input.projectId,
      vendor_id: input.vendorId,
      fuel_contract_id: input.fuelContractId ?? null,
      transaction_date: input.depositDate,
      transaction_type: "deposit",
      reference_id: data.id,
      credit: input.depositAmount,
      balance_after: currentBalance + input.depositAmount,
      created_by: actor.id,
    });
    return data;
  },
};
