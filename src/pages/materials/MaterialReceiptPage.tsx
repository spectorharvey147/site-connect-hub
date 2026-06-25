import { FilePlus2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { MaterialReceiptTable } from "@/components/materials/MaterialReceiptTable";
import { FileUpload } from "@/components/shared/FileUpload";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  MATERIAL_CONDITIONS,
  MATERIAL_CONDITION_LABELS,
  MATERIAL_MASTER,
  MATERIAL_VENDORS,
} from "@/constants/materials";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import { materialsService } from "@/services/materialsService";
import type { StoredFile } from "@/services/storageService";
import type {
  InspectionChecklist,
  MaterialCondition,
  MaterialReceipt,
  MaterialReceiptInput,
  MaterialReceiptItem,
  MaterialReceiptStatus,
  MaterialRequest,
} from "@/types/materials";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function initialChecklist(): InspectionChecklist {
  return {
    materialsChecked: true,
    quantitiesMatchInvoice: true,
    qualityAcceptable: true,
    invoiceMatched: true,
  };
}

function initialForm(projectId = ""): MaterialReceiptInput {
  return {
    linkedRequestId: "",
    projectId,
    receiptDate: today(),
    vendorId: MATERIAL_VENDORS[0]?.id ?? "",
    invoiceNumber: "",
    invoiceDate: today(),
    deliveryChallanNumber: "",
    items: [materialsService.createReceiptItem()],
    checklist: initialChecklist(),
    inspectorName: "",
    signatureName: "",
    attachments: [],
  };
}

