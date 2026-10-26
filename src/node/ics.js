/**
 * `.ics` för en händelse (0.146.0, cllp/ops-framework#445, skiva 1: "Händelse: Bjud in med e-post").
 *
 * ══ ⛔ EN REN FUNKTION: DEN SKICKAR INGENTING OCH LÄSER INGEN DATABAS ════════════════════════════════════════════════
 *
 * Epiken: den som är extern ska kunna vara med "från sin egen mejl och sin egen kalender". Mejlet är appens (`skicka` i `createGastService`, appens mejlväg, appens språk och utseende), och kalenderposten är
 * den här filens: `byggIcs` gör en VEVENT ur en händelse och ger texten, appen bifogar den som `text/calendar` (`ICS_MIME`). Samma händelse ger samma text, så ett prov kan jämföra byte för byte, och klockan är en
 * indata (`stampel`) i stället för något funktionen läser.
 *
 * ══ ⛔ SEQUENCE STIGER NÄR TIDEN ELLER PLATSEN ÄNDRATS, OCH BARA DÅ ═══════════════════════════════════════════════════
 *
 * Ett kalenderprogram ersätter en post den redan har bara om UID är detsamma OCH SEQUENCE är högre. Ett nytt mejl med samma tid och högre SEQUENCE är en ny post bredvid den gamla hos vissa program, och ett
 * mejl med ändrad tid och oförändrad SEQUENCE ignoreras hos andra. Därför `andringsnyckel` (vad som gäller för gästen: dag, tid och plats) och `nastaSekvens` (stiger bara när nyckeln skiljer sig från den som
 * skickades förra gången). Tjänsten sparar `{ sekvens, andringsnyckel }` på inbjudan; filen här vet inget om var.
 *
 * ⛔ PLATS INGÅR I NYCKELN, ÄVEN OM ÄRENDET BARA NÄMNER TIDEN. En LOCATION som ändrats utan att SEQUENCE stigit ligger kvar hos gästen som den var, och gästen står på fel plats. Det kostar ett ord i nyckeln.
 *
 * ══ ⛔ TIDERNA ÄR UTC, OCH TIDSZONEN ÄR APPENS ═══════════════════════════════════════════════════════════════════════
 *
 * En händelse har datum och klockslag utan zon (`2026-12-26`, `18:00`). I ett brev till en främling måste zonen vara utskriven: en post utan zon (en "flytande" tid) hamnar på 18:00 hos mottagaren, vilken zon
 * mottagaren än sitter i. Zonen är en indata (`tidszon`, ett IANA-namn som `Europe/Stockholm`), eftersom ramverket inte vet var gruppen är, och posten skrivs som UTC (`...Z`): alla kalenderprogram läser
 * den, och ingen `VTIMEZONE` behöver byggas (och därmed ingen sommartidsregel skrivas för hand). En heldag, eller en händelse utan klockslag, skrivs som datum utan zon (`VALUE=DATE`), där slutdagen är dagen EFTER
 * sista dagen, som RFC 5545 kräver.
 *
 * ⛔ INGEN BESKRIVNING OCH INGEN ADRESS TILL SIDAN. Gästen ser händelsens rubrik, tid och plats (`GASTDELTAHANDELSEFALT`), och filen bär samma tre och inget mer. En beskrivning som läckte ut i en kalenderpost
 * hade nått gästen på en väg sidan inte öppnar.
 */

// @ts-expect-error Noden har crypto. Ramverket har inga Node-typer: lib är DOM, för webben. Samma rad som i gast.js.
import { createHash } from "node:crypto";

/** Mediatypen appen ger bilagan. */
export const ICS_MIME = "text/calendar; charset=utf-8";

/** Det en kalenderpost säger om vem som skrev den. Kan bytas av appen (`prodid`). */
export const ICS_PRODID = "-//ops-framework//gaster//SV";

const DATUMFORM = /^(\d{4})-(\d{2})-(\d{2})$/;
const KLOCKFORM = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** En domän som den står efter @ i ett UID: bokstäver, siffror, punkt och bindestreck. */
const DOMANFORM = /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
/** Ett UID får inte innehålla blanksteg eller styrtecken, och inte kolon eller snedstreck som en läsare kunde ta för en adress. */
const UIDDELFORM = /^[A-Za-z0-9._~-]+$/;

