/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RUNTIME_MODE?: "production" | "development" | "demo";
  readonly VITE_ENABLE_DEMO_DATA?: "true" | "false";
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SITE_CONNECT_URL?: string;
}
