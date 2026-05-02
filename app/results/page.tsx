"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type {
  DetectionResult,
  HighlightedSegment,
  HumanizeResult,
  StoredAnalysis,
} from "@/lib/types";
import {
  detectAiWithModel,
  MODEL_ID,
  type ModelProgress,
} from "@/lib/detection/model";
import { verdictFromScore } from "@/lib/detection/verdict";
import { HumanizeBetaModal } from "@/components/HumanizeBetaModal";
import { GptZeroBanner } from "@/components/GptZeroBanner";

const STORAGE_KEY = "rewordify:lastAnalysis";

// Same blend weights used on the homepage so live re-detection produces a
// score the user can directly compare to the original.
const MODEL_WEIGHT = 0.7;
const HEURISTIC_WEIGHT = 0.3;

type TextPiece =
  | { kind: "plain"; text: string }
  | { kind: "highlight"; text: string; segment: HighlightedSegment; segmentIdx: number };

function buildPieces(
  text: string,
  segments: HighlightedSegment[],
): TextPiece[] {
  if (!segments.length) return [{ kind: "plain", text }];

  const sorted = segments
    .map((seg, idx) => ({ seg, idx }))
    .filter(({ seg }) => seg.start < seg.end)
    .sort((a, b) => a.seg.start - b.seg.start);

  const pieces: TextPiece[] = [];
  let cursor = 0;
  for (const { seg, idx } of sorted) {
    const start = Math.max(seg.start, cursor);
    const end = Math.min(seg.end, text.length);
    if (start > cursor) {
      pieces.push({ kind: "plain", text: text.slice(cursor, start) });
    }
    if (end > start) {
      pieces.push({
        kind: "highlight",
        text: text.slice(start, end),
        segment: seg,
        segmentIdx: idx,
      });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < text.length) {
    pieces.push({ kind: "plain", text: text.slice(cursor) });
  }
  return pieces;
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-grow w-full max-w-5xl mx-auto px-8 pt-12 pb-24">
          <p className="font-code-sm text-code-sm text-outline">Loading…</p>
        </main>
      }
    >
      <ResultsInner />
    </Suspense>
  );
}

