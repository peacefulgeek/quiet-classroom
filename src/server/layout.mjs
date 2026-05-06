// Shared HTML layout. Archetype D scroll design lives here at the chrome level;
// per-page content provides the body and any extra <head> tags.

import { SITE } from "../lib/site.mjs";

export function escape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
}) {
  const pageTitle = title === SITE.name ? title : `${title} | ${SITE.name}`;
  const desc = description || SITE.tagline;
  const canonical = `${SITE.baseUrl}${path}`;
  const ogImg = ogImage || SITE.defaultOgImage;
  const jsonLdBlock = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(pageTitle)}</title>
  <meta name="description" content="${escape(desc)}">
  <link rel="canonical" href="${escape(canonical)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="${escape(SITE.name)}" href="${SITE.baseUrl}/rss.xml">

  <meta property="og:type" content="${path === "/" || path.startsWith("/articles") ? "article" : "website"}">
  <meta property="og:site_name" content="${escape(SITE.name)}">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(desc)}">
  <meta property="og:url" content="${escape(canonical)}">
  <meta property="og:image" content="${escape(ogImg)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
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
            <li><a href="/herbs">Herbs &amp; TCM</a></li>
            <li><a href="/recommended">Recommended Tools</a></li>
          </ul>
        </div>
        <div>
          <h4>Legal</h4>
          <ul>
            <li><a href="/privacy">Privacy &amp; Disclosure</a></li>
            <li><a href="/sitemap.xml">Sitemap</a></li>
            <li><a href="/llms.txt">llms.txt</a></li>
            <li><a href="/rss.xml">RSS</a></li>
          </ul>
        </div>
        <div>
          <h4>Connect</h4>
          <ul>
            <li><a href="${SITE.author.url}" rel="me">The Oracle Lover</a></li>
            <li>Introverted &amp; sensitive kids</li>
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
