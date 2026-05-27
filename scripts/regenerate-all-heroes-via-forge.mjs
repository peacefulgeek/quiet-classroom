#!/usr/bin/env node
// Drives the Manus forge ImageService to generate one unique 1600x900 WebP
// hero per article, uploads it to Bunny at heroes/{slug}.webp, writes
// heroUrl/ogImage/heroAlt back into each article JSON on Bunny, and rebuilds
// the master index when finished.
//
// Resumable: a ledger at /tmp/hero-forge-done.json tracks slugs already done.
// Run again to retry only failed/missing.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import sharp from "sharp";
import { uploadRawToBunny } from "../src/lib/bunny.mjs";

// Tiny inline concurrency limiter (replaces p-limit)
function pLimit(n) {
  let active = 0; const q = [];
  const next = () => { if (active >= n || q.length === 0) return; const job = q.shift(); active++; job(); };
  return (fn) => new Promise((resolve, reject) => {
    const run = () => Promise.resolve().then(fn).then(
      v => { active--; resolve(v); next(); },
      e => { active--; reject(e); next(); }
    );
    q.push(run); next();
  });
}
import { readArticle, writeArticle, getIndex, rebuildIndex, bustIndex } from "../src/lib/store.mjs";

const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL || "https://forge.manus.ai";
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;
if (!FORGE_KEY) { console.error("BUILT_IN_FORGE_API_KEY missing"); process.exit(1); }

const PROMPTS_FILE = "/tmp/hero-prompts.json";
const LEDGER = "/tmp/hero-forge-done.json";
const FAIL_LOG = "/tmp/hero-forge-fail.json";
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "3", 10);
const LIMIT_TO = parseInt(process.env.LIMIT || "0", 10) || null;
const ONLY = (process.env.ONLY || "").split(",").map(s => s.trim()).filter(Boolean);
const FORCE = process.env.FORCE === "1";

function loadJSON(p, fallback) { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; } }
function saveJSON(p, x) { writeFileSync(p, JSON.stringify(x, null, 2)); }

const prompts = loadJSON(PROMPTS_FILE, []);
const done = loadJSON(LEDGER, {});
const fails = loadJSON(FAIL_LOG, {});

const url = new URL("images.v1.ImageService/GenerateImage", FORGE_URL.endsWith("/") ? FORGE_URL : FORGE_URL + "/").toString();

async function withRetry(fn, label, attempts = 4, baseDelay = 1500) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const wait = baseDelay * Math.pow(2, i) + Math.random() * 500;
      if (i < attempts - 1) {
        console.warn(`  retry ${i+1}/${attempts} ${label}: ${e.message} (sleep ${Math.round(wait)}ms)`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

async function forgeGenerate(prompt) {
  return withRetry(async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "connect-protocol-version": "1",
        authorization: `Bearer ${FORGE_KEY}`,
      },
      body: JSON.stringify({ prompt, original_images: [] }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`forge ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!data?.image?.b64Json) throw new Error("forge: no image in response");
    return Buffer.from(data.image.b64Json, "base64");
  }, "forge.GenerateImage");
}

async function processOne(entry) {
  const { slug, prompt, alt } = entry;
  if (ONLY.length && !ONLY.includes(slug)) return { slug, status: "skipped" };
  if (!FORCE && done[slug]) return { slug, status: "cached" };

  // 1. Generate via forge
  const png = await forgeGenerate(prompt);

  // 2. Encode to 1600x900 WebP
  const webp = await sharp(png).resize(1600, 900, { fit: "cover" }).webp({ quality: 82 }).toBuffer();

  // 3. Upload to Bunny (with retry)
  const heroUrl = await withRetry(
    () => uploadRawToBunny(`heroes/${slug}.webp`, webp, "image/webp"),
    `bunny.upload heroes/${slug}.webp`
  );

  // 4. Update article JSON on Bunny (with retry)
  await withRetry(async () => {
    const article = await readArticle(slug);
    if (article) {
      article.heroUrl = heroUrl;
      article.ogImage = heroUrl;
      if (alt) article.heroAlt = alt;
      article.dateModified = Date.now();
      await writeArticle(article);
    }
  }, `update article ${slug}`);

  done[slug] = { heroUrl, ts: Date.now() };
  delete fails[slug];
  return { slug, status: "ok", heroUrl, bytes: webp.length };
}

async function main() {
  let queue = prompts.slice();
  if (LIMIT_TO) queue = queue.slice(0, LIMIT_TO);
  if (!FORCE) queue = queue.filter(e => !done[e.slug]);
  console.log(`[hero-forge] total ${prompts.length}, queue ${queue.length}, concurrency ${CONCURRENCY}, force=${FORCE}`);

  const limit = pLimit(CONCURRENCY);
  let okCount = 0, failCount = 0, processedCount = 0;
  const t0 = Date.now();

  const tasks = queue.map(entry => limit(async () => {
    try {
      const r = await processOne(entry);
      if (r.status === "ok") okCount++;
      processedCount++;
      if (processedCount % 5 === 0 || r.status === "ok") {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(`  [${processedCount}/${queue.length}] ok=${okCount} fail=${failCount} ${entry.slug} (${elapsed}s)`);
      }
      // checkpoint ledger every 5
      if (okCount % 5 === 0) saveJSON(LEDGER, done);
    } catch (e) {
      failCount++;
      processedCount++;
      fails[entry.slug] = { msg: e.message, ts: Date.now() };
      saveJSON(FAIL_LOG, fails);
      console.error(`  [fail ${processedCount}/${queue.length}] ${entry.slug}: ${e.message}`);
    }
  }));

  await Promise.all(tasks);
  saveJSON(LEDGER, done);

  console.log(`[hero-forge] complete: ok=${okCount} fail=${failCount} elapsed=${((Date.now()-t0)/1000).toFixed(0)}s`);

  if (process.env.SKIP_INDEX === "1") {
    console.log("[hero-forge] SKIP_INDEX=1, leaving index rebuild for separate run");
    return;
  }
  // Rebuild master index, with retry
  console.log("[hero-forge] rebuilding index...");
  await withRetry(async () => {
    bustIndex();
    const fresh = await getIndex({ force: true });
    const merged = await Promise.all(fresh.map(async e => (await readArticle(e.slug)) || e));
    await rebuildIndex(merged);
  }, "rebuildIndex", 6, 3000);
  console.log("[hero-forge] index rebuilt");
}

main().catch(e => { console.error("fatal:", e); process.exit(1); });
