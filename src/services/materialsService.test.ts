import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import {
  buildInventoryRows,
  calculateRequestEstimatedCost,
  materialsService,
} from "@/services/materialsService";
import type { AppUser } from "@/types/auth";
import type { MaterialReceiptInput, MaterialRequestInput } from "@/types/materials";

function userByEmail(email: string): AppUser {
  const user = DEMO_USERS.find((item) => item.email === email);
  if (!user) {
    throw new Error(`Missing demo user ${email}`);
  }
  return toAppUser(user);
}

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };

  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
  });
}

function validRequest(): MaterialRequestInput {
  const item = materialsService.createRequestItem("material-cement-opc");
  return {
    projectId: "project-metro",
    requestDate: today(),
    requiredDate: today(),
    priority: "high",
    items: [
      {
        ...item,
        quantity: 25,
        specification: "OPC 53 grade",
        estimatedCost: 12000,
        remarks: "Test request",
      },
    ],
    attachments: ["test-spec.pdf"],
  };
}

function validReceipt(): MaterialReceiptInput {
  const item = materialsService.createReceiptItem("material-cement-opc");
  return {
    projectId: "project-metro",
    receiptDate: today(),
    vendorId: "vendor-buildmart",
    invoiceNumber: "TEST-INV-001",
    invoiceDate: today(),
    deliveryChallanNumber: "DC-TEST",
    items: [
      {
        ...item,
        quantityOrdered: 25,
        quantityReceived: 25,
        condition: "good",
        remarks: "Accepted",
      },
    ],
    checklist: {
      materialsChecked: true,
      quantitiesMatchInvoice: true,
      qualityAcceptable: true,
      invoiceMatched: true,
    },
    inspectorName: "Inspector",
    signatureName: "Inspector",
    attachments: ["receipt-photo.jpg"],
  };
}

describe("materialsService workflow", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    materialsService.resetDemoData();
  });

  it("calculates request estimate and inventory movement", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const requests = await materialsService.listRequests(siteUser);
    const receipts = await materialsService.listReceipts(siteUser);
    const inventory = buildInventoryRows(requests, receipts);

    expect(calculateRequestEstimatedCost(validRequest())).toBe(12000);
    expect(inventory.some((row) => row.materialName === "OPC Cement")).toBe(true);
  });

  it("validates permissions and dates", async () => {
    const accountsUser = userByEmail("accounts@siteconnect.local");
    const siteUser = userByEmail("site@siteconnect.local");

    await expect(
      materialsService.saveRequest(validRequest(), accountsUser, "draft"),
    ).rejects.toThrow("You do not have permission to save material requests.");

    await expect(
      materialsService.saveReceipt(
        { ...validReceipt(), receiptDate: "2099-01-01" },
        siteUser,
        "draft",
      ),
    ).rejects.toThrow("Material receipt date cannot be in the future.");
  });

  it("submits, approves, receives and verifies materials", async () => {
    const siteUser = userByEmail("site@siteconnect.local");
    const manager = userByEmail("manager@siteconnect.local");

    const request = await materialsService.saveRequest(
      validRequest(),
      siteUser,
      "submitted",
    );
    const approved = await materialsService.approveRequest(request.id, manager);
    const receipt = await materialsService.saveReceipt(
      { ...validReceipt(), linkedRequestId: approved.id },
      siteUser,
      "received",
    );
    const verified = await materialsService.verifyReceipt(receipt.id, manager);

    expect(request.requestNumber).toBe("MR-2026-0003");
    expect(approved.status).toBe("approved");
    expect(receipt.receiptNumber).toBe("MRC-2026-0002");
    expect(verified.status).toBe("verified");
  });
});
