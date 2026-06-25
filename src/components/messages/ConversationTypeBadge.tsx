import { Badge } from "@/components/ui/Badge";
import {
  CONVERSATION_TYPE_LABELS,
  CONVERSATION_TYPE_TONES,
} from "@/constants/messages";
import type { ConversationType } from "@/types/messages";

export function ConversationTypeBadge({ type }: { type: ConversationType }) {
  return (
    <Badge tone={CONVERSATION_TYPE_TONES[type]}>
      {CONVERSATION_TYPE_LABELS[type]}
    </Badge>
  );
}
