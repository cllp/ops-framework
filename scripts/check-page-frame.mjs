#!/usr/bin/env node
/**
 * Vakt: den globala sidramen reserverar rullningslistens plats.
 *
 * ══ ⛔ VARFÖR EN VAKT OCH INTE ETT PROV ══════════════════════════════════
 *
 * `scrollbar-gutter: stable` i basskiktets `html`-regel är en enda rad, och den
 * går inte att prova. jsdom kör ingen CSS, Vitest ser aldrig en rullningslist,
 * och ingen komponent importerar `tokens.css`. Raden kan alltså tas bort av
 * någon som städar basskiktet, och HELA provsviten förblir grön.
 *
 * ══ ⛔ VAD SOM GÅR SÖNDER NÄR DEN FÖRSVINNER ════════════════════════════
 *
 * Utan den hoppar hela sidan cirka 15px i sidled när man byter vy, och det
 * rapporteras som tre skilda buggar (bolag-ops#143):
 *
 *   sidan hoppar när man byter navigering
 *   Idag hoppar när man växlar Idag och Kommande
 *   toppmenyn hoppar och känns inte solid
 *
 * Det är EN orsak. `OpsAppShell` centrerar innehållet med `mx-auto`, och en sida
 * högre än fönstret får en vertikal rullningslist medan en kortare inte får
 * någon. När listen slås av och på krymper och växer det synliga området, och
 * allt centrerat flyttar sig i sidled.
 *
 * ⛔ DET ÄR EN FELKLASS SOM INTE SER UT SOM ETT FEL. Ingenting kraschar, inget
 * blir rött, och symptomet läses som "appen känns lite ostadig". Exakt den
 * sorten motiverar en vakt: den som tar bort raden kommer inte att märka något.
 *
 * ══ ⛔ VAD VAKTEN INTE BEVISAR ══════════════════════════════════════════
 *
 * Att raden STÅR DÄR. Inte att sidan står still. Det senare är ett öga på en
 * riktig webbläsare, och det står i issuens verifieringssteg. En vakt som
 * utger sig för att vara det andra hade varit sämre än ingen vakt.
 *
 * Kör: node scripts/check-page-frame.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/*
 * ⛔ SÖKVÄGEN GÅR ATT PEKA OM, och det är inte en bekvämlighet. Utan argument kan
 * vakten bara köras mot filen som den råkar se ut, alltså grönt, och då går det
 * inte att plantera ett brott och se den falla. `scripts/test-guards.mjs` pekar
 * den mot en fixtur utan raden. En vakt ingen sett falla är en förhoppning.
 */
const arg = process.argv[2];
const vag = arg ? path.resolve(arg) : path.join(rot, "tokens", "tokens.css");

