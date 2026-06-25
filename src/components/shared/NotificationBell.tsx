import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { notificationService } from "@/services/notificationService";

export function NotificationBell() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    try {
      const rows = await notificationService.listNotifications();
      setUnread(rows.filter((item) => !item.readAt).length);
    } catch {
      setUnread(0);
    }
  }, [user]);

  useEffect(() => {
    void load();
    return user ? notificationService.subscribe(user.id, () => void load()) : undefined;
  }, [load, user]);

  return (
    <Link to="/notifications" aria-label="Notifications">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title="Notifications"
        className="relative text-white hover:bg-white/10 hover:text-white"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 min-w-4 rounded-full bg-brand-warning px-1 text-center text-[10px] font-bold text-black">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Button>
    </Link>
  );
}
