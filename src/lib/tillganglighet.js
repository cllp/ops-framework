import { STANDARD_TIDSZON } from "./kalendrar.js";

/**
 * Tillgängligheten en dag: vem i gruppen som är borta eller upptagen, och varför (0.61.0, cllp/ops-framework#259 skiva 1).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════
 *
 * CP 2026-10-06: "Vi har nåt i sessionstudio som heter tillgänglighet. Att andra ser när man är upptagen/borta/tillgänglig."
 * och "Jag vill egentligen att man skall kunna markera vissa poster i mina kalendrar som delade eller att man kan dela hela
 * kalendern". Delning och tillgänglighet är samma fråga från två håll: det jag delar som "upptagen" är det som gör mig
 * otillgänglig för gruppen.
 *
 * ══ ⛔ HÄRLEDS, LAGRAS ALDRIG (arbetsreglernas punkt 2) ══════════════════
 *
 * Tillgängligheten är en följd av posterna och av ingenting annat. Ett lagrat "borta" hade blivit en andra sanning som står kvar
 * när posten flyttas eller tas bort, samma fel som SessionStudios lagrade `isOnline` (#2821, sant för alltid för den som stängde
 * fliken). Funktionen är därför ren: samma poster och samma dag ger alltid samma svar.
 *
 * ══ ⛔ TRE LÄGEN PER POST, OCH `dold` RÄKNAS INTE ALLS ════════════════════
 *
 *   - `dold`: gruppen ser ingenting. Posten hoppas över innan något i den läses, så den kan varken göra någon borta eller
 *     läcka en rubrik. Det är epikens viktigaste skydd: en dold post når aldrig en annan medlem, inte ens som "upptagen".
 *   - `upptagen`: gruppen ser att personen är borta eller upptagen, inte vad.
 *   - `delad`: gruppen ser också rubriken, som `orsak`.
 *
 * ⛔ ORSAKEN BARA VID `delad`. Det är en medveten skillnad mot SessionStudio, som visar orsaken på ett blockerat datum för hela
 * gruppen (epiken, "Modellen").
 *
 * ══ BORTA OCH UPPTAGEN ═══════════════════════════════════════════════════
 *
 * Borta: något täcker hela dagen, alltså en heldagspost som omfattar dagen, eller en tidsatt post som täcker 00:00 till 24:00 i
 * tidszonen. Upptagen: en tidsatt post skär dagen utan att täcka den. Borta vinner över upptagen för samma person. Den som inte
 * har någon post den dagen saknas i listan, och är alltså tillgänglig.
 */

/** @typedef {"dold" | "upptagen" | "delad"} Delningslage */
/** @typedef {"borta" | "upptagen"} Tillganglighetslage */

/**
 * @typedef {object} Tillganglighetspost
 * @property {string} uid Vems posten är.
 * @property {string} start Heldag: `YYYY-MM-DD`. Annars en ISO-tid: med `Z` eller förskjutning en exakt tidpunkt, utan en lokal
 *   tid i `tidszon` (`YYYY-MM-DDTHH:MM` eller med sekunder).
 * @property {string} [slut] Samma form som `start`. ⛔ Heldag: EXKLUSIVT slutdatum, som `DTEND` i ICS (en post över 6 oktober har
 *   `slut` 2026-10-07). Utelämnad vid heldag: en dag. Krävs för en tidsatt post.
 * @property {boolean} [heldag]
 * @property {Delningslage} lage
 * @property {string} [rubrik] Läses bara när `lage` är `delad`.
 */

/**
 * @typedef {object} Tillganglighet
 * @property {string} uid
 * @property {string} namn
 * @property {Tillganglighetslage} lage
 * @property {string | null} orsak Rubriken, bara från poster med läget `delad`; annars `null`.
 */

const DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOKAL_TID = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?$/;
const MED_ZON = /(Z|[+-]\d{2}:?\d{2})$/;
const LAGEN = new Set(["dold", "upptagen", "delad"]);

/**
 * Tidszonens förskjutning mot UTC i millisekunder vid en tidpunkt.
 * @param {number} t @param {string} tz
 */