/**
 * Ett datum `YYYY-MM-DD` som en kalenderdag, eller `null`. Kontrollerar att dagen finns (30 februari är inget datum).
 * @param {unknown} datum
 * @returns {{ y: number, m: number, d: number } | null}
 */
function dag(datum) {
  const m = typeof datum === "string" ? DATUMFORM.exec(datum) : null;
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? { y, m: mo, d } : null;
}

/** @param {number} n @param {number} bredd */
const nolla = (n, bredd) => String(n).padStart(bredd, "0");

/**
 * Tidszonens skillnad mot UTC i millisekunder vid ett givet ögonblick (positiv öster om Greenwich).
 * @param {number} utcMs
 * @param {string} tidszon
 */
function zonskillnad(utcMs, tidszon) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tidszon, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
  /** @type {Record<string, number>} */
  const d = {};
  for (const p of f.formatToParts(new Date(utcMs))) if (p.type !== "literal") d[p.type] = Number(p.value);
  return Date.UTC(d.year, d.month - 1, d.day, d.hour, d.minute, d.second) - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Ett datum och ett klockslag i en tidszon som ett ögonblick i UTC (millisekunder). Två varv räcker: första varvet gissar med skillnaden vid "samma tid i UTC", andra rättar för att skillnaden kan vara en
 * annan vid det rätta ögonblicket (runt en sommartidsövergång). Ett klockslag som inte finns (klockan slås fram) eller finns två gånger (klockan slås tillbaka) får ett av de två möjliga ögonblicken.
 *
 * @param {{ y: number, m: number, d: number }} dagen
 * @param {string} klockslag `HH:MM`
 * @param {string} tidszon
 * @returns {number}
 */
function lokalTillUtc(dagen, klockslag, tidszon) {
  const k = /** @type {RegExpExecArray} */ (KLOCKFORM.exec(klockslag));
  const naiv = Date.UTC(dagen.y, dagen.m - 1, dagen.d, Number(k[1]), Number(k[2]));
  const forsta = naiv - zonskillnad(naiv, tidszon);
  return naiv - zonskillnad(forsta, tidszon);
}

/** @param {number} ms @returns {string} `YYYYMMDDTHHMMSSZ` */
function utcText(ms) {
  const t = new Date(ms);
  return `${nolla(t.getUTCFullYear(), 4)}${nolla(t.getUTCMonth() + 1, 2)}${nolla(t.getUTCDate(), 2)}T${nolla(t.getUTCHours(), 2)}${nolla(t.getUTCMinutes(), 2)}${nolla(t.getUTCSeconds(), 2)}Z`;
}

/** @param {{ y: number, m: number, d: number }} dagen @returns {string} `YYYYMMDD` */
const datumText = (dagen) => `${nolla(dagen.y, 4)}${nolla(dagen.m, 2)}${nolla(dagen.d, 2)}`;

/** @param {{ y: number, m: number, d: number }} dagen @param {number} antal */
function plusDagar(dagen, antal) {
  const t = new Date(Date.UTC(dagen.y, dagen.m - 1, dagen.d + antal));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/**
 * Text i en egenskap: backslash, semikolon, komma och radbrytning får sina escape-tecken (RFC 5545, 3.3.11), och styrtecken tas bort. En rubrik med ett komma ska inte bli två egenskaper.
 * @param {string} t
 * @returns {string}
 */
function escape(t) {
  return (
    t
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      // Backslash först: de escape-tecken som läggs till nedan ska inte själva dubblas.
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r\n|\r|\n/g, "\\n")
  );
}

/**
 * En rad vikt på 75 oktetter (RFC 5545, 3.1): fortsättningen börjar med ett blanksteg, och en UTF-8-tecken delas aldrig. Radslutet är CRLF.
 * @param {string} rad
 * @returns {string}
 */
