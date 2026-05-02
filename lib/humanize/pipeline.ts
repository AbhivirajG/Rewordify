/**
 * Humanizer pipelines.
 *
 *   humanizeDocument(text)
 *     Two-pass rewrite for the whole document:
 *       1. Paraphrase pass — sentence cadence, vocabulary swaps.
 *       2. Style-inject pass — hedges, fragments, parenthetical asides.
 *     Costs ~$0.009 per typical 500-word essay (Haiku 4.5 pricing).
 *
 *   humanizeSentence({ sentence, contextBefore, contextAfter })
 *     Single Claude call rewriting just one sentence with surrounding
 *     context for flow. Used by the per-sentence surgical UI.
 */

import { callClaude, estimateCostUsd } from "./client";
import {
  paraphrasePrompt,
  sentenceRewritePrompt,
  styleInjectPrompt,
} from "./prompts";

export type HumanizeUsage = {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

export type HumanizeDocumentResult = {
  text: string;
  usage: HumanizeUsage;
  passes: Array<{ name: string } & HumanizeUsage>;
};

const MAX_TOKENS_DOC_PASS = 2048;
const MAX_TOKENS_SENTENCE = 256;

export async function humanizeDocument(
  text: string,
): Promise<HumanizeDocumentResult> {
  const pass1Prompt = paraphrasePrompt(text);
  const pass1 = await callClaude({
    systemPrompt: pass1Prompt.systemPrompt,
    userPrompt: pass1Prompt.userPrompt,
    maxTokens: MAX_TOKENS_DOC_PASS,
  });

  const pass2Prompt = styleInjectPrompt(pass1.text || text);
  const pass2 = await callClaude({
    systemPrompt: pass2Prompt.systemPrompt,
    userPrompt: pass2Prompt.userPrompt,
    maxTokens: MAX_TOKENS_DOC_PASS,
  });

  const totalIn = pass1.inputTokens + pass2.inputTokens;
  const totalOut = pass1.outputTokens + pass2.outputTokens;

  return {
    text: pass2.text || pass1.text || text,
    usage: {
      inputTokens: totalIn,
      outputTokens: totalOut,
      estimatedCostUsd: estimateCostUsd(totalIn, totalOut),
    },
    passes: [
      {
        name: "paraphrase",
        inputTokens: pass1.inputTokens,
        outputTokens: pass1.outputTokens,
        estimatedCostUsd: estimateCostUsd(pass1.inputTokens, pass1.outputTokens),
      },
      {
        name: "style-inject",
        inputTokens: pass2.inputTokens,
        outputTokens: pass2.outputTokens,
        estimatedCostUsd: estimateCostUsd(pass2.inputTokens, pass2.outputTokens),
      },
    ],
  };
}

export type HumanizeSentenceResult = {
  text: string;
  usage: HumanizeUsage;
};

export async function humanizeSentence(args: {
  sentence: string;
  contextBefore: string;
  contextAfter: string;
}): Promise<HumanizeSentenceResult> {
  const prompt = sentenceRewritePrompt(args);
  const out = await callClaude({
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    maxTokens: MAX_TOKENS_SENTENCE,
  });

  // Defend against Claude returning multi-line output even though the
  // prompt asks for a single line. Take the first non-empty line.
  const cleaned =
    out.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? args.sentence;

  return {
    text: cleaned,
    usage: {
      inputTokens: out.inputTokens,
      outputTokens: out.outputTokens,
      estimatedCostUsd: estimateCostUsd(out.inputTokens, out.outputTokens),
    },
  };
}
