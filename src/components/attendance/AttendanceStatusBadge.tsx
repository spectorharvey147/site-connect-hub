import { Badge } from "@/components/ui/Badge";
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_TONES,
} from "@/constants/attendance";
import type { AttendanceStatus } from "@/types/attendance";

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <Badge tone={ATTENDANCE_STATUS_TONES[status]}>
      {ATTENDANCE_STATUS_LABELS[status]}
    </Badge>
  );
}
