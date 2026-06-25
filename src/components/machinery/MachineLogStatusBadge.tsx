import { Badge } from "@/components/ui/Badge";
import {
  MACHINE_LOG_STATUS_LABELS,
  MACHINE_LOG_STATUS_TONES,
} from "@/constants/machinery";
import type { MachineLogStatus } from "@/types/machinery";

export function MachineLogStatusBadge({ status }: { status: MachineLogStatus }) {
  return (
    <Badge tone={MACHINE_LOG_STATUS_TONES[status]}>
      {MACHINE_LOG_STATUS_LABELS[status]}
    </Badge>
  );
}
