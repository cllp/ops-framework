#!/usr/bin/env node
/**
 * Vakt: inga ostylade webbläsarkontroller, varken i ramverket eller i en app.
 *
 * ══ ⛔ VARFÖR (CP 2026-10-13) ══════════════════════════════════════════════
 *
 * CP, med skärmbilder från Life Hub Identity där Leverantör under AI-nycklar
 * visade webbläsarens egen grå `<select>`-lista: "Alla dropdowns mm skall vara
 * brandade från ramverket och uppåt. Det skall aldrig finnas en ostylad
 * komponent som använder webläsarens scroll eller style."
 *
 * Mätt samma dag:
 *
 *   - `OpsSelect.jsx` sade själv att rå `<select>` är förbjuden i produkt-UI.
 *   - `OpsBibliotek.jsx:1324` hade ändå en rå `<select aria-label="Grupp att
 *     dela till">`, i ramverket självt.
 *   - Identity hade tre i `web/src/main.ts`, byggda som HTML i strängar.
 *   - `OpsBibliotek` och `OpsAgenter` hade dessutom var sitt SYNLIGT
 *     `<input type="file">`, alltså webbläsarens "Välj fil, ingen fil vald".
 *   - Ingen vakt fångade något av det. Förbudet stod i en kommentar, och en
 *     kommentar är ett löfte, inte en kontroll.
 *
 * ══ ⛔ VAD DEN FÄLLER ══════════════════════════════════════════════════════
 *
 *   1. `<select` och `<datalist`, i JSX och i strängar, och
 *      `createElement("select" | "datalist")`. Ersättare: `OpsSelect`.
 *   2. `type="date"`, `"time"`, `"datetime-local"`, `"month"`, `"week"` och
 *      `"color"`, som attribut, i strängar (`type=\"date\"`), som
 *      `el.type = "date"` och som `setAttribute("type", "date")`. Ersättare:
 *      `OpsDatePicker` (datum och tid) och `OpsGruppmarkeValjare` (färg). Det är samma
 *      lista som `OpsInput` vägrar (`TILLATNA_TYPER` i `OpsField.jsx`).
 *   3. Ett SYNLIGT `<input type="file">` eller `<input type="range">`. Ett
 *      filfält kan inte formas alls och ett reglage ritas i systemets
 *      accentfärg. Båda får finnas, men bara osynliga bakom ramverkets egen yta,
 *      se SYNLIGHETSMARKORER nedan.
 *
 * Kommentarer räknas bort (`lib/kallkod.mjs`), strängar gör det INTE. Identity
 * bygger HTML i strängar, och en vakt som bara läste JSX hade varit grön genom
 * exakt det fel som gav vakten.
 *
 * ══ ⛔ GOLV OCH TAK ════════════════════════════════════════════════════════
 *
 * Utan argument läses ramverkets `src/` och kräver minst 150 filer (den har
 * över 230). Med en katalog, en apps källa, är golvet 5 filer. Båda kan sättas
 * med `--golv=N`. En vakt som blir grön av att ingenting lästes är den
 * vanligaste falska grönheten här (arbetsreglerna, punkt 4).
 *
 * Taket är NOLL i ramverket och som standard. En app med kända fynd sätter
 * `--tak=N`, och taket får bara sjunka: vakten är röd både när fynden är FLER
 * än taket (ett nytt brott) och när de är FÄRRE (taket är inaktuellt och ska
 * sänkas till utfallet). Annars står ett gammalt tak kvar och släpper in nya
 * brott i den plats en lagad kontroll lämnade.
 *
 * Kör:  node scripts/check-webblasarkontroller.mjs                          ramverkets src/
 *       node node_modules/ops-framework/scripts/check-webblasarkontroller.mjs src
 *       node node_modules/ops-framework/scripts/check-webblasarkontroller.mjs web/src --tak=3
 * Exit: 0 grönt, 1 brott med fil, rad och ersättare.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { utanKommentarer } from "./lib/kallkod.mjs";

const NAMN = "check-webblasarkontroller";
const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flagga = (/** @type {string} */ namn) => argv.find((a) => a.startsWith(`--${namn}=`))?.split("=")[1];
const kataloger = argv.filter((a) => !a.startsWith("--"));
const ramverksLage = kataloger.length === 0;
const rotter = ramverksLage ? [path.join(rot, "src")] : kataloger.map((k) => path.resolve(k));
const GOLV = flagga("golv") !== undefined ? Number(flagga("golv")) : ramverksLage ? 150 : 5;
const TAK = flagga("tak") !== undefined ? Number(flagga("tak")) : 0;