function vik(rad) {
  const enc = new TextEncoder();
  if (enc.encode(rad).length <= 75) return rad;
  /** @type {string[]} */
  const delar = [];
  let del = "";
  let langd = 0;
  // Första raden får 75 oktetter, varje fortsättning 74 (blanksteget räknas).
  let tak = 75;
  for (const tecken of rad) {
    const b = enc.encode(tecken).length;
    if (langd + b > tak) {
      delar.push(del);
      del = "";
      langd = 0;
      tak = 74;
    }
    del += tecken;
    langd += b;
  }
  if (del) delar.push(del);
  return delar.join("\r\n ");
}

/**
 * Det som avgör om en gäst behöver ett nytt brev: dag, klockslag och plats som de står för gästen. En kort hash och inget annat, så att inbjudan kan jämföra utan att bära en kopia av händelsens plats (regel 2).
 * `titel` ingår inte: en ändrad rubrik är ingen ändring av var och när man ska vara.
 *
 * @param {{ datum?: string | null, slutDatum?: string | null, tid?: string | null, slutTid?: string | null, heldag?: boolean | null, plats?: string | null }} h
 * @returns {string} 16 hextecken.
 */
export function andringsnyckel(h) {
  const v = [h?.datum ?? null, h?.slutDatum ?? null, h?.tid ?? null, h?.slutTid ?? null, h?.heldag === true, typeof h?.plats === "string" ? h.plats.trim() : null];
  return createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
}

/**
 * Nästa SEQUENCE. Första utskicket (`forra` saknas) är 0. Är nyckeln densamma som förra gången står SEQUENCE kvar, och är den en annan stiger den med ett. Rent: den sparar ingenting.
 *
 * @param {{ sekvens: number, andringsnyckel: string } | null | undefined} forra Det som skickades senast.
 * @param {string} nyckel `andringsnyckel` för händelsen som den är nu.
 * @returns {{ sekvens: number, andringsnyckel: string, andrad: boolean }} `andrad`: det är en ändring av något som redan skickats.
 */
export function nastaSekvens(forra, nyckel) {
  if (typeof nyckel !== "string" || nyckel === "") throw new Error("nastaSekvens: nyckel krävs, ur andringsnyckel().");
  if (!forra) return { sekvens: 0, andringsnyckel: nyckel, andrad: false };
  if (!Number.isInteger(forra.sekvens) || forra.sekvens < 0 || typeof forra.andringsnyckel !== "string") {
    throw new Error("nastaSekvens: forra är { sekvens (heltal från 0), andringsnyckel } så som det sparades, eller utelämnas vid första utskicket.");
  }
  if (forra.andringsnyckel === nyckel) return { sekvens: forra.sekvens, andringsnyckel: nyckel, andrad: false };
  return { sekvens: forra.sekvens + 1, andringsnyckel: nyckel, andrad: true };
}

/**
 * @typedef {object} IcsHandelse
 * @property {string} id Händelsens id: UID är `<id>@<domän>`, så samma händelse är samma post hos varje gäst och en ändring ersätter den gamla.
 * @property {string} titel Rubriken (SUMMARY).
 * @property {string | null} [plats] Platsen (LOCATION). Utelämnas som egenskap när den saknas.
 * @property {string} datum `YYYY-MM-DD`. Utan datum finns ingen post att skriva, och funktionen kastar.
 * @property {string | null} [slutDatum] Sista dagen, inklusive.
 * @property {string | null} [tid] `HH:MM`. Utan klockslag, eller med `heldag`, är posten en heldag.
 * @property {string | null} [slutTid] `HH:MM`. Utan den är slutet samma ögonblick som början (RFC 5545 tillåter DTEND = DTSTART): ramverket gissar ingen längd.
 * @property {boolean | null} [heldag]
 */

/**
 * En kalenderpost (VCALENDAR med en VEVENT) för en händelse, som text med CRLF-radslut.
 *
 * ⛔ KASTAR FÖR INDATA SOM INTE GÅR ATT SKRIVA, och tystar ingenting: en händelse utan datum, en tid som inte är en tid, ett slut före början, en zon som inte finns. Ett brev med en trasig bilaga som ändå går iväg
 * är värre än ett som inte går.
 *
 * @param {object} d
 * @param {IcsHandelse} d.handelse
 * @param {number} d.sekvens SEQUENCE, heltal från 0. Se `nastaSekvens`.
 * @param {string} d.domän Domänen efter @ i UID, till exempel `my.life-hub.app`.
 * @param {string} d.tidszon IANA-namn, till exempel `Europe/Stockholm`. Klockslagen i händelsen är tid i den zonen.
 * @param {number} d.stampel När posten skrevs (DTSTAMP), millisekunder. Funktionen läser ingen klocka.
 * @param {string} [d.prodid] Förval `ICS_PRODID`.
 * @returns {string}
 */
