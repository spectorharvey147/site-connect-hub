import { Badge } from "@/components/ui/Badge";
import { CLAIM_STATUS_LABELS, CLAIM_STATUS_TONES } from "@/constants/claims";
import type { ClaimStatus } from "@/types/claims";

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <Badge tone={CLAIM_STATUS_TONES[status]}>{CLAIM_STATUS_LABELS[status]}</Badge>;
}
