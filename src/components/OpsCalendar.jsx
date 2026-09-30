import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { kantKlass } from "../lib/kant.js";
import { slagKant, slagPrick, slagText } from "../lib/slag.js";
import { FULL_HEIGHT_CLASSES, useFullHeight } from "../lib/fullHeight.js";
import { radBehallare, radKlass, radRubrikKlass } from "../lib/radKlass.js";
import { rapporteraFel } from "../lib/felrapport.js";
import { STANDARD_TIDSZON, idagI, kontrolleraTidszon } from "../lib/kalendrar.js";
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
  isoVecka,
  datumOmfang,
  valjDag,
  valjVecka,
  valjIntervall,
  traffar,
} from "../lib/calendar.js";
import { ChevronNedIkon, KalenderIkon, KryssIkon, PlusIkon, ReglageIkon, SokIkon, VeckonummerIkon } from "./icons.jsx";
import { OpsStatusDot } from "./OpsStatusDot.jsx";
import { ValRad } from "./ValRad.jsx";

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
 * ⛔ FORTFARANDE INTE: lager, tillgänglighet, avatarer och export. De är egna faser i #179 (F4 och F6), och en knapp
 * för något som inte finns är ett löfte som inte infrias (arbetsreglernas punkt 5).
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
 * ══ ⛔ DAGPANELEN STAPLAS UNDER RUTNÄTET PÅ PEKSKÄRM (0.36.0) ═════════════
 *
 * Till 0.35.0 låg dagen i en flytande, inverterad bubbla `fixed` nära nederkanten, ovanpå rutnätet. SS gör det inte:
 * `CalendarView.jsx` lägger panelen UNDER rutnätet, `shrink-0 max-h-[45%]`, och rutnätet krymper i stället för att
 * täckas. Skälet syns i bruk: en bubbla över rutnätet döljer precis de dagar man vill trycka på härnäst, och med
 * flerdagsval och dra-markering är det de dagarna man arbetar med. Rullytan får därför dra av panelens uppmätta höjd
 * (`--ops-dagpanel`), och panelen har tak på 45 procent av ytan.
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
 * Hur många märken en ruta ritar innan den börjar räkna i stället.
 *
 * ⛔ TRE, OCH TALET ÄR MÄTT MOT RUTANS BREDD OCH INTE VALT. Vid 390 px är en
 * ruta 47,7 px bred och dess innehållsyta 39,7 px efter `px-1`. Tre märken på
 * 10 px med `gap-0.5` blir 34 px och ryms; tre på 12 px blir 40 px och gör inte
 * det. Skulle talet höjas måste märket krympa, och ett märke under 10 px är en
 * fläck.
 *
 * ⛔ HETTE `MAX_PRICKAR`. Namnet bytte när märket kunde bli en ikon: ett tal som
 * heter "prickar" och styr ikoner är det slags namn någon senare läser som att
 * det bara gäller det ena.
 */
const MAX_MARKEN = 3;

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
 * Märket i rutnätet: slagets ikon om posten har en, annars en prick.
 *
 * ══ ⛔ VARFÖR EN IKON OCH INTE BARA EN FÄRG ════════════════════════════
 *
 * CP 2026-09-24: "Går det att ha en färgad liten ikon (väldigt liten)?"
 *
 * Det är inte bara en smaksak, det är den andra kodningen paletten KRÄVER.
 * Validatorn lämnade en varning som står kvar med flit: slag-1 mot slag-2
 * ligger på delta E 6,9 vid rödgrönblindhet, vilket är tillåtet BARA med en
 * andra kodning. På raden är ordet den kodningen. I rutnätet fanns ingen: en
 * prick har inget ord bredvid sig, och rutans knappnamn säger antalet men inte
 * slaget. Formen är därför det enda som kan skilja två märken åt för den som
 * inte ser färgskillnaden.
 *
 * ── ⛔ RAMVERKET ÄGER STORLEKEN, APPEN ÄGER BILDEN ──────────────────────
 *
 * `[&>svg]:size-2.5`, alltså 10 px, och den tvingas HÄR. Samma `kindIcon` ritas
 * 16 px på raden i `OpsEventList`, eftersom en rad har plats. En ruta har inte
 * det, och appen kan inte veta hur bred rutan är hos den som tittar. Skickade
 * appen storleken skulle en 16 px ikon spränga rutnätet på en telefon, och det
 * felet syns först hos användaren.
 *
 * ⛔ CSS VINNER ÖVER SVG:NS EGNA `width` OCH `height`, så en ikon som kommer hit
 * med sitt radmått krymper i stället för att klippas.
 *
 * ⛔ STRECKET BLIR TJOCKARE, och det är räknat. Lucide ritar `stroke-width: 2` i
 * en 24-enheters viewBox. Skalat till 10 px blir det 2 gånger 10/24 = 0,83
 * enhetspixlar, alltså tunnare än en bildpunkt: bilden bleknar och formen går
 * förlorad precis när den behövs som mest. 2,75 ger 1,15 px, alltså ett helt
 * streck.
 *
 * ⛔ PRICKEN FINNS KVAR som fall tillbaka, och det är inte en rest. En post utan
 * `kindIcon` ska synas i rutnätet, och en appyta som inte har ikoner ska inte
 * bli tom av att den här möjligheten tillkom.
 *
 * ⛔ UTAN SLAG FÅR PRICKEN KALENDERNS FÄRG (0.36.0), och först därefter accenten. Pricken svarar fortfarande på "vad
 * är det": slaget vinner, kalendern är andrahandssvaret.
 *
 * @param {{ entry: import("../lib/calendar.js").CalendarEntry, vald?: boolean }} props
 */
