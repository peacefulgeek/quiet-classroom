#!/usr/bin/env node
// Walk content/heroes-png/*.png, encode each to 1600x900 WebP at q=82, upload
// to Bunny under heroes/{slug}.webp, and write heroUrl + heroAlt back into the
// matching article JSON (Bunny). Then rebuild articles/index.json.
//
// Idempotent: keeps a small ledger at /tmp/hero-sync-done.json so it does not
// re-upload images that have already been uploaded in this session unless
// FORCE=1 is set.

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { uploadRawToBunny } from "../src/lib/bunny.mjs";
import { readArticle, writeArticle, getIndex, rebuildIndex, bustIndex } from "../src/lib/store.mjs";

const PNG_DIR = "/home/ubuntu/aquietclassroom/content/heroes-png";
const PROMPT_DIR = "/home/ubuntu/aquietclassroom/content/hero-prompts";
const LEDGER = "/tmp/hero-sync-done.json";
const FORCE = process.env.FORCE === "1";

const done = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : {};

const files = readdirSync(PNG_DIR).filter(f => f.endsWith(".png"));
console.log(`found ${files.length} png(s) in ${PNG_DIR}`);

let ok = 0, skipped = 0, fail = 0;

for (const f of files) {
  const slug = f.replace(/\.png$/, "");
  if (!FORCE && done[slug]) { skipped++; continue; }
  const pngPath = `${PNG_DIR}/${f}`;
  try {
    const png = readFileSync(pngPath);
    const webp = await sharp(png).resize(1600, 900, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
    const heroUrl = await uploadRawToBunny(`heroes/${slug}.webp`, webp, "image/webp");

    // pull alt text from prompt file if available
    let alt = "";
    try {
      const txt = readFileSync(`${PROMPT_DIR}/${slug}.txt`, "utf8");
      const m = txt.split("\n---\n");
      if (m[1]) alt = m[1].trim();
    } catch {}

    const article = await readArticle(slug);
    if (article) {
      article.heroUrl = heroUrl;
      article.ogImage = heroUrl;
      if (alt) article.heroAlt = alt;
      article.dateModified = Date.now();
      await writeArticle(article);
    } else {
      console.warn(`  no article json for ${slug} — uploaded image only`);
    }

    done[slug] = { heroUrl, ts: Date.now() };
    writeFileSync(LEDGER, JSON.stringify(done, null, 2));
    ok++;
    if (ok % 10 === 0) console.log(`  synced ${ok} so far`);
  } catch (e) {
    fail++;
    console.error(`fail ${slug}: ${e.message}`);
  }
}

console.log(`heroes synced: ok=${ok} skipped=${skipped} fail=${fail}`);

// Rebuild master index so /articles, sitemap, RSS pick up new heroUrls
console.log("rebuilding index...");
bustIndex();
const fresh = await getIndex({ force: true });
const full = await Promise.all(fresh.map(async e => (await readArticle(e.slug)) || e));
await rebuildIndex(full);
console.log("index rebuilt");
