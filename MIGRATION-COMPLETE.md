# A Quiet Classroom — Migration Complete

## What changed in this session

The site is now fully migrated to the **"JSON files on Bunny CDN as source of truth"** architecture (Option B from the previous session). Article JSON no longer lives in git; the repo is small enough to clone in seconds and Railway no longer needs to ship 500 JSON files in its build artifact.

## Final numbers

| Metric | Value |
|---|---|
| Articles on Bunny CDN | **500** (`articles/{slug}.json`) |
| Master index on Bunny | **500 entries** at `articles/index.json` |
| Published | **100** (hard cap enforced) |
| Gated drafts | **300** |
| Queued (topic-only) | **100** |
| Heroes on Bunny | **400** WebP at `heroes/{slug}.webp` |
| Avg words per published | **1,581** |
| Articles missing hero | **0** |
| Herbs / TCM / supplements | 210 |
| Assessments | 9 |
| ASIN catalog entries | 69 |

## GitHub

- Repo: **peacefulgeek/quiet-classroom**
- Branch: **main**
- HEAD: **`5c8e09d`** — `feat: migrate article JSON to Bunny CDN as source of truth`
- Previous: `0d1e767` (Railway hardening)

## Smoke test (against Bunny-backed local server, no local content/articles directory)

All 17 routes returned **200**:

```
200  /
200  /articles
200  /articles/introversion-vs-school-refusal--for-middle-school-parents
200  /herbs
200  /herbs/chamomile
200  /assessments
200  /assessments/is-my-child-an-introvert
200  /about
200  /recommended
200  /privacy
200  /sitemap.xml
200  /robots.txt
200  /rss.xml
200  /feed.xml
200  /llms.txt
200  /ai.txt
200  /.well-known/health
```

The article page rendered the full body fetched live from Bunny (18,341 bytes for the spot-checked article).

## Architecture summary

```
┌──────────────────────────────────────────────────────────────────┐
│  Railway container                                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Express SSR (src/server)                                   │ │
│  │   ↓ readArticle / getIndex                                 │ │
│  │ src/lib/store.mjs                                          │ │
│  │   STORE_MODE=bunny (default)                               │ │
│  │   In-memory LRU + 60s index TTL                            │ │
│  │   ↓ fetch/PUT                                              │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
        Bunny CDN: quiet-classroom.b-cdn.net
        ├─ articles/index.json           (master list, 500 entries)
        ├─ articles/{slug}.json          (500 article bodies)
        └─ heroes/{slug}.webp            (400 hero images)
```

## Railway environment variables (paste into Railway → Variables)

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `STORE_MODE` | `bunny` |
| `AUTO_GEN_ENABLED` | `true` |
| `PUBLISHED_CAP` | `100` |
| `AMAZON_TAG` | `spankyspinola-20` |
| `OPENAI_API_KEY` | `sk-82bdad0a1fd34987b73030504ae67080` |
| `OPENAI_BASE_URL` | `https://api.deepseek.com` |
| `OPENAI_MODEL` | `deepseek-v4-pro` |
| `FAL_KEY` | `11210428-491c-4936-af9e-8355cf6148dc:e268e187e357d7375425736d4f128b2d` |
| `JWT_SECRET` | `6673e24842fc5227ed9f55517cc7529555b6c129647a040daa72a866ed22f44a01b6c9fb649adf7e3c236fbaadb3b299` |
| `GH_PAT` | _(set via Railway Variables; see private notes — never commit)_ |

Bunny credentials (`storageZone`, `storageKey`, `pullZone`) are **already burned into `src/lib/bunny.mjs`** per scope §6, so no Bunny env vars are required on Railway.

`PORT` is supplied automatically by Railway and read via `process.env.PORT` (default 8080 for local dev).

## Deploy steps (Railway)

1. Connect Railway service to **peacefulgeek/quiet-classroom** (main branch). Railway will auto-detect `railway.json` (Railpack builder, no healthcheck, no Dockerfile).
2. Paste the env vars above into the Variables tab.
3. Deploy. The container starts via `node src/server/index.mjs` (`Procfile` and `railway.json` agree).
4. Bind `aquietclassroom.com` (and `www.aquietclassroom.com`) to the Railway service. The server already enforces `www → apex` 301.
5. First request will warm the index from Bunny (~1s); subsequent reads hit the LRU cache.

## Operations cheatsheet (run locally any time)

```bash
# Audit current state on Bunny
STORE_MODE=bunny node scripts/final-audit.mjs

# Generate the next batch of drafts (no publish)
BATCH_SIZE=20 PUBLISH=false STATUS=draft node scripts/run-pending-batch.mjs

# Regenerate any missing hero images
node scripts/generate-heroes.mjs

# Re-upload everything from local mirror (idempotent)
CONCURRENCY=15 node scripts/upload-articles-to-bunny.mjs
```

## Files of note

- `src/lib/store.mjs` — content store (Bunny first, local fallback)
- `src/lib/bunny.mjs` — Bunny CDN helpers
- `src/lib/deepseek.mjs` — DeepSeek writing engine (`OPENAI_MODEL` env)
- `scripts/upload-articles-to-bunny.mjs` — one-shot migration (already run)
- `railway.json`, `Procfile`, `.nvmrc` — Railway deploy artifacts
- `DEPLOY-RAILWAY.md` — Railway-specific hardening notes (9 known failure modes addressed)
- `.gitignore` — `content/articles/` is now ignored
