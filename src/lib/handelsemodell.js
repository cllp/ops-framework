/**
 * Händelsemodellen: kontraktet för en händelse i en kalender, och svaren Kommer / Kommer inte (0.37.0, #179 F3).
 *
 * ══ ⛔ VARFÖR DEN HÄR FILEN FINNS ═════════════════════════════════════════════
 *
 * CP 2026-09-30, i #179: "Skapa händelse, man skall kunna välja att skapa en händelse i olika kalendrar ju, om man vill
 * skapa egna kalendrar, men om det är i gruppens kalender så skall vi kunna välja att händelsen skall kräva medlemmars
 * bekräftelse confirm/decline (optional) samt om det skall gå ut mail. Om det går bekräftelse skall det hamna i allas
 * inkorg."
 *
 * ══ ⛔ APPENS HÄNDELSER ÄR APPENS DATA. RAMVERKET ÄGER BARA KONTRAKTET ═════════
 *
 * CLAUDE.md "Vad som inte är regler här": ramverket vet aldrig vad appens händelser är. Det här är de FÄLT ramverket
 * läser på en händelse för att kunna rita den i rätt kalender och fråga efter svar, med samma namn som appen redan
 * använder (bolag-ops `web/src/data/handelser.js`: `datum`, `tid`, `slutTid`, `heldag`, `groupId`). Tre är nya:
 *
 *   - `kalenderId`: vilken av gruppens kalendrar händelsen hör till. ⛔ SAKNAS DEN GÄLLER GRUPPENS FÖRVALDA KALENDER, så
 *     befintliga rader stämmer utan bakfyllnad. En bakfyllnad hade skrivit samma uppgift (den förvalda) på varje gammal
 *     rad, och den dag någon byter förvald hade de raderna pekat på fel kalender utan att någon ändrat dem.
 *   - `slutDatum`: sista dagen för en händelse över flera dagar, inklusive. Utelämnad för en endagshändelse, aldrig lika
 *     med `datum` (en form, inte två, arbetsreglernas punkt 5).
 *   - `kravSvar`: gruppens medlemmar ombeds svara Kommer eller Kommer inte. Utelämnad eller `false`: ingen fråga.
 *
 * ⛔ UPPREPNING INGÅR INTE. CP har inte beslutat om veckovis upprepning som i SS eller ingen alls (#179 avsnitt 6).
 *
 * ══ ⛔ SVARET: EN RAD PER PERSON OCH HÄNDELSE, OCH NYCKELN ÄR PERSONEN ════════
 *
 * `<händelser>/{händelse}/<svar>/{uid}`. En undersamling till händelsen med personens uid som dokumentets nyckel, samma
 * form som samtalens läst-status (`<samtal>/{id}/<last>/{uid}`). Unikheten kommer ur sökvägen: det finns exakt en plats
 * för Annas svar på mötet, och ett andra svar är en uppdatering av den. Ingen fråga "har hon redan svarat?" före
 * skrivningen (punkt 2), och inget `handelseId` eller `uid` som fält på raden: båda står redan i sökvägen, och en kopia
 * hade kunnat säga något annat än nyckeln.
 *
 * ⛔ UNDERSAMLING OCH INTE EN EGEN SAMLING, av samma skäl som meddelandena i ett samtal: regeln behöver händelsens
 * grupp för att avgöra vem som läser, och som undersamling slår den upp händelsen en gång i stället för att raden bär en
 * kopia av `groupId`.
 *
 * ══ ⛔ RADEN I INKORGEN RÄKNAS FRAM, DEN SKRIVS INTE ══════════════════════════
 *
 * Varje medlem ska se en rad med Kommer / Kommer inte för varje händelse som kräver svar och som hen inte svarat på.
 * Den raden härleds ur händelserna och svaren (`svarsrader`), på samma sätt som `samtalsnotiser` härleder notiser ur
 * samtalen. En skriven inkorgspost per medlem hade krävt en server (en klient får inte skriva i någon annans namn), en
 * fan-out till varje medlem vid varje händelse, och den hade varit en andra sanning om samma obesvarade fråga: raden
 * hade stått kvar efter svaret tills någon mindes att ta bort den. Härledd försvinner den i samma stund som svaret skrivs.
 */

import { DATUMFORM, forvaldKalender, giltigtDatum } from "./kalendrar.js";

/** Fälten ramverket läser på en av appens händelser. Appens egna fält (`rubrik`, `typ`, ...) står inte här. */
export const HANDELSEKONTRAKT = /** @type {const} */ (["groupId", "kalenderId", "datum", "slutDatum", "tid", "slutTid", "heldag", "kravSvar"]);

/** Svaren. Två och inte tre: "kanske" är inget svar på "kommer du?", och en tredje knapp gör sammanställningen oläslig. */
export const SVARSVAL = /** @type {const} */ (["kommer", "kommerInte"]);

