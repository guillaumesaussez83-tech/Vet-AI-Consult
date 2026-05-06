import { db, aiUsageLogsTable } from "@workspace/db";
import { AI_COSTS } from "../constants";

export const MODEL_COSTS = AI_COSTS;

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const costs = AI_COSTS[model as keyof typeof AI_COSTS];
  if (!costs) return 0;
  return (inputTokens / 1_000_000) * costs.inputPerM +
    (outputTokens / 1_000_000) * costs.outputPerM;
}

export async function logAIUsage(params: {
  clinicId: string;
  consultationId?: number;
  taskType: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs?: number;
}): Promise<void> {
  const costUsd = calculateCost(params.model, params.inputTokens, params.outputTokens);
  try {
    await db.insert(aiUsageLogsTable).values({
      clinicId: params.clinicId,
      consultationId: params.consultationId,
      taskType: params.taskType,
      model: params.model,
      tokensIn: params.inputTokens,
      tokensOut: params.outputTokens,
      costUsd,
      durationMs: params.durationMs,
    });
  } catch {
    // Logging failures must never break the main flow
  }
}
