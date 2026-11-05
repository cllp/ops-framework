/**
 * En fil i gruppens GitHub-repo som en post i Biblioteket (0.186.0, cllp/lifehub.app#653).
 *
 * CP: "Har inte kunnat öppna dokument från mobile eller webläsare i github på ett bra sätt". En länk till en fil på github.com skickade personen ut ur appen,
 * till GitHubs egen sida, som är trång i en telefon och kräver en inloggning till.
 *
 * ══ ⛔ INGEN NY POSTTYP OCH INGA NYA FÄLT (regel 2) ═══════════════════════════════════════════════════════════════════════════
 *
 * En sådan post ÄR en vanlig länk (`typ: "lank"`) vars `url` har formen `https://github.com/<ägare>/<repo>/blob/<ref>/<sökväg>`. Repo, ref, sökväg, filnamn,
 * ändelse och sort härleds ur adressen vid läsning av `githubDokument`, och ingenstans lagras de en gång till. `kalla` förblir `annat`: `LANKKALLOR` i `lankkalla.js`
 * gäller oEmbed-källor (titel och omslag ur en musiktjänst), och en ändring där kräver en regeldeploy.
 *
 * ══ ⛔ VAD SOM ÄR EN GITHUB-ADRESS ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * BARA `https://github.com/` exakt, jämfört mot hela värddelen som i `lankkalla.js`: `https://github.com.evil.se/...` och `https://github.com@evil.se/...` ger `null`,
 * eftersom efter värden måste `/` komma. Formen är `/<ägare>/<repo>/blob/<ref>/<sökväg...>`.
 *
 * ⛔ REFEN ÄR ETT SEGMENT. En gren med snedstreck i namnet (`feature/x`) går inte att skilja från en katalog i sökvägen utan att fråga GitHub, och en adress som ska tolkas av en ren
 * funktion får inte kräva ett nätanrop. En sådan adress tolkas därför som ref `feature` och sökväg `x/...`, och appens läsare svarar `saknas` när filen inte finns där. Det är en känd begränsning.
 *
 * ⛔ INGEN `..`, INGET TOMT SEGMENT. Sökvägen avkodas med `decodeURIComponent` per segment, och en felaktig avkodning (`%E0%A4%A`) ger `null` i stället för en halv sökväg. Ett avkodat segment
 * som är `.`, `..`, innehåller `/`, `\` eller ett styrtecken ger `null`: `%2e%2e` är samma sak som `..`. Query och fragment (`?plain=1`, `#L10`) ignoreras.
 *
 * Filen importerar ingenting: den delas av klienten och nodsidan (appens läsare).
 */

/**
 * Filtyperna en GitHub-post kan ha, ur ändelsen. `svg` är `annat` med avsikt: en SVG kan bära skript, och en bild ritas som `<img>` utan skydd mot det.
 * @type {Readonly<Record<string, "markdown" | "html" | "pdf" | "bild" | "text" | "csv" | "word" | "excel">>}
 */
export const GITHUB_SORTER = Object.freeze({
  md: "markdown",
  markdown: "markdown",
  html: "html",
  htm: "html",
  pdf: "pdf",
  png: "bild",
  jpg: "bild",
  jpeg: "bild",
  gif: "bild",
  webp: "bild",
  txt: "text",
  csv: "csv",
  docx: "word",
  xlsx: "excel",
});

/** Läget en läsning av en GitHub-fil kan ha. `last` är att filen kom, de andra är skälen till att den inte gjorde det. */
export const GITHUB_LAGEN = Object.freeze(["last", "saknas", "obehorig", "inte-gruppens", "for-stor", "fel"]);

/** @typedef {"markdown" | "html" | "pdf" | "bild" | "text" | "csv" | "word" | "excel" | "annat"} GithubSort */

