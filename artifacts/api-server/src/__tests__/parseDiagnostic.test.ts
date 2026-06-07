/**
 * Tests du durcissement de securite de parseDiagnosticResult (etape 5).
 *
 * Point cle : on NE fait jamais confiance au seul booleen du modele. Si le
 * tableau d'urgences vitales est rempli, urgenceVitaleDetectee doit etre true,
 * meme si le modele a oublie le flag ou l'a mis a false.
 *
 * Lancer : pnpm vitest parseDiagnostic
 */
import { describe, it, expect } from "vitest";
import { parseDiagnosticResult, niveauMaxUrgences } from "../lib/ai/diagnosticResult";

const base = {
  diagnostics: [{ nom: "X", probabilite: "Elevee", description: "desc" }],
  recommandations: "R",
  urgence: "Non urgent",
  texteComplet: "T",
};
const urgence = {
  signal: "detresse-respiratoire-aigue",
  niveau: "alerte forte",
  declencheurs: ["respire bouche ouverte"],
  causeMortelle: "Oedeme pulmonaire",
};

describe("parseDiagnosticResult — normalisation urgences vitales", () => {
  it("derive detectee=true si le tableau est rempli mais le flag oublie", () => {
    const r = parseDiagnosticResult(JSON.stringify({ ...base, urgencesVitales: [urgence] }));
    expect(r.urgenceVitaleDetectee).toBe(true);
    expect(r.urgencesVitales).toHaveLength(1);
  });

  it("force detectee=true meme si le modele met le flag a false avec un tableau rempli", () => {
    const r = parseDiagnosticResult(
      JSON.stringify({ ...base, urgenceVitaleDetectee: false, urgencesVitales: [urgence] }),
    );
    expect(r.urgenceVitaleDetectee).toBe(true);
  });

  it("retourne []/false quand aucune urgence n'est presente", () => {
    const r = parseDiagnosticResult(JSON.stringify(base));
    expect(r.urgencesVitales).toEqual([]);
    expect(r.urgenceVitaleDetectee).toBe(false);
  });

  it("respecte un flag true explicite meme avec tableau vide", () => {
    const r = parseDiagnosticResult(JSON.stringify({ ...base, urgenceVitaleDetectee: true }));
    expect(r.urgenceVitaleDetectee).toBe(true);
  });

  it("preserve les champs de diagnostic existants", () => {
    const r = parseDiagnosticResult(JSON.stringify(base));
    expect(r.diagnostics).toEqual(base.diagnostics);
    expect(r.recommandations).toBe("R");
    expect(r.urgence).toBe("Non urgent");
    expect(r.texteComplet).toBe("T");
  });

  it("tolere une reponse entouree de texte (extraction JSON)", () => {
    const r = parseDiagnosticResult("blabla " + JSON.stringify(base) + " fin");
    expect(r.urgenceVitaleDetectee).toBe(false);
  });

  it("leve une erreur si aucun JSON n'est present", () => {
    expect(() => parseDiagnosticResult("pas de json ici")).toThrow();
  });
});

describe("niveauMaxUrgences", () => {
  const u = (niveau: string) => ({
    signal: "s",
    niveau,
    declencheurs: [],
    causeMortelle: "c",
  });

  it("retourne null si aucune urgence", () => {
    expect(niveauMaxUrgences([])).toBeNull();
    expect(niveauMaxUrgences(null)).toBeNull();
    expect(niveauMaxUrgences(undefined)).toBeNull();
  });

  it("retourne 'alerte forte' des qu'une urgence est forte", () => {
    expect(niveauMaxUrgences([u("alerte"), u("alerte forte")])).toBe("alerte forte");
    expect(niveauMaxUrgences([u("Alerte FORTE")])).toBe("alerte forte");
  });

  it("retourne 'alerte' si aucune n'est forte", () => {
    expect(niveauMaxUrgences([u("alerte"), u("alerte")])).toBe("alerte");
  });
});
