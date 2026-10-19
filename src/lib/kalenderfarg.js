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

/** @type {Record<number, string>} Kalenderns färg som hel kant (preliminära poster), utskriven av samma skäl som `KALENDERPRICK`. */
const KALENDERRING = {
  1: "border-identity-1",
  2: "border-identity-2",
  3: "border-identity-3",
  4: "border-identity-4",
  5: "border-identity-5",
  6: "border-identity-6",
};
/** @type {Record<number, string>} */
const SLAGRING = { 1: "border-slag-1", 2: "border-slag-2", 3: "border-slag-3" };

/**
 * En posts färg som klasser: prick, vänsterkant och ton. Slaget om posten har ett, annars kalendern, annars accenten.
 *
 * `ring` (0.127.0) är SAMMA färg som en hel kant, för en preliminär post: en ihålig prick och ett streckat piller har ingen fyllning att bära färgen med,
 * så färgen sitter i kanten. Den väljs ur samma ordning som `prick`, så en preliminär post aldrig har en annan färg än en vanlig av samma slag.
 *
 * ⛔ SAMMA ORDNING PÅ ALLA YTOR, så att pricken, pillret, bandet och kortets kant aldrig säger olika saker om samma post.
 * ⛔ KLASSER OCH ALDRIG EN INLINE-FÄRG (`check-closed-api` punkt 3): en färg i `style` går förbi tokenkontraktet och
 * mörkt läge.
 *
 * @param {import("./calendar.js").CalendarEntry} e
 * @returns {{ prick: string, kant: string, ton: string, ring: string }}
 */
export function postklasser(e) {
  const slagPrickKlass = slagPrick(e.slag, e.slagLabel, "OpsCalendar");
  if (slagPrickKlass) return { prick: slagPrickKlass, kant: /** @type {string} */ (slagKant(e.slag, e.slagLabel, "OpsCalendar")), ton: SLAGTON[/** @type {number} */ (e.slag)], ring: SLAGRING[/** @type {number} */ (e.slag)] };
  if (e.kalender && KALENDERPRICK[e.kalender.farg]) {
    return { prick: KALENDERPRICK[e.kalender.farg], kant: /** @type {string} */ (kantKlass(e.kalender.farg, e.kalender.namn, "OpsCalendar")), ton: /** @type {Record<number, string>} */ (KALENDERTON)[e.kalender.farg], ring: KALENDERRING[e.kalender.farg] };
  }
  return { prick: "bg-accent", kant: "border-l-accent", ton: "bg-accent/20", ring: "border-accent" };
}

/**
 * Pricken i rutnätet och i snabbtitten: fylld i postens färg, och för en preliminär post IHÅLIG (0.127.0): bara en ring i samma färg. Mätt i en riktig
 * webbläsare (`check-skalyta`), eftersom en ring på 6 px är för liten för att avgöra i jsdom.
 *
 * ⛔ I EN VALD RUTA är fyllningen rutans textfärg (`bg-ink`, ytan är inverterad) och ringen likaså: postens egen färg syns inte mot den mörka ytan.
 *
 * @param {import("./calendar.js").CalendarEntry} e
 * @param {boolean} [vald] Pricken ligger i en vald ruta.
 * @returns {string}
 */
export function prickklass(e, vald = false) {
  if (e.preliminar === true) return vald ? "border border-ink bg-transparent" : `border bg-transparent ${postklasser(e).ring}`;
  return vald ? "bg-ink" : postklasser(e).prick;
}
