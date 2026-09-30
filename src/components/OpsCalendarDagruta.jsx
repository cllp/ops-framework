import { cx } from "../lib/cx.js";
import { markorlayout } from "../lib/calendar.js";
import { postklasser } from "../lib/kalenderfarg.js";

/**
 * Dagsrutan i `OpsCalendar`, och dess tre delar: siffran, märkesraden (telefon), pillerraden (från 640 px) och hörnmärkena
 * (0.37.0, utbruten ur `OpsCalendar.jsx`). Inte en publik komponent: rutan är kalenderns, och `OpsCalendar dagdekor` är
 * vägen in för det som ska ritas i den.
 */

/*
 * ══ ⛔ RUTANS MÄRKEN PÅ TELEFON: PRICKAR OCH STRECK, INTE IKONER (0.37.0) ══════════════════════════════════════════════
 *
 * Från 0.26.0 ritade rutan slagets ikon (`kindIcon`, 10 px) när posten hade en. Skälet var CP 2026-09-24 ("Går det att ha
 * en färgad liten ikon (väldigt liten)?") och att formen är en andra kodning för den som inte ser färgskillnaden mellan
 * slag-1 och slag-2.
 *
 * CP 2026-09-30 22:30, med en skärmbild ur SS-appen bredvid vår: "Vi kanske skall ta SessionStudios format rakt av och ha
 * prickar och streck istället med rätt färg för kategori?", efter att först ha velat behålla ikonerna och sedan sagt att
 * "flerdagars blir ju bättre med prickar och streck". Beslutet är SS format rakt av (`markorlayout`), i kategorins färg.
 * Ikonerna finns kvar där de får plats: dagpanelens kort, `OpsEventList` och snabbtitten, där slagets ord också står.
 * Den andra kodningen i rutan är alltså borta; den finns ett tryck bort, med ordet.
 */

/**
 * En dagsruta, som SessionStudios: på telefon som SS-appen (`apps/mobile/components/calendar/DayCell.js`), siffran centrerad
 * och prickar och streck under; från 640 px som SS webb (`calView/MonthGrid.jsx`), siffran uppe till vänster och piller.
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
 * ⛔ TVÅ PLATSER FÖR FAS F6, OCH INGEN LAGERLOGIK (0.37.0). CP 2026-09-30, med en skärmbild ur SS-appen med lager och
 * tillgänglighet påslagna: "Även sedan med kalender lager och tillgänglighet kommer vi att behöva rendera som i ss." SS lägger
 * lagrets ton som bakgrund på rutan och runda märken i rutans övre högra hörn (lagret, "x2" borta). `dekor` är de två
 * platserna: `ton` (identitetspalettens sex) och `hornmarken` (appens innehåll i en rund ruta var, med ett ord som läses
 * upp). Vad som hamnar där avgör F6; rutan vet bara var det ritas.
 *
 * @param {{ day: number, dayKey: string, entries: import("../lib/calendar.js").CalendarEntry[], markerade: import("../lib/calendar.js").CalendarEntry[], spann: import("../lib/calendar.js").CalendarEntry[], enkla: import("../lib/calendar.js").CalendarEntry[], isToday: boolean, forbi: boolean, chosen: boolean, forhand: boolean, sok: "" | "traff" | "miss", bandhojd: number, pekare: Record<string, any>, dekor?: Dagdekor }} props
 */
