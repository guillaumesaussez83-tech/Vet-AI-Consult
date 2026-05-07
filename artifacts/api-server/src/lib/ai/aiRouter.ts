import { callClaude, callClaudeMultimodal } from "./claudeClient";
import { callGPT } from "./openaiClient";
import { logAIUsage } from "./aiMetrics";
import { AI_MODEL, GPT_MODEL } from "../constants";
import type { AIResponse } from "./claudeClient";


const AI_TIMEOUT_MS = 30_000; // 30s -- audit Phase 0

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

/** Tasks routed to Claude Sonnet Ã¢ÂÂ high clinical value */
const CLAUDE_TASKS = new Set<AITask>(["diagnostic_differentiel", "drug_interactions"]);

export interface RunAITaskOptions {
  clinicId: string;
  consultationId?: number;
  maxTokens?: "long" | "short";
  jsonMode?: boolean;
}

/**
 * Main AI router.
 * - Claude Sonnet  Ã¢ÂÂ diagnostic_differentiel, drug_interactions
 * - GPT-4o-mini   Ã¢ÂÂ everything else (anamnese, examen, facturation, resume_client, commande_stock)
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

  void logAIUsage({
    clinicId: options.clinicId,
    consultationId: options.consultationId,
    taskType: task,
    model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    durationMs: Date.now() - start,
  });

  return result.text;
}

export { callClaudeMultimodal };
