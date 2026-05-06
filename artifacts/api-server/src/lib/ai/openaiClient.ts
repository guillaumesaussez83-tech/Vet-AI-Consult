import OpenAI from "openai";
import { GPT_MODEL, GPT_MAX_TOKENS } from "../constants";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AIResponse {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

export async function callGPT(
  prompt: string,
  maxTokens: "long" | "short" = "short",
  jsonMode = false,
): Promise<AIResponse> {
  const completion = await openai.chat.completions.create({
    model: GPT_MODEL,
    max_tokens: GPT_MAX_TOKENS[maxTokens],
    messages: [{ role: "user", content: prompt }],
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  });
  const text = completion.choices[0]?.message?.content ?? "";
  return {
    text: text.trim(),
    usage: {
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}
