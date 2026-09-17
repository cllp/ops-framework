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
 * Kör: node scripts/check-sidram.mjs
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
  console.error(`check-sidram: ${vag} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
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
  console.error("check-sidram: hittade ingen `html`-regel i basskiktet.");
  console.error("  Antingen är basskiktet omskrivet, eller så matchar vakten inte längre filen.");
  console.error("  Bägge kräver ett beslut, inget av dem är ett godkänt utfall.");
  process.exit(1);
}

// Kommentarer räknas inte. En bortkommenterad rad är en borttagen rad.
const kropp = htmlRegeln[1].replace(/\/\*[\s\S]*?\*\//g, "");

if (!/scrollbar-gutter:\s*stable/.test(kropp)) {
  console.error("check-sidram: `scrollbar-gutter: stable` saknas i basskiktets `html`-regel.\n");
  console.error("  Utan den hoppar varje ops-plattform cirka 15px i sidled när rullningslisten");
  console.error("  slås av och på, och det rapporteras som tre olika buggar i stället för en.");
  console.error("  Se bolag-ops#143 och kommentaren i tokens.css.\n");
  console.error("  ⛔ Lägg den tillbaka här, aldrig som en override i en app: då finns två");
  console.error("     sanningar om samma sidram och de börjar glida isär.");
  process.exit(1);
}

console.log("check-sidram: basskiktets `html`-regel reserverar rullningslistens plats");
