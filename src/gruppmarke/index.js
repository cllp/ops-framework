/**
 * `ops-framework/gruppmarke`: märket utan React (0.70.0, lifehub.identity#27).
 *
 * ══ ⛔ VARFÖR EN EGEN INGÅNG ══════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-06: profilen i LifeHubs Identity ska ha "samma fina funktion exakt som man editerar grupp med ikoner och
 * färger". Identitys webb är vanlig TypeScript utan React, och gruppväljaren är React. Alternativen var att rita väljaren
 * som en React-ö, eller att identity skrev en egen kopia av katalogen, sökningen och kulörerna (regel 2).
 *
 * Mätt i identitys bygge (cllp/lifehub.identity#27): React och react-dom med gruppväljaren lade till 103,6 kB gzip.
 * Katalogen, sökningen och kulörerna ur rotens `ops-framework` lade till 36,9 kB, eftersom `dist/index.js` är en enda fil
 * som inte skakas ned väl. Samma funktioner ur källfilerna, plus SVG-datan, lade till 23,5 kB. Den här ingången är de
 * källfilerna.
 *
 * ⛔ INGENTING HÄR FÅR NÅ REACT, EN KOMPONENT ELLER LUCIDE-REACT. `check-gruppmarke` följer grafen från den här filen
 * och blir röd om något gör det, och kräver att varje export står i README.
 *
 * ⛔ INGET HÄR ÄR EN KOPIA. Varje namn återexporteras ur samma fil som roten och gruppväljaren läser.
 */

export { GRUPPIKONKATALOG, GRUPPIKON_LUCIDEVERSION } from "../lib/gruppikonkatalog.generated.js";
export { GRUPPIKON_SVG } from "../lib/gruppikonsvg.generated.js";
export { gruppikonSvg } from "../lib/gruppikonsvg.js";
export { ARV_GRUPPIKON, ARV_PROFILIKON, gruppikonNamn } from "../lib/gruppikonarv.js";
export { sokGruppikoner, forslagUrGruppnamn, VANLIGA_GRUPPIKONER } from "../lib/gruppikonsok.js";
export { GRUPPIKON_SVENSKA, gruppikonEtikett } from "../lib/gruppikonnamn.js";
export { GRUPPKULORFORSLAG, GRUPPKULOR_FORM, ARV_TON_KULOR, fargTillKulor, kulorTillFarg, gruppKulor, narmasteKulornamn, arGiltigGruppfarg } from "../lib/gruppfarg.js";
export { SENASTE_NYCKEL, MAX_SENASTE, lasSenasteGruppikoner, sparaSenasteGruppikon } from "../lib/gruppikonsenaste.js";
export { personmarke } from "../lib/personmarke.js";
export { arGiltigProfilikon, PROFILIKONER, PROFILFARGER, GRUPPINITIALER_FORM } from "../lib/markeformer.js";
export { initials } from "../lib/identity.js";
