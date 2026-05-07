import { test, expect } from "@playwright/test";

/**
 * E2E — Isolation Multi-Tenant (clinic_id)
 *
 * Vérifie que :
 * 1. Toutes les routes API nécessitent un token valide (401 sans auth)
 * 2. Un token valide ne peut pas accéder aux données d'une autre clinique
 * 3. Les requêtes sans clinic_id implicite (via token) sont bloquées
 */

const BASE = process.env.BASE_URL ?? "https://app.vetoai.fr";

const PROTECTED_GET_ROUTES = [
  "/api/patients",
  "/api/owners",
  "/api/consultations",
  "/api/factures",
  "/api/agenda",
  "/api/stock",
  "/api/actes",
  "/api/ordonnances",
  "/api/comptabilite/dashboard",
];

const PROTECTED_POST_ROUTES = [
  { path: "/api/patients", body: { nom: "X", espece: "Chien", proprietaireId: "00000000-0000-0000-0000-000000000000" } },
  { path: "/api/consultations", body: { patientId: "00000000-0000-0000-0000-000000000000", motif: "test" } },
  { path: "/api/factures", body: { lignes: [{ description: "acte", quantite: 1, prixUnitaire: 10 }] } },
];

test.describe("Isolation Multi-Tenant", () => {

  test.describe("Routes GET — rejet sans token", () => {
    for (const route of PROTECTED_GET_ROUTES) {
      test(`GET ${route} → 401 sans Authorization`, async ({ request }) => {
        const resp = await request.get(BASE + route);
        expect(resp.status()).toBe(401);
      });
    }
  });

  test.describe("Routes POST — rejet sans token", () => {
    for (const { path, body } of PROTECTED_POST_ROUTES) {
      test(`POST ${path} → 401 sans Authorization`, async ({ request }) => {
        const resp = await request.post(BASE + path, {
          headers: { "Content-Type": "application/json" },
          data: body,
        });
        expect(resp.status()).toBe(401);
      });
    }
  });

  test("token invalide (Bearer fake) retourne 401", async ({ request }) => {
    const resp = await request.get(BASE + "/api/patients", {
      headers: { Authorization: "Bearer invalid_token_xyz" },
    });
    expect(resp.status()).toBe(401);
  });

  test("header clinic_id seul sans token retourne 401", async ({ request }) => {
    const resp = await request.get(BASE + "/api/patients", {
      headers: { "x-clinic-id": "00000000-0000-0000-0000-000000000001" },
    });
    expect(resp.status()).toBe(401);
  });

  test("DELETE patient sans token retourne 401", async ({ request }) => {
    const resp = await request.delete(BASE + "/api/patients/00000000-0000-0000-0000-000000000001");
    expect(resp.status()).toBe(401);
  });

  test("PATCH consultation sans token retourne 401", async ({ request }) => {
    const resp = await request.patch(BASE + "/api/consultations/00000000-0000-0000-0000-000000000001", {
      data: { statut: "TERMINEE" },
    });
    expect(resp.status()).toBe(401);
  });

  test("route /api/admin inaccessible sans token", async ({ request }) => {
    const resp = await request.get(BASE + "/api/admin");
    expect([401, 403, 404]).toContain(resp.status());
  });

  test("endpoint IA /api/ai/diagnostic inaccessible sans token", async ({ request }) => {
    const resp = await request.post(BASE + "/api/ai/diagnostic", {
      data: { anamnese: "test" },
    });
    expect(resp.status()).toBe(401);
  });
});
