import { AppRoutes } from "@/routes/AppRoutes";
import { requiresSupabaseConfiguration, runtimeMode } from "@/services/runtimeMode";
import { isSupabaseConfigured } from "@/services/supabaseClient";

export function App() {
  if (requiresSupabaseConfiguration() && !isSupabaseConfigured) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="max-w-lg rounded-xl border border-red-200 bg-white p-6 shadow-sm"><h1 className="text-xl font-bold text-red-700">Site Connect is not configured</h1><p className="mt-3 text-sm leading-6 text-slate-700">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment environment, then redeploy. The {runtimeMode} runtime will not load demo or local fallback records.</p></section></main>;
  }
  return <AppRoutes />;
}
