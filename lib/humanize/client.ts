/**
 * Anthropic SDK wrapper for the humanizer pipeline.
 *
 * Lazily instantiates a single Anthropic client per Node process and
 * exposes one helper, `callClaude()`, that takes a system + user prompt
 * pair and returns the trimmed text response plus token usage for cost
 * accounting.
 */

import Anthropic from "@anthropic-ai/sdk";

export const HUMANIZER_MODEL = "claude-haiku-4-5";

export type ClaudeCallResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local.",
    );
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export async function callClaude(args: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  model?: string;
}): Promise<ClaudeCallResult> {
  const client = getClient();

  const message = await client.messages.create({
    model: args.model ?? HUMANIZER_MODEL,
    max_tokens: args.maxTokens,
    system: args.systemPrompt,
    messages: [{ role: "user", content: args.userPrompt }],
  });

  // Anthropic returns an array of content blocks; for text responses it's
  // typically a single block of type "text". Concatenate any text blocks
  // we find so we don't accidentally drop output.
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  return {
    text,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

/**
 * Approximate Haiku 4.5 cost in dollars given token counts.
 * Pricing as of May 2026: $1/M input, $5/M output.
 */
export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 1.0 + outputTokens * 5.0) / 1_000_000;
}
