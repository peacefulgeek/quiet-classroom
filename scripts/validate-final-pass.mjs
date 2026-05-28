// Validate the live site against the BacklinkWebsites Final Pass scope.
//
// Usage: BASE=https://aquietclassroom.com node scripts/validate-final-pass.mjs
//
// Prints PASS / FAIL per scope item and exits non-zero if any FAIL.

const BASE = (process.env.BASE || "https://aquietclassroom.com").replace(/\/$/, "");
const GPTBOT_UA = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)";

const checks = [];
const fail = (label, msg) => { checks.push({ ok: false, label, msg }); };
const pass = (label, msg = "") => { checks.push({ ok: true, label, msg }); };

async function fetchText(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { redirect: "follow", ...opts });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

// ---------- /robots.txt ----------
async function checkRobots() {
  const r = await fetchText("/robots.txt");
  if (r.status !== 200) return fail("robots.txt", `status ${r.status}`);
  const required = [
    "GPTBot", "ChatGPT-User", "OAI-SearchBot",
    "ClaudeBot", "Claude-Web", "anthropic-ai",
    "PerplexityBot", "Perplexity-User", "Google-Extended",
    "Bingbot", "CCBot", "Applebot", "Applebot-Extended",
    "DuckAssistBot", "Meta-ExternalAgent", "YouBot",
    "MistralAI-User", "Cohere-AI",
  ];
  const missing = required.filter((ua) => !r.text.includes(ua));
  if (missing.length) return fail("robots.txt AI crawlers", `missing: ${missing.join(", ")}`);
  if (!r.text.includes("Sitemap:")) return fail("robots.txt", "no Sitemap: line");
  pass("robots.txt", `lists ${required.length} required AI crawlers + sitemap`);
}

