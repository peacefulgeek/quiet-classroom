// Tiny Markdown to HTML converter. Just enough for our article shape.
// Keeps the dependency graph small (no marked/markdown-it).

export function mdToHtml(md) {
  if (!md) return "";
  let s = String(md);

  // Normalize line endings
  s = s.replace(/\r\n?/g, "\n");

  // Escape HTML for safety EXCEPT the inline-link/anchor we'll add ourselves later
  // We'll only convert markdown-syntax pieces and leave plain text alone, since articles are our own content.

  // Code fences (rare in our articles, keep simple)
  s = s.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHtml(code)}</code></pre>`);

  // Headings
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  s = s.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Blockquotes
  s = s.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // Lists (very lightweight — single-level only)
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

  // Links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="nofollow noopener">$1</a>');

  // Paragraphs: split on blank lines, wrap non-block content in <p>
  const blocks = s.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  return blocks.map(b => {
    if (/^<(h\d|ul|ol|pre|blockquote)/.test(b)) return b;
    return `<p>${b.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
