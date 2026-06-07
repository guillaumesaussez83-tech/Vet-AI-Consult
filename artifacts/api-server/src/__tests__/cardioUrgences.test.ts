/**
 * Tests du catalogue des urgences cardio « à ne jamais rater » (V1).
 *
 * Brique de sécurité : on verrouille la complétude (6 signaux), l'intégrité des
 * champs, et le fait que le bloc de prompt porte bien la règle de sécurité + le
 * contrat de sortie attendu (`urgencesVitales` / `urgenceVitaleDetectee`). Les
 * attentes sont dérivées de la donnée pour rester robustes aux libellés.
 *
 * Lancer : pnpm vitest cardioUrgences
 */
import { describe, it, expect } from "vitest";
import {
  SIGNAUX_URGENCE_CARDIO,
  CATALOGUE_CARDIO_VERSION,
  renderCardioUrgencesBlock,
} from "../lib/ai/prompts/cardioUrgences";

describe("Catalogue urgences cardio (V1)", () => {
  it("contient exactement les 6 signaux validés", () => {
    expect(SIGNAUX_URGENCE_CARDIO).toHaveLength(6);
  });

  it("expose les 6 urgences attendues, dans l'ordre, par id stable", () => {
    expect(SIGNAUX_URGENCE_CARDIO.map((s) => s.id)).toEqual([
      "detresse-respiratoire-aigue",
      "syncope-collapsus",
      "paralysie-posterieure-aigue-tea",
      "bas-debit-choc-cardiogenique",
      "distension-abdominale-aigue-tamponnade",
      "arythmie-grave-auscultation",
    ]);
  });

  it("chaque signal a tous ses champs obligatoires non vides", () => {
    for (const s of SIGNAUX_URGENCE_CARDIO) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.nom.trim().length).toBeGreaterThan(0);
      expect(s.verbatim.length).toBeGreaterThan(0);
      expect(s.examen.length).toBeGreaterThan(0);
      expect(s.seuil.trim().length).toBeGreaterThan(0);
      expect(s.causeMortelle.trim().length).toBeGreaterThan(0);
    }
  });

  it("les identifiants sont uniques", () => {
    const ids = SIGNAUX_URGENCE_CARDIO.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("renderCardioUrgencesBlock", () => {
  const bloc = renderCardioUrgencesBlock();

  it("porte la règle de sécurité et le contrat de sortie attendu", () => {
    expect(bloc).toContain("urgencesVitales");
    expect(bloc).toContain("urgenceVitaleDetectee");
    expect(bloc).toContain("alerte forte");
    expect(bloc).toContain(CATALOGUE_CARDIO_VERSION);
  });

  it("liste les 6 signaux avec nom, id et cause mortelle", () => {
    for (const s of SIGNAUX_URGENCE_CARDIO) {
      expect(bloc).toContain(s.nom);
      expect(bloc).toContain(s.id);
      expect(bloc).toContain(s.causeMortelle);
    }
  });

  it("expose les déclencheurs verbatim de chaque signal (utile au futur pré-filtre)", () => {
    for (const s of SIGNAUX_URGENCE_CARDIO) {
      for (const v of s.verbatim) {
        expect(bloc).toContain(v);
      }
    }
  });
});
