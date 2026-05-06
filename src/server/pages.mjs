// All page renderers. Pure functions: take data, return HTML strings.

import { SITE, PILLARS } from "../lib/site.mjs";
import { layout, escape } from "./layout.mjs";
import { mdToHtml } from "../lib/markdown.mjs";

// ---------- HOME ----------
export function renderHome({ featured, recent }) {
  const heroArticle = featured;
  const hero = heroArticle
    ? `<section class="hero" style="background-image:url('${escape(heroArticle.heroUrl || SITE.defaultOgImage)}')">
         <div class="hero__inner">
           <div class="hero__kicker">${escape(heroArticle.category || "Featured")}</div>
           <h1 class="hero__title"><a href="/articles/${escape(heroArticle.slug)}" style="color:inherit;text-decoration:none">${escape(heroArticle.title)}</a></h1>
           <div class="hero__meta">${heroArticle.readingTime || 8} min read &middot; by ${escape(SITE.author.name)}</div>
         </div>
       </section>`
    : "";

  const recentCards = recent.map(a => `
    <a class="article-card" href="/articles/${escape(a.slug)}">
      <img src="${escape(a.heroUrl || SITE.defaultOgImage)}" alt="" loading="lazy">
      <div class="article-card__body">
        <div class="article-card__meta">${escape(a.category || "Article")}</div>
        <h3>${escape(a.title)}</h3>
        <p>${escape(a.metaDescription || "")}</p>
      </div>
    </a>`).join("");

  const body = `
    <section class="container intro-block">
      <div class="intro-block__kicker">For parents of sensitive children</div>
      <h2 class="intro-block__title">${escape(SITE.tagline)}</h2>
      <p class="intro-block__lede">${escape(SITE.pitch)}</p>
      <p style="margin-top:24px"><a class="category-pill" href="/articles">All articles</a> <a class="category-pill" href="/assessments">9 assessments</a> <a class="category-pill" href="/herbs">Herbs &amp; TCM</a></p>
    </section>
    <section class="container-wide">
      <h2 style="border:0;padding:24px 0 0;">Recent writing</h2>
      <div class="article-grid">${recentCards}</div>
    </section>
    <section class="cta-strip"><div class="container">
      <h3>Tired of advice that doesn't fit your kid?</h3>
      <p>Start with the assessments. They take five minutes and they will help you find your bearings.</p>
      <a class="btn" href="/assessments">Try the assessments</a>
    </div></section>`;
  return layout({
    title: SITE.name,
    description: SITE.tagline,
    path: "/",
    showHero: !!hero,
    hero,
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebSite", "@id": `${SITE.baseUrl}#website`, url: SITE.baseUrl, name: SITE.name, publisher: { "@id": `${SITE.baseUrl}#person` } },
        { "@type": "Person", "@id": `${SITE.baseUrl}#person`, name: SITE.author.name, url: SITE.author.url, image: SITE.author.avatar, jobTitle: SITE.author.title, description: SITE.author.bio },
        { "@type": "Organization", "@id": `${SITE.baseUrl}#org`, name: SITE.name, url: SITE.baseUrl, founder: { "@id": `${SITE.baseUrl}#person` } },
      ],
    },
  });
}

// ---------- ARTICLES INDEX ----------
export function renderArticlesIndex({ articles, category }) {
  const filtered = category ? articles.filter(a => slugify(a.category) === category) : articles;
  const cards = filtered.map(a => `
    <a class="article-card" href="/articles/${escape(a.slug)}">
      <img src="${escape(a.heroUrl || SITE.defaultOgImage)}" alt="" loading="lazy">
      <div class="article-card__body">
        <div class="article-card__meta">${escape(a.category || "Article")}</div>
        <h3>${escape(a.title)}</h3>
        <p>${escape(a.metaDescription || "")}</p>
      </div>
    </a>`).join("");
  const pills = PILLARS.map(p => `<a class="category-pill" href="/articles?category=${escape(p.slug)}">${escape(p.title)}</a>`).join(" ");
  const body = `
    <section class="container intro-block">
      <div class="intro-block__kicker">All articles</div>
      <h2 class="intro-block__title">${category ? "Browsing: " + escape(category) : "Every piece, plainly written"}</h2>
      <div style="margin-top:18px">${pills} ${category ? '<a class="category-pill" href="/articles">All</a>' : ""}</div>
    </section>
    <section class="container-wide"><div class="article-grid">${cards || "<p>No articles yet.</p>"}</div></section>`;
  return layout({
    title: category ? `${category} Articles` : "All Articles",
    description: `Articles on ${SITE.name}.`,
    path: category ? `/articles?category=${category}` : "/articles",
    body,
  });
}

