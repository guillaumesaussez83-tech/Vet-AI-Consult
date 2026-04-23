/**
 * Tests unitaires `computeInvoiceTotals`.
 *
 * On ne teste PAS `nextInvoiceNumber` ici : ça demande une vraie base Postgres
 * (le pg_advisory_xact_lock ne se simule pas sans connexion). Le test de
 * contention est dans `numbering.integration.test.ts` qui se skip en local si
 * `TEST_DATABASE_URL` n'est pas défini.
 *
 * Lancer : pnpm vitest numbering
 */
import { describe, it, expect } from "vitest";
import { computeInvoiceTotals } from "../lib/numbering";

describe("computeInvoiceTotals", () => {
  it("retourne un total nul pour une liste vide", () => {
    const r = computeInvoiceTotals([], 20);
    expect(r.montantHT).toBe(0);
    expect(r.montantTTC).toBe(0);
    expect(r.tvaBreakdown).toEqual([]);
    // tvaMoyenne fallback sur defaultTvaRate pour éviter un 0/0 trompeur.
    expect(r.tvaMoyenne).toBe(20);
  });

  it("applique le taux par défaut quand tvaRate est null/absent", () => {
    const r = computeInvoiceTotals(
      [
        { prixUnitaire: 100, quantite: 1, tvaRate: null },
        { prixUnitaire: 50, quantite: 2 },
      ],
      20,
    );
    expect(r.montantHT).toBe(200);
    expect(r.montantTTC).toBe(240);
    expect(r.tvaMoyenne).toBe(20);
    expect(r.tvaBreakdown).toEqual([{ rate: 20, ht: 200, tva: 40 }]);
  });

  it("gère correctement les taux mélangés (20% / 10%)", () => {
    const r = computeInvoiceTotals(
      [
        { prixUnitaire: 100, quantite: 1, tvaRate: 20 }, // 100 HT, 20 TVA
        { prixUnitaire: 50, quantite: 2, tvaRate: 10 }, // 100 HT, 10 TVA
      ],
      20,
    );
    expect(r.montantHT).toBe(200);
    expect(r.montantTTC).toBe(230); // 200 + 30
    // TVA moyenne pondérée : 30 / 200 = 15%
    expect(r.tvaMoyenne).toBe(15);
    expect(r.tvaBreakdown).toEqual([
      { rate: 10, ht: 100, tva: 10 },
      { rate: 20, ht: 100, tva: 20 },
    ]);
  });

  it("gère le taux 0% (produits exonérés)", () => {
    const r = computeInvoiceTotals(
      [
        { prixUnitaire: 100, quantite: 1, tvaRate: 0 },
        { prixUnitaire: 100, quantite: 1, tvaRate: 20 },
      ],
      20,
    );
    expect(r.montantHT).toBe(200);
    expect(r.montantTTC).toBe(220);
    expect(r.tvaBreakdown).toEqual([
      { rate: 0, ht: 100, tva: 0 },
      { rate: 20, ht: 100, tva: 20 },
    ]);
  });

  it("arrondit à 2 décimales (pas d'erreur flottante visible)", () => {
    // 33.33 * 3 = 99.99 ; TVA 20% = 19.998 → arrondi à 20.00
    const r = computeInvoiceTotals(
      [{ prixUnitaire: 33.33, quantite: 3, tvaRate: 20 }],
      20,
    );
    expect(r.montantHT).toBe(99.99);
    expect(r.montantTTC).toBe(119.99); // 99.99 + 20.00 arrondi
    expect(r.tvaBreakdown[0].tva).toBe(20);
  });

  it("agrège plusieurs actes au même taux en UNE seule ligne de breakdown", () => {
    const r = computeInvoiceTotals(
      [
        { prixUnitaire: 50, quantite: 1, tvaRate: 20 },
        { prixUnitaire: 30, quantite: 2, tvaRate: 20 },
        { prixUnitaire: 10, quantite: 1, tvaRate: 20 },
      ],
      20,
    );
    // Un seul groupe à 20% : HT 50 + 60 + 10 = 120
    expect(r.tvaBreakdown).toHaveLength(1);
    expect(r.tvaBreakdown[0]).toEqual({ rate: 20, ht: 120, tva: 24 });
  });
});
