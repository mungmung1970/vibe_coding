import { escapeHtml } from './dom.js';

const inline = (text) => escapeHtml(text)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

const isTableDivider = (line) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

/**
 * Minimal CommonMark subset (headings, tables, lists, quotes, code, rules)
 * rendered from already-escaped text, so model output can never inject markup.
 */
export function renderMarkdown(source) {
  const lines = String(source ?? '').split('\n');
  const html = [];
  let index = 0;

  const flushList = (ordered) => {
    const items = [];
    const pattern = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
    while (index < lines.length && pattern.test(lines[index])) {
      items.push(`<li>${inline(lines[index].match(pattern)[1])}</li>`);
      index += 1;
    }
    html.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
  };

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) { index += 1; continue; }

    if (/^\s*```/.test(line)) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) { code.push(lines[index]); index += 1; }
      index += 1;
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { html.push('<hr />'); index += 1; continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 6);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const head = cells(line);
      index += 2;
      const body = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        body.push(cells(lines[index]));
        index += 1;
      }
      html.push(
        `<table><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead>`
        + `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
      );
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) { flushList(false); continue; }
    if (/^\s*\d+[.)]\s+/.test(line)) { flushList(true); continue; }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }

    const startsBlock = (position) => (
      !lines[position].trim()
      || /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```)/.test(lines[position])
      || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[position])
      || (lines[position].includes('|') && isTableDivider(lines[position + 1] ?? ''))
    );

    const paragraph = [];
    while (index < lines.length && !startsBlock(index)) {
      paragraph.push(lines[index]);
      index += 1;
    }
    html.push(`<p>${inline(paragraph.join('\n')).replaceAll('\n', '<br />')}</p>`);
  }

  return html.join('\n');
}
