/**
 * Aktivitetsloggen: vad som kördes, när, och vad det ändrade.
 *
 * ══ ⛔ VARFÖR DEN BOR I RAMVERKET ═══════════════════════════════════════
 *
 * CP (bolag-ops): "Notiser skall byggas in i ramverket. Och en tydlig väg in för
 * att skriva dom. Sedan vad som skrivs och när är appen."
 *
 * Det är samma delning som resten av huset. Ramverket äger MEKANIKEN: postens
 * form, vad som krävs, hur den valideras och hur den ritas. Appen äger VÄRDENA:
 * vilka slags händelser som finns, vad de heter, och vilket jobb som skriver
 * dem. Ramverket vet inte vad en bankintegration är, och ska inte veta det.
 *
 * ══ ⛔ EN LOGG SOM KAN SÄNKA JOBBET DEN LOGGAR ÄR VÄRRE ÄN INGEN LOGG ════
 *
 * Det är den enskilt viktigaste regeln här, och den syns i `src/node/`: en
 * skrivning som misslyckas får aldrig få importen, synken eller utlösaren att
 * falla. En misslyckad anteckning om ett lyckat arbete ska kosta en rad i
 * loggen, inte arbetet.
 *
 * ⛔ DÄRFÖR ÄR DEN HÄR FILEN REN. Den bygger och kontrollerar dokument, den rör
 * aldrig ett nätverk och den kastar bara på det som är ett PROGRAMFEL hos den
 * som anropar, inte på något som kan hända i drift.
 *
 * ══ ⛔ FORMEN ÄR WEBBSIDANS, ÄVEN OM SKRIVAREN ÄR ETT SKRIPT ════════════
 *
 * Samma riktning som `caseFlow` och `caseMirror` redan drar: kontraktet ligger
 * här, eftersom det är APPEN som läser flödet. Nodsidan skriver in i kontraktet
 * och definierar det inte. Skrevs formen där hade en typberoende pekat åt fel
 * håll, och nästa person hade lagt körkod intill den.
 */

/**
 * @typedef {object} Handelse En rad i loggen.
 * @property {string} nar När det hände, ISO. ⛔ Sätts av SKRIVAREN och aldrig av
 *   läsaren: en tid som sätts när listan ritas är tiden någon tittade.
 * @property {string} slag Appens värde, ur `kinds`.
 * @property {string} rubrik Vad som hände, på appens språk. En mening, inte ett id.
 * @property {string} [detalj] Vad det ändrade. "42 poster, 3 utan motpart".
 * @property {"ok"|"fel"} resultat Om jobbet gick igenom.
 * @property {string} [fel] Skälet, när `resultat` är "fel".
 * @property {string} [kalla] Vilket jobb som skrev raden, t.ex. ett skriptnamn.
 */

/**
 * @typedef {object} Slag
 * @property {string} value Nyckeln i datan.
 * @property {string} label Ordet en människa läser.
 */

/** Utfallen. Två, och inte fler. Se noten vid `buildEntry`. */
export const ACTIVITY_RESULTS = ["ok", "fel"];

/** Tak för rubriken. En rad i en lista som inte ryms är ingen rad. */
const MAX_RUBRIK = 120;

/**
 * Bygger loggen ur appens konfiguration.
 *
 * ⛔ KONTROLLERAR KONFIGURATIONEN VID UPPSTART, precis som `createCaseModel`.
 * Byggs modellen på modulnivå blir ett slag utan ord ett fel när appen laddas,
 * i stället för en tom rad i en lista någon läser en vecka senare.
 *
 * @param {{ kinds: Slag[] }} config
 */
