import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { kantKlass } from "../lib/kant.js";
import { slagKant, slagPrick } from "../lib/slag.js";
import { FULL_HEIGHT_CLASSES, useFullHeight } from "../lib/fullHeight.js";
import {
  MONTH_NAMES,
  dateKey,
  dateText,
  todayKey,
  months,
  monthGrid,
  perDay,
  scrollDirection,
} from "../lib/calendar.js";
import { ChevronNedIkon } from "./icons.jsx";
import { OpsStatusDot } from "./OpsStatusDot.jsx";

/**
 * Kalender: en månad i taget, i en rulle, med det som faktiskt ligger på dagen.
 *
 * ══ ⛔ VAD DEN ÄR OCH VAD DEN INTE ÄR ═══════════════════════════════════
 *
 * CP 2026-09-22: "Jag vill ha en REN Enkel och strukturerad kalender i samma
 * utseende med så lite kod som möjligt. Absolut ingen overkill."
 *
 * Den ritar DATERADE POSTER. Den äger inte urvalet, vet inte var posterna kommer
 * ifrån och har ingen åsikt om vad de betyder. Appen skickar in en lista och får
 * ett rutnät.
 *
 * ⛔ INGEN DRAG-MARKERING, INGA LAGER, INGA AVATARER, INGEN EXPORT. Förebilden
 * (SessionStudios CalView) bär allt det, och den bär det för att den handlar om
 * grupper som ska hitta en tid ihop. Ett bolags kalender har en läsare. Allt
 * sådant som portats in hade varit kod som aldrig körs, och den sortens kod
 * upptäcks först när någon ska ändra något bredvid den.
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
 * ⛔ TAKET ÄR `svh` OCH INTE `vh`. På en telefon krymper `vh` aldrig när
 * adressfältet fälls in, så en `vh`-höjd lägger kalenderns nederkant under
 * webbläsarens eget krom, och "Idag"-knappen hamnar under det man inte kan rulla
 * bort.
 *
 * ══ ⛔ DAGEN ÖPPNAS I EN FLYTANDE, INVERTERAD BUBBLA ═══════════════════
 *
 * CP 2026-09-22, med bild ur SessionStudio: "bubblorna måste vara flytande som
 * i SessionStudio. Lägg märke till det inverterade."
 *
 * Första versionen fällde ut dagen UNDER månadsrutnätet, med skälet att en
 * flytande ruta kostar positionering. Det var fel av ett skäl som bara syns i
 * bruk: utfällningen SKJUTER RESTEN AV RUTNÄTET NEDÅT. Man trycker på den 12:e,
 * och dagarna under 12:e flyttar sig, så nästa tryck landar på fel dag.
 *
 * Bubblan här kostar ingen kollisionshantering, för den är inte ankrad vid
 * fingret som förebilden. Den ligger `fixed` nära nederkanten, centrerad, precis
 * som `OpsFloatingSummary`, och skälet till `fixed` framför `sticky` står
 * utskrivet där: en sida som rullar i dokumentet har ingen andra behållare att
 * stå stilla i.
 *
 * ⛔ INVERTERAD MED `ops-contrast-panel`, alltså samma yta som laborera-popovern
 * och sifferbubblan. Den klassen remappar bläck, linjer och accent, så bubblan
 * håller kontrast i både ljust och mörkt läge utan en enda egen hex. En bubbla
 * som målats med `bg-ink` hade varit en fjärde mörk yta med sin egen ton.
 *
 * ⛔ TRE VÄGAR UT, för bubblan täcker en del av rutnätet: krysset, Escape, och
 * ett andra tryck på samma dag. En flytande ruta med bara ett litet kryss är den
 * ruta man till slut rullar ifrån i stället för att stänga.
 */

const WEEKDAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

/** Hur många prickar en ruta ritar innan den börjar räkna i stället. */
const MAX_PRICKAR = 3;

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
 * En dagsruta.
 *
 * ⛔ EN `<button>` OCH INTE EN `<div onClick>`, även för en tom dag. Tomma dagar
 * är inte tryckbara alls, och de som har något måste gå att nå med tangentbord.
 * En klickbar div gör ingetdera och ser likadan ut.
 *
 * ⛔ TRÄFFYTAN ÄR HELA RUTAN. En siffra är några pixlar bred, och en kalender man
 * missar med tummen är en kalender man slutar öppna.
 *
 * @param {{ day: number | null, dayKey: string, entries: import("../lib/calendar.js").CalendarEntry[], isToday: boolean, chosen: boolean, onSelect: (dayKey: string) => void }} props
 */
