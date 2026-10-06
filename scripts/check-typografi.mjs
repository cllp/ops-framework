#!/usr/bin/env node
/**
 * Vakt: typografin bor på ETT ställe, i tokens. Inga egna storlekar i komponenter.
 *
 * ══ ⛔ VARFÖR (ops-framework#173, CP 2026-09-29) ═══════════════════════════
 *
 * 0.29.1 hade tio `text-[Npx]` utspridda över fem komponenter: 8, 9, 10 och 11
 * pixlar, var och en med sin egen vikt och sin egen spärrning. Bottenradens
 * etikett var 12 px där SessionStudios är 10, sektionsrubriken i en inställning
 * var 14 px där förlagan är 12, och ingen av de tio hade ett namn att peka på.
 * CP såg det som "allt är lite fel", och det var sant: det fanns inte EN
 * storlek att rätta, det fanns tio.
 *
 * Nu finns fem roller plus räknemärkets siffra i `tokens/sessionstudio-profil.json`
 * (`typografi.roller`), och Tailwind gör dem till `text-rubrik`, `text-sektion`,
 * `text-etikett`, `text-hjalp`, `text-liten` och `text-mikro`. Den här vakten
 * ser till att ingen skriver en sjunde storlek bredvid dem.
 *
 * ══ ⛔ VAD DEN FÄLLER ═════════════════════════════════════════════════════
 *
 *   - `text-[13px]`, `text-[0.7rem]`, `text-[1em]`: en literal storlek.
 *   - `font-size:` och `font-family:` i en komponent- eller stilfil: en storlek
 *     eller ett typsnitt förbi tokens. Typsnitt kommer ur `--font-sans` och
 *     `--font-display`, storlek ur rollerna.
 *
 * `text-[var(--x)]` och `text-[color:...]` är INTE storlekar och fälls inte.
 * Kommentarer räknas bort (radnumren bevaras): ett filhuvud som citerar det
 * gamla värdet ska få göra det, det är hela poängen med att skriva vad som hände.
 *
 * ══ ⛔ GOLV ═══════════════════════════════════════════════════════════════
 *
 * Utan argument läses ramverkets `src/components` och kräver minst 60 filer
 * (den har 75). Med argument, en konsuments källkatalog, är golvet 5 filer,
 * eftersom en app är mindre än ett ramverk. Båda kan sättas med `--golv=N`.
 * En vakt som blir grön av att ingenting lästes är den vanligaste falska
 * grönheten här (arbetsreglernas punkt 4, "tomt underlag").
 *
 * Kör:  node scripts/check-typografi.mjs                       ramverkets komponenter
 *       node .../scripts/check-typografi.mjs src                en apps källkatalog
 * Exit: 0 grönt, 1 brott med fil, rad och skäl.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { utanKommentarer } from "./lib/kallkod.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const golvArg = argv.find((a) => a.startsWith("--golv="));
const kataloger = argv.filter((a) => !a.startsWith("--"));
const ramverksLage = kataloger.length === 0;
// `--ramverksregler` tillämpar ramverkets strängare regel (ingen Tailwind-storlek) på en given katalog: för `test-guards`, som inte kan byta ramverkets egen.
const ramverksRegler = ramverksLage || argv.includes("--ramverksregler");
const rotter = ramverksLage ? [path.join(rot, "src", "components"), path.join(rot, "src", "lib")] : kataloger.map((k) => path.resolve(k));
const GOLV = golvArg ? Number(golvArg.split("=")[1]) : ramverksLage ? 60 : 5;

if (!Number.isInteger(GOLV) || GOLV < 1) {
  console.error(`check-typografi: ${golvArg} är inget heltal över noll.`);
  process.exit(1);
}

/** @param {string} dir @returns {string[]} */
function filer(dir) {
  /** @type {string[]} */
  const ut = [];
  for (const post of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, post.name);
    if (post.isDirectory()) {
      if (["node_modules", "dist", "__tests__"].includes(post.name)) continue;
      ut.push(...filer(full));
      continue;
    }
    if (/\.(jsx?|tsx?|css)$/.test(post.name) && !/\.test\./.test(post.name)) ut.push(full);
  }
  return ut;
}

const REGLER = [
  { namn: "literal storlek", re: /\btext-\[\s*-?\d*\.?\d+\s*(?:px|rem|em)\s*\]/g, skal: "Använd en roll: text-rubrik, text-sektion, text-etikett, text-hjalp, text-liten, text-raknare eller text-mikro. Saknas den storlek du behöver är det en ny roll i tokens/sessionstudio-profil.json, inte en literal här." },
  { namn: "font-size", re: /\bfont-size\s*:/g, skal: "Storlek kommer ur en typografiroll (text-*), inte ur en egen deklaration." },
  { namn: "font-family", re: /\bfont-family\s*:/g, skal: "Typsnitt kommer ur --font-sans och --font-display (font-sans, font-display), inte ur en egen deklaration." },
];

// ⛔ 0.31.2 (CP 2026-09-29 21:00, "Fortfarande jävla diffar i textstorlek på olika håll"): RAMVERKETS EGNA KOMPONENTER skriver ingen
// Tailwind-storlek (`text-xs/sm/base/md/lg/xl`) alls, bara en roll. Före 0.31.2 fanns 168 sådana i 61 filer, varje ett eget val,
// och det som inte hade någon ärvde 16 px från body. Bara i ramverksläget: en app har egna skäl och egen vakt, och dess `text-sm`
// fungerar fortfarande (storlekarna finns kvar i tokens för appar som ännu inte flyttat).
if (ramverksRegler) {
  REGLER.push({ namn: "Tailwind-storlek", re: /(?<![\w-])(?:[a-z0-9\[\]-]+:)*text-(?:xs|sm|base|md|lg|xl|2xl|3xl)(?![\w-])/g, skal: "Använd en roll: text-meta (12), text-etikett (14), text-brod (16), text-rubrik (16 fet), text-titel (18), text-sida (24), text-hjalp (11), text-liten (10), text-raknare (9), text-mikro (8). Skalan bor i tokens/sessionstudio-profil.json och ingen komponent har en egen." });
}

/** @type {{ fil: string, rad: number, regel: string, skal: string, text: string }[]} */
const fynd = [];
let lasta = 0;

for (const rotdir of rotter) {
  if (!fs.existsSync(rotdir)) {
    console.error(`check-typografi: ${rotdir} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
    process.exit(1);
  }
  for (const full of filer(rotdir)) {
    lasta += 1;
    const rader = utanKommentarer(fs.readFileSync(full, "utf8")).split("\n");
    rader.forEach((rad, i) => {
      for (const r of REGLER) {
        r.re.lastIndex = 0;
        if (r.re.test(rad)) fynd.push({ fil: path.relative(process.cwd(), full), rad: i + 1, regel: r.namn, skal: r.skal, text: rad.trim() });
      }
    });
  }
}

if (lasta < GOLV) {
  console.error(`check-typografi: bara ${lasta} filer lästa, väntat minst ${GOLV}. Fel katalog, eller en trasig. En vakt som är grön av att inte ha läst något skyddar ingenting.`);
  process.exit(1);
}

if (fynd.length > 0) {
  console.error(`check-typografi: ${fynd.length} brott mot typografin (#173).`);
  for (const f of fynd) console.error(`  ${f.fil}:${f.rad}  [${f.regel}]  ${f.text}\n      ${f.skal}`);
  process.exit(1);
}

console.log(`check-typografi: ${lasta} filer lästa, inga egna storlekar eller typsnitt förbi tokens`);