if (!Number.isInteger(GOLV) || GOLV < 1) {
  console.error(`${NAMN}: --golv=${flagga("golv")} är inget heltal över noll.`);
  process.exit(1);
}
if (!Number.isInteger(TAK) || TAK < 0) {
  console.error(`${NAMN}: --tak=${flagga("tak")} är inget heltal från noll och uppåt.`);
  process.exit(1);
}
if (ramverksLage && TAK !== 0) {
  console.error(`${NAMN}: taket är noll i ramverket. Ett tak över noll här vore en skuld ramverket lämnar åt apparna.`);
  process.exit(1);
}

for (const r of rotter) {
  if (!fs.existsSync(r)) {
    console.error(`${NAMN}: ${r} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
    process.exit(1);
  }
}

/*
 * ⛔ UNDANTAGSLISTAN, MED SKÄL. Den är TOM, och det är ett svar och inte en
 * glömska (arbetsreglerna, punkt 5). Ramverkets egna ersättare kapslar inte in
 * någon av kontrollerna i punkt 1 och 2:
 *
 *   - `OpsSelect` är Radix Select: en knapp och en lista, ingen `<select>`.
 *   - `OpsDatePicker` är ett eget rutnät och egna tidslistor, ingen
 *     `type="date"` eller `type="time"`.
 *   - `OpsGruppmarkeValjare` väljer färg ur kulörer, ingen `type="color"`.
 *
 * Behöver en framtida ramverkskomponent kapsla in en sådan kontroll avsiktligt
 * (till exempel ett dolt fält för formulärinlämning) står den här, med filnamn
 * och skäl, och aldrig som ett tyst filter längre ned.
 *
 * @type {ReadonlyArray<{ fil: string, skal: string }>}
 */
const UNDANTAG = [];
const undantagsnamn = new Set(UNDANTAG.map((u) => u.fil));

/*
 * ⛔ SYNLIGHETSMARKÖRERNA, ALLTSÅ VAD SOM GÖR ETT FIL- ELLER REGLAGEFÄLT
 * TILLÅTET. Det finns inget annat sätt att öppna en fildialog än ett riktigt
 * `<input type="file">`, och reglagen behåller det nativa fältet för tangentbord
 * och skärmläsare. Kravet är därför inte att fältet saknas utan att det inte
 * SYNS som webbläsarens:
 *
 *   hidden, sr-only, opacity-0, display:none   fältet syns inte; ramverkets knapp
 *                                              eller yta öppnar det (OpsFilePicker,
 *                                              OpsProfil, OpsMeddelanden, OpsLjudspelare)
 *   ops-reglage                                tumme och skena målas ur tokens
 *                                              (OpsSlider, `check-slider` vaktar CSS:en)
 *   ops-ratt-input                             osynligt över rattens egen ritning (OpsKnob)
 */
const SYNLIGHETSMARKORER = [
  /(?<![-\w:])hidden(?![-\w])(?!\s*=\s*\{\s*false\s*\})/,
  /(?<![-\w:])sr-only(?![-\w])/,
  /(?<![-\w:])opacity-0(?![-\w.\d])/,
  /display\s*:\s*["']?none/,
  /(?<![-\w])ops-reglage(?![-\w])/,
  /(?<![-\w])ops-ratt-input(?![-\w])/,
];

const FORBJUDNA_TYPER = "date|time|datetime-local|month|week|color";
const Q = "\\\\?[\"'`]";

/** @type {{ namn: string, re: RegExp, ersattare: string }[]} */
const MONSTER = [
  { namn: "<select>", re: /<(?:select|SELECT)(?=[\s>/\\])/g, ersattare: "OpsSelect" },
  { namn: "<datalist>", re: /<(?:datalist|DATALIST)(?=[\s>/\\])/g, ersattare: "OpsSelect, eller ett OpsInput med egen förslagslista" },
  {
    namn: "createElement(select/datalist)",
    re: /createElement\(\s*["'`](?:select|datalist)["'`]/gi,
    ersattare: "OpsSelect",
  },
  {
    namn: "type=date/time/color",
    re: new RegExp(`\\btype\\s*=\\s*\\{?\\s*${Q}\\s*(?:${FORBJUDNA_TYPER})\\s*${Q}`, "g"),
    ersattare: "OpsDatePicker (datum och tid) eller OpsGruppmarkeValjare (färg)",
  },
  {
    namn: "setAttribute(type, date/time/color)",
    re: new RegExp(`setAttribute\\(\\s*["'\`]type["'\`]\\s*,\\s*["'\`](?:${FORBJUDNA_TYPER})["'\`]`, "g"),
    ersattare: "OpsDatePicker (datum och tid) eller OpsGruppmarkeValjare (färg)",
  },
];

/** @param {string} dir @returns {string[]} */
function filer(dir) {
  /** @type {string[]} */
  const ut = [];
  for (const post of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, post.name);
    if (post.isDirectory()) {
      if (["node_modules", "dist", "__tests__", ".git"].includes(post.name)) continue;
      ut.push(...filer(full));
      continue;
    }
    if (!/\.(?:jsx?|tsx?|mjs)$/.test(post.name)) continue;
    // Prov ritar inget i produkten, och ett prov får plantera en rå kontroll
    // för att visa att något annat avvisar den.
    if (/\.(?:test|spec)\.[jt]sx?$/.test(post.name) || post.name.endsWith(".d.ts")) continue;
    if (undantagsnamn.has(post.name)) continue;
    ut.push(full);
  }
  return ut;
}

/**
 * Läser en tagg från `<input` till dess avslutande `>`, utan att låta ett `>`
 * inuti `{...}` (en pilfunktion i `onChange`) eller inuti en sträng avsluta den.
 *
 * @param {string} text @param {number} start @returns {string}
 */
function lasTagg(text, start) {
  let djup = 0;
  /** @type {string | null} */
  let citat = null;
  const max = Math.min(text.length, start + 4000);
  for (let i = start + 1; i < max; i += 1) {
    const c = text[i];
    if (c === "\\") {
      i += 1;
      continue;
    }
    if (citat) {
      if (c === citat) citat = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") citat = c;
    else if (c === "{") djup += 1;
    else if (c === "}") djup = Math.max(0, djup - 1);
    else if (c === ">" && djup === 0) return text.slice(start, i + 1);
  }
  return text.slice(start, max);
}

/** @param {string} text @param {number} index */
const radFor = (text, index) => text.slice(0, index).split("\n").length;

/** @type {{ fil: string, rad: number, vad: string, ersattare: string, text: string }[]} */
const fynd = [];
let lasta = 0;

for (const r of rotter) {
  for (const full of filer(r)) {
    lasta += 1;
    const kallkod = fs.readFileSync(full, "utf8");
    const kod = utanKommentarer(kallkod);
    const raderna = kallkod.split("\n");
    const rel = path.relative(process.cwd(), full);
    const anteckna = (/** @type {number} */ index, /** @type {string} */ vad, /** @type {string} */ ersattare) => {
      const rad = radFor(kod, index);
      fynd.push({ fil: rel, rad, vad, ersattare, text: (raderna[rad - 1] ?? "").trim().slice(0, 140) });
    };

    for (const m of MONSTER) {
      for (const traff of kod.matchAll(m.re)) anteckna(traff.index ?? 0, m.namn, m.ersattare);
    }

    for (const traff of kod.matchAll(/<input(?=[\s/\\])/g)) {
      const tagg = lasTagg(kod, traff.index ?? 0);
      const typ = new RegExp(`\\btype\\s*=\\s*\\{?\\s*${Q}\\s*(file|range)\\s*${Q}`).exec(tagg)?.[1];
      if (!typ) continue;
      if (SYNLIGHETSMARKORER.some((re) => re.test(tagg))) continue;
      anteckna(
        traff.index ?? 0,
        `synligt <input type="${typ}">`,
        typ === "file"
          ? "OpsFilePicker, eller ett dolt fält (hidden/sr-only) som en OpsButton öppnar"
          : "OpsSlider (klassen ops-reglage)",
      );
    }
  }
}

if (lasta < GOLV) {
  console.error(`${NAMN}: bara ${lasta} filer lästa i ${rotter.join(", ")}, väntat minst ${GOLV}. Fel katalog, eller en trasig.`);
  process.exit(1);
}

const skrivFynd = () => {
  for (const f of fynd) {
    console.error(`  ${f.fil}:${f.rad}  ${f.vad}  ->  ${f.ersattare}`);
    if (f.text) console.error(`      ${f.text}`);
  }
};

if (fynd.length > TAK) {
  console.error(
    `${NAMN}: ${fynd.length} ostylad${fynd.length === 1 ? "" : "e"} webbläsarkontroll${fynd.length === 1 ? "" : "er"} i ${lasta} lästa filer, taket är ${TAK}.\n`,
  );
  skrivFynd();
  console.error("");
  console.error('  CP 2026-10-13: "Det skall aldrig finnas en ostylad komponent som använder webläsarens scroll eller style."');
  console.error("  Webbläsarens egna kontroller ritas av operativsystemet, ser olika ut i varje webbläsare, bär inga");
  console.error("  tokens och byter inte med mörkt läge. Använd ramverkets ersättare ovan.");
  process.exit(1);
}

if (fynd.length < TAK) {
  console.error(`${NAMN}: ${fynd.length} fynd men taket är ${TAK}. Taket får bara sjunka: sätt --tak=${fynd.length}.`);
  console.error("  Ett tak över utfallet släpper in ett nytt brott i platsen en lagad kontroll lämnade.");
  skrivFynd();
  process.exit(1);
}

if (TAK > 0) {
  console.error(`${NAMN}: ${fynd.length} kända fynd, lika med taket ${TAK}. Grönt, men skulden står kvar:`);
  skrivFynd();
}
console.log(`${NAMN}: ${lasta} filer lästa, ${fynd.length} ostylade webbläsarkontroller (tak ${TAK})`);
