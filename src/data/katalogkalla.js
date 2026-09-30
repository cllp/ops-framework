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
 * ══ ⛔ GRUPPEN, OCH VARFÖR EN SAMLING KÄNNER FLERA (#162) ══════════════
 *
 * Väg C i cllp/ops-framework#160 (CP-beslut): katalogen ÄR gruppens data.
 * `collection` är fortfarande EN Firestore-samling delad av alla grupper som
 * använder appen, men varje rad bär sitt `groupId` (katalog.js, `grupp: true`),
 * och den här källan frågar och skriver ALLTID skopat på EN grupp, precis som
 * `gruppkalla.js`: `groupId` är ett krav i konfigurationen, inte en konvention.
 *
 * ⛔ EN KÄLLA ÄR ALLTSÅ EN GRUPPS VY AV SAMLINGEN, INTE HELA SAMLINGEN. Vill
 * appen visa två grupper bredvid varandra (#139) är svaret två anrop av
 * `createCatalogSource`, ett per grupp, inte ett gemensamt som frågar utan
 * villkor. Ett `where: { groupId }` här är den enda platsen KLIENTEN håller
 * isär grupperna; det RIKTIGA låset är regelfragmentet i `lib/regler.js`.
 *
 * ⛔ STANDARDVÄRDENA HAR INGET groupId, OCH SKA INTE HA DET. De är mallen som
 * skickas in av appen (samma `standard` som innan #162), och en mall har ingen
 * grupp förrän den seedas in i en. Därför valideras `standard` HÄR med
 * `grupp: false`, medan varje rad som faktiskt LÄSES eller SKRIVS mot samlingen
 * (`las`, `seeda`, `spara`) valideras med förvalet, alltså med den här källans
 * `groupId` som krav.
 *
 * ══ ⛔ TRE FRÅGOR SOM MÅSTE HA SITT SVAR I KODEN ══════════════════════
 *
 * 1. NÄR SEEDAS STANDARDVÄRDENA? Bara mot en TOM samling, FÖR DEN HÄR GRUPPEN.
 *    Aldrig ovanpå en ändring: annars kommer en kategori som arkiverats
 *    tillbaka vid nästa driftsättning, och det ser ut som ett spöke.
 *
 * 2. VAD HÄNDER NÄR DATABASEN INTE SVARAR? Standardvärdena används OCH det
 *    syns. Ett tyst fall tillbaka betyder att den som nyss arkiverade en
 *    kategori ser den kvar och tror att knappen inte fungerade. Svaret bär
 *    därför `kalla: "reserv"` och felet, så vyn kan skriva ut en banderoll.
 *    CLAUDE.md regel 1 och 5: en fallback som döljer en trasig konfiguration är
 *    samma sak som en tystad `try/catch`.
 *
 * 3. VEM FÅR SKRIVA? Ägaren och admin (0.33.0, samma rollmodell som gruppens
 *    utseende i 0.32.0). Den kontrollen bor i Firestore-reglerna
 *    (`katalogregelfragment`) och inte här, eftersom en kontroll i klienten
 *    bara är en artighet: den som vill skriva ändå öppnar konsolen.
 *
 * ══ ⛔ VAD DEN HÄR MODULEN INTE GÖR ═══════════════════════════════════
 *
 * Den prenumererar inte själv. `useLiveCollection` finns redan och gör det
 * bättre, och en andra prenumerationsmekanism hade varit två sanningar om när
 * data är färsk. Modulen är ren logik ovanpå datakontraktet, så den går att
 * prova utan en databas och att köra på nodsidan (cllp/bolag-ops#385).
 */

import { byggKategori, gruppensRader, katalognyckel, validateKatalog } from "../lib/katalog.js";

/**
 * @typedef {object} Katalogsvar
 * @property {import("../lib/katalog.js").Kategori[]} kategorier
 * @property {"databas" | "reserv"} kalla Var värdena kom ifrån.
 * @property {Error | null} fel Sant fel när `kalla` är "reserv", annars null.
 * @property {number} utanGrupp Rader utan `groupId` i det som lästes. Alltid med, också när det är 0:
 *   noll är beskedet att övergången är klar (se `gruppensRader`). Utan `overgang` gör en sådan rad
 *   läsningen till reserven, eftersom `groupId` är obligatoriskt.
 */

/**
 * @param {{ source: any, collection: string, groupId: string, overgang?: boolean, standard?: readonly unknown[], ikoner?: readonly string[], namn?: string, textnycklar?: readonly string[], faser?: boolean, farger?: boolean }} config
 */
export function createCatalogSource(config) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN, samma skäl som i `createGoogleAuth`:
   * med `({ x })` i signaturen kraschar ett anrop utan argument på destrukturen
   * med ett fel som nämner en variabel inne i ramverket, inte vad appen glömde.
   */
  const { source, collection, groupId: groupIdIn, overgang = false, standard = [], ikoner, namn = "katalog", textnycklar, faser, farger } = config ?? /** @type {any} */ ({});

  if (!source || typeof source.list !== "function" || typeof source.create !== "function") {
    throw new Error("createCatalogSource: source krävs och måste vara en datakälla ur createDataSource.");
  }
  if (typeof collection !== "string" || !collection.trim()) {
    throw new Error(
      "createCatalogSource: collection krävs. Ramverket känner aldrig samlingsnamnet självt, eftersom det är raden som gör en framtida kund till ett eget projekt utan att datamodellen ändras.",
    );
  }
  /*
   * ⛔ #162: KRÄVS, SAMMA MÖNSTER SOM `gruppkalla.js`. Katalogen är gruppens
   * egen (väg C, #160): en källa utan groupId hade fått frågan "läs hela
   * samlingen", alltså exakt den läckan som gör att miranda ab ser cps-ab:s
   * kategorier i sin rullgardin.
   *
   * ⛔ `groupId: null` FINNS INTE LÄNGRE (0.33.0). 0.29.0 lade till det som
   * "ogrupperad, hela samlingen", för att functions i bolag-ops skulle kunna
   * läsa rader utan grupp medan bakfyllnaden väntade. Det läget läste ALLAS
   * rader och skrev rader utan grupp, alltså precis det #162 finns för att
   * stoppa, och det hade inget slut inbyggt. Dess ersättare är `overgang: true`
   * TILLSAMMANS MED ett groupId: raderna utan grupp räknas som DEN HÄR gruppens
   * (appens påstående, inte ramverkets gissning), andra gruppers rader faller
   * bort, skrivningar vägras, och antalet rader utan grupp står i varje svar så
   * att det syns när övergången är klar.
   */
  const groupId = typeof groupIdIn === "string" ? groupIdIn.trim() : "";
  if (!groupId) {
    throw new Error(
      "createCatalogSource: groupId krävs. Katalogen är en grupps egen (#162): en källa utan grupp hade läst och skrivit mot HELA samlingen, alltså mot varje grupps kategorier på en gång. groupId: null (0.29.0) finns inte sedan 0.33.0. Har samlingen rader från före #162, skicka appens grupp plus overgang: true tills bakfyllnaden är körd.",
    );
  }

  /*
   * ⛔ STANDARDVÄRDENA VALIDERAS VID UPPSTART, INTE VID SEEDNING. Ett fel i
   * repots egna värden är ett programfel, och det ska synas när appen startar
   * och inte första gången någon råkar köra mot en tom databas. Det senare är
   * ett fel i produktion hos den första kunden.
   *
   * ⛔ MED `grupp: false`. Standardvärdena är MALLEN appen skickar in (samma
   * `standard` som innan #162), och en mall har ingen grupp förrän den seedas
   * in i en: se filhuvudet.
   */
  const reserv = validateKatalog(standard, { ikoner, textnycklar, faser, farger, katalog: `${namn} (standardvärden)`, grupp: false });

  /** Varje rad som faktiskt är en grupps: förvalet, alltså groupId obligatoriskt. */
  const gruppadKonfig = { ikoner, textnycklar, faser, farger, katalog: namn };
  /*
   * ⛔ FRÅGAN: gruppens rader, ELLER (övergången) hela samlingen. En rad utan
   * groupId går inte att fråga efter i Firestore (ett fält som saknas matchar
   * ingen `where`), så övergången måste läsa allt och sortera här, med
   * `gruppensRader`. Det är också därför övergången slutar fungera när
   * katalogreglerna är ute: de släpper inte igenom en fråga utan grupp. Se
   * ordningen i CHANGELOG 0.33.0.
   */
  const fraga = overgang ? {} : { where: { groupId } };

  /** @returns {Promise<{ kategorier: import("../lib/katalog.js").Kategori[], utanGrupp: number }>} */
  async function lasRader() {
    const rader = await source.list(collection, fraga);
    const { rader: egna, utanGrupp } = gruppensRader(rader, { groupId, overgang });
    return { kategorier: validateKatalog(egna, gruppadKonfig), utanGrupp };
  }

  return {
    /** Vad samlingen heter hos den här appen. För vyer som visar sin källa. */
    collection,

    /** Gruppen den här källan är en vy av. */
    groupId,

    /**
     * Läser katalogen.
     *
     * ⛔ KASTAR ALDRIG. Svarar med `{ kategorier, kalla, fel, utanGrupp }`, och
     * det är skillnaden mot att låta anroparen hantera det: en vy som får ett
     * kastat fel ritar antingen ingenting eller en tom lista, och en tom lista
     * är samma sak som "det finns inga kategorier". Här går det alltid att
     * skilja "läst ur databasen" från "det här är reserven, och här är varför".
     *
     * @returns {Promise<Katalogsvar>}
     */
    async las() {
      try {
        const { kategorier, utanGrupp } = await lasRader();
        // ⛔ En TOM samling är inte ett fel och inte heller reserven: det är
        // läget före seedningen, och `saknas` nedan är frågan man ställer då.
        return { kategorier, kalla: "databas", fel: null, utanGrupp };
      } catch (fel) {
        /*
         * ⛔ RESERVEN FÅR DEN HÄR KÄLLANS groupId, INTE `null`. En banderoll
         * som visar reservkategorier utan grupp hade sett ut som ett HÅL i
         * datan för den som just läser den, i stället för det den är: samma
         * mall som skulle seedats, ritad medan databasen inte svarar.
         */
        return { kategorier: reserv.map((k) => ({ ...k, groupId })), kalla: "reserv", fel: fel instanceof Error ? fel : new Error(String(fel)), utanGrupp: 0 };
      }
    },

    /**
     * Skriver standardvärdena, men bara i en tom samling, FÖR DEN HÄR GRUPPEN.
     *
     * ⛔ SVARAR MED VAD SOM HÄNDE OCH INTE MED INGENTING. `{ seedade, antal }`,
     * så den som kör det ser skillnaden mellan "skrev fem" och "gjorde inget
     * för att det redan fanns värden".
     *
     * ⛔ LÄSER FÖRST OCH SKRIVER SEDAN, VILKET INTE ÄR ATOMÄRT. Två samtidiga
     * seedningar kan båda se en tom samling. Det är ofarligt här: posterna har
     * bestämda nycklar, så en dubbelkörning skriver samma dokument två gånger i
     * stället för att skapa dubbletter. `skapaGrupp` seedar inte härigenom
     * utan i sin egen batch (0.33.0), där frågan inte uppstår.
     *
     * ⛔ TOMHETEN AVGÖRS AV GRUPPENS RADER, inte av samlingen. Utan det hade en
     * grupp som seedas EFTER en annan sett den andras rader och trott sig
     * redan ha värden, och stått kvar utan en enda kategori.
     *
     * @returns {Promise<{ seedade: boolean, antal: number, orsak?: string }>}
     */
    async seeda() {
      if (overgang) {
        return { seedade: false, antal: 0, orsak: "övergången pågår: bakfyllnaden (bakfyllKatalogGrupp) seedar, inte källan" };
      }
      const rader = await source.list(collection, fraga);
      const egna = gruppensRader(rader, { groupId }).rader;
      if (egna.length > 0) {
        return { seedade: false, antal: egna.length, orsak: "samlingen har redan värden för den här gruppen" };
      }
      if (reserv.length === 0) {
        return { seedade: false, antal: 0, orsak: "inga standardvärden att skriva" };
      }
      for (const op of seedoperationer({ collection, groupId, standard: reserv, ikoner, textnycklar, faser, farger, namn })) {
        await source.create(collection, op.data);
      }
      return { seedade: true, antal: reserv.length };
    },

    /**
     * Sparar en kategori i DEN HÄR gruppens katalog: ny, ändrad eller arkiverad.
     *
     * ⛔ DEN ENDA SKRIVVÄGEN, OCH DET ÄR POÄNGEN (0.33.0). Före 0.33.0 fanns
     * ingen, och appen skrev `source.create(samling, kategori)` själv, alltså
     * med kategorins `id` som dokumentnyckel. I en delad samling är det exakt
     * krocken `katalognyckel` finns för: två gruppers "uppgift" blir ett
     * dokument. Här byggs raden med källans `groupId` och skrivs med
     * `katalognyckel`, så inställningsvyn skriver i den aktiva gruppens katalog
     * och ingen annans.
     *
     * ⛔ ETT ANNAT groupId PÅ KATEGORIN ÄR ETT FEL, INTE NÅGOT SOM RÄTTAS TYST.
     * En kategori ur grupp A som sparas genom grupp B:s källa är ett programfel
     * (ett utkast som överlevde ett gruppbyte, se `OpsKatalogInstallning`), och
     * att skriva om gruppen hade flyttat kategorin utan att någon bett om det.
     *
     * ⛔ VÄGRAS UNDER ÖVERGÅNGEN. Då ligger raderna fortfarande utan grupp, och
     * en skrivning med `groupId` hade fått reglerna i en app som inte bytt dem
     * än att säga nej, eller skapat en andra rad bredvid den gamla.
     *
     * @param {Record<string, any>} kategori
     * @returns {Promise<import("../lib/katalog.js").Kategori>}
     */
    async spara(kategori) {
      if (overgang) {
        throw new Error(
          `${namn}: skrivningen är pausad medan katalogen flyttas in i gruppen (overgang: true). Kör bakfyllnaden, byt regler och ta bort overgang, se CHANGELOG 0.33.0.`,
        );
      }
      const angiven = kategori && typeof kategori === "object" ? rensaGrupp(kategori.groupId) : "";
      if (angiven && angiven !== groupId) {
        throw new Error(`${namn}: kategorin "${kategori.id}" hör till gruppen "${angiven}" och sparas inte i "${groupId}". En kategori flyttas inte mellan grupper.`);
      }
      const byggd = byggKategori({ ...kategori, groupId }, gruppadKonfig);
      await source.create(collection, { ...byggd, id: katalognyckel(groupId, byggd.id) });
      return byggd;
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

/** @param {unknown} v @returns {string} */
const rensaGrupp = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Skrivningarna som seedar en grupps katalog ur standardvärdena, som batchoperationer.
 *
 * ⛔ EN FUNKTION FÖR TRE ANROPARE: `seeda()` ovan, `skapaGrupp` (som lägger dem
 * i SAMMA batch som gruppen, 0.33.0) och bakfyllnaden (som seedar grupper som
 * saknar kataloger). Tre egna byggen av samma rad hade kunnat bli tre olika rader.
 *
 * ⛔ VARJE RAD BYGGS PÅ NYTT MED groupId, INTE SOM ETT RÅTT `{ ...mall, groupId }`.
 * Mallen validerades med `grupp: false` (den hade inget groupId att pröva), så
 * den skrivna raden går genom samma validering som allt annat i samlingen.
 *
 * @param {{ collection: string, groupId: string, standard: readonly unknown[], ikoner?: readonly string[], textnycklar?: readonly string[], faser?: boolean, farger?: boolean, namn?: string }} b
 * @returns {{ op: "create", collection: string, data: Record<string, any> }[]}
 */
export function seedoperationer({ collection, groupId, standard, ikoner, textnycklar, faser, farger, namn = collection }) {
  const mallar = validateKatalog(standard, { ikoner, textnycklar, faser, farger, katalog: `${namn} (standardvärden)`, grupp: false });
  return mallar.map((mall) => {
    const kategori = byggKategori({ ...mall, groupId }, { ikoner, textnycklar, faser, farger, katalog: namn });
    return { op: /** @type {const} */ ("create"), collection, data: { ...kategori, id: katalognyckel(groupId, kategori.id) } };
  });
}
