/**
 * Individual signal calculators for AI text detection.
 * Each signal returns a 0-1 score where higher means more AI-like.
 */

import {
  AI_PHRASES,
  AI_SENTENCE_STARTERS,
  COMMON_BIGRAMS,
  STOP_WORDS,
  UNKNOWN_WORD_LOG_PROB,
  WORD_LOG_PROBS,
} from "./corpus";

export type SignalResult = {
  score: number;
  value: number;
  label: string;
  explanation: string;
};

export type Token = {
  text: string;
  normalized: string;
  start: number;
  end: number;
};

export type Sentence = {
  text: string;
  start: number;
  end: number;
  tokens: Token[];
  wordCount: number;
};

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const regex = /[a-zA-Z][a-zA-Z'-]*/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      text: match[0],
      normalized: match[0].toLowerCase().replace(/[^a-z]/g, ""),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

export function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  const regex = /[^.!?\n]+[.!?]+|[^.!?\n]+$/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const rawText = match[0];
    const trimmed = rawText.trim();
    if (!trimmed) continue;

    const leadingWs = rawText.length - rawText.trimStart().length;
    const start = match.index + leadingWs;
    const end = start + trimmed.length;

    const sentenceTokens = tokenize(trimmed).map((t) => ({
      ...t,
      start: t.start + start,
      end: t.end + start,
    }));

    sentences.push({
      text: trimmed,
      start,
      end,
      tokens: sentenceTokens,
      wordCount: sentenceTokens.length,
    });
  }
  return sentences;
}

// ---------------------------------------------------------------------------
// SIGNAL 1: Perplexity estimation via word-frequency log probability
// ---------------------------------------------------------------------------
// AI text tends to use more predictable, common words. We estimate "perplexity"
// by averaging the negative log probability of each word. Lower = more
// predictable = more AI-like.

export function perplexitySignal(tokens: Token[]): SignalResult {
  if (tokens.length === 0) {
    return {
      score: 0.5,
      value: 0,
      label: "PERPLEXITY",
      explanation: "Insufficient text for perplexity calculation.",
    };
  }

  let totalLogProb = 0;
  let count = 0;
  for (const t of tokens) {
    if (!t.normalized) continue;
    const lp = WORD_LOG_PROBS[t.normalized] ?? UNKNOWN_WORD_LOG_PROB;
    totalLogProb += lp;
    count++;
  }

  const avgLogProb = count > 0 ? totalLogProb / count : UNKNOWN_WORD_LOG_PROB;
  const perplexity = Math.exp(avgLogProb / 4); // Scaled perplexity value

  // Map avg log prob to AI score.
  // Very predictable text (all common words): avgLogProb ~6-7 → high AI score
  // Very diverse text (lots of rare words): avgLogProb ~10+ → low AI score
  // Sweet spot: AI writing tends to sit around 7.5-9 (sophisticated but predictable)
  let score: number;
  if (avgLogProb < 6.5) {
    // Extremely common words only - could be simple human writing OR basic AI
    score = 0.55;
  } else if (avgLogProb < 8.0) {
    // The "AI zone" - polished but predictable
    score = 0.75 - (avgLogProb - 6.5) * 0.05;
  } else if (avgLogProb < 9.5) {
    // Mixed - could go either way
    score = 0.55 - (avgLogProb - 8.0) * 0.15;
  } else {
    // High entropy - rare words, likely human
    score = Math.max(0.15, 0.33 - (avgLogProb - 9.5) * 0.1);
  }

  return {
    score: clamp(score, 0, 1),
    value: round(perplexity, 1),
    label: "PERPLEXITY",
    explanation:
      score > 0.6
        ? "Low perplexity detected. Word choices are highly predictable."
        : score < 0.4
          ? "High perplexity. Vocabulary shows natural variation."
          : "Moderate perplexity. Mixed word predictability.",
  };
}

