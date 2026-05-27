#!/usr/bin/env node
// Expand any article on Bunny that is below 1800 words to a 1800-2400 word
// piece using the forge LLM endpoint. Re-uploads the JSON to Bunny.
//
// Driven by env:
//   FORGE_API_URL  (default https://forge.manus.ai)
//   FORGE_API_KEY  (BUILT_IN_FORGE_API_KEY)
//   FORGE_MODEL    (default gpt-4o-mini; "auto" uses gemini-2.5-flash via router)
//   CONCURRENCY    (default 4)
//   ONLY           (csv of slugs to force; otherwise everything <1800 in index)
//   MIN_WORDS      (default 1800)
//   MAX_WORDS      (default 2400)
//   LIMIT          (cap number of articles; default = all short)
//
// Idempotent: writes a per-slug ledger entry to /tmp/article-expand-done.json.

import fs from "node:fs";
import path from "node:path";
import { uploadJsonToBunny, fetchJsonFromBunny } from "../src/lib/bunny.mjs";

const FORGE_URL  = process.env.FORGE_API_URL || process.env.BUILT_IN_FORGE_API_URL || "https://forge.manus.ai";
const FORGE_KEY  = process.env.FORGE_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || "";
const MODEL      = process.env.FORGE_MODEL    || "gpt-4o-mini";
const CONCURRENCY = Math.max(1, parseInt(process.env.CONCURRENCY || "4", 10));
const MIN_WORDS  = parseInt(process.env.MIN_WORDS || "1800", 10);
const MAX_WORDS  = parseInt(process.env.MAX_WORDS || "2400", 10);
const LIMIT      = parseInt(process.env.LIMIT || "0", 10);
const ONLY       = (process.env.ONLY || "").split(",").map(s => s.trim()).filter(Boolean);

if (!FORGE_KEY) {
  console.error("[expand] missing FORGE_API_KEY / BUILT_IN_FORGE_API_KEY");
  process.exit(2);
}

const ledgerPath = "/tmp/article-expand-done.json";
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, "utf8")) : {};
function saveLedger() { fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2)); }

const SYSTEM = `You are The Oracle Lover, a researcher-parent who writes for parents of introverted, anxious, and highly sensitive school-age children.

VOICE
- Warm, encouraging, practical. The first sentence hits.
- Direct address: "Look," "Here's the thing," "Let me be straight with you."
- NEVER "my friend," NEVER "sweetheart," NEVER "dear reader."
- Frequent dry, practical humor.
- 70% of references go to: Susan Cain, Elaine Aron, Jerome Kagan, Dawn Huebner, Ross Greene, Janet Lansbury, Wendy Mogel, Dan Siegel, Natasha Daniels.

HARD RULES
- Output Markdown only. No HTML except inline links.
- ZERO em-dashes (—). Use commas, periods, or parentheses.
- 1,800–2,400 words. Long enough to be useful, never padded.
- Contractions throughout: you're, it's, doesn't, won't, can't.
- Vary sentence length: mix 6-word punches, 18-word sentences, 3-word hits.
- Use 2 conversational interjections.
- BANNED words: profound, transformative, holistic, nuanced, multifaceted, delve, tapestry, paradigm, synergy, leverage, unlock, empower, utilize, pivotal, embark, underscore, paramount, seamlessly, robust, beacon, foster, elevate, curate, curated, bespoke, resonate, harness, intricate, plethora, myriad, groundbreaking, innovative, cutting-edge, state-of-the-art, game-changer, ever-evolving, stakeholders, comprehensive, ecosystem.
- BANNED phrases: "It's important to note that" / "It's worth noting that" / "It's crucial to" / "In conclusion," / "In summary," / "In the realm of" / "A holistic approach" / "Unlock your potential" / "Dive deep into" / "At the end of the day" / "Move the needle" / "It goes without saying" / "In today's fast-paced world" / "In today's digital age".

STRUCTURE
1. H1 title (the one provided).
2. TL;DR — 3-4 sentences in italics on a single block, beginning with "TL;DR:" (one asterisk wrap, e.g. *TL;DR: ...*).
3. Opening paragraph using a gut-punch, provocative question, micro-story, or counterintuitive claim.
4. 3-5 H2 sections with H3 sub-sections where useful.
5. At least one external authoritative link (CDC, NIH, AAP, APA, peer-reviewed source) with a real URL.
6. At least three internal-link placeholders written as [INTERNAL: topic keyword] (build step resolves them).
7. FAQ section with 2-4 Q&A pairs (use H3 for each Q).
8. Closing paragraph: warm and encouraging, varies between CTA, reflection, question, or benediction. NO Sanskrit closer.

Return ONLY the Markdown article. No preamble, no JSON wrapper.`;

