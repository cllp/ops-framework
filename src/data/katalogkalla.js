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
 * grupp förrän den seedas in i en. Därför valideras `standard` HÄR utan
 * `grupp: true`, medan varje rad som faktiskt LÄSES eller SKRIVS mot samlingen
 * (`las`, `seeda`) valideras MED det, med den här källans `groupId` inbakat.
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

import { byggKategori, validateKatalog } from "../lib/katalog.js";

/**
 * ══ ⛔ DOKUMENTETS NYCKEL I DEN DELADE SAMLINGEN, OCH VARFÖR DEN INTE ÄR
 * KATEGORINS EGNA `id` (#162, mutationsfynd) ═══════════════════════════
 *
 * Kategorins `id` är en liten, läsbar maskinnyckel ("uppgift"), och
 * `katalog.js` är tydlig med att den bara är unik INOM en grupps egen katalog.
 * Samlingen den lagras i är sedan #162 DELAD av alla grupper. Skrivs dokumentet
 * med bara `id` som Firestore-nyckel pekar miranda ab:s "uppgift" och cps
 * ab:s "uppgift" på SAMMA dokument, och den som seedar eller sparar sist
 * skriver över den andra.
 *
 * ⛔ DET HÄNDE, I DET FÖRSTA PROVET SOM SEEDADE TVÅ GRUPPER MOT SAMMA
 * minneskälla: fyra kategorier seedade, två kvar. Beviset står i
 * `src/__tests__/katalogkalla.test.js`.
 *
 * Lösningen är samma som `medlemskapsId` i `lib/grupp.js` (#152): en HÄRLEDD,
 * sammansatt nyckel för LAGRINGEN, `groupId` plus avgränsare plus kategorins
 * `id`. Den logiska `id` som varje vy, varje jämförelse och varje annan rads
 * `kategori: "uppgift"`-referens använder förblir den enkla, korta strängen:
 * `las()` packar upp den sammansatta nyckeln innan raden lämnar den här filen,
 * så resten av ramverket och appen aldrig ser den.
 *
 * `|` av samma skäl som i `medlemskapsId`: olagligt i ett `id` (`ID_FORM`),
 * giltigt i ett Firestore-dokument-id.
 *
 * ⛔ SKRIVER APPEN EGNA RADER TILL SAMMA SAMLING (t.ex. `OpsKatalogInstallning`s
 * `onSpara`, som ramverket inte skriver åt appen), måste den härleda SAMMA
 * nyckel, annars kolliderar en ny kategori appen sparar med en annan grupps
 * på precis samma sätt. Håll den logiken här, och håll den EN gång: appen
 * ska ANROPA den här filens skrivväg, aldrig bygga en egen `doc(...)`-nyckel
 * för samlingen.
 */
const RADAVGRANSARE = "|";

/** @param {string} groupId @param {string} id @returns {string} */
function lagradId(groupId, id) {
  return `${groupId}${RADAVGRANSARE}${id}`;
}

/**
 * Motsatsen till `lagradId`. Kastar aldrig: en lagrad nyckel som inte bär
 * DEN HÄR källans prefix (en rad skriven innan #162, eller ett provfixtur som
 * satte `id` för hand) lämnas orörd. `validateKatalog` fångar en trasig `id`
 * med ett bättre meddelande än ett kast här skulle ge.
 *
 * @param {string} groupId @param {unknown} lagrad @returns {string}
 */
function egetId(groupId, lagrad) {
  const rad = typeof lagrad === "string" ? lagrad : "";
  const prefix = `${groupId}${RADAVGRANSARE}`;
  return rad.startsWith(prefix) ? rad.slice(prefix.length) : rad;
}

/**
 * @typedef {object} Katalogsvar
 * @property {import("../lib/katalog.js").Kategori[]} kategorier
 * @property {"databas" | "reserv"} kalla Var värdena kom ifrån.
 * @property {Error | null} fel Sant fel när `kalla` är "reserv", annars null.
 */

/**
 * @param {{ source: any, collection: string, groupId: string | null, standard?: readonly unknown[], ikoner?: readonly string[], namn?: string, textnycklar?: readonly string[], faser?: boolean, farger?: boolean }} config
 */
