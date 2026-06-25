import { LogOut, UserCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/Button";
import { ROLE_SHORT_LABELS } from "@/constants/roles";
import { useAuth } from "@/hooks/useAuth";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-2 rounded-md p-1.5 text-left text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
        onClick={() => setOpen((current) => !current)}
      >
        <UserAvatar name={user.fullName} src={user.avatarUrl} className="h-9 w-9 text-sm" />
        <span className="hidden min-w-0 lg:block">
          <span className="block truncate text-sm font-semibold">
            {user.fullName}
          </span>
          <span className="block truncate text-xs text-white/70">
            {ROLE_SHORT_LABELS[user.role]}
          </span>
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-surface-border bg-surface-card p-2 text-text-primary shadow-elevated">
          <div className="border-b border-surface-border p-3">
            <div className="flex items-center gap-3">
              <UserAvatar name={user.fullName} src={user.avatarUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{user.fullName}</p>
                <p className="truncate text-xs text-text-secondary">{user.email}</p>
              </div>
            </div>
          </div>
          <div className="p-2">
            <div className="mb-2 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-text-secondary">
              <UserCircle className="h-4 w-4" />
              {ROLE_SHORT_LABELS[user.role]} · {user.employeeId}
            </div>
            <Link
              to="/profile"
              className="mb-1 flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-text-secondary transition hover:bg-brand-light hover:text-brand-blue"
              onClick={() => setOpen(false)}
            >
              <UserCircle className="h-4 w-4" />
              My Profile
            </Link>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-brand-danger hover:bg-red-50 hover:text-brand-danger"
              leftIcon={<LogOut className="h-4 w-4" />}
              onClick={() => void logout()}
            >
              Logout
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
