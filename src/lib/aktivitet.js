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
  return (rader || []).filter((r) => isUnread(r, sedd)).length;
}

/**
 * Radens identitet.
 *
 * ⛔ `id` NÄR DET FINNS, ANNARS TIDPUNKTEN. Läsmärket och detaljvyn behöver
 * kunna peka ut EN rad, och en logg som hämtas ur en databas har alltid ett id.
 * En rad byggd i minnet har inte det, och då är tidpunkten det närmaste unika
 * som finns. Faller båda bort får raden ingen identitet alls, och det syns som
 * att den inte går att markera: bättre än att två rader delar märke.
 *
 * @param {Handelse & { id?: string }} rad
 * @returns {string}
 */
export function activityId(rad) {
  const r = rad || {};
  return String(r.id || r.nar || "");
}

/**
 * Om EN rad är nyare än den tidpunkt läsaren senast såg.
 *
 * ⛔ SAMMA JÄMFÖRELSE SOM `unreadCount`, OCH DÄRFÖR EXPORTERAD. Märket på
 * knappen och märket på raden måste svara samma sak: säger knappen tre och tre
 * rader inte är märkta blir siffran något man slutar tro på. Skrevs
 * jämförelsen två gånger hade de glidit isär vid första ändringen.
 *
 * @param {Handelse} rad @param {string | null | undefined} sedd ISO, eller inget alls.
 */
export function isUnread(rad, sedd) {
  if (!sedd) return true;
  return String((rad && rad.nar) || "") > sedd;
}

/**
 * Avsnitten listan delas i, nyast först.
 *
 * ⛔ RAMVERKETS ORD OCH INTE APPENS, till skillnad från `kinds`. Vilka JOBB som
 * finns är appens taxonomi; att i går heter "I går" är det inte. Lades de i
 * appen fick varje plattform hitta på sina egna, och två loggar som visar samma
 * sak hade läst olika.
 */
export const ACTIVITY_SECTIONS = [
  { value: "idag", label: "Idag" },
  { value: "igar", label: "I går" },
  { value: "veckan", label: "Senaste veckan" },
  { value: "aldre", label: "Äldre" },
];

const DAG = 86400000;

