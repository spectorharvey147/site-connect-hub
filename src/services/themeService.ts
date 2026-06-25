export type ThemePreference = "light" | "dark";

const THEME_KEY = "site-connect:theme";

function preferredTheme(): ThemePreference {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function apply(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

export const themeService = {
  getPreference: preferredTheme,
  initialize() {
    const theme = preferredTheme();
    apply(theme);
    return theme;
  },
  setPreference(theme: ThemePreference) {
    window.localStorage.setItem(THEME_KEY, theme);
    apply(theme);
  },
};
