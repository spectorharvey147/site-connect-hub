import { Outlet } from "react-router-dom";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { getVisibleModules } from "@/constants/modules";
import { useAuth } from "@/hooks/useAuth";
import { offlineQueueService } from "@/services/offlineQueueService";

export function AppLayout() {
  const { user } = useAuth();
  const modules = user ? getVisibleModules(user.role) : [];
  const syncInProgress = useRef(false);

  useEffect(() => {
    if (!user) return;
    const sync = () => {
      if (syncInProgress.current) return;
      syncInProgress.current = true;
      void offlineQueueService
        .sync(user)
        .then(({ synced }) => {
          if (synced > 0) toast.success(`${synced} offline action(s) synced.`);
        })
        .finally(() => {
          syncInProgress.current = false;
        });
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [user]);

  return (
    <div className="min-h-screen bg-surface-page lg:pl-72">
      <Sidebar modules={modules} />
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <OfflineBanner />
        <main className="flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:pb-8">
          <Outlet />
        </main>
      </div>
      <MobileNav modules={modules} />
    </div>
  );
}
