/**
 * En kalenderposts färg som klasser: prick, vänsterkant och ton (0.37.0, utbruten ur `OpsCalendar`).
 *
 * ⛔ EN FIL FÖR FÄRGEN, SÅ ATT RUTAN, BANDEN, FILTRET OCH KORTEN LÄSER SAMMA SVAR. Före 0.37.0 låg tabellerna i
 * `OpsCalendar.jsx`; när dagsrutan blev en egen fil hade två kopior annars glidit isär.
 */
import { kantKlass } from "./kant.js";
import { slagKant, slagPrick } from "./slag.js";

/**
 * Kalenderns färg som klass, utskriven (Tailwind läser källan som text, `bg-identity-${n}` ger ingen CSS).
 * Identitetspalettens sex toner, samma som `KALENDERFARGER` i `lib/kalendrar.js`.
 * @type {Record<number, string>}
 */
export const KALENDERPRICK = {
  1: "bg-identity-1",
  2: "bg-identity-2",
  3: "bg-identity-3",
  4: "bg-identity-4",
  5: "bg-identity-5",
  6: "bg-identity-6",
};

/** @type {Record<number, string>} Bandens ton: färgen med 20 procents täckning, utskriven (SS `color-mix(... 22%, transparent)`, `MonthGrid.jsx:218`). */
const KALENDERTON = {
  1: "bg-identity-1/20",
  2: "bg-identity-2/20",
  3: "bg-identity-3/20",
  4: "bg-identity-4/20",
  5: "bg-identity-5/20",
  6: "bg-identity-6/20",
};
/** @type {Record<number, string>} */
const SLAGTON = { 1: "bg-slag-1/20", 2: "bg-slag-2/20", 3: "bg-slag-3/20" };

/**
 * En posts färg som klasser: prick, vänsterkant och ton. Slaget om posten har ett, annars kalendern, annars accenten.
 *
 * ⛔ SAMMA ORDNING PÅ ALLA YTOR, så att pricken, pillret, bandet och kortets kant aldrig säger olika saker om samma post.
 * ⛔ KLASSER OCH ALDRIG EN INLINE-FÄRG (`check-closed-api` punkt 3): en färg i `style` går förbi tokenkontraktet och
 * mörkt läge.
 *
 * @param {import("./calendar.js").CalendarEntry} e
 * @returns {{ prick: string, kant: string, ton: string }}
 */
export function postklasser(e) {
  const slagPrickKlass = slagPrick(e.slag, e.slagLabel, "OpsCalendar");
  if (slagPrickKlass) return { prick: slagPrickKlass, kant: /** @type {string} */ (slagKant(e.slag, e.slagLabel, "OpsCalendar")), ton: SLAGTON[/** @type {number} */ (e.slag)] };
  if (e.kalender && KALENDERPRICK[e.kalender.farg]) {
    return { prick: KALENDERPRICK[e.kalender.farg], kant: /** @type {string} */ (kantKlass(e.kalender.farg, e.kalender.namn, "OpsCalendar")), ton: /** @type {Record<number, string>} */ (KALENDERTON)[e.kalender.farg] };
  }
  return { prick: "bg-accent", kant: "border-l-accent", ton: "bg-accent/20" };
}
