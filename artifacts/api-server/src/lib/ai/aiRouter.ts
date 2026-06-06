import { callClaude, callClaudeStream, callClaudeMultimodal } from "./claudeClient";
import { callGPT } from "./openaiClient";
import { logAIUsage } from "./aiMetrics";
import { AI_MODEL, GPT_MODEL } from "../constants";
import type { AIResponse } from "./claudeClient";
import { logger } from "../logger";


const AI_TIMEOUT_MS = parseInt(process.env["AI_TIMEOUT_MS"] ?? "30000", 10); // configurable via env
const AI_TTFB_MS = parseInt(process.env["AI_TTFB_MS"] ?? "20000", 10); // timeout sur le 1er token (streaming)

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

/** Tasks routed to Claude Sonnet ÃÂ¢ÃÂÃÂ high clinical value */
const CLAUDE_TASKS = new Set<AITask>(["diagnostic_differentiel", "drug_interactions"]);

export interface RunAITaskOptions {
  clinicId: string;
  consultationId?: number;
  maxTokens?: "long" | "short";
  jsonMode?: boolean;
}

/**
 * Main AI router.
 * - Claude Sonnet  ÃÂ¢ÃÂÃÂ diagnostic_differentiel, drug_interactions
 * - GPT-4o-mini   ÃÂ¢ÃÂÃÂ everything else (anamnese, examen, facturation, resume_client, commande_stock)
 * Logs cost + latency to ai_usage_logs for every call.
 */
export async function runAITask(
  task: AITask,
  prompt: string,
  options: RunAITaskOptions,
): Promise<string> {
  const start = Date.now();
  const safePrompt = typeof prompt === "string" ? prompt.slice(0, 10_000) : String(prompt);
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
 * Variante STREAMÉE de runAITask (tâches Claude, ex. diagnostic_differentiel).
 * Émet les fragments de texte via `onDelta` dès leur arrivée, puis renvoie la
 * réponse complète + l'usage.
 *
 * Le timeout porte sur le PREMIER token (TTFB), pas sur la durée totale : une
 * longue génération légitime ne doit pas être coupée une fois le flux démarré.
 */
export async function runAITaskStream(
  task: AITask,
  prompt: string,
  options: RunAITaskOptions,
  onDelta: (text: string) => void,
): Promise<AIResponse> {
  const start = Date.now();
  const safePrompt = typeof prompt === "string" ? prompt.slice(0, 10_000) : String(prompt);
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
