// Shared HTML layout. SSR head-first so AI crawlers (GPTBot, ClaudeBot, etc.)
// see canonical, schema, and OG meta before any body content.

import { SITE } from "../lib/site.mjs";

export function escape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Build a canonical URL for the given path that strips tracking params.
// Removes any UTM/* and common click-tracking IDs (fbclid, gclid, mc_eid, etc.)
const TRACKING_PARAMS = new Set([
  "utm_source","utm_medium","utm_campaign","utm_term","utm_content","utm_id","utm_name","utm_referrer",
  "fbclid","gclid","gbraid","wbraid","msclkid","mc_eid","mc_cid","yclid","_hsenc","_hsmi","hsCtaTracking",
  "ref","ref_src","ref_url","igshid","si",
]);
export function canonicalize(rawPath) {
  const [pathPart, queryPart] = String(rawPath || "/").split("?");
  if (!queryPart) return SITE.baseUrl + pathPart;
  const out = new URLSearchParams();
  for (const [k, v] of new URLSearchParams(queryPart).entries()) {
    if (TRACKING_PARAMS.has(k.toLowerCase())) continue;
    out.append(k, v);
  }
  const qs = out.toString();
  return SITE.baseUrl + pathPart + (qs ? "?" + qs : "");
}

export function layout({
  title,
  description,
  path = "/",
  ogImage,
  jsonLd,
  bodyClass = "",
  extraHead = "",
  body,
  showHero = false,
  hero,
  ogType,         // "article" | "website" | "profile"
  publishedTime,  // ISO string for og:article:published_time
  modifiedTime,   // ISO string for og:article:modified_time
  articleSection, // og:article:section / category
  authorName,     // og:article:author
  noindex = false,
}) {
  const pageTitle = title === SITE.name ? title : `${title} | ${SITE.name}`;
  const desc = description || SITE.tagline;
  const canonical = canonicalize(path);
  const ogImg = ogImage || SITE.defaultOgImage;
  const ogTypeFinal = ogType || (path.startsWith("/articles/") && path !== "/articles" ? "article" : "website");
  const robotsContent = noindex ? "noindex, nofollow" : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

  const jsonLdBlock = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`
    : "";

  const articleMeta = ogTypeFinal === "article" ? `
  <meta property="article:published_time" content="${escape(publishedTime || "")}">
  <meta property="article:modified_time" content="${escape(modifiedTime || publishedTime || "")}">
  <meta property="article:section" content="${escape(articleSection || "")}">
  <meta property="article:author" content="${escape(authorName || SITE.author.name)}">` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(pageTitle)}</title>
  <meta name="description" content="${escape(desc)}">
  <meta name="robots" content="${robotsContent}">
  <meta name="googlebot" content="${robotsContent}">
  <meta name="bingbot" content="${robotsContent}">
  <link rel="canonical" href="${escape(canonical)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="${escape(SITE.name)}" href="${SITE.baseUrl}/rss.xml">

  <meta property="og:type" content="${ogTypeFinal}">
  <meta property="og:site_name" content="${escape(SITE.name)}">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(desc)}">
  <meta property="og:url" content="${escape(canonical)}">
  <meta property="og:image" content="${escape(ogImg)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="en_US">
  ${articleMeta}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escape(title)}">
  <meta name="twitter:description" content="${escape(desc)}">
  <meta name="twitter:image" content="${escape(ogImg)}">

  <link rel="stylesheet" href="/style.css">
  ${extraHead}
  ${jsonLdBlock}
</head>
<body class="${bodyClass}">
  ${showHero && hero ? hero : ""}
  <header class="site-header ${showHero ? "site-header--overlay" : ""}">
    <div class="container site-header__row">
      <a class="site-header__brand" href="/">${escape(SITE.shortName)}</a>
      <nav class="site-header__nav">
        <a href="/articles">Articles</a>
        <a href="/herbs">Herbs</a>
        <a href="/assessments">Assessments</a>
        <a href="/recommended">Recommended</a>
        <a href="/about">About</a>
      </nav>
    </div>
  </header>

  <main>${body}</main>

  <footer class="site-footer">
    <div class="container">
      <div class="site-footer__cols">
        <div>
          <strong>${escape(SITE.name)}</strong>
          <p>${escape(SITE.tagline)}</p>
        </div>
        <div>
          <h4>Explore</h4>
          <ul>
            <li><a href="/articles">All Articles</a></li>
            <li><a href="/assessments">Assessments</a></li>
            <li><a href="/herbs">Herbs and TCM</a></li>
            <li><a href="/recommended">Recommended Tools</a></li>
          </ul>
        </div>
        <div>
          <h4>Legal</h4>
          <ul>
            <li><a href="/privacy">Privacy and Disclosure</a></li>
            <li><a href="/sitemap.xml">Sitemap</a></li>
            <li><a href="/llms.txt">llms.txt</a></li>
            <li><a href="/llms-full.txt">llms-full.txt</a></li>
            <li><a href="/rss.xml">RSS</a></li>
          </ul>
        </div>
        <div>
          <h4>Connect</h4>
          <ul>
            <li><a href="${SITE.author.url}" rel="me" target="_blank">The Oracle Lover</a></li>
            <li><a href="/newsletter">Newsletter</a></li>
          </ul>
        </div>
      </div>
      <p class="site-footer__small">${escape(SITE.affiliateDisclosure)} &middot; ${escape(SITE.disclaimer)}</p>
      <p class="site-footer__small">&copy; ${new Date().getFullYear()} ${escape(SITE.name)}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`;
}
