/**
 * Test critique — `apiJson()` doit extraire le message d'erreur backend et
 * déballer l'enveloppe { success, data }.
 *
 * Pourquoi c'est critique : c'est la primitive de TOUS les appels API du
 * frontend post-F-P0-2. Une régression casse toutes les pages.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiJson } from "../lib/queryClient";

describe("apiJson", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne data pour une réponse 200 avec enveloppe { success:true, data }", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { foo: 42 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const r = await apiJson<{ foo: number }>("/api/test");
    expect(r).toEqual({ foo: 42 });
  });

  it("throw un Error avec le message backend pour une 4xx avec enveloppe", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: "VALIDATION", message: "Nom trop court" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    ) as typeof fetch;

    await expect(apiJson("/api/test")).rejects.toThrow(/Nom trop court/);
  });

  it("appelle le on401 handler sur 401", async () => {
    const onUnauth = vi.fn();
    // @ts-expect-error — helper interne du module
    (await import("../lib/queryClient")).setOn401?.(onUnauth);

    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: false, error: { message: "Unauthorized" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    await expect(apiJson("/api/test")).rejects.toBeDefined();
    expect(onUnauth).toHaveBeenCalled();
  });

  it("gère une réponse non-JSON (proxy HTML par ex) sans crasher", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<html>500</html>", {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }),
    ) as typeof fetch;

    await expect(apiJson("/api/test")).rejects.toThrow();
  });
});
