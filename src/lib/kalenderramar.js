import { perDay } from "./calendar.js";
import { lagerFarg } from "./kalenderlager.js";

/**
 * Dagens ramar: kalendrarna som har Ram eller Båda en dag ritar var sin ram, högst två, den ena inuti den andra (0.151.0, CP 2026-10-28).
 *
 * ══ ⛔ HÄNDELSEN ═══════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Till 0.150.0 ritade dagrutan EN ram: tonen på den första kalendern i listan som hade en post med Ram eller Båda den dagen. Hade två kalendrar ram
 * samma dag syntes bara den ena, och den andra såg ut att inte ha något den dagen. CP 2026-10-28: "kör" på att ramar får ligga inuti varandra, högst två.
 * Inga fler visningsval per kalender (CP sa nej till det): Händelser, Ram och Båda är kvar, och det som ändrats är hur många ramar en dag får bära.
 *
 * ══ ⛔ ORDNINGEN ÄR LISTANS, OCH TAKET ÄR TVÅ ══════════════════════════════════════════════════════════════════════════
 *
 * Den första kalendern i listan är ytterst. Är det fler än två gäller listans ordning och bara de två första ritas: tre ramar på en ruta som är 41 px bred vid 320 px
 * hade ätit upp siffran, och ordningen är redan den personen valt (Flytta upp och ned i Hantera kalendrar). En kalender som saknas i listan (en post vars `kalender`
 * appen inte skickat som rad) kommer sist, i den ordning posterna kommer. En kalender räknas EN gång per dag, hur många poster den än har.
 *
 * ⛔ REN FUNKTION, så att ordningen och taket går att prova utan en webbläsare. Hur det SER UT mäts i Chromium (`scripts/kalenderramar-matt.mjs`).
 */

/** Högst så många ramar en dag ritar. */
export const MAX_KALENDERRAMAR = 2;

/** @typedef {import("./calendar.js").CalendarEntry} CalendarEntry */

/**
 * @param {readonly CalendarEntry[]} poster De synliga posterna.
 * @param {object} val
 * @param {ReadonlyArray<{ id: string, farg?: unknown }> | undefined} val.kalendrar Listans ordning avgör vem som är ytterst.
 * @param {string} val.forvaldId Kalendern en post utan `kalender` hör till.
 * @param {(post: CalendarEntry) => string} val.visningAv "handelser", "ram" eller "bada" för postens kalender.
 * @returns {Map<string, Array<1|2|3|4|5|6>>} Dag (`YYYY-MM-DD`) till 1 eller 2 toner, ytterst först. Dagar utan ram står inte i kartan.
 */
export function kalenderRamar(poster, { kalendrar, forvaldId, visningAv }) {
  /** @type {Map<string, Array<1|2|3|4|5|6>>} */
  const ut = new Map();
  const rader = new Map((kalendrar || []).map((k, i) => [k.id, { k, plats: i }]));
  /** @type {Map<string, Map<string, { plats: number, ton: 1|2|3|4|5|6 }>>} Dag till kalender till plats och ton. */
  const perKalender = new Map();
  for (const e of poster) {
    const v = visningAv(e);
    if (v !== "ram" && v !== "bada") continue;
    const id = e.kalender ? e.kalender.id : forvaldId;
    const rad = rader.get(id);
    const kalla = rad ? rad.k : e.kalender;
    if (!kalla) continue;
    const plats = rad ? rad.plats : Number.MAX_SAFE_INTEGER;
    for (const dag of perDay([e]).keys()) {
      let dagens = perKalender.get(dag);
      if (!dagens) perKalender.set(dag, (dagens = new Map()));
      if (!dagens.has(kalla.id)) dagens.set(kalla.id, { plats, ton: lagerFarg(/** @type {any} */ (kalla)) });
    }
  }
  for (const [dag, dagens] of perKalender) {
    // `sort` är stabil: kalendrar utanför listan (samma plats) behåller den ordning posterna kom i.
    const tonar = [...dagens.values()].sort((a, b) => a.plats - b.plats).slice(0, MAX_KALENDERRAMAR).map((x) => x.ton);
    ut.set(dag, tonar);
  }
  return ut;
}
