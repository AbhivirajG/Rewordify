/**
 * Given a final AI percentage (0-100), return the verdict copy and tone used
 * in the results page. Kept separate from the ensemble so the client can
 * re-derive the verdict after blending a model score into the heuristic one.
 */

import type { VerdictTone } from "@/lib/types";

export function verdictFromScore(aiPercent: number): {
  verdict: string;
  verdictTone: VerdictTone;
} {
  if (aiPercent >= 75) {
    return {
      verdictTone: "ai",
      verdict:
        "Strong indicators of AI-generated content. Multiple signals converge on machine-authored patterns: predictable word choices, uniform sentence structure, and AI-typical phrasing.",
    };
  }
  if (aiPercent >= 55) {
    return {
      verdictTone: "ai",
      verdict:
        "Likely AI-generated or heavily AI-assisted. The text shows characteristic markers of generative models, though some sections exhibit more natural variation.",
    };
  }
  if (aiPercent >= 40) {
    return {
      verdictTone: "mixed",
      verdict:
        "Mixed signals detected. This text may contain both human and AI-generated passages, or it has been lightly edited by AI. Review the highlighted sections.",
    };
  }
  if (aiPercent >= 25) {
    return {
      verdictTone: "human",
      verdict:
        "Likely human-authored. Minor AI-like patterns detected but the overall structural variance and vocabulary suggest organic writing.",
    };
  }
  return {
    verdictTone: "human",
    verdict:
      "Strongly human-authored. High burstiness, vocabulary variety, and natural discourse patterns throughout.",
  };
}
