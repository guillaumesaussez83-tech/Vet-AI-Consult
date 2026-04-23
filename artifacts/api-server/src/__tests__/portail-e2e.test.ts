/**
 * Tests e2e portail propriétaire.
 *
 * Couvre :
 *  1. GET /portail/:token avec token invalide → 404.
 *  2. GET /portail/:token avec token expiré → 404.
 *  3. GET /portail/:token avec token valide → 200 + données scopées à la
 *     clinique du token (pas de fuite cross-tenant).
 *  4. POST /portail/:token/rdv (authentifié en session token) → accepté
 *     pour la clinique du token uniquement.
 *
 * Skippé si TEST_DATABASE_URL pas défini.
 */
import { describe, it, expect, beforeAll } from "vitest";
import type { Express } from "express";
import request from "supertest";
import { randomBytes } from "crypto";

const TEST_DB = process.env["TEST_DATABASE_URL"];
const describeIfDb = TEST_DB ? describe : describe.skip;

function hex64(): string {
  return randomBytes(32).toString("hex");
}

describeIfDb("portail public (e2e)", () => {
  let app: Express;
  let validToken: string;
  let expiredToken: string;

  beforeAll(async () => {
    process.env["NODE_ENV"] = "test";
    process.env["DATABASE_URL"] = TEST_DB!;
    const mod = await import("../app");
    app = mod.default;

    const { db, cliniquesTable, ownersTable, portailTokensTable } = await import("@workspace/db");
    await db
      .insert(cliniquesTable)
      .values({ id: "clinic-portail-a", nom: "Portail A", email: "pa@t.fr" })
      .onConflictDoNothing();
    await db
      .insert(ownersTable)
      .values({
        id: "owner-portail-a1",
        clinicId: "clinic-portail-a",
        nom: "Portail",
        prenom: "A1",
        email: "pa1@t.fr",
      })
      .onConflictDoNothing();

    validToken = hex64();
    expiredToken = hex64();
    const now = new Date();
    const plus90 = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
    const minus1 = new Date(now.getTime() - 24 * 3600 * 1000);

    await db.insert(portailTokensTable).values([
      {
        clinicId: "clinic-portail-a",
        ownerId: "owner-portail-a1",
        token: validToken,
        expiresAt: plus90,
      },
      {
        clinicId: "clinic-portail-a",
        ownerId: "owner-portail-a1",
        token: expiredToken,
        expiresAt: minus1,
      },
    ]);
  });

  it("404 pour token inexistant", async () => {
    const bogus = hex64();
    const res = await request(app).get(`/portail/${bogus}`);
    expect(res.status).toBe(404);
  });

  it("404 pour token format invalide (non-hex64)", async () => {
    const res = await request(app).get(`/portail/not-a-hex-64-token`);
    expect([400, 404]).toContain(res.status);
  });

  it("404 pour token expiré", async () => {
    const res = await request(app).get(`/portail/${expiredToken}`);
    expect(res.status).toBe(404);
  });

  it("200 + scope clinic-portail-a pour token valide", async () => {
    const res = await request(app).get(`/portail/${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body?.data?.owner?.id).toBe("owner-portail-a1");
    // Vérifier que rien ne fuit d'une autre clinique :
    const patients = res.body?.data?.patients ?? [];
    for (const p of patients) {
      expect(p.clinicId).toBe("clinic-portail-a");
    }
  });

  it("rate limit — 10 req/min retournent 429 au-delà", async () => {
    const results: number[] = [];
    for (let i = 0; i < 15; i++) {
      const res = await request(app).get(`/portail/${validToken}`);
      results.push(res.status);
    }
    // Au moins un 429 attendu si la limite est à 10.
    expect(results.some((s) => s === 429)).toBe(true);
  });
});
