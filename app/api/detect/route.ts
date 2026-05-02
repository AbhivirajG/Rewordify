import { NextResponse } from "next/server";
import { analyze } from "@/lib/detection/ensemble";
import {
  shouldDeepScan,
  verifyWithExternal,
} from "@/lib/detection/external";
import type { DetectionResult, VocabVariety } from "@/lib/types";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// AI detection engine (multi-signal ensemble, runs locally — no API key needed)
// ---------------------------------------------------------------------------
// Signals combined (see lib/detection/ensemble.ts):
//   1. Perplexity (word-frequency log probability)
//   2. Burstiness (sentence-length variance)
//   3. Lexical diversity (TTR + MTLD)
//   4. Structural uniformity (sentence-starter patterns)
//   5. Discourse patterns (AI-typical phrase matching)
//
// Optional: `deepScan: true` in the request body triggers external API
// verification (GPTZero / Sapling) when ensemble score is ambiguous. Enable
// this for Pro/Max users once you have keys — see lib/detection/external.ts.
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  let body: { text?: unknown; deepScan?: unknown; tier?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  // TODO: Pull the real tier from Supabase using the authenticated user.
  //       Example:
  //         const supabase = await createClient();
  //         const { data: { user } } = await supabase.auth.getUser();
  //         const { data: sub } = await supabase
  //           .from("subscriptions")
  //           .select("tier")
  //           .eq("user_id", user.id)
  //           .single();
  //         const tier = sub?.tier ?? "free";
  const tier =
    body.tier === "pro" || body.tier === "max" ? body.tier : "free";
  const deepScanRequested = body.deepScan === true;

  const ensemble = analyze(text);

  // Map ensemble signals -> DetectionResult shape
  const vocabVariety: VocabVariety =
    (ensemble.signals.lexicalDiversity.explanation
      .match(/\((LOW|MEDIUM|HIGH)\)/)?.[1] as VocabVariety) ?? "MEDIUM";

  // Optional deep scan: blend external API results into the score when
  // ensemble is uncertain and user tier allows it.
  let finalAiPercent = ensemble.aiPercent;
  if (
    deepScanRequested &&
    shouldDeepScan(ensemble.aiPercent, ensemble.wordCount, tier)
  ) {
    try {
      const external = await verifyWithExternal(text);
      if (external.providers.some((p) => !p.error)) {
        // Blend: 60% local ensemble, 40% external consensus
        finalAiPercent = Math.round(
          ensemble.aiPercent * 0.6 +
            external.averageAiProbability * 100 * 0.4,
        );
      }
    } catch (e) {
      console.error("Deep scan failed, falling back to ensemble only:", e);
    }
  }

  // Highlights: all sentences above threshold + top N most-suspicious below it.
  // This guarantees users always see which sentences the detector considered
  // most AI-like, even when the document overall reads as human.
  const THRESHOLD = 0.6;
  const MIN_HIGHLIGHTS = 3;

  const sortedByProb = [...ensemble.sentences].sort(
    (a, b) => b.aiProbability - a.aiProbability,
  );

  const aboveThreshold = sortedByProb.filter(
    (s) => s.aiProbability >= THRESHOLD,
  );

  const selected: typeof sortedByProb = [...aboveThreshold];
  if (selected.length < MIN_HIGHLIGHTS) {
    for (const s of sortedByProb) {
      if (selected.length >= MIN_HIGHLIGHTS) break;
      if (selected.includes(s)) continue;
      // Skip sentences with near-zero signal — don't highlight something
      // that has no reason to be flagged.
      if (s.aiProbability < 0.25) break;
      selected.push(s);
    }
  }

  const highlightedSegments = selected
    .sort((a, b) => a.start - b.start)
    .map((s) => ({
      start: s.start,
      end: s.end,
      aiProbability: s.aiProbability,
      flags: s.flags,
      reasons: s.flagReasons,
      belowThreshold: s.aiProbability < THRESHOLD,
    }));

  const result: DetectionResult = {
    aiPercent: finalAiPercent,
    perplexity: ensemble.signals.perplexity.value,
    burstiness: ensemble.signals.burstiness.value,
    fleschScore: ensemble.fleschScore,
    vocabVariety,
    wordCount: ensemble.wordCount,
    sentenceCount: ensemble.sentenceCount,
    confidence: ensemble.confidence,
    confidenceReason: ensemble.confidenceReason,
    verdictTone: ensemble.verdictTone,
    verdict: ensemble.verdict,
    highlightedSegments,
    signalExplanations: {
      perplexity: ensemble.signals.perplexity.explanation,
      burstiness: ensemble.signals.burstiness.explanation,
      lexicalDiversity: ensemble.signals.lexicalDiversity.explanation,
      uniformity: ensemble.signals.uniformity.explanation,
      discourse: ensemble.signals.discourse.explanation,
    },
    originalText: text,
  };

  return NextResponse.json(result);
}
