#!/usr/bin/env node
// Generate gradient SVG heroes per article (palette-driven, slug-hashed),
// rasterize to WebP at 1600x900, upload to Bunny under /heroes/{slug}.webp,
// then write the resulting URL back to each article JSON.
//
// Usage:
//   node scripts/generate-heroes.mjs                 # all published, missing hero
//   FORCE=1 node scripts/generate-heroes.mjs         # rebuild every hero
//   ONLY=slug-a,slug-b node scripts/generate-heroes.mjs

import { createHash } from "node:crypto";
import sharp from "sharp";

import { uploadRawToBunny } from "../src/lib/bunny.mjs";
import { getIndex, readArticle, writeArticle, rebuildIndex, bustIndex } from "../src/lib/store.mjs";

// Periwinkle, soft blue, mauve, dusty teal, cream, sage. Calm palette.
const PALETTES = [
  ["#dde3f5", "#9aabd1", "#4a5b8a"],
  ["#e9e1f2", "#bca6d6", "#6e548e"],
  ["#dceee7", "#86b9a8", "#3d6e62"],
  ["#f2e4d8", "#d3a279", "#7a4d2c"],
  ["#e3eaf0", "#88a4b9", "#3a566a"],
  ["#f0e3e6", "#c89aa1", "#7a4a55"],
];

function hashIndex(slug, mod) {
  const h = createHash("sha1").update(slug).digest("hex");
  return parseInt(h.slice(0, 8), 16) % mod;
}

function svgFor(slug, title, category) {
  const p = PALETTES[hashIndex(slug, PALETTES.length)];
  const angle = (hashIndex(slug + "a", 360));
  const W = 1600, H = 900;
  // Big soft gradient + a subtle title overlay (no text rendering required since
  // the SSR layout already shows the title; the image is decorative).
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${p[0]}"/>
      <stop offset="55%" stop-color="${p[1]}"/>
      <stop offset="100%" stop-color="${p[2]}"/>
    </linearGradient>
    <radialGradient id="r" cx="30%" cy="30%" r="80%">
      <stop offset="0%" stop-color="${p[0]}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${p[2]}" stop-opacity="0.05"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#r)"/>
  <circle cx="${W * 0.78}" cy="${H * 0.72}" r="220" fill="${p[0]}" opacity="0.18"/>
  <circle cx="${W * 0.18}" cy="${H * 0.22}" r="160" fill="${p[2]}" opacity="0.10"/>
  <text x="60" y="${H - 60}" font-family="Georgia, serif" font-size="22" fill="${p[2]}" opacity="0.55">A Quiet Classroom &#183; ${escape(category || "")}</text>
</svg>`;
}

function escape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const FORCE = process.env.FORCE === "1";
const ONLY = (process.env.ONLY || "").split(",").map(s => s.trim()).filter(Boolean);

const index = await getIndex({ force: true });
let ok = 0, skipped = 0, fail = 0;

for (const entry of index) {
  if (ONLY.length && !ONLY.includes(entry.slug)) continue;
  if (entry.status !== "published" && entry.status !== "draft" && !FORCE) continue;
  if (entry.heroUrl && entry.heroUrl.includes("quiet-classroom.b-cdn.net") && !FORCE) {
    skipped++;
    continue;
  }
  const a = await readArticle(entry.slug);
  if (!a) { fail++; continue; }
  try {
    const svg = svgFor(a.slug, a.title, a.category);
    const webp = await sharp(Buffer.from(svg)).resize(1600, 900).webp({ quality: 82 }).toBuffer();
    const url = await uploadRawToBunny(`heroes/${a.slug}.webp`, webp, "image/webp");
    a.heroUrl = url;
    a.heroAlt = `${a.title}. Calm gradient hero for A Quiet Classroom.`;
    a.dateModified = Date.now();
    await writeArticle(a);
    ok++;
    if (ok % 25 === 0) console.log(`  uploaded ${ok} so far`);
  } catch (e) {
    fail++;
    console.error(`fail ${a.slug}: ${e.message}`);
  }
}

// Rebuild master index so new heroUrls show up in /articles, sitemaps, RSS
bustIndex();
const fresh = await getIndex({ force: true });
await rebuildIndex(
  await Promise.all(fresh.map(async (e) => (await readArticle(e.slug)) || e))
);
console.log(`\nheroes: ok=${ok} skipped=${skipped} fail=${fail}`);
