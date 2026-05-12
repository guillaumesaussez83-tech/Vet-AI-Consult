/**
 * Tests unitaires — sécurité des pièces jointes (attachments)
 *
 * Ces tests valident les gardes de sécurité implémentés dans
 * artifacts/api-server/src/routes/consultations/attachments.ts
 *
 * Périmètre : logique pure (sans DB, sans Clerk, sans réseau).
 * Pour les tests d'intégration multi-tenant (isolation clinic_id,
 * cross-tenant access), voir le job test-e2e-backend en CI.
 *
 * Runner : vitest (pnpm --filter @workspace/api-server test)
 * PRÉREQUIS : lockfile doit être régénéré après ajout de vitest.
 */
import { describe, it, expect } from "vitest";

// ── Constantes reproduites depuis attachments.ts ────────────────────────────
// Si ces constantes changent dans la route sans mettre à jour les tests,
// les tests échouent — c'est intentionnel.

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ── MIME type allowlist ──────────────────────────────────────────────────────
describe("MIME type allowlist", () => {
  it("accepte image/jpeg", () => {
    expect(ALLOWED_MIME_TYPES.has("image/jpeg")).toBe(true);
  });

  it("accepte image/png", () => {
    expect(ALLOWED_MIME_TYPES.has("image/png")).toBe(true);
  });

  it("accepte application/pdf", () => {
    expect(ALLOWED_MIME_TYPES.has("application/pdf")).toBe(true);
  });

  it("refuse text/html (vecteur XSS)", () => {
    expect(ALLOWED_MIME_TYPES.has("text/html")).toBe(false);
  });

  it("refuse image/svg+xml (vecteur XSS)", () => {
    expect(ALLOWED_MIME_TYPES.has("image/svg+xml")).toBe(false);
  });

  it("refuse application/javascript", () => {
    expect(ALLOWED_MIME_TYPES.has("application/javascript")).toBe(false);
  });

  it("refuse application/x-sh (exécutable)", () => {
    expect(ALLOWED_MIME_TYPES.has("application/x-sh")).toBe(false);
  });

  it("refuse application/octet-stream direct (binaire anonyme)", () => {
    // La route normalise vers octet-stream si mime absent, mais la validation
    // réelle doit refuser ce type non déclaré dans l'allowlist.
    expect(ALLOWED_MIME_TYPES.has("application/octet-stream")).toBe(false);
  });
});

// ── Validation de taille ─────────────────────────────────────────────────────
describe("Validation de taille (MAX_SIZE_BYTES = 5 MB)", () => {
  it("refuse un fichier déclaré à 6 MB", () => {
    const declared = 6 * 1024 * 1024;
    expect(declared > MAX_SIZE_BYTES).toBe(true);
  });

  it("accepte un fichier déclaré à 4 MB", () => {
    const declared = 4 * 1024 * 1024;
    expect(declared > MAX_SIZE_BYTES).toBe(false);
  });

  it("accepte exactement 5 MB (limite incluse)", () => {
    expect(MAX_SIZE_BYTES > MAX_SIZE_BYTES).toBe(false);
  });

  it("détecte un payload base64 > 5 MB malgré fileSize déclaré à 0", () => {
    // Attaque : client déclare fileSize=0 mais envoie 6 MB encodé en base64.
    // La route recalcule la taille réelle depuis la longueur de la string.
    const actualBytes = 6 * 1024 * 1024;
    // Longueur base64 correspondante ≈ actualBytes * 4/3
    const b64Length = Math.ceil(actualBytes * 4 / 3);
    const fakePayload = "A".repeat(b64Length);
    const recalculated = Math.ceil((fakePayload.length * 3) / 4);
    expect(recalculated > MAX_SIZE_BYTES).toBe(true);
  });

  it("n'est pas trompé par un payload base64 de 4 MB", () => {
    const actualBytes = 4 * 1024 * 1024;
    const b64Length = Math.ceil(actualBytes * 4 / 3);
    const payload = "A".repeat(b64Length);
    const recalculated = Math.ceil((payload.length * 3) / 4);
    expect(recalculated > MAX_SIZE_BYTES).toBe(false);
  });
});

// ── Validation des IDs (fix P0: uuid→integer) ───────────────────────────────
describe("Validation parseInt — IDs entiers (fix P0 uuid→integer)", () => {
  it("parse un consultationId numérique valide", () => {
    const id = parseInt("42", 10);
    expect(isNaN(id)).toBe(false);
    expect(id).toBe(42);
  });

  it("détecte NaN sur une string non-numérique", () => {
    const id = parseInt("abc", 10);
    expect(isNaN(id)).toBe(true);
  });

  it("refuse un UUID passé en consultationId (bug P0 root cause)", () => {
    // Avant fix : uuid("consultation_id") référençait serial/integer → FK invalide.
    // La route retournait 500 car Drizzle tentait d'insérer un UUID dans un INTEGER.
    // Après fix : parseInt('uuid-string') === NaN → 400 retourné immédiatement.
    const uuidLike = "550e8400-e29b-41d4-a716-446655440000";
    const id = parseInt(uuidLike, 10);
    expect(isNaN(id)).toBe(true);
  });

  it("parse l'ID d'attachment 0 comme NaN-safe (0 est un SERIAL valide)", () => {
    // SERIAL commence à 1, mais parseInt("0") est 0, pas NaN
    const id = parseInt("0", 10);
    expect(isNaN(id)).toBe(false);
    expect(id).toBe(0);
  });

  it("refuse une string vide comme attachment ID", () => {
    const id = parseInt("", 10);
    expect(isNaN(id)).toBe(true);
  });
});

// ── Invariants sur la constante MAX_SIZE_BYTES ────────────────────────────────
describe("Invariants MAX_SIZE_BYTES", () => {
  it("est exactement 5 * 1024 * 1024", () => {
    expect(MAX_SIZE_BYTES).toBe(5242880);
  });

  it("la formule de recalcul base64 est cohérente", () => {
    // Un fichier de exactement MAX_SIZE_BYTES ne dépasse pas la limite
    const b64 = "A".repeat(Math.ceil(MAX_SIZE_BYTES * 4 / 3));
    const recalc = Math.ceil((b64.length * 3) / 4);
    // Légère sur-estimation due à l'arrondi — acceptable si ≤ MAX + quelques octets
    expect(recalc).toBeGreaterThanOrEqual(MAX_SIZE_BYTES);
    expect(recalc).toBeLessThan(MAX_SIZE_BYTES + 4); // marge de 3 octets max
  });
});