// ---------- ARTICLE ----------
export function renderArticle(article) {
  const html = mdToHtml(article.body || "");
  const hero = `<section class="hero" style="background-image:url('${escape(article.heroUrl || SITE.defaultOgImage)}')">
    <div class="hero__inner">
      <div class="hero__kicker">${escape(article.category || "Article")}</div>
      <h1 class="hero__title">${escape(article.title)}</h1>
      <div class="hero__meta">${article.readingTime || 8} min read &middot; by ${escape(SITE.author.name)}${article.publishedAt ? " &middot; " + new Date(article.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}</div>
    </div>
  </section>`;
  const tldrHtml = article.tldr ? `<div class="article__tldr">${escape(article.tldr)}</div>` : "";
  const tagsHtml = (article.tags || []).map(t => `<span class="tag-pill">${escape(t)}</span>`).join("");
  const bioCard = `<div class="bio-card">
    <img src="${escape(SITE.author.avatar)}" alt="${escape(SITE.author.name)}">
    <div>
      <h4>${escape(SITE.author.name)}</h4>
      <p>${escape(SITE.author.bio)}</p>
      <a href="${escape(SITE.author.url)}" rel="me">Read more from The Oracle Lover &rarr;</a>
    </div>
  </div>`;
  const body = `
    <article class="article">
      <div class="container">
        ${tldrHtml}
        <div class="article__byline">By <a href="${escape(SITE.author.url)}">${escape(SITE.author.name)}</a></div>
        ${html}
        ${bioCard}
        <div style="margin-top:24px">${tagsHtml}</div>
      </div>
    </article>`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${SITE.baseUrl}/articles/${article.slug}#article`,
        headline: article.title,
        description: article.metaDescription || article.tldr || "",
        image: [article.heroUrl || SITE.defaultOgImage],
        datePublished: article.publishedAt ? new Date(article.publishedAt).toISOString() : new Date().toISOString(),
        dateModified: article.dateModified ? new Date(article.dateModified).toISOString() : (article.publishedAt ? new Date(article.publishedAt).toISOString() : new Date().toISOString()),
        author: { "@id": `${SITE.baseUrl}#person` },
        publisher: { "@id": `${SITE.baseUrl}#org` },
        mainEntityOfPage: `${SITE.baseUrl}/articles/${article.slug}`,
        wordCount: (article.body || "").trim().split(/\s+/).length,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.baseUrl },
          { "@type": "ListItem", position: 2, name: "Articles", item: `${SITE.baseUrl}/articles` },
          { "@type": "ListItem", position: 3, name: article.title, item: `${SITE.baseUrl}/articles/${article.slug}` },
        ],
      },
    ],
  };
  return layout({
    title: article.title,
    description: article.metaDescription || article.tldr || "",
    path: `/articles/${article.slug}`,
    ogImage: article.ogImage || article.heroUrl,
    showHero: true,
    hero,
    body,
    jsonLd,
  });
}

// ---------- HERBS INDEX ----------
export function renderHerbsIndex({ herbs }) {
  const grouped = {};
  for (const h of herbs) (grouped[h.category] ||= []).push(h);
  const sections = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => `
    <section style="margin:36px 0">
      <h2 style="border:0;padding-top:0">${escape(cat)} <span style="font-family:'DM Sans',sans-serif;font-size:0.9rem;color:#7080B4">(${items.length})</span></h2>
      <div class="herb-grid">
        ${items.map(h => `
          <div class="herb-card">
            <h3><a href="/herbs/${escape(h.slug)}" style="text-decoration:none">${escape(h.name)}</a></h3>
            ${h.latin ? `<div class="latin">${escape(h.latin)}</div>` : ""}
            <p>${escape(h.blurb.split(". ")[0] + ".")}</p>
            <a class="shop" href="${escape(h.amazon)}" rel="nofollow noopener sponsored" target="_blank">Shop on Amazon</a>
          </div>`).join("")}
      </div>
    </section>`).join("");
  const body = `
    <section class="container intro-block">
      <div class="intro-block__kicker">Herbs &amp; holistic library</div>
      <h2 class="intro-block__title">${herbs.length} herbs, supplements, and TCM formulas</h2>
      <p class="intro-block__lede">Curated for parents of sensitive kids. Always work with your pediatrician and a licensed practitioner before starting anything new.</p>
    </section>
    <section class="container-wide">${sections}</section>`;
  return layout({
    title: "Herbs, TCM &amp; Supplements",
    description: `${herbs.length} herbs, supplements, and TCM formulas curated for parents of sensitive children.`,
    path: "/herbs",
    body,
  });
}