function Slagmarke({ entry, vald = false }) {
  if (entry.kindIcon) {
    return (
      <span
        className={cx(
          "flex shrink-0 items-center [&>svg]:size-2.5 [&>svg]:[stroke-width:2.75]",
          slagText(entry.slag, entry.slagLabel, "OpsCalendar") || "text-accent",
        )}
      >
        {entry.kindIcon}
      </span>
    );
  }
  return (
    <span
      className={cx(
        "size-1.5 shrink-0 rounded-full",
        slagPrick(entry.slag, entry.slagLabel, "OpsCalendar") || (entry.kalender && KALENDERPRICK[entry.kalender.farg]) || (vald ? "bg-canvas" : "bg-accent"),
      )}
    />
  );
}

/**
 * Kalenderns färg som klass, utskriven (Tailwind läser källan som text, `bg-identity-${n}` ger ingen CSS).
 * Identitetspalettens sex toner, samma som `KALENDERFARGER` i `lib/kalendrar.js`.
 * @type {Record<number, string>}
 */
const KALENDERPRICK = {
  1: "bg-identity-1",
  2: "bg-identity-2",
  3: "bg-identity-3",
  4: "bg-identity-4",
  5: "bg-identity-5",
  6: "bg-identity-6",
};

/** Bandens ton: färgen med 20 procents täckning, utskriven (SS `color-mix(... 22%, transparent)`, `MonthGrid.jsx:218`). */
const KALENDERTON = {
  1: "bg-identity-1/20",
  2: "bg-identity-2/20",
  3: "bg-identity-3/20",
  4: "bg-identity-4/20",
  5: "bg-identity-5/20",
  6: "bg-identity-6/20",
};
/** @type {Record<number, string>} */
const SLAGTON = { 1: "bg-slag-1/20", 2: "bg-slag-2/20", 3: "bg-slag-3/20" };

/**
 * En posts färg som klasser: prick, vänsterkant och ton. Slaget om posten har ett, annars kalendern, annars accenten.
 *
 * ⛔ SAMMA ORDNING PÅ ALLA YTOR, så att pricken, pillret, bandet och kortets kant aldrig säger olika saker om samma post.
 * ⛔ KLASSER OCH ALDRIG EN INLINE-FÄRG (`check-closed-api` punkt 3): en färg i `style` går förbi tokenkontraktet och
 * mörkt läge.
 *
 * @param {import("../lib/calendar.js").CalendarEntry} e
 * @returns {{ prick: string, kant: string, ton: string }}
 */
function postklasser(e) {
  const slagPrickKlass = slagPrick(e.slag, e.slagLabel, "OpsCalendar");
  if (slagPrickKlass) return { prick: slagPrickKlass, kant: /** @type {string} */ (slagKant(e.slag, e.slagLabel, "OpsCalendar")), ton: SLAGTON[/** @type {number} */ (e.slag)] };
  if (e.kalender && KALENDERPRICK[e.kalender.farg]) {
    return { prick: KALENDERPRICK[e.kalender.farg], kant: /** @type {string} */ (kantKlass(e.kalender.farg, e.kalender.namn, "OpsCalendar")), ton: /** @type {Record<number, string>} */ (KALENDERTON)[e.kalender.farg] };
  }
  return { prick: "bg-accent", kant: "border-l-accent", ton: "bg-accent/20" };
}

/**
 * En dagsruta, som SessionStudios (`MonthGrid.jsx`): ett kort med datumet uppe till vänster, prickar på telefon och
 * piller med titel från 640 px.
 *
 * ⛔ EN `<button>` OCH INTE EN `<div onClick>`. SS har en div med en knapp i (`data-cal-day-press-band`, #2760) för att
 * pillren där är egna knappar. Här är pillren text: posten öppnas i dagpanelen, ett tryck bort. Då är hela rutan EN
 * knapp och inget är nästlat.
 *
 * ⛔ OCKSÅ EN TOM DAG ÄR TRYCKBAR (0.36.0). Till 0.35.0 var den `disabled`, med skälet att en knapp som öppnar en tom
 * lista lär en att knappar inte gör något. Med dagpanelens skapa-ruta och flerdagsval är en tom dag inte längre tom på
 * handling: det är just den dagen man väljer för att lägga något på den. Panelen säger "Inga poster" (punkt 5).
 *
 * ⛔ TRÄFFYTAN ÄR HELA RUTAN. En siffra är några pixlar bred, och en kalender man
 * missar med tummen är en kalender man slutar öppna.
 *
 * ⛔ INGEN MINSTA HÖJD UNDER 640 PX, fast SS har `min-h-[52px]`. Mätt i `check-skalyta` avsnitt 30: `aspect-[1/1.1]`
 * för över en minsta höjd till en minsta BREDD (52 / 1,1 = 47,3 px), och vid 390 px ryms bara 44,4 px per ruta i
 * rullytan. Sju rutor sköt ut 20 px ur raden, rullytan fick en vågrät rullning och banden slutade 3 px före sin sista
 * ruta. Proportionen ensam ger 49 px höjd, alltså samma höjd som SS utan överflödningen.
 *
 * @param {{ day: number, dayKey: string, entries: import("../lib/calendar.js").CalendarEntry[], markerade: import("../lib/calendar.js").CalendarEntry[], isToday: boolean, forbi: boolean, chosen: boolean, forhand: boolean, sok: "" | "traff" | "miss", bandhojd: number, pekare: Record<string, any> }} props
 */