// ---------------------------------------------------------------------------
// SIGNAL 2: Burstiness (sentence length variance)
// ---------------------------------------------------------------------------
// Humans vary sentence length naturally. AI tends toward uniform sentence
// lengths. Measured as coefficient of variation: stdev / mean.

export function burstinessSignal(sentences: Sentence[]): SignalResult {
  if (sentences.length < 2) {
    return {
      score: 0.5,
      value: 0,
      label: "BURSTINESS",
      explanation: "Need at least 2 sentences for burstiness analysis.",
    };
  }

  const lengths = sentences.map((s) => s.wordCount).filter((l) => l > 0);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (mean === 0) {
    return {
      score: 0.5,
      value: 0,
      label: "BURSTINESS",
      explanation: "Insufficient content for burstiness.",
    };
  }

  const variance =
    lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
  const stdev = Math.sqrt(variance);
  const burstiness = stdev / mean;

  // Mapping:
  // < 0.2 → very uniform → likely AI (score ~0.85)
  // 0.2-0.35 → somewhat uniform → moderate AI signal (score 0.55-0.7)
  // 0.35-0.6 → natural variation → likely human (score 0.2-0.4)
  // > 0.6 → high variation → human (score ~0.1)
  let score: number;
  if (burstiness < 0.2) {
    score = 0.85 - burstiness * 0.5;
  } else if (burstiness < 0.35) {
    score = 0.75 - (burstiness - 0.2) * 1.0;
  } else if (burstiness < 0.6) {
    score = 0.6 - (burstiness - 0.35) * 1.2;
  } else {
    score = Math.max(0.1, 0.3 - (burstiness - 0.6) * 0.3);
  }

  return {
    score: clamp(score, 0, 1),
    value: round(burstiness, 2),
    label: "BURSTINESS",
    explanation:
      burstiness < 0.25
        ? "Sentences are unusually uniform in length. Common AI pattern."
        : burstiness < 0.4
          ? "Sentence lengths show some variation."
          : "Natural sentence-length variation detected.",
  };
}

// ---------------------------------------------------------------------------
// SIGNAL 3: Lexical diversity (TTR + MTLD)
// ---------------------------------------------------------------------------

export function lexicalDiversitySignal(tokens: Token[]): SignalResult {
  const contentWords = tokens
    .map((t) => t.normalized)
    .filter((w) => w && !STOP_WORDS.has(w));

  if (contentWords.length < 10) {
    return {
      score: 0.5,
      value: 0,
      label: "VOCAB VARIETY",
      explanation: "Too short to measure lexical diversity.",
    };
  }

  const unique = new Set(contentWords);
  const ttr = unique.size / contentWords.length;

  // MTLD: count how many word-groups reach a TTR threshold of 0.72
  const mtld = calculateMTLD(contentWords, 0.72);

  // Map TTR to AI score
  // High TTR (>0.7) = diverse vocab = likely human (low score)
  // Low TTR (<0.4) = repetitive vocab = could be AI (high score)
  // But text length affects TTR, so we weight MTLD more for long texts
  const lengthAdjusted = contentWords.length > 100 ? mtld / 100 : ttr;

  let score: number;
  if (lengthAdjusted > 0.75) {
    score = 0.2;
  } else if (lengthAdjusted > 0.6) {
    score = 0.4 - (lengthAdjusted - 0.6) * 1.0;
  } else if (lengthAdjusted > 0.45) {
    score = 0.6 - (lengthAdjusted - 0.45) * 1.3;
  } else {
    score = Math.min(0.8, 0.65 + (0.45 - lengthAdjusted) * 0.5);
  }

  const label: "LOW" | "MEDIUM" | "HIGH" =
    ttr < 0.5 ? "LOW" : ttr < 0.7 ? "MEDIUM" : "HIGH";

  return {
    score: clamp(score, 0, 1),
    value: round(ttr, 2),
    label: "VOCAB VARIETY",
    explanation:
      label === "LOW"
        ? `Limited vocabulary range (${label}). Could indicate AI generation.`
        : label === "MEDIUM"
          ? `Moderate vocabulary variety (${label}).`
          : `Rich vocabulary variety (${label}). Characteristic of human writing.`,
  };
}