// ---------- HERB DETAIL ----------
export function renderHerb(h) {
  const body = `
    <section class="container intro-block">
      <div class="intro-block__kicker">${escape(h.category)}</div>
      <h1 class="intro-block__title">${escape(h.name)}</h1>
      ${h.latin ? `<p style="font-style:italic;color:rgba(26,35,48,0.6);margin-top:-8px">${escape(h.latin)}</p>` : ""}
    </section>
    <section class="container">
      <p>${escape(h.blurb)}</p>
      <h3>Typical pediatric dose</h3>
      <p>${escape(h.dose)}</p>
      <h3>Safety notes</h3>
      <p>${escape(h.safety)}</p>
      <p style="margin-top:32px"><a class="shop" href="${escape(h.amazon)}" rel="nofollow noopener sponsored" target="_blank" style="display:inline-block;padding:12px 28px;background:#7080B4;color:#fff;border-radius:999px;text-decoration:none">Shop on Amazon</a></p>
      <p style="margin-top:24px"><a href="/herbs">&larr; Back to all herbs</a></p>
    </section>`;
  return layout({
    title: h.name,
    description: h.blurb.split(".").slice(0, 2).join(".") + ".",
    path: `/herbs/${h.slug}`,
    body,
  });
}

// ---------- ASSESSMENTS ----------
export function renderAssessmentsIndex({ assessments }) {
  const cards = assessments.map(a => `
    <a class="assessment-card" href="/assessments/${escape(a.slug)}" style="text-decoration:none;color:inherit">
      <h3>${escape(a.title)}</h3>
      <p>${escape(a.subtitle)}</p>
      <span class="article-card__meta">${a.questions.length} questions</span>
    </a>`).join("");
  const body = `
    <section class="container intro-block">
      <div class="intro-block__kicker">Self-assessments</div>
      <h2 class="intro-block__title">Nine gentle screens. Free. Private.</h2>
      <p class="intro-block__lede">Run privately in your browser. Nothing is uploaded. Nothing is stored. None of these are diagnostic. They are starting points for the conversation you are about to have with your pediatrician, your child's teacher, or yourself.</p>
    </section>
    <section class="container-wide"><div class="assessment-grid">${cards}</div></section>`;
  return layout({
    title: "Free Assessments for Parents",
    description: "Nine free, private self-assessments for parents of sensitive children.",
    path: "/assessments",
    body,
  });
}

export function renderAssessment(a) {
  const items = a.questions.map((q, i) => `
    <li>
      <div>${escape(q)}</div>
      <div class="answers">
        <label><input type="radio" name="q${i}" value="3"> Often</label>
        <label><input type="radio" name="q${i}" value="2"> Sometimes</label>
        <label><input type="radio" name="q${i}" value="1"> Rarely</label>
        <label><input type="radio" name="q${i}" value="0"> Never</label>
      </div>
    </li>`).join("");
  const body = `
    <section class="container intro-block">
      <div class="intro-block__kicker">Self-assessment</div>
      <h1 class="intro-block__title">${escape(a.title)}</h1>
      <p class="intro-block__lede">${escape(a.subtitle)}</p>
    </section>
    <section class="container">
      <form class="assessment-form" id="assessment-form" data-count="${a.questions.length}">
        <ol>${items}</ol>
        <button type="submit">See my read</button>
        <div id="result" style="margin-top:24px"></div>
      </form>
    </section>
    <script>
    document.getElementById("assessment-form").addEventListener("submit", function(e){
      e.preventDefault();
      var n = parseInt(this.dataset.count, 10);
      var max = n * 3;
      var sum = 0, answered = 0;
      for (var i=0; i<n; i++) {
        var v = this.querySelector('input[name="q'+i+'"]:checked');
        if (v) { sum += parseInt(v.value, 10); answered++; }
      }
      var pct = max ? Math.round((sum / max) * 100) : 0;
      var read;
      if (answered < n) {
        read = "Answer all the questions for the best read.";
      } else if (pct >= 70) {
        read = "Strong signal. The pattern fits well. Use this with a clinician or specialist as a starting point.";
      } else if (pct >= 40) {
        read = "Mixed signal. The trait is present but situational. Track patterns for two weeks and revisit.";
      } else {
        read = "Light signal. This trait may be peripheral. Keep observing and trust your read.";
      }
      var el = document.getElementById("result");
      el.innerHTML = '<div class="article__tldr"><strong>Score: '+sum+' of '+max+' ('+pct+'%)</strong><br>'+read+'</div>';
      el.scrollIntoView({behavior:"smooth"});
    });
    </script>`;
  return layout({
    title: a.title,
    description: a.subtitle,
    path: `/assessments/${a.slug}`,
    body,
  });
}

