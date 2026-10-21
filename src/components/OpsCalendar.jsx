import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { kantKlass } from "../lib/kant.js";
import { slagKant, slagText } from "../lib/slag.js";
import { FULL_HEIGHT_CLASSES, useFullHeight } from "../lib/fullHeight.js";
import { radBehallare, radKlass, radRubrikKlass } from "../lib/radKlass.js";
import { rapporteraFel } from "../lib/felrapport.js";
import { STANDARD_TIDSZON, idagI, kontrolleraTidszon } from "../lib/kalendrar.js";
import { KALENDERPRICK, postklasser, prickklass } from "../lib/kalenderfarg.js";
import { DATUM_EJ_SATT } from "../lib/handelsemodell.js";
import { lagerFarg } from "../lib/kalenderlager.js";
import { useKalenderSynlighet } from "../lib/useKalenderSynlighet.js";
import { useHandelseOppnare } from "../lib/handelsekontext.js";
import { LANGTRYCK_MS } from "../lib/talk.js";
import { BRICKA_GRANS, BRICKA_MINSTA_OVERHANG, Dagruta } from "./OpsCalendarDagruta.jsx";
import { HandelseLank } from "./HandelseLank.jsx";
import {
  DEFAULT_LOCALE,
  monthNames,
  weekdayNames,
  dateKey,
  dateText,
  months,
  monthGrid,
  perDay,
  scrollDirection,
  franNyckel,
  bandIVecka,
  arBand,
  arPreliminar,
  preliminarFel,
  reserveradeFiler,
  isoVecka,
  datumOmfang,
  valjDag,
  valjVecka,
  valjIntervall,
  traffar,
  filtreraPoster,
  forvaldKalenderId,
  apparFor,
  appForTyp,
  appfilterNyckel,
  lasDoldaAppar,
} from "../lib/calendar.js";
import { ChevronNedIkon, KalenderIkon, KryssIkon, PlusIkon, ReglageIkon, SokIkon, TillganglighetIkon, VeckonummerIkon } from "./icons.jsx";
import { OpsStatusDot } from "./OpsStatusDot.jsx";
import { OpsKalenderLista } from "./OpsKalenderLista.jsx";
import { OpsExternPanel } from "./OpsExternPanel.jsx";
import { ValRad } from "./ValRad.jsx";

/**
 * "Datum ej satt" på det språk kalendern ritas på (0.127.0). Orden bor i `DATUM_EJ_SATT` (`lib/handelsemodell.js`), och panelen läser dem därifrån också.
 * Kalenderns `locale` är en BCP-47-sträng ("sv-SE", "en-GB"); allt som börjar på "en" är engelska.
 * @param {string} locale @returns {string}
 */
const datumEjSattOrd = (locale) => (String(locale).toLowerCase().startsWith("en") ? DATUM_EJ_SATT.en : DATUM_EJ_SATT.sv);

/**
 * Kalender: en löpande månadsvy, som SessionStudios, med det som faktiskt ligger på dagen.
 *
 * ══ ⛔ VAD DEN ÄR, OCH VARFÖR DEN INTE LÄNGRE ÄR "ABSOLUT INGEN OVERKILL" ═══════
 *
 * CP 2026-09-22: "Jag vill ha en REN Enkel och strukturerad kalender i samma utseende med så lite kod som möjligt.
 * Absolut ingen overkill." Här stod då "⛔ INGEN DRAG-MARKERING, INGA LAGER, INGA AVATARER, INGEN EXPORT", med skälet
 * att förebilden bär allt det för grupper som ska hitta en tid ihop, och att ett bolags kalender har en läsare.
 *
 * ⛔ DET SKÄLET ÄR INTE LÄNGRE SANT, OCH DÄRFÖR ÄNDRAS REGELN I STÄLLET FÖR ATT KRINGGÅS (metaregeln). CP 2026-09-29
 * 21:10, epiken cllp/ops-framework#179: "Kolla alla kalender inställningar och funktioner i SessionStudio. Grundlig
 * analys. Samma vill jag ha i ramverket. Vidare kunna skapa olika kalendrar och filtrera på alla eller specifika för
 * gruppen." Kalendern har alltså fått flera läsare (gruppens kalendrar, mina kalendrar) och ett filter, och en
 * flerdagspost har ingen plats i ett rutnät som bara kan rita märken. Fas F1 tar in, ur SS `CalView.jsx`,
 * `calView/MonthGrid.jsx`, `useCalendarDaySelection.js`, `CalendarDayPeekPopover.jsx`, `calendarSpanLayout.js` och
 * `CalendarViewToolbar.jsx`:
 *
 *   - 12 månader bakåt och 12 framåt (`monthsBefore = 12`, `monthsToShow={12}`), rullad till innevarande
 *   - veckonummer av och på, sparat per enhet, och ett tryck på numret väljer veckan
 *   - dra-markering med 12 px tröskel, och flerdagsval med piller som går att ta bort
 *   - dagpanelen vid sidan på dator och staplad under rutnätet på pekskärm, högst 45 procent av höjden, med antal och
 *     en skapa-ruta
 *   - snabbtitt på en dag (långtryck eller högerklick), där poster som filtret döljer står med och är märkta "Dold"
 *   - band per vecka för flerdagsposter och heldag
 *   - verktygsraden: Kalendrar, veckonummer, typ och status, sök som tonar ned dagar utan träff, och "+"
 *
 * ⛔ KALENDERLAGREN ÄR BORTA (0.134.0, cllp/lifehub.app#402). Plockaren (0.90.7) och brytaren (0.61.0) ersattes av listan Kalendrar: en rad per kalender med en växel och en visning
 * (Händelser, Ram eller Båda), i ETT minne per person och grupp. Ärenden är en rad bland de andra. `lager`-propen kastar. Mönsterlager som i SessionStudio (återkommande, datumintervall, en egen
 * samling) byggs inte: appen skickar in de kalendrar den redan har. Tillgänglighetens knapp finns. Avatarer i rutan och export är kvar som egna faser.
 *
 * ⛔ DEN RITAR FORTFARANDE DATERADE POSTER OCH ÄGER INTE DATAN. Appen skickar in posterna, kalendrarna och typerna.
 * Filtret är vyns eget tillstånd, eftersom det bara avgör vad som RITAS: en post som filtret döljer finns kvar i
 * snabbtitten, märkt "Dold". Vilket fönster som läses avgör appen med `kalenderfonster`, samma funktion som ritar
 * månaderna här.
 *
 * ══ ⛔ FORMEN ÄR LÅNAD, KODEN ÄR DET INTE ══════════════════════════════
 *
 * Fyra beslut är tagna ur SessionStudio, eftersom de är mätta där och inte
 * behöver mätas om:
 *
 *   1. EN RULLE, INTE EN SIDA PER MÅNAD. Man bläddrar inte mellan månader, man
 *      rullar förbi dem. Nästa månads början syns innan den här månaden tar slut.
 *   2. DEN ÖPPNAR PÅ IDAG. Utan det öppnar en kalender med historik på en tom
 *      ruta långt bak, och det ser ut som att posterna saknas.
 *   3. VECKODAGSRADEN ÄR KLISTRAD. Rullar man tre månader vet man annars inte
 *      längre vilken kolumn som är onsdag.
 *   4. EN FLYTANDE "IDAG"-KNAPP som dyker upp FÖRST när innevarande månad rullat
 *      ur bild, med en pil åt det håll man ska rulla.
 *
 * ⛔ TOKENS ÄR RAMVERKETS, INTE FÖREBILDENS. De två systemen delar inte ett enda
 * tokennamn (`--color-bg-card` mot `--color-raised`), så en kopierad klassrad
 * hade dragit in ett andra designspråk i appen. Formen bär över, färgerna gör det
 * inte.
 *
 * ══ ⛔ KALENDERN RULLAR I SIG SJÄLV, INTE I SIDAN ══════════════════════
 *
 * CP 2026-09-22, med bild: "Scrollningen tar med hela menyn och allt. Kan vi
 * göra så att vi scrollar kalendern så att jag inte behöver scrolla upp för att
 * komma tillbaka till idag."
 *
 * Första versionen låg i dokumentets flöde, och då är det SIDAN som rullar. Tre
 * följdfel, alla på bilden:
 *
 *   - `sticky top-0` på veckodagsraden nyper mot fönstrets överkant, alltså
 *     UNDER appens egen toppmeny, och raden försvann bakom den.
 *   - "Idag"-knappen låg `sticky bottom-4` i samma flöde och kunde bara nypa
 *     inom sin förälders rullsträcka, alltså inte där den behövdes.
 *   - Varje väg tillbaka till idag var en resa genom hela sidan.
 *
 * Nu äger rutnätet en egen rullbehållare med tak. Då nyper veckodagsraden mot
 * KALENDERNS överkant, "Idag" kan ligga absolut i kalenderns nedre hörn, och
 * appskalet står stilla medan man bläddrar genom månader.
 *
 * ⛔ `overscroll-contain` HÖR TILL SAMMA BESLUT. Utan den fortsätter rullningen
 * ut i sidan så fort man nått botten av kalendern, alltså exakt det som skulle
 * bort, fast en halv sekund senare.
 *
 * ⛔ TAKET ÄR UPPMÄTT OCH INTE EN VIEWPORT-ENHET (0.32.1). `vh` krymper aldrig
 * när adressfältet fälls in, och `svh` (som stod här till 0.32.0) växer aldrig när
 * det fälls ut: CP 2026-09-30, "Kalender och idag går inte ända ner utan huggs av
 * i botten". Nu mäts bottenradens kant direkt, se `useFullHeight`.
 *
 * ══ ⛔ DAGPANELEN FLYTER ÖVER RUTNÄTET PÅ PEKSKÄRM, UTAN EGEN YTA (0.37.0) ═════════════
 *
 * 0.36.0 staplade panelen UNDER rutnätet på en ogenomskinlig yta med en kant tvärs över, efter SS webb
 * (`CalendarView.jsx`, `shrink-0 max-h-[45%]`), och rutnätet krympte. CP 2026-09-30 22:30, med en skärmbild ur SS-appen på
 * telefonen bredvid vår: "Bubblorna är lite förstörda. Inget transparent bakom, de kommer fram på fel sätt med scrollning.
 * [...] Det var bättre innan." I SS-appen flyter datumchipet, korten och rutorna för antal och Skapa fritt över rutnätet,
 * var och en med sin egen mörka yta, och rutnätet syns runt dem. Nu likadant: platsen är `absolute` i kalenderns nederkant
 * utan bakgrund, högst 45 procent av ytan, och rullytan har luft under sista månaden lika hög som panelen, så att varje dag
 * går att rulla fram ovanför den. 0.36.0:s montage jämförde mot en SS-sida renderad ur webbkällan och missade detta;
 * förebilden är nu en skärmbild av SS-appen.
 *
 * ⛔ INVERTERADE KORT MED `ops-contrast-panel`, alltså samma yta som laborera-popovern
 * och sifferbubblan. Den klassen remappar bläck, linjer och accent, så korten
 * håller kontrast i både ljust och mörkt läge utan en enda egen hex.
 */

/*
 * ⛔ VECKODAGARNA STOD HÄR SOM SJU STRÄNGAR. Nu kommer de ur `Intl`, som kan dem
 * i varje språk. Se `weekdayNames` i `src/lib/calendar.js` för varför raden är
 * måndagsbaserad oavsett vad språket själv tycker (cllp/ops-framework#95).
 */

/**
 * Millisekunder mellan två svepande element i dagspanelen.
 *
 * ⛔ 40 MS ÄR FÖREBILDENS TAL, avläst ur SessionStudios dagspanel
 * (`popIn 180ms ease-out ${idx * 40}ms both`). Trappan är det som gör att en
 * panel med sex kort läses som EN rörelse i stället för sex samtidiga.
 *
 * ⛔ OCH DEN TAS INTE UR LUFTEN IGEN. Skulle den ändras är det för att någon
 * mätt att den känns fel, inte för att ett annat tal råkade se rundare ut.
 */
const SVEPSTEG = 40;

/*
 * ══ ⛔ RUTNÄTETS PRICKAR BÄR "NÅGOT FINNS", INTE VILKEN STATUS ══════════
 *
 * Första utkastet satte en `OpsStatusDot` per post i dagsrutan, och ramverkets
 * egen vakt stoppade det: den kräver ett ord till varje färg, och ett ord per
 * prick hade blivit "Öppet Öppet Klart" i en ruta som är 44 px bred.
 *
 * Vakten hade rätt om mer än tillgängligheten. Tre statusfärger i en dagsruta
 * på en telefon är inte information, det är brus: man ser att något är rött men
 * inte vad, och måste öppna dagen ändå.
 *
 * Rutan svarar därför bara på "finns det något här, och hur mycket". STATUS,
 * MED SITT ORD, bor i dagsbubblan ett tryck bort, där det finns plats för både
 * färgen och ordet bredvid titeln. Det är samma arbetsdelning som `OpsEventList`
 * gör mellan pricken på raden och `Status` i utfällningen.
 */

/**
 * Ett piller per vald dag.
 *
 * ⛔ DATUMET STÅR HÄR, ÖVER KORTEN, OCH INTE SOM EN RUBRIK INUTI PANELEN.
 * Förebilden (SessionStudios dagspanel) radar upp de valda datumen som piller
 * överst, och pillren är samtidigt kontrollen som tar bort en dag ur urvalet.
 * Ett datum som bara är en rubrik är en upplysning; ett datum som är ett piller
 * är en upplysning man kan göra något åt.
 *
 * ⛔ KRYSSET I PILLRET FINNS BARA NÄR FLERA DAGAR ÄR VALDA, precis som i
 * förebilden. Med en enda dag gör pillrets kryss exakt samma sak som panelens
 * stängkryss två centimeter till höger, och två knappar med samma verkan får
 * läsaren att leta efter skillnaden.
 *
 * @param {{ dayKey: string, onTaBort: (dayKey: string) => void, order: number, locale: string }} props
 */
function Datumpiller({ dayKey, onTaBort, order, locale }) {
  const text = dateText(dayKey, locale);
  return (
    <span
      data-datumpiller=""
      style={{ animationDelay: `${order * SVEPSTEG}ms` }}
      /*
       * ⛔ shrink-0 OCH MARGINAL FÖR KRYSSET (bolag-ops#556). Pillren stod i samma flex-rad som
       * stängkrysset med `ml-auto`, och utan `shrink-0` klämdes de ihop så att texten och de
       * absolutplacerade kryssen överlappade varandra. Marginalen tar höjd för kryssets
       * utstick (`-top-3.5 -right-3.5`, samma som SS `DayDetailPanel.js`).
       */
      // ⛔ pr-6 OCH INTE px-3.5 (0.53.0): krysset står i hörnet och täckte slutet av datumet ("12 oktobe"), syns på CP:s
      // skärmbild 2026-10-04. Mätt i check-skalyta: textens högerkant ligger till vänster om märket.
      className="ops-contrast-panel relative mr-2 mb-1 inline-flex shrink-0 animate-svep items-center rounded-full bg-contrast-panel py-1.5 pr-6 pl-3.5 text-etikett font-semibold text-ink shadow-md"
    >
      {text}
      {/* ⛔ KRYSSET ÄR ETT RUNT MÄRKE I PILLRETS HÖRN, PÅ VARJE PILLER (0.37.0), som SS-appen (`DayDetailPanel.js`, top -8,
          right -8, 20 px). 0.36.0 hade krysset bara när flera dagar var valda, med skälet att det annars gör samma sak som
          panelens stängkryss; SS-appen har det ändå, och CP:s förebild är SS-appen. 44 px träffyta runt märket. */}
      <button
        type="button"
        onClick={() => onTaBort(dayKey)}
        aria-label={`Ta bort ${text}`}
        className="absolute -top-3.5 -right-3.5 flex size-11 cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-contrast-panel text-ink ring-2 ring-canvas">
          <KryssIkon size={10} />
        </span>
      </button>
    </span>
  );
}

