import { AI_MODEL, TVA_RATE_MULTIPLIER } from "./constants";
import { searchVetKnowledge, formatRagContext } from "./vetKnowledgeService";
import type { ObjectStorageService } from "./objectStorage";
import { runAITask, callClaudeMultimodal } from "./ai/aiRouter";
import { logAIUsage } from "./ai/aiMetrics";
import { buildAnamnesePrompt } from "./ai/prompts/anamnese";
import { buildExamenPrompt } from "./ai/prompts/examen";
import { buildDiagnosticPrompt } from "./ai/prompts/diagnostic";
import { buildFacturationPrompt } from "./ai/prompts/facturation";
import { buildResumeClientPrompt } from "./ai/prompts/communication";

export interface DiagnosticParams {
  espece: string;
  race?: string | null;
  age?: string | null;
  poids?: number | null;
  sexe: string;
  sterilise: boolean;
  anamnese: string;
  examenClinique: string;
  examensComplementaires?: string | null;
  antecedents?: string | null;
  allergies?: string | null;
}

export interface DiagnosticItem {
  nom: string;
  probabilite: string;
  description: string;
}

export interface DiagnosticResult {
  diagnostics: DiagnosticItem[];
  recommandations: string;
  urgence: string;
  texteComplet: string;
}

export interface ResumeClientParams {
  diagnostic?: string | null;
  ordonnance?: string | null;
  notes?: string | null;
  espece?: string | null;
  nomAnimal?: string | null;
  nomProprietaire?: string | null;
}

export interface LigneFacture {
  acteId: number | null;
  description: string;
  quantite: number;
  prixUnitaire: number;
  tvaRate: number;
  montantHT: number;
}

export interface FactureVoixResult {
  lignes: LigneFacture[];
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  resume: string;
}

export interface ActeRef {
  id: number;
  nom: string;
  categorie: string;
  prixDefaut: number;
  tvaRate: number;
  unite?: string | null;
}

function parseDiagnosticResult(text: string): DiagnosticResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");
  return JSON.parse(jsonMatch[0]) as DiagnosticResult;
}

function fallbackDiagnostic(text: string): DiagnosticResult {
  return {
    diagnostics: [{ nom: "Diagnostic indetermine", probabilite: "Moderee", description: text }],
    recommandations: "Consulter un specialiste pour une evaluation approfondie",
    urgence: "Non urgent",
    texteComplet: text,
  };
}

function buildRagQuery(params: DiagnosticParams): string {
  const parts: string[] = [params.espece];
  if (params.race) parts.push(params.race);
  if (params.age) parts.push(params.age);
  parts.push(params.anamnese.substring(0, 300));
  parts.push(params.examenClinique.substring(0, 200));
  if (params.examensComplementaires) parts.push(params.examensComplementaires.substring(0, 150));
  return parts.filter(Boolean).join(" ");
}

// v1 - Reformulation anamnese par dictee vocale -> GPT-4o-mini
export async function reformulerAnamnese(
  transcript: string,
  clinicId = "default",
): Promise<{ anamnese: string }> {
  const prompt = buildAnamnesePrompt(transcript);
  const text = await runAITask("anamnese", prompt, { clinicId, maxTokens: "short" });
  return { anamnese: text };
}

// v1 - Structuration examen clinique par dictee -> GPT-4o-mini
export async function structurerExamenClinique(
  transcript: string,
  clinicId = "default",
): Promise<{ examenClinique: string }> {
  const prompt = buildExamenPrompt(transcript);
  const text = await runAITask("examen_clinique", prompt, { clinicId, maxTokens: "short" });
  return { examenClinique: text };
}

// v2 - Diagnostic differentiel standard avec RAG ANMV/EMA/RESAPATH -> Claude Sonnet
export async function diagnosticDifferentiel(
  params: DiagnosticParams,
  clinicId = "default",
  consultationId?: number,
): Promise<DiagnosticResult> {
  const ragResults = await searchVetKnowledge(buildRagQuery(params));
  const ragContext = formatRagContext(ragResults);
  const prompt = buildDiagnosticPrompt(params, ragContext);
  const text = await runAITask("diagnostic_differentiel", prompt, {
    clinicId,
    consultationId,
    maxTokens: "long",
  });
  try { return parseDiagnosticResult(text); } catch { return fallbackDiagnostic(text); }
}

