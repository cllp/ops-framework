/**
 * Katalogkällan: Firestore är sanningen, repot bär standardvärdena.
 *
 * ══ ⛔ PRINCIPEN, OCH VEM SOM ÄGER VAD (#110) ══════════════════════════
 *
 * Ur epiken #92: konfigurationen är ramverkets data, inte appens. Appen bär
 * standardvärdena, alltså det som ska stå i en tom databas första gången, och
 * inget mer. Allt efter det bor i databasen och ändras i inställningsvyn.
 *
 * ⛔ SAMLINGSNAMNET KOMMER UTIFRÅN, OCH DET ÄR INTE PYNT. Det är raden som gör
 * en framtida kund till ett eget Firebase-projekt utan att datamodellen ändras.
 * Skrev ramverket `kataloger` rakt i koden vore det ett antagande om databasen,
 * och antagandet upptäcks först den dag någon har en annan. Samma skäl som att
 * datakällan skickas in och inte byggs här.
 *
 * ══ ⛔ TRE FRÅGOR SOM MÅSTE HA SITT SVAR I KODEN ══════════════════════
 *
 * 1. NÄR SEEDAS STANDARDVÄRDENA? Bara mot en TOM samling. Aldrig ovanpå en
 *    ändring: annars kommer en kategori som arkiverats tillbaka vid nästa
 *    driftsättning, och det ser ut som ett spöke.
 *
 * 2. VAD HÄNDER NÄR DATABASEN INTE SVARAR? Standardvärdena används OCH det
 *    syns. Ett tyst fall tillbaka betyder att den som nyss arkiverade en
 *    kategori ser den kvar och tror att knappen inte fungerade. Svaret bär
 *    därför `kalla: "reserv"` och felet, så vyn kan skriva ut en banderoll.
 *    CLAUDE.md regel 1 och 5: en fallback som döljer en trasig konfiguration är
 *    samma sak som en tystad `try/catch`.
 *
 * 3. VEM FÅR SKRIVA? Ägaren, enligt rollerna i Fas 1. Den kontrollen bor i
 *    Firestore-reglerna och inte här, eftersom en kontroll i klienten bara är
 *    en artighet: den som vill skriva ändå öppnar konsolen.
 *
 * ══ ⛔ VAD DEN HÄR MODULEN INTE GÖR ═══════════════════════════════════
 *
 * Den prenumererar inte själv. `useLiveCollection` finns redan och gör det
 * bättre, och en andra prenumerationsmekanism hade varit två sanningar om när
 * data är färsk. Modulen är ren logik ovanpå datakontraktet, så den går att
 * prova utan en databas och att köra på nodsidan (cllp/bolag-ops#385).
 */

import { validateKatalog } from "../lib/katalog.js";

/**
 * @typedef {object} Katalogsvar
 * @property {import("../lib/katalog.js").Kategori[]} kategorier
 * @property {"databas" | "reserv"} kalla Var värdena kom ifrån.
 * @property {Error | null} fel Sant fel när `kalla` är "reserv", annars null.
 */

/**
 * @param {{ source: any, collection: string, standard?: unknown[], ikoner?: readonly string[], namn?: string, textnycklar?: readonly string[], faser?: boolean, farger?: boolean }} config
 */
