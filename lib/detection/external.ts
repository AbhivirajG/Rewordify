/**
 * Optional external API verification for high-stakes / ambiguous cases.
 *
 * This module is OFF by default. It is wired up so you can enable it for
 * Pro/Max tier users once you have API keys. Nothing calls these functions
 * unless you pass `deepScan: true` to /api/detect AND the relevant env var
 * is set.
 *
 * To enable:
 *   1. Sign up at GPTZero (https://gptzero.me/api) or Sapling
 *      (https://sapling.ai/ai-content-detector).
 *   2. Add the key to .env.local:
 *        GPTZERO_API_KEY=...
 *        SAPLING_API_KEY=...
 *   3. In /api/detect/route.ts, import `verifyWithExternal` and call it
 *      when ensemble.aiPercent is in the ambiguous 40-60% band for Pro/Max.
 */

export type ExternalProvider = "gptzero" | "sapling";

export type ExternalResult = {
  provider: ExternalProvider;
  aiProbability: number; // 0-1
  rawResponse?: unknown;
  error?: string;
};

// ---------------------------------------------------------------------------
// GPTZero
// ---------------------------------------------------------------------------
// Docs: https://gptzero.me/api
// Endpoint: POST https://api.gptzero.me/v2/predict/text
// Header:   x-api-key: <GPTZERO_API_KEY>
// Body:     { "document": "...", "multilingual": false }
// Response: { documents: [{ class_probabilities: { ai: n, human: n, mixed: n }, ... }] }

export async function verifyWithGPTZero(
  text: string,
): Promise<ExternalResult> {
  const apiKey = process.env.GPTZERO_API_KEY;
  if (!apiKey) {
    return {
      provider: "gptzero",
      aiProbability: 0,
      error: "GPTZERO_API_KEY not configured",
    };
  }

  try {
    const res = await fetch("https://api.gptzero.me/v2/predict/text", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ document: text, multilingual: false }),
    });

    if (!res.ok) {
      return {
        provider: "gptzero",
        aiProbability: 0,
        error: `GPTZero returned ${res.status}`,
      };
    }

    const data = await res.json();
    const doc = data?.documents?.[0];
    const aiProb = doc?.class_probabilities?.ai ?? 0;

    return {
      provider: "gptzero",
      aiProbability: typeof aiProb === "number" ? aiProb : 0,
      rawResponse: data,
    };
  } catch (e) {
    return {
      provider: "gptzero",
      aiProbability: 0,
      error: e instanceof Error ? e.message : "GPTZero request failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Sapling
// ---------------------------------------------------------------------------
// Docs: https://sapling.ai/docs/api/aidetect
// Endpoint: POST https://api.sapling.ai/api/v1/aidetect
// Body: { key, text }
// Response: { score: number (0-1), sentence_scores: [...] }

export async function verifyWithSapling(
  text: string,
): Promise<ExternalResult> {
  const apiKey = process.env.SAPLING_API_KEY;
  if (!apiKey) {
    return {
      provider: "sapling",
      aiProbability: 0,
      error: "SAPLING_API_KEY not configured",
    };
  }

  try {
    const res = await fetch("https://api.sapling.ai/api/v1/aidetect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey, text }),
    });

    if (!res.ok) {
      return {
        provider: "sapling",
        aiProbability: 0,
        error: `Sapling returned ${res.status}`,
      };
    }

    const data = await res.json();
    const score = typeof data?.score === "number" ? data.score : 0;

    return {
      provider: "sapling",
      aiProbability: score,
      rawResponse: data,
    };
  } catch (e) {
    return {
      provider: "sapling",
      aiProbability: 0,
      error: e instanceof Error ? e.message : "Sapling request failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Combined verification
// ---------------------------------------------------------------------------
// Calls all configured providers in parallel, averages their scores.
// Use this in /api/detect when ensemble is ambiguous AND the user is on
// a paid tier.

export async function verifyWithExternal(text: string): Promise<{
  averageAiProbability: number;
  providers: ExternalResult[];
}> {
  const results = await Promise.all([
    verifyWithGPTZero(text),
    verifyWithSapling(text),
  ]);

  const successful = results.filter((r) => !r.error);
  const averageAiProbability =
    successful.length > 0
      ? successful.reduce((a, r) => a + r.aiProbability, 0) / successful.length
      : 0;

  return { averageAiProbability, providers: results };
}

/**
 * Decide whether to trigger a deep scan based on ensemble score and user tier.
 * Deep scans are called when:
 *   - User tier allows it (pro or max)
 *   - Ensemble score is in the ambiguous band (40-65)
 *   - Text is long enough to be worth the API cost (>= 300 words)
 */
export function shouldDeepScan(
  ensembleAiPercent: number,
  wordCount: number,
  tier: "free" | "pro" | "max",
): boolean {
  if (tier === "free") return false;
  if (wordCount < 300) return false;
  return ensembleAiPercent >= 40 && ensembleAiPercent <= 65;
}
