// JSON content store. Per addendum: "no MySQL/Postgres/Manus TiDB — it's just json etc — keep it simple."
//
// Source of truth: Bunny CDN at /articles/{slug}.json plus a master /articles/index.json.
// Local dev fallback: content/articles/{slug}.json when STORE_MODE=local.
//
// Caches:
//   - Index: in-memory, TTL 60s (configurable via INDEX_TTL_MS).
//   - Bodies: LRU, default 200 entries (configurable via BODY_CACHE_SIZE).

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchJsonFromBunny,
  fetchJsonFromBunnyOrigin,
  uploadJsonToBunny,
  deleteFromBunny,
  bunnyUrl,
} from "./bunny.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Where we keep local copies. Even in Bunny mode we may mirror writes here
// for forensic dump / quick local diff. Toggle via STORE_LOCAL_MIRROR=true.
export const CONTENT_DIR = path.resolve(__dirname, "../../content");
export const ARTICLES_DIR = path.join(CONTENT_DIR, "articles");

// Remote prefix on Bunny for article JSON (separate from /heroes/).
const REMOTE_PREFIX = "articles";
const INDEX_REMOTE_PATH = `${REMOTE_PREFIX}/index.json`;

const STORE_MODE = (process.env.STORE_MODE || "bunny").toLowerCase();
const LOCAL_MIRROR = (process.env.STORE_LOCAL_MIRROR || "false").toLowerCase() === "true";
const INDEX_TTL_MS = Number(process.env.INDEX_TTL_MS) || 60_000;
const BODY_CACHE_SIZE = Number(process.env.BODY_CACHE_SIZE) || 200;

let _indexCache = null;
let _indexCacheAt = 0;

// Simple LRU for article bodies.
const _bodyCache = new Map();
function lruGet(key) {
  if (!_bodyCache.has(key)) return undefined;
  const v = _bodyCache.get(key);
  _bodyCache.delete(key);
  _bodyCache.set(key, v);
  return v;
}
function lruSet(key, value) {
  if (_bodyCache.has(key)) _bodyCache.delete(key);
  _bodyCache.set(key, value);
  while (_bodyCache.size > BODY_CACHE_SIZE) {
    const first = _bodyCache.keys().next().value;
    _bodyCache.delete(first);
  }
}

export async function ensureDirs() {
  if (STORE_MODE === "local" || LOCAL_MIRROR) {
    await fs.mkdir(ARTICLES_DIR, { recursive: true });
  }
}

// ----- Read path -----

