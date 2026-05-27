// All page renderers. Pure functions: take data, return HTML strings.

import { SITE, PILLARS } from "../lib/site.mjs";
import { layout, escape } from "./layout.mjs";
import { mdToHtml } from "../lib/markdown.mjs";

// ---------- HOME ----------
// Force the live site to skip stale Bunny edge cache after we regenerate heroes;
// bump this string when we replace any hero so users always see the latest.
const HERO_CACHE_VERSION = process.env.HERO_CACHE_VERSION || "2026-05-27";
function heroSrc(url) {
  if (!url) return SITE.defaultOgImage + "?v=" + HERO_CACHE_VERSION;
  if (url.includes("?")) return url;
  return url + "?v=" + HERO_CACHE_VERSION;
}
// Strip leading literal *TL;DR:* asterisks from any text used as a card excerpt
function cleanCardExcerpt(text = "") {
  let t = String(text || "").trim();
  // remove leading literal *TL;DR:* / *TL;DR …* markdown italics wrapper
  t = t.replace(/^\*+\s*TL;DR:?\s*/i, "").replace(/\s*\*+$/, "");
  // remove any leading bare "TL;DR:"
  t = t.replace(/^TL;DR:?\s*/i, "");
  // collapse stray asterisks at start/end
  t = t.replace(/^[*_]+|[*_]+$/g, "").trim();
  return t;
}

function articleCard(a) {
  const excerpt = cleanCardExcerpt(a.metaDescription || a.tldr || "");
  return `
    <a class="article-card" href="/articles/${escape(a.slug)}">
      <img src="${escape(heroSrc(a.heroUrl))}" alt="" loading="lazy">
      <div class="article-card__body">
        <div class="article-card__meta">${escape(a.category || "Article")}</div>
        <h3>${escape(a.title)}</h3>
        <p>${escape(excerpt)}</p>
      </div>
    </a>`;
}

