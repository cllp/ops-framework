/**
 * Mejlmodulens rena del: språk, spärrade domäner, dokumentets form och regelfragmentet.
 *
 * ⛔ INGEN TRANSPORT OCH INGEN HEMLIGHET. Filen importeras av huvudingången
 * (regelfragmentet limmas in i appens regler) och av nodsidan (kön och
 * utskicket). En import av en SMTP-klient här hade dragit in den i webbundlen.
 *
 * ⛔ LOGIKEN ÄR SESSIONSTUDIOS, INTE FILERNA. `resolveMailLang` och de spärrade
 * domänerna i `sendEmailNotification.js` är CommonJS i en hybridmodell. Här är
 * samma beslut, i ramverkets form: sv eller en, och en spärrad domän skickas
 * inte. Copy-mallarna (inbjudningstexter, RSVP) hör till SessionStudio och
 * finns inte här. Appen skickar färdigt ämne, text och html.
 */

import { RESERVSPRAK, SPRAK } from "./sprak.js";

/**
 * Samma fyra som SessionStudio spärrar, så att ett provmejl till example.com
 * aldrig lämnar huset. En femte domän lägger appen till vid utskicket. Den
 * tar inte bort de här: en tom lista från appen ska inte öppna example.com.
 *
 * @type {readonly string[]}
 */
export const SPARRADA_MEJLDOMANER = Object.freeze(["test.se", "example.com", "test.com", "example.se"]);

/**
 * En adress ska se ut som en adress innan något skrivs eller skickas: något, ett snabel-a, något, en punkt och något. Inte en giltighetskontroll av brevlådan, bara att raden
 * inte är skräp. ⛔ EN SANNING (regel 2, 0.128.0): servern (`createGroupService`), formuläret (`OpsGruppFormular`) och Mejla länk (`MejlaLank`) hade var sin kopia av uttrycket.
 */
export const EPOSTFORM = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Skälet till att en adress inte går att skicka till, eller `null`: tom, fel form, eller en spärrad domän (`sparradMejldoman`, så att ett provmejl till example.com
 * aldrig lämnar huset). Adressen prövas trimmad.
 *
 * @param {unknown} till
 * @param {readonly string[]} [extraSparrade] Appens egna spärrade domäner, utöver `SPARRADA_MEJLDOMANER`.
 * @returns {string | null}
 */
export function epostFel(till, extraSparrade = []) {
  const a = typeof till === "string" ? till.trim() : "";
  if (!a) return "Skriv en e-postadress.";
  if (!EPOSTFORM.test(a)) return `"${a}" är inte en e-postadress.`;
  const sparr = sparradMejldoman(a, extraSparrade);
  if (sparr.sparrad) return `Mejl till ${sparr.doman} skickas inte.`;
  return null;
}

/** Ett samlingsnamn, inte en sökväg. Samma form som i `regler.js`. */
const SAMLINGSFORM = /^[A-Za-z][A-Za-z0-9_-]*$/;

/**
 * @param {unknown} namn
 * @param {string} vem
 * @returns {string}
 */
export function kontrolleraMejlsamling(namn, vem) {
  if (typeof namn !== "string" || !SAMLINGSFORM.test(namn)) {
    throw new Error(`${vem}: "${namn}" är inte ett samlingsnamn. Appen skickar in köns namn, ramverket känner det inte.`);
  }
  return namn;
}

/**
 * @param {unknown} till
 * @param {readonly string[]} [extra]
 * @returns {{ sparrad: true, doman: string } | { sparrad: false, doman: string | null }}
 */
export function sparradMejldoman(till, extra = []) {
  if (typeof till !== "string" || !till.includes("@")) return { sparrad: false, doman: null };
  const doman = till.trim().toLowerCase().split("@").pop() ?? "";
  if (!doman) return { sparrad: false, doman: null };
  const lista = new Set([
    ...SPARRADA_MEJLDOMANER,
    ...extra.filter((d) => typeof d === "string").map((d) => d.trim().toLowerCase()),
  ]);
  if (lista.has(doman)) return { sparrad: true, doman };
  return { sparrad: false, doman };
}

/**
 * `normalizeMailLang`. Bara exakt `sv` eller `en`. `SV` är inte svenska: ett
 * tyst gemener-förval hade lagrat ett språk appen inte skickade.
 *
 * @param {unknown} v
 * @returns {"sv" | "en" | null}
 */
export function normaliseraMejlsprak(v) {
  if (typeof v !== "string") return null;
  return SPRAK.some((s) => s === v) ? /** @type {"sv" | "en"} */ (v) : null;
}

/**
 * `resolveMailLang`. Ordning: händelsens språk, gruppens, avsändarens, sedan
 * reserven (sv). En ogiltig kandidat hoppas över, den avbryter inte kedjan.
 *
 * @param {{ handelse?: unknown, grupp?: unknown, avsandare?: unknown }} [kallor]
 * @returns {"sv" | "en"}
 */
