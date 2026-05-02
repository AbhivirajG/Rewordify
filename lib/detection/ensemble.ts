/**
 * Weighted ensemble: combines all signals into a single AI probability
 * with confidence calibration based on text length.
 */

import {
  analyzeSentences,
  preprocess,
  type SentenceAnalysis,
} from "./analyzer";
import {
  burstinessSignal,
  discourseSignal,
  fleschScore,
  lexicalDiversitySignal,
  perplexitySignal,
  round,
  type SignalResult,
  uniformitySignal,
} from "./signals";
import { verdictFromScore } from "./verdict";

export type ConfidenceLevel = "low" | "moderate" | "high";

export type EnsembleResult = {
  aiPercent: number;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  signals: {
    perplexity: SignalResult;
    burstiness: SignalResult;
    lexicalDiversity: SignalResult;
    uniformity: SignalResult;
    discourse: SignalResult;
  };
  fleschScore: number;
  wordCount: number;
  sentenceCount: number;
  sentences: SentenceAnalysis[];
  verdict: string;
  verdictTone: "ai" | "mixed" | "human";
};

const SIGNAL_WEIGHTS = {
  perplexity: 0.25,
  burstiness: 0.22,
  lexicalDiversity: 0.13,
  uniformity: 0.15,
  discourse: 0.25,
};

export function analyze(text: string): EnsembleResult {
  const pre = preprocess(text);
  const { tokens, sentences, text: fullText, wordCount } = pre;

  // Per-signal scores
  const perplexity = perplexitySignal(tokens);
  const burstiness = burstinessSignal(sentences);
  const lexicalDiversity = lexicalDiversitySignal(tokens);
  const uniformity = uniformitySignal(sentences);
  const { result: discourse } = discourseSignal(fullText, tokens);

  // Weighted combination
  const rawScore =
    perplexity.score * SIGNAL_WEIGHTS.perplexity +
    burstiness.score * SIGNAL_WEIGHTS.burstiness +
    lexicalDiversity.score * SIGNAL_WEIGHTS.lexicalDiversity +
    uniformity.score * SIGNAL_WEIGHTS.uniformity +
    discourse.score * SIGNAL_WEIGHTS.discourse;

  // Confidence calibration based on text length
  // Short texts get pulled toward 50% to reflect low confidence
  const confidence = confidenceFromLength(wordCount);
  const calibrated = calibrateScore(rawScore, wordCount, confidence);

  // Per-sentence analysis
  const sentenceAnalyses = analyzeSentences(pre);

  // Incorporate per-sentence signal back into document score
  // (prevents wildly different document vs sentence scores)
  if (sentenceAnalyses.length > 0) {
    const meanSentenceScore =
      sentenceAnalyses.reduce((a, s) => a + s.aiProbability, 0) /
      sentenceAnalyses.length;
    // Blend: 70% ensemble, 30% mean sentence score
    const blended = calibrated * 0.7 + meanSentenceScore * 0.3;
    return buildResult(
      blended,
      confidence,
      wordCount,
      pre.sentences.length,
      {
        perplexity,
        burstiness,
        lexicalDiversity,
        uniformity,
        discourse,
      },
      fleschScore(tokens, sentences),
      sentenceAnalyses,
    );
  }

  return buildResult(
    calibrated,
    confidence,
    wordCount,
    sentences.length,
    { perplexity, burstiness, lexicalDiversity, uniformity, discourse },
    fleschScore(tokens, sentences),
    sentenceAnalyses,
  );
}

function confidenceFromLength(wordCount: number): ConfidenceLevel {
  if (wordCount < 100) return "low";
  if (wordCount < 300) return "moderate";
  return "high";
}

function calibrateScore(
  rawScore: number,
  wordCount: number,
  confidence: ConfidenceLevel,
): number {
  // For very short text, shrink extreme scores toward 50% (uncertainty)
  if (confidence === "low") {
    // Pull toward 0.5 by up to 25%
    const pullStrength = 0.25 * (1 - wordCount / 100);
    return rawScore * (1 - pullStrength) + 0.5 * pullStrength;
  }
  if (confidence === "moderate") {
    const pullStrength = 0.1 * (1 - (wordCount - 100) / 200);
    return rawScore * (1 - pullStrength) + 0.5 * pullStrength;
  }
  return rawScore;
}

function buildResult(
  finalScore: number,
  confidence: ConfidenceLevel,
  wordCount: number,
  sentenceCount: number,
  signals: EnsembleResult["signals"],
  flesch: number,
  sentenceAnalyses: SentenceAnalysis[],
): EnsembleResult {
  const aiPercent = Math.round(finalScore * 100);
  const { verdict, verdictTone } = verdictFromScore(aiPercent);

  let confidenceReason: string;
  if (confidence === "low") {
    confidenceReason = `Low confidence — text is short (${wordCount} words). Add more content for reliable analysis.`;
  } else if (confidence === "moderate") {
    confidenceReason = `Moderate confidence — ${wordCount} words analyzed. 300+ words recommended for highest accuracy.`;
  } else {
    confidenceReason = `High confidence — ${wordCount} words provide sufficient signal.`;
  }

  return {
    aiPercent,
    confidence,
    confidenceReason,
    signals,
    fleschScore: round(flesch, 1),
    wordCount,
    sentenceCount,
    sentences: sentenceAnalyses,
    verdict,
    verdictTone,
  };
}
