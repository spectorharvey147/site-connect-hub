import { Home } from "lucide-react";
import { NavLink } from "react-router-dom";

import type { ModuleDefinition } from "@/types/modules";
import { cn } from "@/utils/cn";

export function MobileNav({ modules }: { modules: ModuleDefinition[] }) {
  const primaryModules = modules.slice(0, 4);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-[#00264D] bg-brand-dark text-white lg:hidden">
      <NavLink
        to="/home"
        className={({ isActive }) =>
          cn(
            "flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold",
            isActive ? "text-brand-warning" : "text-white/80",
          )
        }
      >
        <Home className="h-5 w-5" />
        Home
      </NavLink>
      {primaryModules.map((module) => {
        const Icon = module.icon;
        return (
          <NavLink
            key={module.key}
            to={module.path}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 px-1 text-center text-[10px] font-semibold",
                isActive ? "text-brand-warning" : "text-white/80",
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate">{module.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