export function losMejlsprak(kallor) {
  const k = kallor ?? {};
  return normaliseraMejlsprak(k.handelse) ?? normaliseraMejlsprak(k.grupp) ?? normaliseraMejlsprak(k.avsandare) ?? RESERVSPRAK;
}

/**
 * Högst så här många bilagor i ett brev (0.148.0, cllp/ops-framework#453). En kalenderpost per brev är det appen behöver, fem
 * är ett tak och ingen mål.
 */
export const MEJL_BILAGOR_MAX = 5;

/**
 * Högst så här många byte (UTF-8) i EN bilaga. Bilagan ligger som text på köns dokument tills brevet gått, och dokumentet har en gräns
 * i datalagret. En `.ics` för en händelse är under 1 kB, så 32 KiB har god marginal utan att ett dokument med fem av dem
 * (160 KiB) kommer nära gränsen.
 */
export const MEJL_BILAGA_MAX_BYTES = 32 * 1024;

/**
 * Mediatyperna en bilaga får ha, utan parametrar och i gemener. `text/calendar` är kalenderposten. En ny typ läggs till här när en app
 * behöver den, med ett eget skäl: en körbar eller aktiv fil i ett brev från en tjänst är ett missbruk som väntar.
 *
 * @type {readonly string[]}
 */
export const MEJL_BILAGETYPER = Object.freeze(["text/calendar"]);

/** Högst så många tecken i ett filnamn. */
const MEJL_BILAGENAMN_MAX = 120;

