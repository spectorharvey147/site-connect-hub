import { Badge } from "@/components/ui/Badge";
import {
  LABOUR_RECORD_STATUS_LABELS,
  LABOUR_RECORD_STATUS_TONES,
} from "@/constants/casualLabour";
import type { LabourRecordStatus } from "@/types/casualLabour";

export function LabourStatusBadge({ status }: { status: LabourRecordStatus }) {
  return (
    <Badge tone={LABOUR_RECORD_STATUS_TONES[status]}>
      {LABOUR_RECORD_STATUS_LABELS[status]}
    </Badge>
  );
}