export function MaterialReceiptPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [receipts, setReceipts] = useState<MaterialReceipt[]>([]);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [form, setForm] = useState<MaterialReceiptInput>(initialForm);
  const [attachments, setAttachments] = useState<StoredFile[]>([]);
  const [saving, setSaving] = useState<MaterialReceiptStatus | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    void materialsService.listReceipts(user).then(setReceipts);
    void materialsService
      .listRequests(user)
      .then((items) =>
        setRequests(items.filter((item) => ["approved", "submitted"].includes(item.status))),
      );
  }, [user]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      projectId: projects.some((project) => project.id === current.projectId)
        ? current.projectId
        : projects[0]?.id ?? "",
    }));
  }, [projects]);

  if (!user) {
    return null;
  }

  function update<Key extends keyof MaterialReceiptInput>(
    key: Key,
    value: MaterialReceiptInput[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateItem(
    itemId: string,
    updater: (item: MaterialReceiptItem) => MaterialReceiptItem,
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? updater(item) : item)),
    }));
  }

  function selectMaterial(itemId: string, materialId: string) {
    const material = MATERIAL_MASTER.find((item) => item.id === materialId);
    if (!material) {
      return;
    }
    updateItem(itemId, (item) => ({
      ...item,
      materialId: material.id,
      materialName: material.name,
      uom: material.uom,
    }));
  }

  function selectRequest(requestId: string) {
    const request = requests.find((item) => item.id === requestId);
    if (!request) {
      update("linkedRequestId", "");
      return;
    }
    setForm((current) => ({
      ...current,
      linkedRequestId: request.id,
      projectId: request.projectId,
      items: request.items.map((item) => ({
        id: crypto.randomUUID(),
        materialId: item.materialId,
        materialName: item.materialName,
        quantityOrdered: item.quantity,
        quantityReceived: item.quantity,
        uom: item.uom,
        condition: "good",
        remarks: "",
      })),
    }));
  }

  function updateChecklist(key: keyof InspectionChecklist, value: boolean) {
    setForm((current) => ({
      ...current,
      checklist: { ...current.checklist, [key]: value },
    }));
  }

  async function save(status: Extract<MaterialReceiptStatus, "draft" | "received">) {
    if (!user) {
      return;
    }
    setSaving(status);
    try {
      const receipt = await materialsService.saveReceipt(
        {
          ...form,
          attachments: attachments.map((file) => file.signedUrl ?? file.path),
        },
        user,
        status,
      );
      setReceipts((current) => [receipt, ...current]);
      setForm(initialForm(projects[0]?.id));
      setAttachments([]);
      toast.success(
        status === "received"
          ? "Materials received."
          : "Material receipt draft saved.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save material receipt.",
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Material Receipt"
        description="Record supplier invoices, received quantities, quality condition, inspection checklist and receipt attachments."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Materials", to: "/materials" },
          { label: "Receipt" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Receipt Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Linked Request">
                <select
                  className={selectClass}
                  value={form.linkedRequestId ?? ""}
                  onChange={(event) => selectRequest(event.target.value)}
                >
                  <option value="">No linked request</option>
                  {requests.map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.requestNumber}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Project / Site">
                <select
                  className={selectClass}
                  value={form.projectId}
                  onChange={(event) => update("projectId", event.target.value)}
                >
                  <option value="">Select assigned project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Receipt Date"
                type="date"
                value={form.receiptDate}
                onChange={(event) => update("receiptDate", event.target.value)}
              />
              <FormField label="Supplier / Vendor">
                <select
                  className={selectClass}
                  value={form.vendorId}
                  onChange={(event) => update("vendorId", event.target.value)}
                >
                  {MATERIAL_VENDORS.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Invoice #"
                value={form.invoiceNumber}
                onChange={(event) => update("invoiceNumber", event.target.value)}
              />
              <Input
                label="Invoice Date"
                type="date"
                value={form.invoiceDate}
                onChange={(event) => update("invoiceDate", event.target.value)}
              />
              <Input
                label="Delivery Challan #"
                value={form.deliveryChallanNumber}
                onChange={(event) =>
                  update("deliveryChallanNumber", event.target.value)
                }
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-text-primary">
                  Material Received
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() =>
                    update("items", [
                      ...form.items,
                      materialsService.createReceiptItem(),
                    ])
                  }
                >
                  Add Material
                </Button>
              </div>
              {form.items.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-4 rounded-lg border border-surface-border p-4 md:grid-cols-3"
                >
                  <FormField label={`Material ${index + 1}`}>
                    <select
                      className={selectClass}
                      value={item.materialId}
                      onChange={(event) =>
                        selectMaterial(item.id, event.target.value)
                      }
                    >
                      {MATERIAL_MASTER.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <Input
                    label="Qty Ordered"
                    type="number"
                    min={0}
                    value={item.quantityOrdered}
                    onChange={(event) =>
                      updateItem(item.id, (current) => ({
                        ...current,
                        quantityOrdered: Number(event.target.value),
                      }))
                    }
                  />
                  <Input
                    label="Qty Received"
                    type="number"
                    min={0}
                    value={item.quantityReceived}
                    onChange={(event) =>
                      updateItem(item.id, (current) => ({
                        ...current,
                        quantityReceived: Number(event.target.value),
                      }))
                    }
                  />
                  <Input label="UOM" value={item.uom} readOnly />
                  <FormField label="Condition">
                    <select
                      className={selectClass}
                      value={item.condition}
                      onChange={(event) =>
                        updateItem(item.id, (current) => ({
                          ...current,
                          condition: event.target.value as MaterialCondition,
                        }))
                      }
                    >
                      {MATERIAL_CONDITIONS.map((condition) => (
                        <option key={condition} value={condition}>
                          {MATERIAL_CONDITION_LABELS[condition]}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      leftIcon={<Trash2 className="h-4 w-4" />}
                      onClick={() =>
                        update(
                          "items",
                          form.items.filter((current) => current.id !== item.id),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="md:col-span-3">
                    <Input
                      label="Remarks"
                      value={item.remarks}
                      onChange={(event) =>
                        updateItem(item.id, (current) => ({
                          ...current,
                          remarks: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                ["materialsChecked", "All materials checked"],
                ["quantitiesMatchInvoice", "Quantities match invoice"],
                ["qualityAcceptable", "Quality acceptable"],
                ["invoiceMatched", "Invoice matched"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-lg border border-surface-border p-3 text-sm font-semibold text-text-primary"
                >
                  <input
                    type="checkbox"
                    checked={form.checklist[key as keyof InspectionChecklist]}
                    onChange={(event) =>
                      updateChecklist(
                        key as keyof InspectionChecklist,
                        event.target.checked,
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Inspector Name"
                value={form.inspectorName}
                onChange={(event) => update("inspectorName", event.target.value)}
              />
              <Input
                label="Inspector Signature"
                value={form.signatureName}
                onChange={(event) => update("signatureName", event.target.value)}
              />
            </div>
            <FileUpload
              bucket="material-documents"
              folder="receipts"
              accept="image/*,.pdf"
              value={attachments}
              onChange={setAttachments}
            />

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<Save className="h-4 w-4" />}
                isLoading={saving === "draft"}
                onClick={() => void save("draft")}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                leftIcon={<FilePlus2 className="h-4 w-4" />}
                isLoading={saving === "received"}
                onClick={() => void save("received")}
              >
                Receive Materials
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receipt Register</CardTitle>
          </CardHeader>
          <CardContent>
            <MaterialReceiptTable receipts={receipts} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