/** Ett filnamn utan sökväg, citattecken eller styrtecken: det hamnar i ett brevhuvud. */
const OLAGLIGT_FILNAMN = /[\u0000-\u001f\u007f\\/"]/;

const BILAGEFALT = Object.freeze(["filnamn", "innehall", "typ"]);

/**
 * @typedef {object} Mejlbilaga
 * @property {string} filnamn Filnamnet mottagaren ser, till exempel `inbjudan.ics`.
 * @property {string} innehall Innehållet som text. Kalenderposten är text.
 * @property {string} typ Mediatypen, till exempel `text/calendar; charset=utf-8` (`ICS_MIME`). Parametrar tillåts, typen före dem prövas mot `MEJL_BILAGETYPER`.
 */

/**
 * Bilagorna i ett brev, prövade och i rätt form, eller ett fel som säger vilken bilaga och vad som är fel (0.148.0, #453).
 *
 * ⛔ EN BILAGA UTANFÖR TAKET KASTAR OCH SKICKAS ALDRIG TYST UTAN (regel 5). Ett brev som lovar en kalenderpost och kommer utan den är
 * sämre än ett brev som inte går. Därför prövar `byggMejl` (kön), `createMailSender` (utskicket, mot raden i källan) och
 * transporterna (`send`) med DEN HÄR funktionen: ett tak, ett ställe (regel 2).
 *
 * Utelämnad är ingen bilaga. En tom lista är det också, och ger samma lista (`[]`). Fält utöver de tre kastar: en bilaga med `namn` och
 * `content` (appens gamla form och nodemailers) hade annars tappat sitt filnamn och sitt innehåll utan ett ord.
 *
 * @param {unknown} bilagor
 * @param {string} [namn] Vems feltext, som i `byggMejl`.
 * @returns {Mejlbilaga[]}
 */
export function kontrolleraMejlbilagor(bilagor, namn = "byggMejl") {
  if (bilagor === undefined) return [];
  if (!Array.isArray(bilagor)) throw new Error(`${namn}: bilagor är en lista eller utelämnad.`);
  if (bilagor.length > MEJL_BILAGOR_MAX) {
    throw new Error(`${namn}: högst ${MEJL_BILAGOR_MAX} bilagor i ett brev, ${bilagor.length} gavs.`);
  }
  return bilagor.map((b, i) => {
    const vem = `${namn}: bilaga ${i + 1}`;
    if (!b || typeof b !== "object" || Array.isArray(b)) {
      throw new Error(`${vem} är inte en bilaga. Formen är { filnamn, innehall, typ }.`);
    }
    const rad = /** @type {Record<string, unknown>} */ (b);
    const okant = Object.keys(rad).filter((k) => !BILAGEFALT.includes(k));
    if (okant.length > 0) {
      throw new Error(`${vem} har fältet ${okant.map((k) => `"${k}"`).join(", ")}. Formen är { filnamn, innehall, typ }, och inget annat följer med.`);
    }
    const filnamn = typeof rad.filnamn === "string" ? rad.filnamn.trim() : "";
    if (!filnamn) throw new Error(`${vem}: filnamn krävs.`);
    if (filnamn.length > MEJL_BILAGENAMN_MAX) throw new Error(`${vem}: filnamnet är över ${MEJL_BILAGENAMN_MAX} tecken.`);
    if (OLAGLIGT_FILNAMN.test(filnamn)) throw new Error(`${vem}: filnamnet får inte ha sökväg, citattecken eller styrtecken.`);
    const typ = typeof rad.typ === "string" ? rad.typ.trim() : "";
    if (!typ) throw new Error(`${vem}: typ krävs.`);
    if (/[\r\n]/.test(typ)) throw new Error(`${vem}: typ får inte ha radbrytning.`);
    const mediatyp = (typ.split(";")[0] ?? "").trim().toLowerCase();
    if (!MEJL_BILAGETYPER.includes(mediatyp)) {
      throw new Error(`${vem}: typen "${mediatyp}" är inte tillåten. Tillåtna: ${MEJL_BILAGETYPER.join(", ")}.`);
    }
    if (typeof rad.innehall !== "string") throw new Error(`${vem}: innehall är en sträng.`);
    if (!rad.innehall.trim()) throw new Error(`${vem}: innehall är tomt. En tom bilaga skickas inte.`);
    const byte = new TextEncoder().encode(rad.innehall).length;
    if (byte > MEJL_BILAGA_MAX_BYTES) {
      throw new Error(`${vem}: innehall är ${byte} byte, högst ${MEJL_BILAGA_MAX_BYTES} byte per bilaga.`);
    }
    return { filnamn, innehall: rad.innehall, typ };
  });
}

/**
 * Ett köat dokument, utan id. Id sätter datakällan.
 *
 * @param {unknown} falt
 * @param {string} [namn] Vems feltext. Kön säger `koa`, så anroparen ser sitt anrop.
 * @returns {{ till: string, amne: string, text: string, html: string, sprak: "sv" | "en", kategori: string, groupId: string | null, status: "koad", bilagor?: Mejlbilaga[] }}
 */
export function byggMejl(falt, namn = "byggMejl") {
  const rad = falt && typeof falt === "object" ? /** @type {Record<string, unknown>} */ (falt) : {};
  const till = typeof rad.till === "string" ? rad.till.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(till)) {
    throw new Error(`${namn}: till måste vara en e-postadress, en mottagare per dokument.`);
  }
  const amne = typeof rad.amne === "string" ? rad.amne.trim() : "";
  if (!amne) throw new Error(`${namn}: amne krävs.`);
  if (rad.text !== undefined && typeof rad.text !== "string") throw new Error(`${namn}: text är en sträng eller utelämnad.`);
  if (rad.html !== undefined && typeof rad.html !== "string") throw new Error(`${namn}: html är en sträng eller utelämnad.`);
  const text = typeof rad.text === "string" ? rad.text : "";
  const html = typeof rad.html === "string" ? rad.html : "";
  if (!text.trim() && !html.trim()) throw new Error(`${namn}: text eller html krävs. Ett tomt mejl köas inte.`);
  const sprak = normaliseraMejlsprak(rad.sprak);
  if (!sprak) throw new Error(`${namn}: sprak måste vara sv eller en.`);
  const kategori = typeof rad.kategori === "string" ? rad.kategori.trim() : "";
  if (!kategori) throw new Error(`${namn}: kategori krävs.`);
  let groupId = null;
  if (rad.groupId !== undefined && rad.groupId !== null) {
    if (typeof rad.groupId !== "string" || !rad.groupId.trim()) {
      throw new Error(`${namn}: groupId är en sträng eller utelämnad.`);
    }
    groupId = rad.groupId.trim();
  }
  // ⛔ BILAGOR KOMMER MED BARA NÄR DET FINNS NÅGRA (0.148.0, #453). Ett brev utan är byte för byte det det var: ingen tom nyckel på raden.
  const bilagor = kontrolleraMejlbilagor(rad.bilagor, namn);
  const mejl = { till, amne, text, html, sprak, kategori, groupId, status: /** @type {const} */ ("koad") };
  return bilagor.length > 0 ? { ...mejl, bilagor } : mejl;
}

/**
 * Regelfragment för kösamlingen. Klienten läser inte och skriver inte.
 * Servern skriver med Admin SDK, som går förbi regeln.
 *
 * ⛔ NAMNET KOMMER FRÅN APPEN. Ett förval hade varit ett samlingsnamn ramverket
 * känner, och det är just det det inte ska göra.
 *
 * Fragmentet står för sig. Det använder inga hjälpfunktioner ur `regelfragment()`,
 * så det kan limmas in var som helst i appens `match /databases/.../documents`.
 *
 * @param {string} [namn]
 * @returns {string}
 */
export function mejlregelfragment(namn) {
  const samling = kontrolleraMejlsamling(namn, "mejlregelfragment");
  return `    // Mejlkön. GENERERAD, ändra inte för hand.
    //
    // Källa: ops-framework, mejlregelfragment() i src/lib/mejl.js.
    // Klienten läser inte kön och skriver den inte. Bara servern, med Admin SDK.
    // En kö som en klient kan läsa är en lista över andras adresser, och en kö
    // som en klient kan skriva är ett utskick i någon annans namn.
    match /${samling}/{id} {
      allow read, write: if false;
    }
`;
}
