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


## 2026-05-28 — BacklinkWebsites Final Pass scope

Status legend at delivery: FIXED / VERIFIED
 ALREADY GOOD / BLOCKED

### Engine swap to Claude
- [ ] Store CLAUDE_API_KEY in Railway secrets
- [ ] Build Claude client targeting model `claude-sonnet-4-6`
- [ ] Switch all article generation, rewrites, refresh crons to Claude

### Quality gate
- [ ] Banned-words rejection (delve, tapestry, paradigm, synergy, leverage, unlock, empower, utilize, pivotal, embark, underscore, paramount, seamlessly, robust, beacon, foster, elevate, curate, curated, bespoke, resonate, harness, intricate, plethora, myriad, comprehensive, transformative, groundbreaking, innovative, cutting-edge, revolutionary, state-of-the-art, ever-evolving, profound, holistic, nuanced, multifaceted, stakeholders, ecosystem, landscape, realm, sphere, domain, furthermore, moreover, additionally, consequently, subsequently, thereby, streamline, optimize, facilitate, amplify, catalyze)
- [ ] Banned-phrases rejection ("it's important to note," "in conclusion," "in summary," "in the realm of," "dive deep into," "at the end of the day," "in today's fast-paced world," "plays a crucial role," "a testament to," "when it comes to," "cannot be overstated," "needless to say," "first and foremost," "last but not least.")
- [ ] No em-dashes anywhere; only " - "
- [ ] Contractions throughout, varied sentence length
- [ ] >=2 conversational openers per article
- [ ] First-person OR direct-address (commit one)
- [ ] Concrete-specifics check

### E-E-A-T (every published article)
- [ ] 3-sentence TL/DR in `<section data-tldr="ai-overview" aria-label="In short">` (each <=32 words, declarative, no questions)
- [ ] First-hand experience phrasing in body
- [ ] >=3 internal links varied anchor text in prose
- [ ] >=1 outbound link to authoritative source with rel="nofollow noopener" target="_blank"
- [ ] Visible last-updated date in byline with `<time datetime>`
- [ ] Author byline at bottom: credential + datetime + 1-2 sentences warm topical self-ref

### AEO and JSON-LD
- [ ] Canonical with UTM/fbclid/gclid/mc_eid stripped on every public page
- [ ] Robots meta `index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1`
- [ ] OG and Twitter card meta complete on every page
- [ ] Article JSON-LD with all listed fields including SpeakableSpecification -> TL/DR
- [ ] BreadcrumbList JSON-LD per article
- [ ] FAQPage JSON-LD auto from Q-shaped headings (cap 6, only when real)
- [ ] HowTo JSON-LD when ordered list of steps (mutually exclusive with MedicalCondition)
- [ ] WebSite JSON-LD + SearchAction on homepage
- [ ] Organization JSON-LD sitewide
- [ ] AboutPage and Organization on /about
- [ ] CollectionPage and ItemList on /articles
- [ ] Person JSON-LD for author with sameAs to intermediary site
- [ ] /sitemap.xml ISO-8601 newest-first published only
- [ ] /robots.txt with all AI crawlers allowed; advertise sitemap and llms files
- [ ] /llms.txt markdown index grouped by category
- [ ] /llms-full.txt full-corpus plain text frontmatter-delimited
- [ ] SSR head verified via curl with GPTBot UA

### Bunny-only article storage
- [ ] Articles stored at `/articles/{slug}.json` on Bunny
- [ ] DB has only metadata + bunny_url (no body)
- [ ] All read paths fetch body from Bunny
- [ ] Sitemap, llms.txt, llms-full.txt, public routes all fetch from Bunny

### Counts and dates
- [ ] DB shows 30-100 published, 400-500 queued (top up via Claude + gate if short)
- [ ] Backdate every published article: published_at randomized across prior 3 months

### Refresh cron (quarterly)
- [ ] Rewrite via Claude -> gate -> on pass: update Bunny body + byline date + dateModified
- [ ] On fail: keep body, only bump timestamp

### Bylines
- [ ] Every published article has warm topical byline (credential + datetime + 1-2 topical sentences)

### Leakage and integrations
- [ ] No Paul Wagner / paulwagner.com anywhere
- [ ] Intermediary-site Person.url robust
- [ ] Remove SOVRN code (GROW present or coming)
- [ ] Newsletter signup writes to JSON file on Bunny

### Validation
- [ ] Schema.org validator pass
- [ ] curl -I /llms.txt -> 200 + text/markdown
- [ ] curl with GPTBot UA -> full head before React shell
- [ ] /sitemap.xml -> 200, published only
- [ ] /robots.txt names all AI crawlers

### Push
- [ ] Delete any zips from repo
- [ ] Push using github-push-workflow skill
