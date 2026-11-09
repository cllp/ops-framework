/**
 * Namnen för en anteckning som fil (0.209.1, cllp/lifehub.app#706): är ett filnamn markdown, och vad heter en anteckning när den sparas som fil.
 *
 * ⛔ EGEN LITEN MODUL, UTBRUTEN UR `anteckningsfil.js`. `OpsBibliotek` behöver de här två när biblioteket ritas (är den valda filen en .md?) och när en .md laddas ned, och
 * resten (`markdownSomAnteckning`, och `markdownSomHtml` i `markdownhtml.js`) först när någon lägger in en .md eller laddar ned som HTML eller PDF. Med allt i en modul hade
 * det lästs in i appens startpaket för varje användare (`check:jsstorlek` i lifehub.app mätte +4 kB för 0.209.0); nu läses det in när det behövs.
 */

/** Ändelserna som gör en fil till markdown, oavsett vad webbläsaren säger om typen (text/markdown, text/x-markdown eller ingenting). */
const MARKDOWN_ANDELSE = /\.(md|markdown)$/i;

/**
 * Är filnamnet en markdownfil (`.md` eller `.markdown`, oavsett versaler)?
 * @param {unknown} namn
 * @returns {boolean}
 */
export function arMarkdownFilnamn(namn) {
  return typeof namn === "string" && MARKDOWN_ANDELSE.test(namn.trim());
}

/**
 * Rubriken som ett säkert filnamn, med ändelsen. Se filens huvud.
 *
 * @param {unknown} rubrik
 * @param {string} andelse Utan punkt: `md`, `html` eller `pdf`.
 * @returns {string}
 */
export function anteckningFilnamn(rubrik, andelse) {
  const ren = String(rubrik ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 120)
    .trim();
  return `${ren || "anteckning"}.${andelse}`;
}
