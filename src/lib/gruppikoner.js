import { GRUPPIKONER, GRUPPINITIALER_FORM, PROFILFARGER } from "./grupp.js";
import { BlixtIkon, BokIkon, ByggnadIkon, GruppIkon, HjartaIkon, HusIkon, JordglobIkon, KronaIkon, PortfoljIkon, StjarnaIkon } from "../components/icons.jsx";

/**
 * Kartan från ett sparat ikon-id (`GRUPPIKONER` i `grupp.js`) till komponenten som ritar det, och från en
 * grupprad till det `OpsIdentity` behöver för att rita märket (0.32.0, #180).
 *
 * Samma upplägg som `profilikoner.js` och av samma skäl: en uppslagstabell är en ren funktion, och `OpsGruppanel`,
 * `OpsGruppvaxlare` och `OpsGruppFormular` ritar SAMMA märke ur SAMMA karta i stället för att var och en gissa vad id:t "hus" betyder.
 * ⛔ ORDNINGEN ÄR RADENS ORDNING I VÄLJAREN. `GRUPPIKONER` (grupp.js) äger den, den här filen följer.
 */
export const GRUPPIKON_KOMPONENT = /** @type {const} */ ({
  grupp: GruppIkon,
  portfolj: PortfoljIkon,
  byggnad: ByggnadIkon,
  hus: HusIkon,
  bok: BokIkon,
  jordglob: JordglobIkon,
  stjarna: StjarnaIkon,
  hjarta: HjartaIkon,
  blixt: BlixtIkon,
  krona: KronaIkon,
});

if (Object.keys(GRUPPIKON_KOMPONENT).length !== GRUPPIKONER.length || GRUPPIKONER.some((i) => !(i in GRUPPIKON_KOMPONENT))) {
  throw new Error("gruppikoner.js: GRUPPIKON_KOMPONENT täcker inte exakt GRUPPIKONER (grupp.js). En ikon utan komponent är ett id ingen kan rita.");
}

/**
 * Det `OpsIdentity` behöver för en grupps märke: en ton om gruppen valt färg, en ikon eller initialer om den valt något
 * av dem. Tomma fält ger ett tomt objekt, och märket ritas då precis som före 0.32.0 (ton ur `id`, initialer ur namnet).
 *
 * ⛔ ETT FÄLT SOM INTE KÄNNS IGEN RITAS SOM OM DET INTE FANNS, det kastar inte. Läsvägen får inte ta ned en vy för att
 * en rad skrevs av en nyare version med en ikon den här inte känner: märket faller tillbaka på initialer, och
 * `byggGrupp` är den som avvisar ett okänt id när något SKRIVS.
 *
 * @param {{ farg?: string, ikon?: string } | null | undefined} grupp
 * @returns {{ tone?: 1|2|3|4|5|6, icon?: import("react").ComponentType<{ size?: number }>, initialer?: string }}
 */
export function gruppmarkeProps(grupp) {
  /** @type {{ tone?: 1|2|3|4|5|6, icon?: import("react").ComponentType<{ size?: number }>, initialer?: string }} */
  const ut = {};
  const farg = grupp?.farg ?? "";
  if (farg && /** @type {readonly string[]} */ (PROFILFARGER).includes(farg)) ut.tone = /** @type {1|2|3|4|5|6} */ (Number(farg));
  const ikon = grupp?.ikon ?? "";
  if (ikon in GRUPPIKON_KOMPONENT) ut.icon = GRUPPIKON_KOMPONENT[/** @type {keyof typeof GRUPPIKON_KOMPONENT} */ (ikon)];
  else {
    const m = GRUPPINITIALER_FORM.exec(ikon);
    if (m) ut.initialer = m[1].toUpperCase();
  }
  return ut;
}
