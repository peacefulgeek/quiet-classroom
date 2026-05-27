#!/usr/bin/env node
// Expand short / empty articles on Bunny to 1800-2400 words via DeepSeek
// (uses OPENAI_API_KEY pointed at OPENAI_BASE_URL; default model OPENAI_MODEL).
//
// Differences vs expand-articles-via-forge.mjs:
//   - Reads source articles from Bunny ORIGIN (not pull zone) to bypass CDN cache
//   - Uses DeepSeek V4-Pro by default (configurable)
//   - Handles empty-body articles (full generation)
//
// Env:
//   OPENAI_API_KEY   (required)
//   OPENAI_BASE_URL  (default https://api.deepseek.com)
//   OPENAI_MODEL     (default deepseek-v4-pro)
//   CONCURRENCY      (default 4)
//   ONLY             (csv of slugs to force)
//   MIN_WORDS        (default 1800)
//   MAX_WORDS        (default 2400)
//   LIMIT            (cap; default = all)
//   SHORTS_FILE      (default /tmp/short_articles.json)
//   LEDGER_FILE      (default /tmp/article-expand-done.json)

import fs from "node:fs";
import { uploadJsonToBunny, BUNNY } from "../src/lib/bunny.mjs";

const KEY   = process.env.OPENAI_API_KEY;
const BASE  = (process.env.OPENAI_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
const MODEL = process.env.OPENAI_MODEL || "deepseek-v4-pro";
const CONCURRENCY = Math.max(1, parseInt(process.env.CONCURRENCY || "4", 10));
const MIN_WORDS = parseInt(process.env.MIN_WORDS || "1800", 10);
const MAX_WORDS = parseInt(process.env.MAX_WORDS || "2400", 10);
const LIMIT = parseInt(process.env.LIMIT || "0", 10);
const ONLY = (process.env.ONLY || "").split(",").map(s => s.trim()).filter(Boolean);
const SHORTS_FILE = process.env.SHORTS_FILE || "/tmp/short_articles.json";
const LEDGER_FILE = process.env.LEDGER_FILE || "/tmp/article-expand-done.json";

if (!KEY) {
  console.error("[expand-ds] missing OPENAI_API_KEY");
  process.exit(2);
}

const ledger = fs.existsSync(LEDGER_FILE) ? JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8")) : {};
function saveLedger() { fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2)); }