// v2 - Diagnostic enrichi avec pieces jointes -> Claude Sonnet (multimodal direct)
export async function diagnosticEnrichi(
  params: DiagnosticParams & { objectPaths?: string[] },
  storage: ObjectStorageService,
  clinicId = "default",
  consultationId?: number,
): Promise<DiagnosticResult> {
  const ragResults = await searchVetKnowledge(buildRagQuery(params));
  const ragContext = formatRagContext(ragResults);
  const { objectPaths } = params;

  const textBlock = { type: "text" as const, text: buildDiagnosticPrompt(params, ragContext) };
  const contentBlocks: unknown[] = [textBlock];

  if (Array.isArray(objectPaths) && objectPaths.length > 0) {
    for (const objPath of objectPaths) {
      try {
        const file = await storage.getObjectEntityFile(objPath);
        const [buffer] = await file.download();
        const base64 = buffer.toString("base64");
        const [metadata] = await file.getMetadata();
        const contentType = (metadata.contentType as string) || "image/jpeg";
        if (contentType === "application/pdf") {
          contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } });
        } else if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(contentType)) {
          contentBlocks.push({ type: "image", source: { type: "base64", media_type: contentType, data: base64 } });
        }
      } catch { /* fichier ignore silencieusement */ }
    }
  }

  const start = Date.now();
  const result = await callClaudeMultimodal(contentBlocks, "long");
  void logAIUsage({
    clinicId, consultationId, taskType: "diagnostic_enrichi", model: AI_MODEL,
    inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens,
    durationMs: Date.now() - start,
  });

  try { return parseDiagnosticResult(result.text); } catch { return fallbackDiagnostic(result.text); }
}

// v1 - Resume de consultation pour le proprietaire -> GPT-4o-mini
export async function resumeClient(
  params: ResumeClientParams,
  clinicId = "default",
): Promise<{ resume: string }> {
  const prompt = buildResumeClientPrompt(params);
  const text = await runAITask("resume_client", prompt, { clinicId, maxTokens: "short" });
  return { resume: text };
}

// v2 - Generation de facture par dictee vocale -> GPT-4o-mini
export async function genererFactureVoix(
  transcript: string,
  actes: ActeRef[],
  medicamentsDejaFactures: string[] = [],
  clinicId = "default",
): Promise<FactureVoixResult> {
  const exclusionNote = medicamentsDejaFactures.length > 0
    ? "\nMEDICAMENTS DEJA INTEGRES DANS L'ORDONNANCE (NE PAS dupliquer dans la facture) :\n" +
      medicamentsDejaFactures.map(m => `- ${m}`).join("\n") + "\n"
    : "";

  const prompt = buildFacturationPrompt(transcript, actes, exclusionNote);
  const text = await runAITask("facturation", prompt, { clinicId, maxTokens: "short", jsonMode: true });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Aucun JSON trouve dans la reponse");
  const result = JSON.parse(jsonMatch[0]) as FactureVoixResult;

  const actesPrices = new Map(actes.map(a => [a.id, a.prixDefaut]));
  const lignesCorrigees: LigneFacture[] = (result.lignes ?? []).map(l => {
    const prix = l.acteId != null && actesPrices.has(l.acteId)
      ? (actesPrices.get(l.acteId) ?? l.prixUnitaire) : (l.prixUnitaire ?? 0);
    return { ...l, prixUnitaire: prix, montantHT: prix * (l.quantite ?? 1) };
  });
  const totalHT = lignesCorrigees.reduce((s, l) => s + l.montantHT, 0);
  const totalTVA = totalHT * TVA_RATE_MULTIPLIER;
  return { ...result, lignes: lignesCorrigees, totalHT, totalTVA, totalTTC: totalHT + totalTVA };
}
