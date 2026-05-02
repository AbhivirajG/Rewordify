# Rewordify

AI text detector + humanizer with a terminal-inspired UI. Built with Next.js 14
(App Router), TypeScript, and Tailwind.

Three pages:

- **`/`** — Detect: paste text, click **Run Analysis**.
- **`/results`** — Detection report (AI %, perplexity, burstiness, Flesch,
  vocab variety, highlighted spans). Includes a **Humanize Text** button that
  rewrites the source into more natural-sounding prose.
- **`/pricing`** — Free / Pro / Enterprise tiers + comparison table.

Detection and humanization currently run on light heuristics so the app works
end-to-end with no API key. Swap in a real AI provider when you're ready (see
[Wire up a real AI provider](#wire-up-a-real-ai-provider)).

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

```bash
npm run build && npm run start   # production
npm run lint                     # lint
```

## Project layout

```
app/
  layout.tsx              shared <TopNav /> + <Footer /> + theme
  globals.css             Tailwind + Space Grotesk + custom utility classes
  page.tsx                Detect page
  results/page.tsx        Detection results + Humanize button
  pricing/page.tsx        Pricing tiers
  api/
    detect/route.ts       POST /api/detect   -> DetectionResult
    humanize/route.ts     POST /api/humanize -> { humanizedText }
components/
  TopNav.tsx              active-link highlighting via usePathname
  Footer.tsx
lib/
  types.ts                DetectionResult, HumanizeResult, StoredAnalysis
tailwind.config.ts        Theme ported from the Stitch mockups
```

## Data flow

1. User types into the textarea on `/` and clicks **Run Analysis**.
2. The client POSTs to `/api/detect` and gets back a `DetectionResult`.
3. The result is stashed in `sessionStorage` under `rewordify:lastAnalysis`,
   keyed by a generated UUID, then the user is routed to
   `/results?id=<uuid>`.
4. `/results` reads the stored result and renders the report.
5. Clicking **Humanize Text** POSTs the original text to `/api/humanize` and
   reveals the rewritten output beneath the analyzed source.

No database, no auth — everything stays in the browser tab.

## Wire up a real AI provider

Two files need edits. Each has a clearly marked `PLUG YOUR AI HERE` block at
the top with copy-paste-ready OpenAI examples.

### 1. Detection — [`app/api/detect/route.ts`](app/api/detect/route.ts)

Replace the body of the local `analyze(text)` function with a call to your
model and shape the response to satisfy `DetectionResult` from
[`lib/types.ts`](lib/types.ts):

```ts
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function analyze(text: string): Promise<DetectionResult> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'Detect AI-generated content. Return JSON with: aiPercent (0-100), perplexity (number), burstiness (0-1), fleschScore (0-100), vocabVariety ("LOW"|"MEDIUM"|"HIGH"), verdict (string), highlightedSegments ([{start,end}] character ranges of AI-likely sentences).',
      },
      { role: "user", content: text },
    ],
  });
  const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
  return {
    ...parsed,
    originalText: text,
    wordCount: text.trim().split(/\s+/).length,
  };
}
```

Don't forget `export const runtime = "nodejs"` (already set) so the OpenAI SDK
can run.

### 2. Humanizer — [`app/api/humanize/route.ts`](app/api/humanize/route.ts)

Replace the body of the local `humanize(text)` function:

```ts
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function humanize(text: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Rewrite the user's text so it reads like natural human prose: vary sentence length, use contractions, avoid generic AI phrasing, and preserve the original meaning. Return ONLY the rewritten text.",
      },
      { role: "user", content: text },
    ],
  });
  return completion.choices[0].message.content?.trim() ?? text;
}
```

### 3. Install the SDK and add your key

```bash
npm install openai
cp .env.example .env.local
# then set OPENAI_API_KEY=sk-... in .env.local
```

Restart `npm run dev` and you're done.

## Tweaking the UI

- **Theme colors** live in [`tailwind.config.ts`](tailwind.config.ts) under
  `theme.extend.colors` — these were ported verbatim from the Stitch mockups.
- **Custom utilities** (`.highlight-ai`, `.terminal-box`, `.cursor-blink`) live
  in [`app/globals.css`](app/globals.css).
- **Nav links** are defined in [`components/TopNav.tsx`](components/TopNav.tsx).

## Notes

- `/results` requires a fresh detection in the same tab — there's no archive
  yet. Add one by persisting analyses to `localStorage` (or a real DB) and
  listing them on `/archive`.
- Export Full Report currently triggers `window.print()`. Swap in a PDF
  generator (e.g. `@react-pdf/renderer`) if you want a styled export.
