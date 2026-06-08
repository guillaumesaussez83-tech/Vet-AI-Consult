import { anthropic } from "@workspace/integrations-anthropic-ai";
import { AI_MODEL, AI_MAX_TOKENS } from "../constants";

export interface AIResponse {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

export async function callClaude(
  prompt: string,
  maxTokens: "long" | "medium" | "short" = "long",
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

/**
 * Variante streamee de callClaude. Emet chaque fragment de texte via `onDelta`
 * des son arrivee (architecture SSE en amont), et renvoie le texte complet + l'usage
 * une fois le flux termine (usage capte dans les events message_start / message_delta).
 */
export async function callClaudeStream(
  prompt: string,
  maxTokens: "long" | "medium" | "short",
  onDelta: (text: string) => void,
): Promise<AIResponse> {
  const stream = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS[maxTokens],
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of stream) {
    if (event.type === "message_start") {
      inputTokens = event.message.usage.input_tokens;
    } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      onDelta(event.delta.text);
    } else if (event.type === "message_delta") {
      outputTokens = event.usage.output_tokens;
    }
  }

  return {
    text: text.trim(),
    usage: { inputTokens, outputTokens },
  };
}

export async function callClaudeMultimodal(
  contentBlocks: unknown[],
  maxTokens: "long" | "medium" | "short" = "long",
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
