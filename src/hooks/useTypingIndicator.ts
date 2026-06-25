import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/services/supabaseClient";

export function useTypingIndicator(
  conversationId: string | undefined,
  userId: string | undefined,
  userName: string | undefined,
) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]>>();
  const timeoutRef = useRef<number>();

  useEffect(() => {
    const client = supabase;
    if (!client || !conversationId || !userId) {
      return;
    }
    const channel = client
      .channel(`typing:${conversationId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId === userId) {
          return;
        }
        setTypingUsers((current) =>
          payload.typing
            ? Array.from(new Set([...current, String(payload.userName)]))
            : current.filter((name) => name !== payload.userName),
        );
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
      channelRef.current = undefined;
      void client.removeChannel(channel);
    };
  }, [conversationId, userId]);

  const signalTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !userId || !userName) {
      return;
    }
    void channel.send({
      type: "broadcast",
      event: "typing",
      payload: { userId, userName, typing: true },
    });
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, userName, typing: false },
      });
    }, 1500);
  }, [userId, userName]);

  return { typingUsers, signalTyping };
}
