/**
 * Tests unitaires du pre-filtre FEFO `doitDecrementerStock`.
 *
 * Contexte : la colonne `actes.categorie` est du texte libre, alimente tantot
 * "medicament" (seeder stock), tantot "Médicament" (saisie manuelle / IA / CSV).
 * Le filtre historique testait `includes("medic")` (sans accent) + une chaine
 * accentuee CORROMPUE (mojibake) -> une ligne categorisee "Médicament" SANS code
 * MED/VACCI n'etait jamais decrementee du stock (bug latent FEFO).
 *
 * Ces tests verrouillent le comportement attendu : match insensible aux accents
 * ET a la casse.
 *
 * Lancer : pnpm vitest categorisation
 */
import { describe, it, expect } from "vitest";
import { doitDecrementerStock, normaliserTexte } from "../lib/categorisation";

describe("normaliserTexte", () => {
  it("retire les accents et passe en minuscules", () => {
    expect(normaliserTexte("Médicament")).toBe("medicament");
    expect(normaliserTexte("MÉDICAMENT")).toBe("medicament");
    expect(normaliserTexte("Vaccin")).toBe("vaccin");
    expect(normaliserTexte("Antiparasitaire")).toBe("antiparasitaire");
  });
});

describe("doitDecrementerStock", () => {
  // --- Le cas qui regressait : categorie "Médicament" SANS code produit ---
  it("decremente une ligne categorie « Médicament » (accentuee) sans code MED", () => {
    expect(doitDecrementerStock("Médicament", null)).toBe(true);
  });

  it("decremente quelle que soit la casse / les accents de la categorie", () => {
    for (const cat of ["Médicament", "médicament", "MÉDICAMENT", "medicament", "Medic"]) {
      expect(doitDecrementerStock(cat, null)).toBe(true);
    }
  });

  it("matche aussi « Médicament stupéfiant » (sous-categorie)", () => {
    expect(doitDecrementerStock("Médicament stupéfiant", null)).toBe(true);
  });

  // --- Matching par code produit (medicaments + vaccins) ---
  it("decremente via le code MED… meme sans categorie medicament", () => {
    expect(doitDecrementerStock(null, "MED-123")).toBe(true);
    expect(doitDecrementerStock("Divers", "MED-123")).toBe(true);
  });

  it("decremente via le code VACCI… (vaccins)", () => {
    expect(doitDecrementerStock("Vaccin", "VACCI-09")).toBe(true);
    expect(doitDecrementerStock(null, "VACCI-09")).toBe(true);
  });

  // --- Non-regression : ce qui ne doit PAS etre decremente ---
  it("ne decremente pas les actes/services non stockables", () => {
    expect(doitDecrementerStock("Consultation", null)).toBe(false);
    expect(doitDecrementerStock("Chirurgie", "CHIR-01")).toBe(false);
    expect(doitDecrementerStock("", null)).toBe(false);
    expect(doitDecrementerStock(null, null)).toBe(false);
  });

  it("ne matche PAS un vaccin par sa seule categorie (hors scope du fix, inchange)", () => {
    // Volontaire : seul le code VACCI… declenche le decrement d'un vaccin.
    expect(doitDecrementerStock("Vaccin", null)).toBe(false);
    expect(doitDecrementerStock("Antiparasitaire", null)).toBe(false);
  });
});
