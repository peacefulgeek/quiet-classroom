#!/usr/bin/env node
// One-shot migration: upload every JSON file in content/articles/ to Bunny CDN
// under articles/{slug}.json, then write a master articles/index.json.
//
// Uses STORE_LOCAL_MIRROR=false + STORE_MODE=bunny so writes go strictly remote.
// Safe to re-run; uploads overwrite by design.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { uploadJsonToBunny, fetchJsonFromBunny, bunnyUrl } from "../src/lib/bunny.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(ROOT, "content/articles");

const REMOTE_PREFIX = "articles";
const INDEX_REMOTE_PATH = `${REMOTE_PREFIX}/index.json`;
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "12", 10);

function indexEntryFromArticle(a) {
  return {
    slug: a.slug,
    title: a.title,
    metaDescription: a.metaDescription,
    category: a.category,
    tags: a.tags || [],
    status: a.status,
    publishedAt: a.publishedAt || null,
    queuedAt: a.queuedAt || null,
    dateModified: a.dateModified || a.publishedAt || a.queuedAt || null,
    readingTime: a.readingTime || null,
    heroUrl: a.heroUrl || null,
    ogImage: a.ogImage || null,
  };
}

const files = (await fs.readdir(ARTICLES_DIR)).filter((f) => f.endsWith(".json") && f !== "index.json");
console.log(`Found ${files.length} local article JSON files`);

const articles = [];
for (const f of files) {
  try {
    const raw = await fs.readFile(path.join(ARTICLES_DIR, f), "utf8");
    articles.push(JSON.parse(raw));
  } catch (e) {
    console.error(`skip ${f}: ${e.message}`);
  }
}
console.log(`Parsed ${articles.length} articles`);

let ok = 0, fail = 0, idx = 0;
async function worker(wid) {
  while (true) {
    const a = articles[idx++];
    if (!a) return;
    try {
      await uploadJsonToBunny(`${REMOTE_PREFIX}/${a.slug}.json`, a);
      ok++;
      if (ok % 25 === 0) console.log(`  uploaded ${ok}/${articles.length}`);
    } catch (e) {
      fail++;
      console.error(`fail ${a.slug}: ${e.message}`);
    }
  }
}

const t0 = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`articles upload: ok=${ok} fail=${fail} in ${dt}s`);

// Build master index
console.log("\nWriting master index...");
const items = articles.map(indexEntryFromArticle);
items.sort((a, b) => {
  if (a.status !== b.status) {
    const order = { published: 0, draft: 1, queued: 2 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  }
  return (b.publishedAt || b.queuedAt || 0) - (a.publishedAt || a.queuedAt || 0);
});
await uploadJsonToBunny(INDEX_REMOTE_PATH, items);
console.log(`index uploaded: ${items.length} entries -> ${bunnyUrl(INDEX_REMOTE_PATH)}`);

// Verify by fetching back
const back = await fetchJsonFromBunny(INDEX_REMOTE_PATH);
const byStatus = back.reduce((acc, e) => {
  acc[e.status] = (acc[e.status] || 0) + 1;
  return acc;
}, {});
console.log("verify index breakdown:", JSON.stringify(byStatus));
