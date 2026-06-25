import { Badge } from "@/components/ui/Badge";
import {
  FUEL_RECORD_STATUS_LABELS,
  FUEL_RECORD_STATUS_TONES,
} from "@/constants/fuel";
import type { FuelRecordStatus } from "@/types/fuel";

export function FuelStatusBadge({ status }: { status: FuelRecordStatus }) {
  return (
    <Badge tone={FUEL_RECORD_STATUS_TONES[status]}>
      {FUEL_RECORD_STATUS_LABELS[status]}
    </Badge>
  );
}
