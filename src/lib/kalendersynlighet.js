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

/**
 * ⛔ EN NYCKEL SOM INTE ÄR ETT KALENDER-ID SLÄPPS (0.152.0, granskningen av PR 462). Reglerna nekar varje skrivning av ett dokument med en sådan nyckel (`KALENDERVALNYCKEL_FORM`). Behöll
 * läsaren den skulle varje senare skrivning ta med den, nekas, och "Försök igen" aldrig lyckas. Som en trasig post släpps den, så att dokumentet läker vid nästa skrivning.
 * @param {string} id @returns {boolean}
 */
const arNyckel = (id) => KALENDERVALNYCKEL_FORM.test(id);

/** @param {unknown} x @returns {x is Record<string, unknown>} */
const arObjekt = (x) => typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * Rensar ett värde som redan är tolkat (ett dokument från kontot, eller JSON som tolkats) till ett minne, eller `null` när det inte är ett.
 * Fel version, ingen objektform eller saknat ger `null`; enskilda trasiga poster släpps och resten behålls. En post vars nyckel inte är ett kalender-id (`KALENDERVALNYCKEL_FORM`) är en trasig post.
 *
 * @param {unknown} data
 * @returns {KalenderSynlighet | null}
 */
export function rensaKalenderSynlighet(data) {
  if (!arObjekt(data) || data.v !== 1) return null;
  /** @type {Record<string, boolean>} */
  const syns = {};
  if (arObjekt(data.syns)) for (const [id, v] of Object.entries(data.syns)) if (arNyckel(id) && typeof v === "boolean") syns[id] = v;
  /** @type {Record<string, Kalendervisning>} */
  const visning = {};
  if (arObjekt(data.visning)) for (const [id, v] of Object.entries(data.visning)) if (arNyckel(id) && arVisning(v)) visning[id] = v;
  if (!arObjekt(data.fore)) return { v: 1, syns, visning };
  /** @type {Record<string, boolean>} */
  const fore = {};
  for (const [id, v] of Object.entries(data.fore)) if (arNyckel(id) && typeof v === "boolean") fore[id] = v;
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
 * Längsta nyckel i `syns`, `visning` och `fore` (0.152.0, cllp/ops-framework#459): en kalenderrads id. Samma tal som dokumentets eget id (`MAX_KALENDERVALGRUPP`), så det finns
 * ETT tak för "ett id" i det här dokumentet. Utan taket gav 200 nycklar på 1 400 tecken ungefär 280 kB i ett enda dokument.
 */
export const MAX_KALENDERVALNYCKEL = 80;

/**
 * Formen på en nyckel i kartorna: en kalenderrads id, högst `MAX_KALENDERVALNYCKEL` tecken. Ramverkets egna id:n (`ID_FORM`) är små bokstäver, siffror, `-` och `_`; en appens rader
 * har dessutom ett prefix (`ical:`, `mina:`, `app:`) och ett id som kommer utifrån (en kalender från Mitt konto), därför släpps också `:`, `.` och versaler in. Det som INTE släpps in är
 * det som gör en nyckel dyr eller tvetydig: blanksteg, `,` (skiljetecknet reglerna prövar med), snedstreck, Unicode och en nyckel som börjar på ett skiljetecken.
 * Reglerna (`kalendervalsregelfragment`) härleder sitt uttryck härifrån, och `kalenderValDokument` prövar samma form innan något skrivs.
 */
export const KALENDERVALNYCKEL_FORM = new RegExp(`^[A-Za-z0-9][A-Za-z0-9_:.-]{0,${MAX_KALENDERVALNYCKEL - 1}}$`);

/**
 * Formen på dokumentet, utan någon kontroll. `fore` står där bara när den finns. Den enda platsen formen byggs (webbläsarens text och kontots dokument är samma sak).
 * @param {KalenderSynlighet} val
 * @returns {{ v: 1, syns: Record<string, boolean>, visning: Record<string, Kalendervisning>, fore?: Record<string, boolean> }}
 */
function kalenderValForm(val) {
  return val.fore ? { v: 1, syns: val.syns, visning: val.visning, fore: val.fore } : { v: 1, syns: val.syns, visning: val.visning };
}

/**
 * Dokumentet som sparas på KONTOT: samma form som i webbläsaren, men det KASTAR över `MAX_KALENDERVAL` poster innan reglerna hinner neka det (ett nekat skrivfel syns som
 * "Missing or insufficient permissions" och säger ingenting om att personen har för många val).
 *
 * ⛔ KASTAR BARA HÄR, ALDRIG VID LÄSNING ELLER RITNING (granskningen av PR 458, fynd 6). Taket är kontots och reglernas; webbläsarens text (`skrivKalenderSynlighet`) kontrollerar
 * ingenting, så att en person med fler val kan använda kalendern, också i en app utan Firebase. Källan (`createKalendervalskalla`) anropar den här. Hooken skriver aldrig över taket: den frågar `kalenderValForManga` först och ger `kontoFel` "formanga" (kontrollgranskningen, fynd 6).
 *
 * @param {KalenderSynlighet} val
 * @returns {{ v: 1, syns: Record<string, boolean>, visning: Record<string, Kalendervisning>, fore?: Record<string, boolean> }}
 */
export function kalenderValDokument(val) {
  const brott = kalenderValForManga(val);
  if (brott) throw new Error(`kalenderValDokument: ${brott.namn} har ${brott.antal} poster, högst ${MAX_KALENDERVAL} sparas på kontot.`);
  const nyckel = kalenderValOgiltigNyckel(val);
  if (nyckel) throw new Error(`kalenderValDokument: ${nyckel.namn} har nyckeln ${JSON.stringify(nyckel.nyckel.slice(0, 40))}, som inte är ett kalender-id (högst ${MAX_KALENDERVALNYCKEL} tecken: bokstäver, siffror, - _ : och .). Reglerna nekar den.`);
  return kalenderValForm(val);
}

/**
 * Första nyckeln i någon av kartorna som inte är en kalenderrads id (`KALENDERVALNYCKEL_FORM`), eller `null`. Samma prövning som reglerna gör, så ett nekat skrivfel ("Missing or
 * insufficient permissions") får ett besked som säger vad som är fel innan det hinner dit.
 * @param {KalenderSynlighet} val
 * @returns {{ namn: string, nyckel: string } | null}
 */
export function kalenderValOgiltigNyckel(val) {
  for (const [namn, karta] of /** @type {const} */ ([["syns", val.syns], ["visning", val.visning], ["fore", val.fore ?? {}]])) {
    for (const nyckel of Object.keys(karta)) if (!KALENDERVALNYCKEL_FORM.test(nyckel)) return { namn, nyckel };
  }
  return null;
}

/**
 * Har valet fler poster än kontot får bära (`MAX_KALENDERVAL`)? Den enda platsen taket prövas: `kalenderValDokument` kastar ur den, och `useKalenderSynlighet` frågar den INNAN den försöker skriva,
 * så att "för många val sparade" är ett känt läge och inte ett skrivfel som kommer tillbaka vid varje tryck (kontrollgranskningen av PR 458, fynd 6).
 * @param {KalenderSynlighet} val
 * @returns {{ namn: string, antal: number } | null} Första kartan över taket, eller `null`.
 */
export function kalenderValForManga(val) {
  for (const [namn, karta] of /** @type {const} */ ([["syns", val.syns], ["visning", val.visning], ["fore", val.fore ?? {}]])) {
    const antal = Object.keys(karta).length;
    if (antal > MAX_KALENDERVAL) return { namn, antal };
  }
  return null;
}

/**
 * @param {KalenderSynlighet} val
 * @returns {string}
 */
export function skrivKalenderSynlighet(val) {
  return JSON.stringify(kalenderValForm(val));
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
