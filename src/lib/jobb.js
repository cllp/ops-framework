import { STANDARD_TIDSZON, lokalTidpunkt } from "./format.js";

/**
 * Återkommande jobb: schemat och nästa körning (0.256.0, cllp/lifehub.app#888).
 *
 * ══ ⛔ VARFÖR RAMVERKET OCH INTE APPEN ═════════════════════════════════════════════════════════════════════════════════════
 *
 * Designen i cllp/lifehub.app#888 (godkänd plan i #886, CP 18 nov): banksynken, avstämningen och påminnelsen är tre jobb med
 * samma mekanik, ett schema, ett lås och ett utfall. Mekaniken är densamma för varje app, och står den i appen skriver nästa app
 * den en gång till med sin egen sommartidsräkning (regel 2). Ramverket känner därför schemat, låset och vyn, men inga jobbtyper och
 * inga samlingsnamn: appen skickar in båda.
 *
 * ══ ⛔ FILEN ÄR REN ════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Ingen Firebase och ingen React. Vyn (`OpsJobb`) och servern (`src/node/jobb.js`) räknar nästa körning med SAMMA funktion, så att
 * det vyn visar som "Nästa körning" är det schemaläggaren gör. `check-node-side` följer importgrafen och kräver det.
 */

/**
 * Stegen ett schema kan ha. ⛔ INGET KORTARE ÄN EN TIMME: schemaläggaren går var 15:e minut (design #888, "Kostnad"), och ett steg
 * som är kortare än varvet hade lovat körningar som aldrig kommer.
 */
export const JOBBSTEG = /** @type {const} */ (["timme", "dag", "vecka", "manad"]);

/**
 * Lägena. `prov` kör jobbet utan att det skriver skarpt (typen avgör vad det betyder), `skarp` på riktigt, `av` inte alls. Ett läge
 * och inte en växel, eftersom banksynken ska kunna köras som prov innan någon slår på den på riktigt (#886).
 */
export const JOBBLAGEN = /** @type {const} */ (["av", "prov", "skarp"]);

/**
 * Utfallen en körning kan sluta i. `hoppad` är inte `fel`: typen hade inget att göra (eller fanns inte), och det ska gå att skilja
 * från ett fel i statusen (regel 5).
 */
export const JOBBUTFALL = /** @type {const} */ (["ok", "fel", "hoppad"]);

/**
 * Felkodens form i `senast.kod`. ⛔ BARA EN KOD, ALDRIG EN TEXT: resultatet ska inte kunna bära text ur banken, belopp, namn eller
 * nycklar (design #888, "Datamodell"). En kod med gemener, siffror och bindestreck kan inte bära något av det.
 */
export const JOBBKODFORM = /^[a-z0-9-]{1,40}$/;

/** Timmens klockslag. */
const TID = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Fälten varje steg har utöver `steg`. Ett fält som inte hör till steget kastar: ett schema med `veckodag` på steget `dag` hade
 * sett ut att betyda något det inte betyder, och nästa person som läser dokumentet vet inte vilket fält som gäller.
 */
const STEGFALT = {
  timme: ["minut"],
  dag: ["tid"],
  vecka: ["tid", "veckodag"],
  manad: ["tid", "dag"],
};

/**
 * @typedef {typeof JOBBSTEG[number]} Jobbsteg
 * @typedef {typeof JOBBLAGEN[number]} Jobblage
 * @typedef {typeof JOBBUTFALL[number]} Jobbutfall
 * @typedef {{ steg: Jobbsteg, minut?: number, tid?: string, veckodag?: number, dag?: number }} Jobbschema
 */

