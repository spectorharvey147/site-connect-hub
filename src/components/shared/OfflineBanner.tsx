import { CloudOff } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useAuth } from "@/hooks/useAuth";
import { offlineQueueService } from "@/services/offlineQueueService";

export function OfflineBanner() {
  const online = useNetworkStatus();
  const { user } = useAuth();
  useEffect(() => {
    if (online && user) void offlineQueueService.sync(user).then((result) => {
      if (result.synced) toast.success(`${result.synced} offline action(s) synchronized.`);
      if (result.failed) toast.error(`${result.failed} offline action(s) need attention.`);
    });
  }, [online, user]);
  if (online) {
    return null;
  }
  return (
    <div className="flex items-center justify-center gap-2 bg-brand-warning px-4 py-2 text-xs font-semibold text-black">
      <CloudOff className="h-4 w-4" />
      Offline. Supported attendance and draft actions will be queued on this device.
    </div>
  );
}
