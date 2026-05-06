#!/usr/bin/env node
// Expand the 30 seed topics to 500 across 10 pillars by combining angle modifiers.
// Output: src/data/topics-500.json (will be the source of truth for bulk-seed.mjs).

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const seed = JSON.parse(await fs.readFile(path.join(ROOT, "src/data/topics-30.json"), "utf8"));

// 47 angle modifiers — combined with seed (30 × 17 = 510), trimmed to 500.
const ANGLES = [
  "for first-grade parents",
  "for fifth-grade parents",
  "for middle-school parents",
  "for high-school parents",
  "for homeschoolers",
  "for charter and magnet families",
  "what teachers wish you knew",
  "what the IEP team will not tell you",
  "what the pediatrician usually misses",
  "the morning version (before school)",
  "the evening version (after school)",
  "the weekend version (recovery days)",
  "before a parent-teacher conference",
  "after a discipline referral",
  "during a transition year",
  "for a kid who masks at school",
  "for a kid who melts down only at home",
  "for a kid with a single parent",
  "for a blended-family household",
  "for the parent who is also an introvert",
  "for the parent who is an extrovert",
  "the gentle script you can read out loud",
  "the conversation to have tonight",
  "the one-page version for grandparents",
  "scripts for the IEP meeting",
  "the bedtime ritual that actually helps",
  "what to put in the school bag on hard days",
  "the supply list nobody hands you",
  "the cheat sheet for substitute teachers",
  "what to say when other parents judge",
  "for sensitive kids who refuse to talk about it",
  "for kids whose feelings show up as stomach aches",
  "for kids who freeze instead of fight",
  "the herb-and-tea version (gentle support)",
  "the supplement-and-mineral version",
  "the screen-time companion guide",
  "the sleep companion guide",
  "the food and gut companion guide",
  "twice-exceptional (2E) edition",
  "neurodivergent-affirming edition",
  "for ADHD-anxious overlap",
  "for autism-anxious overlap",
  "post-pandemic re-entry edition",
  "year-end exhaustion edition",
  "summer-break decompression edition",
  "back-to-school week edition",
  "the holidays-and-relatives edition",
];

const out = [];
const used = new Set(seed.map(t => t.slug));
for (const base of seed) {
  out.push(base);
}
outer:
for (const angle of ANGLES) {
  for (const base of seed) {
    if (out.length >= 500) break outer;
    const slug = `${base.slug}--${angle.toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80)}`;
    if (used.has(slug)) continue;
    used.add(slug);
    out.push({
      slug,
      title: `${base.title} — ${angle}`.replace(/—/g, ":"), // never em-dash in titles either
      category: base.category,
      tags: base.tags,
      angle,
    });
  }
}

// Defensive: scrub any em-dashes that snuck in
for (const t of out) {
  if (t.title.includes("—")) t.title = t.title.replace(/—/g, ":");
}

await fs.writeFile(
  path.join(ROOT, "src/data/topics-500.json"),
  JSON.stringify(out, null, 2),
);
console.log(`wrote ${out.length} topics`);