/**
 * En post, som en rad i dagpanelens bubbla.
 *
 * ══ ⛔ EN BUBBLA MED RADER OCH AVDELARE, SOM SS-APPEN (0.37.0) ══════════════
 *
 * CP 2026-09-22, med bild ur SessionStudio: "Det finns ingen separator med flera händelser i bubblan." Första versionen
 * hade rader utan avdelare i en bubbla, och 0.26.0 till 0.36.0 gjorde därför ett eget kort per post. CP 2026-09-30, med
 * skärmbilder ur SS-appen: "I SessionStudio, ser du att man scrollar i bubblan här om den blir för stor?" SS-appen
 * (`DayDetailPanel.js`, `abCardLeft`, `abEventsScroll`, `abEventRow`) har EN bubbla, `radius.xl` och `padding 12`, med en
 * rullyta på högst 140 px och en hårfin linje överst på varje rad, och posterna under rubrikerna GRUPP och MINA. Avdelaren
 * är alltså linjen och postens färgade vänsterkant, inte luft mellan kort, och det svarar på båda klagomålen.
 *
 * ⛔ DATUMET ÅTERKOMMER PÅ KORTET, under titeln, och det är inte en upprepning
 * av pillret ovanför. Pillren säger vilka dagar urvalet består av; kortets rad
 * säger vilken av dem just den här posten tillhör. Med tre dagar valda är det
 * enda som skiljer två likadana påminnelser åt.
 *
 * ⛔ 0.40.0 (#214): EN POST MED `handelseId` ÄR HELA RADEN SOM EN LÄNK till händelsens panel (SS `DayDetailPanel`: raden öppnar händelsen). Titeln är
 * länken (`HandelseLank`) och hela raden är dess yta, som SS-appens rad: ingen pil eller annat märke (en pil bredvid utfällningen tog 24 px av en titel i en bubbla som är 239 px bred vid 390, och "Löneutbetalning" gick in under den; en pil efter titeln hamnade ensam på en egen rad). Utfällningen
 * (status, länk, detaljer) ligger kvar ovanpå med `z-10` och tar sina egna tryck.
 *
 * @param {{ dayKey: string, entry: import("../lib/calendar.js").CalendarEntry, statusWords: Record<string, string>, order: number, locale: string, oppna: ((id: string) => void) | null, oppnaExtern: (e: import("../lib/calendar.js").CalendarEntry) => void }} props
 */
