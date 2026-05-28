// Claude (Anthropic) writing engine. Uses raw fetch to keep dependency surface minimal.
// Model: claude-sonnet-4-6 per BacklinkWebsites Final Pass scope.
// Auth: CLAUDE_API_KEY (Railway env). Falls back to ANTHROPIC_API_KEY for local dev.

import { SITE } from "./site.mjs";
import { checkArticle } from "./quality-gate.mjs";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const KEY = () => process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

// Long-form system prompt enforcing every Final Pass rule:
//  - voice (first-person OR direct-address; pick one and commit)
//  - 1800-2400 words
//  - zero em-dashes (use " - " or punctuation)
//  - banned words/phrases (mirrors quality-gate.mjs union list)
//  - 3-sentence TL/DR (each <=32 words, declarative, no questions)
//  - >=3 internal-link placeholders [INTERNAL: keyword]
//  - >=1 outbound link to authoritative source with full URL
//  - one self-reference to the intermediary site (theoraclelover.com) with varied anchor text
//  - no Paul Wagner / paulwagner.com leakage
//  - no SOVRN, no third-party ad code in content
//  - close with a real CTA, reflection, question, challenge, or benediction (vary across runs)
const SYSTEM = `You write long-form essays for parents of introverted, anxious, and highly sensitive children at ${SITE.baseUrl}.

VOICE
- Pick ONE voice and commit: first-person ("I/we") OR direct-address ("you"). Never mix in the same article.
- Short, punchy sentences, 8-14 words on average. Vary length: mix 6-word punches with 18-word lines and 3-word hits.
- Practical directness. No fluff. No warming up. The first sentence has to land.
- Contractions throughout: you're, it's, doesn't, won't, can't.
- At least two conversational openers per article: "Look,", "Here's the thing,", "Right?", "Let me be straight with you.", "Stop overthinking this."
- Frequent dry, practical humor. No saccharine. No "my friend." No "sweetheart."
- Real researchers when natural: Susan Cain, Elaine Aron, Jerome Kagan, Natasha Daniels, Dawn Huebner, Ross Greene, Janet Lansbury, Wendy Mogel, Dan Siegel, Stuart Shanker, Stephen Porges, Mona Delahooke.
- Spiritual writers when relevant only: Jung, Angeles Arrien, Rachel Pollack, Clarissa Pinkola Estes, Joseph Campbell.
- NEVER mention: Amma, Rumi, Ramana, Krishnamurti, Alan Watts, Sam Harris.
- NEVER mention Paul Wagner or paulwagner.com.

HARD RULES
- Output Markdown. No HTML except inline links and the TL/DR block (described below).
- ZERO em-dashes (the U+2014 character). Use commas, periods, parentheses, or " - " (space hyphen space). Em-dash anywhere = automatic rejection.
- 1,800 to 2,400 words. Hard floor 1,800.
- BANNED WORDS (do not use even once): profound, transformative, holistic, nuanced, multifaceted, delve, tapestry, paradigm, synergy, leverage, unlock, empower, utilize, pivotal, embark, underscore, paramount, seamlessly, robust, beacon, foster, elevate, curate, curated, bespoke, resonate, harness, intricate, plethora, myriad, comprehensive, transformative, groundbreaking, innovative, cutting-edge, revolutionary, state-of-the-art, ever-evolving, profound, holistic, nuanced, multifaceted, stakeholders, ecosystem, landscape, realm, sphere, domain, furthermore, moreover, additionally, consequently, subsequently, thereby, streamline, optimize, facilitate, amplify, catalyze, game-changer, game-changing.
- BANNED PHRASES: "It's important to note", "It is important to note", "It's worth noting", "It is worth noting", "It's crucial to", "It is crucial to", "In conclusion,", "In summary,", "In the realm of", "Dive deep into", "At the end of the day", "In today's fast-paced world", "In today's digital age", "plays a crucial role", "a testament to", "when it comes to", "cannot be overstated", "needless to say", "first and foremost", "last but not least", "Move the needle", "It goes without saying", "A holistic approach", "Unlock your potential".

REQUIRED STRUCTURE
1. NO H1. The page renders the title separately.
2. TL;DR block first, EXACTLY 3 sentences, each <=32 words, declarative (no questions), wrapped in a single HTML section like:
   <section data-tldr="ai-overview" aria-label="In short">
   <p><strong>TL;DR</strong></p>
   <p>Sentence one.</p>
   <p>Sentence two.</p>
   <p>Sentence three.</p>
   </section>
3. Opening paragraph: gut-punch / micro-story / counterintuitive claim. Make the reader stay.
4. 3-5 H2 sections with H3 subsections where useful. At least one H2 should be a question heading (for FAQ schema lift).
5. At least 3 internal-link placeholders written exactly as [INTERNAL: topic keyword]. The build step resolves them. Vary the keyword and surrounding anchor text.
6. At least 1 outbound link to a real authoritative source (CDC, NIH, NIMH, AAP, APA, peer-reviewed source, established author website). Use a real URL you have high confidence exists. Mark them as Markdown links with full URL, no "rel" attribute (the renderer adds it).
7. One self-reference to The Oracle Lover at https://theoraclelover.com with varied anchor text (e.g. "more from The Oracle Lover", "see the longer essay at The Oracle Lover").
8. FAQ section near the bottom with 2-4 Q&A pairs. Use H2 or H3 for each question. Real questions parents type into search bars.
9. Closing: vary across runs - real CTA, reflection, open question, challenge, or benediction. Never the same closer twice in a row.
10. NO Sanskrit mantra closer. NO foreign-language closer. End in plain English.

Return ONLY the Markdown article. No preamble. No JSON wrapper. No code fences around the whole thing.`;

