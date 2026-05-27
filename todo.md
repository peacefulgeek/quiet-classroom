# A Quiet Classroom — TODO

## Bunny-as-source-of-truth migration (Option B)

- [ ] Refactor `src/lib/store.mjs` so `getIndex`, `readArticle`, `getPublished`, `getQueued`, `writeArticle` read/write to Bunny instead of local `content/articles/`
- [ ] Add an in-memory cache for `articles-index.json` (TTL 60s) so the homepage and `/articles` don't refetch on every hit
- [ ] Add a small per-slug LRU cache (size 200) for full article bodies
- [ ] Keep a local-file fallback path so `pnpm dev` still works without Bunny credentials
- [ ] Write `scripts/upload-articles-to-bunny.mjs` that uploads all 500 `content/articles/*.json` plus a built `articles-index.json` to `https://quiet-classroom.b-cdn.net/articles/`
- [ ] After upload, verify a sample article and the index are both fetchable over public Bunny pull URL
- [ ] Add `content/articles/` to `.gitignore` and `git rm -r --cached content/articles/` so git stops tracking them
- [ ] Update `scripts/run-pending-batch.mjs` and `scripts/post-process-articles.mjs` and `scripts/generate-heroes.mjs` to read/write through the new store

## Env-var schema sync to Railway spec

- [ ] Rename `AMAZON_AFFIL_TAG` -> `AMAZON_TAG` everywhere in source
- [ ] Default `OPENAI_MODEL` to `deepseek-v4-pro` (was `deepseek-v4-flash`)
- [ ] Wire `FAL_KEY` env var into hero generator (real photo heroes via FAL)
- [ ] Document `JWT_SECRET` (reserved for future auth) and `GH_PAT` (used by deploy scripts only)
- [ ] Update `DEPLOY-RAILWAY.md` env-var table to match exactly

## Verify

- [ ] Smoke-test all 11 routes locally with Bunny-backed store
- [ ] Em-dash sweep across 100 published article pages
- [ ] Confirm zero references to `AMAZON_AFFIL_TAG`, `deepseek-v4-flash`, or local `content/articles/` paths in source

## Deliver

- [ ] Commit and push to peacefulgeek/quiet-classroom
- [ ] Verify HEAD matches GitHub

## Hero redesign + design polish (session 2026-05-27)

- [ ] Kill the "bubble" art entirely — no abstract shapes, no generic colored blobs
- [ ] Generate one **unique photo-real hero** per article (500 total), keyed to the article's actual subject (introvert child reading, parent and child at kitchen table, classroom corner with one quiet kid, etc.)
- [ ] Encode every hero as **WebP** at ~1600x900 / quality 82
- [ ] Upload every hero to Bunny at `heroes/{slug}.webp` (no Manus CDN)
- [ ] Rebuild Bunny `articles/index.json` so every entry has `heroUrl = https://quiet-classroom.b-cdn.net/heroes/{slug}.webp`
- [ ] Article body JSON also stores the same `heroUrl`
- [ ] Update card / detail / home templates to display heroes warmly (16:9, soft inner shadow, no bubble fallback)
- [ ] Remove any remaining bubble/SVG-blob fallback code
- [ ] Confirm no 100-article cap is left (already done in commit `0ae752a`, re-verify)
- [ ] Smoke test all routes against Bunny-backed server with the new heroes
- [ ] Commit + push to `peacefulgeek/quiet-classroom`


## 2026-05-27 PM — full live-site rescue pass

- [ ] Diagnose what aquietclassroom.com is actually serving (commit, hero source, TL;DR markup, byline)
- [ ] Rewrite home page as ~800-word warm essay with curated jump-offs to articles / herbs / assessments
- [ ] Fix `/articles` grid: clean cards, no leading literal `*TL;DR:` text, no underlined card titles, real Bunny photo heroes
- [ ] Strip orphan `*TL;DR:` markdown asterisks across all 500 article JSON files
- [ ] Fix bylines: replace any "Oracle Lover"/cross-site garbage with a clean A Quiet Classroom byline (no broken avatars)
- [ ] Audit prose: no weird chars, no broken paragraphs, no truncated sentences, no nested bullet rot
- [ ] Bring article bodies to 1800-2500 words (regenerate where shorter), keep tone warm and encouraging
- [ ] Audit hero uniqueness via perceptual hash; regenerate any duplicates
- [ ] Build / repair Herbs & Supplements page: 100-200 entries with triple-verified Amazon ASINs, tag=spankyspinola-20
- [ ] Confirm content store is JSON-on-Bunny only; no DB, no Manus dependency in production
- [ ] Confirm cron fires with no cap; 30-100 published, 400+ gated; top up if not enough
- [ ] Push to peacefulgeek/quiet-classroom and prompt user to redeploy on Railway
- [ ] 10x end-to-end live-domain verification with curls + screenshots + final report


## 2026-05-27 PM2 — make-it-perfect pass (long-running)

- [ ] Expand all 475 short articles to 1800-2500 words via forge LLM (warm, well-formatted, byline-ready)
- [ ] Fix the ~50 articles that have effectively empty bodies
- [ ] Re-upload expanded JSON to Bunny + rebuild master index
- [ ] Hero uniqueness audit (perceptual hash); regen duplicates
- [ ] Herbs & Supplements page: 100-200 entries with triple-verified Amazon ASINs (tag=spankyspinola-20)
- [ ] Confirm JSON-on-Bunny only; no DB, no Manus dependencies
- [ ] Confirm crons fire with no cap; 30-100 published, 400+ gated
- [ ] Push final state to peacefulgeek/quiet-classroom
- [ ] 10x end-to-end live-domain verification + final report