function calculateMTLD(words: string[], threshold: number): number {
  // Bidirectional MTLD - average of forward and backward
  return (
    (mtldOneDirection(words, threshold) +
      mtldOneDirection([...words].reverse(), threshold)) /
    2
  );
}

function mtldOneDirection(words: string[], threshold: number): number {
  let factors = 0;
  let currentTypes = new Set<string>();
  let currentCount = 0;

  for (const w of words) {
    currentCount++;
    currentTypes.add(w);
    const ttr = currentTypes.size / currentCount;
    if (ttr <= threshold) {
      factors++;
      currentTypes = new Set();
      currentCount = 0;
    }
  }

  // Partial factor for remaining words
  if (currentCount > 0) {
    const ttr = currentTypes.size / currentCount;
    const partial = (1 - ttr) / (1 - threshold);
    factors += partial;
  }

  return factors > 0 ? words.length / factors : words.length;
}

// ---------------------------------------------------------------------------
// SIGNAL 4: Sentence structure uniformity
// ---------------------------------------------------------------------------
// AI tends to produce syntactically similar sentences. We measure:
// - How many sentences start with the same words
// - Variance in sentence starter types
// - Transition word density

export function uniformitySignal(sentences: Sentence[]): SignalResult {
  if (sentences.length < 3) {
    return {
      score: 0.5,
      value: 0,
      label: "STRUCTURE",
      explanation: "Need 3+ sentences for structural analysis.",
    };
  }

  // Collect first 1-2 words of each sentence
  const starters = sentences
    .map((s) => s.tokens.slice(0, 2).map((t) => t.normalized).join(" "))
    .filter(Boolean);

  // Count duplicate starters
  const starterCounts = new Map<string, number>();
  for (const s of starters) {
    starterCounts.set(s, (starterCounts.get(s) || 0) + 1);
  }

  const maxRepeat = Math.max(...Array.from(starterCounts.values()));
  const repeatRatio = maxRepeat / starters.length;

  // Count how many sentences start with AI-typical transitions
  let aiStarterCount = 0;
  for (const s of sentences) {
    const firstWord = s.tokens[0]?.normalized;
    if (firstWord && AI_SENTENCE_STARTERS.has(firstWord)) {
      aiStarterCount++;
    }
  }
  const aiStarterRatio = aiStarterCount / sentences.length;

  // Combined score
  let score = 0.3;
  if (repeatRatio > 0.4) score += 0.3;
  else if (repeatRatio > 0.25) score += 0.15;

  if (aiStarterRatio > 0.25) score += 0.35;
  else if (aiStarterRatio > 0.15) score += 0.2;
  else if (aiStarterRatio > 0.08) score += 0.1;

  const explanation =
    aiStarterRatio > 0.2
      ? `${Math.round(aiStarterRatio * 100)}% of sentences start with AI-typical transitions.`
      : repeatRatio > 0.3
        ? "Repetitive sentence-starter patterns detected."
        : "Sentence structure shows natural variation.";

  return {
    score: clamp(score, 0, 1),
    value: round(aiStarterRatio, 2),
    label: "STRUCTURE",
    explanation,
  };
}

// ---------------------------------------------------------------------------
// SIGNAL 5: Discourse pattern / AI phrase detection
// ---------------------------------------------------------------------------
// Scan for characteristic AI phrases and return score + matched phrases.

export type PhraseMatch = {
  phrase: string;
  category: string;
  weight: number;
  start: number;
  end: number;
};