/** Fälten på en svarsrad. Bara svaret: händelsen och personen står i sökvägen. */
export const SVARSFALT = /** @type {const} */ (["svar"]);

/** Klockslaget `HH:MM`. Samma form som appens `TIDFORM`. */
export const KLOCKFORM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * @typedef {object} Handelsetid
 * @property {string} datum `YYYY-MM-DD`.
 * @property {string} [slutDatum] Sista dagen, inklusive. Bara när den är efter `datum`.
 * @property {string} [tid] `HH:MM`.
 * @property {string} [slutTid] `HH:MM`, bara med `tid`.
 * @property {boolean} [heldag]
 */

/**
 * Det som är fel i en händelses tid och kalender, som meningar att visa. Tom lista: inget fel.
 *
 * ⛔ MENINGAR OCH INTE ETT KAST, som appens `saknas`: formuläret skriver ut varje rad, så den som trycker på Spara får
 * veta vilket fält som stoppade. Samma kontroller gör regeln (`opsHandelsefaltGiltiga`), så en rad som går igenom här
 * går igenom där.
 *
 * ⛔ `slutTid` SAMMA DAG MÅSTE VARA EFTER `tid`, men över flera dagar får den vara tidigare (från 22:00 till 02:00 dagen
 * efter). Det är skälet till att kontrollen bor här och inte i en ren strängjämförelse.
 *
 * @param {Record<string, unknown>} h
 * @param {{ gruppkalendrar?: ReadonlyArray<{ id: string, arkiverad?: boolean }> }} [config] Med listan prövas `kalenderId`.
 * @returns {string[]}
 */
export function handelsefel(h, config = {}) {
  const r = h && typeof h === "object" ? h : {};
  /** @type {string[]} */
  const fel = [];
  const datum = typeof r.datum === "string" ? r.datum : "";
  if (!datum) fel.push("Välj ett datum");
  else if (!giltigtDatum(datum)) fel.push("Datumet finns inte");
  if (r.slutDatum !== undefined) {
    if (typeof r.slutDatum !== "string" || !giltigtDatum(r.slutDatum)) fel.push("Slutdatumet finns inte");
    else if (datum && r.slutDatum <= datum) fel.push("Slutdatumet måste vara efter startdatumet. En endagshändelse har inget slutdatum");
  }
  if (r.heldag !== undefined && typeof r.heldag !== "boolean") fel.push("Heldag är sant eller falskt");
  if (r.heldag === true) {
    if (r.tid !== undefined || r.slutTid !== undefined) fel.push("En heldagshändelse har varken från eller till");
  } else {
    if (r.tid !== undefined && !(typeof r.tid === "string" && KLOCKFORM.test(r.tid))) fel.push("Från ska vara ett klockslag, HH:MM");
    if (r.slutTid !== undefined) {
      if (!(typeof r.slutTid === "string" && KLOCKFORM.test(r.slutTid))) fel.push("Till ska vara ett klockslag, HH:MM");
      else if (r.tid === undefined) fel.push("Välj Från innan Till");
      else if (r.slutDatum === undefined && typeof r.tid === "string" && r.slutTid <= r.tid) fel.push("Till måste vara senare än Från");
    }
  }
  if (r.kravSvar !== undefined && typeof r.kravSvar !== "boolean") fel.push("Kräv svar är sant eller falskt");
  if (r.kalenderId !== undefined) {
    if (typeof r.kalenderId !== "string" || !r.kalenderId) fel.push("Kalendern saknar id");
    else if (config.gruppkalendrar) {
      const k = config.gruppkalendrar.find((x) => x.id === r.kalenderId);
      if (!k) fel.push("Kalendern finns inte bland gruppens kalendrar");
      else if (k.arkiverad) fel.push("Kalendern är arkiverad och tar inte emot nya händelser");
    }
  }
  return fel;
}

/**
 * Kalendern en händelse hör till: `kalenderId`, annars gruppens förvalda, annars `null` (gruppen har inga kalendrar).
 *
 * ⛔ HÄRLEDD OCH INTE BAKFYLLD, se filhuvudet.
 *
 * @param {{ kalenderId?: string }} h
 * @param {ReadonlyArray<{ id: string, forvald: boolean, arkiverad: boolean, ordning: number, namn: any }>} gruppkalendrar
 * @returns {string | null}
 */
export function handelsensKalenderId(h, gruppkalendrar) {
  if (h && typeof h.kalenderId === "string" && h.kalenderId) return h.kalenderId;
  const f = forvaldKalender(gruppkalendrar);
  return f ? f.id : null;
}

/**
 * En händelses datum, slutdatum och heldag som fälten på en rad i `OpsCalendar` (`date`, `endDate`, `allDay`).
 *
 * ⛔ EN MAPPNING, INTE EN I VARJE APP, av samma skäl som `postTillRad`: samma händelse ritas i kalendern och i appens
 * lista, och två mappningar hade börjat säga olika saker om sista dagen.
 *
 * @param {Handelsetid} h
 * @returns {{ date: string, endDate?: string, allDay?: true }}
 */