async function fetchOriginJson(remotePath) {
  const cleanPath = remotePath.replace(/^\/+/, "");
  const url = `https://${BUNNY.storageHost}/${BUNNY.storageZone}/${cleanPath}`;
  const res = await fetch(url, { headers: { AccessKey: BUNNY.storageKey } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`origin ${res.status} ${remotePath}`);
  const text = await res.text();
  return JSON.parse(text);
}

const SYSTEM = `You are The Oracle Lover, a researcher-parent who writes for parents of introverted, anxious, and highly sensitive school-age children.

VOICE
- Warm, encouraging, practical. The first sentence hits.
- Direct address: "Look," "Here's the thing," "Let me be straight with you."
- NEVER "my friend," NEVER "sweetheart," NEVER "dear reader."
- Frequent dry, practical humor.
- 70% of references go to: Susan Cain, Elaine Aron, Jerome Kagan, Dawn Huebner, Ross Greene, Janet Lansbury, Wendy Mogel, Dan Siegel, Natasha Daniels.

HARD RULES
- Output Markdown only. No HTML except inline links.
- ZERO em-dashes. Use commas, periods, or parentheses.
- 1,800-2,400 words. Long enough to be useful, never padded.
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
5. At least one external authoritative link (CDC, NIH, AAP, APA, peer-reviewed) with a real URL.
6. At least three internal-link placeholders written as [INTERNAL: topic keyword] (build step resolves them).
7. FAQ section with 2-4 Q&A pairs (use H3 for each Q).
8. Closing paragraph: warm and encouraging. NO Sanskrit closer.

Return ONLY the Markdown article. No preamble, no JSON wrapper, no fenced code block.`;

function wordCount(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

async function callLLM(messages, { temperature = 0.85, maxTokens = 8000, retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, temperature, max_tokens: maxTokens, messages }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`llm ${res.status}: ${t.slice(0, 250)}`);
      }
      const j = await res.json();
      const txt = j?.choices?.[0]?.message?.content || "";
      if (!txt || txt.length < 200) throw new Error(`short content (${txt.length} chars)`);
      return txt;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
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
ANGLE: ${meta.angle || "Practical, parent-tested guidance from The Oracle Lover."}

Word count target: ${MIN_WORDS}-${MAX_WORDS}. Hard floor ${MIN_WORDS} words.`;

  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userMsg },
  ];

  const text = await callLLM(messages);
  let body = text.replace(/^```(?:markdown)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  if (!/^#\s/.test(body)) body = `# ${meta.title}\n\n${body}`;
  const wc = wordCount(body);
  return { body, wordCount: wc };
}

async function processSlug(slug) {
  if (ledger[slug] && !ONLY.includes(slug)) {
    return { slug, skipped: true, reason: "ledger" };
  }
  const existing = await fetchOriginJson(`articles/${slug}.json`);
  if (!existing) return { slug, ok: false, error: "missing on bunny" };

  const meta = {
    title: existing.title || slug,
    category: existing.category,
    tags: existing.tags || [],
    angle: existing.angle,
  };
  let { body, wordCount: wc } = await expandOne(slug, meta);
  if (wc < MIN_WORDS) {
    const retry = await expandOne(slug, meta);
    if (retry.wordCount > wc) ({ body, wordCount: wc } = retry);
  }
  const updated = {
    ...existing,
    body,
    wordCount: wc,
    readingTime: Math.max(6, Math.round(wc / 220)),
    dateModified: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await uploadJsonToBunny(`articles/${slug}.json`, updated);
  ledger[slug] = { wordCount: wc, ts: Date.now() };
  saveLedger();
  return { slug, ok: true, wordCount: wc };
}

async function main() {
  console.log(`[expand-ds] base=${BASE} model=${MODEL} conc=${CONCURRENCY} target=${MIN_WORDS}-${MAX_WORDS}`);
  let candidates = ONLY.length
    ? ONLY
    : JSON.parse(fs.readFileSync(SHORTS_FILE, "utf8"));
  if (LIMIT > 0) candidates = candidates.slice(0, LIMIT);
  const remaining = candidates.filter(s => !ledger[s] || ONLY.includes(s));
  console.log(`[expand-ds] ${candidates.length} candidates, ${remaining.length} pending after ledger`);

  let done = 0, failed = 0, skipped = 0;
  const t0 = Date.now();
  const queue = [...candidates];

  async function worker(id) {
    while (queue.length) {
      const slug = queue.shift();
      try {
        const res = await processSlug(slug);
        if (res.skipped) {
          skipped++;
        } else if (res.ok) {
          done++;
          if ((done + failed) % 5 === 0 || res.wordCount < MIN_WORDS) {
            const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
            const rate = done / Math.max(1, (Date.now()-t0)/1000) * 60;
            console.log(`[w${id}] ${res.slug} ok wc=${res.wordCount}  done=${done} fail=${failed} skip=${skipped} t=${elapsed}s rate=${rate.toFixed(1)}/min`);
          }
        } else {
          failed++;
          console.log(`[w${id}] ${slug} FAIL: ${res.error}`);
        }
      } catch (e) {
        failed++;
        console.log(`[w${id}] ${slug} EXC: ${(e.message || "").slice(0, 250)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`[expand-ds] DONE total=${candidates.length} ok=${done} skip=${skipped} fail=${failed} elapsed=${elapsed}s`);
}

main().catch(e => { console.error("[expand-ds] FATAL", e); process.exit(1); });
