#!/usr/bin/env node
/**
 * Vakt: inga handritade ikoner i komponenter. Ritningen bor i icons.jsx.
 *
 * ══ ⛔ VARFÖR ══════════════════════════════════════════════════════════
 *
 * ops-framework#164 (arkitekturgranskningen): `OpsCalendar.jsx` ritade sitt
 * eget kryss som en `<svg><path d="M5 5l10 10M15 5L5 15" /></svg>`, samtidigt
 * som `OpsBottomNav.jsx` och `OpsFloatingSummary.jsx` gjorde samma sak, var
 * och en med sin egen storlek och sitt eget strokeWidth. Tre ritningar av
 * samma märke i `counter.jsx` (se den filens filhuvud) hade redan lärt oss
 * att det ger tre buggar. Krysset lärde exakt samma läxa en gång till, bara
 * på ett annat märke.
 *
 * ══ ⛔ VARFÖR EN VAKT OCH INTE BARA EN STÄDNING ═══════════════════════
 *
 * Att städa bort de tre kryssen löser dagens fynd, inte nästa. Nästa
 * handritade ikon smyger in exakt likadant: en snabb `<svg>` mitt i en
 * komponent, för att det kändes enklare än att öppna `icons.jsx`. En vakt
 * fäller den innan den hinner bli en fjärde ritning att hålla i takt.
 *
 * ══ ⛔ VAD DEN LÄSER ═══════════════════════════════════════════════════
 *
 * Varje `.jsx`-fil i `src/components/`, UTOM `icons.jsx` (där ritningarna hör
 * hemma) och `__tests__/` (ett prov som monterar riktiga ikoner). Fäller på
 * `<svg` eller `<path d=` i koden, oavsett kommentar, för en handritad ikon
 * gömmer sig inte i en kommentar.
 *
 * Kör: node scripts/check-handritade-ikoner.mjs [katalog]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv[2];
const katalog = arg ? path.resolve(arg) : path.join(rot, "src", "components");

if (!fs.existsSync(katalog)) {
  console.error(`check-handritade-ikoner: ${katalog} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
  process.exit(1);
}

/*
 * ⛔ TRE UNDANTAG, VAR OCH ETT DOKUMENTERAT DÄR DET STÅR, INTE HÄR SOM EN TYST
 * LISTA. Vakten fäller EN ikon som ritats om och om igen (#164:s fynd: samma
 * kryss på tre ställen). Den här listan är inte det, det är tre ENSAMMA
 * ritningar som redan bär sitt eget "varför inte icons.jsx" i koden:
 *
 *   - OpsActivity.jsx (KlockIkon): "En ikon till att ladda är en för mycket",
 *     en enda klocka, inte en dubblett av något annat.
 *   - OpsSpinner.jsx: `animate-spin` sitter på SVG:n själv. `KryssIkon` och
 *     systrarna i icons.jsx är statiska lucide-wrappers utan den kroken, och
 *     att lägga en spinnervariant där hade gjort icons.jsx till något det
 *     inte är, en katalog med EN rörlig undantagsikon bland stillbilder.
 *   - OpsShareChart.jsx: en beräknad cirkeldiagram-geometri (radie, vinkel,
 *     `strokeDasharray` ur data), inte en ikon. Ingen "märke" att duplicera.
 *   - OpsInloggning.jsx (GoogleIkon, AppleIkon): Googles och Apples EGNA
 *     varumärken, inte ramverkets ikonspråk. `icons.jsx` är uttryckligen
 *     Lucide-omslag (se dess filhuvud), en katalog med EN generisk
 *     glyfuppsättning; en trepunkts Google-logga och Apples äppelsilhuett är
 *     motsatsen, exakta trademark-ritningar ingen annan källa har. Var och
 *     en ritas EN gång, i den ENDA komponent som visar "Fortsätt med
 *     Google/Apple" (#164, arkitektgranskningen); det är samma "inget att
 *     duplicera"-skäl som KlockIkon fick, tillämpat på ett varumärke i
 *     stället för en generisk symbol.
 *
 * Dyker ett fjärde `<svg>` upp i en fjärde fil utan en likadan rad här och i
 * koden: det ÄR ett fynd, lägg det inte tyst till i den här listan.
 */
const UNDANTAG = new Set(["OpsActivity.jsx", "OpsSpinner.jsx", "OpsShareChart.jsx", "OpsInloggning.jsx"]);

/** @param {string} dir @returns {string[]} */
function filer(dir) {
  /** @type {string[]} */
  const ut = [];
  for (const post of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, post.name);
    if (post.isDirectory()) {
      if (post.name === "node_modules" || post.name === "dist" || post.name === "__tests__") continue;
      ut.push(...filer(full));
      continue;
    }
    if (!/\.jsx$/.test(post.name)) continue;
    if (post.name === "icons.jsx") continue;
    if (UNDANTAG.has(post.name)) continue;
    ut.push(full);
  }
  return ut;
}

/** @type {{ fil: string, rad: number, text: string }[]} */
const fynd = [];
let lasta = 0;

for (const full of filer(katalog)) {
  lasta += 1;
  fs.readFileSync(full, "utf8")
    .split("\n")
    .forEach((rad, i) => {
      if (/<svg[\s>]/.test(rad) || /<path\s[^>]*\bd=/.test(rad)) {
        fynd.push({ fil: path.relative(katalog, full), rad: i + 1, text: rad.trim() });
      }
    });
}

// ⛔ GOLV. En vakt som blir grön av att inget lästes är den vanligaste falska
// grönheten i det här repot (se tokens/check-tokens.mjs Regel 4). Komponent-
// katalogen har över 40 filer, en dramatisk minskning är en trasig sökväg.
const GOLV = 30;
if (lasta < GOLV) {
  console.error(`check-handritade-ikoner: bara ${lasta} filer lästa i ${katalog}, väntat fler än ${GOLV}. Fel katalog, eller en trasig.`);
  process.exit(1);
}

if (fynd.length > 0) {
  console.error(`check-handritade-ikoner: ${fynd.length} handritad${fynd.length === 1 ? "" : "e"} ikon${fynd.length === 1 ? "" : "er"} utanför icons.jsx.`);
  for (const f of fynd) console.error(`  ${f.fil}:${f.rad}  ${f.text}`);
  console.error("");
  console.error("Lägg ritningen i src/components/icons.jsx och importera den i stället. En ikon på tre ställen är tre ställen att rätta (#164).");
  process.exit(1);
}

console.log(`check-handritade-ikoner: ${lasta} filer lästa, inga handritade ikoner utanför icons.jsx`);
process.exit(0);