if (!fs.existsSync(vag)) {
  console.error(`check-page-frame: ${vag} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
  process.exit(1);
}

const css = fs.readFileSync(vag, "utf8");

/*
 * ⛔ LÄSER `html`-REGELN OCH INTE HELA FILEN. En träff var som helst i filen hade
 * varit grön även om raden låg i en kommentar eller i en helt annan selektor, och
 * en vakt som är grön av fel skäl är precis det den finns för att förhindra.
 */
const htmlRegeln = /@layer\s+base\s*\{[\s\S]*?\bhtml\s*\{([\s\S]*?)\n\s*\}/.exec(css);

if (!htmlRegeln) {
  console.error("check-page-frame: hittade ingen `html`-regel i basskiktet.");
  console.error("  Antingen är basskiktet omskrivet, eller så matchar vakten inte längre filen.");
  console.error("  Bägge kräver ett beslut, inget av dem är ett godkänt utfall.");
  process.exit(1);
}

// Kommentarer räknas inte. En bortkommenterad rad är en borttagen rad.
const kropp = htmlRegeln[1].replace(/\/\*[\s\S]*?\*\//g, "");

if (!/scrollbar-gutter:\s*stable/.test(kropp)) {
  console.error("check-page-frame: `scrollbar-gutter: stable` saknas i basskiktets `html`-regel.\n");
  console.error("  Utan den hoppar varje ops-plattform cirka 15px i sidled när rullningslisten");
  console.error("  slås av och på, och det rapporteras som tre olika buggar i stället för en.");
  console.error("  Se bolag-ops#143 och kommentaren i tokens.css.\n");
  console.error("  ⛔ Lägg den tillbaka här, aldrig som en override i en app: då finns två");
  console.error("     sanningar om samma sidram och de börjar glida isär.");
  process.exit(1);
}

/*
 * ══ ⛔ RULLNINGSLISTENS UTSEENDE (0.95.0) ════════════════════════════════
 *
 * CP 2026-10-13: "Det skall aldrig finnas en ostylad komponent som använder
 * webläsarens scroll eller style." Ramverket hade då ingen rullningsliststil
 * alls, och tjugo komponentfiler med `overflow-auto` ritade operativsystemets
 * list. Samma felklass som raden ovan: en CSS-regel ingen provsvit ser. Tas den
 * bort är varje lista åter grå och systemfärgad, och allt är grönt.
 *
 * ⛔ LÄSER BASSKIKTETS BLOCK, inte hela filen, och kräver tre saker:
 *   1. en `*`-regel med `scrollbar-width` och en `scrollbar-color` ur tokens
 *      (standarden, Chrome, Edge och Firefox),
 *   2. `::-webkit-scrollbar-thumb` målad ur tokens (Safari, som saknar
 *      `scrollbar-color`),
 *   3. ingen hårdkodad färg i någon av dem, för den byter inte med mörkt läge.
 */
const basStart = /@layer\s+base\s*\{/.exec(css);
/** @type {string} */
let basblock = "";
if (basStart) {
  let djup = 0;
  for (let i = basStart.index + basStart[0].length - 1; i < css.length; i += 1) {
    if (css[i] === "{") djup += 1;
    else if (css[i] === "}") {
      djup -= 1;
      if (djup === 0) {
        basblock = css.slice(basStart.index, i + 1);
        break;
      }
    }
  }
}
const basUtanKommentarer = basblock.replace(/\/\*[\s\S]*?\*\//g, "");
const regler = [...basUtanKommentarer.matchAll(/([^{};]+)\{([^{}]*)\}/g)].map((m) => ({ selektor: m[1].trim(), kropp: m[2] }));

/** @type {string[]} */
const rullbrott = [];
const stjarna = regler.filter((r) => r.selektor === "*");
if (!stjarna.some((r) => /scrollbar-width\s*:\s*thin/.test(r.kropp))) {
  rullbrott.push("basskiktet saknar `* { scrollbar-width: thin }`. Listen ritas då i webbläsarens fulla bredd och form.");
}
if (!stjarna.some((r) => /scrollbar-color\s*:[^;]*var\(--color-/.test(r.kropp))) {
  rullbrott.push("basskiktet saknar `* { scrollbar-color: ... }` ur ett token. Listen målas då i systemets grå, som inte byter med mörkt läge.");
}
const tumme = regler.filter((r) => r.selektor === "::-webkit-scrollbar-thumb");
if (!tumme.some((r) => /background\s*:[^;]*var\(--color-/.test(r.kropp))) {
  rullbrott.push("basskiktet saknar `::-webkit-scrollbar-thumb` målad ur ett token. Safari, som saknar `scrollbar-color`, ritar då sin egen list.");
}
for (const r of [...stjarna, ...regler.filter((x) => x.selektor.includes("::-webkit-scrollbar"))]) {
  const hex = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.exec(r.kropp);
  if (hex) rullbrott.push(`\`${r.selektor}\` har ett hårdkodat färgvärde (${hex[0]}). Det byter inte med mörkt läge; använd ett token.`);
}

if (rullbrott.length > 0) {
  console.error("check-page-frame: rullningslisten är inte ramverkets.\n");
  for (const b of rullbrott) console.error(`  ${b}`);
  console.error("\n  CP 2026-10-13: \"Det skall aldrig finnas en ostylad komponent som använder webläsarens scroll eller style.\"");
  console.error("  Se kommentaren i tokens.css. ⛔ Lägg den tillbaka här, aldrig som en override i en app.");
  process.exit(1);
}

console.log("check-page-frame: basskiktets `html`-regel reserverar rullningslistens plats, och listen målas ur tokens i båda motorerna");
