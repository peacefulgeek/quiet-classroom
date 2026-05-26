#!/usr/bin/env node
// Pull N queued articles, run them through DeepSeek + quality gate, persist.
// Usage:
//   BATCH_SIZE=10 node scripts/run-pending-batch.mjs            # generate + publish 10
//   BATCH_SIZE=10 PUBLISH=false node scripts/run-pending-batch.mjs  # generate, leave queued
//   PUBLISH_FIRST=30 node scripts/run-pending-batch.mjs         # generate 30 and mark all published

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeArticle } from "../src/lib/store.mjs";
import { writeArticle as authorArticle } from "../src/lib/deepseek.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(ROOT, "content/articles");

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || process.env.PUBLISH_FIRST || "10", 10);
const PUBLISH = (process.env.PUBLISH || "true") !== "false";
const PUBLISHED_CAP = parseInt(process.env.PUBLISHED_CAP || "100", 10);

const files = (await fs.readdir(ARTICLES_DIR)).filter(f => f.endsWith(".json"));
const queue = [];
let currentlyPublished = 0;
for (const f of files) {
  const a = JSON.parse(await fs.readFile(path.join(ARTICLES_DIR, f), "utf8"));
  if (a.status === "published") currentlyPublished++;
  if (a.status === "queued" && (!a.body || a.body.length < 200)) queue.push(a);
}
queue.sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));

// If publishing, cap the slice so we never exceed PUBLISHED_CAP
let effectiveBatch = BATCH_SIZE;
if (PUBLISH) {
  const room = Math.max(0, PUBLISHED_CAP - currentlyPublished);
  effectiveBatch = Math.min(BATCH_SIZE, room);
  if (effectiveBatch === 0) {
    console.log(`cap reached: published=${currentlyPublished} cap=${PUBLISHED_CAP}; nothing to do`);
    process.exit(0);
  }
}
const work = queue.slice(0, effectiveBatch);
console.log(`published=${currentlyPublished}/${PUBLISHED_CAP} queued total=${queue.length} processing=${work.length} publish=${PUBLISH}`);

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
      if (PUBLISH) { article.status = "published"; article.publishedAt = Date.now(); }
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
console.log(`done: ok=${ok} fail=${fail}`);