/** @param {unknown} v @param {number} min @param {number} max */
function heltalMellan(v, min, max) {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

/**
 * Prövar ett schema och svarar med det i ren form (bara stegets fält). Kastar med ett svenskt fel annars.
 *
 * - `timme`: `minut` 0 till 59.
 * - `dag`: `tid` "HH:MM".
 * - `vecka`: `tid` och `veckodag` 1 (måndag) till 7 (söndag), som ISO-veckan.
 * - `manad`: `tid` och `dag` 1 till 28. ⛔ INTE 29 TILL 31: februari har 28 dagar, och "den 31:a" hade hoppat över sju månader om
 *   året utan att någon märkte det.
 *
 * @param {unknown} schema
 * @param {readonly string[]} [tillatnaSteg] Stegen jobbtypen tillåter. Banksynken har ett tak hos banken (fyra hämtningar per dygn)
 *   och får därför inte `timme` (design #888). Förval: alla.
 * @returns {Jobbschema}
 */
export function validateJobbschema(schema, tillatnaSteg = JOBBSTEG) {
  if (!Array.isArray(tillatnaSteg) || tillatnaSteg.length === 0 || tillatnaSteg.some((s) => !JOBBSTEG.includes(/** @type {any} */ (s)))) {
    throw new Error(`validateJobbschema: tillåtna steg ska vara en lista ur ${JOBBSTEG.join(", ")}, fick ${JSON.stringify(tillatnaSteg)}.`);
  }
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error("Schemat saknas. Ett jobb utan schema vet inte när det ska köras.");
  }
  const s = /** @type {Record<string, unknown>} */ (schema);
  const steg = s.steg;
  if (typeof steg !== "string" || !JOBBSTEG.includes(/** @type {any} */ (steg))) {
    throw new Error(`Schemats steg "${String(steg)}" finns inte. Giltiga steg: ${JOBBSTEG.join(", ")}.`);
  }
  if (!tillatnaSteg.includes(steg)) {
    throw new Error(`Steget "${steg}" är inte tillåtet för det här jobbet. Tillåtna: ${tillatnaSteg.join(", ")}.`);
  }
  const falt = STEGFALT[/** @type {Jobbsteg} */ (steg)];
  for (const k of Object.keys(s)) {
    if (k !== "steg" && !falt.includes(k)) throw new Error(`Fältet "${k}" hör inte till steget "${steg}". Stegets fält: ${falt.join(", ")}.`);
  }
  /** @type {Jobbschema} */
  const ut = { steg: /** @type {Jobbsteg} */ (steg) };
  if (steg === "timme") {
    if (!heltalMellan(s.minut, 0, 59)) throw new Error(`Minuten ska vara ett heltal 0 till 59, fick ${JSON.stringify(s.minut)}.`);
    ut.minut = /** @type {number} */ (s.minut);
    return ut;
  }
  if (typeof s.tid !== "string" || !TID.test(s.tid)) throw new Error(`Tiden ska stå som HH:MM, till exempel 06:15, fick ${JSON.stringify(s.tid)}.`);
  ut.tid = s.tid;
  if (steg === "vecka") {
    if (!heltalMellan(s.veckodag, 1, 7)) throw new Error(`Veckodagen ska vara 1 (måndag) till 7 (söndag), fick ${JSON.stringify(s.veckodag)}.`);
    ut.veckodag = /** @type {number} */ (s.veckodag);
  }
  if (steg === "manad") {
    if (!heltalMellan(s.dag, 1, 28)) throw new Error(`Dagen i månaden ska vara 1 till 28, fick ${JSON.stringify(s.dag)}. Februari har 28 dagar, och en senare dag hade hoppat över månader.`);
    ut.dag = /** @type {number} */ (s.dag);
  }
  return ut;
}

/**
 * Klockans delar för en tidpunkt i tidszonen.
 * @param {number} t @param {string} tz
 */
function delarI(t, tz) {
  const delar = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" }).formatToParts(new Date(t));
  /** @param {string} typ */
  const v = (typ) => (delar.find((p) => p.type === typ) || { value: "" }).value;
  return { y: Number(v("year")), mo: Number(v("month")), d: Number(v("day")), h: Number(v("hour")), mi: Number(v("minute")) };
}

/**
 * Nästa körning: den första tidpunkten STRIKT efter `efter` som schemat pekar ut, räknad i tidszonens klocka.
 *
 * ⛔ STRIKT EFTER, INTE "SAMTIDIGT ELLER EFTER". Servern sätter nästa körning med `nu` när en körning är klar. Hade samma minut
 * räknats hade ett jobb som blev klart 06:15:00 fått 06:15 igen och körts två gånger.
 *
 * ⛔ KLOCKAN OCH INTE ETT ANTAL MILLISEKUNDER. "Varje dag 06:15" ska vara 06:15 också dagen efter att klockan ställts om, inte 05:15
 * eller 07:15. Dagens datum räknas därför i tidszonen och tiden görs om till en tidpunkt med `lokalTidpunkt`. Prövat mot de svenska
 * skiftena 2026-03-29 och 2026-10-25 i `jobb.test.js`.
 *
 * ⛔ `timme` RÄKNAS I MINUTER, INTE I LOKALA TIMMAR. Ett jobb varje timme kl :05 ska gå med en timmes mellanrum också natten då
 * klockan ställs tillbaka. Lokala timmar hade gett två timmar mellan två körningar den natten (02:05 finns två gånger, och bara en av
 * dem kan vara "02:05"). Nästa minut som har rätt minuttal på tidszonens klocka är rätt svar för varje zon vars förskjutning är hela
 * eller halva timmar.
 *
 * @param {unknown} schema Prövas med `validateJobbschema`.
 * @param {Date} efter
 * @param {string} [tidszon] Förval `STANDARD_TIDSZON` (Europe/Stockholm).
 * @returns {Date}
 */