// ---------- RECOMMENDED ----------
export function renderRecommended({ products }) {
  const grouped = {};
  for (const p of products) (grouped[p.category] ||= []).push(p);
  const sections = Object.entries(grouped).sort().map(([cat, items]) => `
    <section style="margin:36px 0">
      <h2 style="border:0;padding-top:0">${escape(cat)}</h2>
      <ul>${items.map(p => `<li><a href="https://www.amazon.com/dp/${escape(p.asin)}?tag=${SITE.amazonTag}" rel="nofollow noopener sponsored" target="_blank">${escape(p.name)}</a>${p.author ? " &mdash; " + escape(p.author) : ""}</li>`).join("")}</ul>
    </section>`).join("");
  const body = `
    <section class="container intro-block">
      <div class="intro-block__kicker">Affiliate disclosure: ${escape(SITE.affiliateDisclosure)}</div>
      <h2 class="intro-block__title">Recommended for sensitive kids</h2>
      <p class="intro-block__lede">Books, sensory tools, sleep aids, supplements, and classroom accommodations the Oracle Lover actually uses or sources for clients.</p>
    </section>
    <section class="container-wide">${sections}</section>`;
  return layout({
    title: "Recommended Tools, Books &amp; Supplements",
    description: "Curated tools, books, and supplements for parents of sensitive children.",
    path: "/recommended",
    body,
  });
}

// ---------- ABOUT / PRIVACY ----------
export function renderAbout() {
  const body = `
    <section class="container intro-block">
      <div class="intro-block__kicker">About</div>
      <h2 class="intro-block__title">A quiet classroom is a real one</h2>
    </section>
    <section class="container">
      <p>${escape(SITE.pitch)}</p>
      <div class="bio-card">
        <img src="${escape(SITE.author.avatar)}" alt="${escape(SITE.author.name)}">
        <div>
          <h4>${escape(SITE.author.name)}</h4>
          <p>${escape(SITE.author.bio)}</p>
          <a href="${escape(SITE.author.url)}" rel="me">More from The Oracle Lover &rarr;</a>
        </div>
      </div>
      <h3>What you'll find here</h3>
      <ul>
        <li>Plain-spoken articles on introversion, anxiety, sensory needs, and school</li>
        <li>Nine private self-assessments to clarify what's going on with your kid</li>
        <li>A curated 200+ herb, supplement, and TCM library, with safety notes</li>
        <li>A no-nonsense recommended-tools list, affiliate-funded so the writing stays free</li>
      </ul>
      <h3>What you won't find</h3>
      <ul>
        <li>"Just try harder." We do not say that here.</li>
        <li>Toxic positivity. Your exhaustion is real.</li>
        <li>Unfounded medical claims. Always pair this site with your pediatrician.</li>
      </ul>
    </section>`;
  return layout({
    title: "About",
    description: `About ${SITE.name} and The Oracle Lover.`,
    path: "/about",
    body,
  });
}

export function renderPrivacy() {
  const body = `
    <section class="container intro-block">
      <h2 class="intro-block__title">Privacy &amp; Disclosure</h2>
    </section>
    <section class="container">
      <h3>What we collect</h3>
      <p>This site uses minimal first-party analytics. We do not run third-party trackers. Email addresses, if you give them, are stored only to send the newsletter you asked for. Assessment results never leave your browser.</p>
      <h3>Affiliate disclosure</h3>
      <p>${escape(SITE.affiliateDisclosure)} Some links on this site are Amazon affiliate links (Amazon tag <code>${SITE.amazonTag}</code>). When you buy through them you pay nothing extra and a small commission supports the writing here.</p>
      <h3>Medical disclaimer</h3>
      <p>${escape(SITE.disclaimer)}</p>
      <h3>Contact</h3>
      <p>For questions, write to The Oracle Lover at <a href="${escape(SITE.author.url)}" rel="me">${escape(SITE.author.url)}</a>.</p>
    </section>`;
  return layout({
    title: "Privacy &amp; Disclosure",
    description: "Privacy policy and affiliate disclosure for A Quiet Classroom.",
    path: "/privacy",
    body,
  });
}

export function render404({ path }) {
  const body = `
    <section class="container intro-block">
      <div class="intro-block__kicker">404</div>
      <h2 class="intro-block__title">That page took a recharge break.</h2>
      <p class="intro-block__lede">There is no page at <code>${escape(path)}</code>. Try the <a href="/articles">articles</a>, the <a href="/herbs">herbs library</a>, or the <a href="/assessments">assessments</a>.</p>
    </section>`;
  return layout({ title: "Not found", description: "Page not found.", path, body });
}

function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
