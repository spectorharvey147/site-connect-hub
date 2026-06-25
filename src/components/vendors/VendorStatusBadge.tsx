import { Badge } from "@/components/ui/Badge";
import {
  VENDOR_BILL_STATUS_LABELS,
  VENDOR_STATUS_LABELS,
  VENDOR_STATUS_TONES,
  VENDOR_VOUCHER_STATUS_LABELS,
} from "@/constants/vendors";
import type {
  VendorBillStatus,
  VendorStatus,
  VendorVoucherStatus,
} from "@/types/vendors";

export function VendorStatusBadge({
  status,
  kind,
}: {
  status: VendorBillStatus | VendorVoucherStatus | VendorStatus;
  kind: "bill" | "voucher" | "vendor";
}) {
  const label =
    kind === "bill"
      ? VENDOR_BILL_STATUS_LABELS[status as VendorBillStatus]
      : kind === "voucher"
        ? VENDOR_VOUCHER_STATUS_LABELS[status as VendorVoucherStatus]
        : VENDOR_STATUS_LABELS[status as VendorStatus];

  return <Badge tone={VENDOR_STATUS_TONES[status]}>{label}</Badge>;
}
