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
 * ⛔ FORMEN: `{ v: 1, syns: { [id]: boolean }, visning: { [id]: "handelser" | "ram" | "bada" }, fore?: { [id]: boolean } }`. Bara det personen valt står där.
 * `syns[id] = false` på en rad som syns från start betyder dold, `syns[id] = true` på en rad med `avFranStart` betyder påslagen. Att
 * "visa alla" är att tömma `syns`, och då går varje rad tillbaka till sitt förval. Ett värde som inte är ett boolean, och en visning
 * utanför de tre, läses som om det inte fanns: ett trasigt minne ska aldrig kunna dölja en kalender (samma skäl som `lasDoldaAppar`).
 *
 * ══ ⛔ KONTOT ÄR HEMMET, WEBBLÄSAREN ÄR EN FÖRHANDSCACHE (0.151.0) ═══════════════════════════════════════════════════
 *
 * CP 2026-10-28: "Väljer jag ram i mobilen syns det inte på datorn." Valen låg i `localStorage` och följde alltså enheten, inte personen.
 * Samma form sparas nu på kontot, ett dokument per person och grupp (`createKalendervalskalla`, `kalendervalsregelfragment`), och det
 * lokala minnet är kvar så att kalendern ritas direkt med det senast kända. Formen är densamma på båda ställena (`kalenderValDokument`
 * är den enda platsen den byggs), så det finns ingen översättning som kan glida.
 *
 * ══ ⛔ `fore`: VALEN SOM GÄLLDE INNAN "VISA BARA DEN HÄR" (0.151.0) ═══════════════════════════════════════════════════
 *
 * CP 2026-10-28, "kör": långtryck på en rad i listan gör den ensam synlig, och ett nytt långtryck på samma rad tar tillbaka valen som
 * gällde före. "Före" måste överleva en omladdning och en annan enhet, annars går det inte att ta tillbaka på datorn det man gjorde i
 * mobilen. Därför står det i samma dokument som valen: `fore` är `syns` som den var när raden gjordes ensam, och bara då. Ett tryck på
 * en växel, "Alla kalendrar" och en återställning tar bort den (en `fore` som överlevde ett senare val hade återställt något personen
 * inte längre minns). `fore: {}` är ett riktigt värde ("före" var förvalen) och skiljer sig från att `fore` saknas.
 */

/** Hur en kalender visas: som händelser i rutnätet, som en ram runt dagen, eller båda. */
export const KALENDERVISNINGAR = /** @type {const} */ (["handelser", "ram", "bada"]);

/** @typedef {"handelser" | "ram" | "bada"} Kalendervisning */

/** Förvalet: kalenderns händelser i rutnätet, som innan det fanns ett val. */
export const FORVALD_KALENDERVISNING = /** @type {Kalendervisning} */ ("handelser");

/** @typedef {{ v: 1, syns: Record<string, boolean>, visning: Record<string, Kalendervisning>, fore?: Record<string, boolean> }} KalenderSynlighet */

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
 * Rensar ett värde som redan är tolkat (ett dokument från kontot, eller JSON som tolkats) till ett minne, eller `null` när det inte är ett.
 * Fel version, ingen objektform eller saknat ger `null`; enskilda trasiga poster släpps och resten behålls.
 *
 * @param {unknown} data
 * @returns {KalenderSynlighet | null}
 */
export function rensaKalenderSynlighet(data) {
  if (!arObjekt(data) || data.v !== 1) return null;
  /** @type {Record<string, boolean>} */
  const syns = {};
  if (arObjekt(data.syns)) for (const [id, v] of Object.entries(data.syns)) if (typeof v === "boolean") syns[id] = v;
  /** @type {Record<string, Kalendervisning>} */
  const visning = {};
  if (arObjekt(data.visning)) for (const [id, v] of Object.entries(data.visning)) if (arVisning(v)) visning[id] = v;
  if (!arObjekt(data.fore)) return { v: 1, syns, visning };
  /** @type {Record<string, boolean>} */
  const fore = {};
  for (const [id, v] of Object.entries(data.fore)) if (typeof v === "boolean") fore[id] = v;
  return { v: 1, syns, visning, fore };
}

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
  return rensaKalenderSynlighet(data) ?? TOM_SYNLIGHET;
}

/** Fälten i dokumentet på kontot, i den ordning de skrivs. Reglerna (`kalendervalsregelfragment`) härleder sin fältlista härifrån. */
export const KALENDERVALFALT = /** @type {const} */ (["v", "syns", "visning", "fore"]);

/** Längsta grupp-id ett kalenderval sparas under (dokumentets id). Samma tak som modulinställningarnas. */
export const MAX_KALENDERVALGRUPP = 80;

/** Så många poster får `syns`, `visning` och `fore` ha var. Reglerna (`kalendervalsregelfragment`) har samma tak, härlett härifrån. */
export const MAX_KALENDERVAL = 200;

/**
 * Dokumentet som sparas på kontot (och, som JSON, i webbläsaren): samma form på båda ställena. `fore` står där bara när den finns.
 *
 * ⛔ KASTAR FÖR MÅNGA POSTER i stället för att låta reglerna neka det: ett nekat skrivfel syns som "Missing or insufficient permissions", och det
 * säger ingenting om att personen har över `MAX_KALENDERVAL` val.
 *
 * @param {KalenderSynlighet} val
 * @returns {{ v: 1, syns: Record<string, boolean>, visning: Record<string, Kalendervisning>, fore?: Record<string, boolean> }}
 */
