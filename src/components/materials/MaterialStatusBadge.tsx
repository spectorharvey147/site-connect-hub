import { Badge } from "@/components/ui/Badge";
import {
  MATERIAL_RECEIPT_STATUS_LABELS,
  MATERIAL_REQUEST_STATUS_LABELS,
  MATERIAL_STATUS_TONES,
} from "@/constants/materials";
import type {
  MaterialReceiptStatus,
  MaterialRequestStatus,
} from "@/types/materials";

export function MaterialStatusBadge({
  status,
  kind,
}: {
  status: MaterialRequestStatus | MaterialReceiptStatus;
  kind: "request" | "receipt";
}) {
  const label =
    kind === "request"
      ? MATERIAL_REQUEST_STATUS_LABELS[status as MaterialRequestStatus]
      : MATERIAL_RECEIPT_STATUS_LABELS[status as MaterialReceiptStatus];

  return <Badge tone={MATERIAL_STATUS_TONES[status]}>{label}</Badge>;
}
