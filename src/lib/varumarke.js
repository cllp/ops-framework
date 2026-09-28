/**
 * Ramverkets EGET varumärke: OPS Hub, som förval för alla konsumenter.
 *
 * ══ ⛔ CP-BESLUT 2026-09-28 19:00, RÄTTAT FRÅN "APPEN SKICKAR BILDER" ════
 *
 * Korrigering B sade först att `OpsBrand` bara skulle KUNNA ta emot bilder
 * (`ordmarke`/`ikon` som URL:er appen skickar in), och lämnade texten som
 * förval. CP ändrade det: "Loggorna ska vara default för ramverket, tills de
 * byts ut eller overridas av en app." Ett ramverk utan en egen identitet ser
 * ofärdigt ut i varje app som ännu inte hunnit branda sig, och kräver dessutom
 * att VARJE app skriver samma fyra URL:er innan skalet ser klart ut.
 *
 * Fyra PNG-filer i `varumarke/` (paketrot, se `package.json` "files"):
 * `ops-hub-{ikon,ordmarke}-{ljus,mork}.png`, 2000 px-original, beskurna.
 *
 * ══ ⛔ `new URL(..., import.meta.url)`, INTE EN STRÄNGSÖKVÄG ═════════════
 *
 * Ramverket byggs till EN fil (`dist/index.js`, `scripts/build.mjs`) som en
 * konsuments Vite ser som ett beroende. En sträng som `"/varumarke/x.png"`
 * hade lösts mot KONSUMENTENS rot, inte paketets, och blivit en 404 i varje
 * app. `new URL(relativ, import.meta.url)` löses av bäraren av filen, alltså
 * paketets EGEN `dist/index.js` var den än installerats
 * (`node_modules/@staiger/ops-framework/dist/`), och Vite känner igen mönstret
 * i ett beroende och kopierar filen till konsumentens build. MÄTT mot
 * `create-ops-app`-mallens egen build, inte bara mot ramverkets `vitest`, som
 * kör i Node och inte har Vites asset-hantering alls: `check-paket.mjs`
 * (ägs av en annan agent i detta pass) packar och installerar paketet i ett
 * tomt projekt, samma mekanism en riktig konsument möter.
 *
 * ⛔ SÖKVÄGEN ÄR RELATIV FRÅN DEN HÄR FILEN, `src/lib/varumarke.js`, en nivå
 * upp till paketroten och in i `varumarke/`. esbuild (byggsteget) skriver INTE
 * om `import.meta.url`-uttryck, så samma relativa sökväg gäller både för
 * källfilen under utveckling och för den bundlade `dist/index.js`: BÅDA ligger
 * en katalognivå under paketroten (`src/lib/` respektive `dist/`).
 */

/** @param {string} fil @returns {string} */
const bas = (fil) => new URL(`../../varumarke/${fil}`, import.meta.url).href;

/**
 * @typedef {{ ljus: string, mork: string }} Bildpar
 */

/**
 * Ramverkets förvalda märke. `OpsBrand` använder den här när appen inte
 * skickar in egna `ordmarke`/`ikon`-props (#164, korrigering B).
 * @type {{ ordmarke: Bildpar, ikon: Bildpar }}
 */
export const OPS_HUB_VARUMARKE = Object.freeze({
  ordmarke: Object.freeze({ ljus: bas("ops-hub-ordmarke-ljus.png"), mork: bas("ops-hub-ordmarke-mork.png") }),
  ikon: Object.freeze({ ljus: bas("ops-hub-ikon-ljus.png"), mork: bas("ops-hub-ikon-mork.png") }),
});