export function discourseSignal(
  text: string,
  tokens: Token[],
): { result: SignalResult; matches: PhraseMatch[] } {
  const lower = text.toLowerCase();
  const matches: PhraseMatch[] = [];

  for (const entry of AI_PHRASES) {
    let idx = 0;
    while ((idx = lower.indexOf(entry.phrase, idx)) !== -1) {
      // Ensure word boundary
      const before = idx === 0 ? " " : lower[idx - 1];
      const after =
        idx + entry.phrase.length >= lower.length
          ? " "
          : lower[idx + entry.phrase.length];
      if (!/[a-zA-Z]/.test(before) && !/[a-zA-Z]/.test(after)) {
        matches.push({
          phrase: entry.phrase,
          category: entry.category,
          weight: entry.weight,
          start: idx,
          end: idx + entry.phrase.length,
        });
      }
      idx += entry.phrase.length;
    }
  }

  // Score based on phrase density and weights
  const wordCount = tokens.length;
  if (wordCount < 10) {
    return {
      result: {
        score: 0.5,
        value: 0,
        label: "DISCOURSE",
        explanation: "Too short to evaluate discourse patterns.",
      },
      matches: [],
    };
  }

  // Weighted phrase score per 100 words
  const weightedSum = matches.reduce((a, m) => a + m.weight, 0);
  const phraseDensity = (weightedSum / wordCount) * 100;

  // Also: unique match categories (hitting multiple AI-pattern types = stronger)
  const categoriesHit = new Set(matches.map((m) => m.category)).size;

  let score = 0.25;
  if (phraseDensity > 3) score += 0.5;
  else if (phraseDensity > 2) score += 0.35;
  else if (phraseDensity > 1) score += 0.2;
  else if (phraseDensity > 0.3) score += 0.1;

  if (categoriesHit >= 4) score += 0.15;
  else if (categoriesHit >= 3) score += 0.1;
  else if (categoriesHit >= 2) score += 0.05;

  // Boilerplate AI giveaways are a near-certainty
  if (matches.some((m) => m.category === "ai_giveaway")) {
    score = Math.max(score, 0.95);
  }

  let explanation: string;
  if (matches.length === 0) {
    explanation = "No AI-typical phrases detected.";
  } else if (matches.length === 1) {
    explanation = `Found 1 AI-typical phrase: "${matches[0].phrase}".`;
  } else {
    explanation = `Found ${matches.length} AI-typical phrases across ${categoriesHit} pattern categor${
      categoriesHit === 1 ? "y" : "ies"
    }.`;
  }

  return {
    result: {
      score: clamp(score, 0, 1),
      value: round(phraseDensity, 2),
      label: "DISCOURSE",
      explanation,
    },
    matches,
  };
}

// ---------------------------------------------------------------------------
// Bigram predictability (used for sentence-level scoring)
// ---------------------------------------------------------------------------

export function bigramPredictability(tokens: Token[]): number {
  if (tokens.length < 2) return 0.5;
  let commonCount = 0;
  let total = 0;
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i].normalized} ${tokens[i + 1].normalized}`;
    total++;
    if (COMMON_BIGRAMS.has(bigram)) commonCount++;
  }
  return total > 0 ? commonCount / total : 0;
}

// ---------------------------------------------------------------------------
// Flesch Reading Ease (for the report UI)
// ---------------------------------------------------------------------------

export function fleschScore(tokens: Token[], sentences: Sentence[]): number {
  if (tokens.length === 0 || sentences.length === 0) return 60;
  const totalWords = tokens.length;
  const totalSentences = sentences.length;
  let totalSyllables = 0;
  for (const t of tokens) {
    totalSyllables += countSyllables(t.normalized);
  }
  const score =
    206.835 -
    1.015 * (totalWords / totalSentences) -
    84.6 * (totalSyllables / totalWords);
  return clamp(score, 0, 100);
}

function countSyllables(word: string): number {
  if (!word) return 0;
  const groups = word.match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
