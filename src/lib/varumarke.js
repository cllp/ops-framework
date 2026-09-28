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
 * ══ ⛔ ANDRA VARVET, ARKITEKTGRANSKNING 2026-09-28: `new URL(..., import.meta.url)`
 * FUNGERAR INTE I EN KONSUMENT ═══════════════════════════════════════════
 *
 * Den ursprungliga lösningen (se historiken i git) byggde URL:er med
 * `new URL("../../varumarke/" + fil, import.meta.url)`. Bundlat till
 * `dist/index.js` pekar den relativa sökvägen på fel katalog i en konsuments
 * `node_modules` (`../../varumarke` från `dist/` landar UTANFÖR paketet), och
 * Vite löser bara `import.meta.url`-mönster när sökvägen är en bokstavlig
 * sträng, inte en mallsträng byggd av en variabel. MÄTT mot en riktig
 * konsumentbuild (`check-paket.mjs`: `npm pack`, installation i ett tomt
 * projekt, `npm run build` där), inte bara mot `vitest`, som kör i Node och
 * aldrig rör Vites asset-hantering alls.
 *
 * Lösningen är att bilderna aldrig är en SÖKVÄG i den distribuerade koden.
 * `scripts/generate-varumarke.mjs` läser de fyra webp-filerna i `varumarke/`
 * och skriver dem som `data:image/webp;base64,...`-strängar i en genererad
 * modul (`varumarke.generated.js`, git-ignorerad, samma mönster som
 * `frameworkVersion.generated.js`). En data-URL behöver ingen sökväg att
 * lösa, i varken utveckling, ramverkets egen build, eller en konsuments Vite.
 * Generatorn körs i samma pre-steg som versionsgeneratorn (`package.json`
 * `prebuild`/`pretest`/`precheck:types`).
 *
 * Fyra webp-filer i `varumarke/` (paketrot, se `package.json` "files"):
 * `ops-hub-{ikon,ordmarke}-{ljus,mork}.webp`, beskurna, 44 KB totalt.
 */

import { OPS_HUB_VARUMARKE_DATA } from "./varumarke.generated.js";

/**
 * @typedef {{ ljus: string, mork: string }} Bildpar
 */

/**
 * Ramverkets förvalda märke. `OpsBrand` använder den här när appen inte
 * skickar in egna `ordmarke`/`ikon`-props (#164, korrigering B).
 * @type {{ ordmarke: Bildpar, ikon: Bildpar }}
 */
export const OPS_HUB_VARUMARKE = Object.freeze({
  ordmarke: Object.freeze({ ljus: OPS_HUB_VARUMARKE_DATA.ordmarke.ljus, mork: OPS_HUB_VARUMARKE_DATA.ordmarke.mork }),
  ikon: Object.freeze({ ljus: OPS_HUB_VARUMARKE_DATA.ikon.ljus, mork: OPS_HUB_VARUMARKE_DATA.ikon.mork }),
});
