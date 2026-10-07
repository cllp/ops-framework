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
 * Ett köat dokument, utan id. Id sätter datakällan.
 *
 * @param {unknown} falt
 * @param {string} [namn] Vems feltext. Kön säger `koa`, så anroparen ser sitt anrop.
 * @returns {{ till: string, amne: string, text: string, html: string, sprak: "sv" | "en", kategori: string, groupId: string | null, status: "koad" }}
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
  return { till, amne, text, html, sprak, kategori, groupId, status: "koad" };
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