export function createCatalogSource(config) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN, samma skäl som i `createGoogleAuth`:
   * med `({ x })` i signaturen kraschar ett anrop utan argument på destrukturen
   * med ett fel som nämner en variabel inne i ramverket, inte vad appen glömde.
   */
  const { source, collection, standard = [], ikoner, namn = "katalog", textnycklar, faser, farger } = config ?? /** @type {any} */ ({});

  if (!source || typeof source.list !== "function" || typeof source.create !== "function") {
    throw new Error("createCatalogSource: source krävs och måste vara en datakälla ur createDataSource.");
  }
  if (typeof collection !== "string" || !collection.trim()) {
    throw new Error(
      "createCatalogSource: collection krävs. Ramverket känner aldrig samlingsnamnet självt, eftersom det är raden som gör en framtida kund till ett eget projekt utan att datamodellen ändras.",
    );
  }

  /*
   * ⛔ STANDARDVÄRDENA VALIDERAS VID UPPSTART, INTE VID SEEDNING. Ett fel i
   * repots egna värden är ett programfel, och det ska synas när appen startar
   * och inte första gången någon råkar köra mot en tom databas. Det senare är
   * ett fel i produktion hos den första kunden.
   */
  const reserv = validateKatalog(standard, { ikoner, textnycklar, faser, farger, katalog: `${namn} (standardvärden)` });

  return {
    /** Vad samlingen heter hos den här appen. För vyer som visar sin källa. */
    collection,

    /**
     * Läser katalogen.
     *
     * ⛔ KASTAR ALDRIG. Svarar med `{ kategorier, kalla, fel }`, och det är
     * skillnaden mot att låta anroparen hantera det: en vy som får ett kastat
     * fel ritar antingen ingenting eller en tom lista, och en tom lista är
     * samma sak som "det finns inga kategorier". Här går det alltid att skilja
     * "läst ur databasen" från "det här är reserven, och här är varför".
     *
     * @returns {Promise<Katalogsvar>}
     */
    async las() {
      try {
        const rader = await source.list(collection);
        const kategorier = validateKatalog(Array.isArray(rader) ? rader : [], { ikoner, textnycklar, faser, farger, katalog: namn });
        // ⛔ En TOM samling är inte ett fel och inte heller reserven: det är
        // läget före seedningen, och `saknas` nedan är frågan man ställer då.
        return { kategorier, kalla: "databas", fel: null };
      } catch (fel) {
        return { kategorier: reserv, kalla: "reserv", fel: fel instanceof Error ? fel : new Error(String(fel)) };
      }
    },

    /**
     * Skriver standardvärdena, men bara i en tom samling.
     *
     * ⛔ SVARAR MED VAD SOM HÄNDE OCH INTE MED INGENTING. `{ seedade, antal }`,
     * så den som kör det ser skillnaden mellan "skrev fem" och "gjorde inget
     * för att det redan fanns värden". Ett tyst `return` hade gjort de två
     * utfallen omöjliga att skilja åt i en logg, och det är precis den
     * skillnaden man vill ha när en kategori dyker upp igen.
     *
     * ⛔ LÄSER FÖRST OCH SKRIVER SEDAN, VILKET INTE ÄR ATOMÄRT. Två samtidiga
     * seedningar kan båda se en tom samling. Det är medvetet och ofarligt här:
     * seedningen körs en gång vid uppsättning, och posterna har bestämda id, så
     * en dubbelkörning skriver samma dokument två gånger i stället för att
     * skapa dubbletter. Vore id:na autogenererade hade det behövts en
     * transaktion.
     *
     * @returns {Promise<{ seedade: boolean, antal: number, orsak?: string }>}
     */
    async seeda() {
      const rader = await source.list(collection);
      if (Array.isArray(rader) && rader.length > 0) {
        return { seedade: false, antal: rader.length, orsak: "samlingen har redan värden" };
      }
      if (reserv.length === 0) {
        return { seedade: false, antal: 0, orsak: "inga standardvärden att skriva" };
      }
      for (const kategori of reserv) {
        // `create` med id: datakällan väljer set i stället för add, så en
        // omkörning skriver samma dokument i stället för ett till.
        await source.create(collection, kategori);
      }
      return { seedade: true, antal: reserv.length };
    },

    /**
     * Standardvärdena, validerade.
     *
     * För seedningsskript och för den som vill visa vad en tom databas skulle
     * ha fyllts med.
     */
    standardvarden() {
      return reserv.map((k) => ({ ...k }));
    },
  };
}
