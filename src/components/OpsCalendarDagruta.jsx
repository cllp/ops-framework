import { cx } from "../lib/cx.js";
import { markorlayout } from "../lib/calendar.js";
import { postklasser } from "../lib/kalenderfarg.js";
import { BortaIkon, LagerIkon } from "./icons.jsx";

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
 * En dagsruta, som SessionStudios: på telefon som SS-appen (`apps/mobile/components/calendar/DayCell.js`), siffran i en ruta på 28 px till vänster (0.61.0)
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
 * ⛔ PLATSERNA FÖR LAGER OCH TILLGÄNGLIGHET (0.37.0, typade i 0.61.0). CP 2026-09-30, med en skärmbild ur SS-appen med lager
 * och tillgänglighet påslagna: "Även sedan med kalender lager och tillgänglighet kommer vi att behöva rendera som i ss." 0.37.0
 * gav rutan platserna, med `hornmarken` som appens eget innehåll i en rund ruta. 0.61.0 (#259 skiva 1, CP 2026-10-06: "Allt
 * finns i SessionStudio") gör dem typade: appen skickar bara antalen (`borta`, `lager`), och rutan ritar SS-appens brickor
 * själv, med ikonen, räknaren och ordet i knappens namn. Skälet är att utseendet på brickan ÄR SS-reglerna (fast cirkel,
 * opak yta, kant i ikonens färg, räknaren inne i cirkeln), och en plats där varje app ritade sitt eget innehåll hade låtit
 * varje app göra om de fem varven SS behövde (#564-#570).
 *
 * @param {{ day: number, dayKey: string, entries: import("../lib/calendar.js").CalendarEntry[], markerade: import("../lib/calendar.js").CalendarEntry[], spann: import("../lib/calendar.js").CalendarEntry[], enkla: import("../lib/calendar.js").CalendarEntry[], isToday: boolean, forbi: boolean, chosen: boolean, forhand: boolean, sok: "" | "traff" | "miss", bandhojd: number, pekare: Record<string, any>, dekor?: Dagdekor }} props
 */
export function Dagruta({ day, dayKey, entries, markerade, spann, enkla, isToday, forbi, chosen, forhand, sok, bandhojd, pekare, dekor }) {
  const count = entries.length;
  const borta = antalI(dekor?.borta, "borta");
  const lager = antalI(dekor?.lager, "lager");
  // ⛔ `hornmarken` togs bort i 0.61.0. En app som inte bytt hade fått en tom ruta utan förklaring.
  if (dekor && "hornmarken" in dekor) utvecklingsvarning("OpsCalendar dagdekor: hornmarken finns inte sedan 0.61.0. Skicka { borta: { antal }, lager: { antal } }, och rutan ritar brickorna själv.");
  // ⛔ N/N BARA NÄR INGEN ÄR BORTA (SS `MonthGrid.jsx:529`, `blockedMembers.length === 0`): brickan och talet säger samma sak åt två håll.
  const narvaro = borta === 0 && dekor?.narvaro && dekor.narvaro.totalt > 0 ? dekor.narvaro : null;
  const label = [
    count === 0 ? `${day}` : `${day}, ${count} ${count === 1 ? "post" : "poster"}`,
    ...(borta > 0 ? [`${borta} borta`] : []),
    ...(narvaro ? [`${narvaro.tillgangliga} av ${narvaro.totalt} tillgängliga`] : []),
    ...(lager > 0 ? [`${lager} lager`] : []),
  ].join(", ");
  const vald = chosen || forhand;
  const nedtonad = vald ? "" : sok === "miss" ? "sok" : sok === "" && forbi ? "forbi" : "";

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
         * ⛔ UNDER 640 PX TONAS HELA RUTAN, BRICKORNA OCH RAMEN MED (0.61.0, #259). SS-appen sätter `opacity` på hela cellen
         * (`DayCell.js:91-93`: 0,5 för det som varit, 0,3 för en sökning som missar), och förebild 7 (CP 2026-10-06) visar det:
         * brickan den 24 september är blekare röd, lagrets ram blekare och siffran grå. En yta ovanpå rutan når inte brickorna,
         * som sticker ut ur den. Från 640 px är det SS webbs yta (`MonthGrid.jsx:413`) nedan, som förut.
         */
        nedtonad === "forbi" && "max-sm:opacity-50",
        nedtonad === "sok" && "max-sm:opacity-30",
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
      {nedtonad ? (
        <span aria-hidden="true" data-nedtonad={nedtonad} className={cx("pointer-events-none absolute inset-0 z-1 hidden rounded-base bg-canvas sm:block", nedtonad === "sok" ? "opacity-70" : "opacity-50")} />
      ) : null}
      {/* ⛔ LAGRETS RAM (0.61.0, #259): SS-appen ritar rutans kant 2 px i lagrets färg (`DayCell.js` `borderWidthForLayer`).
          Här en egen absolut ram som täcker rutans kant (`-inset-px`, alltså kantlådan), så att rutans storlek och innehållets
          plats är desamma med och utan lager: en `border-2` på rutan hade flyttat siffran och prickarna en pixel. På en dag
          som varit tonas ramen med rutan (förebild 7: ramen den 23 september är blekare än den 7 oktober). Ingen ram på den valda rutan, som SS (`!picked && layerBorderColor`). Från 640 px som SS webb (`MonthGrid.jsx:421`):
          2 px innanför kanten (`inset-0.5`), rundning 8 och 70 procents täckning. */}
      {dekor?.ram && !vald ? <span aria-hidden="true" data-dagram={dekor.ram} className={cx("pointer-events-none absolute -inset-px z-1 rounded-base border-2 sm:inset-0.5 sm:rounded-sm sm:opacity-70", DAGRAM[dekor.ram])} /> : null}
      <Dagnummer day={day} isToday={isToday} vald={vald}>
        {borta > 0 || lager > 0 || narvaro ? <Indikatorrad borta={borta} lager={lager} narvaro={narvaro} vald={vald} /> : null}
      </Dagnummer>
      {/* ⛔ PLATS FÖR BANDEN under siffran från 640 px, en rad per fil (SS `:547`). På telefon finns inga band: där är en
          flerdagspost ett streck i varje ruta den täcker, som i SS-appen. */}
      {bandhojd > 0 ? <span aria-hidden="true" data-bandplats="" style={{ height: bandhojd }} className="hidden shrink-0 sm:block" /> : null}
      <Markorrad spann={spann} enkla={enkla} vald={vald} />
      <Pillerrad markerade={markerade} vald={vald} />
      {/* Under 640 px hörnbrickorna (SS-appen), från 640 px raden bredvid siffran (SS webb), se `Indikatorrad`. */}
      {borta > 0 || lager > 0 ? <Hornbrickor borta={borta} lager={lager} /> : null}
    </button>
  );
}

/**
 * @typedef {object} Dagdekor
 * @property {1|2|3|4|5|6} [ton] En ton ur identitetspaletten som bakgrund på rutan (SS lagrets `tint`).
 * @property {1|2|3|4|5|6} [ram] (0.61.0) En ram på 2 px i identitetspalettens färg runt rutan (SS lagrets `borderColor`).
 * @property {{ antal: number }} [borta] (0.61.0) Så många är borta eller upptagna den dagen (`bortaAntal`). Brickan med
 *   `UserX` i hörnet, räknaren från 2, och "N borta" i knappens namn. 0 eller utelämnad ritar ingenting.
 * @property {{ antal: number }} [lager] (0.61.0) Så många lager gäller den dagen. Brickan med `Layers` under, räknaren
 *   från 2, och "N lager" i knappens namn.
 * @property {{ tillgangliga: number, totalt: number }} [narvaro] (0.61.0) Hur många i den valda gruppen som är tillgängliga.
 *   Ritas som `N/N` i raden bredvid siffran från 640 px, och bara när ingen är borta (SS webb). Appen skickar den bara när en
 *   grupp är vald.
 */

/**
 * Antalet ur `{ antal }`: ett heltal över noll, annars 0 och ingen markering.
 *
 * ⛔ ETT ANTAL SOM INTE ÄR ETT HELTAL VARNAR I UTVECKLING (punkt 5). `{ antal: "2" }` eller `{ antal: 1.5 }` är ett fel i appen,
 * och en ruta som tyst inte ritar något ser ut som "ingen är borta". I produktion ritas ingenting, eftersom en kalender som
 * kastar för en dekor är värre än en utan.
 * @param {{ antal: number } | undefined} x @param {string} falt
 */
function antalI(x, falt) {
  if (x === undefined || x === null) return 0;
  if (!Number.isInteger(x.antal) || x.antal < 0) {
    utvecklingsvarning(`OpsCalendar dagdekor: ${falt}.antal är ${JSON.stringify(x.antal)}, väntat ett heltal från 0. Ingenting ritas för den dagen.`);
    return 0;
  }
  return x.antal;
}

/** @param {string} text */
function utvecklingsvarning(text) {
  // ⛔ Bara när bygget säger att det är utveckling (Vite och Vitest sätter `import.meta.env.DEV`). Ramverkets egen dist har ingen
  // `import.meta.env`, och där är tystnaden det dokumenterade beteendet.
  const env = /** @type {any} */ (import.meta).env;
  if (env && env.DEV) console.warn(text);
}

/** Tonen som klass, utskriven (Tailwind läser källan som text). SS `tintOpacity` förval 0,12 till 0,25: här 15. @type {Record<number, string>} */
const DAGTON = { 1: "bg-identity-1/15", 2: "bg-identity-2/15", 3: "bg-identity-3/15", 4: "bg-identity-4/15", 5: "bg-identity-5/15", 6: "bg-identity-6/15" };

/** Ramen som klass, utskriven av samma skäl. @type {Record<number, string>} */
const DAGRAM = { 1: "border-identity-1", 2: "border-identity-2", 3: "border-identity-3", 4: "border-identity-4", 5: "border-identity-5", 6: "border-identity-6" };

/**
 * Siffran. ⛔ PÅ TELEFON I EN RUTA PÅ 28 X 28 LÄNGST TILL VÄNSTER, INTE CENTRERAD (0.61.0, #259). SS-appen lägger siffran i
 * `dayNumberContainer` (28 x 28) först i `dayTopRow`, som är `flexDirection: row` och `justifyContent: flex-start`
 * (`styles.js:94-107`, sessions-platform f305de6), innanför rutans padding på 4. Mätt i förebild 3 (1179 px, 3x): rutan
 * för den 5 september går från x 834 till 976 och siffrans mitt står på 887,5, alltså 17,5 px eller 5,8 pt vänster om rutans
 * mitt. Prickarna under är centrerade. Till 0.60.0 stod här att SS centrerar, och det var fel: kommentaren läste
 * `alignItems: center` på rutan men inte raden som siffran står i. Idag är en mörk cirkel i samma ruta.
 *
 * Från 640 px uppe till vänster som SS webb, och idag ett mörkt piller. Det har inte ändrats. Raden bär från 640 px också
 * indikatorerna till höger (`children`, se `Indikatorrad`), som SS webbs `data-cal-day-press-band`.
 * @param {{ day: number, isToday: boolean, vald: boolean, children?: import("react").ReactNode }} props
 */
function Dagnummer({ day, isToday, vald, children }) {
  return (
    <span className="relative z-2 flex min-h-7 items-start justify-start gap-1 sm:min-h-6">
      <span
        data-dagnummer=""
        className={cx(
          // ⛔ 28 PX SÅ LÄNGE RUTAN RYMMER DET, SMALARE UNDER: `clamp(14, 2 x radbredd - 38, 28)`. Se `Hornbrickor`.
          "flex aspect-square w-[clamp(14px,calc(200%-38px),28px)] shrink-0 items-center justify-center text-meta font-semibold leading-none tabular-nums sm:aspect-auto sm:w-auto sm:text-etikett sm:leading-none",
          isToday ? "ops-contrast-panel rounded-full bg-contrast-panel text-ink sm:px-1.5 sm:py-px" : cx("text-ink", vald && "font-bold"),
        )}
      >
        {day}
      </span>
      {children}
    </span>
  );
}

/**
 * Indikatorerna från 640 px, som SS webb (`calView/MonthGrid.jsx:470-536`, sessions-platform f305de6): i siffrans rad, till höger
 * (`ml-auto`), i flödet och liggande, `UserX` och sedan `Layers`, 12 px och från 640 px 14 px, utan bricka och utan ram. Räknaren
 * står direkt efter ikonen från 2 (9 px, fet, `tabular-nums`), och `N/N` på samma plats när en grupp är vald och ingen är borta.
 *
 * ⛔ TVÅ FORMER AV SAMMA FAKTUM, EFTER BREDD (CP 2026-10-06, med SS webb i mörkt tema bredvid: "Allt finns i SessionStudio"). Under
 * 640 px är rutan 42 px bred och siffran tar halva, så SS-appen lägger brickorna utanför hörnet; från 640 px finns plats i raden,
 * och SS webb lägger dem där. Raden ritas därför bara från 640 px (`hidden sm:flex`) och brickorna bara under (`sm:hidden`).
 *
 * ⛔ RADEN FLYTTAR ALDRIG SIFFRAN (SS #177, #188): `shrink-0` på både siffran och raden, och raden står efter siffran i flödet.
 *
 * ⛔ I DEN VALDA RUTAN I RUTANS TEXTFÄRG, som SS (`isPicked ? --color-picked-text`): den valda ytan är mörk, och en röd ikon på
 * den syns inte.
 * @param {{ borta: number, lager: number, narvaro: { tillgangliga: number, totalt: number } | null, vald: boolean }} props
 */
function Indikatorrad({ borta, lager, narvaro, vald }) {
  // Siffran som den är, som SS webb (`{blockedMembers.length}`): i raden finns plats, och `9+` gäller cirkeln under 640 px.
  const text = (/** @type {number} */ n) => (n >= 2 ? <span data-raknare="" className="text-raknare tabular-nums">{n}</span> : null);
  return (
    <span aria-hidden="true" data-indikatorrad="" className="ml-auto hidden shrink-0 items-center gap-0.5 sm:flex [&_svg]:size-3.5 [&_svg]:shrink-0">
      {borta > 0 ? (
        <span data-indikator="borta" className={cx("flex shrink-0 items-center gap-px", vald ? "text-ink" : "text-danger")}>
          <BortaIkon size={14} />
          {text(borta)}
        </span>
      ) : null}
      {lager > 0 ? (
        <span data-indikator="lager" className={cx("flex shrink-0 items-center gap-px", vald ? "text-ink" : "text-ink-muted")}>
          <LagerIkon size={14} />
          {text(lager)}
        </span>
      ) : null}
      {narvaro ? (
        <span data-narvaro="" className={cx("ml-0.5 shrink-0 text-raknare font-semibold tabular-nums", vald ? "text-ink/60" : "text-success")}>
          {narvaro.tillgangliga}/{narvaro.totalt}
        </span>
      ) : null}
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
 * Räknarens text: ingen under 2 (SS `blockedCount > 1`, `dayLayers.length > 1`), siffran till 9, och `9+` från 10.
 *
 * ⛔ `9+` ÄR DEN ENDA AVVIKELSEN FRÅN SS I BRICKAN (CP 2026-10-06). Cirkeln är 20 px: ikonen (10), 1 px mellanrum och en siffra
 * (4 px) ryms innanför ringen, två tecken når 0,8 px in i ringen på var sida. Mätt i `check-skalyta` avsnitt 41: `9+` och `12`
 * är lika breda (8,5 och 8,3 px), så `9+` köper ingen plats för två tecken; det den gör är att räknaren aldrig får tre (`100`, 12,5 px,
 * hade stuckit ut ur cirkeln). SS ser det sällan, en stor grupp ser det varje vecka. Cirkeln växer aldrig.
 * @param {number} antal @returns {string}
 */
export function raknartext(antal) {
  return antal >= 10 ? "9+" : antal >= 2 ? String(antal) : "";
}

/**
 * Hörnbrickorna, som SS-appen på telefon (`DayCell.js:164-216`, `styles.js:118-161`, sessions-platform f305de6).
 *
 * ⛔ KLUSTRET SITTER 4 PX UTANFÖR RUTANS KANT, INTE 9. SS skriver `top: -9, right: -9`, men klustret ligger i `dayTopRow`,
 * och i React Native är en absolut position relativ till FÖRÄLDERN, som står innanför rutans kant (1) och padding (4). Mätt i
 * förebild 3: brickan den 5 september börjar 11 px (3,7 pt) ovanför rutans överkant och slutar 12 px (4 pt) utanför dess
 * högerkant; på en lagerdag, där kanten är 2, 3 pt. Här räknas samma sak från rutans innerkant: kanten 1 och paddingen 4 gör
 * `-9` till `-5` mot `top: 0`, och brickan hamnar 4 px utanför kanten. Bara under 640 px: från 640 px står indikatorerna i
 * siffrans rad (`Indikatorrad`).
 *
 * ⛔ SMALARE RUTOR: SIFFRANS RUTA KRYMPER, OCH BRICKAN GÅR UT LITE MER (0.61.0, granskningen av PR 260). Siffrans ruta är 28 px
 * och börjar 5 px in (SS), så två siffror slutar cirka 25,7 px in, och brickan börjar 20 px från sin högerkant. Med 4 px överhäng
 * når brickan siffran när rutan är smalare än cirka 47 px: mätt 0,6 px luft vid 375, täckt vid 360 (4 av 12 rutor) och 320 (8 av
 * 12). SS-appen har rutor på 48 pt vid 393 och ser det aldrig; ramverkets skal har bredare marginal.
 *
 * Två vägar, och ingen räcker ensam. Bara överhäng hade krävt 12 px vid 320, och rullytan klipper det som sticker ut mer än
 * dess egen marginal (förebild 7 visar brickan hel över rutnätets kant). Bara en krympt ruta räcker inte vid 320, där två siffror
 * ensamma är nästan lika breda som det som finns kvar. Så: siffrans ruta är `clamp(14, 2 x radbredd - 38, 28)` px, alltså 28 som
 * SS så länge den ryms och krympt bara där den annars hade täckts; och överhänget är `max(4, 40 - rutbredd)` px, alltså 4 som SS
 * från 36 px rutbredd och cirka 6,4 px vid 320. Rullytan har 7 px marginal under 640 px (`OpsCalendar`), så brickan klipps aldrig.
 *
 * ⛔ TILLGÄNGLIGHET FÖRST, LAGER SEDAN, OAVSETT ORDNINGEN APPEN SKICKADE DEM I. Lagerbrickan har ALLTID `margin-top: -4`
 * (SS `pillBadgeOverlap`), också när den är ensam, och sitter då 4 px högre än en ensam borta-bricka (CP 2026-10-06: behåll
 * det). Med båda är det 16 px mellan överkanterna, och lagerbrickan ritas ovanpå den röda eftersom den kommer senare.
 *
 * ⛔ EN FAST CIRKEL PÅ 20 PX, OPAK YTA OCH KANTEN I IKONENS FÄRG, INGEN SKUGGA. SS-historiken (#564-#570, fem varv 2026-05-18):
 * en tonad yta var "kladdig", räknaren sköt ut ur en växande pill, lagrets ram ritades över en genomskinlig bricka, och i den
 * valda rutan blev brickan vit-på-vit. Samma bricka i alla lägen, ovanför ton, ram och nedtoning (`z-3`).
 * @param {{ borta: number, lager: number }} props
 */
function Hornbrickor({ borta, lager }) {
  return (
    <span aria-hidden="true" data-hornmarken="" className="pointer-events-none absolute top-[-5px] right-[min(-5px,calc(100%-39px))] z-3 flex flex-col items-end sm:hidden">
      {borta > 0 ? (
        <Bricka id="borta" antal={borta} farg="border-danger text-danger">
          <BortaIkon size={10} />
        </Bricka>
      ) : null}
      {lager > 0 ? (
        <Bricka id="lager" antal={lager} farg="-mt-1 border-ink-muted text-ink-muted">
          <LagerIkon size={10} />
        </Bricka>
      ) : null}
    </span>
  );
}

/**
 * En bricka. Ikonen 10 px (SS-appen på telefon; SS `isTablet ? 12 : 10` gäller en iPad, och där står ramverket redan i
 * `Indikatorrad`). Räknaren till höger om ikonen inne i cirkeln: 8 px, vikt 700, radhöjd 9, spärrning -0,3 (SS `pillBadgeText`),
 * `gap 1` och `padding-inline 1` (SS `pillBadge`).
 *
 * ⛔ IKONEN KRYMPER INTE (`shrink-0`). En flexrad krymper annars ikonen för att få plats med siffran (mätt: 6,5 px i stället för
 * 10), och då är det ikonen som ändrar storlek mellan dagar i stället för att cirkeln gör det.
 * @param {{ id: string, antal: number, farg: string, children: import("react").ReactNode }} props
 */
function Bricka({ id, antal, farg, children }) {
  const text = raknartext(antal);
  return (
    <span
      data-hornmarke={id}
      className={cx("flex size-5 shrink-0 items-center justify-center gap-px rounded-full border bg-surface px-px [&>svg]:shrink-0", farg)}
    >
      {children}
      {text ? <span data-raknare="" className="text-mikro leading-[9px] font-bold tracking-[-0.3px] tabular-nums">{text}</span> : null}
    </span>
  );
}
