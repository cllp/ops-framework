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
 * ══ ⛔ `groupId` PÅ VARJE RAD (#188) ═══════════════════════════════════
 *
 * Katalogen är gruppens sedan 0.33.0, och då är ändringsloggen över den gruppens
 * också. Före 0.39.0 bar raden ingen grupp, så appens regel för den kunde bara
 * fråga "är du admin i appens grupp" och inte "är du admin i RADENS grupp".
 * Följden (cllp/bolag-ops steg 4, 2026-09-30): en admin i en ANNAN grupp sparade
 * en kategori, katalograden skrevs, och loggraden nekades. Katalogen ändrad, spåret
 * utebliven, och ingenting visade det.
 *
 * ⛔ GRUPPEN KRÄVS, och saknas den kastar `byggKonfigandring` (i skrivaren:
 * `orsak: "utkast"`). Ett tyst förval hade varit samma hål med ett värde i: raden
 * skriven, men åt fel grupp.
 *
 * ══ ⛔ KATEGORINS ID HETER `kategori` I RADEN, INTE `id` (#188) ═══════════
 *
 * Datakällan tolkar fältet `id` i en post som dokumentets nyckel (`setDoc`) och tar bort det ur datan. Loggradens
 * `id` var KATEGORINS id, så första ändringen av "uppgift" skrev dokumentet `konfiglogg/uppgift` och varje senare
 * ändring av samma kategori blev en UPPDATERING av det: loggen är stängd för uppdateringar, och loggraden nekades.
 * Mätt mot emulatorn: andra ändringen av samma kategori ger PERMISSION_DENIED, och likadant den första ändringen
 * av en kategori som en ANNAN grupp redan loggat, eftersom kategori-id:n inte bär gruppen. Loggen höll alltså en rad
 * per kategori och ingen alls för en grupp som kom efter, och inget visade det.
 *
 * Raden bär därför `kategori` och inget `id`, så att datakällan ger varje rad ett eget dokument-id. Gamla rader (en
 * per kategori, dokument-id = kategori-id, inget `kategori`-fält) läses vidare: `beskrivKonfigandring` faller
 * tillbaka på radens `id`, som då är dokument-id:t.
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

/**
 * Fälten på en loggrad, och det enda stället listan står.
 *
 * ⛔ REGELFRAGMENTET HÄRLEDER SIN `hasOnly` UR DEN HÄR LISTAN
 * (`konfigloggregelfragment`), och provet i `konfiglogg.test.js` mäter att
 * `byggKonfigandring` skriver exakt de här nycklarna. Två handskrivna listor
 * hade glidit isär första gången ett fält tillkom, och då hade varje loggrad
 * fallit på "Missing or insufficient permissions" utan att något annat sagt vad.
 */
export const KONFIGLOGGFALT = /** @type {const} */ (["handelse", "kategori", "fore", "efter", "nar", "av", "groupId"]);

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
 * @param {{ handelse?: string, groupId?: string, id?: string, fore?: unknown, efter?: unknown, av?: unknown, nu?: () => string }} d
 */
export function byggKonfigandring(d = {}) {
  const handelse = rensa(d.handelse);
  if (!(/** @type {readonly string[]} */ (KONFIGHANDELSER).includes(handelse))) {
    throw new Error(`byggKonfigandring: okänd handelse "${handelse}". Giltiga: ${KONFIGHANDELSER.join(", ")}.`);
  }
  const id = rensa(d.id);
  if (!id) throw new Error("byggKonfigandring: id krävs. En loggrad utan vilken kategori det gällde går inte att söka i.");
  const groupId = rensa(d.groupId);
  if (!groupId) {
    throw new Error(
      "byggKonfigandring: groupId krävs (#188). En loggrad utan grupp kan inte skyddas av gruppens regler: en admin i en annan grupp nekas, eller raden läses av ingen.",
    );
  }

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
    kategori: id,
    fore: handelse === "tillagd" ? null : (d.fore ?? null),
    efter: d.efter ?? null,
    nar: (d.nu || (() => new Date().toISOString()))(),
    av: d.av ?? null,
    groupId,
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
  // ⛔ `kategori` för nya rader, `id` för de gamla där dokument-id:t ÄR kategori-id:t (se filhuvudet).
  const namnet = namnEfter || namnFore || /** @type {any} */ (rad).kategori || /** @type {any} */ (rad).id;

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