/**
 * @typedef {object} GithubDokumentInfo
 * @property {string} agare
 * @property {string} repo
 * @property {string} ref Ett segment, se filhuvudet.
 * @property {string} sokvag Avkodad, med `/` mellan segmenten.
 * @property {string} namn Sista segmentet, avkodat.
 * @property {string} andelse Ändelsen i gemener utan punkt, eller tom.
 * @property {GithubSort} sort
 */

const NAMNFORM = /^[A-Za-z0-9_.-]+$/;
const ADRESS = /^https:\/\/github\.com\/([^/?#]+)\/([^/?#]+)\/blob\/([^/?#]+)\/([^?#]+)(?:[?#].*)?$/;

/**
 * Ett segment avkodat, eller `null` när det inte duger som en del av en sökväg.
 * @param {string} segment
 * @returns {string | null}
 */
function avkodaSegment(segment) {
  let s;
  try {
    s = decodeURIComponent(segment);
  } catch {
    return null;
  }
  if (s === "" || s === "." || s === "..") return null;
  if (/[/\\\u0000-\u001f\u007f]/.test(s)) return null;
  return s;
}

/**
 * Tolkar en adress till en fil i ett GitHub-repo, eller `null` när den inte är en.
 *
 * @param {unknown} url
 * @returns {GithubDokumentInfo | null}
 */
export function githubDokument(url) {
  if (typeof url !== "string") return null;
  const m = ADRESS.exec(url);
  if (!m) return null;
  const [, agare, repo, rawRef, rawSokvag] = m;
  if (!NAMNFORM.test(agare) || !NAMNFORM.test(repo) || /^\.+$/.test(agare) || /^\.+$/.test(repo)) return null;
  const ref = avkodaSegment(rawRef);
  if (ref === null) return null;
  const delar = [];
  for (const del of rawSokvag.split("/")) {
    const s = avkodaSegment(del);
    if (s === null) return null;
    delar.push(s);
  }
  const namn = /** @type {string} */ (delar[delar.length - 1]);
  const punkt = namn.lastIndexOf(".");
  const andelse = punkt > 0 ? namn.slice(punkt + 1).toLowerCase() : "";
  const sort = Object.hasOwn(GITHUB_SORTER, andelse) ? GITHUB_SORTER[andelse] : "annat";
  return { agare, repo, ref, sokvag: delar.join("/"), namn, andelse, sort };
}

/**
 * Adressen till en fil. Varje segment kodas, och `githubDokument(githubDokumentUrl(x))` ger tillbaka samma värden.
 *
 * @param {{ agare: string, repo: string, ref: string, sokvag: string }} fil
 * @returns {string}
 */
export function githubDokumentUrl({ agare, repo, ref, sokvag }) {
  const k = encodeURIComponent;
  return `https://github.com/${k(agare)}/${k(repo)}/blob/${k(ref)}/${sokvag.split("/").map(k).join("/")}`;
}

/**
 * Markdown-texten gjord redo för läsläget. Ramverkets markdown ritar aldrig bilder (`OpsMarkdown`), och en länk utan värd (`docs/a.md`, `../README.md`) hade pekat mot appens egen adress.
 * En bild blir sin alt-text (eller "bild"), en relativ länk blir sin text. Absoluta adresser (`https:`, `http:`, `mailto:`), ankare (`#`) och allt annat lämnas orört.
 *
 * ⛔ KÄND BEGRÄNSNING (0.186.0): relativa bilder och relativa länkar i dokumentet visas inte. Att hämta dem kräver en läsning till per fil, med samma behörighet, och är en egen skiva.
 *
 * @param {string} text
 * @returns {string}
 */
export function githubMarkdown(text) {
  return String(text)
    .replace(/!\[([^\]\n]*)\]\(([^)\s]*)[^)\n]*\)/g, (_h, alt) => (alt.trim() === "" ? "bild" : alt))
    .replace(/\[([^\]\n]+)\]\(([^)\s]*)[^)\n]*\)/g, (hel, rubrik, mal) => (/^(https?:|mailto:|#)/i.test(mal) ? hel : rubrik));
}