export function Dagruta({ day, dayKey, entries, markerade, spann, enkla, isToday, forbi, chosen, forhand, sok, bandhojd, pekare, dekor }) {
  const count = entries.length;
  const hornmarken = dekor?.hornmarken ?? [];
  const label = [count === 0 ? `${day}` : `${day}, ${count} ${count === 1 ? "post" : "poster"}`, ...hornmarken.map((h) => h.etikett)].join(", ");
  const vald = chosen || forhand;

  return (
    <button
      type="button"
      data-cal-day={dayKey}
      aria-pressed={chosen}
      aria-label={label}
      {...pekare}
      className={cx(
        "relative flex aspect-[1/1.1] min-w-0 cursor-pointer select-none flex-col items-stretch border p-1 text-left sm:min-h-20 sm:p-2",
        "transition-[background-color,border-color,transform] duration-(--duration-fast) ease-standard",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        /*
         * ⛔ RUNDNINGEN ÄR SS:S, UR TOKENS (0.37.0). CP 2026-09-30 22:30, med en skärmbild ur SS-appen bredvid vår: "Rundningen
         * i cellerna är fel." 0.36.0 hade `rounded-xl`, som i ramverkets tokens är 20 px (`--radius-xl`), medan SS webb
         * `rounded-xl` är Tailwinds 12 px och SS-appens `radius.md` också är 12. På en ruta som är 44 px bred blev 20 px
         * nästan en kapsel. Nu `rounded-base` (`--radius-base`, 12 px), och den valda `rounded-lg` (`--radius-lg`, 16 px) som
         * SS-appens `radius.lg`.
         *
         * ⛔ VALD ÄR EN MÖRK FYLLD RUTA MED LJUS TEXT, som SS-appen (`colors.accent`, som i SS är mörk, `radius.lg`, skugga
         * och `scale 1.05`). 0.36.0 fyllde med ramverkets accent, och det blev en stor olivfärgad kapsel. Den mörka ytan är
         * ramverkets inverterade yta, samma som dagpanelens kort. Idag är en tonad ruta med en mörkare kant (SS `accent`
         * med 4 och 30 procent), och siffran står i en mörk cirkel.
         */
        vald
          ? "ops-contrast-panel z-10 scale-[1.05] rounded-lg border-contrast-panel bg-contrast-panel text-ink shadow-lg"
          : cx(
              "rounded-base",
              sok === "traff"
                ? "border-accent/40 bg-accent-faint ring-1 ring-accent/50"
                : isToday
                  ? "border-contrast-panel/30 bg-contrast-panel/5"
                  : "border-line bg-surface hover:bg-raised",
            ),
      )}
    >
      {dekor?.ton && !vald ? <span aria-hidden="true" data-dagton={dekor.ton} className={cx("pointer-events-none absolute inset-0 rounded-base", DAGTON[dekor.ton])} /> : null}
      {/* ⛔ FÖRBI ÄR NEDTONAT, OCH UNDER EN SÖKNING ÄR DET MISSEN SOM TONAS. SS `MonthGrid.jsx:413`: en halvgenomskinlig
          yta över rutan, 50 procent för det som varit, 70 för det sökningen inte träffar. */}
      {!vald && (sok === "miss" || (sok === "" && forbi)) ? (
        <span aria-hidden="true" data-nedtonad={sok === "miss" ? "sok" : "forbi"} className={cx("pointer-events-none absolute inset-0 z-1 rounded-base bg-canvas", sok === "miss" ? "opacity-70" : "opacity-50")} />
      ) : null}
      <Dagnummer day={day} isToday={isToday} vald={vald} />
      {/* ⛔ PLATS FÖR BANDEN under siffran från 640 px, en rad per fil (SS `:547`). På telefon finns inga band: där är en
          flerdagspost ett streck i varje ruta den täcker, som i SS-appen. */}
      {bandhojd > 0 ? <span aria-hidden="true" data-bandplats="" style={{ height: bandhojd }} className="hidden shrink-0 sm:block" /> : null}
      <Markorrad spann={spann} enkla={enkla} vald={vald} />
      <Pillerrad markerade={markerade} vald={vald} />
      {hornmarken.length > 0 ? <Hornmarken marken={hornmarken} /> : null}
    </button>
  );
}

/**
 * @typedef {object} Dagdekor
 * @property {1|2|3|4|5|6} [ton] En ton ur identitetspaletten som bakgrund på rutan (SS lagrets `tint`).
 * @property {ReadonlyArray<{ id: string, etikett: string, innehall: import("react").ReactNode }>} [hornmarken] Runda märken
 *   i rutans övre högra hörn (SS lager och tillgänglighet). `etikett` läggs till i rutans knappnamn.
 */

/** Tonen som klass, utskriven (Tailwind läser källan som text). SS `tintOpacity` förval 0,12 till 0,25: här 15. @type {Record<number, string>} */
const DAGTON = { 1: "bg-identity-1/15", 2: "bg-identity-2/15", 3: "bg-identity-3/15", 4: "bg-identity-4/15", 5: "bg-identity-5/15", 6: "bg-identity-6/15" };

/**
 * Siffran. ⛔ CENTRERAD PÅ TELEFON I EN 28 PX PLATS (SS-appen `dayNumberContainer`, `todayCircle`), uppe till vänster från
 * 640 px som SS webb. Idag är en mörk cirkel på telefon och ett mörkt piller från 640 px.
 * @param {{ day: number, isToday: boolean, vald: boolean }} props
 */
