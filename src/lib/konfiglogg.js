/**
 * Ändringsloggen för konfiguration: vem ändrade vad, och vad stod det förut.
 *
 * ══ ⛔ VARFÖR KONFIG BEHÖVER EN EGEN LOGG (#113) ══════════════════════
 *
 * Konfigurationen är det enda i appen där en ändring ändrar vad ALLA ANDRA
 * ser. Döps en kategori om, eller arkiveras den, ändras varje vy för varje
 * användare, och ingen rad i databasen bär spåret av vem som gjorde det.
 *
 * ⛔ AKTIVITETSLOGGEN RÄCKER INTE, och det är inte en dubblering att säga det.
 * Den säger vad ett JOBB gjorde. Det här är vad en MÄNNISKA gjorde i en vy, och
 * de två frågorna ställs vid olika tillfällen: den ena när något kört fel, den
 * andra när någon undrar varför filtret ser annorlunda ut i dag. En gemensam
 * lista hade betytt att den vanliga frågan alltid besvaras genom att bläddra
 * förbi hundra jobbrader.
 *
 * ══ ⛔ `fore` OCH `efter`, INTE BARA `efter` ══════════════════════════
 *
 * En logg som säger "kategorin ändrades" svarar inte på den enda fråga någon
 * ställer, nämligen vad den hette förut. Utan `fore` är loggen en notis och
 * inte ett spår, och en notis om något som redan hänt är värdelös.
 *
 * ══ ⛔ SKRIVAREN KASTAR ALDRIG ════════════════════════════════════════
 *
 * Samma val som `createActivityWriter`, av samma skäl: en logg som kan sänka
 * det den loggar är värre än ingen logg. Att spara en kategori ska inte
 * misslyckas för att loggraden inte gick att skriva, och alternativet, att
 * varje anropsställe lindar sitt anrop i try, fungerar tills någon glömmer en
 * gång.
 */

import { text } from "./sprak.js";

/** Vad som kan ha hänt med en kategori. */
export const KONFIGHANDELSER = /** @type {const} */ (["tillagd", "andrad", "arkiverad", "framtagen"]);

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Bygger en loggrad, eller kastar med skälet.
 *
 * ⛔ KASTAR HÄR MEN INTE I SKRIVAREN. Ett utkast som saknar `vad` är ett
 * programfel hos anroparen och ska synas i utveckling. Att en skrivning mot
 * databasen misslyckas är drift, och det får aldrig sänka den som loggades.
 * Samma uppdelning som aktivitetsloggens `orsak: "utkast"` mot `"skrivning"`.
 *
 * @param {{ handelse?: string, id?: string, fore?: unknown, efter?: unknown, av?: unknown, nu?: () => string }} d
 */
export function byggKonfigandring(d = {}) {
  const handelse = rensa(d.handelse);
  if (!(/** @type {readonly string[]} */ (KONFIGHANDELSER).includes(handelse))) {
    throw new Error(`byggKonfigandring: okänd handelse "${handelse}". Giltiga: ${KONFIGHANDELSER.join(", ")}.`);
  }
  const id = rensa(d.id);
  if (!id) throw new Error("byggKonfigandring: id krävs. En loggrad utan vilken kategori det gällde går inte att söka i.");

  /*
   * ⛔ `fore` KRÄVS FÖR ALLT UTOM EN NYTILLAGD. Det är hela poängen med
   * loggen, och ett `undefined` där hade gjort raden till en notis. En
   * nytillagd kategori har per definition inget före, och då står det `null`
   * och inte en tom sträng: de två betyder olika saker.
   */
  if (handelse !== "tillagd" && d.fore === undefined) {
    throw new Error(`byggKonfigandring: fore krävs för "${handelse}". Utan det svarar loggen inte på vad som stod förut, och då är den en notis och inte ett spår.`);
  }

  return {
    handelse: /** @type {typeof KONFIGHANDELSER[number]} */ (handelse),
    id,
    fore: handelse === "tillagd" ? null : (d.fore ?? null),
    efter: d.efter ?? null,
    nar: (d.nu || (() => new Date().toISOString()))(),
    av: d.av ?? null,
  };
}

/**
 * En mening om vad som hände, på valt språk.
 *
 * ⛔ MENINGEN BYGGS AV LOGGRADEN OCH INTE AV KATALOGEN. Kategorin kan vara
 * borttagen eller omdöpt sedan dess, och en mening som slår upp dagens namn
 * hade skrivit om historien: "Ärenden döptes om till Ärenden".
 *
 * @param {ReturnType<typeof byggKonfigandring>} rad
 * @param {string} [sprak]
 * @returns {string}
 */
export function beskrivKonfigandring(rad, sprak = "sv") {
  const namnFore = rad && rad.fore ? text(/** @type {any} */ (rad.fore).namn, sprak) : "";
  const namnEfter = rad && rad.efter ? text(/** @type {any} */ (rad.efter).namn, sprak) : "";
  const namnet = namnEfter || namnFore || rad.id;

  if (rad.handelse === "tillagd") return `${namnet} lades till`;
  if (rad.handelse === "arkiverad") return `${namnet} arkiverades`;
  if (rad.handelse === "framtagen") return `${namnet} togs fram ur arkivet`;
  if (namnFore && namnEfter && namnFore !== namnEfter) return `${namnFore} döptes om till ${namnEfter}`;
  return `${namnet} ändrades`;
}

/**
 * Skrivaren. `append` skickas in, så ramverket får inget beroende till en
 * databas och loggen går att prova utan en.
 *
 * @param {{ append: (rad: any) => Promise<unknown>, nu?: () => string }} config
 */
export function createConfigLog(config) {
  const { append, nu } = config ?? /** @type {any} */ ({});
  if (typeof append !== "function") {
    throw new Error("createConfigLog: append krävs, en funktion som skriver raden. Ramverket ska inte veta var loggen bor.");
  }

  return {
    /**
     * Skriver en rad.
     *
     * ⛔ SVARAR `{ ok, fel, orsak }` OCH KASTAR ALDRIG, och `orsak` skiljer
     * `utkast` från `skrivning`: det första är ett programfel hos anroparen,
     * det andra är drift. Utan skillnaden felsöker nästa person en databas när
     * felet är ett saknat fält.
     *
     * @param {Parameters<typeof byggKonfigandring>[0]} utkast
     */
    async skriv(utkast) {
      /** @type {any} */
      let rad;
      try {
        rad = byggKonfigandring({ ...utkast, nu });
      } catch (fel) {
        return { ok: false, fel: fel instanceof Error ? fel : new Error(String(fel)), orsak: "utkast" };
      }
      try {
        await append(rad);
        return { ok: true, fel: null, orsak: null, rad };
      } catch (fel) {
        return { ok: false, fel: fel instanceof Error ? fel : new Error(String(fel)), orsak: "skrivning" };
      }
    },
  };
}
