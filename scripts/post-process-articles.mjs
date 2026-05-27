#!/usr/bin/env node
// Post-process every published+draft article body:
// 1. Replace every em-dash with a comma + space (the hard rule).
// 2. Replace banned-word leftovers with neutral substitutes.
// 3. Resolve [INTERNAL: keyword] placeholders by linking to the closest related slug.
// 4. Re-run the quality gate and update qualityWarnings.
// 5. Persist through the store layer (Bunny in prod, local in dev).

import { checkArticle } from "../src/lib/quality-gate.mjs";
import { getIndex, readArticle, writeArticle, rebuildIndex, bustIndex } from "../src/lib/store.mjs";

// Word-level substitutions for banned vocabulary. Conservative: prefer plain English.
const SUBS = {
  "profound": "real",
  "transformative": "useful",
  "holistic": "whole-child",
  "nuanced": "specific",
  "multifaceted": "complex",
  "delve": "look",
  "delve into": "look at",
  "tapestry": "mix",
  "paradigm": "model",
  "synergy": "fit",
  "leverage": "use",
  "unlock": "open",
  "empower": "support",
  "utilize": "use",
  "pivotal": "key",
  "embark": "begin",
  "underscore": "show",
  "paramount": "crucial",
  "seamlessly": "smoothly",
  "robust": "solid",
  "beacon": "guide",
  "foster": "build",
  "elevate": "lift",
  "curate": "choose",
  "curated": "chosen",
  "bespoke": "custom",
  "resonate": "connect",
  "harness": "use",
  "intricate": "complex",
  "plethora": "many",
  "myriad": "many",
  "groundbreaking": "new",
  "innovative": "new",
  "cutting-edge": "current",
  "state-of-the-art": "current",
  "game-changer": "shift",
  "game-changing": "important",
  "ever-evolving": "changing",
  "rapidly-evolving": "changing",
  "stakeholders": "people involved",
  "comprehensive": "complete",
  "ecosystem": "environment",
};

const PHRASE_SUBS = {
  "It's important to note that ": "",
  "It is important to note that ": "",
  "It's worth noting that ": "",
  "It is worth noting that ": "",
  "It's crucial to ": "You need to ",
  "It is crucial to ": "You need to ",
  "In conclusion,": "So,",
  "In summary,": "So,",
  "In the realm of ": "In ",
  "A holistic approach": "A whole-child approach",
  "Unlock your potential": "Use what you have",
  "Dive deep into": "Look closely at",
  "At the end of the day": "In the end",
  "Move the needle": "Make progress",
  "It goes without saying": "Clearly",
  "In today's fast-paced world": "Today",
  "In today's digital age": "Today",
};

function applySubs(text) {
  let out = text;
  out = out.replace(/—/g, ", ").replace(/–/g, ", ").replace(/--/g, ", ");
  for (const [k, v] of Object.entries(PHRASE_SUBS)) {
    out = out.split(k).join(v);
    out = out.split(k.toLowerCase()).join(v);
  }
  for (const [k, v] of Object.entries(SUBS)) {
    const re = new RegExp(`\\b${k.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, (m) => {
      if (m[0] === m[0].toUpperCase()) return v[0].toUpperCase() + v.slice(1);
      return v;
    });
  }
  out = out.replace(/ +,/g, ",").replace(/ {2,}/g, " ").replace(/ +\./g, ".");
  return out;
}

function resolvePlaceholder(keyword, index, currentSlug) {
  const k = keyword.toLowerCase().trim();
  const kWords = k.split(/\W+/).filter(Boolean);
  let best = null, bestScore = 0;
  for (const item of index) {
    if (item.slug === currentSlug) continue;
    if (item.status !== "published") continue;
    let score = 0;
    const itemTags = (item.tags || []).map((t) => t.toLowerCase());
    const titleWords = (item.title || "").toLowerCase().split(/\W+/);
    for (const w of kWords) {
      if (itemTags.includes(w)) score += 2;
      if (titleWords.includes(w)) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = item; }
  }
  if (best && bestScore > 0) return `[${keyword}](/articles/${best.slug})`;
  return keyword;
}

const index = await getIndex({ force: true });
console.log(`indexed ${index.length} entries  published=${index.filter(a => a.status === "published").length}  drafts=${index.filter(a => a.status === "draft").length}`);

let processed = 0, gateOk = 0, gateWarn = 0, untouched = 0;
const refreshed = [];

for (const entry of index) {
  if (entry.status !== "published" && entry.status !== "draft") { untouched++; continue; }
  const a = await readArticle(entry.slug);
  if (!a || !a.body) { untouched++; continue; }

  let body = a.body;
  body = applySubs(body);
  body = body.replace(/\[INTERNAL:\s*([^\]]+)\]/gi, (_m, kw) => resolvePlaceholder(kw, index, a.slug));

  if (!/Sat Chit Ananda/i.test(body)) {
    body = body.replace(/\s+$/, "") + "\n\n*Sat Chit Ananda.*\n";
  }
  a.body = body;

  if (a.tldr) a.tldr = applySubs(a.tldr);
  if (a.metaDescription) a.metaDescription = applySubs(a.metaDescription);
  const firstSent = (body.match(/^[^#].{60,200}\./m) || [""])[0].trim();
  if (!a.tldr) {
    const tldrMatch = body.match(/^_(.+?)_$/m) || body.match(/^\*([^*\n]{30,260})\*$/m);
    a.tldr = tldrMatch ? tldrMatch[1] : firstSent.slice(0, 220);
  }
  if (!a.metaDescription || a.metaDescription.length < 50) {
    a.metaDescription = firstSent.slice(0, 160);
  }
  a.dateModified = Date.now();

  const gate = checkArticle(body, { minWords: 1500, maxWords: 3000 });
  a.qualityWarnings = gate.ok ? undefined : gate.reasons;
  if (gate.ok) gateOk++; else gateWarn++;

  await writeArticle(a);
  refreshed.push(a);
  processed++;
  if (processed % 25 === 0) console.log(`  processed ${processed} so far`);
}

// Rebuild master index after all writes
bustIndex();
const fullIndex = await getIndex({ force: true });
// If we have full article objects available, rebuild from those for completeness;
// otherwise use the index entries we already have
await rebuildIndex(refreshed.length ? refreshed.concat(
  // include items we didn't touch but still want indexed: just re-use their entry
  fullIndex.filter((e) => !refreshed.find((r) => r.slug === e.slug))
) : fullIndex);

console.log(`post-processed: ${processed}  gate-clean=${gateOk}  warnings=${gateWarn}  untouched=${untouched}`);
