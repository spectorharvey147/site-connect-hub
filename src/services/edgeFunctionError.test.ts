import { describe, expect, it } from "vitest";

import { getEdgeFunctionErrorMessage } from "@/services/edgeFunctionError";

describe("Edge Function error details", () => {
  it("uses the JSON response detail instead of the generic non-2xx wrapper", async () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify({ error: "Required user fields are missing." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    });

    await expect(getEdgeFunctionErrorMessage(error)).resolves.toBe(
      "Required user fields are missing.",
    );
  });
});