function Dagnummer({ day, isToday, vald }) {
  return (
    <span className="relative z-2 flex min-h-7 items-center justify-center sm:min-h-6 sm:items-start sm:justify-start">
      <span
        data-dagnummer=""
        className={cx(
          "shrink-0 text-meta font-semibold leading-none tabular-nums sm:text-etikett sm:leading-none",
          isToday
            ? "ops-contrast-panel flex size-7 items-center justify-center rounded-full bg-contrast-panel text-ink sm:size-auto sm:px-1.5 sm:py-px"
            : cx("text-ink", vald && "font-bold"),
        )}
      >
        {day}
      </span>
    </span>
  );
}

/**
 * Märkesraden på telefon: streck och prickar i kategorins färg, i två rader om 16 px (SS `markerArea`), streck 10 x 4 px,
 * prickar 6 px och 3 px emellan (SS `eventDash`, `eventDot`, `markerRow`). Talen bakom antalet är `markorlayout`.
 * ⛔ Dekor, och läses inte upp: antalet står redan i knappens namn.
 * @param {{ spann: import("../lib/calendar.js").CalendarEntry[], enkla: import("../lib/calendar.js").CalendarEntry[], vald: boolean }} props
 */
function Markorrad({ spann, enkla, vald }) {
  const { streck, ovre, nedre, plus } = markorlayout(spann, enkla);
  const farg = (/** @type {import("../lib/calendar.js").CalendarEntry} */ p) => (vald ? "bg-ink" : postklasser(p).prick);
  const prick = (/** @type {import("../lib/calendar.js").CalendarEntry} */ p) => <span key={p.id} data-prick={p.id} className={cx("size-1.5 shrink-0 rounded-full", farg(p))} />;
  return (
    <span aria-hidden="true" data-kalender-marken="" className="mt-0.75 flex h-4 flex-col items-center gap-0.5 sm:hidden">
      <span className="flex min-h-1.75 items-center justify-center gap-0.75">
        {streck.map((p) => (
          <span key={p.id} data-streck={p.id} className={cx("h-1 w-2.5 shrink-0 rounded-full", farg(p))} />
        ))}
        {ovre.map(prick)}
      </span>
      {nedre.length > 0 || plus > 0 ? (
        <span className="flex min-h-1.75 items-center justify-center gap-0.75">
          {nedre.map(prick)}
          {plus > 0 ? <span data-plus="" className={cx("text-mikro leading-none font-semibold tabular-nums", vald ? "text-ink" : "text-ink-muted")}>+{plus}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

/** ⛔ SS `MonthGrid.jsx:579` och `:700`: två piller, sedan "+N" för resten. */
const PILLER = 2;

/**
 * Pillren med titel från 640 px (SS webb). Vänsterkanten i postens färg, samma som prickens.
 * @param {{ markerade: import("../lib/calendar.js").CalendarEntry[], vald: boolean }} props
 */
function Pillerrad({ markerade, vald }) {
  return (
    <span aria-hidden="true" data-kalender-piller="" className="mt-1 hidden min-w-0 flex-col gap-0.5 sm:flex">
      {markerade.slice(0, PILLER).map((p) => (
        <span
          key={p.id}
          className={cx("block min-w-0 truncate rounded-md py-px pr-1 pl-1 text-liten", vald ? "bg-ink/15 text-ink" : cx("border-l-3 bg-ink-secondary/15 text-ink-secondary", postklasser(p).kant))}
        >
          {p.title}
        </span>
      ))}
      {markerade.length > PILLER ? <span className={cx("pl-1 text-liten tabular-nums", vald ? "text-ink" : "text-ink-muted")}>+{markerade.length - PILLER}</span> : null}
    </span>
  );
}

/**
 * Hörnmärkena (plats för F6): runda rutor på 20 px, staplade i rutans övre högra hörn och 6 px utanför det, som SS-appen
 * (`dayIndicatorClusterAbsolute`, "sticker ut top:-6 right:-6"). Innehållet är appens; ordet står i knappens namn.
 * @param {{ marken: NonNullable<Dagdekor["hornmarken"]> }} props
 */
function Hornmarken({ marken }) {
  return (
    <span aria-hidden="true" data-hornmarken="" className="pointer-events-none absolute -top-1.5 -right-1.5 z-3 flex flex-col gap-0.5">
      {marken.map((m) => (
        <span key={m.id} data-hornmarke={m.id} className="flex size-5 items-center justify-center rounded-full border border-line bg-surface text-ink-muted shadow-sm [&>svg]:size-3">
          {m.innehall}
        </span>
      ))}
    </span>
  );
}
