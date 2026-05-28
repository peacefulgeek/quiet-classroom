import { SITE } from "../lib/site.mjs";
import { getPublished, readArticle } from "../lib/store.mjs";

// ---------- /sitemap.xml ----------
// ISO-8601 lastmod, newest first, published only.
export async function buildSitemap() {
  const published = (await getPublished())
    .filter((a) => a.publishedAt)
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));

  const staticUrls = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/articles", priority: "0.9", changefreq: "daily" },
    { loc: "/herbs", priority: "0.8", changefreq: "weekly" },
    { loc: "/assessments", priority: "0.8", changefreq: "weekly" },
    { loc: "/recommended", priority: "0.7", changefreq: "weekly" },
    { loc: "/about", priority: "0.6", changefreq: "monthly" },
    { loc: "/privacy", priority: "0.3", changefreq: "yearly" },
    { loc: "/newsletter", priority: "0.7", changefreq: "monthly" },
  ];
  const nowIso = new Date().toISOString();

  const entries = [
    ...staticUrls.map((u) => ({
      loc: SITE.baseUrl + u.loc,
      lastmod: nowIso,
      priority: u.priority,
      changefreq: u.changefreq,
    })),
    ...published.map((a) => ({
      loc: `${SITE.baseUrl}/articles/${a.slug}`,
      lastmod: new Date(a.dateModified || a.publishedAt).toISOString(),
      priority: "0.85",
      changefreq: "weekly",
      image: a.heroUrl ? { loc: a.heroUrl, title: a.title } : null,
    })),
  ];

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
    ...entries.map((e) => {
      const img = e.image ? `<image:image><image:loc>${esc(e.image.loc)}</image:loc><image:title>${esc(e.image.title)}</image:title></image:image>` : "";
      return `  <url><loc>${esc(e.loc)}</loc><lastmod>${e.lastmod}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority>${img}</url>`;
    }),
    `</urlset>`,
  ].join("\n");
  return xml;
}

// ---------- /robots.txt ----------
// Whitelist every reputable AI / search crawler so we are findable by AEO/GEO surfaces.
export function buildRobots() {
  const allowedAgents = [
    "*", // default
    "Googlebot", "Bingbot", "DuckDuckBot", "DuckAssistBot", "Slurp", "Yandex", "Baiduspider",
    "Applebot", "Applebot-Extended", "Twitterbot", "facebookexternalhit", "LinkedInBot",
    // AI / LLM crawlers and conversational agents
    "GPTBot", "ChatGPT-User", "OAI-SearchBot",
    "ClaudeBot", "Claude-Web", "anthropic-ai",
    "Google-Extended",
    "PerplexityBot", "Perplexity-User",
    "Bytespider", "Amazonbot", "FacebookBot", "Meta-ExternalAgent", "Meta-ExternalFetcher",
    "CCBot", "cohere-ai", "Cohere-AI", "Diffbot", "Omgilibot", "PetalBot", "TimpiBot",
    "YouBot", "MistralAI-User", "MistralAI",
    "AwarioRssBot", "AwarioSmartBot", "Bravebot",
  ];
  const blocks = allowedAgents.map((agent) => `User-agent: ${agent}\nAllow: /\n`).join("\n");
  return `${blocks}
Sitemap: ${SITE.baseUrl}/sitemap.xml
Sitemap: ${SITE.baseUrl}/llms.txt
Sitemap: ${SITE.baseUrl}/llms-full.txt
`;
}

// ---------- /llms.txt ----------
// Markdown index of the site, served with content-type text/markdown.
export async function buildLlmsTxt() {
  const published = await getPublished();
  // Group by category for grouped listing.
  const byCat = new Map();
  for (const a of published) {
    const cat = a.category || "Uncategorized";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(a);
  }
  const out = [
    `# ${SITE.name}`,
    ``,
    `> ${SITE.tagline}`,
    ``,
    `Author: ${SITE.author.name} (${SITE.author.url})`,
    `Site: ${SITE.baseUrl}`,
    `Last updated: ${new Date().toISOString()}`,
    ``,
    `## About`,
    SITE.pitch,
    ``,
    `## Key sections`,
    `- /articles - long-form essays for parents of introverted, anxious, and highly sensitive children`,
    `- /assessments - nine private self-assessments, no data leaves the browser`,
    `- /herbs - 200+ herbs, supplements, and TCM formulas with safety notes`,
    `- /recommended - curated tools, books, and accommodations`,
    `- /about - who writes here and why`,
    ``,
    `## Articles by category`,
    ``,
  ];
  for (const cat of [...byCat.keys()].sort()) {
    out.push(`### ${cat}`);
    out.push("");
    for (const a of byCat.get(cat)) {
      out.push(`- [${escMd(a.title)}](${SITE.baseUrl}/articles/${a.slug})`);
    }
    out.push("");
  }
  return out.join("\n") + "\n";
}

