// Express SSR for A Quiet Classroom. Pure Node, zero Manus dependencies.

// ---------- CRASH DIAGNOSTICS (must be first lines) ----------
process.on("uncaughtException", (err) => {
  console.error("[fatal] uncaughtException:", err && err.stack ? err.stack : err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] unhandledRejection:", reason);
  process.exit(1);
});
console.log("[boot] node", process.version, "pid", process.pid, "port-env", process.env.PORT || "(unset)");

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import cron from "node-cron";

import { SITE, PILLARS } from "../lib/site.mjs";
import { getIndex, getPublished, readArticle, writeArticle as writeArticleStore, getQueued, bustIndex } from "../lib/store.mjs";
import {
  renderHome,
  renderArticlesIndex,
  renderArticle,
  renderHerbsIndex,
  renderHerb,
  renderAssessmentsIndex,
  renderAssessment,
  renderRecommended,
  renderAbout,
  renderPrivacy,
  render404,
} from "./pages.mjs";
import { buildSitemap, buildRobots, buildLlmsTxt, buildAiTxt, buildRss } from "./feeds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const PUBLIC_DIR = path.join(ROOT, "client/public");
const DATA_DIR = path.join(ROOT, "src/data");

const app = express();
app.disable("x-powered-by");

// Hostname normalization: redirect any non-canonical apex to apex with HTTPS
app.use((req, res, next) => {
  const host = req.headers.host || "";
  if (host.startsWith("www.")) {
    return res.redirect(301, `https://${SITE.apex}${req.originalUrl}`);
  }
  next();
});

app.use(express.static(PUBLIC_DIR, { maxAge: "1d", etag: true }));

// ---------- LOAD STATIC DATA ----------
async function loadJson(name) {
  return JSON.parse(await fs.readFile(path.join(DATA_DIR, name), "utf8"));
}
const HERBS = await loadJson("herbs-catalog.json");
const ASSESSMENTS = await loadJson("assessments.json");
const ASIN_CATALOG = await loadJson("asin-catalog.json");

// ---------- ROUTES ----------
app.get("/", async (req, res) => {
  const idx = await getIndex();
  const published = idx.filter(a => a.status === "published");
  const featured = published[0];
  const recent = published.slice(0, 9);
  res.set("Content-Type", "text/html; charset=utf-8").send(renderHome({ featured, recent }));
});

app.get("/articles", async (req, res) => {
  const idx = await getPublished();
  res.set("Content-Type", "text/html; charset=utf-8").send(renderArticlesIndex({ articles: idx, category: req.query.category }));
});

app.get("/articles/:slug", async (req, res) => {
  const a = await readArticle(req.params.slug);
  if (!a || a.status !== "published") return res.status(404).set("Content-Type", "text/html").send(render404({ path: req.path }));
  res.set("Content-Type", "text/html; charset=utf-8").send(renderArticle(a));
});

app.get("/herbs", (req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8").send(renderHerbsIndex({ herbs: HERBS }));
});
app.get("/herbs/:slug", (req, res) => {
  const h = HERBS.find(x => x.slug === req.params.slug);
  if (!h) return res.status(404).set("Content-Type", "text/html").send(render404({ path: req.path }));
  res.set("Content-Type", "text/html; charset=utf-8").send(renderHerb(h));
});

app.get("/assessments", (req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8").send(renderAssessmentsIndex({ assessments: ASSESSMENTS }));
});
app.get("/assessments/:slug", (req, res) => {
  const a = ASSESSMENTS.find(x => x.slug === req.params.slug);
  if (!a) return res.status(404).set("Content-Type", "text/html").send(render404({ path: req.path }));
  res.set("Content-Type", "text/html; charset=utf-8").send(renderAssessment(a));
});

app.get("/recommended", (req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8").send(renderRecommended({ products: ASIN_CATALOG.products }));
});
app.get("/about", (req, res) => res.set("Content-Type", "text/html; charset=utf-8").send(renderAbout()));
app.get("/privacy", (req, res) => res.set("Content-Type", "text/html; charset=utf-8").send(renderPrivacy()));

// ---------- FEEDS ----------
app.get("/sitemap.xml", async (req, res) => {
  res.set("Content-Type", "application/xml; charset=utf-8").send(await buildSitemap());
});
app.get("/robots.txt", (req, res) => res.set("Content-Type", "text/plain").send(buildRobots()));
app.get("/llms.txt", async (req, res) => res.set("Content-Type", "text/plain").send(await buildLlmsTxt()));
app.get("/ai.txt", (req, res) => res.set("Content-Type", "text/plain").send(buildAiTxt()));
app.get(["/rss.xml", "/feed.xml"], async (req, res) => res.set("Content-Type", "application/rss+xml").send(await buildRss()));
app.get("/.well-known/health", (req, res) => res.json({ ok: true, name: SITE.name, time: Date.now() }));

// ---------- 404 ----------
app.use((req, res) => res.status(404).set("Content-Type", "text/html").send(render404({ path: req.path })));

// ---------- IN-CODE CRONS (no Manus scheduled tasks) ----------
const PUBLISHED_CAP = parseInt(process.env.PUBLISHED_CAP || "100", 10);
if (process.env.AUTO_GEN_ENABLED === "true") {
  // Publish up to N per day, capped at PUBLISHED_CAP total
  cron.schedule("0 30 0,5,10,15,20 * * *", async () => {
    try {
      const idx = await getIndex();
      const publishedCount = idx.filter(a => a.status === "published").length;
      if (publishedCount >= PUBLISHED_CAP) {
        console.log(`[cron] cap reached (${publishedCount}/${PUBLISHED_CAP}); not publishing`);
        return;
      }
      const queued = await getQueued();
      const next = queued[0];
      if (!next) return;
      const a = await readArticle(next.slug);
      if (!a) return;
      a.status = "published";
      a.publishedAt = Date.now();
      a.dateModified = Date.now();
      await writeArticleStore(a);
      bustIndex();
      console.log(`[cron] published ${a.slug} (${publishedCount + 1}/${PUBLISHED_CAP})`);
    } catch (e) { console.error("[cron] publish error", e); }
  });
  console.log(`[cron] auto-publish enabled (5/day, cap ${PUBLISHED_CAP})`);
} else {
  console.log("[cron] AUTO_GEN_ENABLED=false; auto-publish off");
}

// Sitemap regen "ping": warm the cache hourly
cron.schedule("0 0 * * * *", async () => { try { await buildSitemap(); } catch {} });

const PORT = parseInt(process.env.PORT || "8080", 10);
const HOST = "0.0.0.0"; // Railway requires bind to 0.0.0.0, not localhost
const server = app.listen(PORT, HOST, () => {
  console.log(`${SITE.name} listening on http://${HOST}:${PORT}`);
});
server.on("error", (err) => {
  console.error("[fatal] http server error:", err);
  process.exit(1);
});
// Graceful shutdown so Railway can roll deploys cleanly
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`[shutdown] ${sig} received; closing http server`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
