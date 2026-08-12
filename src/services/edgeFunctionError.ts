export async function getEdgeFunctionErrorMessage(
  error: unknown,
  fallback = "The server could not complete the request.",
) {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as { error?: unknown; message?: unknown };
      const detail = body.error ?? body.message;
      if (typeof detail === "string" && detail.trim()) return detail.trim();
    } catch {
      try {
        const detail = await context.clone().text();
        if (detail.trim()) return detail.trim();
      } catch {
        // Fall through to the client error below.
      }
    }
  }
  if (error instanceof Error && error.message && !error.message.includes("non-2xx")) {
    return error.message;
  }
  return fallback;
}
