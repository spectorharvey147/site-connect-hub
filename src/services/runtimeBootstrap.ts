import { isSupabaseConfigured } from "@/services/supabaseClient";

const SUPABASE_PROJECT_MARKER = "site-connect:supabase-project";
const PRESERVED_KEYS = new Set(["site-connect:theme"]);

export function prepareRuntimeStorage() {
  if (
    typeof window === "undefined" ||
    !isSupabaseConfigured
  ) {
    return;
  }

  const projectUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!projectUrl) {
    return;
  }

  if (window.localStorage.getItem(SUPABASE_PROJECT_MARKER) === projectUrl) {
    return;
  }

  const legacyKeys = Array.from(
    { length: window.localStorage.length },
    (_, index) => window.localStorage.key(index),
  ).filter(
    (key): key is string =>
      Boolean(key?.startsWith("site-connect:")) &&
      !PRESERVED_KEYS.has(key as string),
  );

  legacyKeys.forEach((key) => window.localStorage.removeItem(key));
  window.sessionStorage.clear();
  window.localStorage.setItem(SUPABASE_PROJECT_MARKER, projectUrl);
}
