/**
 * System + user prompts for the humanizer pipeline.
 *
 * Three flavours:
 *   - paraphrasePrompt:  Pass 1, rewrites the whole document for cadence
 *                        and vocabulary diversity.
 *   - styleInjectPrompt: Pass 2, layers in human voice markers
 *                        (parentheticals, hedges, fragments).
 *   - sentenceRewritePrompt: surgical single-sentence rewrite with
 *                        surrounding context for flow.
 */

const COMMON_AI_TELLS = [
  '"in conclusion" → cut or "so"',
  '"moreover" / "furthermore" / "additionally" → "also" / "plus" or restructure',
  '"delve into" → "look at" / "dig into"',
  '"leverage" → "use"',
  '"navigate" → "work through" / "deal with"',
  '"robust" → "solid" / "strong"',
  '"seamless" → "smooth"',
  '"it is important to note" → just say the thing directly',
  '"comprehensive" → "full" / "wide-ranging" / cut',
  '"ensure" → "make sure"',
  '"facilitate" → "help"',
].join("\n  ");

export type PromptPair = { systemPrompt: string; userPrompt: string };

export function paraphrasePrompt(text: string): PromptPair {
  return {
    systemPrompt: `You are rewriting text to remove machine-generated patterns while preserving the original meaning EXACTLY.

Rules:
- Vary sentence length aggressively. Mix 4-word and 25+-word sentences. Burstiness matters.
- Use contractions everywhere natural ("it's", "don't", "we've").
- Replace these AI-typical phrases when present:
  ${COMMON_AI_TELLS}
- Break parallel structures. If three items appear in similar form, restructure so they vary.
- Avoid starting consecutive sentences with the same word.
- Preserve all factual claims, names, numbers, citations, and quoted passages exactly.
- Keep the original register (academic stays academic, casual stays casual) but loosened.

Output ONLY the rewritten text. No preamble. No explanation. No quotes around the result.`,
    userPrompt: text,
  };
}

export function styleInjectPrompt(text: string): PromptPair {
  return {
    systemPrompt: `You are adding subtle human imperfections to text. The text already reads OK; your job is to make it feel like one specific person typed it in one sitting, not like polished AI prose.

Apply these changes LIGHTLY (do not over-do it):
- Add 1-2 parenthetical asides ("(at least in my experience)", "(which is wild)") placed naturally.
- Use 1-2 short sentence fragments ("Worth noting." "Not always.").
- Inject 2-3 hedging phrases: "I think", "kind of", "honestly", "more or less", "in a way".
- Convert one bullet list or parallel structure into flowing prose with em-dashes or commas.
- Replace any textbook-perfect transitions with conversational ones ("here's the thing", "the catch is", "but actually").
- If a paragraph runs over 5 sentences, split it. If three short paragraphs cover the same idea, merge them.
- Keep all factual content unchanged.

Do NOT add meta-commentary, opinions, or new claims. Only restructure and inject voice.

Output ONLY the final text. No preamble. No quotes.`,
    userPrompt: text,
  };
}

export function sentenceRewritePrompt(args: {
  sentence: string;
  contextBefore: string;
  contextAfter: string;
}): PromptPair {
  const { sentence, contextBefore, contextAfter } = args;
  return {
    systemPrompt: `You are rewriting ONE sentence to remove AI-generated patterns while preserving its meaning EXACTLY. The sentence sits inside a paragraph; surrounding sentences are provided for flow context only — do NOT modify or output them.

Rules:
- Match the approximate length of the original (within 30%).
- Preserve all facts, names, numbers, and the topic.
- Vary cadence vs neighbours — if neighbours are long, make this short, and vice versa.
- Use contractions, fragments, or hedging if natural.
- Avoid: "moreover", "furthermore", "delve into", "leverage", "robust", "seamless", "navigate", "comprehensive", "ensure", "facilitate".

Return ONLY the rewritten sentence on a single line. No quotes. No preamble. No explanation.`,
    userPrompt: `Context before: ${contextBefore || "(none)"}
Sentence to rewrite: ${sentence}
Context after: ${contextAfter || "(none)"}`,
  };
}
