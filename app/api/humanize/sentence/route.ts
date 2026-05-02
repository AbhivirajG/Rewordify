import { NextResponse } from "next/server";
import { humanizeSentence } from "@/lib/humanize/pipeline";

export const runtime = "nodejs";
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Surgical sentence-level humanizer
// ---------------------------------------------------------------------------
// Rewrites a single sentence in-place using surrounding context for flow.
// Used by the per-sentence "Humanize this" affordance inside the highlight
// tooltip on the results page.
//
// Cheap (~$0.0005 per call) and fast (~1s) — single Claude Haiku 4.5 call
// with capped output tokens.
//
// TODO: tier-gate Pro/Max — Free users should not have unlimited per-
// sentence rewrites.
// ---------------------------------------------------------------------------

const MAX_SENTENCE_CHARS = 1500; // generous cap to block adversarial inputs

export async function POST(req: Request) {
  let body: {
    sentence?: unknown;
    contextBefore?: unknown;
    contextAfter?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sentence = typeof body.sentence === "string" ? body.sentence.trim() : "";
  const contextBefore =
    typeof body.contextBefore === "string" ? body.contextBefore : "";
  const contextAfter =
    typeof body.contextAfter === "string" ? body.contextAfter : "";

  if (!sentence) {
    return NextResponse.json({ error: "sentence is required" }, { status: 400 });
  }
  if (sentence.length > MAX_SENTENCE_CHARS) {
    return NextResponse.json(
      { error: "sentence is too long for surgical rewrite" },
      { status: 400 },
    );
  }

  try {
    const result = await humanizeSentence({
      sentence,
      contextBefore,
      contextAfter,
    });
    console.log(
      `[humanize/sentence] in=${result.usage.inputTokens} out=${result.usage.outputTokens} cost=$${result.usage.estimatedCostUsd.toFixed(5)}`,
    );

    return NextResponse.json({
      humanizedSentence: result.text,
      usage: result.usage,
    });
  } catch (err) {
    console.error("[humanize/sentence] Claude failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Humanization service is unavailable.",
      },
      { status: 502 },
    );
  }
}
