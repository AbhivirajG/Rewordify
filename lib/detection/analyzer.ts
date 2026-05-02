/**
 * Core analyzer: tokenizes text and produces per-sentence AI probability scores.
 */

import {
  bigramPredictability,
  clamp,
  discourseSignal,
  perplexitySignal,
  round,
  splitSentences,
  tokenize,
  type PhraseMatch,
  type Sentence,
  type Token,
} from "./signals";

export type SentenceFlag =
  | "low_perplexity"
  | "uniform_length"
  | "ai_phrase"
  | "predictable_bigrams"
  | "transitions"
  | "clean_structure";

export type SentenceAnalysis = {
  text: string;
  start: number;
  end: number;
  wordCount: number;
  aiProbability: number;
  flags: SentenceFlag[];
  flagReasons: string[];
};

export type TokenizedText = {
  text: string;
  tokens: Token[];
  sentences: Sentence[];
  wordCount: number;
  charCount: number;
};

/**
 * Tokenize text into sentences + tokens for downstream analysis.
 */
export function preprocess(text: string): TokenizedText {
  const tokens = tokenize(text);
  const sentences = splitSentences(text);
  return {
    text,
    tokens,
    sentences,
    wordCount: tokens.length,
    charCount: text.length,
  };
}

/**
 * Score a single sentence for AI-likelihood.
 * Takes into account local signals AND the document context (mean length,
 * which AI phrases hit here, etc.).
 */
export function analyzeSentence(
  sentence: Sentence,
  context: {
    meanLength: number;
    stdLength: number;
    phraseMatches: PhraseMatch[];
  },
): SentenceAnalysis {
  const flags: SentenceFlag[] = [];
  const flagReasons: string[] = [];

  // --- Sub-score 1: perplexity on this sentence ---
  const perp = perplexitySignal(sentence.tokens);
  const perplexityScore = perp.score;
  if (perplexityScore > 0.65) {
    flags.push("low_perplexity");
    flagReasons.push("Highly predictable word choices");
  }

  // --- Sub-score 2: length vs document mean ---
  // Sentences close to the mean length contribute to uniformity signal
  let lengthScore = 0.5;
  if (context.stdLength > 0) {
    const zScore = Math.abs(sentence.wordCount - context.meanLength) / context.stdLength;
    // Sentences within 0.5 stdev of the mean in a low-variance doc get flagged
    if (context.stdLength / context.meanLength < 0.3 && zScore < 0.8) {
      lengthScore = 0.7;
      flags.push("uniform_length");
      flagReasons.push("Length matches document's uniform pattern");
    } else if (zScore < 0.3) {
      lengthScore = 0.6;
    } else {
      lengthScore = 0.35;
    }
  }

  // --- Sub-score 3: AI phrase presence ---
  const overlappingMatches = context.phraseMatches.filter(
    (m) => m.start >= sentence.start && m.end <= sentence.end,
  );
  let phraseScore = 0.3;
  if (overlappingMatches.length > 0) {
    const maxWeight = Math.max(...overlappingMatches.map((m) => m.weight));
    phraseScore = clamp(0.5 + maxWeight * 0.45, 0.5, 0.98);
    flags.push("ai_phrase");
    const phrases = overlappingMatches.map((m) => `"${m.phrase}"`).join(", ");
    flagReasons.push(`Contains AI-typical phrasing: ${phrases}`);
  }

  // --- Sub-score 4: bigram predictability ---
  const bigramScore = bigramPredictability(sentence.tokens);
  if (bigramScore > 0.35) {
    flags.push("predictable_bigrams");
    flagReasons.push("Uses many common word-pair patterns");
  }
  // Translate bigram hit rate into an AI-likelihood score
  // 0.0-0.2: natural (low), 0.2-0.35: normal, 0.35+: predictable
  const bigramAiScore = clamp(0.3 + bigramScore * 1.2, 0.1, 0.85);

  // --- Sub-score 5: "too clean" sentence structure ---
  // No pauses (commas/semicolons/dashes), moderate-to-long length
  let cleanScore = 0.4;
  const punctuationCount = (sentence.text.match(/[,;:—–-]/g) ?? []).length;
  if (sentence.wordCount >= 12 && punctuationCount === 0) {
    cleanScore = 0.65;
    flags.push("clean_structure");
    flagReasons.push("Long sentence with no internal pauses");
  } else if (sentence.wordCount >= 20 && punctuationCount < 2) {
    cleanScore = 0.6;
  }

  // --- Combine: weighted average ---
  const weights = {
    perplexity: 0.30,
    length: 0.15,
    phrase: 0.25,
    bigram: 0.15,
    clean: 0.15,
  };

  let combined =
    perplexityScore * weights.perplexity +
    lengthScore * weights.length +
    phraseScore * weights.phrase +
    bigramAiScore * weights.bigram +
    cleanScore * weights.clean;

  // Boost for boilerplate AI giveaways
  if (overlappingMatches.some((m) => m.category === "ai_giveaway")) {
    combined = Math.max(combined, 0.92);
  }

  // Multiple flags amplify confidence slightly
  if (flags.length >= 3) {
    combined = Math.min(1, combined + 0.07);
  }

  return {
    text: sentence.text,
    start: sentence.start,
    end: sentence.end,
    wordCount: sentence.wordCount,
    aiProbability: round(clamp(combined, 0, 1), 3),
    flags,
    flagReasons,
  };
}

/**
 * Analyze every sentence in the text.
 */
export function analyzeSentences(
  preprocessed: TokenizedText,
): SentenceAnalysis[] {
  const { sentences, text, tokens } = preprocessed;
  if (sentences.length === 0) return [];

  // Gather context
  const lengths = sentences.map((s) => s.wordCount);
  const meanLength =
    lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  const variance =
    lengths.reduce((a, b) => a + (b - meanLength) ** 2, 0) /
    Math.max(1, lengths.length);
  const stdLength = Math.sqrt(variance);

  const { matches: phraseMatches } = discourseSignal(text, tokens);

  return sentences.map((s) =>
    analyzeSentence(s, { meanLength, stdLength, phraseMatches }),
  );
}
