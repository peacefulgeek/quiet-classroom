// Quarterly refresh: pick the N oldest-modified published articles, ask Claude
// to rewrite them, run the quality gate, and on pass write the new body +
// bumped dateModified back to Bunny + the index.
//
// Usage:
//   COUNT=20 CLAUDE_API_KEY=... node scripts/quarterly-refresh.mjs
//
// Run by Railway cron at the first of each quarter (or any cadence you set).

import { fetchJsonFromBunnyOrigin, uploadJsonToBunny } from "../src/lib/bunny.mjs";
import { refreshArticle, CLAUDE_INFO } from "../src/lib/claude.mjs";

const REMOTE_PREFIX = "articles";
const INDEX_PATH = "articles/index.json";
const COUNT = parseInt(process.env.COUNT || process.env.REFRESH_COUNT || "10", 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "4", 10);
const VERBOSE = !!process.env.VERBOSE_GEN;

async function main() {
  if (!process.env.CLAUDE_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error("[refresh] CLAUDE_API_KEY missing - skipping");
    return;
  }
  const idx = await fetchJsonFromBunnyOrigin(INDEX_PATH);
  if (!Array.isArray(idx)) throw new Error("index not array");
  const published = idx.filter((a) => a.status === "published");
  // sort oldest dateModified first
  published.sort((a, b) => (a.dateModified || a.publishedAt || 0) - (b.dateModified || b.publishedAt || 0));
  const targets = published.slice(0, COUNT);
  console.log(`[refresh] count=${targets.length} model=${CLAUDE_INFO.model}`);

  const newIdx = idx.slice();
  let pass = 0, fail = 0;

  // simple work-stealing queue
  const queue = targets.slice();
  async function worker(id) {
    while (queue.length) {
      const meta = queue.shift();
      if (!meta) break;
      try {
        const article = await fetchJsonFromBunnyOrigin(`${REMOTE_PREFIX}/${meta.slug}.json`);
        if (!article || !article.body) { fail++; continue; }
        if (VERBOSE) console.log(`  [${id}] refresh ${meta.slug}`);
        const result = await refreshArticle(article, article.body, { minWords: 1800, maxWords: 2500, attempts: 3 });
        if (!result.gate.ok) {
          console.warn(`  [${id}] gate fail ${meta.slug}: ${result.gate.reasons.join("; ")}`);
          fail++;
          continue;
        }
        article.body = result.text;
        article.dateModified = Date.now();
        article.refreshedAt = Date.now();
        await uploadJsonToBunny(`${REMOTE_PREFIX}/${meta.slug}.json`, article);
        const idxRow = newIdx.find((x) => x.slug === meta.slug);
        if (idxRow) idxRow.dateModified = article.dateModified;
        pass++;
        console.log(`  [${id}] ok ${meta.slug} (${result.gate.words} words)`);
      } catch (e) {
        console.error(`  [${id}] err ${meta.slug}: ${e.message}`);
        fail++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
  await uploadJsonToBunny(INDEX_PATH, newIdx);
  console.log(`[refresh] done pass=${pass} fail=${fail}`);
}

main().catch((e) => { console.error("[refresh] fatal", e); process.exit(1); });
