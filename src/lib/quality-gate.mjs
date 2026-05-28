// Quality gate (BacklinkWebsites Final Pass).
// Single source of truth for every reject rule a generated article must pass.
// Returns { ok, reasons[], words, emDashCount }. Caller must regenerate, not skip.

// Banned words. Union of every list in the master scope plus the prior project list.
// Compared word-by-word, case-insensitive, on word boundaries.
export const BANNED_WORDS = [
  // master scope §13
  "delve","tapestry","paradigm","synergy","leverage","unlock","empower","utilize",
  "pivotal","embark","underscore","paramount","seamlessly","robust","beacon","foster",
  "elevate","curate","curated","bespoke","resonate","harness","intricate","plethora",
  "myriad","comprehensive","transformative","groundbreaking","innovative",
  "cutting-edge","revolutionary","state-of-the-art","ever-evolving","profound",
  "holistic","nuanced","multifaceted","stakeholders","ecosystem","landscape","realm",
  "sphere","domain","furthermore","moreover","additionally","consequently",
  "subsequently","thereby","streamline","optimize","facilitate","amplify","catalyze",
  // prior project list, kept for backward compatibility
  "rapidly-evolving","game-changer","game-changing",
];

// Soft list. We log warnings for these but do not auto-reject.
export const SOFT_METAPHOR_WORDS = ["journey","navigate","framework"];

// Banned phrases. Compared as case-insensitive substring.
export const BANNED_PHRASES = [
  "it's important to note","it is important to note",
  "it's worth noting","it is worth noting",
  "it's crucial to","it is crucial to",
  "in conclusion,","in summary,",
  "in the realm of","a holistic approach",
  "unlock your potential","dive deep into",
  "at the end of the day","move the needle",
  "it goes without saying","in today's fast-paced world","in today's digital age",
  "plays a crucial role","a testament to","when it comes to",
  "cannot be overstated","needless to say","first and foremost","last but not least",
];

// Conversational openers we want to see at least twice per article.
const OPENERS = [
  "look,","look.","here's the thing","right?","let me be straight",
  "stop overthinking","let me demystify","nobody's coming to",
];

// Question heading detector for FAQ JSON-LD eligibility.
const QUESTION_RE = /^#{2,3}\s+.*\?\s*$/m;

export function checkArticle(text, opts = {}) {
  const { minWords = 1800, maxWords = 2500, requireOpeners = 2, requireExternalLink = true } = opts;
  const reasons = [];
  if (typeof text !== "string" || !text.trim()) return { ok: false, reasons: ["empty"], words: 0, emDashCount: 0 };

  // 1. Em-dash hard rule (U+2014 only; keep en-dash legal for ranges).
  const emDashCount = (text.match(/\u2014/g) || []).length;
  if (emDashCount > 0) reasons.push(`em-dash count ${emDashCount} (must be 0)`);

  // 2. Word count.
  const words = (text.match(/\b[\w'\-]+\b/g) || []).length;
  if (words < minWords) reasons.push(`word count ${words} below ${minWords}`);
  if (words > maxWords) reasons.push(`word count ${words} above ${maxWords}`);

  const lower = text.toLowerCase();

  // 3. Banned words.
  const wordHits = [];
  for (const w of BANNED_WORDS) {
    const re = new RegExp(`\\b${w.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (re.test(text)) wordHits.push(w);
  }
  if (wordHits.length) reasons.push(`banned words: ${wordHits.join(", ")}`);

  // 4. Banned phrases.
  const phraseHits = BANNED_PHRASES.filter((p) => lower.includes(p));
  if (phraseHits.length) reasons.push(`banned phrases: ${phraseHits.map((p) => `"${p}"`).join(", ")}`);

  // 5. Voice: at least two conversational openers (case-insensitive substring).
  const openerHits = OPENERS.filter((o) => lower.includes(o));
  if (openerHits.length < requireOpeners) {
    reasons.push(`only ${openerHits.length} conversational openers (need >= ${requireOpeners})`);
  }

  // 6. Voice consistency: first-person OR direct-address. Pick one.
  // Heuristic: count "I" and "we" as first-person markers; "you" as direct-address.
  const firstPerson = (text.match(/\b(I|I've|I'm|I'll|I'd|we|we've|we're|we'll|we'd)\b/g) || []).length;
  const directAddress = (text.match(/\byou(?:r|'re|'ve|'ll|'d|rself)?\b/gi) || []).length;
  if (firstPerson + directAddress < 5) {
    reasons.push("voice: too few first-person or direct-address markers");
  }

  // 7. At least 3 internal-link placeholders.
  const internalLinks = (text.match(/\[INTERNAL:[^\]]+\]/gi) || []).length;
  if (internalLinks < 3) reasons.push(`internal-link placeholders: ${internalLinks} (need >= 3)`);

  // 8. At least 1 outbound (external) link.
  const externalLinks = (text.match(/\]\(https?:\/\/[^)]+\)/g) || []).filter((m) => !m.includes("theoraclelover.com") && !m.includes("aquietclassroom.com"));
  if (requireExternalLink && externalLinks.length < 1) {
    reasons.push("no outbound link to authoritative source");
  }

  // 9. Self-reference to intermediary site.
  if (!/theoraclelover\.com/i.test(text)) {
    reasons.push("missing self-reference to theoraclelover.com");
  }

  // 10. TL/DR block present and well-formed (3 declarative sentences, no questions, each <=32 words).
  const tldrMatch = text.match(/<section[^>]*data-tldr="ai-overview"[^>]*>([\s\S]*?)<\/section>/i);
  if (!tldrMatch) {
    reasons.push("missing TL/DR section block");
  } else {
    const inner = tldrMatch[1];
    // collect <p>...</p> after the TL;DR header line
    const paras = [...inner.matchAll(/<p>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]).trim()).filter(Boolean);
    // first <p> is the "TL;DR" header label, rest are sentences
    const sentences = paras.filter((p) => !/^TL[\/;]?DR\s*$/i.test(p));
    if (sentences.length !== 3) reasons.push(`TL/DR sentences = ${sentences.length} (need exactly 3)`);
    for (const s of sentences) {
      const w = (s.match(/\b[\w'\-]+\b/g) || []).length;
      if (w > 32) reasons.push(`TL/DR sentence too long (${w} words): "${s.slice(0, 60)}..."`);
      if (s.trim().endsWith("?")) reasons.push(`TL/DR sentence is a question: "${s.slice(0, 60)}..."`);
    }
  }

  // 11. Banned proper nouns (Paul Wagner / paulwagner.com leakage).
  if (/paul\s*wagner|paulwagner\.com/i.test(text)) {
    reasons.push("contains Paul Wagner / paulwagner.com reference");
  }

  return { ok: reasons.length === 0, reasons, words, emDashCount };
}

function stripTags(s) { return String(s || "").replace(/<[^>]+>/g, ""); }

// Helpers for downstream rendering.
export function hasQuestionHeading(text) { return QUESTION_RE.test(text || ""); }

export function extractQuestions(text, max = 6) {
  if (!text) return [];
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length && out.length < max; i++) {
    const m = lines[i].match(/^#{2,3}\s+(.+\?)\s*$/);
    if (!m) continue;
    // gather following paragraph(s) up to next heading
    const ans = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{1,6}\s+/.test(lines[j])) break;
      ans.push(lines[j]);
    }
    out.push({ q: m[1].trim(), a: ans.join("\n").trim() });
  }
  return out.filter((x) => x.q && x.a);
}
