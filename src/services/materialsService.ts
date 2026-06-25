import { PROJECT_OPTIONS } from "@/constants/claims";
import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { MATERIAL_MASTER, MATERIAL_VENDORS } from "@/constants/materials";
import { recordAuditLog } from "@/services/auditService";
import { materialsRepository } from "@/services/materialsRepository";
import { isSupabaseConfigured } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type {
  MaterialInventoryRow,
  MaterialReceipt,
  MaterialReceiptInput,
  MaterialReceiptItem,
  MaterialReceiptStatus,
  MaterialRequest,
  MaterialRequestInput,
  MaterialRequestItem,
  MaterialRequestStatus,
  MaterialConsumptionInput,
  MaterialDamageWastageInput,
  MaterialsFilters,
  MaterialsSummary,
} from "@/types/materials";

const MATERIAL_REQUESTS_STORAGE_KEY = "site-connect:material-requests";
const MATERIAL_RECEIPTS_STORAGE_KEY = "site-connect:material-receipts";

let memoryRequests: MaterialRequest[] | null = null;
let memoryReceipts: MaterialReceipt[] | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function now() {
  return new Date().toISOString();
}

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getProjectName(projectId: string) {
  if (isSupabaseConfigured) {
    throw new Error("Production project names must come from Supabase.");
  }
  return (
    PROJECT_OPTIONS.find((project) => project.id === projectId)?.name ??
    "Unknown project"
  );
}

function getMaterial(materialId: string) {
  const material = MATERIAL_MASTER.find((item) => item.id === materialId);
  if (!material) {
    throw new Error("Material not found.");
  }
  return material;
}

function getVendor(vendorId: string) {
  const vendor = MATERIAL_VENDORS.find((item) => item.id === vendorId);
  if (!vendor) {
    throw new Error("Material vendor not found.");
  }
  return vendor;
}

function getDemoUser(email: string) {
  const user = DEMO_USERS.find((item) => item.email === email);
  if (!user) {
    throw new Error(`Missing demo user: ${email}`);
  }
  return toAppUser(user);
}

