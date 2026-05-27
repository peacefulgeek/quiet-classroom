#!/usr/bin/env node
// Seed every topic in topics-500.json as a queued article shell.
// Idempotent: existing slugs (already in the Bunny index) are not overwritten.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeArticle, getIndex, rebuildIndex, readArticle, bustIndex } from "../src/lib/store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const topics = JSON.parse(
  await fs.readFile(path.join(ROOT, "src/data/topics-500.json"), "utf8")
);

const index = await getIndex({ force: true });
const known = new Set(index.map((a) => a.slug));

let created = 0,
  skipped = 0;
for (const t of topics) {
  if (known.has(t.slug)) {
    skipped++;
    continue;
  }
  const article = {
    slug: t.slug,
    title: t.title,
    metaDescription: "",
    tldr: "",
    category: t.category || "School Life",
    tags: t.tags || [],
    angle: t.angle || null,
    status: "queued",
    queuedAt: Date.now(),
    publishedAt: null,
    dateModified: null,
    body: "",
    readingTime: null,
    heroUrl: null,
    ogImage: null,
  };
  await writeArticle(article);
  created++;
  if (created % 25 === 0) console.log(`  seeded ${created} so far`);
}

// Rebuild master index so new slugs are discoverable
bustIndex();
const fresh = await getIndex({ force: true });
await rebuildIndex(
  await Promise.all(fresh.map(async (e) => (await readArticle(e.slug)) || e))
);
console.log(`seeded: created=${created} skipped=${skipped} total=${topics.length}`);
