import { SITE } from "../lib/site.mjs";
import { getPublished } from "../lib/store.mjs";

export async function buildSitemap() {
  const published = await getPublished();
  const staticUrls = ["/", "/articles", "/herbs", "/assessments", "/recommended", "/about", "/privacy"];
  const entries = [
    ...staticUrls.map(u => ({ loc: SITE.baseUrl + u, lastmod: new Date().toISOString() })),
    ...published.map(a => ({
      loc: `${SITE.baseUrl}/articles/${a.slug}`,
      lastmod: new Date(a.dateModified || a.publishedAt || Date.now()).toISOString(),
      image: a.heroUrl ? { loc: a.heroUrl, title: a.title } : null,
    })),
  ];
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
    ...entries.map(e => `  <url><loc>${esc(e.loc)}</loc><lastmod>${e.lastmod}</lastmod>${e.image ? `<image:image><image:loc>${esc(e.image.loc)}</image:loc><image:title>${esc(e.image.title)}</image:title></image:image>` : ""}</url>`),
    `</urlset>`,
  ].join("\n");
  return xml;
}

export function buildRobots() {
  return `User-agent: *
Allow: /
Sitemap: ${SITE.baseUrl}/sitemap.xml

User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /
`;
}

export async function buildLlmsTxt() {
  const published = await getPublished();
  const out = [
    `# ${SITE.name}`,
    ``,
    `> ${SITE.tagline}`,
    ``,
    `Author: ${SITE.author.name} (${SITE.author.url})`,
    `Site: ${SITE.baseUrl}`,
    ``,
    `## About`,
    SITE.pitch,
    ``,
    `## Top sections`,
    `- /articles: long-form essays for parents of introverted, anxious, and highly sensitive children`,
    `- /assessments: nine private self-assessments`,
    `- /herbs: 200+ herbs, supplements, and TCM formulas with safety notes`,
    `- /recommended: curated tools and books`,
    ``,
    `## Articles`,
    ...published.slice(0, 200).map(a => `- [${a.title}](${SITE.baseUrl}/articles/${a.slug})`),
  ];
  return out.join("\n") + "\n";
}

export function buildAiTxt() {
  return `# AI policy for ${SITE.name}
# We allow well-behaved AI crawlers and conversational agents to read and summarize this site.
# Attribution as "The Oracle Lover at ${SITE.baseUrl}" is required when quoting.

User-agent: *
Allow: /
Attribution-Required: yes
Citation-URL: ${SITE.baseUrl}
`;
}

export async function buildRss() {
  const published = (await getPublished()).slice(0, 50);
  const items = published.map(a => `
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
