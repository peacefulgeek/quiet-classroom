// Right-size the publish queue per Final Pass scope.
//
// Target: 30-100 published, 400-500 queued. We currently have ~500 published
// and 0 queued. Move all but TOP_N back to queued so the existing publish cron
// drips them out (5/day, no cap).
//
// Ranking: keep the most recently published, breaking ties by word count.

import { fetchJsonFromBunnyOrigin, uploadJsonToBunny } from "../src/lib/bunny.mjs";

const REMOTE_PREFIX = "articles";
const INDEX_PATH = "articles/index.json";
const TARGET_PUBLISHED = parseInt(process.env.TARGET_PUBLISHED || "70", 10);

async function main() {
  const dryRun = process.argv.includes("--dry");
  const idx = await fetchJsonFromBunnyOrigin(INDEX_PATH);
  if (!Array.isArray(idx)) throw new Error("index not array");
  const published = idx.filter((e) => e.status === "published");
  const queued = idx.filter((e) => e.status === "queued");
  const draft = idx.filter((e) => e.status === "draft");
  console.log(`[right-size] before: published=${published.length} queued=${queued.length} draft=${draft.length}`);

  if (published.length <= TARGET_PUBLISHED) {
    console.log(`[right-size] published (${published.length}) already <= target (${TARGET_PUBLISHED}); nothing to demote.`);
    return;
  }
  // Rank by publishedAt desc (newer first stays published)
  published.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  const keep = published.slice(0, TARGET_PUBLISHED);
  const demote = published.slice(TARGET_PUBLISHED);
  console.log(`[right-size] keeping ${keep.length} as published, demoting ${demote.length} -> queued`);

  const newIdx = idx.slice();
  let touched = 0, failed = 0;
  for (const meta of demote) {
    try {
      const article = await fetchJsonFromBunnyOrigin(`${REMOTE_PREFIX}/${meta.slug}.json`);
      if (!article) { failed++; continue; }
      article.status = "queued";
      // Stamp queuedAt so the publish cron orders fairly
      article.queuedAt = (meta.publishedAt || Date.now()) + 1; // monotonic
      // Clear publishedAt so the byline doesn't lie when it eventually re-publishes
      article.previousPublishedAt = article.publishedAt;
      article.publishedAt = null;
      if (!dryRun) {
        await uploadJsonToBunny(`${REMOTE_PREFIX}/${meta.slug}.json`, article);
      }
      const row = newIdx.find((x) => x.slug === meta.slug);
      if (row) {
        row.status = "queued";
        row.queuedAt = article.queuedAt;
        row.publishedAt = null;
      }
      touched++;
      if (touched % 50 === 0) console.log(`[right-size] demoted ${touched}/${demote.length}`);
    } catch (e) {
      console.error(`[right-size] err ${meta.slug}: ${e.message}`);
      failed++;
    }
  }
  if (!dryRun) {
    await uploadJsonToBunny(INDEX_PATH, newIdx);
  } else {
    console.log("[right-size] DRY RUN - no writes");
  }
  const after = newIdx.reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; }, {});
  console.log(`[right-size] after: ${JSON.stringify(after)} touched=${touched} failed=${failed}`);
}

main().catch((e) => { console.error("[right-size] fatal", e); process.exit(1); });
