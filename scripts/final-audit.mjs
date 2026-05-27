#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

import { getIndex, readArticle, storeInfo } from "../src/lib/store.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = async (p) => JSON.parse(await fs.readFile(path.join(ROOT, p), "utf8"));

const info = storeInfo();
console.log(`store: mode=${info.mode} index=${info.indexUrl}`);

const index = await getIndex({ force: true });
let pub = 0,
  q = 0,
  draft = 0;
let totalWords = 0;
let warnCount = 0;
let missingHero = 0;
for (const entry of index) {
  if (entry.status === "published") pub++;
  else if (entry.status === "draft") draft++;
  else if (entry.status === "queued") q++;
  if (entry.status === "published" || entry.status === "draft") {
    const a = await readArticle(entry.slug);
    if (a) {
      if (a.status === "published") totalWords += (a.body || "").split(/\s+/).length;
      if (a.qualityWarnings) warnCount++;
      if (!a.heroUrl) missingHero++;
    }
  }
}

const herbs = await read("src/data/herbs-catalog.json");
const assessments = await read("src/data/assessments.json");
const asin = await read("src/data/asin-catalog.json");
const topics = await read("src/data/topics-500.json");

const asinCount = Object.values(asin).reduce(
  (s, v) => s + (Array.isArray(v) ? v.length : 0),
  0
);

console.log(
  `articles: total=${index.length} published=${pub} draft=${draft} queued=${q}`
);
console.log(`avg words per published: ${Math.round(totalWords / Math.max(pub, 1))}`);
console.log(`articles with quality warnings: ${warnCount}`);
console.log(`articles missing heroUrl: ${missingHero}`);
console.log(
  `herbs catalog: ${Array.isArray(herbs) ? herbs.length : Object.keys(herbs).length}`
);
console.log(
  `assessments: ${Array.isArray(assessments) ? assessments.length : Object.keys(assessments).length}`
);
console.log(`asin catalog entries: ${asinCount}`);
console.log(
  `topics: ${Array.isArray(topics) ? topics.length : Object.keys(topics).length}`
);
