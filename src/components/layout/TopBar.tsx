import { Moon, Sun } from "lucide-react";

import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/hooks/useTheme";

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#00264D] bg-brand-dark px-4 text-white lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-blue font-bold lg:hidden">
          SC
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Site Connect</p>
          <p className="hidden truncate text-xs text-white/70 sm:block">
            Site-to-office operations platform
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Toggle dark mode"
          aria-label="Toggle dark mode"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={toggleTheme}
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
