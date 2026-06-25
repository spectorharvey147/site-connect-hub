import { Home } from "lucide-react";
import { NavLink } from "react-router-dom";

import { ROLE_SHORT_LABELS } from "@/constants/roles";
import { useAuth } from "@/hooks/useAuth";
import type { ModuleDefinition } from "@/types/modules";
import { cn } from "@/utils/cn";

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white",
    isActive ? "bg-brand-blue text-white shadow-sm" : null,
  );
}

export function Sidebar({ modules }: { modules: ModuleDefinition[] }) {
  const { user } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-brand-dark text-white lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue text-base font-bold">
          SC
        </div>
        <div>
          <p className="text-base font-bold">Site Connect</p>
          <p className="text-xs text-white/60">
            {user ? ROLE_SHORT_LABELS[user.role] : "Workspace"}
          </p>
        </div>
      </div>
      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavLink to="/home" className={navClass}>
          <Home className="h-5 w-5" />
          Home
        </NavLink>
        <div className="my-4 border-t border-white/10" />
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <NavLink key={module.key} to={module.path} className={navClass}>
              <Icon className="h-5 w-5" />
              <span className="truncate">{module.name}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4 text-xs leading-5 text-white/60">
        Project workflows, approvals and audit records stay linked from field to
        office.
      </div>
    </aside>
  );
}
