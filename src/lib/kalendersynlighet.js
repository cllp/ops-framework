/**
 * Vilka kalendrar som syns, och hur de syns: ett minne per person och grupp (0.134.0, cllp/lifehub.app#402).
 *
 * ══ ⛔ EN LISTA, ETT MINNE ═════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-20, med bild: "Men varför kommer dom upp som både kalendrar och kalenderlager? Kaka på kaka." Samma Apple-kalender
 * matades in två gånger (som kalender och som lager) och valet bodde på fyra ställen, så en kalender kunde vara på i ett och av i
 * ett annat. Beslut 2026-10-21: EN lista som heter Kalendrar, en `OpsSwitch` per rad, och valet sparas på ETT ställe. Det här är det
 * stället. Lagret `lib/kalenderlager.js` (0.90.7) är föråldrat och finns kvar bara så att en app hinner flytta sina sparade val.
 *
 * ⛔ RAMVERKET KÄNNER INGA ID:N. Appen skickar `minne` (vanligen `person:grupp`) och kalenderraderna, och det som sparas är bara
 * personens EGNA val: vilka rader hen slagit på eller av, och hur varje rad visas. En rad hen aldrig rört har sitt förval
 * (`avFranStart`), och ett nytt id syns därför av sig självt, utan att något måste seedas.
 *
 * ⛔ FORMEN: `{ v: 1, syns: { [id]: boolean }, visning: { [id]: "handelser" | "ram" | "bada" } }`. Bara det personen valt står där.
 * `syns[id] = false` på en rad som syns från start betyder dold, `syns[id] = true` på en rad med `avFranStart` betyder påslagen. Att
 * "visa alla" är att tömma `syns`, och då går varje rad tillbaka till sitt förval. Ett värde som inte är ett boolean, och en visning
 * utanför de tre, läses som om det inte fanns: ett trasigt minne ska aldrig kunna dölja en kalender (samma skäl som `lasDoldaAppar`).
 */

/** Hur en kalender visas: som händelser i rutnätet, som en ram runt dagen, eller båda. */
export const KALENDERVISNINGAR = /** @type {const} */ (["handelser", "ram", "bada"]);

/** @typedef {"handelser" | "ram" | "bada"} Kalendervisning */

/** Förvalet: kalenderns händelser i rutnätet, som innan det fanns ett val. */
export const FORVALD_KALENDERVISNING = /** @type {Kalendervisning} */ ("handelser");

/** @typedef {{ v: 1, syns: Record<string, boolean>, visning: Record<string, Kalendervisning> }} KalenderSynlighet */

/** @typedef {{ id: string, avFranStart?: boolean }} SynlighetRad */

/** Minnet utan några val: varje rad har sitt förval. */
export const TOM_SYNLIGHET = /** @type {KalenderSynlighet} */ (Object.freeze({ v: 1, syns: Object.freeze({}), visning: Object.freeze({}) }));

/**
 * Nyckeln valet sparas under. `minne` är appens val, vanligen personen och gruppen: ramverket känner varken.
 * @param {string} minne
 * @returns {string}
 */
export function kalenderSynlighetNyckel(minne) {
  return `ops-kalender-synlighet:${minne}`;
}

/** @param {unknown} v @returns {v is Kalendervisning} */
const arVisning = (v) => v === "handelser" || v === "ram" || v === "bada";

/** @param {unknown} x @returns {x is Record<string, unknown>} */
const arObjekt = (x) => typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * Läser ett sparat värde. Trasigt, fel version eller saknat ger `TOM_SYNLIGHET`, aldrig ett kast.
 *
 * ⛔ TOMT OCH INTE ETT FEL, samma skäl som `lasDoldaAppar`: värdet ligger i personens egen webbläsare, och det värsta ett trasigt
 * värde kan göra är att visa varje kalender som förval. Att kasta hade gjort kalendern oanvändbar för den som har ett trasigt värde.
 *
 * @param {string | null | undefined} rad
 * @returns {KalenderSynlighet}
 */
