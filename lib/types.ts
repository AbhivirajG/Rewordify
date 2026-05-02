export type HighlightedSegment = {
  start: number;
  end: number;
  aiProbability?: number;
  flags?: string[];
  reasons?: string[];
  belowThreshold?: boolean;
  // Populated client-side after a surgical rewrite. Lets the UI show the
  // sentence as "humanized" and offer a one-click revert.
  humanized?: { originalText: string; humanizedText: string };
};

export type ConfidenceLevel = "low" | "moderate" | "high";
export type VerdictTone = "ai" | "mixed" | "human";
export type VocabVariety = "LOW" | "MEDIUM" | "HIGH";

export type ModelInfo = {
  name: string;
  score: number; // 0-1 AI probability from the neural model
  chunks: number; // how many chunks the text was split into
};

export type DetectionResult = {
  aiPercent: number;
  heuristicPercent?: number; // raw heuristic-only score (pre-blend)
  modelInfo?: ModelInfo; // populated when a neural model contributed to the score
  perplexity: number;
  burstiness: number;
  fleschScore: number;
  vocabVariety: VocabVariety;
  wordCount: number;
  sentenceCount: number;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  verdictTone: VerdictTone;
  verdict: string;
  highlightedSegments: HighlightedSegment[];
  signalExplanations: {
    perplexity: string;
    burstiness: string;
    lexicalDiversity: string;
    uniformity: string;
    discourse: string;
  };
  originalText: string;
};

export type HumanizeUsage = {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

export type HumanizeResult = {
  humanizedText: string;
  usage?: HumanizeUsage;
  fallback?: boolean; // true if regex fallback was used instead of Claude
  error?: string;
};

export type StoredAnalysis = {
  id: string;
  createdAt: number;
  result: DetectionResult;
};
