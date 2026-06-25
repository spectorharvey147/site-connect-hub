import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;
const isTestMode = import.meta.env.MODE === "test";

export const isSupabaseConfigured = Boolean(
  !isTestMode && supabaseUrl && supabaseAnonKey,
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        // Browser LockManager can remain held after an interrupted mobile/webview
        // session. Supabase coordinates refresh-token races server-side.
        lock: async (_name, _acquireTimeout, operation) => operation(),
      },
    })
  : null;
