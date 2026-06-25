import {
  Building2,
  CheckCircle2,
  FilePlus2,
  IndianRupee,
  ReceiptText,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { VendorStatusBadge } from "@/components/vendors/VendorStatusBadge";
import {
  VENDOR_PROCESSING_TYPE_LABELS,
  VENDOR_TYPE_LABELS,
  VENDOR_TYPES,
} from "@/constants/vendors";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import {
  calculateVendorBillTotal,
  vendorsService,
} from "@/services/vendorsService";
import {
  vendorBillSourceService,
  type VendorBillSourcePreview,
} from "@/services/vendorBillSourceService";
import type {
  Vendor,
  VendorBalance,
  VendorBill,
  VendorBillInput,
  VendorBillStatus,
  VendorInput,
  VendorLedgerEntry,
  VendorPaymentVoucher,
  VendorProcessingType,
  VendorSummary,
  VendorType,
} from "@/types/vendors";
import { formatCurrency } from "@/utils/format";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const initialVendor: VendorInput = {
  name: "",
  code: "",
  vendorType: "service",
  contactPerson: "",
  email: "",
  phone: "",
  gstNumber: "",
  address: "",
  paymentTerms: "15 days",
  status: "active",
};

function initialBill(vendorId = "vendor-buildmart", projectId = ""): VendorBillInput {
  return {
    vendorId,
    projectId,
    billType: "material",
    billingPeriodFrom: today(),
    billingPeriodTo: today(),
    invoiceNumber: "",
    invoiceDate: today(),
    baseAmount: 0,
    gstAmount: 0,
    otherCharges: 0,
    processingType: "none",
    processingAmount: 0,
  };
}

export function VendorsLandingPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [summary, setSummary] = useState<VendorSummary | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [vouchers, setVouchers] = useState<VendorPaymentVoucher[]>([]);
  const [ledger, setLedger] = useState<VendorLedgerEntry[]>([]);
  const [balances, setBalances] = useState<VendorBalance[]>([]);
  const [vendorForm, setVendorForm] = useState<VendorInput>(initialVendor);
  const [billForm, setBillForm] = useState<VendorBillInput>(initialBill());
  const [savingVendor, setSavingVendor] = useState(false);
  const [savingBill, setSavingBill] = useState<VendorBillStatus | null>(null);
  const [sourcePreview, setSourcePreview] =
    useState<VendorBillSourcePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const canManageVendors = user
    ? ["admin_hr", "super_admin"].includes(user.role)
    : false;
  const canVerify = user ? ["admin_hr", "super_admin"].includes(user.role) : false;
  const canApprove = user?.role === "super_admin";
  const canPay = user ? ["accounts_officer", "super_admin"].includes(user.role) : false;
  const billTotal = calculateVendorBillTotal(billForm);

  useEffect(() => {
    if (!user) {
      return;
    }
    void vendorsService.getDashboard(user).then((dashboard) => {
      setSummary(dashboard.summary);
      setVendors(dashboard.vendors);
      setBills(dashboard.bills);
      setVouchers(dashboard.vouchers);
      setLedger(dashboard.ledger);
      setBalances(dashboard.balances);
      setBillForm(initialBill(dashboard.vendors[0]?.id, projects[0]?.id));
    });
  }, [projects, user]);

  if (!user || !summary) {
    return null;
  }

  function reloadDashboard() {
    if (!user) {
      return;
    }
    void vendorsService.getDashboard(user).then((dashboard) => {
      setSummary(dashboard.summary);
      setVendors(dashboard.vendors);
      setBills(dashboard.bills);
      setVouchers(dashboard.vouchers);
      setLedger(dashboard.ledger);
      setBalances(dashboard.balances);
    });
  }

  function updateVendor<Key extends keyof VendorInput>(
    key: Key,
    value: VendorInput[Key],
  ) {
    setVendorForm((current) => ({ ...current, [key]: value }));
  }

  function updateBill<Key extends keyof VendorBillInput>(
    key: Key,
    value: VendorBillInput[Key],
  ) {
    setBillForm((current) => ({ ...current, [key]: value }));
  }

  async function saveVendor() {
    if (!user) {
      return;
    }
    setSavingVendor(true);
    try {
      await vendorsService.createVendor(vendorForm, user);
      setVendorForm(initialVendor);
      reloadDashboard();
      toast.success("Vendor created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save vendor.");
    } finally {
      setSavingVendor(false);
    }
  }

  async function saveBill(status: Extract<VendorBillStatus, "draft" | "submitted">) {
    if (!user) {
      return;
    }
    setSavingBill(status);
    try {
      await vendorsService.createBill(billForm, user, status);
      setBillForm(initialBill(vendors[0]?.id, projects[0]?.id));
      reloadDashboard();
      toast.success(
        status === "submitted" ? "Vendor bill submitted." : "Vendor bill draft saved.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save vendor bill.",
      );
    } finally {
      setSavingBill(null);
    }
  }

  async function previewSourceData() {
    if (!user) return;
    setPreviewing(true);
    try {
      const preview = await vendorBillSourceService.preview(billForm, user);
      setSourcePreview(preview);
      if (preview.grossAmount > 0) {
        setBillForm((current) => ({ ...current, baseAmount: preview.grossAmount }));
      }
      toast.success(
        preview.rows.length
          ? `${preview.rows.length} source record(s) loaded.`
          : "No matching source records found.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to preview source data.");
    } finally {
      setPreviewing(false);
    }
  }

  async function runAction(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      reloadDashboard();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update vendor.");
    }
  }

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Maintain vendor master data, bill processing, payment vouchers, settlements and vendor ledger balances."
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Vendors" }]}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          metric={{
            label: "Active vendors",
            value: String(summary.activeVendors),
            tone: "info",
          }}
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Pending bills",
            value: String(summary.pendingBills),
            tone: summary.pendingBills > 0 ? "warning" : "success",
          }}
          icon={<ReceiptText className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Outstanding",
            value: formatCurrency(summary.outstandingBalance),
            tone: summary.outstandingBalance > 0 ? "danger" : "success",
          }}
          icon={<IndianRupee className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Paid this month",
            value: formatCurrency(summary.paidThisMonth),
            tone: "success",
          }}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendor Master</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canManageVendors ? (
              <p className="rounded-lg border border-surface-border bg-slate-50 p-3 text-sm text-text-secondary">
                Vendor creation is available to Admin / HR and Super Admin.
              </p>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Vendor Name"
                value={vendorForm.name}
                disabled={!canManageVendors}
                onChange={(event) => updateVendor("name", event.target.value)}
              />
              <Input
                label="Code"
                value={vendorForm.code}
                disabled={!canManageVendors}
                onChange={(event) => updateVendor("code", event.target.value)}
              />
              <FormField label="Vendor Type">
                <select
                  className={selectClass}
                  value={vendorForm.vendorType}
                  disabled={!canManageVendors}
                  onChange={(event) =>
                    updateVendor("vendorType", event.target.value as VendorType)
                  }
                >
                  {VENDOR_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {VENDOR_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Contact Person"
                value={vendorForm.contactPerson}
                disabled={!canManageVendors}
                onChange={(event) =>
                  updateVendor("contactPerson", event.target.value)
                }
              />
              <Input
                label="Email"
                value={vendorForm.email}
                disabled={!canManageVendors}
                onChange={(event) => updateVendor("email", event.target.value)}
              />
              <Input
                label="Phone"
                value={vendorForm.phone}
                disabled={!canManageVendors}
                onChange={(event) => updateVendor("phone", event.target.value)}
              />
              <Input
                label="GST Number"
                value={vendorForm.gstNumber}
                disabled={!canManageVendors}
                onChange={(event) => updateVendor("gstNumber", event.target.value)}
              />
              <Input
                label="Payment Terms"
                value={vendorForm.paymentTerms}
                disabled={!canManageVendors}
                onChange={(event) =>
                  updateVendor("paymentTerms", event.target.value)
                }
              />
            </div>
            <Textarea
              label="Address"
              value={vendorForm.address}
              disabled={!canManageVendors}
              onChange={(event) => updateVendor("address", event.target.value)}
            />
            <Button
              type="button"
              disabled={!canManageVendors}
              isLoading={savingVendor}
              leftIcon={<Save className="h-4 w-4" />}
              onClick={() => void saveVendor()}
            >
              Save Vendor
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendor Bill</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Vendor">
                <select
                  className={selectClass}
                  value={billForm.vendorId}
                  onChange={(event) => updateBill("vendorId", event.target.value)}
                >
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Project">
                <select
                  className={selectClass}
                  value={billForm.projectId}
                  onChange={(event) => updateBill("projectId", event.target.value)}
                >
                  <option value="">Select assigned project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Bill Type">
                <select
                  className={selectClass}
                  value={billForm.billType}
                  onChange={(event) =>
                    updateBill("billType", event.target.value as VendorType)
                  }
                >
                  {VENDOR_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {VENDOR_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Invoice #"
                value={billForm.invoiceNumber}
                onChange={(event) => updateBill("invoiceNumber", event.target.value)}
              />
              <Input
                label="Period From"
                type="date"
                value={billForm.billingPeriodFrom}
                onChange={(event) =>
                  updateBill("billingPeriodFrom", event.target.value)
                }
              />
              <Input
                label="Period To"
                type="date"
                value={billForm.billingPeriodTo}
                onChange={(event) =>
                  updateBill("billingPeriodTo", event.target.value)
                }
              />
              <Input
                label="Invoice Date"
                type="date"
                value={billForm.invoiceDate}
                onChange={(event) => updateBill("invoiceDate", event.target.value)}
              />
              <Input
                label="Base Amount"
                type="number"
                min={0}
                value={billForm.baseAmount}
                onChange={(event) =>
                  updateBill("baseAmount", Number(event.target.value))
                }
              />
              <Input
                label="GST Amount"
                type="number"
                min={0}
                value={billForm.gstAmount}
                onChange={(event) =>
                  updateBill("gstAmount", Number(event.target.value))
                }
              />
              <Input
                label="Other Charges"
                type="number"
                min={0}
                value={billForm.otherCharges}
                onChange={(event) =>
                  updateBill("otherCharges", Number(event.target.value))
                }
              />
              <FormField label="Processing">
                <select
                  className={selectClass}
                  value={billForm.processingType}
                  onChange={(event) =>
                    updateBill(
                      "processingType",
                      event.target.value as VendorProcessingType,
                    )
                  }
                >
                  {Object.entries(VENDOR_PROCESSING_TYPE_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </FormField>
              <Input
                label="Processing Amount"
                type="number"
                min={0}
                value={billForm.processingAmount}
                onChange={(event) =>
                  updateBill("processingAmount", Number(event.target.value))
                }
              />
              <Input label="Total Amount" value={formatCurrency(billTotal)} readOnly />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                isLoading={previewing}
                onClick={() => void previewSourceData()}
              >
                Preview Source Data
              </Button>
              <Button
                type="button"
                variant="secondary"
                leftIcon={<Save className="h-4 w-4" />}
                isLoading={savingBill === "draft"}
                onClick={() => void saveBill("draft")}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                leftIcon={<FilePlus2 className="h-4 w-4" />}
                isLoading={savingBill === "submitted"}
                onClick={() => void saveBill("submitted")}
              >
                Submit Bill
              </Button>
            </div>
            {sourcePreview ? (
              <div className="rounded-lg border border-surface-border">
                <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
                  <p className="text-sm font-bold text-text-primary">Source Preview</p>
                  <Badge tone="info">
                    {sourcePreview.rows.length} rows · {formatCurrency(sourcePreview.grossAmount)}
                  </Badge>
                </div>
                <div className="max-h-64 overflow-auto">
                  <table className="min-w-full divide-y divide-surface-border text-xs">
                    <thead className="bg-slate-50 text-left text-text-secondary">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Source</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {sourcePreview.rows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2">{row.date}</td>
                          <td className="px-3 py-2">{row.description}</td>
                          <td className="px-3 py-2">{row.quantity} {row.unit}</td>
                          <td className="px-3 py-2">{formatCurrency(row.amount)}</td>
                          <td className="px-3 py-2">{row.sourceStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Vendor Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-border text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Bill</th>
                  <th className="px-4 py-3 font-semibold">Vendor</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border bg-white">
                {bills.map((bill) => (
                  <tr key={bill.id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-brand-blue">{bill.billNumber}</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {bill.invoiceNumber}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {bill.vendorName}
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      {formatCurrency(bill.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <VendorStatusBadge status={bill.status} kind="bill" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {bill.status === "submitted" && canVerify ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void runAction(
                                () => vendorsService.verifyBill(bill.id, user),
                                "Bill verified.",
                              )
                            }
                          >
                            Verify
                          </Button>
                        ) : null}
                        {bill.status === "verified" && canApprove ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void runAction(
                                () => vendorsService.approveBill(bill.id, user),
                                "Bill approved.",
                              )
                            }
                          >
                            Approve
                          </Button>
                        ) : null}
                        {bill.status === "approved" && canPay ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void runAction(
                                () =>
                                  vendorsService.generateVoucher(
                                    bill.id,
                                    user,
                                    "Generated from vendor bill register.",
                                  ),
                                "Voucher generated.",
                              )
                            }
                          >
                            Voucher
                          </Button>
                        ) : null}
                        {bill.status === "voucher_generated" && canPay ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const voucher = vouchers.find(
                                (item) => item.vendorBillId === bill.id,
                              );
                              if (!voucher) {
                                toast.error("Voucher not found.");
                                return;
                              }
                              void runAction(
                                () =>
                                  vendorsService.markVoucherPaid(
                                    voucher.id,
                                    user,
                                    `PAY-${bill.billNumber}`,
                                  ),
                                "Vendor payment processed.",
                              );
                            }}
                          >
                            Mark Paid
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendor Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {balances.map((balance) => (
              <div
                key={balance.vendorId}
                className="rounded-lg border border-surface-border p-4 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-text-primary">{balance.vendorName}</p>
                  <Badge tone="info">{VENDOR_TYPE_LABELS[balance.vendorType]}</Badge>
                </div>
                <p className="mt-2 text-text-secondary">
                  Billed {formatCurrency(balance.totalBilled)} - Paid{" "}
                  {formatCurrency(balance.totalPaid)}
                </p>
                <p className="mt-1 font-bold text-brand-blue">
                  Outstanding {formatCurrency(balance.outstandingBalance)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendor Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ledger.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-surface-border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-bold text-brand-blue">
                      {entry.billNumber ?? entry.voucherNumber ?? entry.type}
                    </p>
                    <span className="text-xs text-text-secondary">
                      {entry.createdAt.slice(0, 10)}
                    </span>
                  </div>
                  <p className="mt-1 font-semibold text-text-primary">
                    {entry.vendorName}
                  </p>
                  <p className="mt-1 text-text-secondary">{entry.description}</p>
                  <p className="mt-2 text-xs font-semibold text-text-primary">
                    Debit {formatCurrency(entry.debit)} / Credit{" "}
                    {formatCurrency(entry.credit)} / Balance{" "}
                    {formatCurrency(entry.balanceAfter)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