export function kalenderValDokument(val) {
  for (const [namn, karta] of /** @type {const} */ ([["syns", val.syns], ["visning", val.visning], ["fore", val.fore ?? {}]])) {
    if (Object.keys(karta).length > MAX_KALENDERVAL) throw new Error(`kalenderValDokument: ${namn} har ${Object.keys(karta).length} poster, högst ${MAX_KALENDERVAL} sparas.`);
  }
  return val.fore ? { v: 1, syns: val.syns, visning: val.visning, fore: val.fore } : { v: 1, syns: val.syns, visning: val.visning };
}

/**
 * @param {KalenderSynlighet} val
 * @returns {string}
 */
export function skrivKalenderSynlighet(val) {
  return JSON.stringify(kalenderValDokument(val));
}

/**
 * Finns något val alls, eller är allt förval? Ett tomt minne behöver inte lyftas till kontot.
 * @param {KalenderSynlighet} val
 * @returns {boolean}
 */
export function harKalenderVal(val) {
  return Object.keys(val.syns).length > 0 || Object.keys(val.visning).length > 0 || val.fore !== undefined;
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
 * Nästa minne efter ett tryck på en rad: syns den blir den dold, och tvärtom. Alltid ett uttryckligt val. Tar bort `fore`: ett val efter "visa bara" är ett nytt läge.
 * @param {SynlighetRad} rad
 * @param {KalenderSynlighet} val
 * @returns {KalenderSynlighet}
 */
export function vaxlaKalenderSynlighet(rad, val) {
  const { fore: _fore, ...utan } = val;
  return { ...utan, syns: { ...val.syns, [rad.id]: !arKalenderSynlig(rad, val) } };
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
 * Tillbaka till förvalen för vad som syns. Visningen rörs inte: "visa alla" svarar på vilka kalendrar som syns, inte hur. Tar också bort `fore`.
 * @param {KalenderSynlighet} val
 * @returns {KalenderSynlighet}
 */
export function aterstallKalenderSynlighet(val) {
  const { fore: _fore, ...utan } = val;
  return { ...utan, syns: {} };
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

/**
 * Är det här den enda raden som syns? Då är nästa "visa bara den här" ett återtag.
 * @param {SynlighetRad} rad
 * @param {readonly SynlighetRad[] | null | undefined} rader
 * @param {KalenderSynlighet} val
 * @returns {boolean}
 */
export function arEnsamSynlig(rad, rader, val) {
  if (!arKalenderSynlig(rad, val)) return false;
  return (rader || []).every((r) => r.id === rad.id || !arKalenderSynlig(r, val));
}

/**
 * ══ ⛔ VISA BARA DEN HÄR (0.151.0, CP 2026-10-28) ═════════════════════════════════════════════════════════════════════
 *
 * Långtryck (eller menyvalet "Visa bara den här") på en rad: den raden blir ensam synlig och de andra döljs. Samma val en gång till, när raden
 * redan är ensam, tar tillbaka valen som gällde före (`fore`). Visningen (Händelser, Ram, Båda) rörs aldrig: "visa bara" svarar på vilka kalendrar som syns, inte hur.
 *
 * ⛔ FÖRE SPARAS SOM `syns` SÅ SOM DEN VAR, inte som en uträknad lista över vem som syntes: den är kortare, tål att en kalender tillkommit emellan
 * (den följer sitt förval), och återställer exakt det personen hade, också de som var av från start och slagits på.
 *
 * ⛔ SAKNAS `fore` (raden blev ensam av egna tryck på växlarna) betyder återtaget "visa alla", alltså förvalen. Det finns inget annat
 * rimligt "före" att gå tillbaka till, och att inte göra något hade gjort långtrycket till en död gest.
 *
 * @param {SynlighetRad} rad
 * @param {readonly SynlighetRad[]} rader Alla raderna i listan, också de dolda.
 * @param {KalenderSynlighet} val
 * @returns {KalenderSynlighet}
 */
export function visaBaraKalender(rad, rader, val) {
  const { fore, ...utan } = val;
  if (arEnsamSynlig(rad, rader, val)) return { ...utan, syns: fore ? { ...fore } : {} };
  /** @type {Record<string, boolean>} */
  const syns = {};
  for (const r of rader) {
    const vill = r.id === rad.id;
    // Bara det som skiljer sig från förvalet står i minnet.
    if (vill !== (r.avFranStart !== true)) syns[r.id] = vill;
  }
  if (!rader.some((r) => r.id === rad.id)) syns[rad.id] = true;
  return { ...utan, syns, fore: { ...val.syns } };
}

/**
 * Id:n på raderna som inte syns, i listans ordning.
 * @param {readonly SynlighetRad[] | null | undefined} rader
 * @param {KalenderSynlighet} val
 * @returns {string[]}
 */
export function doldaKalenderIds(rader, val) {
  return (rader || []).filter((r) => r && typeof r.id === "string" && r.id.length > 0 && !arKalenderSynlig(r, val)).map((r) => r.id);
}
