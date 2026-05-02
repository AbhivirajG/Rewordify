import { NextResponse } from "next/server";
import { humanizeDocument } from "@/lib/humanize/pipeline";
import type { HumanizeResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60; // Claude double-pass can take ~10-30s on long input

// ---------------------------------------------------------------------------
// Whole-document humanizer
// ---------------------------------------------------------------------------
// Runs the 2-pass Claude Haiku 4.5 pipeline (paraphrase → style inject) from
// lib/humanize/pipeline.ts. If Claude fails (rate limit, network, missing
// key), we fall back to the legacy regex transform so the UI still shows
// SOMETHING rather than 500-ing.
//
// TODO: Pull the real tier from Supabase before calling — gate Free users
//       to single-pass and limit Pro/Max input size differently.
// ---------------------------------------------------------------------------

const MAX_WORDS = 4000;

export async function POST(req: Request) {
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount > MAX_WORDS) {
    return NextResponse.json(
      {
        error: `Text is too long (${wordCount} words). Please paste under ${MAX_WORDS} words.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await humanizeDocument(text);
    console.log(
      `[humanize] doc passes=${result.passes.length} in=${result.usage.inputTokens} out=${result.usage.outputTokens} cost=$${result.usage.estimatedCostUsd.toFixed(5)}`,
    );

    const payload: HumanizeResult = {
      humanizedText: result.text,
      usage: result.usage,
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[humanize] Claude pipeline failed, using regex fallback:", err);
    const payload: HumanizeResult = {
      humanizedText: regexFallback(text),
      fallback: true,
      error:
        err instanceof Error
          ? err.message
          : "Humanization service is unavailable.",
    };
    return NextResponse.json(payload);
  }
}

// Naive regex transformations kept as a graceful fallback when the LLM call
// fails — better than returning the original text untouched.
function regexFallback(text: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\bdo not\b/gi, "don't"],
    [/\bdoes not\b/gi, "doesn't"],
    [/\bis not\b/gi, "isn't"],
    [/\bare not\b/gi, "aren't"],
    [/\bcan not\b/gi, "can't"],
    [/\bcannot\b/gi, "can't"],
    [/\bwill not\b/gi, "won't"],
    [/\bit is\b/gi, "it's"],
    [/\bthat is\b/gi, "that's"],
    [/\bthere is\b/gi, "there's"],
    [/\bwe are\b/gi, "we're"],
    [/\byou are\b/gi, "you're"],
    [/\bthey are\b/gi, "they're"],
    [/\bI am\b/g, "I'm"],
    [/\bUtilize\b/g, "Use"],
    [/\butilize\b/g, "use"],
    [/\bIn conclusion,/gi, "So,"],
    [/\bFurthermore,/gi, "Plus,"],
    [/\bMoreover,/gi, "On top of that,"],
    [/\bHowever,/gi, "But,"],
    [/\bTherefore,/gi, "So,"],
    [/\bAdditionally,/gi, "Also,"],
    [/\bSubsequently,/gi, "Then,"],
    [/\bdelve into\b/gi, "look at"],
    [/\bleverage\b/gi, "use"],
    [/\brobust\b/gi, "solid"],
    [/\bseamless\b/gi, "smooth"],
    [/\bnavigate\b/gi, "work through"],
  ];

  let out = text;
  for (const [from, to] of replacements) out = out.replace(from, to);
  return out.trim();
}
