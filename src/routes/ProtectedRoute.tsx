import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LoadingState } from "@/components/shared/LoadingState";
import { hasRoleAccess } from "@/constants/roles";
import { useAuth } from "@/hooks/useAuth";
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

  if (allowedRoles && !hasRoleAccess(user.role, allowedRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ?? <Outlet />;
}