export function createCatalogSource(config) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN, samma skäl som i `createGoogleAuth`:
   * med `({ x })` i signaturen kraschar ett anrop utan argument på destrukturen
   * med ett fel som nämner en variabel inne i ramverket, inte vad appen glömde.
   */
  const { source, collection, groupId: groupIdIn, standard = [], ikoner, namn = "katalog", textnycklar, faser, farger } = config ?? /** @type {any} */ ({});

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
   */
  /*
   * ⛔ `groupId: null` ÄR ETT UTTRYCKLIGT VAL, `undefined` ÄR ETT FEL (0.29.0,
   * mätt i bolag-ops ompinning). #162 gjorde groupId obligatoriskt, och
   * functions i bolag-ops (`lasKatalogen`, som läser hela samlingen eftersom
   * appen ännu inte har gruppmodellen på serversidan, cllp/bolag-ops#447)
   * föll med 11 av 101 prov. Appen kunde då varken pinna om functions eller
   * göra det bakfyllnadssteg #447 börjar med, "bakfyll groupId med reglerna
   * oförändrade", eftersom det steget kräver en källa som läser raderna utan
   * grupp. Ett bortglömt groupId ska fortfarande vara rött: därför är det bara
   * det bokstavliga `null` som betyder "ogrupperad, hela samlingen, som före
   * #162", inte ett utelämnat fält. Ogrupperat läge läser utan `where`, lämnar
   * id:n orörda och skriver rader utan groupId. Det är övergångsläget, inte
   * målet: en grupp per rad är fortfarande det ramverket bygger för.
   */
  const ogrupperad = groupIdIn === null;
  const groupId = typeof groupIdIn === "string" ? groupIdIn.trim() : "";
  if (!ogrupperad && !groupId) {
    throw new Error(
      "createCatalogSource: groupId krävs. Katalogen är en grupps egen (#162): en källa utan grupp hade läst och skrivit mot HELA samlingen, alltså mot varje grupps kategorier på en gång. Är samlingen ännu inte grupperad (bakfyllnad pågår, cllp/bolag-ops#447): skicka groupId: null uttryckligen.",
    );
  }

  /*
   * ⛔ STANDARDVÄRDENA VALIDERAS VID UPPSTART, INTE VID SEEDNING. Ett fel i
   * repots egna värden är ett programfel, och det ska synas när appen startar
   * och inte första gången någon råkar köra mot en tom databas. Det senare är
   * ett fel i produktion hos den första kunden.
   *
   * ⛔ UTAN `grupp: true`. Standardvärdena är MALLEN appen skickar in (samma
   * `standard` som innan #162), och en mall har ingen grupp förrän den seedas
   * in i en: se filhuvudet.
   */
  const reserv = validateKatalog(standard, { ikoner, textnycklar, faser, farger, katalog: `${namn} (standardvärden)` });

  /*
   * ⛔ OCH VARJE RAD SOM FAKTISKT ÄR EN GRUPPS, MED `grupp: true`. En helt
   * egen konfigurationsvariabel, inte reserv-varianten ovan pluss ett fält på
   * anropet: `las()` och `seeda()` skriver eller läser mot DEN HÄR källans
   * `groupId`, aldrig ett annat.
   */
  const gruppadKonfig = ogrupperad
    ? { ikoner, textnycklar, faser, farger, katalog: namn }
    : { ikoner, textnycklar, faser, farger, katalog: namn, grupp: /** @type {const} */ (true) };
  /** Frågan mot samlingen: gruppens rader, eller (ogrupperat) alla. */
  const fraga = ogrupperad ? {} : { where: { groupId } };

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
     * ⛔ `where: { groupId }`, SAMMA MÖNSTER SOM `gruppLista` I `gruppkalla.js`.
     * En fråga utan villkoret hade läst hela samlingen, alltså varenda grupps
     * kategorier i en enda lista.
     *
     * @returns {Promise<Katalogsvar>}
     */
    async las() {
      try {
        const rader = await source.list(collection, fraga);
        /*
         * ⛔ PACKAS UPP HÄR, INNAN VALIDERINGEN. Den lagrade nyckeln
         * (`lagradId`) är `groupId|id`, och `ID_FORM` (alltså `byggKategori`)
         * skulle kasta på pipe-tecknet. Se filhuvudets not om varför nyckeln
         * ens finns.
         */
        const uppackade = (Array.isArray(rader) ? rader : [])
          /*
           * ⛔ OGRUPPERAT: RADER MED EN GRUPPS NYCKEL (`groupId|id`) HOPPAS
           * ÖVER. De är en grupps egna (skrivna av en gruppad källa) och hör
           * inte till den ogrupperade läsningen; att ta med dem hade fällt
           * hela läsningen till reserven på pipe-tecknet i id:t. Kvar är
           * raderna från före #162, alltså precis de bakfyllnaden ska nå.
           */
          .filter((rad) => !ogrupperad || !(rad && typeof rad === "object" && String(/** @type {any} */ (rad).id ?? "").includes(RADAVGRANSARE)))
          .map((rad) => (rad && typeof rad === "object" && !ogrupperad ? { ...rad, id: egetId(groupId, /** @type {any} */ (rad).id) } : rad));
        const kategorier = validateKatalog(uppackade, gruppadKonfig);
        // ⛔ En TOM samling är inte ett fel och inte heller reserven: det är
        // läget före seedningen, och `saknas` nedan är frågan man ställer då.
        return { kategorier, kalla: "databas", fel: null };
      } catch (fel) {
        /*
         * ⛔ RESERVEN FÅR DEN HÄR KÄLLANS groupId, INTE `null`. En banderoll
         * som visar reservkategorier utan grupp hade sett ut som ett HÅL i
         * datan för den som just läser den, i stället för det den är: samma
         * mall som skulle seedats, ritad medan databasen inte svarar.
         */
        return { kategorier: ogrupperad ? reserv : reserv.map((k) => ({ ...k, groupId })), kalla: "reserv", fel: fel instanceof Error ? fel : new Error(String(fel)) };
      }
    },

    /**
     * Skriver standardvärdena, men bara i en tom samling, FÖR DEN HÄR GRUPPEN.
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
     * ⛔ TOMHETEN KONTROLLERAS OCKSÅ MED `where: { groupId }`. Utan det hade en
     * grupp som seedas EFTER en annan sett den andras rader och trott sig
     * redan ha värden, och stått kvar utan en enda kategori.
     *
     * @returns {Promise<{ seedade: boolean, antal: number, orsak?: string }>}
     */
    async seeda() {
      const rader = await source.list(collection, fraga);
      if (Array.isArray(rader) && rader.length > 0) {
        return { seedade: false, antal: rader.length, orsak: "samlingen har redan värden för den här gruppen" };
      }
      if (reserv.length === 0) {
        return { seedade: false, antal: 0, orsak: "inga standardvärden att skriva" };
      }
      for (const mall of reserv) {
        /*
         * ⛔ BYGGD PÅ NYTT MED groupId, INTE ETT RÅTT `{ ...mall, groupId }`.
         * Mallen validerades utan `grupp: true` ovan (den hade inget groupId
         * att pröva formen på), så den skrivna raden ska gå genom samma
         * validering som allt annat som hamnar i samlingen: samma skäl som att
         * `uppdateraProfil` bygger via `byggAnvandare` i stället för att peta
         * fält direkt i ett patch-objekt.
         */
        const kategori = ogrupperad ? byggKategori(mall, gruppadKonfig) : byggKategori({ ...mall, groupId }, gruppadKonfig);
        /*
         * ⛔ SKRIVEN MED `lagradId`, INTE MED `kategori.id`. Samlingen är delad
         * (#162): utan den sammansatta nyckeln skriver en andra grupps
         * seedning över den här gruppens rad med samma maskinnyckel. `create`
         * med id väljer set i stället för add, så en omkörning FÖR SAMMA GRUPP
         * skriver samma dokument i stället för ett till, precis som innan.
         */
        await source.create(collection, ogrupperad ? kategori : { ...kategori, id: lagradId(groupId, kategori.id) });
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