function DayBox({ day, dayKey, entries, isToday, chosen, onSelect }) {
  if (day === null) return <div aria-hidden="true" />;

  const count = entries.length;
  const label = count === 0 ? `${day}` : `${day}, ${count} ${count === 1 ? "post" : "poster"}`;

  return (
    <button
      type="button"
      disabled={count === 0}
      aria-pressed={chosen}
      aria-label={label}
      onClick={() => onSelect(dayKey)}
      className={cx(
        "flex min-h-14 flex-col items-center gap-1 rounded-md px-1 pt-1.5 pb-1 text-sm transition-colors duration-(--duration-fast) ease-standard",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        count === 0 ? "cursor-default text-ink-muted" : "cursor-pointer text-ink hover:bg-accent-faint",
        chosen && "bg-accent-subtle",
        // ⛔ Idag är en RING och inte en fylld yta. Fylld krockar med markeringen
        // för vald dag, och då går det inte att se vilken av de två man tittar på.
        isToday && "ring-2 ring-accent ring-inset font-bold",
      )}
    >
      <span className="tabular-nums">{day}</span>
      {/* ⛔ Dekor, och läses inte upp: antalet står redan i knappens namn. */}
      <span aria-hidden="true" className="flex min-h-2 items-center gap-0.5">
        {entries.slice(0, MAX_PRICKAR).map((p) => (
          <span
            key={p.id}
            className={cx("size-1.5 rounded-full", slagPrick(p.slag, p.slagLabel, "OpsCalendar") || "bg-accent")}
          />
        ))}
        {count > MAX_PRICKAR ? <span className="text-xs tabular-nums text-ink-muted">+{count - MAX_PRICKAR}</span> : null}
      </span>
    </button>
  );
}

