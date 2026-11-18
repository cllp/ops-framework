import { arBand, perDay } from "./calendar.js";
import { kalenderKulor } from "./kalenderfarg.js";

/**
 * Årsvyns band (cllp/lifehub.app#874): vilka kalendrar som har ett band en viss dag, i listans ordning.
 *
 * ══ ⛔ VARFÖR BAND, OCH BARA FÖR HELDAG OCH FLERA DAGAR ════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-17 ville se ett helt år med flera kalendrar (barnveckor, lov, uthyrning, resor, jobb) utan att det blir rörigt. Det som syns i ett år
 * är spannen, inte mötet klockan 14, så bara heldags- och flerdagsposter blir band (`arBand`, samma prövning som veckoradens band). Ett band per
 * kalender i kalenderns egen färg, och bandets plats bär betydelsen, så att det går att läsa i mörkt läge och för den som inte skiljer färger.
 * Inga nya visningsval och inget lagerbegrepp: kalenderlistans ordning, färg och växlar gäller som de är (beslutet 2026-10-21, och #874).
 *
 * ⛔ HÄRLEDS, LAGRAS ALDRIG. Samma underlag ger samma svar, och listans ordning avgör vem som står först, som i `kalenderRamarAlla`.
 */

/** Högst så många band ritas på en dag i årsvyn. Resten står som "+N", och dagpanelen visar alla med namn. */
export const MAX_ARSBAND = 3;

/** Id:t för band från poster som varken har en kalender eller en förvald att höra till. Anroparen sätter namnet. */
export const UTAN_KALENDER = "";

/**
 * Alla kalendrar med ett band per dag, i listans ordning, inte bara de som ritas.
 *
 * @param {readonly import("./calendar.js").CalendarEntry[]} poster De synliga posterna.
 * @param {object} val
 * @param {ReadonlyArray<{ id: string, farg?: unknown, namn?: string }> | undefined} val.kalendrar Listans ordning avgör vem som står först.
 * @param {string} val.forvaldId Kalendern en post utan `kalender` hör till.
 *   ⛔ Tom (gruppen har ingen gruppkalender) betyder inte att posten försvinner: den står under id `""` (`UTAN_KALENDER`), sist, precis som
 *   `filtreraPoster` visar den i månadsvyn. Annars visade året "inget" på dagar som har något (regel 5, granskningen av 0.237.0).
 * @returns {Map<string, Array<{ id: string, namn: string, kulor: number }>>} Dag (`YYYY-MM-DD`) till kalendrarna med band, först i listan först.
 */
export function arsband(poster, { kalendrar, forvaldId }) {
  const rader = new Map((kalendrar || []).map((k, i) => [k.id, { k, plats: i }]));
  /** @type {Map<string, Map<string, { plats: number, id: string, namn: string, kulor: number }>>} */
  const perKalender = new Map();
  for (const e of poster || []) {
    if (!arBand(e)) continue;
    const id = e.kalender ? e.kalender.id : forvaldId;
    const rad = rader.get(id);
    const kalla = /** @type {any} */ (rad ? rad.k : e.kalender || { id: UTAN_KALENDER });
    const plats = rad ? rad.plats : Number.MAX_SAFE_INTEGER;
    for (const dag of perDay([e]).keys()) {
      let dagens = perKalender.get(dag);
      if (!dagens) perKalender.set(dag, (dagens = new Map()));
      if (!dagens.has(kalla.id)) dagens.set(kalla.id, { plats, id: kalla.id, namn: typeof kalla.namn === "string" ? kalla.namn : kalla.id, kulor: kalenderKulor(kalla) });
    }
  }
  /** @type {Map<string, Array<{ id: string, namn: string, kulor: number }>>} */
  const ut = new Map();
  for (const [dag, dagens] of perKalender) ut.set(dag, [...dagens.values()].sort((a, b) => a.plats - b.plats).map(({ id, namn, kulor }) => ({ id, namn, kulor })));
  return ut;
}
