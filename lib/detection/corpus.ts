/**
 * English language corpus data for AI detection.
 * 
 * Contains:
 * 1. Word frequency data (log probabilities) for perplexity estimation
 * 2. AI-typical phrases and transition words
 * 3. Stop words for lexical diversity calculations
 */

/**
 * Top ~500 most common English words with their relative log frequencies.
 * Values are negative log probabilities (lower = more common).
 * Based on Google Web Trillion Word Corpus / COCA rankings.
 */
export const WORD_LOG_PROBS: Record<string, number> = {
  // Ultra common (rank 1-50)
  the: 2.5, be: 3.0, of: 3.1, and: 3.2, a: 3.3, to: 3.4, in: 3.6, he: 3.8,
  have: 3.9, it: 3.9, that: 4.0, for: 4.1, they: 4.2, i: 4.2, with: 4.3,
  as: 4.3, not: 4.4, on: 4.4, she: 4.5, at: 4.5, by: 4.5, this: 4.6,
  we: 4.6, you: 4.6, do: 4.7, but: 4.7, from: 4.7, or: 4.8, which: 4.8,
  one: 4.8, would: 4.9, all: 4.9, will: 4.9, there: 4.9, say: 5.0, who: 5.0,
  make: 5.0, when: 5.0, can: 5.1, more: 5.1, if: 5.1, no: 5.1, man: 5.2,
  out: 5.2, other: 5.2, so: 5.2, what: 5.3, time: 5.3, up: 5.3, go: 5.3,
  about: 5.4, than: 5.4, into: 5.4, could: 5.4, state: 5.4, only: 5.5,
  new: 5.5, year: 5.5, some: 5.5, take: 5.5, come: 5.6, these: 5.6, know: 5.6,
  see: 5.6, use: 5.6, get: 5.7, like: 5.7, then: 5.7, first: 5.7, any: 5.7,
  work: 5.8, now: 5.8, may: 5.8, such: 5.8, give: 5.8, over: 5.9, think: 5.9,
  most: 5.9, even: 5.9, find: 5.9, day: 5.9, also: 6.0, after: 6.0, way: 6.0,
  many: 6.0, must: 6.0, look: 6.1, before: 6.1, great: 6.1, back: 6.1,
  through: 6.1, long: 6.2, where: 6.2, much: 6.2, should: 6.2, well: 6.2,
  people: 6.2, down: 6.3, own: 6.3, just: 6.3, because: 6.3, good: 6.3,
  each: 6.4, those: 6.4, feel: 6.4, seem: 6.4, how: 6.4, high: 6.5, too: 6.5,
  place: 6.5, little: 6.5, world: 6.5, very: 6.6, still: 6.6, nation: 6.6,
  hand: 6.6, old: 6.6, life: 6.7, tell: 6.7, write: 6.7, become: 6.7,
  here: 6.7, show: 6.8, house: 6.8, both: 6.8, between: 6.8, need: 6.8,
  mean: 6.9, call: 6.9, develop: 6.9, under: 6.9, last: 6.9, right: 7.0,
  move: 7.0, thing: 7.0, general: 7.0, school: 7.0, never: 7.1, same: 7.1,
  another: 7.1, begin: 7.1, while: 7.1, number: 7.2, part: 7.2, turn: 7.2,
  real: 7.2, leave: 7.2, might: 7.3, want: 7.3, point: 7.3, form: 7.3,
  off: 7.3, child: 7.4, few: 7.4, small: 7.4, since: 7.4, against: 7.4,
  ask: 7.5, late: 7.5, home: 7.5, interest: 7.5, large: 7.5, person: 7.6,
  end: 7.6, open: 7.6, public: 7.6, follow: 7.6, during: 7.7, present: 7.7,
  without: 7.7, again: 7.7, hold: 7.7, govern: 7.8, around: 7.8, possible: 7.8,
  head: 7.8, consider: 7.8, word: 7.9, program: 7.9, problem: 7.9, however: 7.9,
  lead: 7.9, system: 8.0, set: 8.0, order: 8.0, eye: 8.0, plan: 8.0, run: 8.1,
  keep: 8.1, face: 8.1, fact: 8.1, group: 8.1, play: 8.2, stand: 8.2,
  increase: 8.2, early: 8.2, course: 8.2, change: 8.3, help: 8.3, line: 8.3,
  
  // AI-favored words (artificially lower probability to flag overuse)
  furthermore: 9.5, moreover: 9.5, additionally: 9.0, consequently: 9.5,
  nevertheless: 9.8, essentially: 9.2, fundamentally: 9.8, ultimately: 9.0,
  subsequently: 9.8, importantly: 9.0, notably: 9.5, particularly: 9.0,
  specifically: 9.0, undoubtedly: 9.8, certainly: 8.5, indeed: 8.8,
  delve: 10.5, navigate: 9.5, leverage: 9.5, utilize: 9.0, facilitate: 9.8,
  comprehensive: 9.5, robust: 9.5, seamless: 9.8, intricate: 10.0,
  myriad: 10.2, plethora: 10.5, tapestry: 11.0, realm: 9.5, landscape: 9.0,
  foster: 9.5, pivotal: 10.0, paradigm: 10.5, holistic: 10.5,
  multifaceted: 11.0, nuanced: 10.0, quintessential: 11.5,
};

