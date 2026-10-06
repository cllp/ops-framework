#!/usr/bin/env node
/**
 * Vakt: inga utvecklarord i det användaren ser (0.69.0, #274).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════
 *
 * CP 2026-10-06 20:12, med en skärmbild av Inställningar i LifeHub: "hela inställnings-panelen är superrörig." Mellan korten
 * stod "Slagen är inte seedade än", "Samlingen är tom, så appen ritar repots standardvärden" och "står däremot i koden
 * (SLAGBETEENDEN)". Varje mening var sann och skriven med omsorg, men för någon som arbetar i koden. För den som öppnar
 * Inställningar säger de bara att något är halvfärdigt, och de gör sidan rörig att läsa.
 *
 * ══ ⛔ VAD SOM RÄKNAS SOM ANVÄNDARTEXT ═════════════════════════════════════
 *
 * Vakten läser inte varje sträng: ett `throw new Error("...samlingen...")` är skrivet för en utvecklare och ska få säga
 * samlingen. Den läser det som ritas:
 *
 *   - JSX-text, alltså det som står mellan två taggar (`<p>Samlingen är tom</p>`);
 *   - en sträng eller mall som ensam står som barn i JSX (`{"..."}`, `{`...`}`);
 *   - värdet på en egenskap eller ett attribut vars namn är en användartext: `title`, `description`, `label`, `placeholder`,
 *     `aria-label`, `alt`, `rubrik`, `titel`, `beskrivning`, `hjalp`, `etikett`, och namn som slutar på `Text`,
 *     `Etikett`, `Label`, `Rubrik`, `Titel` eller `Beskrivning`. Både `title="..."` och `title: "..."` räknas, eftersom
 *     ordböcker och texttabeller (`TEXTER = { rubrik: "..." }`) är användartext lika mycket som JSX. ⛔ Ett ensamt `text` räknas
 *     inte: det är namnet på en loggrads meddelande lika ofta som på något som ritas (`{ niva: "info", text: "katalog: ..." }`),
 *     och en vakt som larmar på loggar blir avstängd. Ritas texten hamnar den ändå i JSX, och där läses den.
 *
 * Kommentarer räknas bort (`utanKommentarer`), så ett filhuvud som berättar om seedningen får göra det.
 *
 * ══ ⛔ ORDEN ═══════════════════════════════════════════════════════════════
 *
 * seedad, seedade, seedning (och böjningar), samlingen, samlingarna, standardvärden, standardvärdena, driftsättning (och
 * driftsätta, driftsätts), repots, Firestore, och ett kodnamn i versaler: ett ord som slutar på BETEENDEN eller RUTTER
 * (`SLAGBETEENDEN`, `SORTRUTTER`) eller två versalord ihop med understreck (`MODUL_TYPER`). Listan är kort med flit: varje ord
 * på den har stått i en app och lästs av en användare. Ett nytt ord läggs till när det har hänt, med sin händelse.
 *
 * ══ ⛔ GOLV ═══════════════════════════════════════════════════════════════
 *
 * Utan argument läses ramverkets `src` (utom proven) och kräver minst 150 filer. Med argument, en apps källkatalog, är golvet
 * 5 filer. Båda kan sättas med `--golv=N`. Dessutom krävs minst 300 användartexter i ramverket och 10 i en app: läses filerna men
 * hittas inga texter har mönstren slutat matcha. En vakt som blir grön av att ingenting lästes mäter ingenting (regel 4).
 *
 * Kör:  node scripts/check-utvecklarord.mjs                          ramverket
 *       node node_modules/ops-framework/scripts/check-utvecklarord.mjs web/src   en app
 * Exit: 0 grönt, 1 brott med fil, rad och ordet.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { utanKommentarer } from "./lib/kallkod.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Orden. ⛔ Ett nytt ord läggs till med sin händelse, se filhuvudet. */
export const UTVECKLARORD = [
  /\bseed(?:ad|ade|as|at|ning|ningen|ningar)?\b/i,
  /\bsamling(?:en|arna)\b/i,
  /\bstandardvärden(?:a)?\b/i,
  /\bdriftsätt\p{L}*/iu,
  /\brepots\b/i,
  /\bFirestore\b/i,
  /\b[A-ZÅÄÖ]{2,}(?:BETEENDEN|RUTTER)\b/,
  /\b[A-ZÅÄÖ]{2,}_[A-ZÅÄÖ_]{2,}\b/,
];