// ---------- /llms.txt ----------
async function checkLlms() {
  const r = await fetchText("/llms.txt");
  if (r.status !== 200) return fail("/llms.txt", `status ${r.status}`);
  const ct = (r.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("text/markdown")) return fail("/llms.txt content-type", `got ${ct}, expected text/markdown`);
  if (!/^#\s/m.test(r.text)) return fail("/llms.txt body", "no markdown heading");
  pass("/llms.txt", `${ct}, ${r.text.length} bytes`);
}

// ---------- /llms-full.txt ----------
async function checkLlmsFull() {
  const r = await fetchText("/llms-full.txt");
  if (r.status !== 200) return fail("/llms-full.txt", `status ${r.status}`);
  if (!r.text.includes("---") || r.text.length < 5000) return fail("/llms-full.txt body", `too small (${r.text.length} bytes)`);
  pass("/llms-full.txt", `${r.text.length} bytes`);
}

// ---------- /sitemap.xml ----------
async function checkSitemap() {
  const r = await fetchText("/sitemap.xml");
  if (r.status !== 200) return fail("/sitemap.xml", `status ${r.status}`);
  const urls = (r.text.match(/<loc>[^<]+<\/loc>/g) || []).length;
  if (urls < 5) return fail("/sitemap.xml", `only ${urls} <loc> entries`);
  if (!/<lastmod>\d{4}-\d{2}-\d{2}T/.test(r.text)) return fail("/sitemap.xml", "lastmod not ISO-8601");
  pass("/sitemap.xml", `${urls} URLs, ISO-8601 lastmod`);
}

// ---------- Article SSR with GPTBot UA ----------
async function checkGptBotArticle() {
  // Pick the first article from the sitemap.
  const sm = await fetchText("/sitemap.xml");
  const m = sm.text.match(/<loc>([^<]*\/articles\/[^<]+)<\/loc>/);
  if (!m) return fail("article SSR", "no article in sitemap");
  const articleUrl = m[1];
  const path = articleUrl.replace(BASE, "");
  const r = await fetch(BASE + path, {
    headers: { "User-Agent": GPTBOT_UA },
    redirect: "follow",
  });
  const text = await r.text();
  if (r.status !== 200) return fail("article SSR", `status ${r.status}`);
  // Check head order: title, canonical, JSON-LD must appear before any react root marker.
  const head = text.slice(0, 8000);
  const hasTitle = /<title>[^<]+<\/title>/i.test(head);
  const hasCanonical = /<link\s+rel="canonical"\s+href="[^"]+"/i.test(head);
  const hasJsonLd = /<script\s+type="application\/ld\+json">/i.test(head);
  if (!hasTitle) return fail("SSR <title>", "missing in first 8KB");
  if (!hasCanonical) return fail("SSR <link rel=canonical>", "missing in first 8KB");
  if (!hasJsonLd) return fail("SSR JSON-LD", "missing in first 8KB");
  // Now confirm canonical strips UTM params.
  const canMatch = text.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  const canonical = canMatch && canMatch[1];
  if (canonical && /[?&](utm_|fbclid|gclid|mc_eid)/.test(canonical)) {
    return fail("canonical UTM strip", `canonical leaks tracking: ${canonical}`);
  }
  // Confirm robots meta has the right policy.
  if (!/<meta\s+name="robots"\s+content="[^"]*max-snippet:-1[^"]*"/i.test(text)) {
    return fail("meta robots", "missing max-snippet:-1 policy");
  }
  // Confirm OG and article meta.
  if (!/<meta\s+property="og:type"\s+content="article"/i.test(text)) return fail("og:type article", "missing");
  if (!/<meta\s+property="article:published_time"\s+content="\d{4}-/i.test(text)) return fail("article:published_time", "missing");
  if (!/<meta\s+property="article:modified_time"\s+content="\d{4}-/i.test(text)) return fail("article:modified_time", "missing");
  if (!/<meta\s+name="twitter:card"\s+content="summary_large_image"/i.test(text)) return fail("twitter:card", "missing summary_large_image");
  // Confirm JSON-LD has Article + BreadcrumbList + Organization + Person.
  if (!/"@type":\s*"Article"/.test(text)) return fail("JSON-LD Article", "missing");
  if (!/"@type":\s*"BreadcrumbList"/.test(text)) return fail("JSON-LD BreadcrumbList", "missing");
  if (!/"@type":\s*"Person"/.test(text)) return fail("JSON-LD Person", "missing");
  if (!/"@type":\s*"Organization"/.test(text)) return fail("JSON-LD Organization", "missing");
  if (!/SpeakableSpecification/.test(text)) return fail("Speakable", "missing in JSON-LD");
  // Leakage: no Paul Wagner / paulwagner.com
  if (/paulwagner\.com|Paul Wagner/i.test(text)) return fail("leakage", "Paul Wagner / paulwagner.com mentioned in article HTML");
  // No em-dashes in visible body (allow inside <script> JSON-LD, OK to have)
  // crude: check between </header> and <footer>
  const bodySlice = text.split(/<\/header>/i).slice(1).join("").split(/<footer/i)[0] || "";
  if (/\u2014/.test(bodySlice)) return fail("em-dashes in body", "em-dash found in rendered article body");
  pass("SSR article (GPTBot UA)", `${path} - title/canonical/robots/og/twitter/JSON-LD all present, no leakage`);
}

// ---------- Newsletter ----------
async function checkNewsletter() {
  const r = await fetchText("/newsletter");
  if (r.status !== 200) return fail("/newsletter", `status ${r.status}`);
  if (!/Subscribe/i.test(r.text)) return fail("/newsletter form", "no Subscribe button");
  pass("/newsletter", "page renders with subscribe form");
}

// ---------- SOVRN absence ----------
async function checkNoSovrn() {
  const r = await fetchText("/");
  if (/sovrn|s\.sovrn\.com/i.test(r.text)) return fail("SOVRN removal", "SOVRN code still present");
  pass("SOVRN removal", "none found in homepage");
}

async function main() {
  console.log(`[validate] BASE=${BASE}`);
  await checkRobots();
  await checkLlms();
  await checkLlmsFull();
  await checkSitemap();
  await checkNewsletter();
  await checkNoSovrn();
  await checkGptBotArticle();
  let failed = 0;
  for (const c of checks) {
    const tag = c.ok ? "PASS" : "FAIL";
    console.log(`[${tag}] ${c.label}${c.msg ? "  -  " + c.msg : ""}`);
    if (!c.ok) failed++;
  }
  console.log(`\n${checks.length - failed} / ${checks.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