function Postkort({ dayKey, entry, statusWords, order, locale, oppna, oppnaExtern }) {
  const oppnaId = entry.handelseId && oppna ? entry.handelseId : null;
  // ⛔ EN EXTERN POST ÖPPNAS I LÄSPANELEN (0.134.0). Har posten ett `handelseId` vinner det: då finns en riktig händelse att öppna.
  const oppnaLas = !oppnaId && !entry.handelseId && entry.extern ? () => oppnaExtern(entry) : null;
  const [oppen, setOppen] = useState(false);
  const idBas = useId();
  const panelId = `${idBas}-detaljer`;

  /*
   * ⛔ EN FLERDAGSPOST SÄGER SITT HELA SPANN, EN HELDAGSPOST SÄGER "HELDAG" (0.36.0). Kortet står under en av dagarna,
   * och utan spannet ser en semester över tre dagar ut som tre semestrar i panelen när tre dagar är valda.
   */
  const spann = entry.endDate && entry.endDate > entry.date ? `${dateText(entry.date, locale)} till ${dateText(entry.endDate, locale)}` : dateText(dayKey, locale);
  // ⛔ EN PRELIMINÄR POST SÄGER DET (0.127.0): dagen i kortet är en FÖRESLAGEN dag, inte händelsens. Ordet är ramverkets (`DATUM_EJ_SATT`), så appen
  // skriver det inte själv i `not` och det inte kan stå två gånger.
  const meta = [spann, entry.allDay ? "Heldag" : "", arPreliminar(entry) ? datumEjSattOrd(locale) : "", entry.not || ""].filter(Boolean).join(" · ");

  /*
   * ⛔ CHEVRONEN FINNS BARA NÄR DET FINNS NÅGOT ATT FÄLLA UT. En pil som öppnar
   * en tom ruta är ett löfte som inte infrias, och den som tryckt en gång utan
   * att något hände slutar lita på de andra. Samma regel som `OpsEventList` har.
   */
  const statusord = entry.status ? statusWords[entry.status] : "";
  const harDetaljer = Boolean(statusord || entry.url || entry.details);

  /*
   * ⛔ SAMMA KANT SOM PÅ LISTANS KORT, UR SAMMA FIL.
   *
   * CP 2026-09-24, med bild: "Bubblorna i kalender och listan idag färgar inte
   * vänstersidorna efter typens specifika färg."
   *
   * Listan fick kanten genom `OpsCard`, som burit den hela tiden. Kalenderns
   * postkort är ingen `OpsCard` utan en egen ruta, så här fanns ingen kant att
   * släppa igenom. Den hämtas ur `lib/kant.js` i stället för att ritas om, så
   * kravet på ett ord gäller båda ytorna och kan inte glida isär.
   *
   * ⛔ KANTEN FÖLJER RADIEN, alltså `border-l-4` på samma ruta som har
   * `rounded-xl`, precis som i `OpsCard`. Ett eget element hade kunnat hamna
   * utanför hörnet.
   */
  /*
   * ⛔ SLAGET VINNER ÖVER `edge`, OCH DE ÄR INTE SAMMA FRÅGA.
   *
   * `edge` svarar på VEM posten tillhör: en scope, en grupp, en avdelning, ur
   * identitetspaletten. `slag` svarar på VAD den är, ur slagpaletten, och det
   * är det svaret prickarna i rutnätet ovanför också bär. Bär kortet och
   * pricken olika färger för samma post säger vyn emot sig själv i två
   * element man ser samtidigt.
   *
   * Båda finns kvar eftersom en app kan vilja ha båda. Anges båda vinner
   * slaget, av just det skälet: pricken kan bara visa ett av dem.
   */
  const kanten =
    slagKant(entry.slag, entry.slagLabel, "OpsCalendar") ||
    kantKlass(entry.edge, entry.edgeLabel, "OpsCalendar") ||
    (entry.kalender ? kantKlass(entry.kalender.farg, entry.kalender.namn, "OpsCalendar") : null);
  const kantord = entry.slagLabel || entry.edgeLabel || (entry.kalender ? entry.kalender.namn : "");

  return (
    <div
      style={{ animationDelay: `${order * SVEPSTEG}ms` }}
      data-postrad=""
      {...(arPreliminar(entry) ? { "data-preliminar": "" } : {})}
      className={cx("animate-svep py-2 pr-1 pl-2.5", (oppnaId || oppnaLas) && "relative", kanten && cx("border-l-4", kanten), arPreliminar(entry) && "border-dashed")}
    >
      {/* ⛔ ORDET FÖRST I KORTET, precis som i `OpsCard`. Den som lyssnar ska
          höra vad kanten betyder innan titeln, inte efter den. */}
      {kanten ? <span className="sr-only">{kantord}</span> : null}
      <div className="flex items-start gap-2">
        {/* ⛔ PRICKEN STÅR KVAR I DEN IHOPFÄLLDA RADEN. Den svarar på frågan man
            ställer när man SKUMMAR panelen, alltså innan man öppnat något; ordet
            bredvid den finns i utfällningen, där det får plats. Samma
            arbetsdelning som `OpsEventList` gör. */}
        {entry.status ? (
          <span className="mt-1 shrink-0">
            <OpsStatusDot status={entry.status} label={statusord || ""} />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {/* ⛔ TITELN ÄR TEXT OCH INTE LÄNGRE EN LÄNK. CP 2026-09-22: "man vill
              kunna se status och länk (issue) där också om det finns", alltså i
              utfällningen. Låg länken kvar på titeln VOCH i utfällningen vore det
              samma adress två gånger på samma kort, och det är precis dubbletten
              som togs bort ur navet samma dag.
              ⛔ Det kostar ett tryck till för ett stängt ärende, och det är en
              medveten avvägning: kortet blir läsbart som en rad, och adressen
              står där den kan bära sitt eget ord. */}
          {/* ⛔ SLAGETS IKON FÖRE TITELN (0.37.1). 0.37.0 lovade ikonen "i dagpanelens kort" men ritade den aldrig här, och CP
              2026-09-30 sade "Jag gillar ikonerna för typerna hos oss". Samma storlekskonvention och samma färg som raden i
              `OpsEventList` (slagets ton ur `lib/slag.js`), `aria-hidden` eftersom ordet redan läses ur kantordet ovanför.
              Ikonen hör hemma HÄR och inte i dagrutan: rutan har prickar och streck, ett beslut från 0.37.0. */}
          <span className="flex items-start gap-1.5">
            {entry.kindIcon ? (
              <span data-postikon="" aria-hidden="true" className={cx("mt-0.5 flex shrink-0 items-center", slagText(entry.slag, entry.slagLabel, "OpsCalendar") || "text-ink-secondary")}>
                {entry.kindIcon}
              </span>
            ) : null}
            {/* ⛔ ETT LÅNGT ORD STANNAR I KOLUMNEN (0.87.0). Mätt i dagpanelen vid 390 px, samma på 0.83.0 och här:
                "Löneutbetalning" är 133 px, kolumnen 123 px, och orden målade 2 px in i utfällningen (texten slutar 225, knappen börjar 223).
                `break-words` bryter ordet inne i kolumnen i stället för att låta det ligga över knappen. */}
            <span className="min-w-0 break-words font-semibold text-ink">
              {oppnaId && oppna ? (
                <HandelseLank id={oppnaId} oppna={oppna} tacker="after:inset-0">
                  {entry.title}
                </HandelseLank>
              ) : oppnaLas ? (
                <ExternLank onOppna={oppnaLas}>{entry.title}</ExternLank>
              ) : (
                entry.title
              )}
            </span>
          </span>
          <p className="m-0 text-meta text-ink-secondary">{meta}</p>
          {/* ⛔ KALENDERNS NAMN BREDVID SIN FÄRG (0.36.0). Färgen ensam säger ingenting för den som inte lärt sig den,
              och i en panel med tre kalendrar är namnet det man letar efter. */}
          {entry.kalender ? (
            <p data-kalendernamn="" className="m-0 flex items-center gap-1.5 text-meta text-ink-secondary">
              <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", KALENDERPRICK[entry.kalender.farg] || "bg-accent")} />
              {entry.kalender.namn}
            </p>
          ) : null}
        </div>

        {entry.atgard ? <div className="relative z-10 shrink-0">{entry.atgard}</div> : null}

        {harDetaljer ? (
          <button
            type="button"
            onClick={() => setOppen((f) => !f)}
            aria-expanded={oppen}
            aria-controls={panelId}
            className={cx(
              "relative z-10 -mr-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-secondary",
              "transition-colors duration-(--duration-fast) ease-standard hover:text-ink",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
            )}
          >
            <span className="sr-only">Visa detaljer för {entry.title}</span>
            <span
              aria-hidden="true"
              className={cx("transition-transform duration-(--duration-fast)", oppen && "rotate-180")}
            >
              <ChevronNedIkon size={16} />
            </span>
          </button>
        ) : null}
      </div>

      {harDetaljer ? (
        <div id={panelId} hidden={!oppen} className={cx("mt-2 flex flex-col gap-1 border-t border-line pt-2 text-etikett", (oppnaId || oppnaLas) && "relative z-10")}>
          {/* ⛔ STATUS SOM ORD, inte som färg. Pricken ovanför är samma faktum
              för den som ser den; här står det så det går att läsa upp. */}
          {statusord ? (
            <p className="m-0 text-ink-secondary">
              Status: <span className="font-semibold text-ink">{statusord}</span>
            </p>
          ) : null}
          {entry.url ? (
            /* ⛔ TITELN I `aria-label` OCH INTE SOM EN `sr-only`-text bredvid.
               Tio kort får annars tio identiska "Öppna" upplästa, vilket var
               skälet till att titeln ska med. Men en osynlig textnod med samma
               ord som rubriken gör att varje sökning efter titeln träffar TVÅ
               noder, och det slog ut två prov direkt. `aria-label` ger samma
               upplästa namn utan att lägga en andra kopia i dokumentet. */
            <a
              className="font-semibold text-accent underline decoration-from-font underline-offset-2 hover:text-accent-hover"
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${entry.urlLabel || "Öppna"} ${entry.title}`}
            >
              {entry.urlLabel || "Öppna"}
            </a>
          ) : null}
          {entry.details}
        </div>
      ) : null}
    </div>
  );
}

/** Hur länge rullningen ska ha stått still innan `onSynligaManader` anropas (0.74.0, #284). */
export const SYNLIGA_MANADER_VILA_MS = 150;

/**
 * Den första och sista månaden vars block syns i rullytan, under den klistrade veckodagsraden. `null` när inget block syns.
 *
 * @param {HTMLElement} rulle
 * @param {number} huvud Veckodagsradens höjd, som täcker rullytans överkant.
 * @returns {{ forsta: string, sista: string } | null}
 */
export function synligaManader(rulle, huvud) {
  const yta = rulle.getBoundingClientRect();
  const topp = yta.top + huvud;
  /** @type {string[]} */
  const synliga = [];
  for (const el of rulle.querySelectorAll("[data-kalender-manad]")) {
    const r = el.getBoundingClientRect();
    if (r.bottom > topp && r.top < yta.bottom) synliga.push(/** @type {string} */ (el.getAttribute("data-kalender-manad")));
  }
  return synliga.length ? { forsta: synliga[0], sista: synliga[synliga.length - 1] } : null;
}

/**
 * Dagpanelens tak under 1024 px, som andel av ytan (0.53.0, cllp/lifehub.app#32-passet).
 *
 * ⛔ 45 PROCENT RÄCKTE INTE. CP 2026-10-04, med en skärmbild från telefonen: "När datum bubblorna i kalendern blir två
 * rader så får det inte plats i den allokerade rutan, storleken måste anpassas till vad som är i och behöver expandera."
 * Med tre valda dagar bröt pillren rad, och panelen fick en egen rullning så att postbubblan klipptes nedtill. Panelen
 * följer nu sitt innehåll och rullar bara när den skulle ta mer än tre fjärdedelar av ytan. Postlistan i bubblan har
 * fortfarande sitt eget tak på 140 px, så det som kan växa är pillerraderna, och det är just dem CP såg klämmas.
 */
const DAGPANEL_TAK = 0.75;

/**
 * De valda dagarnas poster: piller överst, korten till vänster, antalet och skapa-rutan till höger.
 *
 * ══ ⛔ VAR DEN LIGGER, OCH VARFÖR DET ÄR TVÅ OLIKA SVAR ════════════════
 *
 * CP 2026-09-22: "Se var bubblorna är i web där det finns utrymme och se var de
 * finns i mobil och hur det ser ut."
 *
 *   SMALT: UNDER rutnätet, högst `DAGPANEL_TAK` av ytan (45 procent till 0.53.0), och rutnätet krymper (SS `CalendarView.jsx:208`, `shrink-0
 *   max-h-[45%]`). Till 0.35.0 låg den ovanpå rutnätet, se filhuvudet.
 *   BRETT: en egen kolumn BREDVID rutnätet, i flödet, 300 px från 1024 px och 360 px från 1280 px.
 *
 * ⛔ GRÄNSEN GICK FÖRST VID 768 px, OCH DET KLÄMDE IHOP KALENDERN. CP
 * 2026-09-22, med bild: "I web-vyn har du tryckt ihop kalendern." Räknat: en app-vy på 768 px har 736 px innanför sin
 * sidomarginal, och drar man 300 px till en kolumn återstår 62 px per dagsruta. Vid 1024 px blir samma räkning 99 px.
 * Och det är förebildens egen regel: en stående surfplatta får telefonens krom (`compactTouchChrome`).
 *
 * ⛔ ANTALET OCH SKAPA-RUTAN ÄR SS `CalendarView.jsx:302-321`: två kvadrater i den inverterade ytan, "N poster" och
 * "+ Skapa". Skapa-rutan finns bara när appen skickat `onSkapa`: en ruta som inte gör något är värre än ingen.
 *
 * ⛔ TOMT ÄR ETT SVAR (punkt 5). En vald dag utan poster säger "Inga poster", och antalet står som noll.
 *
 * @param {{ days: { dayKey: string, entries: import("../lib/calendar.js").CalendarEntry[] }[], statusWords: Record<string, string>, onClose: () => void, onTaBort: (dayKey: string) => void, onSkapa?: () => void, locale: string, arMin: (e: import("../lib/calendar.js").CalendarEntry) => boolean, lager?: import("react").ReactNode, oppna: ((id: string) => void) | null, oppnaExtern: (e: import("../lib/calendar.js").CalendarEntry) => void }} props
 */
function DayPanel({ days, statusWords, onClose, onTaBort, onSkapa, locale, arMin, lager, oppna, oppnaExtern }) {
  const flera = days.length > 1;
  const title = flera ? `${days.length} dagar` : dateText(days[0].dayKey, locale);
  const name = flera ? `Poster för ${days.length} valda dagar` : `Poster den ${title}`;
  /*
   * ⛔ EN FLERDAGSPOST RÄKNAS EN GÅNG i antalet, fast den ligger på flera av de valda dagarna. Kortet visas under den
   * första valda dag den täcker, och säger sitt hela spann.
   */
  const sedda = new Set();
  const kort = days.map((d) => ({ dayKey: d.dayKey, entries: d.entries.filter((e) => (sedda.has(e.id) ? false : (sedda.add(e.id), true))) }));
  const antal = sedda.size;

  /*
   * ⛔ ESCAPE STÄNGER, och den lyssnaren sitter på fönstret och inte på panelen.
   * Fokus ligger kvar på dagsrutan man tryckte på, alltså utanför panelen, så en
   * lyssnare på panelens egen nod hade aldrig hört tangenten.
   */
  useEffect(() => {
    /** @param {KeyboardEvent} e */
    const vid = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", vid);
    return () => window.removeEventListener("keydown", vid);
  }, [onClose]);

  /*
   * ⛔ GRUPP OCH MINA SOM RUBRIKER, BARA NÄR BÅDA FINNS (SS-appen: en dag med bara gruppens poster har ingen rubrik). En post
   * utan kalender är gruppens (en händelse ligger alltid i gruppen).
   */
  const rader = kort.flatMap((d) => d.entries.map((p) => ({ dayKey: d.dayKey, p })));
  const mina = rader.filter((r) => arMin(r.p));
  const gruppens = rader.filter((r) => !arMin(r.p));
  const avsnitt = mina.length > 0 && gruppens.length > 0 ? [{ rubrik: "Grupp", rader: gruppens }, { rubrik: "Mina", rader: mina }] : [{ rubrik: "", rader }];

  return (
    <section aria-label={name} data-dagpanel="" className="flex w-full flex-col gap-2 p-3 lg:p-0">
      {/*
       * ⛔ PILLREN OCH STÄNGKRYSSET ÄR TVÅ YTOR (bolag-ops#556). Före det delade de en
       * `flex-wrap`-rad där stängkrysset hade `ml-auto`: när flera dagar valdes klämdes
       * pillren ihop i stället för att bryta rad, och CP:s bild visade överlappande bubblor.
       * Pillren wrappas i sin egen behållare; stängkrysset står fast till höger.
       */}
      <div className="flex items-start gap-2 pt-3.5">
        <div data-datumpiller-rad="" className="flex min-w-0 flex-1 flex-wrap content-start gap-x-1 gap-y-2">
          {days.map((d, i) => (
            <Datumpiller key={d.dayKey} dayKey={d.dayKey} onTaBort={onTaBort} order={i} locale={locale} />
          ))}
        </div>
        {/* ⛔ KRYSSET BÄR RUBRIKEN I SITT NAMN. "Stäng" ensamt säger inte vad som
            stängs för den som lyssnar sig igenom sidan. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={`Stäng ${title}`}
          className={cx(
            "ops-contrast-panel flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-contrast-panel text-ink shadow-md",
            "hover:text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <KryssIkon size={14} />
        </button>
      </div>

      {/* ⛔ SS-appens rad: bubblan med posterna till vänster (flex 3) och antalet och Skapa till höger (flex 1). */}
      <div className="flex gap-2">
        <div data-postbubbla="" className="ops-contrast-panel flex min-h-30 min-w-0 flex-3 flex-col justify-center rounded-xl bg-contrast-panel p-3 text-ink shadow-md">
          {antal === 0 ? (
            <p className="m-0 py-2 text-meta text-ink-muted">Inga poster {flera ? "de valda dagarna" : "den här dagen"}.</p>
          ) : (
            // ⛔ TAKET ÄR SS-APPENS 140 PX (`abEventsScroll`), och bubblan rullar invändigt, inte kalendern bakom.
            <div data-postrulle="" className="max-h-35 overflow-y-auto overscroll-contain">
              {avsnitt.map((a, ai) => (
                <div key={a.rubrik || "alla"}>
                  {a.rubrik ? <p data-postrubrik={a.rubrik} className="m-0 pt-1 pb-1 text-mikro font-semibold uppercase tracking-wider text-ink-muted">{a.rubrik}</p> : null}
                  <div className="flex flex-col divide-y divide-line">
                    {/* ⛔ TRAPPAN RÄKNAS ÖVER HELA PANELEN och inte per dag, så att det som ska läsas som en rörelse inte blir tre. */}
                    {a.rader.map((r, i) => (
                      <Postkort
                        key={`${r.dayKey}-${r.p.id}`}
                        dayKey={r.dayKey}
                        entry={r.p}
                        statusWords={statusWords}
                        oppna={oppna}
                        oppnaExtern={oppnaExtern}
                        order={days.length + avsnitt.slice(0, ai).reduce((n, x) => n + x.rader.length, 0) + i}
                        locale={locale}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div data-dagantal="" className="ops-contrast-panel flex min-h-24 flex-1 flex-col items-center justify-center rounded-xl bg-contrast-panel text-ink shadow-md">
            <span className="text-titel leading-none tabular-nums">{antal}</span>
            <span className="mt-1 text-mikro uppercase tracking-wide text-ink-secondary">{antal === 1 ? "post" : "poster"}</span>
          </div>
          {onSkapa ? (
            <button
              type="button"
              onClick={onSkapa}
              aria-label={flera ? `Skapa för ${days.length} valda dagar` : `Skapa den ${title}`}
              className="ops-contrast-panel flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-xl bg-contrast-panel text-ink shadow-md hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <PlusIkon size={20} />
              <span className="mt-0.5 text-mikro uppercase tracking-wide">Skapa</span>
            </button>
          ) : null}
        </div>
      </div>
      {/* ⛔ LAGRENS BUBBLA, EN EGEN UNDER RADEN (plats för F6). CP 2026-09-30: "Och det är en separat bubbla för lager." Den
          ritas bara när den har innehåll. */}
      {lager ? (
        <div data-lagerbubbla="" className="ops-contrast-panel rounded-xl bg-contrast-panel p-3 text-ink shadow-md">
          {lager}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Titeln på en extern post som öppnar läspanelen (0.134.0): en knapp som ser ut som `HandelseLank` och täcker hela raden på samma sätt (`::after`), men utan adress.
 *
 * ⛔ EN KNAPP OCH INTE EN LÄNK. En extern händelse har ingen adress att öppna i en ny flik: dess id räknas fram och sparas ingenstans. En `<a>` utan `href` är ingen länk för en
 * skärmläsare, och en `href` som inte leder någonstans ljuger. Raden måste vara `relative`, som för `HandelseLank`.
 * @param {{ onOppna: () => void, children: import("react").ReactNode }} props
 */
function ExternLank({ onOppna, children }) {
  return (
    <button
      type="button"
      data-externlank=""
      onClick={onOppna}
      className="cursor-pointer rounded-sm border-0 bg-transparent p-0 text-left font-semibold text-ink hover:underline focus-visible:outline-none after:absolute after:inset-0 after:cursor-pointer focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
    >
      {children}
    </button>
  );
}

/**
 * Snabbtitten: en dag i en liten inverterad ruta, utan att urvalet ändras (SS `CalendarDayPeekPopover.jsx`).
 *
 * ⛔ DEN VISAR DAGENS ALLA POSTER, OCKSÅ DE FILTRET DÖLJER, MÄRKTA "DOLD" (SS #94). Filtret avgör vad rutnätet ritar,
 * inte vad som finns. Den som filtrerat bort en kalender och undrar om dagen är ledig ska kunna se att den inte är det.
 *
 * ⛔ TRE VÄGAR UT: krysset, Escape och ett tryck utanför.
 *
 * ══ ⛔ ÖVERST I PANELEN, CENTRERAD, OCH INTE EN BUBBLA VID RUTAN (0.73.0, cllp/bolag-ops#568) ══════════
 *
 * CP 2026-10-06, inkorgspost `tAv8ejFHHWVkAzKx6eHv`: "Kände nu när jag testade snabbvyn för kalender att den bubblan med
 * långpress i cellen (ej den vanliga). Att snabb vyn kan ligga längst upp i panelen centrerat." Till 0.70.0 var titten en
 * `fixed` ruta under den tryckta dagen (SS `CalendarDayPeekPopover.jsx`), som täckte rutnätet runt tummen och fick
 * hållas inom fönstret med en egen uträkning. Nu ritas den först i dagpanelens plats, centrerad: under rutnätet på
 * telefon och i kolumnen bredvid från 1024 px. Platsen öppnas för titten också när ingen dag är vald.
 *
 * Förebilden är ett golv och inte ett tak (regel 13): SS-bubblans läge vid rutan tas inte med. Det som tas som det är:
 * innehållet, "Dold" och vägarna ut. Det som stryks: positionsuträkningen (`ankare.x`, `ankare.y`, kläm mot fönstret),
 * som bara fanns för att bubblan flöt. Dagpanelen vid ett vanligt tryck är orörd.
 *
 * @param {{ dayKey: string, alla: import("../lib/calendar.js").CalendarEntry[], synliga: Set<string>, onClose: () => void, locale: string, oppna: ((id: string) => void) | null, oppnaExtern: (e: import("../lib/calendar.js").CalendarEntry) => void }} props
 */
function Snabbtitt({ dayKey, alla, synliga, onClose, locale, oppna, oppnaExtern }) {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
  const rubrikId = useId();
  useEffect(() => {
    /** @param {KeyboardEvent} e */
    const tangent = (e) => {
      if (e.key === "Escape") onClose();
    };
    /** @param {PointerEvent} e */
    const utanfor = (e) => {
      if (ref.current && !ref.current.contains(/** @type {Node} */ (e.target))) onClose();
    };
    window.addEventListener("keydown", tangent);
    window.addEventListener("pointerdown", utanfor);
    return () => {
      window.removeEventListener("keydown", tangent);
      window.removeEventListener("pointerdown", utanfor);
    };
  }, [onClose]);

  return (
    <div data-snabbtitt-plats="" className="flex justify-center p-3 lg:p-0 lg:pb-2">
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={rubrikId}
      data-snabbtitt=""
      className="ops-contrast-panel max-h-75 w-full max-w-70 overflow-y-auto rounded-xl bg-contrast-panel p-2.5 text-ink shadow-xl"
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p id={rubrikId} className="m-0 flex-1 px-0.5 text-liten font-semibold uppercase tracking-wide text-ink-secondary">
          {dateText(dayKey, locale)}
        </p>
        <button type="button" onClick={onClose} aria-label={`Stäng snabbtitten för ${dateText(dayKey, locale)}`} className="shrink-0 cursor-pointer rounded-md p-0.5 text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
          <KryssIkon size={14} />
        </button>
      </div>
      {alla.length === 0 ? <p className="m-0 px-0.5 py-1 text-hjalp text-ink-secondary">Inga poster den här dagen.</p> : null}
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {alla.map((e) => {
          const dold = !synliga.has(e.id);
          return (
            <li key={e.id} data-titt-rad={dold ? "dold" : "synlig"} className={cx("flex items-start gap-2 rounded-md px-1 py-1", ((e.handelseId && oppna) || (!e.handelseId && e.extern)) && "relative", dold && "opacity-50")}>
              <span aria-hidden="true" {...(arPreliminar(e) ? { "data-preliminar": "" } : {})} className={cx("mt-1 size-2 shrink-0 rounded-full", prickklass(e))} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-meta font-semibold">
                  {e.kindIcon ? (
                    <span data-postikon="" aria-hidden="true" className={cx("flex shrink-0 items-center", slagText(e.slag, e.slagLabel, "OpsCalendar") || "text-ink-secondary")}>
                      {e.kindIcon}
                    </span>
                  ) : null}
                  <span className="min-w-0 truncate">
                    {/* ⛔ 0.40.0 (#214): också snabbtittens rad öppnar händelsen. Stäng titten först: urvalet och månaden står kvar, men en titt som
                        ligger öppen när man kommer tillbaka är en ruta man inte bad om. */}
                    {e.handelseId && oppna ? (
                      <HandelseLank id={e.handelseId} oppna={oppna} tacker="after:inset-0">
                        {e.title}
                      </HandelseLank>
                    ) : !e.handelseId && e.extern ? (
                      <ExternLank onOppna={() => oppnaExtern(e)}>{e.title}</ExternLank>
                    ) : (
                      e.title
                    )}
                  </span>
                </span>
                {e.kalender || e.not || e.allDay || arPreliminar(e) ? (
                  <span className="block truncate text-liten text-ink-secondary">{[e.allDay ? "Heldag" : "", arPreliminar(e) ? datumEjSattOrd(locale) : "", e.not || "", e.kalender ? e.kalender.namn : ""].filter(Boolean).join(" · ")}</span>
                ) : null}
              </span>
              {e.atgard ? <span className="relative z-10 shrink-0">{e.atgard}</span> : null}
              {dold ? <span className="shrink-0 rounded-full border border-line px-1.5 text-mikro uppercase tracking-wide">Dold</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
    </div>
  );
}

/**
 * Klassen för en ikonknapp i verktygsraden.
 *
 * ⛔ UNDER 768 PX EN REN IKON, FRÅN 768 EN KANTAD RUTA (0.37.0). CP 2026-09-30 22:30, med en skärmbild ur SS-appen: SS-appen
 * har ikonerna utan ruta till vänster och kalenderväljaren som ett piller till höger; vår 0.36.0 hade fyra kantade rutor
 * till höger. Träffytan är fortfarande 44 px (osynlig), det SYNLIGA är ikonen på 22 px (SS `iconSize.md`). Från 768 px är det
 * SS webb (`CalendarViewToolbar.jsx`, `w-8 h-8` med kant).
 */
const VERKTYG = "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base border border-transparent transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:size-8 [&_svg]:size-5.5 md:[&_svg]:size-3.5";
/** @param {boolean} aktiv */
const verktygsklass = (aktiv) => cx(VERKTYG, aktiv ? "text-accent md:border-accent/40 md:bg-accent-subtle" : "text-ink-muted hover:text-ink-secondary md:border-line md:bg-surface");

/** Högst så många appar står i raden innan resten fälls ihop under "Fler" (#244: "Efter fyra fälls resten ihop"). */
export const APPRAD_SYNLIGA = 4;

/** Avståndet mellan knapparna i raden, `gap-1.5`. Mätningen räknar med det. */
const APPRAD_GAP = 6;

const APPKNAPP =
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-etikett font-medium md:min-h-8 md:px-3 md:text-meta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
/** @param {boolean} synlig */
const appknappKlass = (synlig) =>
  cx(APPKNAPP, synlig ? "border-accent/40 bg-accent-subtle text-ink" : "border-line bg-surface text-ink-muted line-through decoration-ink-muted/60");
const VISA_ALLA = "min-h-11 shrink-0 cursor-pointer whitespace-nowrap px-2 text-meta font-medium text-accent underline-offset-2 hover:underline md:min-h-8";

/**
 * Hur många appar som ryms i raden: så många som får plats, högst `APPRAD_SYNLIGA` och minst en, med Fler och Visa alla
 * inräknade när de ska synas. Ren, så att räkningen går att prova utan webbläsare.
 *
 * @param {{ bredd: number, appar: number[], fler: number, visaAlla: number }} m Bredder i px. `visaAlla` är 0 när inget är dolt.
 * @returns {number}
 */
export function appradRyms({ bredd, appar, fler, visaAlla }) {
  const n = appar.length;
  for (let k = Math.min(APPRAD_SYNLIGA, n); k >= 1; k -= 1) {
    const delar = [...appar.slice(0, k), ...(k < n ? [fler] : []), ...(visaAlla > 0 ? [visaAlla] : [])];
    const summa = delar.reduce((x, y) => x + y, 0) + APPRAD_GAP * (delar.length - 1);
    if (summa <= bredd) return k;
  }
  return 1;
}

/**
 * Appraden under verktygsraden (0.54.0, cllp/ops-framework#244 beslut B och C).
 *
 * ⛔ EN KNAPP PER APP, OCH TRYCKET VÄXLAR. Allt är synligt från början. En dold app står kvar i raden, överstruken, så att
 * den går att få tillbaka med samma tryck och så att en tom dag aldrig kan läsas som "inga händelser" när den egentligen
 * betyder "Ekonomi är dold" (punkt 5).
 *
 * ⛔ RADEN FINNS BARA MED MINST TVÅ APPAR. Med en enda finns inget att välja mellan.
 *
 * ⛔ SÅ MÅNGA SOM RYMS, HÖGST FYRA, RESTEN UNDER "FLER (n)", med en prick när något bland dem är dolt. Första versionen hade fyra fasta
 * och en rad som rullade i sidled: på 390 px klipptes den fjärde knappen och Fler hamnade utanför skärmen, så de dolda
 * apparna gick inte att nå och ingenting visade att raden rullade (`check-skalyta` avsnitt 38). Nu mäts knapparnas bredd i
 * en osynlig kopia av raden och jämförs med radens bredd, och raden rullar aldrig.
 *
 * @param {object} props
 * @param {{ id: string, namn: string }[]} props.appar
 * @param {ReadonlySet<string>} props.dolda
 * @param {(id: string) => void} props.onVaxla
 * @param {() => void} props.onVisaAlla
 */
function Apprad({ appar, dolda, onVaxla, onVisaAlla }) {
  const radRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const matRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [ryms, setRyms] = useState(Math.min(APPRAD_SYNLIGA, appar.length));
  const [visaPlats, setVisaPlats] = useState(true);
  const harDolda = dolda.size > 0;
  useLayoutEffect(() => {
    const rad = radRef.current;
    const mat = matRef.current;
    if (!rad || !mat) return undefined;
    const rakna = () => {
      const bredd = rad.clientWidth;
      // ⛔ jsdom har ingen layout och svarar 0 överallt. Då står förvalet kvar i stället för att raden krymper till en.
      if (bredd <= 0) return;
      const w = (/** @type {Element | null} */ x) => (x ? x.getBoundingClientRect().width : 0);
      const bredder = [...mat.querySelectorAll("[data-mat-app]")].map(w);
      /*
       * ⛔ RÄKNAS UTAN "VISA ALLA", SÅ ATT RADEN INTE BYTER INNEHÅLL NÄR NÅGON DÖLJER EN APP. Första mätningen tog med den,
       * och på 390 px flyttade trycket på Ekonomi in Ekonomi under Fler: knappen man just tryckt på försvann ur raden.
       * Visa alla står i raden bara när allt får plats även med den, annars överst under Fler.
       */
      const k = appradRyms({ bredd, appar: bredder, fler: w(mat.querySelector("[data-mat-fler]")), visaAlla: 0 });
      setRyms(k);
      const allt = bredder.reduce((x, y) => x + y, 0) + w(mat.querySelector("[data-mat-visa]")) + APPRAD_GAP * bredder.length;
      setVisaPlats(k === bredder.length && allt <= bredd);
    };
    rakna();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(rakna);
    ro.observe(rad);
    return () => ro.disconnect();
  }, [appar]);

  const forsta = appar.slice(0, ryms);
  const resten = appar.slice(ryms);
  const doldaIResten = resten.filter((a) => dolda.has(a.id)).length;
  /** @param {{ id: string, namn: string }} a */
  const knapp = (a) => (
    <button key={a.id} type="button" data-app={a.id} aria-pressed={!dolda.has(a.id)} onClick={() => onVaxla(a.id)} className={appknappKlass(!dolda.has(a.id))}>
      {a.namn}
    </button>
  );
  return (
    <div ref={radRef} role="group" aria-label="Appar i kalendern" data-kalender-appar="" className="relative mb-2 flex shrink-0 items-center gap-1.5 overflow-hidden">
      {/* Den osynliga kopian som mäts: alla appar, Fler i sin längsta form och Visa alla. Den tar ingen plats och läses inte upp. */}
      <div ref={matRef} aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 flex gap-1.5">
        {appar.map((a) => (
          <span key={a.id} data-mat-app="" className={appknappKlass(true)}>
            {a.namn}
          </span>
        ))}
        <span data-mat-fler="" className={appknappKlass(true)}>
          <span className="size-1.5 rounded-full" />
          Fler ({appar.length})
          <ChevronNedIkon size={14} />
        </span>
        <span data-mat-visa="" className={VISA_ALLA}>
          Visa alla
        </span>
      </div>
      {forsta.map(knapp)}
      {resten.length > 0 ? (
        <Popover.Root>
          <Popover.Trigger
            data-appar-fler=""
            aria-label={doldaIResten > 0 ? `Fler appar, ${doldaIResten} dolda` : "Fler appar"}
            className={appknappKlass(true)}
          >
            {/* ⛔ PRICKEN SÄGER ATT NÅGOT HÄR ÄR DOLT. Texten hålls lika lång i båda lägena, så att raden inte tappar en app
                när någon döljs bland de undangömda; skärmläsaren får antalet dolda i namnet. */}
            {doldaIResten > 0 ? <span aria-hidden="true" data-fler-dold="" className="size-1.5 rounded-full bg-ink-muted" /> : null}
            Fler ({resten.length})
            <ChevronNedIkon size={14} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="start" sideOffset={6} aria-label="Fler appar" className={cx("z-(--z-dropdown) max-h-[70vh] w-56 overflow-y-auto p-1", radBehallare())}>
              {harDolda ? (
                <button type="button" data-appar-visa-alla="" onClick={onVisaAlla} className={radKlass({ accentFarg: true })}>
                  Visa alla
                </button>
              ) : null}
              {resten.map((a) => (
                <ValRad key={a.id} chosen={!dolda.has(a.id)} onClick={() => onVaxla(a.id)}>
                  {a.namn}
                </ValRad>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : null}
      {harDolda && resten.length === 0 && visaPlats ? (
        <button type="button" data-appar-visa-alla="" onClick={onVisaAlla} className={VISA_ALLA}>
          Visa alla
        </button>
      ) : null}
    </div>
  );
}

/**
 * @typedef {object} KalenderVal
 * @property {string} id
 * @property {string} namn
 * @property {1|2|3|4|5|6} farg
 * @property {boolean} [grupp] Gruppens kalender (annars en av mina).
 * @property {boolean} [forvald] Den som en post utan `kalender` hör till.
 * @property {string} [sektion] (0.134.0) Rubriken kalendern står under i listan Kalendrar, till exempel "Från Mitt konto" eller "Ärenden". Saknas den står en gruppkalender under "Gruppens kalendrar" och
 *   en annan under "Mina kalendrar". Ramverket känner inga sektioner: appen skickar namnet.
 * @property {string} [marke] (0.134.0) En rad text under namnet i listan, appens ord, till exempel "Apple, skrivskyddad". Dekor för den som ser, men läses upp med raden.
 * @property {boolean} [avFranStart] (0.134.0) Kalendern är AV tills personen slår på den (Ärenden). Personens eget val vinner alltid, och ett val som en gång gjorts ligger kvar.
 */

/**
 * Verktygsraden över rutnätet (SS `CalendarViewToolbar.jsx`): Kalendrar, tillgänglighet, veckonummer, typ och status, sök, "+".
 *
 * ⛔ HÖGERSTÄLLD, SOM I SS (`ml-auto`). Rubriken och gruppen står i appens huvud ovanför, och raden är verktyg, inte en
 * rubrik.
 *
 * ⛔ EN KONTROLL FINNS BARA NÄR DEN GÖR NÅGOT. Utan `kalendrar` ingen kalenderväljare, utan typer och statusord inget
 * filter, utan `onSkapa` inget plus, utan `tillganglighet` ingen sådan knapp (punkt 5). Veckonummer och sök kräver ingenting av appen och finns alltid.
 *
 * @param {object} props
 * @param {KalenderVal[] | undefined} props.kalendrar
 * @param {ReturnType<typeof useKalenderSynlighet>} props.syn Vilka kalendrar som syns och hur (0.134.0). Ersätter `valdaKalendrar` ("visa bara").
 * @param {ReadonlyArray<{ namn: string, tomText?: string }> | undefined} props.kalendersektioner
 * @param {(() => void) | undefined} props.onHanteraKalendrar
 * @param {boolean} props.veckonummer
 * @param {() => void} props.onVeckonummer
 * @param {{ id: string, namn: string }[]} props.typer
 * @param {Record<string, string>} props.statusWords
 * @param {string} props.typ
 * @param {(t: string) => void} props.onTyp
 * @param {string} props.status
 * @param {(s: string) => void} props.onStatus
 * @param {boolean} props.sokOppen
 * @param {() => void} props.onSok
 * @param {(() => void) | undefined} props.onSkapa
 * @param {{ pa: boolean, onByt: (pa: boolean) => void } | undefined} props.tillganglighet
 */
function Verktygsrad({ kalendrar, syn, kalendersektioner, onHanteraKalendrar, veckonummer, onVeckonummer, typer, statusWords, typ, onTyp, status, onStatus, sokOppen, onSok, onSkapa, tillganglighet }) {
  const statusar = Object.entries(statusWords);
  const harFilter = typer.length > 0 || statusar.length > 0;
  const synliga = (kalendrar || []).filter((k) => syn.arSynlig(k.id));
  // ⛔ "ALLA KALENDRAR" BETYDER ATT ALLT ÄR SOM DET VAR FRÅN START. En kalender personen slagit av, eller en som är av från start och slagits på, gör
  // att knappen säger vad som syns i stället: namnet om en, annars antalet. Ingen synlig alls heter "Inga kalendrar" och inte "Alla".
  const etikett = syn.arForval ? "Alla kalendrar" : synliga.length === 0 ? "Inga kalendrar" : synliga.length === 1 ? synliga[0].namn : `${synliga.length} kalendrar`;

  return (
    <div role="toolbar" aria-label="Kalenderverktyg" data-kalender-verktyg="" className="flex shrink-0 items-center gap-1.5 pb-2 max-md:gap-0 md:justify-end">
      {kalendrar ? (
        <Popover.Root>
          <Popover.Trigger
            aria-label={`Kalendrar: ${etikett}`}
            data-kalenderval=""
            className={cx(
              // ⛔ Under 768 px SS-appens piller till höger (rundat helt, text och ikon), från 768 SS webb.
              "inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-1.5 border px-2 text-meta font-medium text-ink md:min-h-8 md:rounded-base",
              "max-md:order-last max-md:ml-auto max-md:rounded-full max-md:px-3.5 max-md:text-etikett",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              !syn.arForval ? "border-accent/40 bg-accent-subtle" : "border-line-strong bg-raised hover:border-ink-muted md:border-line md:bg-surface md:hover:border-line-strong",
            )}
          >
            <span aria-hidden="true" className="flex text-ink-muted">
              <KalenderIkon size={16} />
            </span>
            <span className="max-w-40 truncate">{etikett}</span>
            <ChevronNedIkon size={14} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={6} aria-label="Kalendrar" className={cx("z-(--z-dropdown) max-h-[70vh] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto p-1", radBehallare())}>
              {/* ⛔ LISTAN ÄR EN KOMPONENT (0.134.0, cllp/lifehub.app#402): en rad per kalender med en växel, sektioner som appen namnger, och visningen under raden.
                  Till 0.133.0 stod här "visa bara"-rader, och 0.84.0:s regel om att en rubrik bara ritas med något under bor nu i `OpsKalenderLista`.
                  ⛔ GRUPPEN ÄR KALENDERN (0.120.0, cllp/lifehub.app#367): händelser utan kalenderId hör till gruppen och ingen rad styr dem (`filtreraPoster`). */}
              <OpsKalenderLista
                kalendrar={kalendrar}
                syn={syn}
                sektioner={kalendersektioner}
                efter={
                  /* ⛔ 0.37.0 (#179 F2): "Hantera kalendrar" ÖPPNAR `OpsKalendrar`. Utan `onHanteraKalendrar` ritas ingen rad alls: en kontroll finns bara när den
                     gör något, och en app som inte låter någon hantera kalendrar här har inget löfte att ge. */
                  onHanteraKalendrar ? (
                    <div className="mt-2 border-t border-line pt-1">
                      <Popover.Close asChild>
                        <button type="button" data-hantera-kalendrar="" onClick={onHanteraKalendrar} className={radKlass({ accentFarg: true })}>
                          Hantera kalendrar
                        </button>
                      </Popover.Close>
                    </div>
                  ) : null
                }
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : null}

      {/* ⛔ TILLGÄNGLIGHET (0.61.0, #259). Under 768 px först i raden, som SS-appen (`calendar.js:1015`, före sök); från 768
          efter kalenderväljaren, som SS webb (`CalendarViewToolbar.jsx:203-229`, källfiltret först). Aktiv: fara-tonad yta och
          ikonen i fara-färg (SS-appen `colors.danger` med 20 procent, SS webb `--color-action-remove` med 14). */}
      {tillganglighet ? (
        <button
          type="button"
          data-verktyg-tillganglighet=""
          aria-pressed={tillganglighet.pa}
          aria-label="Tillgänglighet"
          onClick={() => tillganglighet.onByt(!tillganglighet.pa)}
          className={cx(VERKTYG, "max-md:order-first", tillganglighet.pa ? "bg-danger/20 text-danger md:border-danger md:bg-danger/14" : "text-ink-muted hover:text-ink-secondary md:border-line md:bg-surface")}
        >
          <TillganglighetIkon size={14} />
        </button>
      ) : null}

      <button type="button" aria-pressed={veckonummer} aria-label="Veckonummer" onClick={onVeckonummer} className={verktygsklass(veckonummer)}>
        <VeckonummerIkon size={14} />
      </button>

      {harFilter ? (
        <Popover.Root>
          <Popover.Trigger aria-label={typ !== "alla" || status !== "alla" ? "Typ och status, filtrerat" : "Typ och status"} aria-pressed={typ !== "alla" || status !== "alla"} className={verktygsklass(typ !== "alla" || status !== "alla")}>
            <ReglageIkon size={14} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={6} aria-label="Typ och status" className={cx("z-(--z-dropdown) max-h-[70vh] w-56 overflow-y-auto p-1", radBehallare())}>
              {typer.length > 0 ? (
                <div className="flex flex-col">
                  <p className={radRubrikKlass}>Typ</p>
                  <ValRad chosen={typ === "alla"} onClick={() => onTyp("alla")}>
                    Alla typer
                  </ValRad>
                  {typer.map((t) => (
                    <ValRad key={t.id} chosen={typ === t.id} onClick={() => onTyp(t.id)}>
                      {t.namn}
                    </ValRad>
                  ))}
                </div>
              ) : null}
              {statusar.length > 0 ? (
                <div className={cx("flex flex-col", typer.length > 0 && "mt-1 border-t border-line pt-2")}>
                  <p className={radRubrikKlass}>Status</p>
                  <ValRad chosen={status === "alla"} onClick={() => onStatus("alla")}>
                    Alla statusar
                  </ValRad>
                  {statusar.map(([k, ord]) => (
                    <ValRad key={k} chosen={status === k} onClick={() => onStatus(k)}>
                      {ord}
                    </ValRad>
                  ))}
                </div>
              ) : null}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : null}

      <button type="button" aria-expanded={sokOppen} aria-label="Sök i kalendern" onClick={onSok} className={cx(verktygsklass(sokOppen), "max-md:order-first")}>
        <SokIkon size={14} />
      </button>

      {onSkapa ? (
        // ⛔ Inget "+" i raden under 768 px, som SS-appen: där finns skalets plus i bottenraden och dagpanelens Skapa.
        <button type="button" aria-label="Skapa" onClick={onSkapa} className={cx(VERKTYG, "text-accent hover:bg-accent-faint max-md:hidden md:border-line md:bg-surface")}>
          <PlusIkon size={16} />
        </button>
      ) : null}
    </div>
  );
}

/** Höjden på ett band och luften mellan två filer, i px (SS `SPAN_CHIP_PX = 24` och `gap-0.5`). */
const BANDHOJD = 20;
const BANDLUFT = 2;

/**
 * Höjden i px som en dagsruta reserverar under siffran för sina `filer` band-filer, 0 för en ruta utan band (0.106.0).
 * @param {number} filer @returns {number}
 */
function bandplats(filer) {
  return filer > 0 ? filer * BANDHOJD + (filer - 1) * BANDLUFT + 4 : 0;
}

/**
 * Hur långt in från rutans kant ett bands rundade ände börjar, i px: rutans kant (1) och dess luft (`sm:p-2`, 8), alltså samma
 * kant som pillren inne i rutan. En ände som fortsätter i nästa eller förra veckan står 1 px in, precis innanför rutans kant.
 *
 * ⛔ ETT BAND LIGGER INNANFÖR RUTAN, INTE ÖVER DESS KANT (0.106.0, CP 2026-10-14: "Test går ut över rutans högra kant"). Bandet ritas
 * som ett överlägg över hela veckoraden och fyllde förut kolumnens hela bredd: ett band på en enda dag täckte rutans kant på båda
 * sidor och såg ut att rinna ut ur rutan, där pillren på dagarna bredvid står 9 px in.
 */
const BANDKANT_AVSLUT = 9;
const BANDKANT_FORTSATTER = 1;

/**
 * Banden över en veckorad: flerdagsposter och heldag (SS `MonthGrid.jsx:186-294`).
 *
 * ⛔ DEKOR FÖR DEN SOM SER, OCH `pointer-events-none`. Posten räknas i varje dagsrutas knappnamn och står i dagpanelen,
 * så bandet är inte den enda vägen till den. Ett tryck på bandet går igenom till rutan under, alltså väljer det dagen
 * man tryckte på.
 *
 * ⛔ TITELN STÅR I VARJE VECKA, inte bara den första (SS #2730 S7): en semester som börjar i förra veckan ska gå att
 * läsa i den här utan att rulla upp.
 *
 * @param {{ bitar: import("../lib/calendar.js").Bandbit[], veckonummer: boolean }} props
 */
function Band({ bitar, veckonummer }) {
  if (bitar.length === 0) return null;
  return (
    <div
      aria-hidden="true"
      data-band=""
      className={cx("pointer-events-none absolute inset-x-0 z-20 hidden sm:grid gap-1 sm:gap-1.5", veckonummer ? "grid-cols-[2rem_repeat(7,minmax(0,1fr))]" : "grid-cols-7")}
      style={{ top: "var(--ops-bandtopp)" }}
    >
      {veckonummer ? <div /> : null}
      <div className="col-span-7 grid grid-cols-7 gap-x-1 sm:gap-x-1.5" style={{ rowGap: BANDLUFT, gridAutoRows: BANDHOJD }}>
        {bitar.map((b) => (
          <span
            key={`${b.entry.id}-${b.startCol}`}
            data-bandbit={b.entry.id}
            style={{ gridColumn: `${b.startCol + 1} / span ${b.colSpan}`, gridRow: b.fil + 1, marginLeft: b.borjar ? BANDKANT_AVSLUT : BANDKANT_FORTSATTER, marginRight: b.slutar ? BANDKANT_AVSLUT : BANDKANT_FORTSATTER }}
            className={cx(
              "relative isolate flex min-w-0 items-center truncate bg-surface px-1.5 text-liten text-ink",
              b.borjar ? cx("rounded-l-md border-l-3", postklasser(b.entry).kant) : "",
              b.slutar ? "rounded-r-md" : "",
            )}
          >
            {/* ⛔ BANDET HAR EN EGEN, OGENOMSKINLIG YTA (0.120.0, cllp/lifehub.app#367). Tonen (20 procent) låg direkt över rutan under, och
                en vald ruta är INVERTERAD (`ops-contrast-panel`): ljus text på mörk ruta i ljust tema, mörk text på ljus ruta i mörkt. Bandet
                ligger utanför rutan i trädet och ärvde sidans textfärg, alltså sidans text på den inverterade ytan: 1,13:1 i mörkt tema och
                1,18:1 i ljust (räknat ur tokens, mätt i en webbläsare i `check-skalyta` avsnitt 49). Nu är underlaget alltid sidans yta
                (`bg-surface`) med tonen ovanpå, och `text-ink` mäts mot en känd färg oavsett vad som ligger under. */}
            <span aria-hidden="true" data-bandton="" className={cx("pointer-events-none absolute inset-0 rounded-[inherit]", postklasser(b.entry).ton)} />
            <span className="relative truncate">{b.entry.title}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Avståndet mellan rutorna under 640 px, `gap-1`, och veckonumrets kolumn, `2rem` (`gridKlass`). */
const RUTNAT_GAP = 4;
const VECKOKOLUMN = 32;

/**
 * Rullytans marginal på var sida under 640 px, som CSS: lika stor som brickans överhäng i rutans högerkant.
 *
 * Överhänget är o = max(MINSTA, GRANS - c) (`OpsCalendarDagruta`), och rutbredden c = (R - 2p - G) / 7, där R är rullytans bredd,
 * p marginalen och G mellanrummen plus veckonumrets kolumn. Med p = o och o över minsta ger det p = (7 x GRANS + G - R) / 5.
 * Mätt i granskningen av PR 260 innan det härleddes: en fast marginal på 7 px klippte brickan 4,6 px vid 320 och 1,7 px vid 340
 * med veckonumren på, och redan vid 310 utan dem.
 * @param {boolean} veckonummer
 * @returns {string}
 */
export function kantluft(veckonummer) {
  const kolumner = 7;
  const g = (veckonummer ? kolumner : kolumner - 1) * RUTNAT_GAP + (veckonummer ? VECKOKOLUMN : 0);
  return `max(${BRICKA_MINSTA_OVERHANG}px, calc((${kolumner * BRICKA_GRANS + g}px - 100%) / ${kolumner - 2}))`;
}

/** Nyckeln veckonumrens val sparas under, per enhet. */
export const VECKONUMMER_NYCKEL = "ops-kalender-veckonummer";

/**
 * @param {object} props
 * @param {import("../lib/calendar.js").CalendarEntry[]} props.entries Daterade poster. Odaterat hör inte hemma här.
 * @param {string} props.ariaLabel ⛔ Krävs: ett rutnät med tal är osynligt för den som inte ser det.
 * @param {Record<string, string>} [props.statusWords] Appens ord per status, som i `OpsEventList`. Är de fler än noll
 *   finns statusfiltret i verktygsraden.
 *   ⛔ Ramverket äger färgerna och appen orden: bara appen vet vad `waiting` betyder hos just den.
 * @param {number} [props.monthsBack] Förval 12 sedan 0.36.0 (SS `monthsBefore = 12`). Till 0.35.0 stod här "Inte tolv:
 *   en bolagskalender har få poster bakåt". CP:s beställning i #179 är SS kalender, och SS visar ett år bakåt.
 * @param {number} [props.monthsForward] Förval 12 (SS `monthsToShow={12}`). Läs appens fönster med `kalenderfonster`
 *   med samma två tal, så att det som ritas och det som läses är samma sak.
 * @param {Date} [props.today] Bara för prov. Produktionen har en klocka.
 * @param {import("react").ReactNode} [props.emptyText] Vad som står när ingen post har datum.
 * @param {string} [props.locale] BCP-47, standard `sv-SE`. Styr månads- och veckodagsnamn, inget annat.
 *   ⛔ Rutnätet är måndagsbaserat oavsett språk. Se `weekdayNames` i `src/lib/calendar.js`.
 * @param {string} [props.tidszon] IANA-zon, förval `STANDARD_TIDSZON` (Europe/Stockholm). Avgör vilken dag som är idag.
 *   ⛔ En inställning och inte en konstant (#179): en kund i en annan zon ska inte kräva en ny version.
 * @param {KalenderVal[]} [props.kalendrar] Den aktiva gruppens kalendrar (`grupp: true`) och mina. Finns listan finns
 *   listan Kalendrar (0.134.0, cllp/lifehub.app#402): en rad per kalender med färgprick, namn, en `OpsSwitch` för om den syns och en utfällning för
 *   visningen Händelser, Ram eller Båda. En post utan `kalender` hör till den förvalda. ⛔ Till 0.133.0 betydde ett tryck "visa bara denna" och valet sparades
 *   inte; nu slår ett tryck AV kalendern (och på igen), och den som ville se en enda kalender slår av de andra.
 * @param {string} [props.kalenderMinne] (0.134.0) Vem och vilken grupp valet gäller, appens val (`${person}:${grupp}`). Valet (vilka kalendrar som syns och hur) sparas under
 *   `kalenderSynlighetNyckel(kalenderMinne)` i `lagring`, ändras i samma tryck och sparas efteråt: ingenting väntar på att det sparas, och ingenting hämtas om.
 *   ⛔ Ramverket känner inga id:n. Utan `kalenderMinne` gäller valet bara den här visningen.
 * @param {ReadonlyArray<{ namn: string, tomText?: string }>} [props.kalendersektioner] (0.134.0) Sektionernas ordning och vad som står i en sektion utan kalendrar ("Du har inga kalendrar från Mitt konto
 *   ännu."). Utan den: "Gruppens kalendrar" (bara med rader) och "Mina kalendrar", sedan övriga i den ordning raderna kommer. En sektion utan rader och utan `tomText` ritas inte.
 * @param {(ids: string[]) => void} [props.onSynligaKalendrar] (0.134.0) Id:n på kalendrarna som syns, i listans ordning, en gång vid start och varje gång mängden ändras. För en vy
 *   som ska följa samma val (Idag) utan en egen lagring. En vy som inte är monterad samtidigt läser i stället samma minne med `useKalenderSynlighet({ minne, kalendrar })`.
 * @param {ReadonlyArray<{ id: string, namn: string, farg?: 1|2|3|4|5|6 }>} [props.kopieraTill] (0.134.0) Kalendrarna personen får skapa i, för "Kopiera till…" i läspanelen för en
 *   extern händelse (`CalendarEntry.extern`). Appen skickar samma lista till `OpsHandelsePanel kopieraTill` för sina egna händelser.
 * @param {(arg: { handelse: import("./OpsHandelsePanel.jsx").HandelseVy, malKalenderId: string }) => void | Promise<void>} [props.onKopiera] (0.134.0) Anropas när personen valt en
 *   kalender. ⛔ Ramverket öppnar inget formulär: appen öppnar Ny händelse ifylld eller skapar kopian.
 * @param {{ id: string, namn: string, modulNamn?: string }[]} [props.typer] Typerna i typfiltret. Jämförs med postens `typ`.
 *   `modulNamn` (0.54.0) är modulens namn för ett bidrag (`modul:id`), och blir appens namn i appraden. Utan den står
 *   modulens id.
 * @param {(datum: string[]) => void} [props.onSkapa] "+" i verktygsraden och skapa-rutan i dagpanelen. Får de valda
 *   dagarna, eller idag när ingen är vald.
 * @param {() => void} [props.onHanteraKalendrar] Raden "Hantera kalendrar" längst ned i kalenderväljaren (0.37.0, #179 F2):
 *   appen visar `OpsKalendrar`. Utan den ritas ingen rad (till 0.36.0 en rad som sade att den kom i F2).
 * @param {(dayKey: string) => import("./OpsCalendarDagruta.jsx").Dagdekor | undefined} [props.dagdekor] (0.37.0, typad 0.61.0) Per dag
 *   en ton, en ram i lagrets färg och antalen för hörnbrickorna (`borta`, `lager`), som SS lager och tillgänglighet. Rutan ritar
 *   brickorna själv; appen avgör vad som returneras när `tillganglighet` är på.
 * @param {{ pa: boolean, onByt: (pa: boolean) => void }} [props.tillganglighet] (0.61.0, #259) Knappen för tillgänglighetsläget i
 *   verktygsraden (SS `UsersRound`). Ritas bara när propen finns.
 * @param {never} [props.lager] Borttagen i 0.134.0 (cllp/lifehub.app#402) och KASTAR om den skickas. Kalenderlagren finns inte längre: en kalender (också Ärenden) är en rad i `kalendrar`
 *   med `sektion`, `marke` och `avFranStart`, och valet sparas i `kalenderMinne`. Ett tyst ignorerande hade dolt en app som inte flyttat sina sparade val.
 * @param {(dayKeys: string[]) => import("react").ReactNode} [props.daglager] (0.37.0) Innehållet i dagpanelens egen lagerbubbla
 *   under posterna (SS-appen). `null` ritar ingen bubbla. Platsen för F6.
 * @param {(id: string) => void} [props.onOppnaHandelse] (0.40.0, #214) Vad ett tryck på en post med `handelseId` gör, i dagpanelen och snabbtitten. Utelämnad:
 *   skalets händelsepanel (`OpsAppShell` `handelsepanel`). ⛔ Finns varken propen eller ett skal med panel kastar kalendern för en post med `handelseId`.
 *   Kalenderns urval (valda dagar), månaden och filtret ligger kvar i kalendern, som skalet håller monterad men dold medan panelen visas: Tillbaka
 *   återställer dem.
 * @param {string} [props.filterMinne] (0.54.0, #244) Var personens dolda appar sparas, vanligen gruppens id: valet minns per
 *   grupp. ⛔ Ramverket känner inte gruppen, så appen säger vad som skiljer. Utelämnad: valet gäller bara den här visningen.
 * @param {{ getItem: (n: string) => string | null, setItem: (n: string, v: string) => void }} [props.lagring] Var
 *   veckonummervalet sparas, per enhet. Förval `window.localStorage` när den finns.
 * @param {(manader: { forsta: string, sista: string }) => void} [props.onSynligaManader] (0.74.0, #284) Vilka månader som syns,
 *   som `YYYY-MM`, när rullningen har stannat (`SYNLIGA_MANADER_VILA_MS`) och en gång vid start. Aldrig medan rullningen pågår, och
 *   bara när intervallet ändrats. För en app som hämtar data för det synliga fönstret, så att den inte läser kalenderns DOM.
 */
export function OpsCalendar({
  entries = [],
  ariaLabel,
  statusWords = {},
  monthsBack = 12,
  monthsForward = 12,
  today,
  emptyText,
  locale = DEFAULT_LOCALE,
  tidszon = STANDARD_TIDSZON,
  kalendrar,
  kalenderMinne,
  kalendersektioner,
  onSynligaKalendrar,
  kopieraTill,
  onKopiera,
  typer = [],
  onSkapa,
  onHanteraKalendrar,
  dagdekor,
  daglager,
  tillganglighet,
  lager: lagerlage,
  lagring,
  onOppnaHandelse,
  filterMinne,
  onSynligaManader,
}) {
  if (!ariaLabel) {
    throw new Error("OpsCalendar: ariaLabel krävs. Ett rutnät med tal är osynligt för den som inte ser det.");
  }
  // ⛔ `lager` KASTAR (0.134.0, cllp/lifehub.app#402), och ignoreras inte tyst. CP 2026-10-21: lagren försvinner helt ur kalendern, och Ärenden blir en rad i listan Kalendrar. En app som
  // fortfarande skickar `lager` har inte flyttat sina kalendrar och sina sparade val, och att tyst strunta i propen hade visat en kalender utan lager som om inget saknades (punkt 5).
  if (lagerlage !== undefined && lagerlage !== null) {
    throw new Error(
      "OpsCalendar: propen `lager` är borttagen i 0.134.0 (cllp/lifehub.app#402). Skicka kalendrarna, också Ärenden, som rader i `kalendrar` med `sektion`, `marke` och `avFranStart`, och `kalenderMinne` för valet (vilka som syns och hur: Händelser, Ram eller Båda). Sparade val flyttas av appen, se CHANGELOG 0.134.0.",
    );
  }
  const zon = useMemo(() => kontrolleraTidszon(tidszon), [tidszon]);
  const oppnaHandelse = useHandelseOppnare(onOppnaHandelse);
  if (!oppnaHandelse && entries.some((e) => e && e.handelseId)) {
    throw new Error(
      "OpsCalendar: poster har handelseId men det finns ingenting som öppnar en händelse. Skicka `handelsepanel` till OpsAppShell, eller `onOppnaHandelse` till kalendern. En post som ser tryckbar ut och inte gör något lär den som tryckt att inget i dagpanelen gör något.",
    );
  }

  // ⛔ EN EXTERN POST UTAN KÄLLRAD KASTAS (0.134.0). Läspanelen säger var händelsen hör hemma och att den inte ändras här, med appens ord. Utan `kalla` hade den visat en
  // händelse som ser ut att kunna ändras, och den som försöker lär sig att inget fungerar (punkt 5: en tyst nedsläppsväg ser ut som att allt gick bra).
  const utanKalla = entries.find((e) => e && e.extern && !(typeof e.extern.kalla === "string" && e.extern.kalla.trim()));
  if (utanKalla) {
    throw new Error(`OpsCalendar: posten "${utanKalla.id}" har extern men ingen extern.kalla. Källraden ("Från Apple, ändras i Apple") är appens ord och krävs: läspanelen ska säga var händelsen hör hemma.`);
  }

  // ⛔ ETT FÖRSLAG ÄR EN DAG (0.127.0, `CalendarEntry.preliminar`): en preliminär post med `endDate` eller `allDay` hade ritats som ett band, alltså som en händelse
  // som redan har ett spann. Det kastas hellre än rättas tyst (punkt 5).
  const brottPreliminar = preliminarFel(entries);
  if (brottPreliminar) {
    throw new Error(
      `OpsCalendar: posten "${brottPreliminar.id}" är preliminär (ett förslag på dag för en händelse utan datum) men har endDate eller allDay. Ett förslag är en dag: skicka en post per föreslagen dag och lämna spannet.`,
    );
  }

  const nu = today || new Date();
  const todayDayKey = idagI(zon, nu);
  const idagManad = todayDayKey.slice(0, 7);
  /*
   * ⛔ FLERA VALDA DAGAR, OCH DÄRFÖR EN LISTA OCH INTE ETT VÄRDE. CP 2026-09-22:
   * "jag kan markera flera". Ett enda `chosen` hade gjort varje nytt tryck till ett
   * byte i stället för ett tillägg, alltså exakt det man inte vill när man
   * jämför två dagar med varandra.
   *
   * ⛔ EN ARRAY OCH INTE ETT `Set`. React jämför med identitet, och ett `Set`
   * som muteras på plats ger samma referens tillbaka, alltså ingen omrendering.
   * Det felet ser ut som att knappen inte fungerar.
   */
  const [chosen, setValda] = useState(/** @type {string[]} */ ([]));
  const [typ, setTyp] = useState("alla");
  const [status, setStatus] = useState("alla");
  const [sokOppen, setSokOppen] = useState(false);
  const [fraga, setFraga] = useState("");
  const [titt, setTitt] = useState(/** @type {string | null} */ (null));
  // Läspanelens post, som id: öppen post slås upp i `entries` varje gång, så att en `kopierad` appen skickar efter en kopia syns utan att panelen stängs. Försvinner posten stängs panelen.
  const [externId, setExternId] = useState(/** @type {string | null} */ (null));
  const externPost = useMemo(() => (externId ? entries.find((e) => e && e.id === externId && e.extern) ?? null : null), [externId, entries]);
  const oppnaExtern = useCallback((/** @type {import("../lib/calendar.js").CalendarEntry} */ e) => {
    setTitt(null);
    setExternId(e.id);
  }, []);

  const lagringen = lagring || (typeof window !== "undefined" ? window.localStorage : undefined);

  /*
   * ══ ⛔ KALENDRARNA SOM EN LISTA, ETT MINNE (0.134.0, cllp/lifehub.app#402) ═══════════════════════════════════════════════
   *
   * `syn` är vilka kalendrar som syns och hur de visas, och det är det ENDA som avgör det. Ett tryck ändrar tillståndet i samma tryck och filtret
   * nedan läser det som redan är laddat (`entries`): ingenting hämtas om, och ingenting väntar på att valet sparas (se `useKalenderSynlighet`).
   * `onSynligaKalendrar` får id:n som syns, så att en annan vy (Idag) kan följa samma val utan en egen lagring.
   */
  const syn = useKalenderSynlighet({ minne: kalenderMinne, kalendrar, lagring: lagringen, onSynliga: onSynligaKalendrar });
  const doldaKalendrar = useMemo(() => {
    const syns = new Set(syn.synliga);
    return (kalendrar || []).filter((k) => !syns.has(k.id)).map((k) => k.id);
  }, [kalendrar, syn.synliga]);
  const minnesnyckel = filterMinne ? appfilterNyckel(filterMinne) : "";
  const [doldaAppar, setDoldaAppar] = useState(() => {
    if (!minnesnyckel || !lagringen) return /** @type {string[]} */ ([]);
    try {
      return lasDoldaAppar(lagringen.getItem(minnesnyckel));
    } catch (fel) {
      rapporteraFel(fel, { yta: "OpsCalendar", steg: "läsa dolda appar" });
      return [];
    }
  });
  /*
   * ⛔ BYTER APPEN GRUPP LÄSES VALET OM. `filterMinne` är gruppens id, och samma monterade kalender visar en annan grupp
   * när personen byter. Utan omläsningen hade den förra gruppens dolda appar följt med.
   */
  const lastNyckel = useRef(minnesnyckel);
  useEffect(() => {
    if (lastNyckel.current === minnesnyckel) return;
    lastNyckel.current = minnesnyckel;
    try {
      setDoldaAppar(minnesnyckel && lagringen ? lasDoldaAppar(lagringen.getItem(minnesnyckel)) : []);
    } catch (fel) {
      rapporteraFel(fel, { yta: "OpsCalendar", steg: "läsa dolda appar" });
      setDoldaAppar([]);
    }
  }, [minnesnyckel, lagringen]);
  const sparaDolda = useCallback(
    (/** @type {string[]} */ nasta) => {
      setDoldaAppar(nasta);
      if (!minnesnyckel) return;
      try {
        lagringen?.setItem(minnesnyckel, JSON.stringify(nasta));
      } catch (fel) {
        rapporteraFel(fel, { yta: "OpsCalendar", steg: "spara dolda appar" });
      }
    },
    [lagringen, minnesnyckel],
  );
  const appar = useMemo(() => apparFor(typer, entries), [typer, entries]);
  const doldaSet = useMemo(() => new Set(doldaAppar), [doldaAppar]);
  /*
   * ⛔ TYPLISTAN VISAR BARA DE SYNLIGA APPARNAS TYPER (beslut B: App är nivån ovanför typ). Och en vald typ vars app döljs
   * släpps till "alla": annars hade filtret visat noll poster med en typ vald som inte längre syns i listan, och ingen
   * hade kunnat se varför.
   */
  const synligaTyper = useMemo(() => typer.filter((t) => !doldaSet.has(appForTyp(t.id))), [typer, doldaSet]);
  const vaxlaApp = useCallback(
    (/** @type {string} */ id) => {
      const dold = doldaSet.has(id);
      const nasta = dold ? doldaAppar.filter((x) => x !== id) : [...doldaAppar, id];
      if (!dold && typ !== "alla" && appForTyp(typ) === id) setTyp("alla");
      sparaDolda(nasta);
    },
    [doldaSet, doldaAppar, sparaDolda, typ],
  );

  const [veckonummer, setVeckonummer] = useState(() => {
    try {
      return lagringen ? lagringen.getItem(VECKONUMMER_NYCKEL) === "1" : false;
    } catch (fel) {
      // ⛔ INTE TYST (punkt 5): privat läge kastar, och valet fungerar då bara i den här visningen. Det loggas.
      rapporteraFel(fel, { yta: "OpsCalendar", steg: "läsa veckonummer" });
      return false;
    }
  });
  const vaxlaVeckonummer = useCallback(() => {
    setVeckonummer((f) => {
      const n = !f;
      try {
        lagringen?.setItem(VECKONUMMER_NYCKEL, n ? "1" : "0");
      } catch (fel) {
        rapporteraFel(fel, { yta: "OpsCalendar", steg: "spara veckonummer" });
      }
      return n;
    });
  }, [lagringen]);

  /*
   * ⛔ FILTRET AVGÖR VAD SOM RITAS, INTE VAD SOM FINNS. `synliga` är det rutnätet, banden och dagpanelen ritar, och
   * snabbtitten visar resten märkt "Dold".
   */
  const forvaldId = useMemo(() => forvaldKalenderId(kalendrar), [kalendrar]);
  const minaId = useMemo(() => new Set((kalendrar || []).filter((k) => !k.grupp).map((k) => k.id)), [kalendrar]);
  const arMin = useCallback((/** @type {import("../lib/calendar.js").CalendarEntry} */ e) => !!e.kalender && minaId.has(e.kalender.id), [minaId]);
  const synligaPoster = useMemo(() => filtreraPoster(entries, { doldaKalendrar, forvaldId, typ, status, doldaAppar }), [entries, doldaKalendrar, forvaldId, typ, status, doldaAppar]);
  const synligaId = useMemo(() => new Set(synligaPoster.map((e) => e.id)), [synligaPoster]);
  const byKey = useMemo(() => perDay(synligaPoster), [synligaPoster]);

  /*
   * ══ ⛔ VISNING PER KALENDER: HÄNDELSER, RAM ELLER BÅDA (0.134.0) ══════════════════════════════════════════════════════
   *
   * Ram ritar dagens ram i kalenderns färg (`Dagdekor.ram`, samma ram som lagren hade) och inga märken. Båda ritar både och. Det ersätter lagret som
   * en SORTS KALENDER: ramen är ett val per kalender och inte en andra lista. ⛔ DAGPANELEN OCH SNABBTITTEN VISAR POSTERNA ÄVEN FÖR EN KALENDER SOM BARA
   * HAR RAM: ramen säger att något ligger på dagen, och ett tryck på dagen ska svara vad. Bara RUTNÄTET (märken, streck, band) hoppar över dem.
   * Posten räknas fortfarande i dagrutans namn ("12, 2 poster"), eftersom den finns.
   */
  const visningAv = useCallback(
    (/** @type {import("../lib/calendar.js").CalendarEntry} */ e) => {
      const id = e.kalender ? e.kalender.id : forvaldId;
      return (id && syn.visningar[id]) || "handelser";
    },
    [forvaldId, syn.visningar],
  );
  const rutPoster = useMemo(() => (Object.keys(syn.visningar).length === 0 ? synligaPoster : synligaPoster.filter((e) => visningAv(e) !== "ram")), [synligaPoster, syn.visningar, visningAv]);
  const rutaPerDag = useMemo(() => (rutPoster === synligaPoster ? byKey : perDay(rutPoster)), [rutPoster, synligaPoster, byKey]);
  /** @type {Map<string, 1|2|3|4|5|6>} Dagens ram: tonen på den första kalendern i listan som har en post med Ram eller Båda den dagen. */
  const ramDagar = useMemo(() => {
    /** @type {Map<string, 1|2|3|4|5|6>} */
    const dagar = new Map();
    if (Object.keys(syn.visningar).length === 0) return dagar;
    const rader = new Map((kalendrar || []).map((k, i) => [k.id, { k, plats: i }]));
    /** @type {Map<string, number>} */
    const basta = new Map();
    for (const e of synligaPoster) {
      const v = visningAv(e);
      if (v !== "ram" && v !== "bada") continue;
      const id = e.kalender ? e.kalender.id : forvaldId;
      const rad = rader.get(id);
      const kalla = rad ? rad.k : e.kalender;
      if (!kalla) continue;
      const plats = rad ? rad.plats : Number.MAX_SAFE_INTEGER;
      for (const dag of perDay([e]).keys()) {
        const tidigare = basta.get(dag);
        if (tidigare === undefined || plats < tidigare) {
          basta.set(dag, plats);
          dagar.set(dag, lagerFarg(kalla));
        }
      }
    }
    return dagar;
  }, [synligaPoster, visningAv, kalendrar, forvaldId, syn.visningar]);
  const allaPerDag = useMemo(() => perDay(entries), [entries]);
  const list = useMemo(() => months(franNyckel(todayDayKey), monthsBack, monthsForward), [todayDayKey, monthsBack, monthsForward]);
  const sokning = fraga.trim();
  const traffDagar = useMemo(() => {
    if (!sokning) return null;
    /** @type {Set<string>} */
    const s = new Set();
    for (const [dag, poster] of byKey) if (poster.some((e) => traffar(e, sokning))) s.add(dag);
    return s;
  }, [byKey, sokning]);

  const rulleRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const huvudRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const todayRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [showBack, setShowBack] = useState(false);
  const [direction, setDirection] = useState(/** @type {"upp" | "ner"} */ ("upp"));

  /**
   * Rullar behållaren till innevarande månad.
   *
   * ⛔ `scrollTop` OCH INTE `scrollIntoView`. Den senare rullar ALLA rullbara
   * förfäder, alltså också sidan, och då gör den vid montering precis det CP bad
   * att slippa: hela vyn hoppar.
   *
   * ⛔ VECKODAGSRADENS HÖJD DRAS BORT. Raden är klistrad överst i behållaren, så
   * en rullning till månadens exakta överkant lägger månadsrubriken UNDER den.
   */
  const toToday = useCallback((/** @type {ScrollBehavior} */ beteende = "auto") => {
    const rulle = rulleRef.current;
    const month = todayRef.current;
    if (!rulle || !month) return;
    const header = huvudRef.current ? huvudRef.current.offsetHeight : 0;
    rulle.scrollTo({ top: Math.max(0, month.offsetTop - header), behavior: beteende });
  }, []);

  /*
   * ⛔ ETT HOPP UTAN ANIMERING VID MONTERING, EN GÅNG. Med ett år bakåt ligger innevarande månad långt ner i rullen, och
   * utan hoppet öppnar kalendern på en månad som passerat. `didRef` gör att det inte sker igen när posterna uppdateras.
   */
  const didRef = useRef(false);
  useEffect(() => {
    if (didRef.current) return;
    didRef.current = true;
    toToday();
  }, [toToday]);

  /*
   * ══ ⛔ VILKA MÅNADER SOM SYNS, NÄR RULLNINGEN HAR STANNAT (0.74.0, #284) ══════════════════════════════════════════════
   *
   * lifehub.app läste `data-kalender-rulle` och `data-cal-day` ur kalenderns DOM för att veta vilket fönster den skulle hämta
   * gruppens frånvaro för (lifehub.app PR 91, en tillfällig lösning med ärende). Det band appen till ramverkets markup. Nu säger
   * kalendern det själv. ⛔ VARJE RULLNING STARTAR OM VILAN: en hämtning per rullningshändelse hade gett tiotals frågor för en
   * svepning. ⛔ STARTEN GÅR GENOM SAMMA VILA, efter hoppet till idag, så att första svaret är månaderna man faktiskt ser och
   * inte de överst i rullen. ⛔ SAMMA INTERVALL TVÅ GÅNGER RAPPORTERAS EN GÅNG: hoppet till idag kan ge en egen rullningshändelse.
   */
  const synligaRef = useRef(onSynligaManader);
  synligaRef.current = onSynligaManader;
  const vilaRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const senastRef = useRef("");
  const planeraSynliga = useCallback(() => {
    if (!synligaRef.current) return;
    if (vilaRef.current) clearTimeout(vilaRef.current);
    vilaRef.current = setTimeout(() => {
      vilaRef.current = null;
      const rulle = rulleRef.current;
      const svar = rulle ? synligaManader(rulle, huvudRef.current ? huvudRef.current.offsetHeight : 0) : null;
      if (!svar || !synligaRef.current) return;
      const nyckel = `${svar.forsta}|${svar.sista}`;
      if (nyckel === senastRef.current) return;
      senastRef.current = nyckel;
      synligaRef.current(svar);
    }, SYNLIGA_MANADER_VILA_MS);
  }, []);
  useEffect(() => {
    planeraSynliga();
  }, [planeraSynliga, list]);
  useEffect(
    () => () => {
      if (vilaRef.current) clearTimeout(vilaRef.current);
    },
    [],
  );

  const fullhojd = useFullHeight(rulleRef);

  /*
   * ⛔ DAGPANELENS HÖJD MÄTS UNDER 1024 PX, för luften under sista månaden (0.37.0; i 0.36.0 drogs den av rullytan). Taket
   * är 45 procent av ytan (SS `max-h-[45%]`).
   */
  const [panelHojd, setPanelHojd] = useState(0);
  const matt = /** @type {Record<string, string>} */ (/** @type {unknown} */ (fullhojd));
  const ytan = Math.max(0, parseFloat(matt["--fullhojd-botten"]) - parseFloat(matt["--fullhojd-topp"]));

  useEffect(() => {
    const el = todayRef.current;
    const rulle = rulleRef.current;
    if (!el || !rulle || typeof IntersectionObserver !== "function") return undefined;
    const obs = new IntersectionObserver(
      ([hit]) => {
        setShowBack(!hit.isIntersecting);
        if (hit.isIntersecting) return;
        setDirection(scrollDirection(hit.boundingClientRect, hit.rootBounds));
      },
      // ⛔ `root` ÄR RULLBEHÅLLAREN OCH INTE FÖNSTRET, annars räknas månaden som synlig hur långt bort man rullat.
      { root: rulle, threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const harPoster = byKey.size > 0;

  /*
   * ⛔ SORTERAT PÅ DATUM OCH INTE PÅ TRYCKORDNING. Markerar man den 25:e och sedan den 12:e läser man ändå panelen
   * uppifrån och ner. ⛔ OCH EN VALD DAG UTAN POSTER STÅR KVAR (0.36.0): den är vald för att något ska skapas där.
   */
  const days = useMemo(() => [...chosen].sort().map((dayKey) => ({ dayKey, entries: byKey.get(dayKey) || [] })), [chosen, byKey]);
  const panelOppen = days.length > 0;
  // ⛔ PLATSEN ÖPPNAS AV DAGPANELEN ELLER SNABBTITTEN (0.73.0, bolag-ops#568). Luften under rutnätet och Idag-knappens läge läser samma höjd.
  const platsOppen = panelOppen || titt !== null;

  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof ResizeObserver !== "function") {
      setPanelHojd(0);
      return undefined;
    }
    const mat = () => setPanelHojd(platsOppen && el.offsetHeight ? el.offsetHeight : 0);
    mat();
    const obs = new ResizeObserver(mat);
    obs.observe(el);
    return () => obs.disconnect();
  }, [platsOppen]);

  /*
   * ⛔ VALD DAG RULLAS UPP OVANFÖR PANELEN PÅ TELEFON (0.37.0), som SS-appen. CP 2026-09-30, med en skärmbild ur SS-appen
   * bredvid vår: den valda veckan ligger kvar ovanför den flytande panelen, och hos oss hamnade den valda rutan UNDER den.
   * Panelen flyter över rutnätets nedre del under 1024 px, så en ruta långt ner täcks. Här mäts rutans underkant mot
   * panelens överkant (inga egna tal; luften är rutans egen radavstånd) och rullas bara det som saknas, uppåt. `scrollBy`
   * på rullbehållaren och inte `scrollIntoView`, av samma skäl som `toToday`. Från 1024 px ligger panelen i en egen
   * kolumn och ingenting täcks. Den översta valda dagen räknas: vid ett intervall är det dess rad som ska synas.
   */
  const forstaValda = chosen.length > 0 ? [...chosen].sort()[0] : null;
  /*
   * ⛔ 0.40.0 (#214): RULLNINGEN SKULDAS EN GÅNG PER VAL, INTE VID VARJE ÄNDRING AV PANELENS HÖJD. Effekten nedan hade `panelHojd` som beroende,
   * eftersom panelens höjd är 0 när dagen väljs och mäts först efteråt. Men höjden går också till 0 och tillbaka när kalendern DÖLJS och visas, och
   * det gör den när skalet visar en händelsepanel över den och man trycker Tillbaka. Då rullade effekten om kalendern +110 px (mätt i check-skalyta
   * avsnitt 35 vid 390 px: 4814 före, 4924 efter Tillbaka), och man kom tillbaka till en annan månad än den man lämnade. `skuldRullning` sätts bara när
   * den första valda dagen BYTS, och effekten kvitterar den när den har mätt panelen.
   */
  const skuldRullning = useRef(false);
  useEffect(() => {
    skuldRullning.current = true;
  }, [forstaValda]);
  useEffect(() => {
    const rulle = rulleRef.current;
    const panel = panelRef.current;
    if (!skuldRullning.current || !forstaValda || !rulle || !panel || panelHojd <= 0) return;
    skuldRullning.current = false;
    if (typeof window.matchMedia === "function" && !window.matchMedia("(max-width: 1023.98px)").matches) return;
    const ruta = /** @type {HTMLElement | null} */ (rulle.querySelector(`[data-cal-day="${forstaValda}"]`));
    if (!ruta) return;
    const luft = parseFloat(getComputedStyle(rulle.querySelector("[data-cal-day]") || ruta).rowGap || "0") || 8;
    const saknas = ruta.getBoundingClientRect().bottom + luft - panel.getBoundingClientRect().top;
    if (saknas > 0) rulle.scrollBy({ top: saknas, behavior: "smooth" });
  }, [forstaValda, panelHojd]);

  /*
   * ══ DRA-MARKERING OCH LÅNGTRYCK (SS `MonthGrid.jsx:69-148`) ═══════════════
   *
   * ⛔ 12 PX INNAN ETT DRAG ÄR ETT DRAG. Under det är det ett tryck med en darrande tumme, och ett tryck ska välja en
   * dag och inte ett intervall av en. Lyssnarna sitter på fönstret och rutan hittas med `elementFromPoint`, eftersom en
   * pekskärm håller kvar pekaren på rutan där draget började (implicit pointer capture).
   *
   * ⛔ 450 MS ÄR ETT LÅNGTRYCK och öppnar snabbtitten, samma tal som SS. Efter ett drag eller ett långtryck sväljs det
   * klick som följer, annars hade släppet valt dagen en gång till och tagit bort den ur urvalet.
   */
  const svepRef = useRef(/** @type {null | { pekare: number, ankare: string, x: number, y: number, aktiv: boolean, nu: string }} */ (null));
  const svaljKlick = useRef(false);
  const langRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const [svep, setSvep] = useState(/** @type {Set<string> | null} */ (null));
  const [svepar, setSvepar] = useState(false);
  const rensaLang = useCallback(() => {
    if (langRef.current) clearTimeout(langRef.current);
    langRef.current = null;
  }, []);

  // ⛔ 0.39.1: långtryckets timer rensas också när kalendern försvinner. Förut rensades den bara av släpp, lämna
  // och avbryt, och sköt då mot en vy som inte fanns (mätt 2026-10-01 som ett fel efter `kalendrar.test.jsx`).
  useEffect(() => rensaLang, [rensaLang]);

  useEffect(() => {
    if (!svepar) return undefined;
    /** @param {PointerEvent} e */
    const flytt = (e) => {
      const s = svepRef.current;
      if (!s || e.pointerId !== s.pekare) return;
      if (!s.aktiv) {
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 12) return;
        s.aktiv = true;
        svaljKlick.current = true;
        rensaLang();
      }
      const el = typeof document.elementFromPoint === "function" ? document.elementFromPoint(e.clientX, e.clientY) : null;
      const dag = el && el.closest ? el.closest("[data-cal-day]")?.getAttribute("data-cal-day") : null;
      if (dag && dag !== s.nu) {
        s.nu = dag;
        setSvep(new Set(datumOmfang(s.ankare, dag)));
      }
    };
    /** @param {boolean} spara */
    const klar = (spara) => {
      const s = svepRef.current;
      if (spara && s && s.aktiv && s.nu !== s.ankare) setValda((f) => valjIntervall(f, datumOmfang(s.ankare, s.nu)));
      svepRef.current = null;
      setSvep(null);
      setSvepar(false);
    };
    /** @param {PointerEvent} e */
    const upp = (e) => {
      if (svepRef.current && e.pointerId === svepRef.current.pekare) klar(true);
    };
    /** @param {PointerEvent} e */
    const avbryt = (e) => {
      if (svepRef.current && e.pointerId === svepRef.current.pekare) klar(false);
    };
    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", upp);
    window.addEventListener("pointercancel", avbryt);
    return () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", upp);
      window.removeEventListener("pointercancel", avbryt);
    };
  }, [svepar, rensaLang]);


  /** @param {string} dayKey */
  const pekareFor = (dayKey) => ({
    onClick: () => {
      if (svaljKlick.current) {
        svaljKlick.current = false;
        return;
      }
      setValda((f) => valjDag(f, dayKey));
    },
    /** @param {import("react").PointerEvent<HTMLButtonElement>} e */
    onPointerDown: (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      /*
       * ⛔ EN NY GEST BÖRJAR MED ATT INGET KLICK SVÄLJS. Mätt i `check-skalyta` avsnitt 30: ett drag som slutar på en ANNAN
       * ruta än det började ger inget klick på någon ruta (webbläsaren skickar det till den gemensamma föräldern), så
       * flaggan som skulle svälja det klicket stod kvar och åt upp nästa riktiga tryck. Den som drog över tre dagar och
       * sedan tryckte på en fjärde fick ingenting.
       */
      svaljKlick.current = false;
      rensaLang();
      langRef.current = setTimeout(() => {
        svaljKlick.current = true;
        svepRef.current = null;
        setSvepar(false);
        setSvep(null);
        setTitt(dayKey);
      }, LANGTRYCK_MS);
      svepRef.current = { pekare: e.pointerId, ankare: dayKey, x: e.clientX, y: e.clientY, aktiv: false, nu: dayKey };
      setSvepar(true);
    },
    onPointerUp: rensaLang,
    onPointerLeave: rensaLang,
    onPointerCancel: rensaLang,
    /** @param {import("react").MouseEvent<HTMLButtonElement>} e */
    onContextMenu: (e) => {
      e.preventDefault();
      rensaLang();
      setTitt(dayKey);
    },
  });

  const skapa = onSkapa ? () => onSkapa(chosen.length > 0 ? [...chosen].sort() : [todayDayKey]) : undefined;
  const gridKlass = veckonummer ? "grid-cols-[2rem_repeat(7,minmax(0,1fr))]" : "grid-cols-7";

  return (
    /*
     * ⛔ EN RAD PÅ BREDA SKÄRMAR, EN SPALT PÅ SMALA. Se `DayPanel`: från 1024 px ligger dagens poster BREDVID rutnätet,
     * under det staplas de UNDER. Panelen är SAMMA nod i båda lägena, bara flexriktningen byts: två renderingar av
     * samma panel hade betytt två ställen att rätta.
     */
    <section aria-label={ariaLabel} data-ops-kalender="" className="relative flex flex-col lg:flex-row lg:items-start lg:gap-4">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Verktygsrad
          kalendrar={kalendrar}
          syn={syn}
          kalendersektioner={kalendersektioner}
          onHanteraKalendrar={onHanteraKalendrar}
          veckonummer={veckonummer}
          onVeckonummer={vaxlaVeckonummer}
          typer={synligaTyper}
          statusWords={statusWords}
          typ={typ}
          onTyp={setTyp}
          status={status}
          onStatus={setStatus}
          sokOppen={sokOppen}
          onSok={() => {
            setSokOppen((f) => !f);
            setFraga("");
          }}
          onSkapa={skapa}
          tillganglighet={tillganglighet}
        />
        {appar.length >= 2 ? <Apprad appar={appar} dolda={doldaSet} onVaxla={vaxlaApp} onVisaAlla={() => sparaDolda([])} /> : null}
        {sokOppen ? (
          <div role="search" data-kalender-sok="" className="mb-2 flex shrink-0 items-center gap-2 rounded-base border border-line bg-surface px-3 py-1.5">
            <span aria-hidden="true" className="flex text-ink-muted">
              <SokIkon size={16} />
            </span>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              type="search"
              autoFocus
              value={fraga}
              onChange={(e) => setFraga(e.target.value)}
              placeholder="Sök i kalendern"
              aria-label="Sök i kalendern"
              className="min-h-9 min-w-0 flex-1 bg-transparent text-etikett text-ink outline-none placeholder:text-ink-muted"
            />
            {/* ⛔ ANTALET TRÄFFAR STÅR UTSKRIVET, OCKSÅ NOLL (punkt 5). Utan det ser en sökning utan träff ut som en
                kalender där allt tonats ned av något annat skäl. */}
            {sokning ? (
              <span data-sok-antal="" className="shrink-0 text-meta text-ink-muted" aria-live="polite">
                {traffDagar && traffDagar.size > 0 ? `${traffDagar.size} ${traffDagar.size === 1 ? "dag" : "dagar"}` : "Inga träffar"}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* ⛔ TAKET GÖR KALENDERN TILL SIN EGEN RULLE. `relative` är inte prydnad: månadsblocken mäter sin plats med
            `offsetTop`, alltså mot närmaste positionerade förälder. */}
        <div
          ref={rulleRef}
          data-kalender-rulle=""
          onScroll={(e) => {
            /*
             * ⛔ RIKTNINGEN RÄKNAS OM VID RULLNING, INTE BARA NÄR MÅNADEN KORSAR TRÖSKELN (0.36.0). Observatören svarar
             * bara när synligheten ÄNDRAS. Mätt i `check-skalyta` avsnitt 30: rullad överst pekade pilen nedåt (rätt), och
             * efter ett hopp till botten pekade den fortfarande nedåt, eftersom månaden var osynlig i båda lägena och
             * observatören aldrig svarade. Till 0.35.0 syntes det inte: fyra månader rullar man sällan förbi i ett hopp.
             */
            planeraSynliga();
            const m = todayRef.current;
            if (!m) return;
            setDirection(scrollDirection(m.getBoundingClientRect(), e.currentTarget.getBoundingClientRect()));
          }}
          style={/** @type {any} */ ({ ...fullhojd, "--ops-kantluft": kantluft(veckonummer) })}
          // ⛔ MARGINALEN UNDER 640 PX RYMMER ALLTID BRICKANS ÖVERHÄNG (0.61.0, #259). Hörnbrickorna sticker ut över rutnätets kant, och
          // rullytan klipper det som går utanför; förebild 7 visar brickan hel. Överhänget växer när rutan blir smalare, och rutan blir
          // smalare när marginalen växer, så marginalen räknas ur samma tal som brickan (`kantluft`). Från 640 px finns inga brickor.
          className={cx("relative bg-canvas px-(--ops-kantluft) sm:px-1", FULL_HEIGHT_CLASSES)}
        >
          {/* ⛔ Klistrad veckodagsrad, med veckonumrets kolumn när den är på (SS `CalView.jsx:124-138`). */}
          <div ref={huvudRef} className={cx("sticky top-0 z-(--z-sticky) grid gap-1 bg-canvas pt-1 pb-2 sm:gap-1.5", gridKlass)}>
            {veckonummer ? <span className="py-1 text-center text-liten font-semibold text-ink-muted">v</span> : null}
            {weekdayNames(locale).map((d) => (
              <span key={d} className="py-1 text-center text-liten font-medium uppercase tracking-widest text-ink-muted sm:text-hjalp">
                {d}
              </span>
            ))}
          </div>

          {!harPoster && emptyText ? <p className="m-0 pb-3 text-etikett text-ink-muted">{emptyText}</p> : null}

          <div className="flex flex-col gap-8 pb-6">
            {list.map(({ ar, month }) => {
              const isCurrentMonth = `${ar}-${String(month + 1).padStart(2, "0")}` === idagManad;
              const rows = monthGrid(ar, month);

              return (
                <div key={`${ar}-${month}`} ref={isCurrentMonth ? todayRef : null} data-kalender-manad={`${ar}-${String(month + 1).padStart(2, "0")}`}>
                  <h3 className="m-0 mt-2 mb-3 text-titel capitalize text-ink font-display sm:text-sida">
                    {monthNames(locale)[month]} {ar}
                  </h3>

                  <div className="flex flex-col gap-1 sm:gap-1.5">
                    {rows.map((row, i) => {
                      const nycklar = row.map((day) => (day === null ? null : dateKey(ar, month, day)));
                      const bitar = bandIVecka(nycklar, rutPoster);
                      // ⛔ PLATS PER DAG, inte per vecka (0.106.0): bara en dag som ett band täcker reserverar plats under siffran.
                      const filerPerDag = reserveradeFiler(bitar);
                      const forsta = row.find((d) => d !== null);
                      const veckodagar = /** @type {string[]} */ (nycklar.filter(Boolean));
                      const helaVeckan = veckodagar.length > 0 && veckodagar.every((d) => chosen.includes(d));
                      // ⛔ RADENS SPÅR ÄR MINST 80 PX OCH VÄXER MED RUTORNA (0.106.0, `sm:auto-rows`): golvet SS har som `min-h-20` på varje
                      // ruta, flyttat hit så att en ruta vars innehåll är högre än proportionen kan göra raden högre i stället för att
                      // rinna ut ur sig. Se `Dagruta`. Under 640 px har rutorna ingen minsta höjd (proportionen ensam).
                      return (
                        <div
                          key={i}
                          data-veckorad=""
                          className={cx("relative grid gap-1 sm:auto-rows-[minmax(5rem,auto)] sm:gap-1.5 [--ops-bandtopp:1.75rem] sm:[--ops-bandtopp:2.25rem]", gridKlass)}
                        >
                          {veckonummer ? (
                            <button
                              type="button"
                              data-veckonummer=""
                              aria-pressed={helaVeckan}
                              aria-label={`Välj vecka ${forsta ? isoVecka(ar, month, forsta) : ""}`}
                              onClick={() => setValda((f) => valjVecka(f, veckodagar))}
                              className={cx(
                                "flex cursor-pointer items-start justify-center rounded-md pt-2 text-meta font-semibold tabular-nums hover:bg-hover",
                                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                                helaVeckan ? "bg-accent-subtle text-accent" : "text-ink-muted",
                              )}
                            >
                              v{forsta ? isoVecka(ar, month, forsta) : ""}
                            </button>
                          ) : null}
                          <Band bitar={bitar} veckonummer={veckonummer} />
                          {row.map((day, j) => {
                            if (day === null) return <div key={`tom-${i}-${j}`} aria-hidden="true" className="aspect-[1/1.1]" />;
                            const dayKey = dateKey(ar, month, day);
                            const pa = byKey.get(dayKey) || [];
                            const paRuta = rutaPerDag.get(dayKey) || [];
                            const ram = ramDagar.get(dayKey);
                            const appDekor = dagdekor ? dagdekor(dayKey) : undefined;
                            return (
                              <Dagruta
                                key={dayKey}
                                day={day}
                                dayKey={dayKey}
                                entries={pa}
                                markerade={paRuta.filter((e) => !arBand(e))}
                                spann={paRuta.filter((e) => typeof e.endDate === "string" && e.endDate > e.date)}
                                enkla={paRuta.filter((e) => !(typeof e.endDate === "string" && e.endDate > e.date))}
                                isToday={dayKey === todayDayKey}
                                forbi={dayKey < todayDayKey}
                                chosen={chosen.includes(dayKey)}
                                forhand={!!svep && svep.has(dayKey)}
                                sok={traffDagar ? (traffDagar.has(dayKey) ? "traff" : "miss") : ""}
                                bandhojd={bandplats(filerPerDag[j])}
                                pekare={pekareFor(dayKey)}
                                dekor={ram && !(appDekor && appDekor.ram) ? { ...appDekor, ram } : appDekor}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {/* ⛔ LUFT UNDER SISTA MÅNADEN SÅ HÖG SOM DAGPANELEN, BARA UNDER 1024 PX: panelen flyter över rutnätet, och utan
              luften går de sista raderna inte att rulla fram ovanför den (SS-appen `paddingBottom: DAY_PANEL_HEIGHT`). */}
          {platsOppen ? <div aria-hidden="true" data-panelluft="" style={{ height: panelHojd }} className="lg:hidden" /> : null}
        </div>

        {/* ⛔ `absolute` I KOLUMNENS HÖRN, inte `sticky` i flödet: knappen hör till rutnätet och ska stå still medan det
            rullar under den. Pilen pekar åt det håll idag ligger (SS `CalView.jsx:176-194`). */}
        {/* ⛔ MITT ÖVER RUTNÄTET, MÖRK, OCH OVANFÖR DAGPANELEN NÄR DEN ÄR ÖPPEN (0.37.0), som SS-appen: pillret "Idag" med pil
            flyter centrerat över rutnätet. 0.36.0 hade det i hörnet nere till höger, där det hamnade ovanpå korten. */}
        {showBack ? (
          <button
            type="button"
            data-idagknapp=""
            onClick={() => toToday("smooth")}
            style={{ bottom: platsOppen && panelHojd > 0 ? panelHojd - 16 : 16 }}
            className={cx(
              "ops-contrast-panel absolute left-1/2 z-(--z-sticky) flex min-h-11 -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full bg-contrast-panel px-4 text-etikett font-semibold text-ink shadow-md lg:bottom-4!",
              "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            )}
          >
            <span aria-hidden="true">{direction === "upp" ? "↑" : "↓"}</span>
            Idag
          </button>
        ) : null}
      </div>

      {/*
        ⛔ SAMMA NOD I BÅDA LÄGENA. Under 1024 px: FLYTER ÖVER rutnätets nedre del (0.37.0, se huvudet), utan egen bakgrund,
        så hög som sitt innehåll, högst `DAGPANEL_TAK` av ytan och först då med egen rullning; rullytan får lika mycket luft i botten så att sista raden går att nå.
        Från 1024 px: en kolumn på 300 px, 360 från 1280.
      */}
      <div
        ref={panelRef}
        data-dagpanel-plats=""
        style={/** @type {import("react").CSSProperties} */ ({ "--ops-dagpanel-max": `${Math.round(ytan * DAGPANEL_TAK)}px` })}
        className={cx(
          "shrink-0 lg:w-75 lg:overflow-visible xl:w-90",
          platsOppen && "max-lg:absolute max-lg:inset-x-0 max-lg:-bottom-6 max-lg:z-(--z-sticky) max-lg:max-h-(--ops-dagpanel-max) max-lg:overflow-y-auto max-lg:overscroll-contain",
        )}
      >
        {titt ? (
          <Snabbtitt
            dayKey={titt}
            alla={allaPerDag.get(titt) || []}
            synliga={synligaId}
            onClose={() => setTitt(null)}
            locale={locale}
            oppna={oppnaHandelse ? (id) => { setTitt(null); oppnaHandelse(id); } : null}
            oppnaExtern={oppnaExtern}
          />
        ) : null}
        {panelOppen ? (
          <DayPanel
            days={days}
            statusWords={statusWords}
            onClose={() => setValda([])}
            onTaBort={(n) => setValda((f) => f.filter((x) => x !== n))}
            onSkapa={skapa}
            locale={locale}
            arMin={arMin}
            oppna={oppnaHandelse}
            oppnaExtern={oppnaExtern}
            lager={daglager ? daglager(days.map((d) => d.dayKey)) : null}
          />
        ) : titt ? null : (
          /* ⛔ BARA PÅ BREDA SKÄRMAR. Kolumnen finns redan där och är tom, så en rad om vad den är till för kostar
              ingenting. På telefon finns ingen kolumn att förklara. */
          <p className="m-0 hidden rounded-md border border-dashed border-line p-3 text-etikett text-ink-muted lg:block">
            Tryck på en dag för att se vad som ligger där. Tryck på fler, eller dra över dem, för att samla dem.
          </p>
        )}
      </div>
      {/* ⛔ LÄSPANELEN FÖR EN EXTERN HÄNDELSE (0.134.0). En dialog över kalendern, så att urval, månad och filter står kvar under den. Se `OpsExternPanel`. */}
      <OpsExternPanel
        post={externPost}
        onStang={() => setExternId(null)}
        sprak={String(locale).toLowerCase().startsWith("en") ? "en" : "sv"}
        kopieraTill={kopieraTill}
        onKopiera={onKopiera}
      />
    </section>
  );
}