export function renderHome({ featured, recent }) {
  const heroArticle = featured;
  const hero = heroArticle
    ? `<section class="hero" style="background-image:url('${escape(heroSrc(heroArticle.heroUrl))}')">
         <div class="hero__inner">
           <div class="hero__kicker">${escape(heroArticle.category || "Featured")}</div>
           <h1 class="hero__title"><a href="/articles/${escape(heroArticle.slug)}" style="color:inherit;text-decoration:none">${escape(heroArticle.title)}</a></h1>
           <div class="hero__meta">${heroArticle.readingTime || 8} min read &middot; by ${escape(SITE.author.name)}</div>
         </div>
       </section>`
    : "";

  // Pick six curated jump-offs from recent: prefer one per category to give variety
  const seenCat = new Set();
  const jumps = [];
  for (const a of recent) {
    const c = (a.category || "").toLowerCase();
    if (seenCat.has(c)) continue;
    seenCat.add(c);
    jumps.push(a);
    if (jumps.length >= 6) break;
  }
  while (jumps.length < 6 && recent.length > jumps.length) jumps.push(recent[jumps.length]);

  const jumpoffsHtml = jumps.map(a => `
    <a class="jumpoff" href="/articles/${escape(a.slug)}">
      <div class="jumpoff__kicker">${escape(a.category || "Article")}</div>
      <div class="jumpoff__title">${escape(a.title)}</div>
      <p class="jumpoff__excerpt">${escape(cleanCardExcerpt(a.metaDescription || a.tldr || ""))}</p>
    </a>`).join("");

  const recentCards = recent.slice(0, 9).map(articleCard).join("");

  const body = `
    <section class="container intro-block">
      <div class="intro-block__kicker">For parents of sensitive children</div>
      <h2 class="intro-block__title">A quiet kid is not a broken kid.</h2>
      <p class="intro-block__lede">A Quiet Classroom is a long, slow, honest field guide for the parents of children whose nervous systems were built differently \u2014 the introverts, the highly sensitive, the anxious, the ones who come home and unravel.</p>
    </section>

    <section class="container home-essay">
      <p class="lede">If you have ended a school day in your car, in the pickup line, mouthing the words \u201Cwhat happened to my child today,\u201D this site is for you. We have been there too. None of this is rare. Some of it is fixable. All of it is survivable.</p>

      <p>Most parenting writing on the internet is built for the loud kid. It assumes your child wants attention and that the path to thriving is more activities, more friends, more confidence drills, more scheduled fun. If you are reading this you probably already know that none of that fits your child. Your child is not broken. Your child is wired toward depth, toward observation, toward solitude as fuel. School is, by design, the opposite. It is loud. It is fast. It is built around extroverts. After six hours of social and sensory load your child is not being defiant when they melt down at the kitchen table. They are honestly tired in a way that the louder kids never have to be.</p>

      <p>This is the resource we wished existed when our own kids first started masking at school. We have done the IEP meetings. We have read the temperament literature, the polyvagal stuff, the sensory-integration research, the Susan Cain canon, the Elaine Aron books, the Stanley Greenspan papers. We have also tried, and sometimes failed, the Monday-morning experiments \u2014 the visual schedules, the noise-cancelling headphones, the after-school decompression protocols, the gentle exit-from-the-classroom plan. Our writing is not theory. It is what we actually did, what worked, what didn\u2019t, and what we wish someone had told us six months earlier. <a class="inline" href="/articles">Browse every article \u2192</a></p>

      <h3>Where to start</h3>
      <p>If your child is the one hiding in the bathroom before first period, start with <a class="inline" href="/articles?category=introversion-vs-anxiety">Introversion vs. Anxiety</a>. If they came home today and bit a sibling, start with <a class="inline" href="/articles?category=after-school">After-School Recovery</a>. If your gut is saying we need a 504 or an IEP, start with <a class="inline" href="/articles?category=iep-and-504">IEPs and 504 Plans</a>. If your child is melting down at the kitchen table over a worksheet that should take twelve minutes, start with <a class="inline" href="/articles?category=homework-and-learning">Homework and Learning</a>.</p>

      <p>If you are not sure where to begin, we built a small set of <a class="inline" href="/assessments">private self-assessments</a> that run in your browser. Nothing is uploaded. Nothing is stored. They are not diagnostic. They are starting points for the conversation you are about to have with your pediatrician, your child\u2019s teacher, or yourself at midnight when you cannot sleep.</p>

      <h3>What we believe</h3>
      <p>We believe in low-arousal parenting and high-belief parenting at the same time. We believe in working <em>with</em> the nervous system rather than against it. We believe sleep is medicine, that magnesium and L-theanine are not silly, that screens after 7pm steal the next morning, that one safe adult at school changes the entire arc, and that you do not have to be a perfectly regulated parent to raise a regulated child \u2014 you only have to repair faster than you rupture. We believe school refusal is communication and that the appropriate response is curiosity, not consequences. We believe asking for accommodations is not coddling. We believe most of what is called bad behavior in a sensitive child is actually unmet need.</p>

      <h3>Plain talk, not catastrophizing</h3>
      <p>You will not find toxic positivity here. You will not find catastrophe either. We are allergic to both. The articles are written to be read at 10pm with cold tea, and to give you one specific thing you can try Monday morning. We use plain language, real research, and the tools we have actually used in our own homes and with families we work with. We try to make every piece long enough to be useful and short enough to fit between bedtime and your own collapse.</p>

      <p>If you find a piece that helps, share it with the parent in your life who needs it. If you find one that misses, write to us \u2014 the goal is not to be right, the goal is to be useful. <a class="inline" href="/about">More about who we are \u2192</a></p>
    </section>

    <section class="container-wide">
      <hr class="section-rule" />
      <h2 style="border:0;padding:0 24px;">Start somewhere</h2>
      <div class="jumpoffs" style="padding-left:24px;padding-right:24px;">${jumpoffsHtml}</div>
    </section>

    <section class="container-wide">
      <hr class="section-rule" />
      <h2 style="border:0;padding:0 24px;">Recent writing</h2>
      <div class="article-grid">${recentCards}</div>
    </section>

    <section class="cta-strip"><div class="container">
      <h3>Tired of advice that doesn\u2019t fit your kid?</h3>
      <p>The assessments take five minutes. The articles are honest. The herbs and supplements pages are sourced. Start anywhere.</p>
      <a class="btn" href="/assessments">Try the assessments</a>
      <a class="btn" href="/articles" style="margin-left:10px;background:#5b6fa5">Browse all articles</a>
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
  const cards = filtered.map(articleCard).join("");
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

// Clean an article markdown body for rendering: drop the leading H1 (we render the title in the hero),
// drop the leading literal *TL;DR: ...* paragraph (we render `tldr` separately above),
// and drop trailing tonal closers like `*Tat Tvam Asi.*` / `*Sat Chit Ananda.*` that don't fit a parenting site.
function cleanArticleBody(md = "") {
  let s = String(md || "").replace(/\r\n/g, "\n").trim();
  // 1. drop leading H1
  s = s.replace(/^#\s.+\n+/, "");
  // 2. drop leading italics TL;DR paragraph (one paragraph)
  s = s.replace(/^\*+\s*TL;DR:?[\s\S]*?\*+\s*\n+/i, "");
  // 3. drop trailing Sanskrit / mantra closers (any italic single-line closers at end)
  const tonalClosers = [
    /\*+\s*Tat\s+Tvam\s+Asi\.?\s*\*+\s*$/i,
    /\*+\s*Sat\s+Chit\s+Ananda\.?\s*\*+\s*$/i,
    /\*+\s*Aham\s+Brahmasmi\.?\s*\*+\s*$/i,
    /\*+\s*So\s+Hum\.?\s*\*+\s*$/i,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const rx of tonalClosers) {
      const before = s;
      s = s.replace(rx, "").trimEnd();
      if (s !== before) changed = true;
    }
  }
  return s.trim();
}

// ---------- ARTICLE ----------
export function renderArticle(article) {
  const html = mdToHtml(cleanArticleBody(article.body || ""));
  const hero = `<section class="hero" style="background-image:url('${escape(heroSrc(article.heroUrl))}')">
    <div class="hero__inner">
      <div class="hero__kicker">${escape(article.category || "Article")}</div>
      <h1 class="hero__title">${escape(article.title)}</h1>
      <div class="hero__meta">${article.readingTime || 8} min read &middot; by ${escape(SITE.author.name)}${article.publishedAt ? " &middot; " + new Date(article.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}</div>
    </div>
  </section>`;
  const cleanTldr = (article.tldr || "").replace(/^\*+\s*TL;DR:?\s*/i, "").replace(/\s*\*+$/, "").replace(/^TL;DR:?\s*/i, "").trim();
  const tldrHtml = cleanTldr ? `<div class="article__tldr"><strong>TL;DR \u00b7</strong> ${escape(cleanTldr)}</div>` : "";
  const tagsHtml = (article.tags || []).map(t => `<span class="tag-pill">${escape(t)}</span>`).join("");
  const dateLong = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
  const bylineHtml = `<div class="article__byline" style="display:flex;align-items:center;gap:12px;margin:0 0 28px;">
    <img src="${escape(SITE.author.avatar)}" alt="${escape(SITE.author.name)}" width="48" height="48" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" loading="lazy">
    <span>By <a href="${escape(SITE.author.url)}" rel="me">${escape(SITE.author.name)}</a>${dateLong ? " \u00b7 " + escape(dateLong) : ""}${article.readingTime ? " \u00b7 " + article.readingTime + " min read" : ""}</span>
  </div>`;
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
        ${bylineHtml}
        ${tldrHtml}
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