function forskjutning(t, tz) {
  const delar = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t));
  /** @param {string} typ */
  const v = (typ) => Number((delar.find((p) => p.type === typ) || { value: "0" }).value);
  return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) - (t - (t % 1000));
}

/**
 * Tidpunkten för en lokal tid i tidszonen. Två varv, så att en tid nära sommartidsskiftet får skiftets förskjutning och inte
 * gissningens.
 * @param {number} y @param {number} mo @param {number} d @param {number} h @param {number} mi @param {number} s @param {string} tz
 */
function lokalTill(y, mo, d, h, mi, s, tz) {
  const naiv = Date.UTC(y, mo - 1, d, h, mi, s);
  let t = naiv - forskjutning(naiv, tz);
  t = naiv - forskjutning(t, tz);
  return t;
}

/** @param {string} dag @param {string} falt */
function datumdelar(dag, falt) {
  const m = DATUM.exec(dag);
  const datum = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
  if (!m || !datum || datum.getUTCDate() !== Number(m[3]) || datum.getUTCMonth() !== Number(m[2]) - 1) {
    throw new Error(`tillganglighet: ${falt} "${dag}" är inget datum (YYYY-MM-DD).`);
  }
  return /** @type {[number, number, number]} */ ([Number(m[1]), Number(m[2]), Number(m[3])]);
}

/** Dagen efter, `YYYY-MM-DD`. @param {string} dag */
function nastaDag(dag) {
  const [y, mo, d] = datumdelar(dag, "dag");
  return new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * En tidsatt posts tidpunkt.
 * @param {string} varde @param {string} tz @param {string} falt
 */
function tidpunkt(varde, tz, falt) {
  if (typeof varde !== "string") throw new Error(`tillganglighet: ${falt} saknas för en tidsatt post.`);
  if (MED_ZON.test(varde)) {
    const t = Date.parse(varde);
    if (!Number.isFinite(t)) throw new Error(`tillganglighet: ${falt} "${varde}" är ingen ISO-tid.`);
    return t;
  }
  const m = LOKAL_TID.exec(varde);
  if (!m) throw new Error(`tillganglighet: ${falt} "${varde}" är ingen ISO-tid (YYYY-MM-DDTHH:MM, med eller utan zon).`);
  datumdelar(varde.slice(0, 10), falt);
  return lokalTill(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0), tz);
}

/**
 * Vilket läge en post ger personen den dagen: `borta`, `upptagen` eller `null` (posten rör inte dagen).
 * @param {Tillganglighetspost} p @param {string} dag @param {number} dagStart @param {number} dagSlut @param {string} tz
 * @returns {Tillganglighetslage | null}
 */
function postensLage(p, dag, dagStart, dagSlut, tz) {
  if (p.heldag) {
    datumdelar(p.start, "start");
    const slut = p.slut == null || p.slut === "" ? nastaDag(p.start) : p.slut;
    datumdelar(slut, "slut");
    if (slut <= p.start) throw new Error(`tillganglighet: heldagsposten ${p.start} har slut ${slut}. Slutet är exklusivt (som DTEND i ICS) och ska vara efter start.`);
    return p.start <= dag && dag < slut ? "borta" : null;
  }
  const start = tidpunkt(p.start, tz, "start");
  const slut = tidpunkt(/** @type {string} */ (p.slut), tz, "slut");
  if (slut < start) throw new Error(`tillganglighet: posten slutar ${p.slut}, före sin start ${p.start}.`);
  if (start <= dagStart && slut >= dagSlut) return "borta";
  // ⛔ En post utan längd (start lika med slut) skär dagen om den står i den: ett möte på noll minuter är ändå ett möte.
  const skar = slut > start ? start < dagSlut && slut > dagStart : start >= dagStart && start < dagSlut;
  return skar ? "upptagen" : null;
}