/** @param {Date} d */
function midnatt(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Delar raderna i Idag, I går, Senaste veckan och Äldre.
 *
 * ⛔ VARFÖR EN PLATT LISTA INTE RÄCKER. Ett jobb som kör varje natt skriver en
 * rad om dagen, så efter en månad är listan trettio rader som alla ser likadana
 * ut. Frågan man ställer är nästan aldrig "vad är rad sjutton", den är "kördes
 * det i dag", och det svaret ska synas utan att läsa en enda tidsstämpel.
 *
 * ⛔ KALENDERDAGAR, INTE DYGN OM 24 TIMMAR. Samma räkning som
 * `formatRelativeDate` gör. Något som kördes 23:50 i går ligger under "I går"
 * klockan 00:10, inte under "Idag", eftersom det är vad läsaren själv kallar
 * det. Räknades det i timmar hade avsnittet och radens egen text sagt emot
 * varandra, och då tror man på ingendera.
 *
 * ⛔ EN RAD MED TRASIG TID FALLER TILL "ÄLDRE" OCH KASTAS ALDRIG. Att sortera
 * bort det man inte förstår är hur en logg tyst blir ofullständig: den som
 * letar efter raden ser en lista utan den och drar slutsatsen att jobbet aldrig
 * kördes.
 *
 * ⛔ EN RAD FRÅN FRAMTIDEN LIGGER UNDER "IDAG". Den betyder att en klocka går
 * fel, och det är värt att se. Under "Äldre" hade den hamnat längst ned i en
 * lista ingen rullar till.
 *
 * ⛔ TOMMA AVSNITT UTELÄMNAS. En rubrik utan rader påstår att något saknas just
 * där, när sanningen är att ingenting hände den dagen.
 *
 * @param {Handelse[]} rader Nyast först. Ordningen inom avsnittet är den som kom in.
 * @param {{ nu?: Date | number | string }} [choice] Bara för prov. Produktionen har en klocka.
 * @returns {{ value: string, label: string, rader: Handelse[] }[]}
 */
export function groupByDay(rader, choice = {}) {
  const lista = rader || [];
  const nu = new Date(choice.nu ?? Date.now());
  const idag = midnatt(Number.isNaN(nu.getTime()) ? new Date() : nu);

  /** @type {Record<string, Handelse[]>} */
  const hinkar = { idag: [], igar: [], veckan: [], aldre: [] };

  for (const rad of lista) {
    const d = new Date(rad && rad.nar ? rad.nar : NaN);
    if (Number.isNaN(d.getTime())) {
      hinkar.aldre.push(rad);
      continue;
    }
    const dagar = Math.round((idag - midnatt(d)) / DAG);
    if (dagar <= 0) hinkar.idag.push(rad);
    else if (dagar === 1) hinkar.igar.push(rad);
    else if (dagar < 7) hinkar.veckan.push(rad);
    else hinkar.aldre.push(rad);
  }

  return ACTIVITY_SECTIONS.map((a) => ({
    value: a.value,
    label: a.label,
    rader: hinkar[a.value],
  })).filter((a) => a.rader.length > 0);
}

/**
 * Om raden räknas som oläst, med hänsyn till BÅDE tidpunkten och de rader
 * läsaren öppnat en och en.
 *
 * ⛔ TVÅ KÄLLOR, OCH DET ÄR INTE EN KOMPLIKATION UTAN TVÅ OLIKA HANDLINGAR.
 * "Jag har sett listan" är en tidpunkt; "jag har läst DEN HÄR raden" är ett id.
 * Slås de ihop till en tidpunkt kan man inte läsa en gammal rad utan att också
 * påstå sig ha läst allt nyare än den.
 *
 * @param {Handelse & { id?: string }} rad
 * @param {{ sedd?: string | null, lasta?: Iterable<string> | null }} [lasning]
 */
export function unread(rad, lasning = {}) {
  const lasta = lasning.lasta ? new Set(lasning.lasta) : null;
  if (lasta && lasta.has(activityId(rad))) return false;
  return isUnread(rad, lasning.sedd);
}

/**
 * Raderna läsaren inte tagit del av.
 *
 * @param {(Handelse & { id?: string })[]} rader
 * @param {{ sedd?: string | null, lasta?: Iterable<string> | null }} [lasning]
 */
export function unreadRows(rader, lasning = {}) {
  return (rader || []).filter((r) => unread(r, lasning));
}

/**
 * Vad listan ska visa: fönstret bakåt i tiden, det som rensats bort, och sidan.
 *
 * ⛔ TRE GRÄNSER, OCH DE GÖR OLIKA SAKER. Blandas de ihop blir beteendet
 * omöjligt att förutsäga:
 *
 *  - `dagar` är FÖNSTRET. En driftslogg svarar på "kördes det nyligen", och en
 *    rad från i våras svarar inte på någon fråga man ställer.
 *  - `rensatTill` är LÄSARENS EGEN STÄDNING. Den döljer, den raderar inte:
 *    raden finns kvar i databasen, så den som undersöker något i efterhand ser
 *    hela historiken. En logg man kan radera ur en flik är ingen logg.
 *  - `sida` är hur många som ritas åt gången, så en lång lista inte blir en
 *    vägg. `fler` säger om det finns mer bakom knappen.
 *
 * ⛔ OLÄSTA SLIPPER FÖNSTRET OCH RENSNINGEN. En rad som aldrig lästs ska inte
 * kunna försvinna för att den blev gammal medan man var borta, och märket på
 * knappen hade då räknat något som inte gick att hitta.
 *
 * @param {(Handelse & { id?: string })[]} rader Nyast först.
 * @param {{ dagar?: number, sida?: number, rensatTill?: string | null, sedd?: string | null, lasta?: Iterable<string> | null, nu?: Date | number | string }} [choice]
 * @returns {{ rader: (Handelse & { id?: string })[], fler: number, dolda: number }}
 */
export function activityWindow(rader, choice = {}) {
  const lista = rader || [];
  const { dagar, sida, rensatTill, sedd, lasta, nu } = choice;
  const klocka = new Date(nu ?? Date.now());
  const grans =
    typeof dagar === "number"
      ? new Date((Number.isNaN(klocka.getTime()) ? Date.now() : klocka.getTime()) - dagar * DAG).toISOString()
      : null;

  const kvar = lista.filter((r) => {
    if (unread(r, { sedd, lasta })) return true;
    const nar = String((r && r.nar) || "");
    if (rensatTill && nar && nar <= rensatTill) return false;
    if (grans && nar && nar < grans) return false;
    return true;
  });

  const dolda = lista.length - kvar.length;
  if (typeof sida !== "number" || sida <= 0) return { rader: kvar, fler: 0, dolda };
  return { rader: kvar.slice(0, sida), fler: Math.max(0, kvar.length - sida), dolda };
}