function ResultsInner() {
  const params = useSearchParams();
  const id = params.get("id");

  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Mutable display state — text and highlights both change as the user
  // performs whole-doc or surgical rewrites.
  const [displayText, setDisplayText] = useState<string>("");
  const [segments, setSegments] = useState<HighlightedSegment[]>([]);

  // Live blended AI %. Starts as the original analysis score; each rewrite
  // triggers a re-detection that updates this number so the user sees the
  // before/after delta in real time.
  const [liveAiPercent, setLiveAiPercent] = useState<number | null>(null);
  const [liveModelScore, setLiveModelScore] = useState<number | null>(null);
  const [liveHeuristicPercent, setLiveHeuristicPercent] = useState<number | null>(
    null,
  );

  // Whole-doc humanize state.
  const [humanizing, setHumanizing] = useState(false);
  const [humanizeError, setHumanizeError] = useState<string | null>(null);
  const [docOriginalSnapshot, setDocOriginalSnapshot] = useState<{
    text: string;
    segments: HighlightedSegment[];
  } | null>(null);

  // Beta modal (gates the whole-doc humanize) + post-humanize GPTZero banner.
  const [showBetaModal, setShowBetaModal] = useState(false);
  const [showGptZeroBanner, setShowGptZeroBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Surgical state — Set of segmentIdx currently being rewritten.
  const [surgicalPending, setSurgicalPending] = useState<Set<number>>(new Set());
  const [surgicalErrors, setSurgicalErrors] = useState<Record<number, string>>({});

  const [redetecting, setRedetecting] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Hydrate from sessionStorage and seed mutable state.
  useEffect(() => {
    setHydrated(true);
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredAnalysis;
      if (!id || parsed.id === id) {
        setAnalysis(parsed);
        setDisplayText(parsed.result.originalText);
        setSegments(parsed.result.highlightedSegments);
        setLiveAiPercent(parsed.result.aiPercent);
        setLiveModelScore(parsed.result.modelInfo?.score ?? null);
        setLiveHeuristicPercent(parsed.result.heuristicPercent ?? null);
      }
    } catch (e) {
      console.error("Failed to read stored analysis", e);
    }
  }, [id]);

  const result: DetectionResult | null = analysis?.result ?? null;
  const originalAiPercent = result?.aiPercent ?? null;

  const pieces = useMemo(
    () => buildPieces(displayText, segments),
    [displayText, segments],
  );

  // ---- Re-detection ------------------------------------------------------
  // After every rewrite, re-score the displayed text. Heuristics come from
  // the server (/api/detect, fast); the neural score from the in-browser
  // model. We blend with the same 70/30 weights as the homepage so the
  // delta is meaningful.
  // ----------------------------------------------------------------------
  const redetectSeqRef = useRef(0);

  async function runRedetection(text: string) {
    const seq = ++redetectSeqRef.current;
    setRedetecting(true);
    try {
      const heuristicPromise = fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
        .then((r) => (r.ok ? (r.json() as Promise<DetectionResult>) : null))
        .catch(() => null);

      const modelPromise = detectAiWithModel(text).catch((err) => {
        console.warn("Re-detect: model failed, using heuristics only", err);
        return null;
      });

      const [heuristic, model] = await Promise.all([
        heuristicPromise,
        modelPromise,
      ]);

      // If a newer re-detection started before this one finished, drop us.
      if (seq !== redetectSeqRef.current) return;

      if (!heuristic) return;

      const heuristicPercent = heuristic.aiPercent;
      const modelPercent = model
        ? Math.round(model.aiProbability * 100)
        : null;

      const blended =
        modelPercent != null
          ? Math.round(
              modelPercent * MODEL_WEIGHT + heuristicPercent * HEURISTIC_WEIGHT,
            )
          : heuristicPercent;

      setLiveAiPercent(blended);
      setLiveHeuristicPercent(heuristicPercent);
      if (model) setLiveModelScore(model.aiProbability);

      // Refresh highlights from the freshly-detected text. Preserve any
      // segments we've already marked as "humanized" (best-effort overlay
      // by character range overlap).
      const newSegments = mergeHumanizedFlags(
        heuristic.highlightedSegments,
        segments,
      );
      setSegments(newSegments);
    } finally {
      if (seq === redetectSeqRef.current) setRedetecting(false);
    }
  }

  // ---- Whole-doc humanize ------------------------------------------------
  async function handleHumanize() {
    if (!displayText || humanizing) return;
    setHumanizing(true);
    setHumanizeError(null);
    setCopied(false);
    setSurgicalErrors({});

    // Snapshot for "Restore original" undo, but only on the first humanize.
    if (!docOriginalSnapshot) {
      setDocOriginalSnapshot({ text: displayText, segments });
    }

    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: displayText }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errBody.error ?? `Humanize failed: ${res.status}`);
      }
      const data = (await res.json()) as HumanizeResult;
      setDisplayText(data.humanizedText);
      setSegments([]); // old highlights no longer reference valid offsets
      // Re-detect against the new text so highlights repopulate.
      await runRedetection(data.humanizedText);
      // Surface the quirky GPTZero nudge once the new score has settled.
      setShowGptZeroBanner(true);
      setBannerDismissed(false);
    } catch (e) {
      console.error(e);
      setHumanizeError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setHumanizing(false);
    }
  }

  function handleRestoreOriginal() {
    if (!docOriginalSnapshot) return;
    setDisplayText(docOriginalSnapshot.text);
    setSegments(docOriginalSnapshot.segments);
    setLiveAiPercent(originalAiPercent);
    setLiveModelScore(result?.modelInfo?.score ?? null);
    setLiveHeuristicPercent(result?.heuristicPercent ?? null);
    setDocOriginalSnapshot(null);
    setHumanizeError(null);
  }

  // ---- Surgical sentence-level humanize ---------------------------------
  async function handleSurgicalHumanize(segmentIdx: number) {
    const seg = segments[segmentIdx];
    if (!seg || surgicalPending.has(segmentIdx)) return;

    setSurgicalPending((prev) => {
      const next = new Set(prev);
      next.add(segmentIdx);
      return next;
    });
    setSurgicalErrors((prev) => {
      const { [segmentIdx]: _drop, ...rest } = prev;
      return rest;
    });

    try {
      const sentence = displayText.slice(seg.start, seg.end);
      const contextBefore = displayText.slice(Math.max(0, seg.start - 200), seg.start);
      const contextAfter = displayText.slice(seg.end, seg.end + 200);

      const res = await fetch("/api/humanize/sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence, contextBefore, contextAfter }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `Sentence rewrite failed: ${res.status}`);
      }
      const data = (await res.json()) as { humanizedSentence: string };

      const replacement = data.humanizedSentence.trim();
      if (!replacement) throw new Error("Empty rewrite returned");

      // Splice into displayText and shift downstream segments.
      const lengthDelta = replacement.length - sentence.length;
      const newText =
        displayText.slice(0, seg.start) +
        replacement +
        displayText.slice(seg.end);
      const newSegments = segments.map((s, idx) => {
        if (idx === segmentIdx) {
          return {
            ...s,
            end: s.start + replacement.length,
            humanized: { originalText: sentence, humanizedText: replacement },
          };
        }
        if (s.start >= seg.end) {
          return { ...s, start: s.start + lengthDelta, end: s.end + lengthDelta };
        }
        return s;
      });

      setDisplayText(newText);
      setSegments(newSegments);

      // Background re-detection — non-blocking so the user sees their
      // edit immediately and the score updates a beat later.
      void runRedetection(newText);
    } catch (e) {
      console.error(e);
      setSurgicalErrors((prev) => ({
        ...prev,
        [segmentIdx]:
          e instanceof Error ? e.message : "Couldn't rewrite that sentence.",
      }));
    } finally {
      setSurgicalPending((prev) => {
        const next = new Set(prev);
        next.delete(segmentIdx);
        return next;
      });
    }
  }

  function handleSurgicalUndo(segmentIdx: number) {
    const seg = segments[segmentIdx];
    if (!seg?.humanized) return;

    const { originalText, humanizedText } = seg.humanized;
    const lengthDelta = originalText.length - humanizedText.length;
    const newText =
      displayText.slice(0, seg.start) +
      originalText +
      displayText.slice(seg.start + humanizedText.length);
    const newSegments = segments.map((s, idx) => {
      if (idx === segmentIdx) {
        const { humanized: _drop, ...rest } = s;
        return { ...rest, end: s.start + originalText.length };
      }
      if (s.start >= seg.start + humanizedText.length) {
        return { ...s, start: s.start + lengthDelta, end: s.end + lengthDelta };
      }
      return s;
    });

    setDisplayText(newText);
    setSegments(newSegments);
    void runRedetection(newText);
  }

  async function handleCopy() {
    if (!displayText) return;
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Clipboard write failed", e);
    }
  }

  if (hydrated && !result) {
    return (
      <main className="flex-grow w-full max-w-5xl mx-auto px-8 pt-12 pb-24">
        <div className="border border-neutral-800 p-12 text-center">
          <h1 className="font-headline-md text-headline-md text-on-surface mb-4">
            No analysis found
          </h1>
          <p className="font-body-md text-body-md text-outline mb-8">
            Run a detection from the homepage first.
          </p>
          <Link
            href="/"
            className="inline-block px-8 py-4 border border-primary text-primary font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary/10 transition-colors"
          >
            Go to Detector
          </Link>
        </div>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="flex-grow w-full max-w-5xl mx-auto px-8 pt-12 pb-24">
        <p className="font-code-sm text-code-sm text-outline">Loading…</p>
      </main>
    );
  }

  const aiPercent = liveAiPercent ?? result.aiPercent;
  const verdictTone = aiPercent != null
    ? verdictFromScore(aiPercent).verdictTone
    : (result.verdictTone ?? "mixed");
  const verdictText =
    aiPercent != null && aiPercent !== result.aiPercent
      ? verdictFromScore(aiPercent).verdict
      : result.verdict;
  const confidence = result.confidence ?? "high";

  const headerLabel =
    verdictTone === "ai"
      ? "AI GENERATED CONTENT DETECTED"
      : verdictTone === "mixed"
        ? "MIXED SIGNALS DETECTED"
        : "LIKELY HUMAN AUTHORED";

  const confidenceColor =
    confidence === "low"
      ? "text-error"
      : confidence === "moderate"
        ? "text-amber-500/70"
        : "text-amber-500";

  const highlightedCount = segments.length;
  const stronglyFlaggedCount = segments.filter(
    (s) => !s.belowThreshold && !s.humanized,
  ).length;
  const humanizedCount = segments.filter((s) => s.humanized).length;

  const showDelta =
    originalAiPercent != null &&
    aiPercent != null &&
    originalAiPercent !== aiPercent;

  return (
    <>
    <main className="flex-grow w-full max-w-5xl mx-auto px-8 pt-12 pb-24">
      <header className="mb-12">
        <div className="flex items-end gap-6 mb-2 flex-wrap">
          <h1
            className={`font-headline-lg text-headline-lg leading-none ${
              redetecting ? "text-primary animate-pulse" : "text-primary"
            }`}
          >
            {aiPercent}%
          </h1>
          <div className="pb-2">
            <p className="font-label-caps text-label-caps text-on-surface-variant">
              {headerLabel}
            </p>
            <p className={`font-code-sm text-[11px] mt-2 ${confidenceColor}`}>
              ● {confidence.toUpperCase()} CONFIDENCE
            </p>
          </div>
          {showDelta && (
            <div className="pb-2 ml-auto flex items-center gap-3">
              <span className="font-code-sm text-[11px] text-outline">
                {originalAiPercent}% →{" "}
                <span className="text-amber-500">{aiPercent}%</span>
              </span>
              {originalAiPercent! > aiPercent! && (
                <span className="font-code-sm text-[10px] uppercase tracking-widest text-green-400/80">
                  ↓ {originalAiPercent! - aiPercent!}pts
                </span>
              )}
              {docOriginalSnapshot && (
                <button
                  onClick={handleRestoreOriginal}
                  className="font-code-sm text-[11px] text-outline hover:text-primary underline underline-offset-4"
                >
                  ↺ Restore original
                </button>
              )}
            </div>
          )}
        </div>
        <div className="w-full h-1 bg-surface-container-highest">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${aiPercent}%` }}
          />
        </div>
        {result.confidenceReason && (
          <p className="font-code-sm text-[11px] text-outline mt-3">
            {result.confidenceReason}
          </p>
        )}
      </header>

      <div className="grid grid-cols-12 gap-12">
        <section className="col-span-12 lg:col-span-8">
          {showGptZeroBanner && !bannerDismissed && aiPercent != null && (
            <GptZeroBanner
              humanizedText={displayText}
              aiPercent={aiPercent}
              onDismiss={() => setBannerDismissed(true)}
            />
          )}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-label-caps text-label-caps text-on-surface-variant">
              ANALYZED SOURCE
            </h2>
            <span className="font-code-sm text-code-sm text-neutral-600">
              {displayText.trim().split(/\s+/).length} WORDS ·{" "}
              {stronglyFlaggedCount} FLAGGED
              {humanizedCount > 0 && ` · ${humanizedCount} HUMANIZED`}
            </span>
          </div>
          <div className="bg-surface-container-lowest border border-neutral-800 p-8">
            <p className="font-body-lg text-body-lg leading-relaxed text-on-surface whitespace-pre-wrap">
              {pieces.map((piece, i) => {
                if (piece.kind === "plain") {
                  return <span key={i}>{piece.text}</span>;
                }
                const seg = piece.segment;
                const segIdx = piece.segmentIdx;
                const prob = seg.aiProbability ?? 0;
                const isHovered = hoveredIdx === i;
                const isPending = surgicalPending.has(segIdx);
                const surgicalErr = surgicalErrors[segIdx];

                let highlightClass: string;
                if (seg.humanized) highlightClass = "highlight-humanized";
                else if (seg.belowThreshold) highlightClass = "highlight-ai-low";
                else highlightClass = "highlight-ai";

                return (
                  <span
                    key={i}
                    className={`${highlightClass} relative cursor-help`}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {piece.text}
                    {isHovered && (
                      <span
                        className="absolute left-0 -top-2 -translate-y-full z-20 bg-neutral-950 border border-amber-500/40 px-4 py-3 font-code-sm text-[11px] text-on-surface shadow-xl min-w-[280px] max-w-[400px]"
                        style={{ whiteSpace: "normal" }}
                      >
                        <span className="block font-label-caps text-[10px] text-primary mb-2">
                          {seg.humanized ? (
                            <>HUMANIZED</>
                          ) : (
                            <>
                              AI PROBABILITY: {Math.round(prob * 100)}%
                              {seg.belowThreshold && (
                                <span className="ml-2 text-outline">
                                  (BELOW FLAG THRESHOLD)
                                </span>
                              )}
                            </>
                          )}
                        </span>

                        {seg.humanized ? (
                          <div className="space-y-2 leading-relaxed">
                            <p className="text-outline">
                              <span className="text-neutral-600">Original:</span>{" "}
                              {seg.humanized.originalText}
                            </p>
                          </div>
                        ) : (
                          seg.reasons &&
                          seg.reasons.length > 0 && (
                            <ul className="space-y-1 text-outline leading-relaxed">
                              {seg.reasons.map((r, ri) => (
                                <li key={ri} className="flex gap-2">
                                  <span className="text-primary/60">›</span>
                                  <span>{r}</span>
                                </li>
                              ))}
                            </ul>
                          )
                        )}

                        <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center gap-2">
                          {seg.humanized ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSurgicalUndo(segIdx);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 border border-neutral-700 text-outline hover:text-primary hover:border-primary/40 transition-colors uppercase tracking-widest text-[10px]"
                            >
                              <span className="material-symbols-outlined text-[12px]">
                                undo
                              </span>
                              Revert
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSurgicalHumanize(segIdx);
                              }}
                              disabled={isPending}
                              className="flex items-center gap-1 px-3 py-1.5 border border-primary/60 text-primary hover:bg-primary/10 transition-colors uppercase tracking-widest text-[10px] disabled:opacity-50 disabled:cursor-wait"
                            >
                              {isPending ? (
                                <>
                                  <span className="material-symbols-outlined text-[12px] animate-spin">
                                    progress_activity
                                  </span>
                                  Rewriting…
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-[12px]">
                                    auto_fix_high
                                  </span>
                                  Humanize this
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {surgicalErr && (
                          <p className="mt-2 text-[10px] text-error">
                            {surgicalErr}
                          </p>
                        )}
                      </span>
                    )}
                  </span>
                );
              })}
            </p>
            {(highlightedCount > 0 || displayText) && (
              <div className="font-code-sm text-[11px] text-outline mt-6 pt-4 border-t border-neutral-800 flex flex-wrap items-center gap-4">
                {highlightedCount > 0 && (
                  <span>Hover highlighted sentences to humanize them.</span>
                )}
                {humanizedCount > 0 && (
                  <span className="text-green-400/80">
                    {humanizedCount} sentence{humanizedCount === 1 ? "" : "s"}{" "}
                    humanized.
                  </span>
                )}
                {stronglyFlaggedCount === 0 && humanizedCount > 0 && (
                  <span className="text-neutral-600">
                    All flagged sentences cleared.
                  </span>
                )}
                <button
                  onClick={handleCopy}
                  className="ml-auto flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copied ? "check" : "content_copy"}
                  </span>
                  {copied ? "COPIED" : "COPY TEXT"}
                </button>
              </div>
            )}
          </div>

          {humanizeError && (
            <p className="mt-4 font-code-sm text-code-sm text-error">
              {humanizeError}
            </p>
          )}
        </section>

        <aside className="col-span-12 lg:col-span-4 space-y-8">
          {result.modelInfo && (
            <div>
              <h2 className="font-label-caps text-label-caps text-on-surface-variant mb-6">
                Detector Stack
              </h2>
              <div className="border border-neutral-800 p-6 bg-surface-container-low space-y-5">
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="font-code-sm text-code-sm text-primary">
                      NEURAL MODEL
                    </span>
                    <span className="font-code-sm text-code-sm text-on-surface tabular-nums">
                      {Math.round((liveModelScore ?? result.modelInfo.score) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1 bg-surface-container-highest mb-2">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${Math.round((liveModelScore ?? result.modelInfo.score) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="font-code-sm text-[10px] text-neutral-500 leading-tight">
                    {MODEL_ID.split("/").pop()} · in-browser inference.
                  </p>
                </div>

                {liveHeuristicPercent != null && (
                  <div>
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="font-code-sm text-code-sm text-primary">
                        HEURISTICS
                      </span>
                      <span className="font-code-sm text-code-sm text-on-surface tabular-nums">
                        {liveHeuristicPercent}%
                      </span>
                    </div>
                    <div className="w-full h-1 bg-surface-container-highest mb-2">
                      <div
                        className="h-full bg-primary/60 transition-all"
                        style={{ width: `${liveHeuristicPercent}%` }}
                      />
                    </div>
                    <p className="font-code-sm text-[10px] text-neutral-500 leading-tight">
                      Perplexity + burstiness + discourse ensemble.
                    </p>
                  </div>
                )}

                <div className="pt-3 border-t border-neutral-800">
                  <div className="flex justify-between items-baseline">
                    <span className="font-code-sm text-code-sm text-primary">
                      BLENDED
                    </span>
                    <span className="font-code-sm text-code-sm text-on-surface tabular-nums">
                      {aiPercent}%
                    </span>
                  </div>
                  <p className="font-code-sm text-[10px] text-neutral-500 leading-tight mt-2">
                    70% model · 30% heuristics. Updates after every rewrite.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 className="font-label-caps text-label-caps text-on-surface-variant mb-6">
              Linguistic Metrics
            </h2>

            <div className="border border-neutral-800 p-6 mb-4 bg-surface-container-low">
              <div className="flex justify-between items-center mb-4">
                <span className="font-code-sm text-code-sm text-primary">
                  PERPLEXITY
                </span>
                <span className="font-code-sm text-code-sm text-on-surface">
                  {result.perplexity.toFixed(1)}
                </span>
              </div>
              <div className="w-full h-1 bg-surface-container-highest mb-3">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${Math.min(100, (result.perplexity / 50) * 100)}%`,
                  }}
                />
              </div>
              <p className="font-code-sm text-[10px] text-neutral-500 leading-tight">
                {result.signalExplanations?.perplexity ??
                  "Lower perplexity indicates higher predictability and likelihood of AI origin."}
              </p>
            </div>

            <div className="border border-neutral-800 p-6 mb-4 bg-surface-container-low">
              <div className="flex justify-between items-center mb-4">
                <span className="font-code-sm text-code-sm text-primary">
                  BURSTINESS
                </span>
                <span className="font-code-sm text-code-sm text-on-surface">
                  {result.burstiness.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-1 bg-surface-container-highest mb-3">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${Math.min(100, result.burstiness * 100)}%`,
                  }}
                />
              </div>
              <p className="font-code-sm text-[10px] text-neutral-500 leading-tight">
                {result.signalExplanations?.burstiness ??
                  "Low variation in sentence length is a hallmark of machine logic."}
              </p>
            </div>

            {result.signalExplanations?.discourse && (
              <div className="border border-neutral-800 p-6 mb-4 bg-surface-container-low">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-code-sm text-code-sm text-primary">
                    DISCOURSE
                  </span>
                </div>
                <p className="font-code-sm text-[10px] text-neutral-500 leading-tight">
                  {result.signalExplanations.discourse}
                </p>
              </div>
            )}

            {result.signalExplanations?.uniformity && (
              <div className="border border-neutral-800 p-6 mb-4 bg-surface-container-low">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-code-sm text-code-sm text-primary">
                    STRUCTURE
                  </span>
                </div>
                <p className="font-code-sm text-[10px] text-neutral-500 leading-tight">
                  {result.signalExplanations.uniformity}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="border border-neutral-800 p-4">
                <div className="font-label-caps text-[10px] text-neutral-600 mb-1">
                  FLESCH SCORE
                </div>
                <div className="font-code-sm text-on-surface">
                  {result.fleschScore.toFixed(1)}
                </div>
              </div>
              <div className="border border-neutral-800 p-4">
                <div className="font-label-caps text-[10px] text-neutral-600 mb-1">
                  VOCAB VARIETY
                </div>
                <div className="font-code-sm text-on-surface">
                  {result.vocabVariety}
                </div>
              </div>
            </div>
          </div>

          <div
            className={
              verdictTone === "ai"
                ? "p-6 border border-amber-500/30 bg-amber-500/5"
                : verdictTone === "mixed"
                  ? "p-6 border border-amber-500/20 bg-amber-500/[0.03]"
                  : "p-6 border border-neutral-800 bg-surface-container-low"
            }
          >
            <h3
              className={
                verdictTone === "human"
                  ? "font-label-caps text-label-caps text-outline mb-2"
                  : "font-label-caps text-label-caps text-primary mb-2"
              }
            >
              Verdict
            </h3>
            <p className="font-code-sm text-code-sm text-on-surface-variant leading-relaxed">
              {verdictText}
            </p>
          </div>

          <button
            onClick={() => setShowBetaModal(true)}
            disabled={humanizing}
            className="w-full bg-primary py-4 font-label-caps text-label-caps text-on-primary uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_fix_high
            </span>
            {humanizing ? "Humanizing… (~10s)" : "Humanize Text"}
          </button>

          <button
            onClick={() => window.print()}
            className="w-full border border-primary py-4 font-label-caps text-label-caps text-primary hover:bg-primary/10 transition-all active:scale-95 uppercase tracking-widest"
          >
            Export Full Report
          </button>
        </aside>
      </div>
    </main>

    <HumanizeBetaModal
      open={showBetaModal}
      onCancel={() => setShowBetaModal(false)}
      onConfirm={() => {
        setShowBetaModal(false);
        void handleHumanize();
      }}
    />
    </>
  );
}

/**
 * After re-detecting, we want to keep any "humanized" markers we'd already
 * applied to sentences. The new heuristic segments come back without that
 * client-side metadata, so we copy it over for any new segment whose range
 * substantially overlaps an existing humanized one.
 */
function mergeHumanizedFlags(
  fresh: HighlightedSegment[],
  existing: HighlightedSegment[],
): HighlightedSegment[] {
  const humanizedExisting = existing.filter((s) => s.humanized);
  if (humanizedExisting.length === 0) return fresh;

  return fresh.map((seg) => {
    const overlap = humanizedExisting.find(
      (h) => Math.max(h.start, seg.start) < Math.min(h.end, seg.end),
    );
    if (overlap?.humanized) {
      return { ...seg, humanized: overlap.humanized };
    }
    return seg;
  });
}
