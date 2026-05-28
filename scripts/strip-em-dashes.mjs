// One-time pass: replace U+2014 em-dashes with " - " in every article body
// on Bunny. The site's renderer already does this defensively, but we want
// the source-of-truth JSON files to be gate-clean too (so /llms-full.txt
// and any downstream RAG corpus exports are clean).

import { fetchJsonFromBunnyOrigin, uploadJsonToBunny } from "../src/lib/bunny.mjs";

const idx = await fetchJsonFromBunnyOrigin("articles/index.json");
console.log(`scanning ${idx.length} articles...`);

let touched = 0, skipped = 0, failed = 0;
const concurrency = 8;
let cursor = 0;

function clean(text) {
  if (!text) return text;
  return text
    .replace(/\s*\u2014\s*/g, " - ")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/  +/g, " ");
}

async function worker() {
  while (true) {
    const i = cursor++;
    if (i >= idx.length) return;
    const meta = idx[i];
    try {
      const a = await fetchJsonFromBunnyOrigin(`articles/${meta.slug}.json`);
      if (!a) { skipped++; continue; }
      const before = a.body || "";
      const after = clean(before);
      if (after === before) { skipped++; continue; }
      a.body = after;
      // bump dateModified so sitemap reflects the cleanup
      a.dateModified = Date.now();
      await uploadJsonToBunny(`articles/${meta.slug}.json`, a);
      touched++;
      if (touched % 25 === 0) console.log(`  cleaned ${touched}`);
    } catch (e) {
      console.error(`  err ${meta.slug}: ${e.message}`);
      failed++;
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
console.log(`\nDONE touched=${touched} skipped=${skipped} failed=${failed}`);