export function byggIcs(d) {
  const h = d?.handelse;
  if (!h || typeof h !== "object") throw new Error("byggIcs: handelse krävs.");
  if (!Number.isInteger(d.sekvens) || d.sekvens < 0) throw new Error("byggIcs: sekvens är ett heltal från 0 (nastaSekvens ger det).");
  if (!Number.isFinite(d.stampel)) throw new Error("byggIcs: stampel krävs, millisekunder. Funktionen läser ingen klocka.");
  if (typeof d.domän !== "string" || !DOMANFORM.test(d.domän)) throw new Error("byggIcs: domän krävs, domänen efter @ i UID (till exempel my.life-hub.app).");
  if (typeof h.id !== "string" || !UIDDELFORM.test(h.id)) throw new Error("byggIcs: handelse.id krävs, bokstäver, siffror, punkt, understreck, tilde och bindestreck.");
  const titel = typeof h.titel === "string" ? h.titel.trim() : "";
  if (titel === "") throw new Error("byggIcs: handelse.titel krävs. En kalenderpost utan rubrik är en tom ruta.");
  if (typeof d.tidszon !== "string" || d.tidszon === "") throw new Error("byggIcs: tidszon krävs, ett IANA-namn som Europe/Stockholm.");
  try {
    zonskillnad(0, d.tidszon);
  } catch {
    throw new Error(`byggIcs: tidszonen ${JSON.stringify(d.tidszon)} finns inte. Ge ett IANA-namn som Europe/Stockholm.`);
  }
  const start = dag(h.datum);
  if (!start) throw new Error(`byggIcs: handelse.datum ${JSON.stringify(h.datum)} är inget datum (YYYY-MM-DD). En händelse utan datum har ingen post att skriva.`);
  const slutdag = h.slutDatum === undefined || h.slutDatum === null ? start : dag(h.slutDatum);
  if (!slutdag) throw new Error(`byggIcs: handelse.slutDatum ${JSON.stringify(h.slutDatum)} är inget datum (YYYY-MM-DD).`);
  if (Date.UTC(slutdag.y, slutdag.m - 1, slutdag.d) < Date.UTC(start.y, start.m - 1, start.d)) throw new Error("byggIcs: slutDatum ligger före datum.");
  for (const [namn, v] of /** @type {const} */ ([["tid", h.tid], ["slutTid", h.slutTid]])) {
    if (v !== undefined && v !== null && (typeof v !== "string" || !KLOCKFORM.test(v))) throw new Error(`byggIcs: handelse.${namn} ${JSON.stringify(v)} är inget klockslag (HH:MM).`);
  }

  const heldag = h.heldag === true || !h.tid;
  /** @type {string[]} */
  const tider = [];
  if (heldag) {
    tider.push(`DTSTART;VALUE=DATE:${datumText(start)}`, `DTEND;VALUE=DATE:${datumText(plusDagar(slutdag, 1))}`);
  } else {
    const a = lokalTillUtc(start, /** @type {string} */ (h.tid), d.tidszon);
    const b = h.slutTid ? lokalTillUtc(slutdag, h.slutTid, d.tidszon) : a;
    if (b < a) throw new Error("byggIcs: händelsen slutar före den börjar (slutTid före tid samma dag).");
    tider.push(`DTSTART:${utcText(a)}`, `DTEND:${utcText(b)}`);
  }

  const rader = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${d.prodid ?? ICS_PRODID}`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${h.id}@${d.domän}`,
    `DTSTAMP:${utcText(d.stampel)}`,
    ...tider,
    `SEQUENCE:${d.sekvens}`,
    `SUMMARY:${escape(titel)}`,
    ...(typeof h.plats === "string" && h.plats.trim() !== "" ? [`LOCATION:${escape(h.plats.trim())}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${rader.map(vik).join("\r\n")}\r\n`;
}