export function nastaKorning(schema, efter, tidszon = STANDARD_TIDSZON) {
  const s = validateJobbschema(schema);
  const start = efter instanceof Date ? efter.getTime() : NaN;
  if (!Number.isFinite(start)) throw new Error("nastaKorning: efter ska vara ett giltigt Date.");
  const tz = tidszon;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    throw new Error(`nastaKorning: tidszonen "${String(tz)}" finns inte. Ange en IANA-zon, till exempel ${STANDARD_TIDSZON}.`);
  }

  if (s.steg === "timme") {
    const MINUT = 60_000;
    const forsta = Math.floor(start / MINUT) * MINUT + MINUT;
    // Två timmar räcker för varje zon: inom 60 minuter kommer rätt minuttal, och ett skifte kan som mest flytta det en timme.
    for (let t = forsta; t <= forsta + 2 * 60 * MINUT; t += MINUT) {
      if (delarI(t, tz).mi === s.minut) return new Date(t);
    }
    throw new Error(`nastaKorning: ingen minut ${s.minut} inom två timmar i ${tz}.`);
  }

  const [hh, mm] = /** @type {string} */ (s.tid).split(":").map(Number);
  const idag = delarI(start, tz);
  // En månad är högst 31 dagar, och dagen 1 till 28 finns i varje: 62 dagar täcker alltid nästa månad.
  for (let i = 0; i <= 62; i += 1) {
    const datum = new Date(Date.UTC(idag.y, idag.mo - 1, idag.d + i));
    const y = datum.getUTCFullYear();
    const mo = datum.getUTCMonth() + 1;
    const d = datum.getUTCDate();
    if (s.steg === "vecka" && ((datum.getUTCDay() + 6) % 7) + 1 !== s.veckodag) continue;
    if (s.steg === "manad" && d !== s.dag) continue;
    const t = lokalTidpunkt(y, mo, d, hh, mm, 0, tz);
    if (t > start) return new Date(t);
  }
  throw new Error(`nastaKorning: ingen körning inom 62 dagar för ${JSON.stringify(s)}.`);
}

/**
 * Körningens id: jobbet plus den planerade tiden. ⛔ INTE ETT SLUMPTAL: ett omförsök av samma planerade körning (låset löpte ut, eller
 * funktionen startades om) får samma id, och typen kan då känna igen en körning den redan gjort (design #888, "Låsning och idempotens").
 *
 * @param {string} jobbId
 * @param {Date} planerad
 * @returns {string}
 */
export function jobbKorningsId(jobbId, planerad) {
  const id = typeof jobbId === "string" ? jobbId.trim() : "";
  if (!id) throw new Error("jobbKorningsId: jobbets id krävs.");
  if (!(planerad instanceof Date) || !Number.isFinite(planerad.getTime())) throw new Error("jobbKorningsId: den planerade tiden ska vara ett giltigt Date.");
  return `${id}@${planerad.toISOString()}`;
}

/**
 * En tidpunkt ur det som en datakälla ger tillbaka: `Date`, Firestores `Timestamp` (`toDate`/`toMillis`), ISO-sträng eller
 * millisekunder. `null` för allt annat.
 *
 * ⛔ EN FUNKTION FÖR BÅDA SIDOR. Servern skriver millisekunder (`src/node/jobb.js`, så att `fore` jämför likadant i varje adapter),
 * men ett jobb som appen skrivit för hand kan bära ett `Date` eller ett `Timestamp`. Läste servern och vyn tiden på var sitt sätt hade
 * "nästa körning" kunnat betyda två olika tidpunkter.
 *
 * @param {unknown} v
 * @returns {Date | null}
 */
export function jobbTidpunkt(v) {
  if (v == null) return null;
  /** @type {number} */
  let t = NaN;
  if (v instanceof Date) t = v.getTime();
  else if (typeof v === "number") t = v;
  else if (typeof v === "string") t = Date.parse(v);
  else if (typeof v === "object" && typeof (/** @type {any} */ (v).toMillis) === "function") t = Number(/** @type {any} */ (v).toMillis());
  else if (typeof v === "object" && typeof (/** @type {any} */ (v).toDate) === "function") t = Number(/** @type {any} */ (v).toDate()?.getTime?.());
  return Number.isFinite(t) ? new Date(t) : null;
}
