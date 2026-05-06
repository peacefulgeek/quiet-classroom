#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = async p => JSON.parse(await fs.readFile(path.join(ROOT, p), "utf8"));

const articles = (await fs.readdir(path.join(ROOT, "content/articles"))).filter(f => f.endsWith(".json"));
let pub = 0, q = 0;
let totalWords = 0;
let warnCount = 0;
for (const f of articles) {
  const a = JSON.parse(await fs.readFile(path.join(ROOT, "content/articles", f), "utf8"));
  if (a.status === "published") {
    pub++;
    totalWords += (a.body || "").split(/\s+/).length;
    if (a.qualityWarnings) warnCount++;
  } else if (a.status === "queued") q++;
}

const herbs = await read("src/data/herbs-catalog.json");
const assessments = await read("src/data/assessments.json");
const asin = await read("src/data/asin-catalog.json");
const topics = await read("src/data/topics-500.json");

const asinCount = Object.values(asin).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);

console.log(`articles: total=${articles.length} published=${pub} queued=${q}`);
console.log(`avg words per published: ${Math.round(totalWords / Math.max(pub, 1))}`);
console.log(`articles with quality warnings: ${warnCount}`);
console.log(`herbs catalog: ${Array.isArray(herbs) ? herbs.length : Object.keys(herbs).length}`);
console.log(`assessments: ${Array.isArray(assessments) ? assessments.length : Object.keys(assessments).length}`);
console.log(`asin catalog entries: ${asinCount}`);
console.log(`topics: ${Array.isArray(topics) ? topics.length : Object.keys(topics).length}`);