/** Krysset, i två storlekar. En svg på tre ställen är tre ställen att rätta. */
function Kryss({ stor = false }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={stor ? "size-3.5" : "size-2.5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

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
 * @param {{ dayKey: string, kanTasBort: boolean, onTaBort: (dayKey: string) => void, order: number }} props
 */
function Datumpiller({ dayKey, kanTasBort, onTaBort, order }) {
  const text = dateText(dayKey);
  return (
    <span
      style={{ animationDelay: `${order * SVEPSTEG}ms` }}
      className="ops-contrast-panel inline-flex animate-svep items-center gap-1.5 rounded-full bg-contrast-panel py-1 pr-2 pl-2.5 text-xs font-semibold text-ink shadow-md"
    >
      {text}
      {kanTasBort ? (
        <button
          type="button"
          onClick={() => onTaBort(dayKey)}
          aria-label={`Ta bort ${text}`}
          className="flex cursor-pointer items-center text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Kryss />
        </button>
      ) : null}
    </span>
  );
}

/**
 * En post, som ett eget kort.
 *
 * ══ ⛔ ETT KORT PER POST, INTE EN LISTA I ETT KORT ══════════════════════
 *
 * CP 2026-09-22, med bild ur SessionStudio: "Det finns ingen separator med flera
 * händelser i bubblan."
 *
 * Första versionen la posterna som rader i EN bubbla, och fyra påminnelser i rad
 * blev då en vägg av fet text utan något som skiljer dem åt. Förebilden gör
 * tvärtom: varje post är ett eget `rounded-xl`-kort med egen skugga, staplade
 * med luft emellan. Luften ÄR avdelaren, och den behöver därför ingen linje.
 *
 * ⛔ DATUMET ÅTERKOMMER PÅ KORTET, under titeln, och det är inte en upprepning
 * av pillret ovanför. Pillren säger vilka dagar urvalet består av; kortets rad
 * säger vilken av dem just den här posten tillhör. Med tre dagar valda är det
 * enda som skiljer två likadana påminnelser åt.
 *
 * @param {{ dayKey: string, entry: import("../lib/calendar.js").CalendarEntry, statusWords: Record<string, string>, order: number }} props
 */
function Postkort({ dayKey, entry, statusWords, order }) {
  const [oppen, setOppen] = useState(false);
  const idBas = useId();
  const panelId = `${idBas}-detaljer`;

  const meta = entry.not ? `${dateText(dayKey)} · ${entry.not}` : dateText(dayKey);

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
  const kanten = slagKant(entry.slag, entry.slagLabel, "OpsCalendar") || kantKlass(entry.edge, entry.edgeLabel, "OpsCalendar");

  return (
    <div
      style={{ animationDelay: `${order * SVEPSTEG}ms` }}
      className={cx(
        "ops-contrast-panel animate-svep rounded-xl bg-contrast-panel p-2.5 shadow-md",
        kanten && cx("border-l-4", kanten),
      )}
    >
      {/* ⛔ ORDET FÖRST I KORTET, precis som i `OpsCard`. Den som lyssnar ska
          höra vad kanten betyder innan titeln, inte efter den. */}
      {kanten ? <span className="sr-only">{entry.slagLabel || entry.edgeLabel}</span> : null}
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
          <span className="font-semibold text-ink">{entry.title}</span>
          <p className="m-0 text-xs text-ink-secondary">{meta}</p>
        </div>

        {harDetaljer ? (
          <button
            type="button"
            onClick={() => setOppen((f) => !f)}
            aria-expanded={oppen}
            aria-controls={panelId}
            className={cx(
              "-mr-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-secondary",
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
        <div id={panelId} hidden={!oppen} className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-sm">
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

/**
 * De valda dagarnas poster: piller överst, ett kort per post under.
 *
 * ══ ⛔ VAR DEN LIGGER, OCH VARFÖR DET ÄR TVÅ OLIKA SVAR ════════════════
 *
 * CP 2026-09-22: "Se var bubblorna är i web där det finns utrymme och se var de
 * finns i mobil och hur det ser ut."
 *
 * Förebilden avgör det med en enda rad, `showSidePanel = !isPhone`:
 *
 *   SMALT: en remsa längst ner, över rutnätet. Det finns ingen bredd att ta av.
 *   BRETT: en egen kolumn BREDVID rutnätet, i flödet, 300 px från 1024 px och
 *   360 px från 1280 px.
 *
 * ⛔ GRÄNSEN GICK FÖRST VID 768 px, OCH DET KLÄMDE IHOP KALENDERN. CP
 * 2026-09-22, med bild: "I web-vyn har du tryckt ihop kalendern. Se
 * sessionstudio, bubblorna får utrymme till höger om panelen när skärmen ger
 * tillåtelse."
 *
 * Räknat: en app-vy på 768 px har 736 px innanför sin sidomarginal. Drar man
 * 300 px till en kolumn återstår 436 px åt sju dagsrutor, alltså 62 px styck.
 * Det är smalare än träffytan de ska ha. Vid 1024 px blir samma räkning 99 px
 * och vid 1280 px omkring 127 px, alltså först då finns utrymmet att ta av.
 *
 * ⛔ OCH DET ÄR FÖREBILDENS EGEN REGEL, inte en ny. `showSidePanel = !isPhone`
 * är bara halva den: `showSplitChrome = !isPhone && isLandscape`, med
 * kommentaren "iPad Chrome stående: samma «mobil»-chrome som telefon (kalender:
 * dagpanel under rutnät)". En surfplatta i stående läge får alltså remsan, och
 * en stående iPad är 768 till 834 px bred. 1024 px är den bredd där en
 * surfplatta ligger ner.
 *
 * ⛔ KOLUMNEN RESERVERAS ÄVEN NÄR INGEN DAG ÄR VALD, och det följer av samma
 * rad: `showSidePanel` frågar efter skärmbredden, aldrig efter urvalet. Dök
 * kolumnen upp först vid ett tryck skulle rutnätet krympa under fingret, och
 * nästa tryck landa på fel dag. Det är exakt det fel utfällningen under månaden
 * en gång hade, fast i sidled.
 *
 * ⛔ PÅ TELEFON BOTTNAR DEN PÅ BOTTENRADEN, utan luft under. CP: "Bottendelen
 * skall inte vara med. Den kan gå ända ner." Här låg `--bottom-nav-overhang`
 * plus 0,75 rem, alltså plats för en rund plusknapp som sticker upp ur baren i
 * andra vyer och inte finns i den här. Marginalen betalade för något som inte
 * var där.
 *
 * ⛔ PILLERRADEN RULLAR MED, precis som i förebilden, där den ligger inuti samma
 * `max-h`-behållare som korten. Escape och ett andra tryck i rutnätet är vägar
 * ut som inte kan rulla bort.
 *
 * @param {{ days: { dayKey: string, entries: import("../lib/calendar.js").CalendarEntry[] }[], statusWords: Record<string, string>, onClose: () => void, onTaBort: (dayKey: string) => void }} props
 */
function DayPanel({ days, statusWords, onClose, onTaBort }) {
  const flera = days.length > 1;
  const title = flera ? `${days.length} dagar` : dateText(days[0].dayKey);
  const name = flera ? `Poster för ${days.length} valda dagar` : `Poster den ${title}`;

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

  return (
    <section
      aria-label={name}
      className="pointer-events-auto flex max-h-[45svh] w-full max-w-sm flex-col gap-2 overflow-y-auto overscroll-contain lg:max-h-[70svh] lg:max-w-none"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {days.map((d, i) => (
          <Datumpiller key={d.dayKey} dayKey={d.dayKey} kanTasBort={flera} onTaBort={onTaBort} order={i} />
        ))}
        {/* ⛔ KRYSSET BÄR RUBRIKEN I SITT NAMN. "Stäng" ensamt säger inte vad som
            stängs för den som lyssnar sig igenom sidan. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={`Stäng ${title}`}
          className={cx(
            "ops-contrast-panel ml-auto flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-contrast-panel text-ink shadow-md",
            "hover:text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <Kryss stor />
        </button>
      </div>

      {/* ⛔ TRAPPAN RÄKNAS ÖVER HELA PANELEN och inte per dag. Räknades den om
          för varje dag skulle första kortet under varje datum svepa in
          samtidigt, och det som ska läsas som en rörelse blir tre. */}
      {days.flatMap((d, di) =>
        d.entries.map((p, pi) => (
          <Postkort
            key={`${d.dayKey}-${p.id}`}
            dayKey={d.dayKey}
            entry={p}
            statusWords={statusWords}
            order={days.length + days.slice(0, di).reduce((n, x) => n + x.entries.length, 0) + pi}
          />
        )),
      )}
    </section>
  );
}

/**
 * @param {object} props
 * @param {import("../lib/calendar.js").CalendarEntry[]} props.entries Daterade poster. Odaterat hör inte hemma här.
 * @param {string} props.ariaLabel ⛔ Krävs: ett rutnät med tal är osynligt för den som inte ser det.
 * @param {Record<string, string>} [props.statusWords] Appens ord per läge, som i `OpsEventList`.
 *   ⛔ Ramverket äger färgerna och appen orden: bara appen vet vad `waiting` betyder hos just den.
 * @param {number} [props.monthsBack] Standard 1. ⛔ Inte tolv: en bolagskalender har få poster bakåt,
 *   och varje månad är ett rutnät till att rita och rulla förbi.
 * @param {number} [props.monthsForward] Standard 3.
 * @param {Date} [props.today] Bara för prov. Produktionen har en klocka.
 * @param {import("react").ReactNode} [props.emptyText] Vad som står när ingen post har datum.
 */
export function OpsCalendar({ entries = [], ariaLabel, statusWords = {}, monthsBack = 1, monthsForward = 3, today, emptyText }) {
  if (!ariaLabel) {
    throw new Error("OpsCalendar: ariaLabel krävs. Ett rutnät med tal är osynligt för den som inte ser det.");
  }

  const nu = today || new Date();
  const todayDayKey = todayKey(nu);
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

  const byKey = useMemo(() => perDay(entries), [entries]);
  const list = useMemo(() => months(nu, monthsBack, monthsForward), [nu, monthsBack, monthsForward]);

  const rulleRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const huvudRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const todayRef = useRef(/** @type {HTMLDivElement | null} */ (null));
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
   * Höjden läses av noden i stället för att skrivas som ett tal, eftersom talet
   * hade blivit fel den dag typsnittet ändras.
   *
   */
  const toToday = useCallback((/** @type {ScrollBehavior} */ beteende = "auto") => {
    const rulle = rulleRef.current;
    const month = todayRef.current;
    if (!rulle || !month) return;
    const header = huvudRef.current ? huvudRef.current.offsetHeight : 0;
    rulle.scrollTo({ top: Math.max(0, month.offsetTop - header), behavior: beteende });
  }, []);

  /*
   * ⛔ ETT HOPP UTAN ANIMERING VID MONTERING. Med historik bakåt ligger den
   * innevarande månaden en bit ner i rullen, och utan det här öppnar kalendern
   * på en månad som passerat: rutnätet är tomt och posterna ser ut att saknas.
   *
   * `didRef` finns för att det ska ske EN gång. Utan den hoppar vyn tillbaka
   * till idag varje gång posterna uppdateras, mitt i att någon rullar.
   */
  const didRef = useRef(false);
  useEffect(() => {
    if (didRef.current) return;
    didRef.current = true;
    toToday();
  }, [toToday]);

  /*
   * ⛔ HÖJDEN KOMMER UR `useFullHeight`, inte ur tjugo rader här. Skälet till att
   * den mäts i stället för att sättas står i hooken; skälet till att den bor där
   * och inte här är att listan behövde samma sak (CP 2026-09-22), och två kopior
   * hade glidit isär första gången någon rättade den ena.
   */
  const fullhojd = useFullHeight(rulleRef);

  useEffect(() => {
    const el = todayRef.current;
    const rulle = rulleRef.current;
    if (!el || !rulle || typeof IntersectionObserver !== "function") return undefined;
    const obs = new IntersectionObserver(
      ([hit]) => {
        setShowBack(!hit.isIntersecting);
        if (hit.isIntersecting) return;
        // ⛔ Beslutet bor i `scrollDirection` och inte här, se den funktionen: den
        // gamla jämförelsen var hårfin på just den pixel där observatören
        // svarar, så pilen pekade nedåt så gott som alltid.
        setDirection(scrollDirection(hit.boundingClientRect, hit.rootBounds));
      },
      // ⛔ `root` ÄR RULLBEHÅLLAREN OCH INTE FÖNSTRET. Utan den mäts synligheten
      // mot viewporten, och eftersom hela kalendern ryms där skulle månaden
      // räknas som synlig hur långt bort man än rullat inuti den: knappen hade
      // aldrig dykt upp.
      { root: rulle, threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const harPoster = byKey.size > 0;

  /*
   * ⛔ SORTERAT PÅ DATUM OCH INTE PÅ TRYCKORDNING. Markerar man den 25:e och
   * sedan den 12:e läser man ändå bubblan uppifrån och ner, och en lista i
   * tryckordning hade visat oktober efter november utan att något sagt varför.
   * Att en ren strängsortering RÄCKER är hela skälet till att nycklarna skrivs
   * `YYYY-MM-DD` med två siffror.
   *
   * ⛔ DAGAR SOM BLIVIT TOMMA FALLER BORT. Filtreras posterna om medan bubblan
   * är öppen kan en markerad dag bli tom, och en datumrubrik utan rader under
   * ser ut som att något gick sönder.
   */
  const days = useMemo(
    () =>
      [...chosen]
        .sort()
        .map((dayKey) => ({ dayKey, entries: byKey.get(dayKey) || [] }))
        .filter((d) => d.entries.length > 0),
    [chosen, byKey],
  );

  return (
    /*
     * ⛔ EN RAD PÅ BREDA SKÄRMAR, EN SPALT PÅ SMALA, och det är förebildens
     * `showSidePanel = !isPhone`. Se `DayPanel` för hela resonemanget: på allt
     * utom telefon finns bredd att lägga dagens poster BREDVID rutnätet, och då
     * behöver ingenting läggas ovanpå något annat.
     */
    <section aria-label={ariaLabel} className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="relative min-w-0 flex-1">
      {/* ⛔ TAKET GÖR KALENDERN TILL SIN EGEN RULLE. Se filens huvud: utan det
          rullar sidan, veckodagsraden nyper under appens toppmeny och vägen
          tillbaka till idag går genom hela vyn.

          ⛔ `relative` ÄR INTE PRYDNAD. Månadsblocken mäter sin plats med
          `offsetTop`, alltså mot närmaste positionerade förälder, och utan den
          här klassen räknas de mot sidan och rullningen landar fel. */}
      <div
        ref={rulleRef}
        style={fullhojd}
        className={cx(
          "relative bg-canvas px-1",
          FULL_HEIGHT_CLASSES,
          /* ⛔ INGEN RAM OCH INGEN RUNDNING. En ram runt något som når skärmens
             underkant läses som en ruta som blivit avhuggen, inte som en ruta.
             Förebilden har ingen heller: dess rullyta är bara `overflow-y-auto`.
             Veckodagsraden är klistrad och målad, så överkanten syns ändå. */
        )}
      >
        {/* ⛔ Klistrad veckodagsrad. Efter tre månaders rullning är kolumnernas
            betydelse borta, och man räknar sig fram i stället för att läsa. */}
        <div ref={huvudRef} className="sticky top-0 z-(--z-sticky) grid grid-cols-7 gap-1 bg-canvas pt-1 pb-2">
          {WEEKDAYS.map((d) => (
            <span key={d} className="text-center text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {d}
            </span>
          ))}
        </div>

        {!harPoster && emptyText ? <p className="m-0 pb-3 text-sm text-ink-muted">{emptyText}</p> : null}

        <div className="flex flex-col gap-6 pb-4">
          {list.map(({ ar, month }) => {
            const isCurrentMonth = ar === nu.getFullYear() && month === nu.getMonth();
            const rows = monthGrid(ar, month);

            return (
              <div key={`${ar}-${month}`} ref={isCurrentMonth ? todayRef : null}>
                <h3 className="m-0 mb-2 text-lg font-bold capitalize text-ink font-display">
                  {MONTH_NAMES[month]} {ar}
                </h3>

                <div className="grid grid-cols-7 gap-1">
                  {rows.map((row, i) =>
                    row.map((day, j) => {
                      const dayKey = day === null ? `tom-${i}-${j}` : dateKey(ar, month, day);
                      return (
                        <DayBox
                          key={dayKey}
                          day={day}
                          dayKey={dayKey}
                          entries={day === null ? [] : byKey.get(dayKey) || []}
                          isToday={dayKey === todayDayKey}
                          chosen={chosen.indexOf(dayKey) >= 0}
                          onSelect={(n) =>
                            setValda((forra) => (forra.indexOf(n) >= 0 ? forra.filter((x) => x !== n) : [...forra, n]))
                          }
                        />
                      );
                    }),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ⛔ `absolute` I RUTNÄTETS EGET HÖRN, inte `sticky` i flödet. Knappen
          hör till rutnätet och ska stå still medan det rullar under den, och
          `sticky` kunde bara nypa inom sin förälders rullsträcka. */}
      {showBack ? (
        <button
          type="button"
          onClick={() => toToday("smooth")}
          className={cx(
            "absolute right-4 bottom-4 min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-raised px-4 text-sm font-semibold text-ink shadow-md",
            "hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            /* ⛔ PÅ TELEFON VIKER DEN FÖR DAGSPANELEN. Sedan rullytan går ända
               ner bottnar båda på samma linje, och två flytande kontroller ovanpå
               varandra i underkanten är en av dem man inte kommer åt. Panelen är
               det man läser just då; Idag-knappen är ett hjälpmedel medan man
               rullar. Från 768 px bor panelen i egen kolumn och krocken finns
               inte. */
            days.length > 0 ? "hidden lg:flex" : "flex",
          )}
        >
          <span aria-hidden="true">{direction === "upp" ? "↑" : "↓"}</span>
          Idag
        </button>
      ) : null}
      </div>

      {/*
        ⛔ SAMMA NOD I BÅDA LÄGENA, med brytpunkten som enda skillnad. Två
        renderingar av samma panel hade betytt två ställen att rätta, och den ena
        hade varit den som ingen tittar på.

        TELEFON: `fixed` längst ner, ovanpå rutnätet, utan luft under.
        `pointer-events-none` på omslaget så den osynliga remsan inte äter tryck
        på dagarna under; panelen själv tar tillbaka dem.

        FRÅN 768 px: en vanlig kolumn i raden, 300 px, och 360 px från 1024 px.
        Förebildens egna tal.
      */}
      <div
        className={cx(
          "pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom))] z-(--z-sticky) flex justify-center px-4",
          "lg:pointer-events-auto lg:static lg:z-auto lg:block lg:w-75 lg:shrink-0 lg:px-0 xl:w-90",
        )}
      >
        {/* ⛔ KRYSSET OCH ESCAPE TÖMMER HELA URVALET och inte den översta dagen.
            Panelen är ETT objekt på skärmen, så en stängning som lämnade två av
            tre dagar kvar hade sett ut som att knappen inte fungerade. Enskilda
            dagar tas bort på sitt eget piller, eller med ett andra tryck i
            rutnätet. */}
        {days.length > 0 ? (
          <DayPanel
            days={days}
            statusWords={statusWords}
            onClose={() => setValda([])}
            onTaBort={(n) => setValda((forra) => forra.filter((x) => x !== n))}
          />
        ) : (
          /* ⛔ BARA PÅ BREDA SKÄRMAR. Kolumnen finns redan där och är tom, så en
              rad om vad den är till för kostar ingenting. På telefon finns ingen
              kolumn att förklara, och en ruta längst ner som säger «tryck på en
              dag» hade legat i vägen för dagarna man ska trycka på. */
          <p className="m-0 hidden rounded-md border border-dashed border-line p-3 text-sm text-ink-muted lg:block">
            Tryck på en dag för att se vad som ligger där. Tryck på fler för att samla dem.
          </p>
        )}
      </div>
    </section>
  );
}