/**
 * Default log probability for unknown words.
 * Represents "rare but plausible" - higher than common words.
 */
export const UNKNOWN_WORD_LOG_PROB = 11.5;

/**
 * Phrases strongly associated with AI-generated text.
 * Weighted by how "tell-tale" they are (0-1, higher = more AI-like).
 */
export const AI_PHRASES: Array<{ phrase: string; weight: number; category: string }> = [
  // Classic AI openers
  { phrase: "in today's world", weight: 0.85, category: "cliche_opener" },
  { phrase: "in today's society", weight: 0.85, category: "cliche_opener" },
  { phrase: "in today's fast-paced", weight: 0.95, category: "cliche_opener" },
  { phrase: "in the modern era", weight: 0.8, category: "cliche_opener" },
  { phrase: "in recent years", weight: 0.65, category: "cliche_opener" },
  { phrase: "throughout history", weight: 0.75, category: "cliche_opener" },
  { phrase: "since the dawn of", weight: 0.9, category: "cliche_opener" },
  { phrase: "in the realm of", weight: 0.85, category: "cliche_opener" },
  { phrase: "in the world of", weight: 0.7, category: "cliche_opener" },
  { phrase: "when it comes to", weight: 0.6, category: "cliche_opener" },
  
  // AI conclusions
  { phrase: "in conclusion", weight: 0.75, category: "conclusion_marker" },
  { phrase: "to conclude", weight: 0.7, category: "conclusion_marker" },
  { phrase: "in summary", weight: 0.65, category: "conclusion_marker" },
  { phrase: "to summarize", weight: 0.65, category: "conclusion_marker" },
  { phrase: "in essence", weight: 0.75, category: "conclusion_marker" },
  { phrase: "all in all", weight: 0.6, category: "conclusion_marker" },
  { phrase: "ultimately", weight: 0.55, category: "conclusion_marker" },
  
  // Hedge phrases
  { phrase: "it is important to note", weight: 0.9, category: "hedge" },
  { phrase: "it is worth noting", weight: 0.9, category: "hedge" },
  { phrase: "it's important to note", weight: 0.9, category: "hedge" },
  { phrase: "it is crucial to", weight: 0.85, category: "hedge" },
  { phrase: "it is essential to", weight: 0.8, category: "hedge" },
  { phrase: "it should be noted", weight: 0.85, category: "hedge" },
  { phrase: "one must consider", weight: 0.8, category: "hedge" },
  { phrase: "it is imperative", weight: 0.85, category: "hedge" },
  
  // AI transition overuse
  { phrase: "furthermore", weight: 0.7, category: "transition" },
  { phrase: "moreover", weight: 0.7, category: "transition" },
  { phrase: "additionally", weight: 0.6, category: "transition" },
  { phrase: "consequently", weight: 0.7, category: "transition" },
  { phrase: "nevertheless", weight: 0.6, category: "transition" },
  { phrase: "nonetheless", weight: 0.6, category: "transition" },
  { phrase: "subsequently", weight: 0.75, category: "transition" },
  
  // AI buzzwords
  { phrase: "delve into", weight: 0.95, category: "buzzword" },
  { phrase: "delve deeper", weight: 0.95, category: "buzzword" },
  { phrase: "navigate the complexities", weight: 0.95, category: "buzzword" },
  { phrase: "leverage", weight: 0.5, category: "buzzword" },
  { phrase: "harness the power", weight: 0.9, category: "buzzword" },
  { phrase: "a testament to", weight: 0.85, category: "buzzword" },
  { phrase: "stand as a testament", weight: 0.95, category: "buzzword" },
  { phrase: "plays a crucial role", weight: 0.85, category: "buzzword" },
  { phrase: "plays a pivotal role", weight: 0.9, category: "buzzword" },
  { phrase: "plays a vital role", weight: 0.85, category: "buzzword" },
  { phrase: "paradigm shift", weight: 0.9, category: "buzzword" },
  { phrase: "the intricate tapestry", weight: 0.98, category: "buzzword" },
  { phrase: "rich tapestry", weight: 0.95, category: "buzzword" },
  { phrase: "ever-evolving", weight: 0.85, category: "buzzword" },
  { phrase: "ever-changing", weight: 0.7, category: "buzzword" },
  { phrase: "in an ever-changing world", weight: 0.95, category: "buzzword" },
  { phrase: "at the forefront of", weight: 0.8, category: "buzzword" },
  { phrase: "cutting-edge", weight: 0.6, category: "buzzword" },
  { phrase: "state-of-the-art", weight: 0.55, category: "buzzword" },
  { phrase: "game-changer", weight: 0.7, category: "buzzword" },
  { phrase: "game-changing", weight: 0.7, category: "buzzword" },
  { phrase: "revolutionize", weight: 0.6, category: "buzzword" },
  { phrase: "unlock the potential", weight: 0.85, category: "buzzword" },
  { phrase: "unlock the power", weight: 0.85, category: "buzzword" },
  
  // AI formal constructions
  { phrase: "it is widely known", weight: 0.75, category: "formal" },
  { phrase: "it is widely recognized", weight: 0.8, category: "formal" },
  { phrase: "it is universally acknowledged", weight: 0.9, category: "formal" },
  { phrase: "as we can see", weight: 0.65, category: "formal" },
  { phrase: "as mentioned earlier", weight: 0.7, category: "formal" },
  { phrase: "as previously stated", weight: 0.75, category: "formal" },
  
  // Boilerplate AI responses
  { phrase: "as an ai", weight: 0.99, category: "ai_giveaway" },
  { phrase: "as a language model", weight: 0.99, category: "ai_giveaway" },
  { phrase: "i don't have personal", weight: 0.95, category: "ai_giveaway" },
  { phrase: "i cannot provide", weight: 0.85, category: "ai_giveaway" },
  { phrase: "however, i can", weight: 0.7, category: "ai_giveaway" },
  
  // Parallel construction markers
  { phrase: "not only", weight: 0.5, category: "parallel" },
  { phrase: "but also", weight: 0.5, category: "parallel" },
  { phrase: "on one hand", weight: 0.6, category: "parallel" },
  { phrase: "on the other hand", weight: 0.55, category: "parallel" },
  { phrase: "on the contrary", weight: 0.6, category: "parallel" },
];