export function lasKalenderSynlighet(rad) {
  if (typeof rad !== "string" || rad === "") return TOM_SYNLIGHET;
  /** @type {unknown} */
  let data;
  try {
    data = JSON.parse(rad);
  } catch {
    return TOM_SYNLIGHET;
  }
  if (!arObjekt(data) || data.v !== 1) return TOM_SYNLIGHET;
  /** @type {Record<string, boolean>} */
  const syns = {};
  if (arObjekt(data.syns)) for (const [id, v] of Object.entries(data.syns)) if (typeof v === "boolean") syns[id] = v;
  /** @type {Record<string, Kalendervisning>} */
  const visning = {};
  if (arObjekt(data.visning)) for (const [id, v] of Object.entries(data.visning)) if (arVisning(v)) visning[id] = v;
  return { v: 1, syns, visning };
}

/**
 * @param {KalenderSynlighet} val
 * @returns {string}
 */
export function skrivKalenderSynlighet(val) {
  return JSON.stringify({ v: 1, syns: val.syns, visning: val.visning });
}

/**
 * Syns raden? Personens val vinner; annars förvalet (`avFranStart` är av, allt annat på).
 * @param {SynlighetRad} rad
 * @param {KalenderSynlighet} val
 * @returns {boolean}
 */
export function arKalenderSynlig(rad, val) {
  const valt = val.syns[rad.id];
  return typeof valt === "boolean" ? valt : rad.avFranStart !== true;
}

/**
 * Hur raden visas. En rad personen aldrig rört visas som händelser.
 * @param {SynlighetRad} rad
 * @param {KalenderSynlighet} val
 * @returns {Kalendervisning}
 */
export function kalenderVisning(rad, val) {
  return val.visning[rad.id] ?? FORVALD_KALENDERVISNING;
}

/**
 * Nästa minne efter ett tryck på en rad: syns den blir den dold, och tvärtom. Alltid ett uttryckligt val.
 * @param {SynlighetRad} rad
 * @param {KalenderSynlighet} val
 * @returns {KalenderSynlighet}
 */
export function vaxlaKalenderSynlighet(rad, val) {
  return { ...val, syns: { ...val.syns, [rad.id]: !arKalenderSynlig(rad, val) } };
}

/**
 * Nästa minne när visningen byts. Att välja förvalet tar bort posten, så att minnet bara bär det personen faktiskt ändrat.
 * @param {SynlighetRad} rad
 * @param {Kalendervisning} visning
 * @param {KalenderSynlighet} val
 * @returns {KalenderSynlighet}
 */
export function sattKalenderVisning(rad, visning, val) {
  if (!arVisning(visning)) throw new Error(`sattKalenderVisning: okänd visning "${String(visning)}". Giltiga: ${KALENDERVISNINGAR.join(", ")}.`);
  const { [rad.id]: _bort, ...ovriga } = val.visning;
  return { ...val, visning: visning === FORVALD_KALENDERVISNING ? ovriga : { ...ovriga, [rad.id]: visning } };
}

/**
 * Tillbaka till förvalen för vad som syns. Visningen rörs inte: "visa alla" svarar på vilka kalendrar som syns, inte hur.
 * @param {KalenderSynlighet} val
 * @returns {KalenderSynlighet}
 */
export function aterstallKalenderSynlighet(val) {
  return { ...val, syns: {} };
}

/**
 * Raderna som syns, i listans ordning. En rad med ett tomt eller saknat id hoppas över.
 * @template {SynlighetRad} T
 * @param {readonly T[] | null | undefined} rader
 * @param {KalenderSynlighet} val
 * @returns {T[]}
 */
export function synligaKalenderRader(rader, val) {
  return (rader || []).filter((r) => r && typeof r.id === "string" && r.id.length > 0 && arKalenderSynlig(r, val));
}

/**
 * Är allt som det var från början? Då heter knappen "Alla kalendrar".
 * @param {readonly SynlighetRad[] | null | undefined} rader
 * @param {KalenderSynlighet} val
 * @returns {boolean}
 */
export function arForvaldSynlighet(rader, val) {
  return (rader || []).every((r) => arKalenderSynlig(r, val) === (r.avFranStart !== true));
}
