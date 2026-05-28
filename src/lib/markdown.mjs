// Tiny Markdown to HTML converter. Just enough for our article shape.
// Keeps the dependency graph small (no marked/markdown-it).

import { SITE } from "./site.mjs";

// Pull TL/DR section verbatim out of the body before any markdown processing,
// so the `<section data-tldr="ai-overview">` HTML survives intact.
function extractRawBlocks(md) {
  const placeholders = [];
  const out = String(md).replace(/<section\b[^>]*data-tldr="ai-overview"[\s\S]*?<\/section>/gi, (m) => {
    const token = `__RAW_BLOCK_${placeholders.length}__`;
    placeholders.push(m);
    return `\n\n${token}\n\n`;
  });
  return { md: out, placeholders };
}

function restoreRawBlocks(html, placeholders) {
  let out = html;
  for (let i = 0; i < placeholders.length; i++) {
    const token = `__RAW_BLOCK_${i}__`;
    out = out.replace(new RegExp(`<p>${token}</p>|${token}`, "g"), placeholders[i]);
  }
  return out;
}

export function mdToHtml(md) {
  if (!md) return "";
  let raw = String(md).replace(/\r\n?/g, "\n");
  const { md: cleaned, placeholders } = extractRawBlocks(raw);
  let s = cleaned;

  // Code fences
  s = s.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHtml(code)}</code></pre>`);

  // Headings
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  s = s.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Blockquotes
  s = s.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // Lists (single-level)
  s = s.replace(/(^|\n)((?:- .+(?:\n|$))+)/g, (_, lead, block) => {
    const items = block.trim().split(/\n/).map(l => l.replace(/^- /, "").trim()).map(li => `<li>${li}</li>`).join("");
    return `${lead}<ul>${items}</ul>`;
  });
  s = s.replace(/(^|\n)((?:\d+\. .+(?:\n|$))+)/g, (_, lead, block) => {
    const items = block.trim().split(/\n/).map(l => l.replace(/^\d+\. /, "").trim()).map(li => `<li>${li}</li>`).join("");
    return `${lead}<ol>${items}</ol>`;
  });

  // Bold + italic
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Links: outbound (off-site) get rel="nofollow noopener sponsored" + target=_blank;
  // internal links (same apex or relative) get rel="noopener" only.
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const isExternal = /^https?:\/\//i.test(href) && !href.includes(SITE.apex);
    if (isExternal) {
      return `<a href="${href}" rel="nofollow noopener" target="_blank">${label}</a>`;
    }
    return `<a href="${href}" rel="noopener">${label}</a>`;
  });

  // Paragraphs: split on blank lines, wrap non-block content in <p>
  const blocks = s.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  let out = blocks.map(b => {
    if (/^<(h\d|ul|ol|pre|blockquote|section|div|aside|figure)/.test(b)) return b;
    if (/^__RAW_BLOCK_\d+__$/.test(b)) return b;
    return `<p>${b.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  out = restoreRawBlocks(out, placeholders);
  return out;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
