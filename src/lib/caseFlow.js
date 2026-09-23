/**
 * Läsning av en ärende-ögonblicksbild.
 *
 * ══ ⛔ VARFÖR EN EGEN FUNKTION FÖR ETT `Array.isArray` ═══════════════════
 *
 * Den vanliga formen är en rad i en vy:
 *
 *   const poster = (flode && Array.isArray(flode.items) && flode.items) || [];
 *
 * Den raden är fel, och den är fel på ett sätt som inte syns. Ett trasigt eller
 * halvskrivet flöde blir en TOM LISTA, och en tom lista är ett giltigt svar: det
 * betyder "du har inga uppgifter". Vyn visar alltså "allt klart" när sanningen är
 * "det gick inte att läsa".
 *
 * ⛔ TRE UTFALL OCH INTE TVÅ, det är hela poängen:
 *
 *   inget flöde ännu      inte ett fel. Källan har inte svarat. Vyn visar sitt
 *                         laddningsläge, som den redan gör.
 *   flöde med noll poster ett giltigt svar. "Inga öppna ärenden" är sant.
 *   oläsligt flöde        ett fel med en orsak. Vyn måste kunna säga att den inte
 *                         vet, i stället för att påstå att det är tomt.
 *
 * Skillnaden mellan de två sista går inte att uttrycka med en tom lista, och det
 * är därför den här funktionen finns i stället för ett villkor per anropsställe.
 */

/*
 * ══ ⛔ DATAKONTRAKTET BOR HÄR, HOS LÄSAREN, OCH INTE HOS SPEGELN ══════════
 *
 * Första utkastet hade `Post` och `Flode` definierade i `src/node/caseMirror.js`
 * och importerade hit. `check-nodsida` blev röd, och den hade rätt av ett skäl jag
 * inte tänkt på:
 *
 * ⛔ EN TYPBEROENDE ÄR OCKSÅ ETT BEROENDE. En JSDoc-import når aldrig bundlen, så
 * det var inget säkerhetsläckage. Men den säger "det här modulens kontrakt är
 * definierat där borta", och nästa person följer typen till sitt hem och lägger
 * körkod intill den. Då är läckaget verkligt.
 *
 * Riktningen ska vara den här: kontraktet är webbsidans, eftersom det är appen som
 * LÄSER flödet. Nodsidan skriver in i kontraktet och importerar det härifrån.
 */

/**
 * En post i flödet.
 *
 * ⛔ FÄLTNAMNEN ÄR ENGELSKA OCH DET ÄR INTE ETT SLARV. Ramverkets egna namn är
 * svenska (`readCaseFlow`, `skapaArendespegel`). Men flödets FÄLT är ett
 * datakontrakt som redan ligger i en databas och i en incheckad fil hos den app
 * som ska adoptera modulen. Att döpa om dem vore en datamigrering.
 *
 * Alltså: API:et är ramverkets och får ramverkets språk, datan är appens och har
 * redan sitt.
 *
 * @typedef {object} Post
 * @property {number} number
 * @property {string} title
 * @property {string} state
 * @property {string[]} labels
 * @property {string | null} updatedAt
 * @property {string} url
 * @property {string} summary
 */

/**
 * @typedef {object} Flode
 * @property {string} updated Datum, `YYYY-MM-DD`.
 * @property {string} source Länk en människa kan öppna för att se samma urval.
 * @property {string} label
 * @property {Post[]} items
 */

/**
 * @typedef {object} Last
 * @property {Post[]} entries Alltid en lista, även vid fel. En vy ska inte behöva kolla.
 * @property {boolean} existed Sant när något gick att tolka som ett flöde.
 * @property {string | null} error Orsaken, i klartext, när det inte gick.
 * @property {string | null} updatedAt Flödets egen datumstämpel, när den finns.
 */

/**
 * Läser ett flöde och säger vilket av de tre utfallen det blev.
 *
 * ⛔ TAR ETT OBJEKT ELLER EN JSON-STRÄNG, inget mer. Att också packa upp en
 * lagringsspecifik omslagsform (till exempel ett dokument med ett `json`-fält)
 * hade gjort funktionen till något som gissar vad anroparen menade. Appen vet hur
 * dess lagring ser ut och packar upp själv.
 *
 * @param {unknown} raw
 * @returns {Last}
 */
export function readCaseFlow(raw) {
  const empty = { entries: /** @type {Post[]} */ ([]), existed: false, error: null, updatedAt: null };

  // ⛔ Frånvaro är INTE ett fel. `null` betyder oftast "har inte hämtats än", och
  // ett felmeddelande under laddning är ett fel användaren inte kan göra något åt.
  if (raw === null || raw === undefined || raw === "") return empty;

  let flow = raw;
  if (typeof raw === "string") {
    try {
      flow = JSON.parse(raw);
    } catch (e) {
      return { ...empty, error: `Flödet är inte giltig JSON: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  if (typeof flow !== "object" || flow === null || Array.isArray(flow)) {
    return { ...empty, error: "Flödet är inte ett objekt." };
  }

  const body = /** @type {Record<string, unknown>} */ (flow);

  // ⛔ DET HÄR ÄR RADEN SOM VAR TYST. Saknas `items`, eller är det något annat än
  // en lista, är flödet trasigt. Utan den här grenen blev svaret en tom lista,
  // alltså "inga uppgifter", vilket är ett påstående om verksamheten när
  // sanningen är ett påstående om datan.
  if (!Array.isArray(body.items)) {
    return {
      ...empty,
      error: `Flödet saknar en lista i "items" (fick ${body.items === undefined ? "inget fält" : typeof body.items}).`,
      updatedAt: typeof body.updated === "string" ? body.updated : null,
    };
  }

  return {
    entries: /** @type {Post[]} */ (body.items),
    existed: true,
    error: null,
    updatedAt: typeof body.updated === "string" ? body.updated : null,
  };
}
