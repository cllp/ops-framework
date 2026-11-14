/**
 * Granskaren bakom vakten `check-vantelage` (0.229.0): ett väntläge i ramverket rör sig.
 *
 * ══ ⛔ VARFÖR (CP 2026-11-14) ══════════════════════════════════════════════════════════════════════════
 *
 * CP om Programåtkomst: "Under programåtkomst så finns en text 'läser nycklarna'. Det är bra, men det är liksom ingen progress och man
 * ser inte informationen så lätt att nåt faktiskt händer. Det är ok att det tar lite tid att läsa nycklar, men bra om det inte bara är en
 * text utan att det faktiskt är en animering under tiden. Detta gäller överallt där man väntar." Och senare: "progressbars som rör sig
 * överallt där vi behöver vänta".
 *
 * Mätt samma dag: ramverket hade trettio väntelägen som var en stillastående rad text i en `role="status"` ("Hämtar dokumentet.",
 * "Läser"), plus tre fristående snurror. Ingenting hindrade nästa komponent från att lägga till en till. `check-vantar` vaktar
 * KNAPPAR som startar ett anrop; den här vaktar YTOR som väntar på data.
 *
 * ══ VAD SOM RÄKNAS SOM ETT VÄNTLÄGE ═══════════════════════════════════════════════════════════════════
 *
 * Ett JSX-element med `role="status"` (kommentarer borträknade) är ett väntläge när något av följande gäller:
 *
 *   - innehållet har en väntetext som bokstavlig text: Läser, Hämtar, Laddar, Sparar, Väntar, Skickar, Kontrollerar, eller de
 *     engelska motsvarigheterna;
 *   - innehållet slår upp en text vars NYCKEL säger väntan (`o("hamtar")`, `t.laddar`, `ordet(ORD, "hamtar", sprak)`, `bildHamtas`);
 *   - öppningstaggen bär `aria-busy` eller ett `data-*`-värde som är `hamtar` eller `laddar`.
 *
 * Dessutom är en ANNONSERANDE `OpsSpinner` (utan `decorative`) ett väntläge: den är en snurra som säger "vänta" för sig själv, och
 * ytan ska då vara `OpsVantar`. En dekorativ snurra i en knapp är knappens sak och vaktas av `check-vantar`.
 *
 * Alla väntelägen ska vara `OpsVantar`, som bär sin egen `role="status"`. Ett väntläge som finns kvar i en annan form är alltså ett brott.
 * `OpsVantar.jsx` och `OpsSpinner.jsx` själva läses inte: de är formen, inte en användning av den.
 *
 * ⛔ GOLV (tomt underlag, arbetsreglernas punkt 4): röd om färre än `GOLV.filer` filer, `GOLV.statusytor` statusytor eller
 * `GOLV.vantelagen` `OpsVantar`-användningar lästes. Golvet för användningar är det som gör att en vakt som slutar hitta något märks:
 * blir antalet lägre har antingen läsningen gått sönder, eller så har väntelägen försvunnit utan att någon bestämt det.
 */

import { utanKommentarer } from "./kallkod.mjs";

export const GOLV = {
  filer: 150,
  statusytor: 60,
  vantelagen: 30,
};

/** Filerna som ÄR formen. De läses inte som användningar. */
export const UTANFOR = new Set(["OpsVantar.jsx", "OpsSpinner.jsx"]);

/**
 * Väntelägen som redan rör sig på ett annat sätt, med skälet. ⛔ Listan får bara krympa, och ett undantag som inte täcker ett brott
 * är ett fel (en död rad ser ut som en försäkring).
 */
export const UNDANTAG = {
  "OpsLaddaSkelett.jsx": "Appskalets skelett pulserar (animate-pulse) över hela ytan medan inloggningen kontrolleras; det rör sig redan, och en rad till ovanpå hade varit två väntelägen för samma väntan.",
};

