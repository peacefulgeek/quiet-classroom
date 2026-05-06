#!/usr/bin/env node
// Seed every topic in topics-500.json into content/articles/ as a queued shell.
// Idempotent: existing files are not overwritten.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(ROOT, "content/articles");
await fs.mkdir(ARTICLES_DIR, { recursive: true });

const topics = JSON.parse(await fs.readFile(path.join(ROOT, "src/data/topics-500.json"), "utf8"));

let created = 0, skipped = 0;
for (const t of topics) {
  const file = path.join(ARTICLES_DIR, `${t.slug}.json`);
  try {
    await fs.access(file);
    skipped++;
    continue;
  } catch {}
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
  await fs.writeFile(file, JSON.stringify(article, null, 2));
  created++;
}
console.log(`seeded: created=${created} skipped=${skipped} total=${topics.length}`);