export function createActivityLog(config) {
  if (!config || !Array.isArray(config.kinds) || config.kinds.length === 0) {
    throw new Error(
      "createActivityLog: minst ett slag krävs. Slagen är appens taxonomi, inte ramverkets: ramverket vet inte vilka jobb en plattform kör.",
    );
  }

  for (const row of config.kinds) {
    for (const falt of ["value", "label"]) {
      if (!row || !(/** @type {Record<string, any>} */ (row))[falt]) {
        throw new Error(`createActivityLog: kinds saknar "${falt}" på ${JSON.stringify(row)}.`);
      }
    }
  }

  const varden = config.kinds.map((k) => k.value);
  const dubbletter = varden.filter((v, i) => varden.indexOf(v) !== i);
  if (dubbletter.length > 0) {
    // ⛔ Två slag med samma värde är ett slag som ibland heter fel. Vilket av
    // dem `find` hittar beror på ordningen, alltså på en slump.
    throw new Error(`createActivityLog: slaget "${dubbletter[0]}" står två gånger.`);
  }

  /** @param {string | undefined} v */
  const slaget = (v) => config.kinds.find((k) => k.value === v);

  return {
    kinds: config.kinds,

    /**
     * Slagets ord. Tom sträng när det är okänt, aldrig en gissning.
     * @param {string} [value]
     */
    kindLabel(value) {
      return (slaget(value) || {}).label || "";
    },

    /**
     * Vad som saknas för att raden ska gå att skriva. Skälen, aldrig ett ja
     * eller nej.
     *
     * ⛔ SAMMA FORM SOM `createCaseModel.missing`. Den som ska visa varför något
     * inte gick behöver meningarna, och en boolean tvingar varje anropsställe
     * att hitta på dem själv.
     *
     * @param {Partial<Handelse>} draft
     * @returns {string[]}
     */
    missing(draft) {
      const skal = [];
      const d = draft || {};
      if (!d.slag) skal.push("Slaget saknas.");
      else if (!slaget(d.slag)) skal.push(`Slaget "${d.slag}" finns inte i konfigurationen.`);
      if (!String(d.rubrik || "").trim()) skal.push("Rubriken saknas. En rad utan mening säger bara att något hände.");
      else if (String(d.rubrik).trim().length > MAX_RUBRIK) {
        skal.push(`Rubriken är ${String(d.rubrik).trim().length} tecken. Taket är ${MAX_RUBRIK}.`);
      }
      if (d.resultat && !ACTIVITY_RESULTS.includes(d.resultat)) {
        skal.push(`Utfallet "${d.resultat}" finns inte. Giltiga: ${ACTIVITY_RESULTS.join(", ")}.`);
      }
      return skal;
    },

    /**
     * Bygger dokumentet som skrivs. Ren funktion, så formen går att prova utan
     * databas.
     *
     * ⛔ KASTAR PÅ ETT TRASIGT UTKAST, till skillnad från `missing` som svarar
     * med skäl. Skillnaden är vem som anropar: `missing` finns för en yta som
     * kan VISA skälen, `buildEntry` anropas oftast av ett skript som inte har
     * någon att visa dem för. Ett skript som skriver en trasig rad ska få veta
     * det där det händer, inte lämna en rad som ritas tom.
     *
     * ⛔ `resultat` STANDARDAR TILL "ok", OCH DET ÄR MEDVETET ÅT DET HÅLLET.
     * Den som loggar ett misslyckande vet om det och skriver det; den som loggar
     * ett lyckat jobb ska inte behöva säga det två gånger. Motsatt förval hade
     * gjort varje glömd flagga till ett falskt larm.
     *
     * ⛔ TVÅ UTFALL OCH INTE TRE. En "varning" däremellan låter användbar och är
     * en glidning: allt som inte är rent blir en varning, och då betyder varken
     * varningen eller felet något. Gick jobbet igenom eller inte.
     *
     * @param {Partial<Handelse>} draft
     * @param {{ nu?: () => string }} [context]
     * @returns {Handelse}
     */
    buildEntry(draft, { nu = () => new Date().toISOString() } = {}) {
      const skal = this.missing(draft);
      if (skal.length > 0) {
        throw new Error(`createActivityLog.buildEntry: ${skal.join(" ")}`);
      }

      const d = /** @type {Handelse} */ (draft);
      const resultat = d.resultat || "ok";

      /** @type {Handelse} */
      const rad = {
        nar: d.nar || nu(),
        slag: d.slag,
        rubrik: String(d.rubrik).trim(),
        resultat,
      };

      // ⛔ FRIVILLIGA FÄLT SKRIVS BARA NÄR DE FINNS, aldrig som `null`. Ett tomt
      // fält i listan ser ut som en uppgift som saknas just för den raden, när
      // sanningen är att raden aldrig hade någon.
      if (String(d.detalj || "").trim()) rad.detalj = String(d.detalj).trim();
      if (String(d.kalla || "").trim()) rad.kalla = String(d.kalla).trim();

      // ⛔ `fel` HÖR IHOP MED `resultat: "fel"`, åt båda hållen. En rad som säger
      // ok och bär ett fel är två påståenden som inte kan vara sanna samtidigt,
      // och en rad som säger fel utan skäl går inte att åtgärda.
      if (resultat === "fel") {
        const text = String(d.fel || "").trim();
        if (!text) {
          throw new Error(
            'createActivityLog.buildEntry: resultat "fel" kräver `fel`. En rad som säger att något gick sönder utan att säga vad går inte att åtgärda.',
          );
        }
        rad.fel = text;
      }

      return rad;
    },
  };
}

/**
 * Hur många rader som är nyare än den tidpunkt läsaren senast såg.
 *
 * ⛔ EN REN FUNKTION OCH INTE ETT FÄLT PÅ RADEN. "Oläst" är en egenskap hos
 * LÄSAREN och inte hos händelsen: två personer som öppnar samma logg har olika
 * svar. Skrevs det som `last: false` på dokumentet vore det en delad sanning om
 * något som är privat, och den som läser sist skriver över den andres.
 *
 * ⛔ JÄMFÖR PÅ `nar` OCH INTE PÅ ANTAL. Ett antal glider så fort en gammal rad
 * städas bort: listan blir kortare och plötsligt är allt läst.
 *
 * @param {Handelse[]} rader @param {string | null | undefined} sedd ISO, eller inget alls.
 */
export function unreadCount(rader, sedd) {
  const lista = rader || [];
  if (!sedd) return lista.length;
  return lista.filter((r) => String(r.nar || "") > sedd).length;
}
