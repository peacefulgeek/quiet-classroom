# A Quiet Classroom

For parents of introverted, anxious, and highly sensitive school-age children. Written by The Oracle Lover.

Public site: https://aquietclassroom.com

## Stack

| Layer | What it is |
|---|---|
| Runtime | Node 22, Express 4, plain server-side rendering with template literals |
| Storage | JSON files under `content/` (no database) |
| Images | Bunny CDN pull zone `quiet-classroom.b-cdn.net` |
| Writing | DeepSeek V4 Flash via OpenAI-compatible API |
| Compression | sharp for WebP rasterization |
| Cron | node-cron, runs in-process inside Express |
| Hosting target | Any Node 22 host. DigitalOcean App Platform spec lives in `.do/app.yaml`. |

There are no Manus dependencies anywhere in this codebase.

## Getting started

```bash
pnpm install
node src/server/index.mjs
```

Open http://localhost:3000.

## Content

| Surface | Source |
|---|---|
| Articles | `content/articles/*.json` (one file per article, with `body` in Markdown) |
| Herbs / TCM / supplements | `src/data/herbs.json` (210 entries) |
| Assessments | `src/data/assessments.json` (9) |
| ASIN catalog | `src/data/asin-catalog.json` |
| Topic queue | `src/data/topics-500.json` |

## Generating articles

```bash
# Generate the next N queued articles in 5 parallel workers, mark published
CONCURRENCY=5 BATCH_SIZE=10 node scripts/run-pending-batch.mjs

# Strip em-dashes, swap banned words, resolve [INTERNAL: ...] placeholders
node scripts/post-process-articles.mjs

# Render gradient hero placeholders, upload to Bunny, write heroUrl back
node scripts/generate-heroes.mjs
```

## Layout

```
content/articles/         per-article JSON
src/data/                 herbs, assessments, ASIN catalog, topic queue
src/lib/                  bunny, deepseek, store, quality-gate, markdown, site
src/server/               express server, page renderers, feeds (sitemap, rss, llms, ai)
client/public/            static favicon and CSS
scripts/                  generators, hero pipeline, post-process, audit
.do/app.yaml              DigitalOcean App Platform spec
```

## Voice rules (hard)

- No em-dashes anywhere. Use commas, colons, parentheses.
- Banned vocabulary list lives in `src/lib/quality-gate.mjs`.
- Every article ends with the line `*Sat Chit Ananda.*`.
- 1,800-2,400 words target, 1,500 hard floor (some legacy articles in the 1,200-1,500 range will be regenerated in the next batch).

## License

Content copyright The Oracle Lover. Code MIT.
