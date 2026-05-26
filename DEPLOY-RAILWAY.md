# Deploying A Quiet Classroom on Railway

## One-time setup

1. **Create the project**
   - In Railway: New Project, Deploy from GitHub Repo, pick `peacefulgeek/quiet-classroom`.
   - Railway will detect Nixpacks and use `nixpacks.toml` and `railway.json` automatically.

2. **Service settings**
   - Builder: Nixpacks (auto)
   - Start command: `node src/server/index.mjs` (already in `railway.json`)
   - Healthcheck: `/.well-known/health` (already in `railway.json`)
   - Region: pick the one nearest your audience (US East is fine for most)

3. **Required environment variables**

| Variable | Purpose | Example |
|---|---|---|
| `BUNNY_STORAGE_ZONE` | Bunny storage zone slug | `quiet-classroom` |
| `BUNNY_STORAGE_KEY` | Bunny storage write key | `7822a8cd-...` |
| `BUNNY_STORAGE_REGION` | Bunny storage region prefix | `ny` |
| `BUNNY_PULL_HOST` | Bunny pull zone hostname | `quiet-classroom.b-cdn.net` |
| `OPENAI_BASE_URL` | DeepSeek-compatible endpoint | (your gateway URL) |
| `OPENAI_API_KEY` | DeepSeek API key | (your key) |
| `OPENAI_MODEL` | Model name | `deepseek-v4-flash` |
| `AMAZON_AFFIL_TAG` | Amazon affiliate tag | `spankyspinola-20` |
| `PUBLISHED_CAP` | Hard cap on published articles | `100` |
| `AUTO_GEN_ENABLED` | Set to `true` to enable in-process publish cron | `true` |
| `NODE_ENV` | Production hint | `production` |
| `PORT` | Auto-assigned by Railway, do not set | `(auto)` |

4. **Custom domain**
   - In Railway service Settings → Networking → Custom Domain, add `aquietclassroom.com` and `www.aquietclassroom.com`.
   - Railway will give you a CNAME target. Add an `ALIAS`/`ANAME` record at the apex (or a `CNAME` for `www`).
   - The server already 301-redirects `www.*` to the apex.

## What happens at boot

- `node src/server/index.mjs` starts. Express binds to `process.env.PORT`.
- Static data is loaded from `src/data/*.json` (herbs, assessments, ASIN catalog).
- Article index is read from `content/articles/*.json` on every request.
- If `AUTO_GEN_ENABLED=true`, an in-process node-cron publishes one queued article every ~5 hours, hard-capped at `PUBLISHED_CAP` (default 100).
- Sitemap is rebuilt every hour to keep search crawlers fresh.

## Scaling notes

- The site is stateless apart from the JSON files in `content/articles/` (committed to git). To regenerate or expand, run `pnpm generate:batch` locally and push the resulting JSON.
- All images live on Bunny CDN, not on the Railway disk.
- Memory footprint at idle is ~80 MB, well under Railway's smallest plan.
- A single 1 vCPU / 512 MB instance handles tens of req/s for SSR pages (no DB hit).

## Healthcheck

`GET /.well-known/health` returns:
```json
{ "ok": true, "name": "A Quiet Classroom", "time": 1746000000000 }
```

Railway pings this every 60 s. If it fails 5 times the service restarts.

## Manual cap override

To temporarily lift the cap (e.g., for a content push), set `PUBLISHED_CAP=200` in Railway env vars and redeploy. To freeze the site, set `AUTO_GEN_ENABLED=false`.
