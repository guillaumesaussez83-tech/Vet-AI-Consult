/**
 * Tests d'integration du prompt de diagnostic apres injection du catalogue
 * d'urgences cardio (etape 3).
 *
 * On verrouille : (1) l'injection integrale du bloc catalogue, (2) la presence
 * de chaque signal par id, (3) l'extension du contrat JSON de sortie, et (4) la
 * NON-regression de la structure existante (diagnostics / recommandations /
 * urgence / texteComplet).
 *
 * Lancer : pnpm vitest diagnosticPrompt
 */
import { describe, it, expect } from "vitest";
import { buildDiagnosticPrompt } from "../lib/ai/prompts/diagnostic";
import {
  renderCardioUrgencesBlock,
  SIGNAUX_URGENCE_CARDIO,
} from "../lib/ai/prompts/cardioUrgences";

const prompt = buildDiagnosticPrompt(
  {
    espece: "Chien",
    race: "Doberman",
    sexe: "M",
    sterilise: false,
    poids: 30,
    anamnese: "A fait un malaise en courant",
    examenClinique: "Bruit de galop, arythmie auscultee",
  },
  "[CONTEXTE RAG]",
);

describe("buildDiagnosticPrompt — injection urgences cardio (etape 3)", () => {
  it("injecte l'integralite du bloc catalogue cardio", () => {
    expect(prompt).toContain(renderCardioUrgencesBlock());
  });

  it("mentionne chaque signal cardio par son id stable", () => {
    for (const s of SIGNAUX_URGENCE_CARDIO) {
      expect(prompt).toContain(s.id);
    }
  });

  it("etend le contrat JSON avec urgenceVitaleDetectee + urgencesVitales", () => {
    expect(prompt).toContain("urgenceVitaleDetectee");
    expect(prompt).toContain("urgencesVitales");
    expect(prompt).toContain('"niveau"');
    expect(prompt).toContain('"declencheurs"');
    expect(prompt).toContain('"causeMortelle"');
  });

  it("NON-regression : conserve la structure de sortie existante", () => {
    expect(prompt).toContain('"diagnostics"');
    expect(prompt).toContain('"recommandations"');
    expect(prompt).toContain('"urgence"');
    expect(prompt).toContain('"texteComplet"');
  });
});