/**
 * Tillgängligheten en dag, per medlem, sorterad på namn. En medlem utan post den dagen saknas (tillgänglig).
 *
 * ⛔ BARA GRUPPENS MEDLEMMAR. En post vars `uid` inte finns i `medlemmar` hör till någon som inte är med i gruppen, och ger ingen
 * rad: listan svarar på vem i GRUPPEN som är borta.
 *
 * ⛔ ETT FEL I EN POST KASTAR, MED POSTEN I MEDDELANDET (punkt 5). Att tyst hoppa över en post vars datum inte går att läsa hade
 * visat personen som tillgänglig en dag hen är borta, och det ser ut som ett riktigt svar. En `dold` post läses däremot inte alls,
 * så den kan inte kasta.
 *
 * @param {object} indata
 * @param {ReadonlyArray<{ uid: string, namn: string }>} indata.medlemmar
 * @param {ReadonlyArray<Tillganglighetspost>} indata.poster
 * @param {string} indata.dag `YYYY-MM-DD`.
 * @param {string} [indata.tidszon] IANA-zon, förval `STANDARD_TIDSZON`.
 * @returns {Tillganglighet[]}
 */
export function tillganglighetForDag({ medlemmar, poster, dag, tidszon = STANDARD_TIDSZON }) {
  const [y, mo, d] = datumdelar(dag, "dag");
  const [ny, nmo, nd] = datumdelar(nastaDag(dag), "dag");
  // ⛔ DAGENS GRÄNSER I TIDSZONEN, inte i UTC och inte i webbläsarens zon. En dag kan vara 23 eller 25 timmar lång.
  const dagStart = lokalTill(y, mo, d, 0, 0, 0, tidszon);
  const dagSlut = lokalTill(ny, nmo, nd, 0, 0, 0, tidszon);
  const namnFor = new Map(medlemmar.map((m) => [m.uid, m.namn]));

  /** @type {Map<string, { lage: Tillganglighetslage, orsaker: { start: string, rubrik: string }[] }>} */
  const perPerson = new Map();
  for (const p of poster) {
    if (!LAGEN.has(p.lage)) throw new Error(`tillganglighet: delningen "${String(p.lage)}" finns inte för posten. Väntat dold, upptagen eller delad.`);
    if (p.lage === "dold") continue;
    if (!namnFor.has(p.uid)) continue;
    const lage = postensLage(p, dag, dagStart, dagSlut, tidszon);
    if (!lage) continue;
    const forra = perPerson.get(p.uid);
    const rubrik = p.lage === "delad" && typeof p.rubrik === "string" && p.rubrik.trim() ? p.rubrik.trim() : null;
    if (!forra || (forra.lage === "upptagen" && lage === "borta")) {
      perPerson.set(p.uid, { lage, orsaker: rubrik ? [{ start: p.start, rubrik }] : [] });
    } else if (forra.lage === lage && rubrik) {
      forra.orsaker.push({ start: p.start, rubrik });
    }
  }

  return [...perPerson.entries()]
    .map(([uid, { lage, orsaker }]) => {
      // ⛔ Orsaken kommer bara från poster som gav det läge som vann: en delad lunch säger inget om varför någon är borta hela dagen.
      const rubriker = [...new Set(orsaker.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)).map((o) => o.rubrik))];
      return { uid, namn: /** @type {string} */ (namnFor.get(uid)), lage, orsak: rubriker.length > 0 ? rubriker.join(", ") : null };
    })
    .sort((a, b) => a.namn.localeCompare(b.namn, "sv") || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
}

/**
 * Antalet till hörnbrickan i dagsrutan: personerna i listan, borta och upptagna tillsammans.
 *
 * ⛔ BÅDA RÄKNAS, SOM I SESSIONSTUDIO, där en blockering är binär: man är blockerad eller inte (`DayCell.js` `blockedCount`,
 * räknat ur `blockedDates`, poster med `blocksAvailability` och lager med `affectsAvailability`, sessions-platform f305de6).
 * Skillnaden mellan borta och upptagen står i dagpanelen, inte i brickan, som säger att någon inte är fullt tillgänglig.
 * @param {ReadonlyArray<Tillganglighet>} lista
 * @returns {number}
 */
export function bortaAntal(lista) {
  return lista.length;
}
