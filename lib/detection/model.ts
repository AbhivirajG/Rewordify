/**
 * Browser-side AI detector using Transformers.js v3+ (@huggingface/transformers).
 *
 * Loads the RoBERTa OpenAI detector once per page session, caches the
 * pipeline in memory, and lets repeated calls reuse it. The model itself
 * is cached by the browser via Cache Storage after the first download.
 *
 * The pipeline is lazy-loaded: nothing happens until the first call to
 * `getDetectorPipeline()` or `detectAiWithModel()`.
 */

// Modern detector: e5-small fine-tuned with LoRA on the RAID benchmark —
// evaluated against GPT-3.5, GPT-4, Claude, and Gemini outputs. Much better
// signal on current-gen LLM text than the 2019 RoBERTa-GPT2 baseline.
// Base model: MayZhou/e5-small-lora-ai-generated-detector (BERT architecture).
export const MODEL_ID = "jaxmef/e5-small-lora-ai-generated-detector-onnx";

// BERT-base context; leave headroom for [CLS] and [SEP] special tokens.
const MAX_TOKENS_PER_CHUNK = 480;
// Overlap between chunks so we don't lose signal at boundaries.
const CHUNK_OVERLAP_TOKENS = 48;

// This repo only hosts full-precision weights (~134 MB). No quantized
// variants available, so we load fp32. Small model (e5-small = 33M params)
// so the download is still manageable, and inference is fast.
const MODEL_DTYPE = "fp32";

export type ModelProgress = {
  status:
    | "initiate"
    | "download"
    | "progress"
    | "progress_total"
    | "done"
    | "ready";
  file?: string;
  progress?: number; // 0-100
  loaded?: number;
  total?: number;
};

export type DetectorPipeline = (
  texts: string | string[],
  options?: Record<string, unknown>,
) => Promise<Array<{ label: string; score: number }>>;

type TransformersModule = typeof import("@huggingface/transformers");

type LoadedPipeline = {
  pipe: DetectorPipeline;
  tokenizer: {
    encode: (text: string) => number[];
    decode: (ids: number[], options?: { skip_special_tokens?: boolean }) => string;
  };
};

let pipelinePromise: Promise<LoadedPipeline> | null = null;
let transformersPromise: Promise<TransformersModule> | null = null;

function loadTransformers(): Promise<TransformersModule> {
  if (!transformersPromise) {
    // Dynamic import so this module stays zero-cost until the browser
    // actually needs to run the detector.
    transformersPromise = import("@huggingface/transformers").then((mod) => {
      // Prefer hosted Hugging Face models; disable the "local models" check
      // so bundlers don't try to resolve ./models on disk in the browser.
      mod.env.allowLocalModels = false;
      mod.env.useBrowserCache = true;
      return mod;
    });
  }
  return transformersPromise;
}

/**
 * Load (and cache) the detector pipeline. Safe to call multiple times —
 * subsequent calls return the cached promise.
 */
export function getDetectorPipeline(
  onProgress?: (p: ModelProgress) => void,
): Promise<LoadedPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, AutoTokenizer } = await loadTransformers();

      const pipe = (await pipeline("text-classification", MODEL_ID, {
        dtype: MODEL_DTYPE,
        progress_callback: (data: ModelProgress) => {
          onProgress?.(data);
        },
      })) as unknown as DetectorPipeline;

      const tokenizer = (await AutoTokenizer.from_pretrained(
        MODEL_ID,
      )) as unknown as LoadedPipeline["tokenizer"];

      onProgress?.({ status: "ready" });
      return { pipe, tokenizer };
    })().catch((err) => {
      // Reset so a future call can retry (e.g. after network recovers).
      pipelinePromise = null;
      throw err;
    });
  }
  return pipelinePromise;
}

/**
 * Kick off model download in the background with no UI coupling. Call this
 * on page mount so the detector is warm by the time the user pastes text.
 */
export function prefetchDetector(
  onProgress?: (p: ModelProgress) => void,
): void {
  // Fire and forget — callers shouldn't await this.
  getDetectorPipeline(onProgress).catch(() => {
    /* swallow; the real run will surface the error */
  });
}

export type ModelDetectionResult = {
  aiProbability: number; // 0-1, higher = more AI-like
  chunks: number;
  perChunk: Array<{ score: number; length: number }>;
};

/**
 * Run the RoBERTa detector on arbitrary text. Splits input into overlapping
 * 480-token chunks (the model caps at 512) and length-weights the average
 * so longer chunks contribute proportionally.
 */
export async function detectAiWithModel(
  text: string,
  onProgress?: (p: ModelProgress) => void,
): Promise<ModelDetectionResult> {
  const { pipe, tokenizer } = await getDetectorPipeline(onProgress);

  const chunks = chunkTextByTokens(
    text,
    tokenizer,
    MAX_TOKENS_PER_CHUNK,
    CHUNK_OVERLAP_TOKENS,
  );

  if (chunks.length === 0) {
    return { aiProbability: 0.5, chunks: 0, perChunk: [] };
  }

  const perChunk: Array<{ score: number; length: number }> = [];
  let weightedSum = 0;
  let weightTotal = 0;

  // Run chunks sequentially; Transformers.js is single-threaded per call.
  for (const chunk of chunks) {
    const out = await pipe(chunk.text, { topk: null });
    const normalised = Array.isArray(out) ? out : [out];

    // The roberta-base-openai-detector returns Real / Fake (or LABEL_0 / LABEL_1).
    // LABEL_0 == Real (human), LABEL_1 == Fake (AI). Guard against either naming.
    const aiEntry = normalised.find((r) =>
      /fake|ai|label_1|1/i.test(String(r.label)),
    );
    const humanEntry = normalised.find((r) =>
      /real|human|label_0|0/i.test(String(r.label)),
    );

    let aiScore: number;
    if (aiEntry && humanEntry) {
      aiScore = aiEntry.score / (aiEntry.score + humanEntry.score);
    } else if (aiEntry) {
      aiScore = aiEntry.score;
    } else if (humanEntry) {
      aiScore = 1 - humanEntry.score;
    } else {
      aiScore = 0.5;
    }

    perChunk.push({ score: aiScore, length: chunk.tokenCount });
    weightedSum += aiScore * chunk.tokenCount;
    weightTotal += chunk.tokenCount;
  }

  return {
    aiProbability: weightTotal > 0 ? weightedSum / weightTotal : 0.5,
    chunks: chunks.length,
    perChunk,
  };
}

/**
 * Tokenise once, then slice the token stream into overlapping windows and
 * decode each window back to a string. This preserves the model's own token
 * boundaries so we never split a BPE unit mid-way.
 */
function chunkTextByTokens(
  text: string,
  tokenizer: LoadedPipeline["tokenizer"],
  maxTokens: number,
  overlap: number,
): Array<{ text: string; tokenCount: number }> {
  const ids = tokenizer.encode(text) as unknown as number[];
  if (!Array.isArray(ids) || ids.length === 0) return [];

  if (ids.length <= maxTokens) {
    return [
      {
        text,
        tokenCount: ids.length,
      },
    ];
  }

  const chunks: Array<{ text: string; tokenCount: number }> = [];
  const stride = Math.max(1, maxTokens - overlap);
  for (let start = 0; start < ids.length; start += stride) {
    const end = Math.min(ids.length, start + maxTokens);
    const slice = ids.slice(start, end);
    const decoded = tokenizer.decode(slice, { skip_special_tokens: true });
    if (decoded.trim()) {
      chunks.push({ text: decoded, tokenCount: slice.length });
    }
    if (end === ids.length) break;
  }
  return chunks;
}
