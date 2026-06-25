import { Badge } from "@/components/ui/Badge";
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_TONES } from "@/constants/leave";
import type { LeaveStatus } from "@/types/leave";

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge tone={LEAVE_STATUS_TONES[status]}>{LEAVE_STATUS_LABELS[status]}</Badge>;
}
