import { Badge } from "@/components/ui/Badge";
import {
  DPR_STATUS_LABELS,
  DPR_STATUS_TONES,
} from "@/constants/fieldOperations";
import type { DprStatus } from "@/types/fieldOperations";

export function DprStatusBadge({ status }: { status: DprStatus }) {
  return <Badge tone={DPR_STATUS_TONES[status]}>{DPR_STATUS_LABELS[status]}</Badge>;
}
