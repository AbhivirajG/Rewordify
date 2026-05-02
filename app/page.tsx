"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DetectionResult, StoredAnalysis } from "@/lib/types";
import {
  detectAiWithModel,
  MODEL_ID,
  prefetchDetector,
  type ModelProgress,
} from "@/lib/detection/model";
import { verdictFromScore } from "@/lib/detection/verdict";

const STORAGE_KEY = "rewordify:lastAnalysis";

// Blend weights: the neural model is more reliable than heuristics on
// modern LLM text, but we keep heuristic signal so short/edge-case inputs
// don't swing wildly on a single chunk's prediction.
const MODEL_WEIGHT = 0.7;
const HEURISTIC_WEIGHT = 0.3;

type ModelStatus = "idle" | "loading" | "ready" | "error";

export default function HomePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [stage, setStage] = useState<
    "idle" | "heuristics" | "model" | "blending"
  >("idle");

  // Track which files are still downloading so the progress bar reflects the
  // worst-case (slowest) file rather than flickering between files.
  const fileProgress = useRef<Map<string, number>>(new Map());

  function handleModelProgress(p: ModelProgress) {
    if (p.status === "ready") {
      setModelStatus("ready");
      setModelProgress(100);
      return;
    }
    if (p.status === "initiate" || p.status === "download") {
      setModelStatus("loading");
      if (p.file) fileProgress.current.set(p.file, 0);
      return;
    }
    if (p.status === "progress" && p.file && typeof p.progress === "number") {
      fileProgress.current.set(p.file, p.progress);
      const values = Array.from(fileProgress.current.values());
      const min = values.length ? Math.min(...values) : 0;
      setModelProgress(Math.round(min));
      setModelStatus("loading");
      return;
    }
    if (p.status === "done" && p.file) {
      fileProgress.current.set(p.file, 100);
      const values = Array.from(fileProgress.current.values());
      const min = values.length ? Math.min(...values) : 100;
      setModelProgress(Math.round(min));
    }
  }

  useEffect(() => {
    // Warm the model up as soon as the user lands here so it's usually
    // cached by the time they paste text.
    prefetchDetector(handleModelProgress);
  }, []);

  const charCount = text.length;
  const wordCount = useMemo(() => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [text]);

  const status = (() => {
    if (submitting) {
      if (stage === "heuristics") return "Running linguistic signals…";
      if (stage === "model") return "Running neural detector…";
      if (stage === "blending") return "Blending scores…";
      return "Running analysis…";
    }
    if (modelStatus === "loading") {
      return modelProgress != null
        ? `Warming detector (${modelProgress}%)`
        : "Warming detector…";
    }
    if (text.trim()) return "Ready for analysis";
    return "Awaiting input";
  })();

  async function handleSubmit() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // 1. Heuristics on the server — always fast, doesn't need model.
      setStage("heuristics");
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        throw new Error(`Detection failed: ${res.status}`);
      }
      const heuristic = (await res.json()) as DetectionResult;

      // 2. Neural detector in the browser.
      setStage("model");
      let finalResult: DetectionResult = heuristic;
      try {
        const model = await detectAiWithModel(text, handleModelProgress);
        setStage("blending");

        const heuristicPercent = heuristic.aiPercent;
        const modelPercent = Math.round(model.aiProbability * 100);
        const blended = Math.round(
          modelPercent * MODEL_WEIGHT + heuristicPercent * HEURISTIC_WEIGHT,
        );

        const { verdict, verdictTone } = verdictFromScore(blended);

        finalResult = {
          ...heuristic,
          aiPercent: blended,
          heuristicPercent,
          verdict,
          verdictTone,
          modelInfo: {
            name: MODEL_ID,
            score: model.aiProbability,
            chunks: model.chunks,
          },
        };
      } catch (modelErr) {
        // Model failure shouldn't block results — we still have heuristics.
        console.warn("Model inference failed, falling back to heuristics:", modelErr);
      }

      const stored: StoredAnalysis = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        result: finalResult,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      router.push(`/results?id=${stored.id}`);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
      setStage("idle");
    }
  }

  const modelStatusLabel = (() => {
    if (modelStatus === "ready") return "DETECTOR: READY";
    if (modelStatus === "loading")
      return modelProgress != null
        ? `DETECTOR: LOADING ${modelProgress}%`
        : "DETECTOR: LOADING";
    if (modelStatus === "error") return "DETECTOR: OFFLINE";
    return "DETECTOR: IDLE";
  })();

  return (
    <main className="flex-grow flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-8 mt-12 mb-12">
      <div className="w-full flex justify-between items-end mb-4 font-code-sm text-code-sm text-secondary">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">
              description
            </span>
            <span>TEXT_INPUT.MD</span>
          </div>
          <div className="flex items-center gap-2 text-surface-container-highest">
            <span>|</span>
            <span className="text-neutral-600">UTF-8</span>
          </div>
        </div>
        <div className="text-neutral-600 uppercase tracking-widest text-[10px]">
          {status}
        </div>
      </div>

      <div className="relative w-full aspect-video md:aspect-[21/9] bg-surface-container-lowest border border-neutral-800 p-8 group transition-all duration-300 focus-within:border-amber-500/50">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity" />
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-full bg-transparent border-none focus:ring-0 resize-none font-code-sm text-body-lg text-secondary placeholder-neutral-700 leading-relaxed outline-none"
          placeholder="Paste your content here to verify its linguistic origin..."
        />

        <div className="absolute bottom-4 right-8 flex items-center gap-6 font-code-sm text-[12px] text-neutral-600 pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="text-amber-500/50">CHARS:</span>
            <span>{charCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-500/50">WORDS:</span>
            <span>{wordCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`material-symbols-outlined text-[14px] ${
                modelStatus === "ready"
                  ? "text-amber-500"
                  : modelStatus === "loading"
                    ? "text-amber-500/50 animate-pulse"
                    : "text-neutral-700"
              }`}
            >
              memory
            </span>
            <span>{modelStatusLabel}</span>
          </div>
        </div>
      </div>

      {(modelStatus === "loading" && modelProgress != null && !submitting) && (
        <div className="w-full mt-3 flex items-center gap-3 font-code-sm text-[11px] text-neutral-600">
          <span className="uppercase tracking-widest text-amber-500/70">
            Booting detector
          </span>
          <div className="flex-1 h-[2px] bg-neutral-900 overflow-hidden">
            <div
              className="h-full bg-amber-500/70 transition-all duration-200"
              style={{ width: `${modelProgress}%` }}
            />
          </div>
          <span className="tabular-nums">{modelProgress}%</span>
        </div>
      )}

      <div className="mt-12 flex flex-col items-center gap-6">
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          className="px-12 py-4 bg-transparent border border-amber-500 text-amber-500 font-label-caps text-label-caps uppercase tracking-[0.2em] hover:bg-amber-500/10 active:scale-95 transition-all duration-200 flex items-center gap-3 group disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            search_check
          </span>
          {submitting ? submittingLabel(stage) : "Run Analysis"}
        </button>

        {submitting && stage === "model" && modelProgress != null && modelProgress < 100 && (
          <div className="flex items-center gap-3 font-code-sm text-[11px] text-amber-500/80 w-full max-w-sm">
            <span className="uppercase tracking-widest">Downloading model</span>
            <div className="flex-1 h-[2px] bg-neutral-900 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-200"
                style={{ width: `${modelProgress}%` }}
              />
            </div>
            <span className="tabular-nums">{modelProgress}%</span>
          </div>
        )}

        {error && (
          <p className="font-code-sm text-[12px] text-error">{error}</p>
        )}

        <div className="flex items-center gap-8">
          <button className="flex items-center gap-2 text-neutral-600 hover:text-neutral-400 transition-colors font-code-sm text-[12px]">
            <span className="material-symbols-outlined text-[16px]">
              upload_file
            </span>
            Upload .txt / .pdf
          </button>
          <button className="flex items-center gap-2 text-neutral-600 hover:text-neutral-400 transition-colors font-code-sm text-[12px]">
            <span className="material-symbols-outlined text-[16px]">
              history
            </span>
            Recent History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-24">
        <div className="p-6 border border-neutral-900 bg-neutral-950/50">
          <span className="material-symbols-outlined text-amber-500 mb-4">
            bolt
          </span>
          <h3 className="font-label-caps text-label-caps text-on-surface mb-2">
            NEURAL SCAN
          </h3>
          <p className="font-body-md text-[13px] text-neutral-600">
            Advanced detection using LLM signature mapping and perplexity
            analysis.
          </p>
        </div>
        <div className="p-6 border border-neutral-900 bg-neutral-950/50">
          <span className="material-symbols-outlined text-amber-500 mb-4">
            security
          </span>
          <h3 className="font-label-caps text-label-caps text-on-surface mb-2">
            ZERO DATA LOG
          </h3>
          <p className="font-body-md text-[13px] text-neutral-600">
            Your text is processed in volatile memory. No storage, no leaks,
            absolute privacy.
          </p>
        </div>
        <div className="p-6 border border-neutral-900 bg-neutral-950/50">
          <span className="material-symbols-outlined text-amber-500 mb-4">
            monitoring
          </span>
          <h3 className="font-label-caps text-label-caps text-on-surface mb-2">
            PROBABILITY MAP
          </h3>
          <p className="font-body-md text-[13px] text-neutral-600">
            Detailed sentence-by-sentence breakdown of generative markers.
          </p>
        </div>
      </div>
    </main>
  );
}

function submittingLabel(stage: "idle" | "heuristics" | "model" | "blending") {
  if (stage === "heuristics") return "Scanning signals…";
  if (stage === "model") return "Running detector…";
  if (stage === "blending") return "Finalising…";
  return "Analyzing…";
}
