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
  renderNewsletter,
  render404,
} from "./pages.mjs";
import { buildSitemap, buildRobots, buildLlmsTxt, buildLlmsFullTxt, buildAiTxt, buildRss } from "./feeds.mjs";
import { uploadJsonToBunny, fetchJsonFromBunnyOrigin } from "../lib/bunny.mjs";

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
  const idx = await getPublished();
  res.set("Content-Type", "text/html; charset=utf-8").send(renderArticle(a, { indexHint: idx }));
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

// Newsletter: signup form + JSON-on-Bunny store. No third-party tracker, no SOVRN.
app.get("/newsletter", (req, res) => res.set("Content-Type", "text/html; charset=utf-8").send(renderNewsletter()));
app.use("/newsletter/subscribe", express.urlencoded({ extended: false }));
app.use("/newsletter/subscribe", express.json());
app.post("/newsletter/subscribe", async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const name = String((req.body && req.body.name) || "").trim().slice(0, 100);
    const ts = Date.now();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).set("Content-Type", "text/html; charset=utf-8").send(renderNewsletter({ error: "Please enter a valid email." }));
    }
    // Honeypot
    if (req.body && req.body.website) return res.status(204).end();
    const KEY = "newsletter/subscribers.json";
    let list = [];
    try { list = await fetchJsonFromBunnyOrigin(KEY); } catch { list = []; }
    if (!Array.isArray(list)) list = [];
    if (!list.find((e) => e.email === email)) {
      list.push({ email, name, ts, ip: (req.headers["x-forwarded-for"] || req.ip || "").toString().split(",")[0].trim(), ua: (req.headers["user-agent"] || "").slice(0, 300) });
      await uploadJsonToBunny(KEY, list);
    }
    res.set("Content-Type", "text/html; charset=utf-8").send(renderNewsletter({ ok: true, email }));
  } catch (e) {
    console.error("[newsletter] error:", e);
    res.status(500).set("Content-Type", "text/html; charset=utf-8").send(renderNewsletter({ error: "Something went wrong. Try again in a moment." }));
  }
});

// ---------- FEEDS ----------
app.get("/sitemap.xml", async (req, res) => {
  res.set("Content-Type", "application/xml; charset=utf-8").send(await buildSitemap());
});
app.get("/robots.txt", (req, res) => res.set("Content-Type", "text/plain; charset=utf-8").send(buildRobots()));
app.get("/llms.txt", async (req, res) => res.set("Content-Type", "text/markdown; charset=utf-8").send(await buildLlmsTxt()));
app.get("/llms-full.txt", async (req, res) => res.set("Content-Type", "text/plain; charset=utf-8").send(await buildLlmsFullTxt()));
app.get("/ai.txt", (req, res) => res.set("Content-Type", "text/plain; charset=utf-8").send(buildAiTxt()));
app.get(["/rss.xml", "/feed.xml"], async (req, res) => res.set("Content-Type", "application/rss+xml").send(await buildRss()));
app.get("/.well-known/health", (req, res) => res.json({ ok: true, name: SITE.name, time: Date.now() }));

// ---------- 404 ----------
app.use((req, res) => res.status(404).set("Content-Type", "text/html").send(render404({ path: req.path })));

// ---------- IN-CODE CRONS (no Manus scheduled tasks) ----------
// Per scope: there is no hard cap. The cron promotes queued articles to
// published until the queue is exhausted.
if (process.env.AUTO_GEN_ENABLED === "true") {
  cron.schedule("0 30 0,5,10,15,20 * * *", async () => {
    try {
      const idx = await getIndex();
      const publishedCount = idx.filter(a => a.status === "published").length;
      const queued = await getQueued();
      const next = queued[0];
      if (!next) {
        console.log(`[cron] queue empty; nothing to publish (current published=${publishedCount})`);
        return;
      }
      const a = await readArticle(next.slug);
      if (!a) return;
      a.status = "published";
      a.publishedAt = Date.now();
      a.dateModified = Date.now();
      await writeArticleStore(a);
      bustIndex();
      console.log(`[cron] published ${a.slug} (now ${publishedCount + 1})`);
    } catch (e) { console.error("[cron] publish error", e); }
  });
  console.log("[cron] auto-publish enabled (5/day, no cap)");
} else {
  console.log("[cron] AUTO_GEN_ENABLED=false; auto-publish off");
}

// Sitemap regen "ping": warm the cache hourly
cron.schedule("0 0 * * * *", async () => { try { await buildSitemap(); } catch {} });

// Quarterly refresh: 1st of each month at 03:30 UTC, refresh the 20 oldest
// published articles via Claude. Skips silently if CLAUDE_API_KEY is unset.
if (process.env.CLAUDE_API_KEY) {
  cron.schedule("30 3 1 * *", async () => {
    try {
      console.log("[cron] quarterly refresh starting");
      const { spawn } = await import("node:child_process");
      const child = spawn(process.execPath, ["scripts/quarterly-refresh.mjs"], {
        env: { ...process.env, COUNT: process.env.QUARTERLY_REFRESH_COUNT || "20" },
        stdio: "inherit",
        detached: false,
      });
      child.on("exit", (code) => console.log(`[cron] quarterly refresh exited code=${code}`));
    } catch (e) { console.error("[cron] quarterly refresh failed:", e); }
  });
  console.log("[cron] quarterly refresh scheduled (1st of month 03:30 UTC)");
} else {
  console.log("[cron] CLAUDE_API_KEY missing; quarterly refresh disabled");
}

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
