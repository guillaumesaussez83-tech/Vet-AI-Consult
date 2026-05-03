/**
 * Helpers de numérotation atomique par clinique (factures, ordonnances...).
 *
 * Problème résolu : le pattern "SELECT MAX ... puis INSERT" produit des
 * collisions sous charge parallèle (deux requêtes lisent la même valeur, les
 * deux INSERT tentent le même numéro → 23505 ou doublons si pas d'index unique).
 *
 * Solution : pg_advisory_xact_lock dans une transaction Drizzle.
 * La clé de lock est dérivée d'une chaîne domaine+clinic, hashée par Postgres
 * (`hashtextextended`). Elle est scope-transaction : libérée au COMMIT/ROLLBACK.
 *
 * Usage :
 *
 *   const { numero, facture } = await db.transaction(async (tx) => {
 *     const numero = await nextInvoiceNumber(tx, clinicId);
 *     const [f] = await tx.insert(facturesTable).values({ ..., numero }).returning();
 *     return { numero, facture: f };
 *   });
 */
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { db, facturesTable, ordonnancesTable, ventesTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

type Tx = NodePgDatabase<Record<string, never>>;

async function acquireAdvisoryLock(tx: Tx, scope: string, clinicId: string): Promise<void> {
  const key = `${scope}:${clinicId}`;
  // hashtextextended renvoie bigint ; advisory_xact_lock accepte bigint.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
}

export async function nextInvoiceNumber(tx: Tx, clinicId: string): Promise<string> {
  await acquireAdvisoryLock(tx, "invoice_numbering", clinicId);
  const year = new Date().getFullYear();
  const prefix = `FACT-${year}-`;
  const [row] = await tx
    .select({ numero: facturesTable.numero })
    .from(facturesTable)
    .where(
      and(
        eq(facturesTable.clinicId, clinicId),
        sql`${facturesTable.numero} LIKE ${prefix + "%"}`,
      ),
    )
    .orderBy(desc(facturesTable.id))
    .limit(1);
  const lastSeq = row?.numero ? parseInt(row.numero.split("-")[2] ?? "0", 10) || 0 : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}

export async function nextOrdonnanceNumber(tx: Tx, clinicId: string): Promise<string> {
  await acquireAdvisoryLock(tx, "ordonnance_numbering", clinicId);
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;
  const [row] = await tx
    .select({ numero: ordonnancesTable.numeroOrdonnance })
    .from(ordonnancesTable)
    .where(
      and(
        eq(ordonnancesTable.clinicId, clinicId),
        sql`${ordonnancesTable.numeroOrdonnance} LIKE ${prefix + "%"}`,
      ),
    )
    .orderBy(desc(ordonnancesTable.id))
    .limit(1);
  const lastSeq = row?.numeroOrdonnance
    ? parseInt(row.numeroOrdonnance.split("-")[2] ?? "0", 10) || 0
    : 0;
  return `${prefix}${String(lastSeq + 1).padStart(5, "0")}`;
}

/**
 * Agrégation TVA multi-taux — à utiliser à la place du `tva = 20` en dur.
 * Retourne HT, TTC, et breakdown par taux (à stocker en JSONB pour traçabilité).
 */
export type ActeLike = {
  prixUnitaire: number;
  quantite: number;
  tvaRate?: number | null;
};

export type InvoiceTotals = {
  montantHT: number;
  montantTTC: number;
  tvaMoyenne: number;
  tvaBreakdown: Array<{ rate: number; ht: number; tva: number }>;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeInvoiceTotals(
  actes: ReadonlyArray<ActeLike>,
  defaultTvaRate: number,
): InvoiceTotals {
  const totalsByRate = new Map<number, { ht: number; tva: number }>();

  for (const a of actes) {
    const ht = a.prixUnitaire * a.quantite;
    const rate = a.tvaRate ?? defaultTvaRate;
    const cur = totalsByRate.get(rate) ?? { ht: 0, tva: 0 };
    cur.ht += ht;
    cur.tva += ht * (rate / 100);
    totalsByRate.set(rate, cur);
  }

  const montantHT = [...totalsByRate.values()].reduce((s, t) => s + t.ht, 0);
  const totalTva = [...totalsByRate.values()].reduce((s, t) => s + t.tva, 0);
  const montantTTC = montantHT + totalTva;
  const tvaMoyenne = montantHT > 0 ? (totalTva / montantHT) * 100 : defaultTvaRate;

  return {
    montantHT: round2(montantHT),
    montantTTC: round2(montantTTC),
    tvaMoyenne: round2(tvaMoyenne),
    tvaBreakdown: [...totalsByRate.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rate, t]) => ({ rate, ht: round2(t.ht), tva: round2(t.tva) })),
  };
}

// ---------------------------------------------------------------------------
// generateVenteNumero — numérotation des ventes (sans verrou advisory)
// L'index unique (clinicId, numero) protège contre les doublons.
// ---------------------------------------------------------------------------
export async function generateVenteNumero(clinicId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VTE-${year}-`;
  const [row] = await db
    .select({ numero: ventesTable.numero })
    .from(ventesTable)
    .where(and(eq(ventesTable.clinicId, clinicId), sql`${ventesTable.numero} LIKE ${prefix + "%"}`))
    .orderBy(desc(ventesTable.id))
    .limit(1);
  const lastSeq = row?.numero ? parseInt(row.numero.split("-")[2] ?? "0", 10) || 0 : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}
