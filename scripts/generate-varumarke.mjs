#!/usr/bin/env node
/**
 * Skriver ramverkets varumärkesbilder som data-URL:er, ur `varumarke/*.webp`.
 *
 * ⛔ #164, ANDRA VARVET: "new URL(..., import.meta.url)" LÖSER FEL KATALOG I
 * EN KONSUMENT. Ramverket buntas till EN fil (`dist/index.js`,
 * `scripts/build.mjs`). Den bundlen ligger i en konsuments
 * `node_modules/@staiger/ops-framework/dist/`, så `new URL("../../varumarke/x",
 * import.meta.url)` löstes till `node_modules/@staiger/varumarke`, alltså fel
 * paket, inte vårt eget. Det är inte en gissning: en riktig konsumentbuild
 * (`check-paket.mjs` + `npm pack` + installation i ett tomt projekt) visar det
 * direkt, medan `vitest` (som kör i Node utan Vites asset-hantering) aldrig
 * hade fångat det.
 *
 * Samma URL-mönster är dessutom en mallsträng i ETT UTTRYCK
 * (`` `../../varumarke/${fil}` ``), och Vite läser bara `import.meta.url`-
 * mönster när sökvägen är en bokstavlig sträng den kan analysera statiskt vid
 * byggtid, inte en variabel. I `dev`-läge ligger förbuntade beroenden dessutom
 * under `node_modules/.vite/deps/`, ytterligare en katalognivå bort. Två sätt
 * att vara fel, ett sätt att aldrig vara fel: en data-URL bär bilden i SIG
 * SJÄLV, det finns ingen sökväg att lösa.
 *
 * ══ EN SANNING PER FAKTUM ═══════════════════════════════════════════════
 *
 * Källan är `varumarke/*.webp` (fyra filer, 44 KB totalt, mätt). Den här
 * filen läser dem och skriver EN genererad modul med bilderna inbäddade som
 * `data:image/webp;base64,...`. Ingen handskriven kopia av bilddatan finns i
 * repot: den genererade filen är git-ignorerad (som
 * `src/lib/frameworkVersion.generated.js`, samma mönster), och körs i samma
 * pre-steg (`prebuild`, `pretest`, `precheck:types`) så en färsk checkout
 * aldrig råkar bygga eller testa mot en utebliven eller gammal modul.
 *
 * ⛔ DATA-URL:ER VÄXER BUNDELN, MEN 44 KB ÄR INTE DET PROBLEMET DEN FILEN
 * SKULLE VARA VID FLERA MEGABYTE. Bilderna är redan beskurna webp på under
 * 14 KB styck (mätt: ikon ~2,4 KB, ordmärke ~14 KB). En data-URL i JS-bundeln
 * undviker dessutom en EXTRA nätverksrundtripp per bild i konsumentens app,
 * vilket en separat asset-fil hade krävt.
 *
 * ⛔ TVÅ VALFRIA ARGUMENT, ENDAST FÖR test-guards.mjs. Utan argument läser och
 * skriver skriptet ramverkets egna sökvägar (`varumarke/` och
 * `src/lib/varumarke.generated.js`). `test-guards.mjs` kan inte bevisa "rött
 * om en fil saknas" genom att faktiskt ta bort en fil ur DETTA repo, så den
 * pekar i stället generatorn mot en tillfällig kopia med en fil borttagen,
 * samma mönster som `check-paket.mjs` tar en `paketrot`.
 *
 * Kör: node scripts/generate-varumarke.mjs [kallkatalog] [utfil]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const kalla = argv[0] ? path.resolve(argv[0]) : path.join(rot, "varumarke");

/**
 * ⛔ FYRA POSTER, INGEN FÄRRE. En femte fil i katalogen som ingen bild-nyckel
 * pekar på vore lika tyst fel som en som saknas: `check-paket.mjs` bevisar att
 * `varumarke/`-posten i "files" pekar på något som finns, men räknar aldrig
 * FILERNA. Listan här är den enda platsen som binder ihop filnamn och nyckel,
 * så håll den och `OPS_HUB_VARUMARKE`s form i `src/lib/varumarke.js` i takt.
 */
const BILDER = {
  ordmarke: { ljus: "ops-hub-ordmarke-ljus.webp", mork: "ops-hub-ordmarke-mork.webp" },
  ikon: { ljus: "ops-hub-ikon-ljus.webp", mork: "ops-hub-ikon-mork.webp" },
};

/** @param {string} fil @returns {string} */
function dataUrl(fil) {
  const full = path.join(kalla, fil);
  if (!fs.existsSync(full)) {
    throw new Error(
      `generate-varumarke: "${fil}" finns inte i ${kalla}. Ramverkets förvalda märke (#164) kräver alla fyra bilder; en generator som tyst hoppar över en saknad fil ger ett skal utan logga i stället för ett fel som säger varför.`,
    );
  }
  const buffer = fs.readFileSync(full);
  return `data:image/webp;base64,${buffer.toString("base64")}`;
}

/** @type {Record<string, { ljus: string, mork: string }>} */
const par = {};
for (const [namn, filer] of Object.entries(BILDER)) {
  par[namn] = { ljus: dataUrl(filer.ljus), mork: dataUrl(filer.mork) };
}

const ut = argv[1] ? path.resolve(argv[1]) : path.join(rot, "src", "lib", "varumarke.generated.js");

fs.writeFileSync(
  ut,
  `/**
 * ⛔ GENERERAD AV scripts/generate-varumarke.mjs. RÖR ALDRIG FÖR HAND.
 *
 * Källan är ${path.relative(rot, kalla)}/*.webp, inte den här filen. En
 * handskriven ändring här skrivs över tyst vid nästa "npm run build" eller
 * "npm test" (den körs redan automatiskt före build, check:types och test).
 * Vill du byta bild: byt filen i ${path.relative(rot, kalla)}/ och kör om
 * generatorn.
 */
export const OPS_HUB_VARUMARKE_DATA = ${JSON.stringify(par, null, 2)};
`,
);

console.log(`generate-varumarke: skrev ${Object.keys(par).length * 2} bilder som data-URL:er till ${path.relative(rot, ut)}`);
