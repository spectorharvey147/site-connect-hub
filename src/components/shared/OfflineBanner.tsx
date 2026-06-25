import { CloudOff } from "lucide-react";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function OfflineBanner() {
  const online = useNetworkStatus();
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
