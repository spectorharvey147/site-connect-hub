export type RuntimeMode = "production" | "development" | "demo" | "test";

function resolveRuntimeMode(): RuntimeMode {
  if (import.meta.env.MODE === "test") return "test";
  const configured = String(import.meta.env.VITE_RUNTIME_MODE ?? "").toLowerCase();
  if (configured === "production" || configured === "development" || configured === "demo") return configured;
  return import.meta.env.PROD ? "production" : "development";
}

export const runtimeMode = resolveRuntimeMode();
export const demoDataEnabled = runtimeMode === "test" || runtimeMode === "demo" ||
  (runtimeMode === "development" && import.meta.env.VITE_ENABLE_DEMO_DATA === "true");

export function requiresSupabaseConfiguration() {
  return runtimeMode === "production" || !demoDataEnabled;
}

export function assertDemoDataAllowed(operation = "This operation") {
  if (!demoDataEnabled) throw new Error(`${operation} requires Supabase. Demo data is disabled for this runtime.`);
}
