import { callClaude, callClaudeStream, callClaudeMultimodal } from "./claudeClient";
import { callGPT } from "./openaiClient";
import { logAIUsage } from "./aiMetrics";
import { AI_MODEL, GPT_MODEL } from "../constants";
import type { AIResponse } from "./claudeClient";
import { logger } from "../logger";


const AI_TIMEOUT_MS = parseInt(process.env["AI_TIMEOUT_MS"] ?? "30000", 10); // configurable via env
// Timeout STREAMING : porte sur le PREMIER token (TTFB), pas sur la duree totale.
// Une fois le flux demarre, une longue generation legitime ne doit JAMAIS etre coupee
// (c'est tout l'interet du streaming face au mur de 30s synchrone).
const AI_TTFB_MS = parseInt(process.env["AI_TTFB_MS"] ?? "20000", 10);

// Garde-fou anti-emballement. Volontairement large pour ne JAMAIS tronquer un
// prompt clinique (anamnese/examen) ni la consigne de sortie : une troncature
// silencieuse produirait un diagnostic mal informe. ~24k chars (~6k tokens),
// derisoire face aux 200k de contexte de Sonnet.
const MAX_PROMPT_CHARS = 24_000;

function withAITimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(Object.assign(new Error("AI_TIMEOUT"), { status: 504, code: "AI_TIMEOUT" })),
        AI_TIMEOUT_MS,
      )
    ),
  ]);
}

export type AITask =
  | "diagnostic_differentiel"
  | "drug_interactions"
  | "anamnese"
  | "examen_clinique"
  | "facturation"
  | "resume_client"
  | "commande_stock";

/** Tasks routed to Claude Sonnet — high clinical value */
const CLAUDE_TASKS = new Set<AITask>(["diagnostic_differentiel", "drug_interactions"]);

export interface RunAITaskOptions {
  clinicId: string;
  consultationId?: number;
  maxTokens?: "long" | "medium" | "short";
  jsonMode?: boolean;
}

/**
 * Main AI router.
 * - Claude Sonnet  → diagnostic_differentiel, drug_interactions
 * - GPT-4o-mini   → everything else (anamnese, examen, facturation, resume_client, commande_stock)
 * Logs cost + latency to ai_usage_logs for every call.
 */
export async function runAITask(
  task: AITask,
  prompt: string,
  options: RunAITaskOptions,
): Promise<string> {
  const start = Date.now();
  const safePrompt = typeof prompt === "string" ? prompt.slice(0, MAX_PROMPT_CHARS) : String(prompt);
  const useClaude = CLAUDE_TASKS.has(task);
  const maxTokens = options.maxTokens ?? "short";
  const model = useClaude ? AI_MODEL : GPT_MODEL;

  let result: AIResponse;
  if (useClaude) {
    result = await withAITimeout(callClaude(safePrompt, maxTokens));
  } else {
    result = await withAITimeout(callGPT(safePrompt, maxTokens, options.jsonMode ?? false));
  }

  logAIUsage({
    clinicId: options.clinicId,
    consultationId: options.consultationId,
    taskType: task,
    model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    durationMs: Date.now() - start,
  }).catch((err) => logger.warn({ err }, "AI usage log failed"));

  return result.text;
}

/**
 * Variante STREAMEE de runAITask (taches Claude uniquement, ex. diagnostic_differentiel).
 * Emet les fragments de texte via `onDelta` des leur arrivee, puis renvoie la
 * reponse complete + l'usage.
 *
 * Contrairement a runAITask, AUCUN timeout total : le timeout ne porte que sur le
 * premier token (TTFB via AI_TTFB_MS). Une fois le flux demarre, la generation va
 * jusqu'au bout — c'est ce qui resout la coupure passerelle Railway ~20s.
 */
export async function runAITaskStream(
  task: AITask,
  prompt: string,
  options: RunAITaskOptions,
  onDelta: (text: string) => void,
): Promise<AIResponse> {
  const start = Date.now();
  const safePrompt = typeof prompt === "string" ? prompt.slice(0, MAX_PROMPT_CHARS) : String(prompt);
  const maxTokens = options.maxTokens ?? "long";
  const model = CLAUDE_TASKS.has(task) ? AI_MODEL : GPT_MODEL;

  let firstTokenSeen = false;
  let ttfbTimer: ReturnType<typeof setTimeout> | undefined;
  const ttfbGuard = new Promise<never>((_, reject) => {
    ttfbTimer = setTimeout(() => {
      if (!firstTokenSeen) {
        reject(Object.assign(new Error("AI_TTFB_TIMEOUT"), { status: 504, code: "AI_TTFB_TIMEOUT" }));
      }
    }, AI_TTFB_MS);
  });

  const work = callClaudeStream(safePrompt, maxTokens, (delta) => {
    if (!firstTokenSeen) {
      firstTokenSeen = true;
      if (ttfbTimer) clearTimeout(ttfbTimer);
    }
    onDelta(delta);
  });

  let result: AIResponse;
  try {
    result = await Promise.race([work, ttfbGuard]);
  } finally {
    if (ttfbTimer) clearTimeout(ttfbTimer);
  }

  logAIUsage({
    clinicId: options.clinicId,
    consultationId: options.consultationId,
    taskType: task,
    model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    durationMs: Date.now() - start,
  }).catch((err) => logger.warn({ err }, "AI usage log failed"));

  return result;
}

export { callClaudeMultimodal };
