#!/usr/bin/env node
// Rebuilds articles/index.json on Bunny by reading every article JSON
// directly from Bunny Storage (origin), not the public pull zone, to
// avoid CDN cache lag right after a write burst.

import { BUNNY, uploadJsonToBunny } from "../src/lib/bunny.mjs";
import { indexEntryFromArticle } from "../src/lib/store.mjs";

async function withRetry(fn, label, attempts = 5, baseDelay = 1500) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const wait = baseDelay * Math.pow(2, i) + Math.random() * 500;
      if (i < attempts - 1) {
        console.warn(`  retry ${i+1}/${attempts} ${label}: ${e.message}`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

async function readFromOrigin(remotePath) {
  const url = `https://${BUNNY.storageHost}/${BUNNY.storageZone}/${remotePath.replace(/^\/+/, "")}`;
  const res = await fetch(url, {
    headers: { AccessKey: BUNNY.storageKey },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Bunny origin ${res.status} ${remotePath}`);
  return await res.json();
}

async function main() {
  console.log("[rebuild] reading current index from Bunny origin...");
  const idx = await withRetry(() => readFromOrigin("articles/index.json"), "readIndex");
  console.log(`[rebuild] index has ${idx.length} entries`);

  // Read each article directly from Bunny Storage origin
  console.log("[rebuild] fetching every article JSON from origin...");
  const merged = [];
  let i = 0;
  for (const e of idx) {
    i++;
    const article = await withRetry(
      () => readFromOrigin(`articles/${e.slug}.json`),
      `read ${e.slug}`
    ).catch(err => {
      console.warn(`  [skip ${i}/${idx.length}] ${e.slug}: ${err.message}`);
      return null;
    });
    merged.push(article || e);
    if (i % 50 === 0) console.log(`  [${i}/${idx.length}] read`);
  }

  // Sort same way store.getIndex does
  merged.sort((a, b) => {
    if (a.status !== b.status) {
      const order = { published: 0, draft: 1, queued: 2 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    }
    return (b.publishedAt || b.queuedAt || 0) - (a.publishedAt || a.queuedAt || 0);
  });

  const items = merged.map(indexEntryFromArticle);

  console.log(`[rebuild] writing index with ${items.length} entries...`);
  await withRetry(() => uploadJsonToBunny("articles/index.json", items), "uploadIndex", 8, 3000);
  console.log("[rebuild] done");

  const withHero = items.filter(a => a.heroUrl).length;
  const published = items.filter(a => a.status === "published").length;
  const draft = items.filter(a => a.status === "draft").length;
  const queued = items.filter(a => a.status === "queued").length;
  console.log(`[rebuild] summary: total=${items.length} withHero=${withHero} published=${published} draft=${draft} queued=${queued}`);
}

main().catch(e => { console.error("fatal:", e); process.exit(1); });