export function handelsensDagar(h) {
  const date = h.datum;
  return {
    date,
    ...(typeof h.slutDatum === "string" && h.slutDatum > date ? { endDate: h.slutDatum } : {}),
    ...(h.heldag === true ? { allDay: /** @type {const} */ (true) } : {}),
  };
}

/**
 * Bygger en svarsrad, eller kastar.
 * @param {unknown} svar @returns {{ svar: "kommer" | "kommerInte" }}
 */
export function byggSvar(svar) {
  if (!(/** @type {readonly unknown[]} */ (SVARSVAL)).includes(svar)) {
    throw new Error(`byggSvar: svaret "${String(svar)}" finns inte. Giltiga: ${SVARSVAL.join(", ")}.`);
  }
  return { svar: /** @type {"kommer" | "kommerInte"} */ (svar) };
}

/**
 * @typedef {object} Sammanstallning
 * @property {number} kommer
 * @property {number} kommerInte
 * @property {number} ejSvarat Medlemmar som inte svarat.
 * @property {string} text "3 kommer, 1 kommer inte, 2 har inte svarat". Alltid alla tre delarna, också när de är 0.
 */

/**
 * Hur det står: hur många som kommer, inte kommer och inte har svarat.
 *
 * ⛔ TOMT SKRIVS UT (punkt 5). "0 kommer, 0 kommer inte, 6 har inte svarat" och inte en tom rad eller bara "6 har inte
 * svarat": en sammanställning som utelämnar en del gör "ingen kommer" omöjligt att skilja från "inte räknat".
 *
 * ⛔ BARA MEDLEMMARNAS SVAR RÄKNAS. Ett svar från någon som lämnat gruppen står kvar i databasen (det raderas aldrig),
 * men den personen är inte längre en av dem som tillfrågas, och hade hen räknats hade summan blivit större än gruppen.
 *
 * @param {ReadonlyArray<{ id: string, svar: string }>} svar Raderna ur svarssamlingen, `id` är personens uid.
 * @param {ReadonlyArray<string>} medlemmar Uid:n på gruppens aktiva medlemmar av typen person.
 * @returns {Sammanstallning}
 */
export function sammanstallSvar(svar, medlemmar) {
  const per = new Map((svar ?? []).map((s) => [s.id, s.svar]));
  let kommer = 0;
  let kommerInte = 0;
  for (const uid of medlemmar ?? []) {
    const s = per.get(uid);
    if (s === "kommer") kommer += 1;
    else if (s === "kommerInte") kommerInte += 1;
  }
  const ejSvarat = (medlemmar ?? []).length - kommer - kommerInte;
  return { kommer, kommerInte, ejSvarat, text: `${kommer} kommer, ${kommerInte} kommer inte, ${ejSvarat} har inte svarat` };
}

/**
 * Om en händelse har passerat: sista dagen (`slutDatum` eller `datum`) är före idag.
 * @param {Handelsetid} h @param {string} idag `YYYY-MM-DD` @returns {boolean}
 */
export function harPasserat(h, idag) {
  return (typeof h.slutDatum === "string" && h.slutDatum > h.datum ? h.slutDatum : h.datum) < idag;
}

/**
 * Inkorgens rader: en per händelse som kräver svar, som personen inte svarat på och som inte passerat.
 *
 * ⛔ HÄRLEDDA, SE FILHUVUDET. Raden försvinner när svaret finns, och när dagen gått.
 *
 * ⛔ EN HÄNDELSE SOM PASSERAT FRÅGAR INTE LÄNGRE. "Kommer du på mötet i förrgår?" är ingen fråga, och en inkorg som
 * fylls av gamla frågor lär att raderna inte behöver läsas.
 *
 * @template {Handelsetid & { id: string, kravSvar?: boolean }} H
 * @param {{ handelser: ReadonlyArray<H>, mina: ReadonlyMap<string, string> | Record<string, string>, idag: string }} arg
 *   `mina`: personens egna svar per händelse-id (ur `createSvarskalla().mina`).
 * @returns {H[]} Händelserna, sorterade på datum och tid.
 */
export function svarsrader({ handelser, mina, idag }) {
  if (!DATUMFORM.test(idag)) throw new Error(`svarsrader: idag "${idag}" ska vara YYYY-MM-DD.`);
  const har = mina instanceof Map ? (/** @type {string} */ id) => mina.has(id) : (/** @type {string} */ id) => Object.prototype.hasOwnProperty.call(mina ?? {}, id);
  return (handelser ?? [])
    .filter((h) => h && h.kravSvar === true && !har(h.id) && !harPasserat(h, idag))
    .slice()
    .sort((a, b) => a.datum.localeCompare(b.datum) || String(a.tid ?? "").localeCompare(String(b.tid ?? "")));
}
