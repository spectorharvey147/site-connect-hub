import { useState } from "react";

import { themeService, type ThemePreference } from "@/services/themeService";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(() =>
    themeService.initialize(),
  );

  function setTheme(next: ThemePreference) {
    themeService.setPreference(next);
    setThemeState(next);
  }

  return {
    theme,
    toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
  };
}
