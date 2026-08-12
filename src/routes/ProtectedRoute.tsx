import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { canAccessRoute } from "@/permissions/routePermissions";
import { authService } from "@/services/authService";
import type { Role } from "@/types/auth";

export function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles?: Role[];
  children?: JSX.Element;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const requiresFreshSession = /^(\/accounts|\/users|\/projects|\/settings|\/communication-center|\/claims\/(queue|vouchers|transactions)|\/leave\/approvals|\/field-operations\/dpr\/)/.test(location.pathname);
  const [verified, setVerified] = useState(!requiresFreshSession);
  const [verificationFailed, setVerificationFailed] = useState(false);

  useEffect(() => {
    if (!user || !requiresFreshSession) {
      setVerified(!requiresFreshSession);
      setVerificationFailed(false);
      return;
    }
    let active = true;
    setVerified(false);
    void authService.requireValidSupabaseSession().then(() => {
      if (active) setVerified(true);
    }).catch(() => {
      if (active) setVerificationFailed(true);
    });
    return () => { active = false; };
  }, [location.pathname, requiresFreshSession, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-page p-6">
        <LoadingState label="Checking session" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (verificationFailed) {
    return <Navigate to="/login" replace state={{ from: location, sessionExpired: true }} />;
  }

  if (requiresFreshSession && !verified) {
    return <div className="min-h-screen bg-surface-page p-6"><LoadingState label="Verifying secure session" /></div>;
  }

  if (!canAccessRoute(user.role, allowedRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ?? <Outlet />;
}