/**
 * Words that AI tends to start sentences with (overused).
 */
export const AI_SENTENCE_STARTERS = new Set([
  "furthermore",
  "moreover",
  "additionally",
  "consequently",
  "nevertheless",
  "nonetheless",
  "however",
  "therefore",
  "thus",
  "hence",
  "indeed",
  "notably",
  "importantly",
  "ultimately",
  "essentially",
]);

/**
 * Common English stop words (for lexical diversity - exclude from TTR).
 */
export const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
  "have", "he", "in", "is", "it", "its", "of", "on", "that", "the", "to",
  "was", "were", "will", "with", "i", "you", "we", "they", "this", "but",
  "or", "not", "if", "then", "so", "do", "does", "did", "would", "could",
  "should", "can", "may", "might", "must", "shall", "am", "been", "being",
  "had", "having", "her", "hers", "him", "his", "she", "their", "them",
  "these", "those", "what", "which", "who", "whom", "whose", "why", "how",
  "where", "when", "there", "here", "all", "any", "both", "each", "few",
  "more", "most", "other", "some", "such", "no", "nor", "only", "own",
  "same", "than", "too", "very", "just", "about", "above", "after", "again",
  "against", "among", "before", "below", "between", "during", "into",
  "through", "under", "until", "up", "down", "out", "off", "over", "once",
]);

/**
 * Bigram frequency map for bigram-level perplexity.
 * Only high-frequency bigrams included.
 */
export const COMMON_BIGRAMS = new Set([
  "of the", "in the", "to the", "on the", "and the", "to be", "in a",
  "for the", "at the", "by the", "of a", "from the", "with the",
  "as a", "is a", "it is", "that the", "it was", "this is", "there is",
  "have been", "has been", "had been", "will be", "would be", "can be",
  "could be", "should be", "may be", "might be", "must be",
  "such as", "as well", "well as", "rather than", "more than", "less than",
  "most of", "some of", "all of", "one of", "many of", "each of",
  "the most", "the only", "the first", "the last", "the same", "the other",
  "a lot", "a few", "a little", "a number", "a variety", "a wide",
  "in which", "to which", "of which", "for which", "with which",
  "not only", "but also", "as if", "even though", "rather than",
]);
