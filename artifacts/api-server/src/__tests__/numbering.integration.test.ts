/**
 * Test d'intégration — contention numérotation sous parallélisme.
 *
 * Se skip automatiquement si `TEST_DATABASE_URL` n'est pas défini
 * (impossible sans Postgres).
 *
 * Objectif : 20 transactions concurrentes sur la même clinic → 20 numéros
 * DISTINCTS et consécutifs. Si `pg_advisory_xact_lock` ne tenait pas son rôle,
 * on aurait des collisions (erreur 23505) ou des doublons.
 *
 * Lancer :
 *   TEST_DATABASE_URL=postgres://... pnpm vitest numbering.integration
 *
 * ATTENTION : ce test écrit dans la table `factures` (clinic = `test-clinic-xxxxx`).
 * Il nettoie derrière lui dans `afterAll`.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { facturesTable } from "@workspace/db";
import { nextInvoiceNumber } from "../lib/numbering";

const DB_URL = process.env.TEST_DATABASE_URL;
const runOrSkip = DB_URL ? describe : describe.skip;

runOrSkip("nextInvoiceNumber — contention (integration)", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;
  const clinicId = `test-clinic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(() => {
    pool = new Pool({ connectionString: DB_URL });
    db = drizzle(pool);
  });

  afterAll(async () => {
    await db.delete(facturesTable).where(eq(facturesTable.clinicId, clinicId));
    await pool.end();
  });

  it("produit 20 numéros distincts et consécutifs sous charge parallèle", async () => {
    const N = 20;
    // 20 transactions qui réservent chacune un numéro ET insèrent une facture
    // (car next...Number lit le "dernier numéro" — il faut donc l'écriture
    // pour que la séquence progresse).
    const tasks = Array.from({ length: N }, (_, i) =>
      db.transaction(async (tx) => {
        const numero = await nextInvoiceNumber(tx, clinicId);
        await tx.insert(facturesTable).values({
          clinicId,
          consultationId: null,
          numero,
          montantHT: "0",
          montantTTC: "0",
          tvaRate: "20",
          statut: "brouillon",
          // champs obligatoires du schéma — à adapter si requis.
        } as any);
        return numero;
      }),
    );

    const numeros = await Promise.all(tasks);
    const unique = new Set(numeros);
    expect(unique.size).toBe(N);

    // Et ils sont bien consécutifs (1..N pour cette année).
    const year = new Date().getFullYear();
    const seqs = numeros
      .map((n) => parseInt(n.split("-")[2] ?? "0", 10))
      .sort((a, b) => a - b);
    expect(seqs[0]).toBe(1);
    expect(seqs[N - 1]).toBe(N);
    expect(numeros.every((n) => n.startsWith(`FACT-${year}-`))).toBe(true);
  }, 30_000);
});
