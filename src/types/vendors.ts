import type { Role } from "@/types/auth";

export type VendorType = "labor" | "machinery" | "fuel" | "material" | "service";
export type VendorStatus = "active" | "inactive";
export type VendorBillType = VendorType;
export type VendorBillStatus =
  | "draft"
  | "submitted"
  | "verified"
  | "approved"
  | "voucher_generated"
  | "partially_paid"
  | "paid"
  | "rejected";
export type VendorProcessingType = "none" | "addition" | "deduction";
export type VendorVoucherStatus = "generated" | "printed" | "paid" | "void";
export type VendorPaymentMethod = "bank_transfer" | "check" | "cash" | "online";
export type VendorPaymentStatus = "pending" | "processed" | "partial" | "void";
export type VendorLedgerType =
  | "bill_submitted"
  | "bill_verified"
  | "bill_approved"
  | "voucher_generated"
  | "payment"
  | "partial_payment"
  | "deduction"
  | "advance";

export interface Vendor {
  id: string;
  name: string;
  code: string;
  vendorType: VendorType;
  contactPerson: string;
  email: string;
  phone: string;
  gstNumber: string;
  address: string;
  paymentTerms: string;
  status: VendorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VendorInput {
  name: string;
  code: string;
  vendorType: VendorType;
  contactPerson: string;
  email: string;
  phone: string;
  gstNumber: string;
  address: string;
  paymentTerms: string;
  status: VendorStatus;
}

export interface VendorBill {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  projectId: string;
  projectName: string;
  billType: VendorBillType;
  billingPeriodFrom: string;
  billingPeriodTo: string;
  invoiceNumber: string;
  invoiceDate: string;
  baseAmount: number;
  gstAmount: number;
  otherCharges: number;
  processingType: VendorProcessingType;
  processingAmount: number;
  totalAmount: number;
  status: VendorBillStatus;
  submittedBy: string;
  submittedByName: string;
  submittedByRole: Role;
  submittedAt?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorBillInput {
  vendorId: string;
  projectId: string;
  billType: VendorBillType;
  billingPeriodFrom: string;
  billingPeriodTo: string;
  invoiceNumber: string;
  invoiceDate: string;
  baseAmount: number;
  gstAmount: number;
  otherCharges: number;
  processingType: VendorProcessingType;
  processingAmount: number;
}

export interface VendorPaymentVoucher {
  id: string;
  vendorBillId: string;
  vendorId: string;
  voucherNumber: string;
  voucherDate: string;
  paidToName: string;
  approvedAmount: number;
  deductionAmount: number;
  netPayableAmount: number;
  preparedBy: string;
  preparedByName: string;
  accountsNote: string;
  status: VendorVoucherStatus;
  createdAt: string;
  paidAt?: string;
  paymentReference?: string;
}

export interface VendorPayment {
  id: string;
  vendorId: string;
  vendorBillId: string;
  voucherId: string;
  amount: number;
  paymentMethod: VendorPaymentMethod;
  paymentDate: string;
  referenceNumber: string;
  status: VendorPaymentStatus;
  processedBy: string;
  processedByName: string;
  createdAt: string;
}

export interface VendorLedgerEntry {
  id: string;
  vendorId: string;
  vendorName: string;
  billId?: string;
  billNumber?: string;
  voucherId?: string;
  voucherNumber?: string;
  type: VendorLedgerType;
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  createdAt: string;
}

export interface VendorBalance {
  vendorId: string;
  vendorName: string;
  vendorType: VendorType;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  pendingBills: number;
}

export interface VendorSummary {
  totalVendors: number;
  activeVendors: number;
  pendingBills: number;
  outstandingBalance: number;
  paidThisMonth: number;
}