function wordCount(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

async function callForge(messages, { temperature = 0.85, maxTokens = 16000, retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${FORGE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${FORGE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, temperature, max_tokens: maxTokens, messages }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`forge ${res.status}: ${t.slice(0, 200)}`);
      }
      const j = await res.json();
      const txt = j?.choices?.[0]?.message?.content || "";
      if (!txt) throw new Error("empty content");
      return txt;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

async function expandOne(slug, meta) {
  const userMsg = `Write the full Markdown article for this topic.

TITLE: ${meta.title}
SLUG: ${slug}
CATEGORY: ${meta.category || "School Life"}
TAGS: ${(meta.tags || []).join(", ")}
ANGLE: Practical, parent-tested guidance from The Oracle Lover.

Word count target: ${MIN_WORDS}-${MAX_WORDS}. Hard floor ${MIN_WORDS}.`;

  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userMsg },
  ];

  const text = await callForge(messages);
  // post-process: strip leading code fence if any
  let body = text.replace(/^```(?:markdown)?\s*/, "").replace(/\s*```\s*$/, "").trim();
  // ensure starts with #
  if (!/^#\s/.test(body)) body = `# ${meta.title}\n\n${body}`;
  const wc = wordCount(body);
  return { body, wordCount: wc };
}

async function processSlug(slug, idxEntry) {
  if (ledger[slug] && !ONLY.includes(slug)) {
    return { slug, skipped: true, reason: "ledger" };
  }
  // fetch existing article
  const existing = await fetchJsonFromBunny(`articles/${slug}.json`).catch(() => null);
  if (!existing) {
    return { slug, ok: false, error: "missing on bunny" };
  }
  const meta = {
    title: existing.title || idxEntry?.title || slug,
    category: existing.category || idxEntry?.category,
    tags: existing.tags || idxEntry?.tags || [],
  };
  const { body, wordCount: wc } = await expandOne(slug, meta);
  if (wc < MIN_WORDS) {
    // one retry with stronger floor
    const retry = await expandOne(slug, meta);
    if (retry.wordCount >= MIN_WORDS) {
      Object.assign({ body, wordCount: wc }, retry);
    }
  }
  // overwrite body, recompute wordCount, leave heroUrl/og/etc untouched
  const updated = {
    ...existing,
    body,
    wordCount: wc,
    readingTime: Math.max(6, Math.round(wc / 220)),
    updatedAt: new Date().toISOString(),
  };
  await uploadJsonToBunny(`articles/${slug}.json`, updated);
  ledger[slug] = { wordCount: wc, ts: Date.now() };
  saveLedger();
  return { slug, ok: true, wordCount: wc };
}

async function main() {
  console.log(`[expand] starting model=${MODEL} concurrency=${CONCURRENCY} target=${MIN_WORDS}-${MAX_WORDS}`);
  let candidates;
  if (ONLY.length) {
    candidates = ONLY.map(s => ({ slug: s }));
  } else {
    // load /tmp/short_articles.json if present, else use all <1800 from index
    if (fs.existsSync("/tmp/short_articles.json")) {
      const slugs = JSON.parse(fs.readFileSync("/tmp/short_articles.json", "utf8"));
      candidates = slugs.map(slug => ({ slug }));
    } else {
      const idx = await fetchJsonFromBunny("articles/index.json");
      candidates = (idx || []).filter(a => (a.wordCount || 0) < MIN_WORDS).map(a => ({ slug: a.slug }));
    }
  }
  // load index for meta backup
  const idx = await fetchJsonFromBunny("articles/index.json");
  const idxBySlug = Object.fromEntries((idx || []).map(a => [a.slug, a]));

  if (LIMIT > 0) candidates = candidates.slice(0, LIMIT);

  console.log(`[expand] ${candidates.length} candidates (after ledger filter the loop will skip done)`);
  let done = 0, failed = 0, skipped = 0;
  const t0 = Date.now();

  // simple worker pool
  const queue = [...candidates];
  async function worker(id) {
    while (queue.length) {
      const cand = queue.shift();
      try {
        const res = await processSlug(cand.slug, idxBySlug[cand.slug]);
        if (res.skipped) skipped++;
        else if (res.ok) {
          done++;
          if ((done + failed + skipped) % 5 === 0 || res.wordCount < MIN_WORDS) {
            const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
            console.log(`[w${id}] ${res.slug} ok wc=${res.wordCount}  done=${done} fail=${failed} skip=${skipped} t=${elapsed}s`);
          }
        } else {
          failed++;
          console.log(`[w${id}] ${cand.slug} FAIL: ${res.error}`);
        }
      } catch (e) {
        failed++;
        console.log(`[w${id}] ${cand.slug} EXC: ${e.message?.slice(0, 200)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`[expand] DONE total=${candidates.length} ok=${done} skip=${skipped} fail=${failed} elapsed=${elapsed}s`);
}

main().catch(e => { console.error("[expand] FATAL", e); process.exit(1); });