// ---------- /llms-full.txt ----------
// Full-corpus plain text. Frontmatter-delimited per article so LLMs can split easily.
// We pull the body straight from Bunny via readArticle. Parallelized + cached
// because the published set has hundreds of items.
let _llmsFullCache = { text: null, builtAt: 0, count: 0 };
const LLMS_FULL_TTL_MS = 30 * 60 * 1000; // 30 minutes
const LLMS_FULL_CONCURRENCY = 16;
export async function buildLlmsFullTxt({ force = false } = {}) {
  const published = await getPublished();
  if (!force && _llmsFullCache.text && _llmsFullCache.count === published.length && Date.now() - _llmsFullCache.builtAt < LLMS_FULL_TTL_MS) {
    return _llmsFullCache.text;
  }
  // Parallel fetch with bounded concurrency.
  const queue = published.slice();
  const results = new Array(queue.length);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= queue.length) return;
      const meta = queue[idx];
      try {
        const a = await readArticle(meta.slug);
        results[idx] = a && a.body ? a : null;
      } catch { results[idx] = null; }
    }
  }
  await Promise.all(Array.from({ length: LLMS_FULL_CONCURRENCY }, worker));
  const parts = [
    `# ${SITE.name} - Full Corpus`,
    `# ${SITE.baseUrl}`,
    `# generated: ${new Date().toISOString()}`,
    `# count: ${published.length}`,
    ``,
  ];
  for (const a of results) {
    if (!a || !a.body) continue;
    parts.push(`---`);
    parts.push(`title: ${a.title}`);
    parts.push(`url: ${SITE.baseUrl}/articles/${a.slug}`);
    parts.push(`category: ${a.category || ""}`);
    parts.push(`tags: ${(a.tags || []).join(", ")}`);
    parts.push(`published: ${a.publishedAt ? new Date(a.publishedAt).toISOString() : ""}`);
    parts.push(`modified: ${a.dateModified ? new Date(a.dateModified).toISOString() : ""}`);
    parts.push(`---`);
    parts.push(a.body.trim());
    parts.push(``);
    parts.push(``);
  }
  const text = parts.join("\n");
  _llmsFullCache = { text, builtAt: Date.now(), count: published.length };
  return text;
}
export function bustLlmsFullCache() { _llmsFullCache = { text: null, builtAt: 0, count: 0 }; }

// ---------- /ai.txt (AI policy hint) ----------
export function buildAiTxt() {
  return `# AI policy for ${SITE.name}
# We allow well-behaved AI crawlers and conversational agents to read and summarize this site.
# Attribution as "${SITE.author.name} at ${SITE.baseUrl}" is required when quoting.

User-agent: *
Allow: /
Attribution-Required: yes
Citation-URL: ${SITE.baseUrl}
`;
}

// ---------- /rss.xml ----------
export async function buildRss() {
  const published = (await getPublished()).slice(0, 50);
  const items = published.map((a) => `
    <item>
      <title>${esc(a.title)}</title>
      <link>${SITE.baseUrl}/articles/${a.slug}</link>
      <guid isPermaLink="true">${SITE.baseUrl}/articles/${a.slug}</guid>
      <pubDate>${new Date(a.publishedAt || Date.now()).toUTCString()}</pubDate>
      <description>${esc(a.metaDescription || "")}</description>
    </item>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${esc(SITE.name)}</title>
  <link>${SITE.baseUrl}</link>
  <description>${esc(SITE.tagline)}</description>
  <language>en-us</language>
  ${items}
</channel></rss>`;
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escMd(s) {
  return String(s ?? "").replace(/[\[\]]/g, "");
}
