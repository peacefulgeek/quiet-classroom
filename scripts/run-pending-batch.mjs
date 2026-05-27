#!/usr/bin/env node
// Pull N queued articles, run them through DeepSeek + quality gate, persist.
// Usage:
//   BATCH_SIZE=10 node scripts/run-pending-batch.mjs            # generate + publish 10
//   BATCH_SIZE=10 PUBLISH=false node scripts/run-pending-batch.mjs  # generate, leave queued
//   PUBLISH_FIRST=30 node scripts/run-pending-batch.mjs         # generate 30 and mark all published

import { writeArticle, readArticle, getIndex, rebuildIndex, bustIndex } from "../src/lib/store.mjs";
import { writeArticle as authorArticle } from "../src/lib/deepseek.mjs";

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || process.env.PUBLISH_FIRST || "10", 10);
const PUBLISH = (process.env.PUBLISH || "true") !== "false";
// No hard cap per scope. Batch is purely BATCH_SIZE.

const index = await getIndex({ force: true });
let currentlyPublished = index.filter((a) => a.status === "published").length;
const queueEntries = index
  .filter((a) => a.status === "queued")
  .sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));
const queue = [];
for (const e of queueEntries) {
  const a = await readArticle(e.slug);
  if (!a) continue;
  if (!a.body || a.body.length < 200) queue.push(a);
}

const work = queue.slice(0, BATCH_SIZE);
console.log(`published=${currentlyPublished} queued total=${queue.length} processing=${work.length} publish=${PUBLISH}`);

const CONCURRENCY = parseInt(process.env.CONCURRENCY || "5", 10);
let ok = 0, fail = 0, idx = 0;
async function worker(wid) {
  while (true) {
    const article = work[idx++];
    if (!article) return;
    const n = ok + fail + 1;
    try {
      console.log(`[w${wid} ${n}/${work.length}] ${article.slug}`);
      const t0 = Date.now();
      const { text, gate } = await authorArticle(article, { attempts: 1 });
      const issues = gate.reasons || [];
      if (!text) { console.warn(`  [w${wid}] empty text`); fail++; continue; }
      if (!gate.ok) { console.warn(`  [w${wid}] warn: ${issues.slice(0,2).join(' | ')}`); article.qualityWarnings = issues; }
      else delete article.qualityWarnings;
      article.body = text;
      article.metaDescription = (text.match(/^[^#].{60,160}\./m) || ["A quiet, plain-spoken read for parents of sensitive children."])[0].trim().slice(0, 160);
      article.tldr = (text.match(/^_(.+?)_$/m) || text.match(/^\*(.+?)\*$/m) || ["", ""])[1] || "";
      article.readingTime = Math.max(4, Math.round(text.split(/\s+/).length / 220));
      article.dateModified = Date.now();
      if (PUBLISH) {
        article.status = "published";
        article.publishedAt = Date.now();
      } else if (process.env.STATUS) {
        // e.g. STATUS=draft to mark generated bodies as gated drafts
        article.status = process.env.STATUS;
      }
      await writeArticle(article);
      ok++;
      console.log(`  [w${wid}] ok in ${((Date.now()-t0)/1000).toFixed(0)}s`);
    } catch (e) {
      console.error(`  [w${wid}] error: ${e.message}`);
      fail++;
    }
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, (_, i) => worker(i+1)));

// Rebuild master index so the new statuses surface to the live site immediately
bustIndex();
const freshIndex = await getIndex({ force: true });
await rebuildIndex(
  await Promise.all(freshIndex.map(async (e) => (await readArticle(e.slug)) || e))
);
console.log(`done: ok=${ok} fail=${fail}`);