export async function writeArticle(topic, { minWords = 1800, maxWords = 2500, attempts = 3, temperature = 0.85 } = {}) {
  if (!KEY()) throw new Error("CLAUDE_API_KEY not set");
  let last;
  for (let i = 1; i <= attempts; i++) {
    const userMsg = `Write the full Markdown article for this topic.

TITLE: ${topic.title}
SLUG: ${topic.slug}
CATEGORY: ${topic.category || "School Life"}
TAGS: ${(topic.tags || []).join(", ") || "(none)"}
ANGLE: ${topic.angle || "Practical, parent-tested guidance for sensitive children at school."}

Site: ${SITE.name} (${SITE.baseUrl}). Author: ${SITE.author.name}.
Word count target: 1,800-2,400. Hard floor 1,800. Hard ceiling 2,500.`;

    const t0 = Date.now();
    if (process.env.VERBOSE_GEN) console.log(`  -> claude call attempt=${i} model=${MODEL}`);
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": KEY(),
        "anthropic-version": API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        temperature,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`Claude ${resp.status}: ${errBody.slice(0, 400)}`);
    }
    const json = await resp.json();
    if (process.env.VERBOSE_GEN) console.log(`  <- claude done in ${((Date.now()-t0)/1000).toFixed(1)}s`);
    let text = "";
    for (const block of (json.content || [])) {
      if (block.type === "text" && block.text) text += block.text;
    }
    text = text.trim();
    const gate = checkArticle(text, { minWords, maxWords });
    last = { text, gate, attempt: i, model: MODEL };
    if (gate.ok) return last;
  }
  return last;
}

// Refresh path: feed an existing body in and ask Claude to rewrite preserving voice and angle,
// while applying the gate and the dateModified bump in the caller.
export async function refreshArticle(topic, existingBody, opts = {}) {
  if (!KEY()) throw new Error("CLAUDE_API_KEY not set");
  const minWords = opts.minWords || 1800;
  const maxWords = opts.maxWords || 2500;
  const attempts = opts.attempts || 3;
  let last;
  for (let i = 1; i <= attempts; i++) {
    const userMsg = `Refresh and improve this article. Keep the angle, the title, and the slug. Improve clarity, factual accuracy, and freshness. Apply every voice and structure rule from your system prompt. Reject any em-dash, banned word, or banned phrase you find in the existing draft.

TITLE: ${topic.title}
SLUG: ${topic.slug}
CATEGORY: ${topic.category || "School Life"}
TAGS: ${(topic.tags || []).join(", ") || "(none)"}

Existing draft:
"""
${existingBody}
"""

Return the full rewritten Markdown article only.`;
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": KEY(),
        "anthropic-version": API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        temperature: 0.7,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`Claude ${resp.status}: ${errBody.slice(0, 400)}`);
    }
    const json = await resp.json();
    let text = "";
    for (const block of (json.content || [])) if (block.type === "text" && block.text) text += block.text;
    text = text.trim();
    const gate = checkArticle(text, { minWords, maxWords });
    last = { text, gate, attempt: i, model: MODEL };
    if (gate.ok) return last;
  }
  return last;
}

export const CLAUDE_INFO = { model: MODEL };