function DagRuta({ day, dayKey, entries, markerade, isToday, forbi, chosen, forhand, sok, bandhojd, pekare }) {
  const count = entries.length;
  const label = count === 0 ? `${day}` : `${day}, ${count} ${count === 1 ? "post" : "poster"}`;
  const vald = chosen || forhand;

  /*
   * ⛔ RÄKNAREN TAR MÄRKENS PLATS, OCH BÅDA TALEN ÄR MÄTTA OCH INTE ANTAGNA (0.26.0, före 0.36.0 i en ruta på
   * 45,6 px). Mätt i Chromium vid 390 px: ett märke är 10 px, en siffra i räknaren 5,8 px.
   *
   *   tre märken, ingen räknare      34,0 px    ryms
   *   tre märken och "+2"            49,7 px    12 px UTANFÖR rutan
   *   två märken och "+2"            37,7 px    ryms
   *   ett märke och "+139"           39,0 px    UTANFÖR rutan
   *   inget märke och "+140"         27,0 px    ryms
   *
   * ⛔ DÄRFÖR RÄKNAS PLATSEN UR SIFFRORNA och sätts inte till ett fast tal. Ett "visa alltid två" hade varit grönt på
   * "+2" och rött igen på "+11". Rutan är sedan 0.36.0 ett kort med `p-1.5`, alltså smalare inuti, och `check-skalyta`
   * avsnitt 30 mäter att märkesraden inte spiller vid 390 px.
   *
   * ⛔ BANDEN RÄKNAS INTE HÄR. En flerdagspost är ett band över rutan, inte ett märke i den: `markerade` är dagens
   * poster utan band. Räknaren i knappens namn räknar alla.
   */
  const antal = markerade.length;
  const visade = antal > MAX_MARKEN ? Math.max(0, MAX_MARKEN - String(antal).length) : MAX_MARKEN;
  // ⛔ SS `MonthGrid.jsx:579` och `:700`: två piller, sedan "+N" för resten.
  const pillerVisade = 2;

  return (
    <button
      type="button"
      data-cal-day={dayKey}
      aria-pressed={chosen}
      aria-label={label}
      {...pekare}
      className={cx(
        "relative flex aspect-[1/1.1] min-w-0 cursor-pointer select-none flex-col items-stretch rounded-xl border p-1.5 text-left sm:min-h-20 sm:p-2",
        "transition-[background-color,border-color,transform] duration-(--duration-fast) ease-standard",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        // ⛔ SS `MonthGrid.jsx:381-392`, i ramverkets tokens: vald är en fylld accentyta som lyfts, en sökträff en tonad
        // ring, idag en tonad yta med en tunn ring, resten kort på ytan.
        vald
          ? "z-10 scale-[1.04] border-accent bg-accent text-canvas shadow-lg"
          : sok === "traff"
            ? "border-accent/40 bg-accent-faint ring-1 ring-accent/50"
            : isToday
              ? "border-line bg-accent-faint ring-1 ring-accent/30"
              : "border-line bg-surface hover:bg-raised",
      )}
    >
      {/* ⛔ FÖRBI ÄR NEDTONAT, OCH UNDER EN SÖKNING ÄR DET MISSEN SOM TONAS. SS `MonthGrid.jsx:413`: en halvgenomskinlig
          yta över rutan, 50 procent för det som varit, 70 för det sökningen inte träffar. */}
      {!vald && (sok === "miss" || (sok === "" && forbi)) ? (
        <span aria-hidden="true" data-nedtonad={sok === "miss" ? "sok" : "forbi"} className={cx("pointer-events-none absolute inset-0 z-1 rounded-xl bg-canvas", sok === "miss" ? "opacity-70" : "opacity-50")} />
      ) : null}
      <span className="relative z-2 flex min-h-5 items-start sm:min-h-6">
        {/* ⛔ IDAG ÄR ETT FYLLT PILLER RUNT SIFFRAN (SS `:450`), inte en ring runt hela rutan. Ringen krockade med
            markeringen, och en fylld siffra är det ögat hittar först i en månad. */}
        <span
          data-dagnummer=""
          className={cx(
            "shrink-0 text-meta font-semibold leading-none tabular-nums sm:text-etikett sm:leading-none",
            isToday ? (vald ? "rounded-full bg-canvas px-1.5 py-px font-bold text-accent" : "rounded-full bg-accent px-1.5 py-px text-canvas") : vald ? "font-bold text-canvas" : "text-ink",
          )}
        >
          {day}
        </span>
      </span>
      {/* ⛔ PLATS FÖR BANDEN under siffran, en rad per fil (SS `:547`). Banden ritas ovanpå veckoraden, och utan
          platsen hade märkena hamnat under dem. */}
      {bandhojd > 0 ? <span aria-hidden="true" data-bandplats="" style={{ height: bandhojd }} className="block shrink-0" /> : null}
      {/* ⛔ Dekor, och läses inte upp: antalet står redan i knappens namn. Prickar på telefon (SS `:552`). */}
      <span aria-hidden="true" data-kalender-marken="" className="mt-1 flex min-h-2 items-center justify-center gap-0.5 sm:hidden">
        {markerade.slice(0, visade).map((p) => (
          <Slagmarke key={p.id} entry={p} vald={vald} />
        ))}
        {antal > visade ? <span className={cx("text-mikro tabular-nums", vald ? "text-canvas" : "text-ink-muted")}>+{antal - visade}</span> : null}
      </span>
      {/* ⛔ PILLER MED TITEL FRÅN 640 PX (SS `:579`), två och sedan ett "+N". Vänsterkanten i postens färg, samma färg
          som pricken, och ingen ikon: märket i ikonform finns på telefonen, och ett piller bär titeln i stället. */}
      <span aria-hidden="true" data-kalender-piller="" className="mt-1 hidden min-w-0 flex-col gap-0.5 sm:flex">
        {markerade.slice(0, pillerVisade).map((p) => (
          <span
            key={p.id}
            className={cx(
              "block min-w-0 truncate rounded-md py-px pr-1 pl-1 text-liten",
              vald ? "bg-canvas/15 text-canvas" : cx("border-l-3 bg-ink-secondary/15 text-ink-secondary", postklasser(p).kant),
            )}
          >
            {p.title}
          </span>
        ))}
        {antal > pillerVisade ? <span className={cx("pl-1 text-liten tabular-nums", vald ? "text-canvas" : "text-ink-muted")}>+{antal - pillerVisade}</span> : null}
      </span>
    </button>
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
 * @param {{ dayKey: string, kanTasBort: boolean, onTaBort: (dayKey: string) => void, order: number, locale: string }} props
 */
function Datumpiller({ dayKey, kanTasBort, onTaBort, order, locale }) {
  const text = dateText(dayKey, locale);
  return (
    <span
      style={{ animationDelay: `${order * SVEPSTEG}ms` }}
      className="ops-contrast-panel inline-flex animate-svep items-center gap-1.5 rounded-full bg-contrast-panel py-1 pr-2 pl-2.5 text-meta font-semibold text-ink shadow-md"
    >
      {text}
      {kanTasBort ? (
        <button
          type="button"
          onClick={() => onTaBort(dayKey)}
          aria-label={`Ta bort ${text}`}
          className="flex cursor-pointer items-center text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <KryssIkon size={10} />
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
 * @param {{ dayKey: string, entry: import("../lib/calendar.js").CalendarEntry, statusWords: Record<string, string>, order: number, locale: string }} props
 */
function Postkort({ dayKey, entry, statusWords, order, locale }) {
  const [oppen, setOppen] = useState(false);
  const idBas = useId();
  const panelId = `${idBas}-detaljer`;

  /*
   * ⛔ EN FLERDAGSPOST SÄGER SITT HELA SPANN, EN HELDAGSPOST SÄGER "HELDAG" (0.36.0). Kortet står under en av dagarna,
   * och utan spannet ser en semester över tre dagar ut som tre semestrar i panelen när tre dagar är valda.
   */
  const spann = entry.endDate && entry.endDate > entry.date ? `${dateText(entry.date, locale)} till ${dateText(entry.endDate, locale)}` : dateText(dayKey, locale);
  const meta = [spann, entry.allDay ? "Heldag" : "", entry.not || ""].filter(Boolean).join(" · ");

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
      className={cx(
        "ops-contrast-panel animate-svep rounded-xl bg-contrast-panel p-2.5 shadow-md",
        kanten && cx("border-l-4", kanten),
      )}
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
          <span className="font-semibold text-ink">{entry.title}</span>
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
        <div id={panelId} hidden={!oppen} className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-etikett">
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
 * De valda dagarnas poster: piller överst, korten till vänster, antalet och skapa-rutan till höger.
 *
 * ══ ⛔ VAR DEN LIGGER, OCH VARFÖR DET ÄR TVÅ OLIKA SVAR ════════════════
 *
 * CP 2026-09-22: "Se var bubblorna är i web där det finns utrymme och se var de
 * finns i mobil och hur det ser ut."
 *
 *   SMALT: UNDER rutnätet, högst 45 procent av ytan, och rutnätet krymper (SS `CalendarView.jsx:208`, `shrink-0
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
 * @param {{ days: { dayKey: string, entries: import("../lib/calendar.js").CalendarEntry[] }[], statusWords: Record<string, string>, onClose: () => void, onTaBort: (dayKey: string) => void, onSkapa?: () => void, locale: string }} props
 */
function DayPanel({ days, statusWords, onClose, onTaBort, onSkapa, locale }) {
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

  return (
    <section aria-label={name} data-dagpanel="" className="flex w-full flex-col gap-2 p-3 lg:p-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {days.map((d, i) => (
          <Datumpiller key={d.dayKey} dayKey={d.dayKey} kanTasBort={flera} onTaBort={onTaBort} order={i} locale={locale} />
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
          <KryssIkon size={14} />
        </button>
      </div>

      <div className="flex gap-2">
        <div className="flex min-w-0 flex-3 flex-col gap-2">
          {antal === 0 ? <p className="m-0 py-2 text-meta text-ink-muted">Inga poster {flera ? "de valda dagarna" : "den här dagen"}.</p> : null}
          {/* ⛔ TRAPPAN RÄKNAS ÖVER HELA PANELEN och inte per dag. Räknades den om
              för varje dag skulle första kortet under varje datum svepa in
              samtidigt, och det som ska läsas som en rörelse blir tre. */}
          {kort.flatMap((d, di) =>
            d.entries.map((p, pi) => (
              <Postkort
                key={`${d.dayKey}-${p.id}`}
                dayKey={d.dayKey}
                entry={p}
                statusWords={statusWords}
                order={days.length + kort.slice(0, di).reduce((n, x) => n + x.entries.length, 0) + pi}
                locale={locale}
              />
            )),
          )}
        </div>
        <div className="flex w-14 shrink-0 flex-col gap-2 lg:w-auto lg:flex-1">
          <div data-dagantal="" className="ops-contrast-panel flex aspect-square flex-col items-center justify-center rounded-xl bg-contrast-panel text-ink shadow-md">
            <span className="text-titel font-bold leading-none tabular-nums">{antal}</span>
            <span className="mt-0.5 text-mikro uppercase tracking-wide text-ink-secondary">{antal === 1 ? "post" : "poster"}</span>
          </div>
          {onSkapa ? (
            <button
              type="button"
              onClick={onSkapa}
              aria-label={flera ? `Skapa för ${days.length} valda dagar` : `Skapa den ${title}`}
              className="ops-contrast-panel flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl bg-contrast-panel text-ink shadow-md hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <PlusIkon size={18} />
              <span className="mt-0.5 text-mikro uppercase tracking-wide">Skapa</span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Snabbtitten: en dag i en liten inverterad ruta, utan att urvalet ändras (SS `CalendarDayPeekPopover.jsx`).
 *
 * ⛔ DEN VISAR DAGENS ALLA POSTER, OCKSÅ DE FILTRET DÖLJER, MÄRKTA "DOLD" (SS #94). Filtret avgör vad rutnätet ritar,
 * inte vad som finns. Den som filtrerat bort en kalender och undrar om dagen är ledig ska kunna se att den inte är det.
 *
 * ⛔ TRE VÄGAR UT: krysset, Escape och ett tryck utanför. Placeringen hålls inom fönstret (SS
 * `clampCalendarDayPeekPosition`), annars hamnar en titt på en söndag halvvägs utanför skärmen.
 *
 * @param {{ ankare: { dayKey: string, x: number, y: number }, alla: import("../lib/calendar.js").CalendarEntry[], synliga: Set<string>, onClose: () => void, locale: string }} props
 */
function Snabbtitt({ ankare, alla, synliga, onClose, locale }) {
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

  const bredd = 280;
  const hojd = 300;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const left = Math.max(8, Math.min(ankare.x - bredd / 2, vw - bredd - 8));
  const top = ankare.y + 6 + hojd > vh - 8 ? Math.max(8, ankare.y - hojd - 6) : ankare.y + 6;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={rubrikId}
      data-snabbtitt=""
      style={{ left, top }}
      className="ops-contrast-panel fixed z-(--z-dropdown) max-h-75 w-70 overflow-y-auto rounded-xl bg-contrast-panel p-2.5 text-ink shadow-xl"
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p id={rubrikId} className="m-0 flex-1 px-0.5 text-liten font-semibold uppercase tracking-wide text-ink-secondary">
          {dateText(ankare.dayKey, locale)}
        </p>
        <button type="button" onClick={onClose} aria-label={`Stäng snabbtitten för ${dateText(ankare.dayKey, locale)}`} className="shrink-0 cursor-pointer rounded-md p-0.5 text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
          <KryssIkon size={14} />
        </button>
      </div>
      {alla.length === 0 ? <p className="m-0 px-0.5 py-1 text-hjalp text-ink-secondary">Inga poster den här dagen.</p> : null}
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {alla.map((e) => {
          const dold = !synliga.has(e.id);
          return (
            <li key={e.id} data-titt-rad={dold ? "dold" : "synlig"} className={cx("flex items-start gap-2 rounded-md px-1 py-1", dold && "opacity-50")}>
              <span aria-hidden="true" className={cx("mt-1 size-2 shrink-0 rounded-full", postklasser(e).prick)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-meta font-semibold">{e.title}</span>
                {e.kalender || e.not || e.allDay ? (
                  <span className="block truncate text-liten text-ink-secondary">{[e.allDay ? "Heldag" : "", e.not || "", e.kalender ? e.kalender.namn : ""].filter(Boolean).join(" · ")}</span>
                ) : null}
              </span>
              {dold ? <span className="shrink-0 rounded-full border border-line px-1.5 text-mikro uppercase tracking-wide">Dold</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Klassen för en ikonknapp i verktygsraden: SS `w-8 h-8` från 768 px, 44 px träffyta under. */
const VERKTYG = "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base border transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:size-8";
/** @param {boolean} aktiv */
const verktygsklass = (aktiv) => cx(VERKTYG, aktiv ? "border-accent/40 bg-accent-subtle text-accent" : "border-line bg-surface text-ink-muted hover:text-ink-secondary");

/**
 * @typedef {object} KalenderVal
 * @property {string} id
 * @property {string} namn
 * @property {1|2|3|4|5|6} farg
 * @property {boolean} [grupp] Gruppens kalender (annars en av mina).
 * @property {boolean} [forvald] Den som en post utan `kalender` hör till.
 */

/**
 * Verktygsraden över rutnätet (SS `CalendarViewToolbar.jsx`): Kalendrar, veckonummer, typ och status, sök, "+".
 *
 * ⛔ HÖGERSTÄLLD, SOM I SS (`ml-auto`). Rubriken och gruppen står i appens huvud ovanför, och raden är verktyg, inte en
 * rubrik.
 *
 * ⛔ EN KONTROLL FINNS BARA NÄR DEN GÖR NÅGOT. Utan `kalendrar` ingen kalenderväljare, utan typer och statusord inget
 * filter, utan `onSkapa` inget plus (punkt 5). Veckonummer och sök kräver ingenting av appen och finns alltid.
 *
 * @param {object} props
 * @param {KalenderVal[] | undefined} props.kalendrar
 * @param {string[] | null} props.valdaKalendrar `null` är alla.
 * @param {(v: string[] | null) => void} props.onValdaKalendrar
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
 */
function Verktygsrad({ kalendrar, valdaKalendrar, onValdaKalendrar, onHanteraKalendrar, veckonummer, onVeckonummer, typer, statusWords, typ, onTyp, status, onStatus, sokOppen, onSok, onSkapa }) {
  const statusar = Object.entries(statusWords);
  const harFilter = typer.length > 0 || statusar.length > 0;
  const gruppens = (kalendrar || []).filter((k) => k.grupp);
  const mina = (kalendrar || []).filter((k) => !k.grupp);
  /** @param {string} id */
  const vaxla = (id) => {
    const bas = valdaKalendrar || [];
    const nasta = bas.includes(id) ? bas.filter((x) => x !== id) : [...bas, id];
    // ⛔ ETT TOMT URVAL ÄR "ALLA" OCH INTE "INGA". En kalender utan något valt hade ritat en tom månad som ser ut som
    // att posterna saknas, och den som vill se ingenting har ingen anledning att öppna kalendern.
    onValdaKalendrar(nasta.length === 0 ? null : nasta);
  };
  const valdaNamn = (kalendrar || []).filter((k) => valdaKalendrar && valdaKalendrar.includes(k.id));
  const etikett = !valdaKalendrar ? "Alla kalendrar" : valdaNamn.length === 1 ? valdaNamn[0].namn : `${valdaNamn.length} kalendrar`;
  /** @param {KalenderVal} k */
  const rad = (k) => (
    <ValRad key={k.id} chosen={!!valdaKalendrar && valdaKalendrar.includes(k.id)} onClick={() => vaxla(k.id)} ikon={<span className={cx("block size-2.5 rounded-full", KALENDERPRICK[k.farg] || "bg-accent")} />}>
      {k.namn}
    </ValRad>
  );

  return (
    <div role="toolbar" aria-label="Kalenderverktyg" data-kalender-verktyg="" className="flex shrink-0 items-center justify-end gap-1.5 pb-2">
      {kalendrar ? (
        <Popover.Root>
          <Popover.Trigger
            aria-label={`Kalendrar: ${etikett}`}
            data-kalenderval=""
            className={cx(
              "inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-1.5 rounded-base border px-2 text-meta font-medium text-ink md:min-h-8",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              valdaKalendrar ? "border-accent/40 bg-accent-subtle" : "border-line bg-surface hover:border-line-strong",
            )}
          >
            <span aria-hidden="true" className="flex text-ink-muted">
              <KalenderIkon size={16} />
            </span>
            <span className="max-w-40 truncate">{etikett}</span>
            <ChevronNedIkon size={14} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={6} aria-label="Kalendrar" className={cx("z-(--z-dropdown) max-h-[70vh] w-64 overflow-y-auto p-1", radBehallare())}>
              <ValRad chosen={!valdaKalendrar} onClick={() => onValdaKalendrar(null)} ikon={<KalenderIkon size={16} />}>
                Alla kalendrar
              </ValRad>
              <div className="mt-2 flex flex-col">
                <p className={radRubrikKlass}>Gruppens kalendrar</p>
                {gruppens.length > 0 ? gruppens.map(rad) : <p className="m-0 px-3 py-1.5 text-meta text-ink-muted">Gruppen har inga kalendrar ännu.</p>}
              </div>
              <div className="mt-2 flex flex-col">
                <p className={radRubrikKlass}>Mina kalendrar</p>
                {mina.length > 0 ? mina.map(rad) : <p className="m-0 px-3 py-1.5 text-meta text-ink-muted">Du har inga egna kalendrar ännu.</p>}
              </div>
              <div className="mt-2 border-t border-line pt-1">
                {/* ⛔ PLATSEN FINNS, OCH DEN SÄGER VAD DEN ÄR (punkt 5). "Hantera kalendrar" byggs i fas F2 (#179). En knapp
                    som inte gör något hade lärt att knappen inte gör något; en tom plats hade sett ut som ett fel. */}
                {onHanteraKalendrar ? (
                  <button type="button" onClick={onHanteraKalendrar} className={radKlass({ accentFarg: true })}>
                    Hantera kalendrar
                  </button>
                ) : (
                  <p data-hantera-kommer="" className="m-0 px-3 py-2 text-meta text-ink-muted">
                    Hantera kalendrar kommer i nästa steg (#179 F2).
                  </p>
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
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

      <button type="button" aria-expanded={sokOppen} aria-label="Sök i kalendern" onClick={onSok} className={verktygsklass(sokOppen)}>
        <SokIkon size={14} />
      </button>

      {onSkapa ? (
        <button type="button" aria-label="Skapa" onClick={onSkapa} className={cx(VERKTYG, "border-line bg-surface text-accent hover:bg-accent-faint")}>
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
      className={cx("pointer-events-none absolute inset-x-0 z-20 grid gap-1 sm:gap-1.5", veckonummer ? "grid-cols-[2rem_repeat(7,minmax(0,1fr))]" : "grid-cols-7")}
      style={{ top: "var(--ops-bandtopp)" }}
    >
      {veckonummer ? <div /> : null}
      <div className="col-span-7 grid grid-cols-7 gap-x-1 sm:gap-x-1.5" style={{ rowGap: BANDLUFT, gridAutoRows: BANDHOJD }}>
        {bitar.map((b) => (
          <span
            key={`${b.entry.id}-${b.startCol}`}
            data-bandbit={b.entry.id}
            style={{ gridColumn: `${b.startCol + 1} / span ${b.colSpan}`, gridRow: b.fil + 1 }}
            className={cx(
              "flex min-w-0 items-center truncate px-1.5 text-liten font-medium text-ink",
              postklasser(b.entry).ton,
              b.borjar ? cx("rounded-l-md border-l-3", postklasser(b.entry).kant) : "",
              b.slutar ? "rounded-r-md" : "",
            )}
          >
            <span className="truncate">{b.entry.title}</span>
          </span>
        ))}
      </div>
    </div>
  );
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
 *   kalenderväljaren. En post utan `kalender` hör till den förvalda.
 * @param {{ id: string, namn: string }[]} [props.typer] Typerna i typfiltret. Jämförs med postens `typ`.
 * @param {(datum: string[]) => void} [props.onSkapa] "+" i verktygsraden och skapa-rutan i dagpanelen. Får de valda
 *   dagarna, eller idag när ingen är vald.
 * @param {() => void} [props.onHanteraKalendrar] Raden längst ned i kalenderväljaren. Utan den står en rad som säger
 *   att det kommer (#179 F2).
 * @param {{ getItem: (n: string) => string | null, setItem: (n: string, v: string) => void }} [props.lagring] Var
 *   veckonummervalet sparas, per enhet. Förval `window.localStorage` när den finns.
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
  typer = [],
  onSkapa,
  onHanteraKalendrar,
  lagring,
}) {
  if (!ariaLabel) {
    throw new Error("OpsCalendar: ariaLabel krävs. Ett rutnät med tal är osynligt för den som inte ser det.");
  }
  const zon = useMemo(() => kontrolleraTidszon(tidszon), [tidszon]);

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
  const [valdaKalendrar, setValdaKalendrar] = useState(/** @type {string[] | null} */ (null));
  const [typ, setTyp] = useState("alla");
  const [status, setStatus] = useState("alla");
  const [sokOppen, setSokOppen] = useState(false);
  const [fraga, setFraga] = useState("");
  const [titt, setTitt] = useState(/** @type {{ dayKey: string, x: number, y: number } | null} */ (null));

  const lager = lagring || (typeof window !== "undefined" ? window.localStorage : undefined);
  const [veckonummer, setVeckonummer] = useState(() => {
    try {
      return lager ? lager.getItem(VECKONUMMER_NYCKEL) === "1" : false;
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
        lager?.setItem(VECKONUMMER_NYCKEL, n ? "1" : "0");
      } catch (fel) {
        rapporteraFel(fel, { yta: "OpsCalendar", steg: "spara veckonummer" });
      }
      return n;
    });
  }, [lager]);

  /*
   * ⛔ FILTRET AVGÖR VAD SOM RITAS, INTE VAD SOM FINNS. `synliga` är det rutnätet, banden och dagpanelen ritar, och
   * snabbtitten visar resten märkt "Dold".
   */
  const forvaldId = useMemo(() => {
    const g = (kalendrar || []).filter((k) => k.grupp);
    return ((g.find((k) => k.forvald) || g[0] || (kalendrar || []).find((k) => k.forvald)) || { id: "" }).id;
  }, [kalendrar]);
  const synligaPoster = useMemo(
    () =>
      entries.filter((e) => {
        if (valdaKalendrar && !valdaKalendrar.includes(e.kalender ? e.kalender.id : forvaldId)) return false;
        if (typ !== "alla" && e.typ !== typ) return false;
        if (status !== "alla" && e.status !== status) return false;
        return true;
      }),
    [entries, valdaKalendrar, forvaldId, typ, status],
  );
  const synligaId = useMemo(() => new Set(synligaPoster.map((e) => e.id)), [synligaPoster]);
  const byKey = useMemo(() => perDay(synligaPoster), [synligaPoster]);
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

  const fullhojd = useFullHeight(rulleRef);

  /*
   * ⛔ DAGPANELENS HÖJD MÄTS OCH DRAS AV RULLYTAN UNDER 1024 PX (0.36.0). Panelen ligger under rutnätet, och rullytan
   * når annars bottenraden ändå: panelen hade hamnat under den. Taket är 45 procent av ytan (SS `max-h-[45%]`).
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

  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof ResizeObserver !== "function") {
      setPanelHojd(0);
      return undefined;
    }
    const mat = () => setPanelHojd(panelOppen && el.offsetHeight ? el.offsetHeight : 0);
    mat();
    const obs = new ResizeObserver(mat);
    obs.observe(el);
    return () => obs.disconnect();
  }, [panelOppen]);

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

  const oppnaTitt = useCallback((/** @type {string} */ dayKey, /** @type {HTMLElement} */ el) => {
    const r = el.getBoundingClientRect();
    setTitt({ dayKey, x: r.left + r.width / 2, y: r.bottom });
  }, []);

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
      const el = e.currentTarget;
      langRef.current = setTimeout(() => {
        svaljKlick.current = true;
        svepRef.current = null;
        setSvepar(false);
        setSvep(null);
        oppnaTitt(dayKey, el);
      }, 450);
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
      oppnaTitt(dayKey, e.currentTarget);
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
    <section aria-label={ariaLabel} data-ops-kalender="" className="flex flex-col lg:flex-row lg:items-start lg:gap-4">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Verktygsrad
          kalendrar={kalendrar}
          valdaKalendrar={valdaKalendrar}
          onValdaKalendrar={setValdaKalendrar}
          onHanteraKalendrar={onHanteraKalendrar}
          veckonummer={veckonummer}
          onVeckonummer={vaxlaVeckonummer}
          typer={typer}
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
        />
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
            const m = todayRef.current;
            if (!m) return;
            setDirection(scrollDirection(m.getBoundingClientRect(), e.currentTarget.getBoundingClientRect()));
          }}
          style={/** @type {import("react").CSSProperties} */ ({ ...fullhojd, "--ops-dagpanel": `${panelHojd}px` })}
          className={cx(
            "relative bg-canvas px-1",
            FULL_HEIGHT_CLASSES,
            // ⛔ Under 1024 px drar rullytan av dagpanelen, som då ligger under den. Negativa marginalen flyttar med.
            panelOppen && "max-lg:mb-0 max-lg:h-[calc(var(--fullhojd-botten)_-_var(--fullhojd-topp)_-_var(--ops-dagpanel))]",
          )}
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
                <div key={`${ar}-${month}`} ref={isCurrentMonth ? todayRef : null}>
                  <h3 className="m-0 mt-2 mb-3 text-titel font-bold capitalize text-ink font-display sm:text-sida">
                    {monthNames(locale)[month]} {ar}
                  </h3>

                  <div className="flex flex-col gap-1 sm:gap-1.5">
                    {rows.map((row, i) => {
                      const nycklar = row.map((day) => (day === null ? null : dateKey(ar, month, day)));
                      const bitar = bandIVecka(nycklar, synligaPoster);
                      const filer = bitar.reduce((m, b) => Math.max(m, b.fil + 1), 0);
                      const bandhojd = filer > 0 ? filer * BANDHOJD + (filer - 1) * BANDLUFT + 4 : 0;
                      const forsta = row.find((d) => d !== null);
                      const veckodagar = /** @type {string[]} */ (nycklar.filter(Boolean));
                      const helaVeckan = veckodagar.length > 0 && veckodagar.every((d) => chosen.includes(d));
                      return (
                        <div
                          key={i}
                          data-veckorad=""
                          className={cx("relative grid gap-1 sm:gap-1.5 [--ops-bandtopp:1.75rem] sm:[--ops-bandtopp:2.25rem]", gridKlass)}
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
                            return (
                              <DagRuta
                                key={dayKey}
                                day={day}
                                dayKey={dayKey}
                                entries={pa}
                                markerade={pa.filter((e) => !arBand(e))}
                                isToday={dayKey === todayDayKey}
                                forbi={dayKey < todayDayKey}
                                chosen={chosen.includes(dayKey)}
                                forhand={!!svep && svep.has(dayKey)}
                                sok={traffDagar ? (traffDagar.has(dayKey) ? "traff" : "miss") : ""}
                                bandhojd={bandhojd}
                                pekare={pekareFor(dayKey)}
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
        </div>

        {/* ⛔ `absolute` I KOLUMNENS HÖRN, inte `sticky` i flödet: knappen hör till rutnätet och ska stå still medan det
            rullar under den. Pilen pekar åt det håll idag ligger (SS `CalView.jsx:176-194`). */}
        {showBack ? (
          <button
            type="button"
            onClick={() => toToday("smooth")}
            className={cx(
              "absolute right-4 bottom-4 z-(--z-sticky) flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-raised px-4 text-etikett font-semibold text-ink shadow-md",
              "hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            )}
          >
            <span aria-hidden="true">{direction === "upp" ? "↑" : "↓"}</span>
            Idag
          </button>
        ) : null}
      </div>

      {/*
        ⛔ SAMMA NOD I BÅDA LÄGENA. Under 1024 px: under rutnätet, högst 45 procent av ytan, med egen rullning och den
        negativa marginal rullytan annars har (den når bottenraden). Från 1024 px: en kolumn på 300 px, 360 från 1280.
      */}
      <div
        ref={panelRef}
        data-dagpanel-plats=""
        style={/** @type {import("react").CSSProperties} */ ({ "--ops-dagpanel-max": `${Math.round(ytan * 0.45)}px` })}
        className={cx(
          "shrink-0 lg:w-75 lg:overflow-visible xl:w-90",
          panelOppen && "max-lg:-mb-6 max-lg:max-h-(--ops-dagpanel-max) max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:border-t max-lg:border-line max-lg:bg-surface",
        )}
      >
        {panelOppen ? (
          <DayPanel days={days} statusWords={statusWords} onClose={() => setValda([])} onTaBort={(n) => setValda((f) => f.filter((x) => x !== n))} onSkapa={skapa} locale={locale} />
        ) : (
          /* ⛔ BARA PÅ BREDA SKÄRMAR. Kolumnen finns redan där och är tom, så en rad om vad den är till för kostar
              ingenting. På telefon finns ingen kolumn att förklara. */
          <p className="m-0 hidden rounded-md border border-dashed border-line p-3 text-etikett text-ink-muted lg:block">
            Tryck på en dag för att se vad som ligger där. Tryck på fler, eller dra över dem, för att samla dem.
          </p>
        )}
      </div>

      {titt ? (
        <Snabbtitt
          ankare={titt}
          alla={allaPerDag.get(titt.dayKey) || []}
          synliga={synligaId}
          onClose={() => setTitt(null)}
          locale={locale}
        />
      ) : null}
    </section>
  );
}
