// Backdate every "published" article so publishedAt is randomized across the
// previous N days (default 90). dateModified is randomly placed between
// publishedAt and now. Writes both the article JSON on Bunny and the master
// index. Idempotent.

import {
  fetchJsonFromBunnyOrigin,
  uploadJsonToBunny,
} from "../src/lib/bunny.mjs";

const REMOTE_PREFIX = "articles";
const INDEX_PATH = "articles/index.json";
const SPREAD_DAYS = parseInt(process.env.SPREAD_DAYS || "90", 10);
const MIN_GAP_HOURS = 1; // each article gets a unique-enough timestamp
const NOW = Date.now();
const FLOOR = NOW - SPREAD_DAYS * 24 * 60 * 60 * 1000;

function rand(min, max) { return min + Math.random() * (max - min); }

async function main() {
  const dryRun = process.argv.includes("--dry");
  const indexRaw = await fetchJsonFromBunnyOrigin(INDEX_PATH);
  if (!Array.isArray(indexRaw)) {
    console.error("[backdate] index is not an array");
    process.exit(2);
  }
  const published = indexRaw.filter((e) => e.status === "published");
  console.log(`[backdate] published articles: ${published.length}, spread across ${SPREAD_DAYS} days`);

  // Build N evenly-spaced timestamps, then jitter each by +/- 6 hours.
  const stamps = [];
  for (let i = 0; i < published.length; i++) {
    const base = FLOOR + ((i + 0.5) * (NOW - FLOOR)) / published.length;
    const jitter = rand(-6, 6) * 60 * 60 * 1000;
    stamps.push(base + jitter);
  }
  // Shuffle so newest articles are not last alphabetically.
  for (let i = stamps.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [stamps[i], stamps[j]] = [stamps[j], stamps[i]];
  }
  // Sort each list deterministically: newest publishedAt assigned to articles
  // alphabetical by slug? Better: random pairing keeps surprise.
  // We just zip published[i] -> stamps[i].

  const newIndex = indexRaw.slice();
  let touched = 0;
  let failed = 0;

  for (let i = 0; i < published.length; i++) {
    const meta = published[i];
    const publishedAt = Math.round(stamps[i]);
    // dateModified between publishedAt and now, within 30 days of now max.
    const dmFloor = publishedAt + 7 * 24 * 60 * 60 * 1000;
    const dmCeil = NOW;
    const dateModified = Math.round(rand(Math.min(dmFloor, dmCeil - 1), dmCeil));

    let article;
    try {
      article = await fetchJsonFromBunnyOrigin(`${REMOTE_PREFIX}/${meta.slug}.json`);
    } catch (e) {
      console.error(`[backdate] read fail ${meta.slug}: ${e.message}`);
      failed++;
      continue;
    }
    article.publishedAt = publishedAt;
    article.dateModified = dateModified;
    if (!dryRun) {
      try {
        await uploadJsonToBunny(`${REMOTE_PREFIX}/${meta.slug}.json`, article);
      } catch (e) {
        console.error(`[backdate] write fail ${meta.slug}: ${e.message}`);
        failed++;
        continue;
      }
    }
    // Patch index entry too
    const idxRow = newIndex.find((x) => x.slug === meta.slug);
    if (idxRow) {
      idxRow.publishedAt = publishedAt;
      idxRow.dateModified = dateModified;
    }
    touched++;
    if (touched % 50 === 0) console.log(`[backdate] ${touched}/${published.length}`);
  }

  if (!dryRun) {
    await uploadJsonToBunny(INDEX_PATH, newIndex);
    console.log(`[backdate] index updated.`);
  } else {
    console.log("[backdate] DRY RUN - no writes");
  }
  console.log(`[backdate] done touched=${touched} failed=${failed}`);
}

main().catch((e) => { console.error("[backdate] fatal", e); process.exit(1); });
