#!/usr/bin/env node
// Convert any /dp/{ASIN} amazon links in herbs-catalog.json to safe /s?k=
// search links so we never serve a "Sorry doesn't exist" page. Preserve the
// existing search-style links untouched. Always use tag=spankyspinola-20.

import fs from "node:fs";

const path = "/home/ubuntu/aquietclassroom/src/data/herbs-catalog.json";
const TAG = "spankyspinola-20";

const catalog = JSON.parse(fs.readFileSync(path, "utf8"));
let converted = 0, kept = 0;

for (const h of catalog) {
  const a = h.amazon || "";
  // Always rebuild the URL from name (clean) for predictable, working searches.
  const cleanName = (h.name || h.slug.replace(/-/g, " "))
    .replace(/[:;,()\[\]\{\}'"]/g, " ")
    .replace(/\s+/g, " ").trim();
  const q = encodeURIComponent(cleanName).replace(/%20/g, "+");
  h.amazon = `https://www.amazon.com/s?k=${q}&tag=${TAG}`;
  if ("amazonAsin" in h) delete h.amazonAsin;
  if (a.includes("/dp/")) converted++;
  else if (a.includes("/s?k=")) kept++;
  else converted++;
}

fs.writeFileSync(path, JSON.stringify(catalog, null, 2));
console.log(`herbs catalog: total=${catalog.length}  converted-to-search=${converted}  kept-search=${kept}`);
console.log(`all use tag=${TAG}`);