export async function readArticle(slug) {
  if (!slug) return null;
  const cached = lruGet(slug);
  if (cached !== undefined) return cached;

  if (STORE_MODE === "bunny") {
    // Read article from origin storage first to bypass pull-zone CDN cache.
    let article = await fetchJsonFromBunnyOrigin(`${REMOTE_PREFIX}/${slug}.json`).catch((e) => {
      console.error(`[store] bunny origin read failed for ${slug}, falling back:`, e.message);
      return null;
    });
    if (!article) {
      article = await fetchJsonFromBunny(`${REMOTE_PREFIX}/${slug}.json`).catch((e) => {
        console.error(`[store] bunny read failed for ${slug}:`, e.message);
        return null;
      });
    }
    if (article) lruSet(slug, article);
    return article;
  }

  // local mode
  const p = path.join(ARTICLES_DIR, `${slug}.json`);
  try {
    const raw = await fs.readFile(p, "utf8");
    const a = JSON.parse(raw);
    lruSet(slug, a);
    return a;
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

export async function getIndex({ force = false } = {}) {
  if (!force && _indexCache && Date.now() - _indexCacheAt < INDEX_TTL_MS) return _indexCache;

  let items = null;

  if (STORE_MODE === "bunny") {
    // Read index from origin storage to bypass pull-zone CDN cache.
    items = await fetchJsonFromBunnyOrigin(INDEX_REMOTE_PATH).catch((e) => {
      console.error("[store] bunny origin index read failed, falling back to pull zone:", e.message);
      return null;
    });
    if (!items) {
      items = await fetchJsonFromBunny(INDEX_REMOTE_PATH).catch((e) => {
        console.error("[store] bunny pull-zone index read failed:", e.message);
        return null;
      });
    }
  }

  if (!items) {
    // local fallback: scan files
    try {
      await fs.access(ARTICLES_DIR);
      const files = (await fs.readdir(ARTICLES_DIR)).filter((f) => f.endsWith(".json") && f !== "index.json");
      items = [];
      for (const f of files) {
        try {
          const raw = await fs.readFile(path.join(ARTICLES_DIR, f), "utf8");
          const a = JSON.parse(raw);
          items.push(indexEntryFromArticle(a));
        } catch {}
      }
    } catch {
      items = [];
    }
  }

  items.sort((a, b) => {
    if (a.status !== b.status) {
      const order = { published: 0, draft: 1, queued: 2 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    }
    return (b.publishedAt || b.queuedAt || 0) - (a.publishedAt || a.queuedAt || 0);
  });

  _indexCache = items;
  _indexCacheAt = Date.now();
  return items;
}

export async function getPublished() {
  const idx = await getIndex();
  return idx.filter((a) => a.status === "published");
}

export async function getQueued() {
  const idx = await getIndex();
  return idx.filter((a) => a.status === "queued");
}

export async function getDrafts() {
  const idx = await getIndex();
  return idx.filter((a) => a.status === "draft");
}

export async function nextQueued() {
  const q = await getQueued();
  q.sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));
  return q[0] || null;
}

// ----- Write path -----

export async function writeArticle(article) {
  if (!article || !article.slug) throw new Error("article.slug required");
  if (STORE_MODE === "bunny") {
    await uploadJsonToBunny(`${REMOTE_PREFIX}/${article.slug}.json`, article);
  }
  if (STORE_MODE === "local" || LOCAL_MIRROR) {
    await ensureDirs();
    const p = path.join(ARTICLES_DIR, `${article.slug}.json`);
    await fs.writeFile(p, JSON.stringify(article, null, 2));
  }
  lruSet(article.slug, article);
  _indexCache = null;
  return bunnyUrl(`${REMOTE_PREFIX}/${article.slug}.json`);
}

export async function deleteArticle(slug) {
  if (!slug) return false;
  if (STORE_MODE === "bunny") {
    await deleteFromBunny(`${REMOTE_PREFIX}/${slug}.json`).catch(() => {});
  }
  if (STORE_MODE === "local" || LOCAL_MIRROR) {
    try { await fs.unlink(path.join(ARTICLES_DIR, `${slug}.json`)); } catch {}
  }
  _bodyCache.delete(slug);
  _indexCache = null;
  return true;
}

// Rebuilds index.json on Bunny from the canonical articles list.
// `articles` should be the full set of article objects.
export async function rebuildIndex(articles) {
  const items = articles.map(indexEntryFromArticle);
  if (STORE_MODE === "bunny") {
    await uploadJsonToBunny(INDEX_REMOTE_PATH, items);
  }
  if (STORE_MODE === "local" || LOCAL_MIRROR) {
    await ensureDirs();
    await fs.writeFile(path.join(ARTICLES_DIR, "index.json"), JSON.stringify(items, null, 2));
  }
  _indexCache = null;
  return items;
}

export function indexEntryFromArticle(a) {
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

export function bustIndex() {
  _indexCache = null;
  _bodyCache.clear();
}

export function storeInfo() {
  return {
    mode: STORE_MODE,
    localMirror: LOCAL_MIRROR,
    indexTtlMs: INDEX_TTL_MS,
    bodyCacheSize: BODY_CACHE_SIZE,
    remotePrefix: REMOTE_PREFIX,
    indexUrl: bunnyUrl(INDEX_REMOTE_PATH),
  };
}
