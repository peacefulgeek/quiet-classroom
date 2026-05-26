#!/usr/bin/env node
// Generate gradient SVG heroes per article (palette-driven, slug-hashed),
// rasterize to WebP at 1600x900, upload to Bunny under /heroes/{slug}.webp,
// then write the resulting URL back to each article JSON.
//
// Usage:
//   node scripts/generate-heroes.mjs                 # all published, missing hero
//   FORCE=1 node scripts/generate-heroes.mjs         # rebuild every hero
//   ONLY=slug-a,slug-b node scripts/generate-heroes.mjs

import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

import { uploadRawToBunny } from "../src/lib/bunny.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ARTICLES_DIR = path.join(ROOT, "content/articles");

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

const files = (await fs.readdir(ARTICLES_DIR)).filter(f => f.endsWith(".json"));
let ok = 0, skipped = 0, fail = 0;

for (const f of files) {
  const fp = path.join(ARTICLES_DIR, f);
  const a = JSON.parse(await fs.readFile(fp, "utf8"));
  if (ONLY.length && !ONLY.includes(a.slug)) continue;
  if (a.status !== "published" && a.status !== "draft" && !FORCE) continue;
  if (a.heroUrl && a.heroUrl.includes("quiet-classroom.b-cdn.net") && !FORCE) {
    skipped++;
    continue;
  }
  try {
    const svg = svgFor(a.slug, a.title, a.category);
    const webp = await sharp(Buffer.from(svg)).resize(1600, 900).webp({ quality: 82 }).toBuffer();
    const url = await uploadRawToBunny(`heroes/${a.slug}.webp`, webp, "image/webp");
    a.heroUrl = url;
    a.heroAlt = `${a.title}. Calm gradient hero for A Quiet Classroom.`;
    a.dateModified = Date.now();
    await fs.writeFile(fp, JSON.stringify(a, null, 2));
    ok++;
    console.log(`ok ${a.slug} -> ${url}`);
  } catch (e) {
    fail++;
    console.error(`fail ${a.slug}: ${e.message}`);
  }
}

console.log(`\nheroes: ok=${ok} skipped=${skipped} fail=${fail}`);