const NYCKEL = String.raw`(?:title|description|label|placeholder|aria-label|alt|rubrik|titel|beskrivning|hjalp|etikett|[A-Za-z]+(?:Text|Etikett|Label|Rubrik|Titel|Beskrivning))`;
const LITTERAL = String.raw`("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\x60(?:[^\x60\\]|\\.)*\x60)`;
const MONSTER = [
  // Ett attribut eller en egenskap med ett användartextnamn: title="...", title={"..."}, title={`...`}, rubrik: "...".
  new RegExp(String.raw`(?:^|[\s{(,])${NYCKEL}\s*(?:=\s*\{?\s*|:\s*)${LITTERAL}`, "g"),
  // En sträng eller mall som ensam barn i JSX: >{"..."}< eller >{`...`}<.
  new RegExp(String.raw`>\s*\{\s*${LITTERAL}\s*\}`, "g"),
  // JSX-text mellan två taggar. ⛔ `>` måste sluta en tagg: direkt efter ett namn, ett citattecken, `}` eller `/`. Med blanksteg
  // före är det en jämförelse (`text.length > MAX_TEXT`), och efter `=` en pil.
  /(?<=[\p{L}\p{N}"'}\/])>([^<>{}]*\p{L}[^<>{}]*)(?=<|\{)/gu,
];

/**
 * Användartexterna i en källfil, med radnummer.
 * @param {string} kallkod
 * @returns {{ rad: number, text: string }[]}
 */
export function anvandartexter(kallkod) {
  const kod = utanKommentarer(kallkod);
  /** @type {{ rad: number, text: string }[]} */
  const ut = [];
  for (const m of MONSTER) {
    for (const traff of kod.matchAll(m)) {
      // ⛔ En mall: `${...}` är kod, inte text. Annars blir `${OPS_FRAMEWORK_VERSION}` ett utvecklarord i menyns versionsrad.
      const text = (traff[1] ?? "").replace(/\$\{[^}]*\}/g, " ");
      if (!text.trim()) continue;
      const rad = kod.slice(0, traff.index).split("\n").length;
      ut.push({ rad, text });
    }
  }
  return ut;
}

/**
 * Brotten i en källfil.
 * @param {string} kallkod
 * @returns {{ rad: number, ord: string, text: string }[]}
 */
export function utvecklarord(kallkod) {
  /** @type {{ rad: number, ord: string, text: string }[]} */
  const brott = [];
  for (const { rad, text } of anvandartexter(kallkod)) {
    for (const ord of UTVECKLARORD) {
      const m = text.match(ord);
      if (m) brott.push({ rad, ord: m[0], text: text.replace(/\s+/g, " ").trim().slice(0, 100) });
    }
  }
  return brott;
}

/** @param {string} katalog @returns {string[]} */
function kallfiler(katalog) {
  /** @type {string[]} */
  const ut = [];
  for (const namn of fs.readdirSync(katalog, { withFileTypes: true })) {
    const p = path.join(katalog, namn.name);
    if (namn.isDirectory()) {
      if (namn.name === "node_modules" || namn.name === "__tests__" || namn.name.startsWith(".")) continue;
      ut.push(...kallfiler(p));
    } else if (/\.(jsx?|mjs|tsx?)$/.test(namn.name) && !/\.(test|spec)\.[jt]sx?$/.test(namn.name)) {
      ut.push(p);
    }
  }
  return ut;
}

function main() {
  const argv = process.argv.slice(2);
  const golvArg = argv.find((a) => a.startsWith("--golv="));
  const mal = argv.find((a) => !a.startsWith("--"));
  const katalog = mal ? path.resolve(mal) : path.join(rot, "src");
  const golv = golvArg ? Number(golvArg.slice("--golv=".length)) : mal ? 5 : 150;
  if (!fs.existsSync(katalog)) {
    console.error(`check-utvecklarord: RÖTT. ${katalog} finns inte.`);
    process.exit(1);
  }
  const filer = kallfiler(katalog);
  if (filer.length < golv) {
    console.error(`check-utvecklarord: RÖTT. ${filer.length} källfiler lästa i ${katalog}, väntat minst ${golv}. En vakt utan underlag mäter ingenting.`);
    process.exit(1);
  }
  let texter = 0;
  // ⛔ ETT ANDRA GOLV, PÅ TEXTERNA: slutar mönstren matcha blir filerna lästa men inga texter funna, och vakten grön av tomhet.
  const golvTexter = mal ? 10 : 300;
  /** @type {string[]} */
  const rader = [];
  for (const fil of filer) {
    const kod = fs.readFileSync(fil, "utf8");
    texter += anvandartexter(kod).length;
    for (const b of utvecklarord(kod)) rader.push(`  ${path.relative(process.cwd(), fil)}:${b.rad}: "${b.ord}" i "${b.text}"`);
  }
  if (texter < golvTexter) {
    console.error(`check-utvecklarord: RÖTT. Bara ${texter} användartexter hittades i ${filer.length} filer, väntat minst ${golvTexter}. Mönstren läser inte längre det som ritas.`);
    process.exit(1);
  }
  if (rader.length > 0) {
    console.error(`check-utvecklarord: RÖTT. ${rader.length} utvecklarord i användartext. Skriv om texten för den som använder appen, eller ta bort den:`);
    for (const r of rader) console.error(r);
    process.exit(1);
  }
  console.log(`check-utvecklarord: ${filer.length} källfiler, ${texter} användartexter lästa, inga utvecklarord.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
