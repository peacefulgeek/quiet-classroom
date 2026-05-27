# Deploy A Quiet Classroom on Railway

## What's in the repo for Railway

| File | Purpose |
|---|---|
| `railway.json` | Pinned to `RAILPACK` builder (not Nixpacks). No healthcheck, no Dockerfile, just a `startCommand`. |
| `Procfile` | `web: node src/server/index.mjs` (used by Railpack). |
| `.nvmrc` | Pins Node to 22 for Railpack and any local nvm user. |
| `package.json` | `engines.node >= 22.0.0`, `packageManager: pnpm@9.15.0`. |
| `src/server/index.mjs` | Top-of-file `uncaughtException` and `unhandledRejection` handlers, `server.on('error')` handler, binds to `0.0.0.0` not `localhost`, default port `8080`, graceful `SIGTERM`/`SIGINT` shutdown. |

There is intentionally **no** `Dockerfile`, **no** `nixpacks.toml`, and **no** `healthcheckPath` in `railway.json`. Each was a known failure mode in prior deploys (Caddy injection on Nixpacks, stale Docker cache, cold-start healthcheck timeouts), so they are deliberately absent.

## Why each Railway failure mode is already handled

1. **Caddy injection.** Builder pinned to `RAILPACK` in `railway.json`. Railpack does not inject Caddy. (Nixpacks could detect this as a static site and front Express with Caddy, which would steal `PORT`.)
2. **Patches dir.** `pnpm-lock.yaml` has no patched dependencies and no `patches/` directory in this repo. Nothing to copy.
3. **pnpm version.** `packageManager: pnpm@9.15.0` is plain, no SHA hash, so Corepack accepts it.
4. **Silent crashes.** `uncaughtException`, `unhandledRejection`, and `server.on('error')` handlers print structured fatal logs and exit non-zero so Railway can see and restart.
5. **Wrong default port.** Server reads `process.env.PORT`. If absent (only in local dev), it falls back to `8080`. Never `10000`.
6. **Healthcheck timeout.** Removed entirely. Server boots in 1-2 s; healthcheck adds nothing but a failure mode.
7. **Dockerfile vs startCommand.** No Dockerfile exists. `railway.json` is the single source of truth.
8. **Stale build cache.** No Dockerfile to cache. Railpack rebuilds on lockfile or source changes.
9. **DNS.** External; document only. If a deploy succeeds but routing fails, delete and recreate the DNS record at the registrar.

## Steps

1. **Create Railway service.** New Project -> Deploy from GitHub -> pick `peacefulgeek/quiet-classroom`.
2. **Set env vars** in Railway -> Variables:

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
| `AUTO_GEN_ENABLED` | `true` to enable in-process publish cron, `false` to freeze | `true` |
| `NODE_ENV` | Production hint | `production` |

3. **Do NOT set `PORT`.** Railway injects it. The server reads `process.env.PORT` and falls back to `8080` only for local dev. Hard-coding `PORT` in Railway env will break the deploy.

4. **Add custom domain.** Railway -> Settings -> Networking -> Custom Domain. Add `aquietclassroom.com` and `www.aquietclassroom.com`. Railway returns a CNAME target. The server already 301-redirects `www.*` to apex.

5. **Update DNS** at your registrar with the value Railway gives you. If you have used this domain before and Railway returns "domain not routing" after a successful deploy, delete and recreate the DNS record at the registrar.

6. **Confirm running.** After the deploy finishes, hit:

```
curl -sS https://<your-domain>/.well-known/health
```

Expect `{"ok":true,"name":"A Quiet Classroom","time":...}`.

## Smoke checklist after deploy

```
curl -sS -o /dev/null -w "%{http_code}\n" https://<your-domain>/
curl -sS -o /dev/null -w "%{http_code}\n" https://<your-domain>/articles
curl -sS -o /dev/null -w "%{http_code}\n" https://<your-domain>/herbs
curl -sS -o /dev/null -w "%{http_code}\n" https://<your-domain>/assessments
curl -sS -o /dev/null -w "%{http_code}\n" https://<your-domain>/sitemap.xml
curl -sS -o /dev/null -w "%{http_code}\n" https://<your-domain>/rss.xml
```

All should return `200`.

## Resource sizing

- Memory: 512 MB is plenty (server holds ~520 small JSON files in memory).
- CPU: 1 vCPU is fine. Boot reads all article JSON synchronously, ~1-2 seconds in our local test.
- Min instances: 0 is OK. Cold start adds ~2 seconds; tolerable for a content site.

## What happens at boot

1. Top-of-file diagnostics line prints: `[boot] node v22.x pid <n> port-env <PORT or unset>`.
2. Express imports load. If any throw, `uncaughtException` fires and the process exits 1, which Railway logs.
3. Static data is loaded from `src/data/*.json` (herbs, assessments, ASIN catalog).
4. App binds to `0.0.0.0:<PORT>`. Railway routes traffic.
5. If `AUTO_GEN_ENABLED=true`, an in-process node-cron promotes one queued article to published every 5 hours. There is no cap; the cron drains the queue.
6. Sitemap warm-up runs hourly.

## Auto-publish control

There is no cap on published articles. To temporarily freeze the auto-publish cron (e.g., during a content review), set `AUTO_GEN_ENABLED=false` in Railway env vars and redeploy.
