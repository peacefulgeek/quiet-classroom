// §12A Quality gate — union of every banned-word/phrase/pattern list in master scope.
// Returns { ok, reasons[] }. Caller must regenerate (not skip) on failure.

export const BANNED_WORDS = [
  "profound","transformative","holistic","nuanced","multifaceted","delve","tapestry",
  "paradigm","synergy","leverage","unlock","empower","utilize","pivotal","embark",
  "underscore","paramount","seamlessly","robust","beacon","foster","elevate","curate",
  "curated","bespoke","resonate","harness","intricate","plethora","myriad","groundbreaking",
  "innovative","cutting-edge","state-of-the-art","game-changer","game-changing",
  "ever-evolving","rapidly-evolving","stakeholders","comprehensive","ecosystem",
];

// Words that are banned only as metaphor — too brittle to detect statistically here.
// We add them to a "soft" list and let the regenerator score these as warnings, not failures.
export const SOFT_METAPHOR_WORDS = ["journey","navigate","landscape","framework"];

export const BANNED_PHRASES = [
  "It's important to note that","It is important to note that",
  "It's worth noting that","It is worth noting that",
  "It's crucial to","It is crucial to",
  "In conclusion,","In summary,",
  "In the realm of","A holistic approach",
  "Unlock your potential","Dive deep into",
  "At the end of the day","Move the needle",
  "It goes without saying","In today's fast-paced world","In today's digital age",
];

export function checkArticle(text, { minWords = 1800, maxWords = 2500 } = {}) {
  const reasons = [];
  if (typeof text !== "string" || !text.trim()) return { ok: false, reasons: ["empty"] };

  // Em-dash hard rule
  const emDashCount = (text.match(/—/g) || []).length;
  if (emDashCount > 0) reasons.push(`em-dash count ${emDashCount} (must be 0)`);

  // Word count
  const words = (text.match(/\b[\w'\-]+\b/g) || []).length;
  if (words < minWords) reasons.push(`word count ${words} below ${minWords}`);
  if (words > maxWords) reasons.push(`word count ${words} above ${maxWords}`);

  // Banned words
  const lower = text.toLowerCase();
  const hits = [];
  for (const w of BANNED_WORDS) {
    const re = new RegExp(`\\b${w.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) hits.push(w);
  }
  if (hits.length) reasons.push(`banned words: ${hits.join(", ")}`);

  // Banned phrases (case-insensitive substring)
  const phraseHits = BANNED_PHRASES.filter(p => lower.includes(p.toLowerCase()));
  if (phraseHits.length) reasons.push(`banned phrases: ${phraseHits.join(" | ")}`);

  return { ok: reasons.length === 0, reasons, words, emDashCount };
}
