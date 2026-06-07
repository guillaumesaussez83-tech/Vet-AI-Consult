/**
 * Types + parsing du resultat de diagnostic IA.
 *
 * Module PUR (sans dependance lourde : pas de db, pas de client IA) pour rester
 * testable en isolation -- cf. `__tests__/parseDiagnostic.test.ts`. aiService
 * importe et re-exporte ces symboles.
 */

export interface DiagnosticItem {
  nom: string;
  probabilite: string;
  description: string;
}

export interface UrgenceVitaleItem {
  signal: string;
  niveau: string;
  declencheurs: string[];
  causeMortelle: string;
  actionImmediate?: string;
}

export interface DiagnosticResult {
  diagnostics: DiagnosticItem[];
  recommandations: string;
  urgence: string;
  texteComplet: string;
  /** Urgences cardio "a ne jamais rater" detectees (catalogue v1). Vide si aucune. */
  urgencesVitales: UrgenceVitaleItem[];
  /** Vrai si au moins une urgence vitale est detectee. */
  urgenceVitaleDetectee: boolean;
}

export function parseDiagnosticResult(text: string): DiagnosticResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");
  const raw = JSON.parse(jsonMatch[0]) as DiagnosticResult;
  // Filet de securite : on NE fait jamais confiance au seul booleen du modele.
  // Si le tableau d'urgences est rempli mais le flag oublie, on considere
  // l'urgence vitale detectee (sur une urgence a ne jamais rater, on prefere
  // sur-signaler que rater).
  const urgencesVitales = Array.isArray(raw.urgencesVitales) ? raw.urgencesVitales : [];
  return {
    ...raw,
    urgencesVitales,
    urgenceVitaleDetectee: raw.urgenceVitaleDetectee === true || urgencesVitales.length > 0,
  };
}

export function fallbackDiagnostic(text: string): DiagnosticResult {
  return {
    diagnostics: [{ nom: "Diagnostic indetermine", probabilite: "Moderee", description: text }],
    recommandations: "Consulter un specialiste pour une evaluation approfondie",
    urgence: "Non urgent",
    texteComplet: text,
    urgencesVitales: [],
    urgenceVitaleDetectee: false,
  };
}

/**
 * Niveau le plus grave parmi des urgences ("alerte forte" > "alerte").
 * Renvoie null si aucune. Utilise pour le resume d'audit (metadata.niveauMax).
 */
export function niveauMaxUrgences(
  urgences: UrgenceVitaleItem[] | null | undefined,
): string | null {
  if (!Array.isArray(urgences) || urgences.length === 0) return null;
  const forte = urgences.some((u) =>
    String(u?.niveau ?? "").toLowerCase().includes("forte"),
  );
  return forte ? "alerte forte" : "alerte";
}
