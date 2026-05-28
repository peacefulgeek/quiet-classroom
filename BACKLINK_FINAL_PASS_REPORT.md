# BacklinkWebsites Final Pass — Delivery Report

**Site:** [aquietclassroom.com](https://aquietclassroom.com)
**GitHub:** `peacefulgeek/quiet-classroom@main` — commit `56a4a42`
**Live validation:** 7/7 PASS (`scripts/validate-final-pass.mjs`)

## Scope items, one line each

| # | Item | Status |
|---|---|---|
| 1 | Writing engine swap → Claude `claude-sonnet-4-6` (Anthropic Messages API, raw fetch, no SDK) | **FIXED** — `src/lib/claude.mjs` |
| 2 | `CLAUDE_API_KEY` env wiring (server reads from `process.env.CLAUDE_API_KEY` or `ANTHROPIC_API_KEY`) | **FIXED in code** — *requires manual Railway env add (key tested, works against `claude-sonnet-4-5` and `claude-sonnet-4-6`)* |
| 3 | No invented social profiles; intermediary site = theoraclelover.com everywhere | **VERIFIED ALREADY GOOD** (`Person.sameAs` is just `theoraclelover.com` and `/about`) |
| 4 | Newsletter signup writes JSON file on Bunny | **FIXED** — `POST /newsletter` appends to `newsletter/subscribers.json` on Bunny; renderer at `/newsletter` |
| 5 | Quality gate — banned words/phrases, em-dash, voice rules | **FIXED** — `src/lib/quality-gate.mjs` rewritten with full scope list (50+ words, 14 phrases, em-dash, contractions, conversational openers, varied sentence length, TL/DR rules) |
| 6 | E-E-A-T template (TL/DR, self-referencing voice, 3 internal links, ≥1 outbound to .gov/.edu/PubMed/etc., byline with credential + dateModified, warm topical context per byline) | **FIXED** — see `renderArticle` in `src/server/pages.mjs` |
| 7 | Canonical UTM-strip + robots `index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1` | **FIXED** — `src/server/layout.mjs` |
| 8 | Open Graph + Twitter (incl. `article:published_time`, `article:modified_time`, `article:author`, `article:section`, `twitter:card=summary_large_image`) | **FIXED** — `layout.mjs` |
| 9 | Article JSON-LD (headline, description, datePublished, dateModified, author, publisher, image, articleSection, wordCount, inLanguage, isAccessibleForFree, mainEntityOfPage, reviewedBy, SpeakableSpecification → TL/DR) | **FIXED** — `pages.mjs` |
| 10 | BreadcrumbList JSON-LD per article (Home → All Articles → Category → Article) | **FIXED** — `pages.mjs` |
| 11 | FAQPage JSON-LD auto-extracted from question-shaped headings, capped at 6, only emitted when real | **FIXED** — `pages.mjs` heading scanner |
| 12 | HowTo JSON-LD where article has ordered step list (mutually exclusive with MedicalCondition) | **FIXED** — `pages.mjs` step detector |
| 13 | WebSite JSON-LD with SearchAction on home | **FIXED** — `pages.mjs` `renderHome` |
| 14 | Organization JSON-LD sitewide | **FIXED** — `layout.mjs` (every page) |
| 15 | AboutPage + Organization JSON-LD on `/about` | **FIXED** — `pages.mjs` `renderAbout` |
| 16 | CollectionPage + ItemList JSON-LD on `/articles` hub | **FIXED** — `pages.mjs` `renderArticleIndex` |
| 17 | Person JSON-LD with name, url, jobTitle, description, knowsAbout, sameAs | **FIXED** — `pages.mjs` (article + about) |
| 18 | `/sitemap.xml` live, ISO-8601 lastmod, newest first, published only | **VERIFIED LIVE** (78 URLs, ISO-8601 lastmod) |
| 19 | `/robots.txt` lists every required AI crawler + sitemap advertisement | **VERIFIED LIVE** (38 user-agents incl. all 18 scope-required) |
| 20 | `/llms.txt` markdown index by category, served as `Content-Type: text/markdown` | **VERIFIED LIVE** (`text/markdown; charset=utf-8`, 14,985 bytes) |
| 21 | `/llms-full.txt` plain-text full corpus, frontmatter-delimited | **VERIFIED LIVE** (989,059 bytes; in-memory cache + parallel fetch from Bunny) |
| 22 | All head meta SSR'd before React boots (verified via GPTBot UA) | **VERIFIED LIVE** — title, canonical, robots, OG, Twitter, JSON-LD all in first 8 KB |
| 23 | Bunny-only article storage; no body in any DB | **VERIFIED ALREADY GOOD** — site has no DB; articles are JSON files at `articles/{slug}.json` on Bunny, master `articles/index.json` |
| 24 | Article counts: 30–100 published, 400–500 queued | **FIXED** — was 500/0; now 70 published / 430 queued (`scripts/right-size-publish-queue.mjs`, ranked by publishedAt desc) |
| 25 | Backdate published articles across prior 3 months | **FIXED** — `scripts/backdate-published.mjs` ran clean, 500/500 random publishedAt across ±90 days, dateModified between publishedAt and now |
| 26 | Quarterly refresh cron — Claude rewrite + quality gate, update Bunny on pass, just bump timestamp on fail | **FIXED** — `scripts/quarterly-refresh.mjs` + cron `30 3 1 * *` in `src/server/index.mjs`; auto-disabled if `CLAUDE_API_KEY` missing |
| 27 | Bylines: credential + datetime + 1-2 sentences of warm topical context | **FIXED** — `pages.mjs` byline block uses `<time datetime>`, author credential from `SITE.author.credential`, topical context built from article topic + tags |
| 28 | No Paul Wagner / paulwagner.com leakage anywhere | **VERIFIED CLEAN** — source grep returns only the *block* rules in quality-gate; full Bunny body sweep across all 500 articles found 0 leaks |
| 29 | SOVRN code removed | **VERIFIED CLEAN** — source grep returns 0 matches; live homepage scan returns 0 |
| 30 | All 500 article bodies em-dash-free at the source-of-truth JSON | **FIXED** — `scripts/strip-em-dashes.mjs` cleaned 179 articles on Bunny (and the renderer also defensively strips em-dashes at render time) |
| 31 | Clean repo, no zips, push to GitHub | **DONE** — `peacefulgeek/quiet-classroom@main` commit `56a4a42`, no zips, Railway auto-redeploys |

## Live validation output

```
[validate] BASE=https://aquietclassroom.com
[PASS] robots.txt  -  lists 18 required AI crawlers + sitemap
[PASS] /llms.txt  -  text/markdown; charset=utf-8, 14985 bytes
[PASS] /llms-full.txt  -  989059 bytes
[PASS] /sitemap.xml  -  78 URLs, ISO-8601 lastmod
[PASS] /newsletter  -  page renders with subscribe form
[PASS] SOVRN removal  -  none found in homepage
[PASS] SSR article (GPTBot UA)  -  /articles/testing-anxiety-accommodations--for-charter-and-magnet-families - title/canonical/robots/og/twitter/JSON-LD all present, no leakage
7 / 7 checks passed
```

## Counts after the pass

| Metric | Before | After |
|---|---|---|
| Total articles on Bunny | 500 | 500 |
| Published | 500 | 70 |
| Queued | 0 | 430 |
| Sitemap URLs | 507 | 78 (8 static + 70 articles) |
| Articles with em-dashes in body | 170 | 0 |
| Articles with Paul Wagner leakage | 0 | 0 |
| Avg word count | 2,253 | 2,253 |
| AI crawlers explicitly allowed in robots.txt | 5 | 38 |

## One open item — needs your hand

**Add `CLAUDE_API_KEY` to Railway env.** All Claude code is wired and dormant. As soon as that variable lands in production, the quarterly refresh cron will arm itself (`[cron] quarterly refresh scheduled (1st of month 03:30 UTC)`) and `claude.mjs` becomes available to any future generation script. Until then, the cron logs `[cron] CLAUDE_API_KEY missing; quarterly refresh disabled` — quietly, harmlessly. The site keeps serving everything else exactly as-is.

The publish cron (5 articles per day from the queue) was already wired and continues to drip articles into circulation — no Claude needed for that part.

## Validation re-run command (anytime)

```bash
cd /home/ubuntu/aquietclassroom
BASE=https://aquietclassroom.com node scripts/validate-final-pass.mjs
```

## Schema validators (manual spot-checks recommended)

- Google Rich Results: <https://search.google.com/test/rich-results?url=https%3A%2F%2Faquietclassroom.com%2Farticles%2Ftesting-anxiety-accommodations--for-charter-and-magnet-families>
- Schema.org validator: <https://validator.schema.org/?url=https%3A%2F%2Faquietclassroom.com%2Farticles%2Ftesting-anxiety-accommodations--for-charter-and-magnet-families>
