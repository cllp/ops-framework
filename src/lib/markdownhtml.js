/**
 * En anteckning som en fristående HTML-sida (0.209.0, cllp/lifehub.app#706).
 *
 * ── ⛔ VARFÖR DEN FINNS ──────────────────────────────────────────────────
 *
 * CP i #706 om att ladda ned en anteckning: "Skippa Word just nu, men ha med de andra", alltså Markdown, PDF och HTML. HTML-filen är en sida som går att
 * öppna, mejla och spara utan appen, och PDF:en är samma sida genom webbläsarens utskrift (`OpsBibliotek`, valet "Ladda ned som PDF").
 *
 * ── ⛔ SAMMA TOLKNING SOM VISNINGEN ──────────────────────────────────────
 *
 * Blocken och bitarna kommer ur `splitMarkdown` och `splitInline` (`lib/markdown.js`), samma som `OpsMarkdown` ritar. En egen tolkning hade gett en fil som
 * ser annorlunda ut än anteckningen i appen, och två tolkningar av samma text glider isär (regel 2).
 *
 * ── ⛔ ALLT ANVÄNDARINNEHÅLL ESCAPAS, OCH SIDAN HAR INGET SKRIPT ─────────
 *
 * `OpsMarkdown` låter aldrig HTML passera en sträng. Här MÅSTE en sträng byggas, och då är det samma sak från andra hållet: varje tecken som kommer ur texten går
 * genom `escape` (`&`, `<`, `>`, `"` och `'`), också i ett attribut. En `<script>` i anteckningen blir text i sidan. En länk får bara vara http eller https, som i
 * visningen (`splitInline` gör annat till text). En bild har ingen adress i texten, bara ett filnamn i postens mapp som en fristående sida inte når, så den skrivs
 * som sin alt-text. Ingen extern resurs: stilen är inbäddad och liten, och sidan hämtar ingenting när den öppnas.
 *
 * Funktionen är ren och känner ingen DOM: den ger en sträng.
 */
import { splitMarkdown } from "./markdown.js";

/** @param {string} s */
function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** Bara http och https blir en länk, samma regel som `splitInline`. Prövas en gång till här, eftersom en sträng byggs. @param {unknown} url */
const sakerLank = (url) => typeof url === "string" && /^https?:\/\/[^\s<>"'`]+$/i.test(url);

/**
 * Ordet för en bild utan alt-text, på sidans språk.
 * @type {Record<string, string>}
 */
const BILD = { sv: "Bild", en: "Image" };

/**
 * @param {import("./markdown.js").Bit[]} bitar
 * @param {string} sprak
 * @returns {string}
 */
function inline(bitar, sprak) {
  return bitar
    .map((b) => {
      if (b.kind === "break") return "<br>";
      if (b.kind === "code") return `<code>${escape(b.value)}</code>`;
      if (b.kind === "bold") return `<strong>${escape(b.value)}</strong>`;
      if (b.kind === "italic") return `<em>${escape(b.value)}</em>`;
      if (b.kind === "link") return sakerLank(b.url) ? `<a href="${escape(/** @type {string} */ (b.url))}">${escape(b.value)}</a>` : escape(b.value);
      // ⛔ En bild är ett filnamn i postens mapp, och den fristående sidan når inte mappen: alt-texten står där bilden stod, inom hakparentes så att den syns som en bild som saknas.
      if (b.kind === "image") return `<span class="bild">[${escape(b.value || BILD[sprak] || BILD.sv)}]</span>`;
      return escape(b.value);
    })
    .join("");
}

/** Den inbäddade stilen. Liten, utan typsnitt utifrån, och läsbar både på skärm och i en utskrift. */
const STIL =
  "body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.55;color:#1b1b1b;background:#fff;max-width:46rem;margin:0 auto;padding:2rem 1.25rem}" +
  "h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.4em 0 .5em}h1{font-size:1.8em}h2{font-size:1.45em}h3{font-size:1.2em}" +
  "p,ul,ol,blockquote,pre,table{margin:0 0 1em}blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:1em;color:#444}" +
  "code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92em;background:#f3f3f3;padding:.1em .3em;border-radius:3px}" +
  "pre{background:#f3f3f3;padding:.8em 1em;overflow:auto;border-radius:4px;white-space:pre-wrap}pre code{background:none;padding:0}" +
  "table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:.35em .6em;text-align:left;vertical-align:top}th{background:#f6f6f6}" +
  "hr{border:0;border-top:1px solid #ccc;margin:1.5em 0}a{color:#0b57d0}.kryss{list-style:none;padding-left:0}.bild{color:#666;font-style:italic}" +
  "@media print{body{padding:0;max-width:none}a{color:inherit}}";

/**
 * Markdown som en fristående, statisk HTML-sida. Se filens huvud.
 *
 * @param {string | null | undefined} text Anteckningens text.
 * @param {{ titel?: string, sprak?: string }} [val] `titel` står i `<title>` och som sidans rubrik, utom när texten själv börjar med en nivå-ett-rubrik (då hade
 *   samma rubrik stått två gånger). `sprak` är sidans `lang`, förval `sv`.
 * @returns {string}
 */
export function markdownSomHtml(text, val = {}) {
  const titel = typeof val.titel === "string" ? val.titel.trim() : "";
  const sprak = val.sprak === "en" ? "en" : "sv";
  const block = splitMarkdown(typeof text === "string" ? text : "");
  const delar = block.map((b) => {
    if (b.kind === "heading") {
      const n = Math.min(Math.max(b.level, 1), 6);
      return `<h${n}>${inline(b.inline, sprak)}</h${n}>`;
    }
    if (b.kind === "paragraph") return `<p>${inline(b.inline, sprak)}</p>`;
    if (b.kind === "quote") return `<blockquote><p>${inline(b.inline, sprak)}</p></blockquote>`;
    if (b.kind === "code") return `<pre><code>${escape(b.text)}</code></pre>`;
    if (b.kind === "rule") return "<hr>";
    if (b.kind === "list") {
      const tagg = b.ordered ? "ol" : "ul";
      const kryss = b.entries.some((e) => e.cross !== null);
      const rader = b.entries
        .map((e) => (e.cross === null ? `<li>${inline(e.inline, sprak)}</li>` : `<li><input type="checkbox" disabled${e.cross ? " checked" : ""}> ${inline(e.inline, sprak)}</li>`))
        .join("");
      return `<${tagg}${kryss ? ' class="kryss"' : ""}>${rader}</${tagg}>`;
    }
    if (b.kind === "table") {
      const huvud = `<tr>${b.header.map((c) => `<th>${inline(c, sprak)}</th>`).join("")}</tr>`;
      const kropp = b.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, sprak)}</td>`).join("")}</tr>`).join("");
      return `<table><thead>${huvud}</thead><tbody>${kropp}</tbody></table>`;
    }
    return "";
  });
  const forsta = block[0];
  const egenRubrik = forsta && forsta.kind === "heading" && forsta.level === 1 ? forsta.inline.map((b) => b.value).join("") : null;
  const rubrik = titel && egenRubrik === null ? `<h1>${escape(titel)}</h1>` : "";
  const sidtitel = titel || egenRubrik || "";
  return `<!doctype html>\n<html lang="${sprak}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escape(sidtitel)}</title>\n<style>${STIL}</style>\n</head>\n<body>\n${rubrik}${delar.join("\n")}\n</body>\n</html>\n`;
}
