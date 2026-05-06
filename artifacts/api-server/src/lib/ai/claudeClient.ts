import { anthropic } from "@workspace/integrations-anthropic-ai";
import { AI_MODEL, AI_MAX_TOKENS } from "../constants";

export interface AIResponse {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

export async function callClaude(
  prompt: string,
  maxTokens: "long" | "short" = "long",
): Promise<AIResponse> {
  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS[maxTokens],
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");
  return {
    text: content.text.trim(),
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  };
}

export async function callClaudeMultimodal(
  contentBlocks: unknown[],
  maxTokens: "long" | "short" = "long",
): Promise<AIResponse> {
  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS[maxTokens],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: "user", content: contentBlocks as any }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");
  return {
    text: content.text.trim(),
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  };
}
