// JSON content store. Per addendum: "no MySQL/Postgres/Manus TiDB — it's just json etc — keep it simple."
// One file per article in content/articles/{slug}.json. Index aggregated on demand and cached in-process.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONTENT_DIR = path.resolve(__dirname, "../../content");
export const ARTICLES_DIR = path.join(CONTENT_DIR, "articles");

let _indexCache = null;
let _indexCacheAt = 0;
const INDEX_TTL_MS = 30_000;

export async function ensureDirs() {
  await fs.mkdir(ARTICLES_DIR, { recursive: true });
}

export async function listArticleFiles() {
  await ensureDirs();
  const files = await fs.readdir(ARTICLES_DIR);
  return files.filter(f => f.endsWith(".json")).map(f => path.join(ARTICLES_DIR, f));
}

export async function readArticle(slug) {
  const p = path.join(ARTICLES_DIR, `${slug}.json`);
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

export async function writeArticle(article) {
  await ensureDirs();
  if (!article.slug) throw new Error("article.slug required");
  const p = path.join(ARTICLES_DIR, `${article.slug}.json`);
  await fs.writeFile(p, JSON.stringify(article, null, 2));
  _indexCache = null;
  return p;
}

export async function getIndex({ force = false } = {}) {
  if (!force && _indexCache && Date.now() - _indexCacheAt < INDEX_TTL_MS) return _indexCache;
  const files = await listArticleFiles();
  const items = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(f, "utf8");
      const a = JSON.parse(raw);
      items.push({
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
      });
    } catch {}
  }
  // Sort: published newest first, then queued by queuedAt
  items.sort((a, b) => {
    if (a.status !== b.status) return a.status === "published" ? -1 : 1;
    return (b.publishedAt || b.queuedAt || 0) - (a.publishedAt || a.queuedAt || 0);
  });
  _indexCache = items;
  _indexCacheAt = Date.now();
  return items;
}

export async function getPublished() {
  const idx = await getIndex();
  return idx.filter(a => a.status === "published");
}

export async function getQueued() {
  const idx = await getIndex();
  return idx.filter(a => a.status === "queued");
}

export async function nextQueued() {
  const q = await getQueued();
  // Pick oldest queuedAt
  q.sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));
  return q[0] || null;
}

export function bustIndex() {
  _indexCache = null;
}