function readCollection<T>(key: string, seed: () => T[], memory: T[] | null) {
  if (isSupabaseConfigured) {
    return memory ?? [];
  }
  if (!isBrowser()) {
    return memory ?? seed();
  }
  const stored = window.localStorage.getItem(key);
  if (!stored) {
    const seeded = seed();
    window.localStorage.setItem(key, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return JSON.parse(stored) as T[];
  } catch {
    const seeded = seed();
    window.localStorage.setItem(key, JSON.stringify(seeded));
    return seeded;
  }
}

function writeCollection<T>(key: string, value: T[]) {
  if (isSupabaseConfigured) {
    return;
  }
  if (isBrowser()) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function requestItem(
  materialId: string,
  quantity: number,
  overrides: Partial<MaterialRequestItem> = {},
): MaterialRequestItem {
  const material = getMaterial(materialId);
  return {
    id: crypto.randomUUID(),
    materialId: material.id,
    materialName: material.name,
    quantity,
    uom: material.uom,
    specification: "",
    estimatedCost: 0,
    remarks: "",
    ...overrides,
  };
}

function receiptItem(
  materialId: string,
  quantityOrdered: number,
  quantityReceived: number,
  overrides: Partial<MaterialReceiptItem> = {},
): MaterialReceiptItem {
  const material = getMaterial(materialId);
  return {
    id: crypto.randomUUID(),
    materialId: material.id,
    materialName: material.name,
    quantityOrdered,
    quantityReceived,
    uom: material.uom,
    condition: "good",
    remarks: "",
    ...overrides,
  };
}

function seedRequests(): MaterialRequest[] {
  const siteUser = getDemoUser("site@siteconnect.local");
  const manager = getDemoUser("manager@siteconnect.local");
  return [
    {
      id: "material-request-demo-001",
      requestNumber: "MR-2026-0001",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      requestDate: "2026-06-19",
      requiredDate: "2026-06-22",
      priority: "high",
      items: [
        requestItem("material-cement-opc", 120, {
          id: "material-request-item-demo-001",
          specification: "OPC 53 grade",
          estimatedCost: 54000,
          remarks: "For pile cap pour.",
        }),
        requestItem("material-tmt-16mm", 1800, {
          id: "material-request-item-demo-002",
          specification: "Fe500D",
          estimatedCost: 115000,
          remarks: "For pier reinforcement.",
        }),
      ],
      attachments: ["pour-schedule.pdf"],
      approverId: manager.id,
      approverName: manager.fullName,
      status: "approved",
      requestedBy: siteUser.id,
      requestedByName: siteUser.fullName,
      requestedByRole: siteUser.role,
      submittedAt: "2026-06-19T10:30:00.000Z",
      approvedBy: manager.id,
      approvedByName: manager.fullName,
      approvedAt: "2026-06-19T15:00:00.000Z",
      createdAt: "2026-06-19T10:30:00.000Z",
      updatedAt: "2026-06-19T15:00:00.000Z",
    },
    {
      id: "material-request-demo-002",
      requestNumber: "MR-2026-0002",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      requestDate: "2026-06-20",
      requiredDate: "2026-06-23",
      priority: "medium",
      items: [
        requestItem("material-river-sand", 500, {
          id: "material-request-item-demo-003",
          specification: "Washed river sand",
          estimatedCost: 30000,
          remarks: "For blockwork mortar.",
        }),
      ],
      attachments: [],
      approverId: manager.id,
      approverName: manager.fullName,
      status: "submitted",
      requestedBy: siteUser.id,
      requestedByName: siteUser.fullName,
      requestedByRole: siteUser.role,
      submittedAt: "2026-06-20T11:10:00.000Z",
      createdAt: "2026-06-20T11:10:00.000Z",
      updatedAt: "2026-06-20T11:10:00.000Z",
    },
  ];
}

function seedReceipts(): MaterialReceipt[] {
  const siteUser = getDemoUser("site@siteconnect.local");
  return [
    {
      id: "material-receipt-demo-001",
      receiptNumber: "MRC-2026-0001",
      linkedRequestId: "material-request-demo-001",
      linkedRequestNumber: "MR-2026-0001",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      receiptDate: "2026-06-20",
      vendorId: "vendor-buildmart",
      vendorName: "BuildMart Supplies",
      invoiceNumber: "BM-8891",
      invoiceDate: "2026-06-20",
      deliveryChallanNumber: "DC-771",
      items: [
        receiptItem("material-cement-opc", 120, 120, {
          id: "material-receipt-item-demo-001",
          condition: "good",
          remarks: "Stacked in covered store.",
        }),
        receiptItem("material-tmt-16mm", 1800, 1750, {
          id: "material-receipt-item-demo-002",
          condition: "partial",
          remarks: "Balance 50 KG expected tomorrow.",
        }),
      ],
      checklist: {
        materialsChecked: true,
        quantitiesMatchInvoice: true,
        qualityAcceptable: true,
        invoiceMatched: true,
      },
      inspectorName: siteUser.fullName,
      signatureName: siteUser.fullName,
      attachments: ["cement-receipt-photo.jpg"],
      status: "received",
      receivedBy: siteUser.id,
      receivedByName: siteUser.fullName,
      receivedByRole: siteUser.role,
      receivedAt: "2026-06-20T16:20:00.000Z",
      createdAt: "2026-06-20T16:20:00.000Z",
      updatedAt: "2026-06-20T16:20:00.000Z",
    },
  ];
}

function readRequests() {
  const requests = readCollection(
    MATERIAL_REQUESTS_STORAGE_KEY,
    seedRequests,
    memoryRequests,
  );
  memoryRequests = requests;
  return requests;
}

function writeRequests(requests: MaterialRequest[]) {
  memoryRequests = requests;
  writeCollection(MATERIAL_REQUESTS_STORAGE_KEY, requests);
}

function readReceipts() {
  const receipts = readCollection(
    MATERIAL_RECEIPTS_STORAGE_KEY,
    seedReceipts,
    memoryReceipts,
  );
  memoryReceipts = receipts;
  return receipts;
}

function writeReceipts(receipts: MaterialReceipt[]) {
  memoryReceipts = receipts;
  writeCollection(MATERIAL_RECEIPTS_STORAGE_KEY, receipts);
}

function nextRequestNumber(requests: MaterialRequest[]) {
  const next =
    requests
      .map((request) => Number(request.requestNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `MR-2026-${String(next).padStart(4, "0")}`;
}

function nextReceiptNumber(receipts: MaterialReceipt[]) {
  const next =
    receipts
      .map((receipt) => Number(receipt.receiptNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `MRC-2026-${String(next).padStart(4, "0")}`;
}

function canUseMaterials(user: AppUser) {
  return ["site_staff", "manager", "admin_hr", "super_admin"].includes(user.role);
}

function canViewProject(user: AppUser, projectId: string) {
  if (["admin_hr", "super_admin"].includes(user.role)) {
    return true;
  }
  return user.projectIds.includes(projectId);
}

function canApproveMaterials(user: AppUser, projectId: string) {
  if (["admin_hr", "super_admin"].includes(user.role)) {
    return true;
  }
  return user.role === "manager" && user.projectIds.includes(projectId);
}

function applyRequestFilters(
  requests: MaterialRequest[],
  filters?: MaterialsFilters,
) {
  return requests.filter((request) => {
    if (filters?.projectId && request.projectId !== filters.projectId) {
      return false;
    }
    if (
      filters?.priority &&
      filters.priority !== "all" &&
      request.priority !== filters.priority
    ) {
      return false;
    }
    if (
      filters?.status &&
      filters.status !== "all" &&
      request.status !== filters.status
    ) {
      return false;
    }
    if (filters?.search?.trim()) {
      const query = filters.search.trim().toLowerCase();
      const haystack = [
        request.requestNumber,
        request.projectName,
        request.requestedByName,
        ...request.items.map((item) => item.materialName),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    }
    return true;
  });
}

function applyReceiptFilters(
  receipts: MaterialReceipt[],
  filters?: MaterialsFilters,
) {
  return receipts.filter((receipt) => {
    if (filters?.projectId && receipt.projectId !== filters.projectId) {
      return false;
    }
    if (
      filters?.status &&
      filters.status !== "all" &&
      receipt.status !== filters.status
    ) {
      return false;
    }
    if (filters?.search?.trim()) {
      const query = filters.search.trim().toLowerCase();
      const haystack = [
        receipt.receiptNumber,
        receipt.invoiceNumber,
        receipt.vendorName,
        ...receipt.items.map((item) => item.materialName),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    }
    return true;
  });
}

function validateRequest(
  input: MaterialRequestInput,
  status: MaterialRequestStatus,
) {
  if (input.requestDate > today()) {
    throw new Error("Material request date cannot be in the future.");
  }
  if (input.requiredDate < input.requestDate) {
    throw new Error("Required date cannot be before request date.");
  }
  if (status === "submitted" && input.items.length === 0) {
    throw new Error("Add at least one material item before submitting request.");
  }
  for (const item of input.items) {
    if (!item.materialId) {
      throw new Error("Every request item needs a material.");
    }
    if (item.quantity < 0 || item.estimatedCost < 0) {
      throw new Error("Material quantities and estimated costs must be non-negative.");
    }
    if (status === "submitted" && item.quantity <= 0) {
      throw new Error("Submitted request items must have positive quantity.");
    }
  }
}

function validateReceipt(
  input: MaterialReceiptInput,
  status: MaterialReceiptStatus,
) {
  if (input.receiptDate > today()) {
    throw new Error("Material receipt date cannot be in the future.");
  }
  if (input.invoiceDate > input.receiptDate) {
    throw new Error("Invoice date cannot be after receipt date.");
  }
  if (status === "received" && input.items.length === 0) {
    throw new Error("Add at least one received material item.");
  }
  for (const item of input.items) {
    if (item.quantityOrdered < 0 || item.quantityReceived < 0) {
      throw new Error("Material receipt quantities must be non-negative.");
    }
  }
  if (
    status === "received" &&
    (!input.checklist.materialsChecked ||
      !input.checklist.quantitiesMatchInvoice ||
      !input.checklist.qualityAcceptable ||
      !input.checklist.invoiceMatched)
  ) {
    throw new Error("Complete the inspection checklist before receiving materials.");
  }
}

function summarize(
  requests: MaterialRequest[],
  receipts: MaterialReceipt[],
): MaterialsSummary {
  const month = today().slice(0, 7);
  return {
    openRequests: requests.filter((request) =>
      ["submitted", "approved"].includes(request.status),
    ).length,
    approvedRequests: requests.filter((request) => request.status === "approved").length,
    receivedThisMonth: receipts.filter((receipt) =>
      receipt.receiptDate.startsWith(month),
    ).length,
    damagedReceipts: receipts.reduce(
      (total, receipt) =>
        total + receipt.items.filter((item) => item.condition === "damaged").length,
      0,
    ),
    estimatedOpenCost: requests
      .filter((request) => ["submitted", "approved"].includes(request.status))
      .reduce((total, request) => total + calculateRequestEstimatedCost(request), 0),
  };
}

export function calculateRequestEstimatedCost(
  request: Pick<MaterialRequest, "items">,
) {
  return request.items.reduce((total, item) => total + item.estimatedCost, 0);
}

export function buildInventoryRows(
  requests: MaterialRequest[],
  receipts: MaterialReceipt[],
): MaterialInventoryRow[] {
  return MATERIAL_MASTER.map((material) => {
    const requestedQuantity = requests
      .flatMap((request) => request.items)
      .filter((item) => item.materialId === material.id)
      .reduce((total, item) => total + item.quantity, 0);
    const estimatedCost = requests
      .flatMap((request) => request.items)
      .filter((item) => item.materialId === material.id)
      .reduce((total, item) => total + item.estimatedCost, 0);
    const receiptItems = receipts
      .flatMap((receipt) => receipt.items)
      .filter((item) => item.materialId === material.id);
    const receivedQuantity = receiptItems.reduce(
      (total, item) => total + item.quantityReceived,
      0,
    );
    const damagedQuantity = receiptItems
      .filter((item) => item.condition === "damaged")
      .reduce((total, item) => total + item.quantityReceived, 0);
    return {
      materialId: material.id,
      materialName: material.name,
      uom: material.uom,
      requestedQuantity,
      receivedQuantity,
      damagedQuantity,
      openQuantity: Math.max(0, requestedQuantity - receivedQuantity),
      estimatedCost,
    };
  }).filter(
    (row) =>
      row.requestedQuantity > 0 ||
      row.receivedQuantity > 0 ||
      row.damagedQuantity > 0,
  );
}

export const materialsService = {
  listMaterials() {
    return MATERIAL_MASTER.filter((material) => material.status === "active");
  },

  listVendors() {
    return MATERIAL_VENDORS.filter((vendor) => vendor.status === "active");
  },

  createRequestItem(materialId?: string): MaterialRequestItem {
    const material = getMaterial(materialId ?? MATERIAL_MASTER[0].id);
    return requestItem(material.id, 0);
  },

  createReceiptItem(materialId?: string): MaterialReceiptItem {
    const material = getMaterial(materialId ?? MATERIAL_MASTER[0].id);
    return receiptItem(material.id, 0, 0);
  },

  async listRequests(user: AppUser, filters?: MaterialsFilters) {
    if (!canUseMaterials(user)) {
      throw new Error("You do not have permission to view material requests.");
    }
    const stored = isSupabaseConfigured
      ? await materialsRepository.listRequests(user, filters)
      : readRequests();
    memoryRequests = stored;
    const visible = stored.filter((request) =>
      canViewProject(user, request.projectId),
    );
    return applyRequestFilters(visible, filters).sort((left, right) =>
      right.requestDate.localeCompare(left.requestDate) ||
      right.updatedAt.localeCompare(left.updatedAt),
    );
  },

  async listReceipts(user: AppUser, filters?: MaterialsFilters) {
    if (!canUseMaterials(user)) {
      throw new Error("You do not have permission to view material receipts.");
    }
    const stored = isSupabaseConfigured
      ? await materialsRepository.listReceipts(user, filters)
      : readReceipts();
    memoryReceipts = stored;
    const visible = stored.filter((receipt) =>
      canViewProject(user, receipt.projectId),
    );
    return applyReceiptFilters(visible, filters).sort((left, right) =>
      right.receiptDate.localeCompare(left.receiptDate) ||
      right.updatedAt.localeCompare(left.updatedAt),
    );
  },

  async getDashboard(user: AppUser) {
    const requests = await this.listRequests(user);
    const receipts = await this.listReceipts(user);
    return {
      summary: summarize(requests, receipts),
      recentRequests: requests.slice(0, 6),
      recentReceipts: receipts.slice(0, 6),
      inventory: buildInventoryRows(requests, receipts),
    };
  },

  async saveRequest(
    input: MaterialRequestInput,
    actor: AppUser,
    status: Extract<MaterialRequestStatus, "draft" | "submitted">,
  ) {
    if (!canUseMaterials(actor)) {
      throw new Error("You do not have permission to save material requests.");
    }
    validateRequest(input, status);
    if (isSupabaseConfigured) {
      const request = await materialsRepository.saveRequest(input, actor, status);
      memoryRequests = [request, ...(memoryRequests ?? []).filter((item) => item.id !== request.id)];
      return request;
    }
    const manager = DEMO_USERS.find((user) => user.role === "manager");
    const requests = readRequests();
    const createdAt = now();
    const request: MaterialRequest = {
      id: crypto.randomUUID(),
      requestNumber: nextRequestNumber(requests),
      projectId: input.projectId,
      projectName: getProjectName(input.projectId),
      requestDate: input.requestDate,
      requiredDate: input.requiredDate,
      priority: input.priority,
      items: input.items,
      attachments: input.attachments,
      approverId: manager?.id,
      approverName: manager?.fullName,
      status,
      requestedBy: actor.id,
      requestedByName: actor.fullName,
      requestedByRole: actor.role,
      submittedAt: status === "submitted" ? createdAt : undefined,
      createdAt,
      updatedAt: createdAt,
    };
    writeRequests([request, ...requests]);
    await recordAuditLog({
      userId: actor.id,
      action:
        status === "submitted"
          ? "materials.request_submitted"
          : "materials.request_draft_saved",
      entityType: "material_request",
      entityId: request.id,
      newValues: {
        requestNumber: request.requestNumber,
        projectId: request.projectId,
        priority: request.priority,
        status: request.status,
      },
    });
    return request;
  },

  async approveRequest(requestId: string, actor: AppUser) {
    if (isSupabaseConfigured) {
      const updated = await materialsRepository.approveRequest(requestId, actor);
      memoryRequests = (memoryRequests ?? []).map((item) =>
        item.id === requestId ? updated : item,
      );
      return updated;
    }
    const requests = readRequests();
    const request = requests.find((item) => item.id === requestId);
    if (!request) {
      throw new Error("Material request not found.");
    }
    if (!canApproveMaterials(actor, request.projectId)) {
      throw new Error("You do not have permission to approve this material request.");
    }
    const approvedAt = now();
    const updated: MaterialRequest = {
      ...request,
      status: "approved",
      approvedBy: actor.id,
      approvedByName: actor.fullName,
      approvedAt,
      updatedAt: approvedAt,
    };
    writeRequests(requests.map((item) => (item.id === requestId ? updated : item)));
    return updated;
  },

  async saveReceipt(
    input: MaterialReceiptInput,
    actor: AppUser,
    status: Extract<MaterialReceiptStatus, "draft" | "received">,
  ) {
    if (!canUseMaterials(actor)) {
      throw new Error("You do not have permission to save material receipts.");
    }
    validateReceipt(input, status);
    if (isSupabaseConfigured) {
      const receipt = await materialsRepository.saveReceipt(input, actor, status);
      memoryReceipts = [receipt, ...(memoryReceipts ?? []).filter((item) => item.id !== receipt.id)];
      return receipt;
    }
    const vendor = getVendor(input.vendorId);
    const linkedRequest = input.linkedRequestId
      ? readRequests().find((request) => request.id === input.linkedRequestId)
      : undefined;
    const receipts = readReceipts();
    const createdAt = now();
    const receipt: MaterialReceipt = {
      id: crypto.randomUUID(),
      receiptNumber: nextReceiptNumber(receipts),
      linkedRequestId: linkedRequest?.id,
      linkedRequestNumber: linkedRequest?.requestNumber,
      projectId: input.projectId,
      projectName: getProjectName(input.projectId),
      receiptDate: input.receiptDate,
      vendorId: vendor.id,
      vendorName: vendor.name,
      invoiceNumber: input.invoiceNumber.trim(),
      invoiceDate: input.invoiceDate,
      deliveryChallanNumber: input.deliveryChallanNumber.trim(),
      items: input.items,
      checklist: input.checklist,
      inspectorName: input.inspectorName.trim(),
      signatureName: input.signatureName.trim(),
      attachments: input.attachments,
      status,
      receivedBy: actor.id,
      receivedByName: actor.fullName,
      receivedByRole: actor.role,
      receivedAt: status === "received" ? createdAt : undefined,
      createdAt,
      updatedAt: createdAt,
    };
    writeReceipts([receipt, ...receipts]);
    if (linkedRequest && status === "received") {
      const requests = readRequests();
      const updatedRequests: MaterialRequest[] = requests.map((request) =>
          request.id === linkedRequest.id
            ? { ...request, status: "received" as const, updatedAt: createdAt }
            : request,
        );
      writeRequests(updatedRequests);
    }
    await recordAuditLog({
      userId: actor.id,
      action:
        status === "received"
          ? "materials.receipt_received"
          : "materials.receipt_draft_saved",
      entityType: "material_receipt",
      entityId: receipt.id,
      newValues: {
        receiptNumber: receipt.receiptNumber,
        projectId: receipt.projectId,
        vendorId: receipt.vendorId,
        status: receipt.status,
      },
    });
    return receipt;
  },

  async verifyReceipt(receiptId: string, actor: AppUser) {
    if (isSupabaseConfigured) {
      const updated = await materialsRepository.verifyReceipt(receiptId, actor);
      memoryReceipts = (memoryReceipts ?? []).map((item) =>
        item.id === receiptId ? updated : item,
      );
      return updated;
    }
    const receipts = readReceipts();
    const receipt = receipts.find((item) => item.id === receiptId);
    if (!receipt) {
      throw new Error("Material receipt not found.");
    }
    if (!canApproveMaterials(actor, receipt.projectId)) {
      throw new Error("You do not have permission to verify this material receipt.");
    }
    const verifiedAt = now();
    const updated: MaterialReceipt = {
      ...receipt,
      status: "verified",
      verifiedBy: actor.id,
      verifiedByName: actor.fullName,
      verifiedAt,
      updatedAt: verifiedAt,
    };
    writeReceipts(receipts.map((item) => (item.id === receiptId ? updated : item)));
    return updated;
  },

  async saveConsumption(input: MaterialConsumptionInput, actor: AppUser) {
    if (!isSupabaseConfigured) {
      throw new Error("Material consumption ledger requires Supabase.");
    }
    return materialsRepository.saveConsumption(input, actor);
  },

  async saveDamageWastage(input: MaterialDamageWastageInput, actor: AppUser) {
    if (!isSupabaseConfigured) {
      throw new Error("Material damage/wastage ledger requires Supabase.");
    }
    return materialsRepository.saveDamageWastage(input, actor);
  },

  async listStockLedger(actor: AppUser, projectId?: string) {
    if (!isSupabaseConfigured) return [];
    return materialsRepository.listStockLedger(actor, projectId);
  },

  resetDemoData() {
    writeRequests(seedRequests());
    writeReceipts(seedReceipts());
  },
};

export type { MaterialReceiptItem, MaterialRequestItem };
