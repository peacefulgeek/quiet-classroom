#!/usr/bin/env node
// Post-process every published article body:
// 1. Replace every em-dash with a comma + space (the hard rule).
// 2. Replace banned-word leftovers with neutral substitutes.
// 3. Resolve [INTERNAL: keyword] placeholders by linking to the closest related slug.
// 4. Re-run the quality gate and update qualityWarnings.

import { promises as fs } from "node:fs";
import path from "node:path";
import { checkArticle } from "../src/lib/quality-gate.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIR = path.join(ROOT, "content/articles");

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
  // em-dash, en-dash, double-hyphen
  out = out.replace(/—/g, ", ").replace(/–/g, ", ").replace(/--/g, ", ");
  // phrases first
  for (const [k, v] of Object.entries(PHRASE_SUBS)) {
    out = out.split(k).join(v);
    out = out.split(k.toLowerCase()).join(v);
  }
  // single words, case-preserving for first-letter
  for (const [k, v] of Object.entries(SUBS)) {
    const re = new RegExp(`\\b${k.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, (m) => {
      if (m[0] === m[0].toUpperCase()) return v[0].toUpperCase() + v.slice(1);
      return v;
    });
  }
  // collapse double spaces and clean up the comma-space artifacts
  out = out.replace(/ +,/g, ",").replace(/ {2,}/g, " ").replace(/ +\./g, ".");
  return out;
}

// Build an index of slug + tags so internal-link placeholders can be resolved
async function loadIndex() {
  const files = (await fs.readdir(DIR)).filter(f => f.endsWith(".json"));
  const index = [];
  for (const f of files) {
    const a = JSON.parse(await fs.readFile(path.join(DIR, f), "utf8"));
    if (a.status !== "published") continue;
    index.push({ slug: a.slug, title: a.title, tags: (a.tags || []).map(t => t.toLowerCase()), titleWords: (a.title || "").toLowerCase().split(/\W+/) });
  }
  return index;
}

function resolvePlaceholder(keyword, index, currentSlug) {
  const k = keyword.toLowerCase().trim();
  const kWords = k.split(/\W+/).filter(Boolean);
  let best = null, bestScore = 0;
  for (const item of index) {
    if (item.slug === currentSlug) continue;
    let score = 0;
    for (const w of kWords) {
      if (item.tags.includes(w)) score += 2;
      if (item.titleWords.includes(w)) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = item; }
  }
  if (best && bestScore > 0) return `[${keyword}](/articles/${best.slug})`;
  return keyword;
}

const index = await loadIndex();
console.log(`indexed ${index.length} published articles`);

const files = (await fs.readdir(DIR)).filter(f => f.endsWith(".json"));
let processed = 0, gateOk = 0, gateWarn = 0;

for (const f of files) {
  const fp = path.join(DIR, f);
  const a = JSON.parse(await fs.readFile(fp, "utf8"));
  if ((a.status !== "published" && a.status !== "draft") || !a.body) continue;

  let body = a.body;
  body = applySubs(body);

  // Resolve internal-link placeholders
  body = body.replace(/\[INTERNAL:\s*([^\]]+)\]/gi, (_m, kw) => resolvePlaceholder(kw, index, a.slug));

  // Ensure the required closing signature is present
  if (!/Sat Chit Ananda/i.test(body)) {
    body = body.replace(/\s+$/, "") + "\n\n*Sat Chit Ananda.*\n";
  }

  a.body = body;

  // Clean tldr and metaDescription too
  if (a.tldr) a.tldr = applySubs(a.tldr);
  if (a.metaDescription) a.metaDescription = applySubs(a.metaDescription);
  // Recompute tldr/metaDescription if missing or unhelpful
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

  await fs.writeFile(fp, JSON.stringify(a, null, 2));
  processed++;
}

console.log(`post-processed: ${processed}  gate-clean=${gateOk}  warnings=${gateWarn}`);
