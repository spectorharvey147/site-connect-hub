import { useEffect } from "react";

import { messagingService } from "@/services/messagingService";
import type { AppUser } from "@/types/auth";

export function useRealtimeMessages(
  user: AppUser | null,
  conversationId: string | undefined,
  onChange: () => void,
) {
  useEffect(() => {
    if (!user || !conversationId) {
      return;
    }
    return messagingService.subscribe(conversationId, onChange);
  }, [conversationId, onChange, user]);
}