const VANTEORD = /\b(Läser|Hämtar|Laddar|Sparar|Väntar|Skickar|Kontrollerar|Loading|Reading|Fetching|Saving|Sending|Waiting)\b/;
/** En nyckel i en ordlista som säger väntan: `hamtar`, `hamtarFilen`, `bildHamtas`, `tradLaddar`, `laddarUpp`. */
const VANTENYCKEL = /^(hamtar|hamtas|laddar|laser|sparar|vantar|skickar)|(Hamtar|Hamtas|Laddar|Laser|Sparar|Vantar|Skickar)/;
/** Uppslag av en text: `o("x")`, `t("x")`, `rad("x"`, `ordet(ORD, "x"`, `t.x`, `texter.x`, `T.x`. */
const UPPSLAG = /(?:\b(?:o|t|rad|text)\(\s*"([A-Za-z]+)"|\bordet\(\s*\w+\s*,\s*"([A-Za-z]+)"|\b(?:t|T|texter|ord)\.([A-Za-z]+)\b)/g;

/** @param {string} kalla @param {number} index */
const radFor = (kalla, index) => kalla.slice(0, index).split("\n").length;

/**
 * Slutet på en öppningstagg som börjar vid `start` (`<`). Hoppar över `{...}` och strängar.
 * @param {string} k @param {number} start
 * @returns {number} Index för `>`, eller -1.
 */
function taggslut(k, start) {
  let djup = 0;
  /** @type {string | null} */
  let strang = null;
  for (let i = start + 1; i < k.length; i++) {
    const c = k[i];
    if (strang) {
      if (c === strang && k[i - 1] !== "\\") strang = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") strang = c;
    else if (c === "{") djup++;
    else if (c === "}") djup--;
    else if (c === ">" && djup === 0) return i;
  }
  return -1;
}

/**
 * Är texten (taggens innehåll, eller en prop) ett väntläge?
 * @param {string} innehall
 */
function vantetext(innehall) {
  if (VANTEORD.test(innehall)) return true;
  for (const m of innehall.matchAll(UPPSLAG)) {
    const nyckel = m[1] ?? m[2] ?? m[3];
    if (nyckel && VANTENYCKEL.test(nyckel)) return true;
  }
  return false;
}

/**
 * @param {string} fil
 * @param {string} kalla
 * @returns {{ brott: { fil: string, rad: number, regel: string, text: string }[], statusytor: number, vantelagen: number }}
 */
export function granskaFil(fil, kalla) {
  const k = utanKommentarer(kalla);
  /** @type {{ fil: string, rad: number, regel: string, text: string }[]} */
  const brott = [];
  let statusytor = 0;

  for (const m of k.matchAll(/role="status"/g)) {
    const i = m.index ?? 0;
    const start = k.lastIndexOf("<", i);
    const namn = /^<([A-Za-z][\w.]*)/.exec(k.slice(start))?.[1];
    if (!namn) continue;
    const slut = taggslut(k, start);
    if (slut === -1 || slut < i) continue;
    statusytor++;
    const oppning = k.slice(start, slut + 1);
    const sjalvstangd = oppning.endsWith("/>");
    const stangning = sjalvstangd ? -1 : k.indexOf(`</${namn}>`, slut);
    const innehall = stangning === -1 ? "" : k.slice(slut + 1, stangning);
    const upptagen = /\baria-busy\b/.test(oppning) || /\bdata-[\w-]+="(hamtar|laddar)"/.test(oppning);
    if (upptagen || vantetext(innehall)) {
      brott.push({
        fil,
        rad: radFor(k, i),
        regel: "stilla-vantan",
        text: `en role="status" med väntetext (${oppning.slice(0, 80).replace(/\s+/g, " ")}). Använd OpsVantar, som rör sig.`,
      });
    }
  }

  for (const m of k.matchAll(/<OpsSpinner\b/g)) {
    const i = m.index ?? 0;
    const slut = taggslut(k, i);
    const oppning = k.slice(i, slut + 1);
    if (/\bdecorative\b/.test(oppning)) continue;
    brott.push({ fil, rad: radFor(k, i), regel: "fristaende-snurra", text: "en annonserande OpsSpinner står för en väntande yta. Använd OpsVantar." });
  }

  const vantelagen = (k.match(/<OpsVantar\b/g) || []).length;
  return { brott, statusytor, vantelagen };
}

/**
 * @param {Record<string, string>} filer Filnamn till källtext, ur `src/components`.
 */
export function granska(filer) {
  /** @type {{ fil: string, rad: number, regel: string, text: string }[]} */
  const brott = [];
  const stat = { filer: 0, statusytor: 0, vantelagen: 0, undantag: 0 };
  for (const [fil, kalla] of Object.entries(filer)) {
    if (UTANFOR.has(fil)) continue;
    stat.filer++;
    const r = granskaFil(fil, kalla);
    if (fil in UNDANTAG) {
      if (r.brott.length === 0) brott.push({ fil, rad: 1, regel: "dott-undantag", text: "undantaget i UNDANTAG täcker inget väntläge längre. Ta bort raden." });
      else stat.undantag++;
    } else brott.push(...r.brott);
    stat.statusytor += r.statusytor;
    stat.vantelagen += r.vantelagen;
  }
  /** @type {string[]} */
  const golv = [];
  if (stat.filer < GOLV.filer) golv.push(`golv: ${stat.filer} filer lästa, minst ${GOLV.filer} krävs`);
  if (stat.statusytor < GOLV.statusytor) golv.push(`golv: ${stat.statusytor} statusytor lästa, minst ${GOLV.statusytor} krävs`);
  if (stat.vantelagen < GOLV.vantelagen) golv.push(`golv: ${stat.vantelagen} OpsVantar-användningar, minst ${GOLV.vantelagen} krävs`);
  return { brott, golv, stat };
}
