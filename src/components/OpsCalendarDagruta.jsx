import { memo } from "react";
import { forvalda } from "../lib/ord.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { cx } from "../lib/cx.js";
import { arPreliminar, markorlayout } from "../lib/calendar.js";
import { postklasser, prickklass } from "../lib/kalenderfarg.js";
import { MAX_KALENDERRAMAR, ramarEfterText } from "../lib/kalenderramar.js";
import { BortaIkon, LagerIkon } from "./icons.jsx";

/**
 * Orden i dagens knappnamn (kontrollgranskningen av PR 458, fynd 5): "12, 3 poster, 1 borta, 4 av 6 tillgängliga, 2 lager". Förut var allt utom ramarna svenska litteraler, och på engelska blev namnet
 * blandat ("3 poster ... 1 more calendar with a frame"). Nu är HELA namnet ur ordboken. `{n}`, `{a}` och `{b}` byts mot talen. Ramarna som inte får plats har sina ord i `ORD_KALENDERRAMAR`.
 */
export const ORD_OPSCALENDARDAGRUTA = {
  post: { sv: "post", en: "entry" },
  poster: { sv: "poster", en: "entries" },
  borta: { sv: "{n} borta", en: "{n} away" },
  tillgangliga: { sv: "{a} av {b} tillgängliga", en: "{a} of {b} available" },
  lagerEtt: { sv: "1 lager", en: "1 layer" },
  lager: { sv: "{n} lager", en: "{n} layers" },
};

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
 * @param {{ day: number, dayKey: string, entries: import("../lib/calendar.js").CalendarEntry[], markerade: import("../lib/calendar.js").CalendarEntry[], spann: import("../lib/calendar.js").CalendarEntry[], enkla: import("../lib/calendar.js").CalendarEntry[], isToday: boolean, forbi: boolean, chosen: boolean, forhand: boolean, sok: "" | "traff" | "miss", bandhojd: number, pekare: Record<string, any>, dekor?: Dagdekor, sprak?: string }} props
 */
function DagrutaRitad({ day, dayKey, entries, markerade, spann, enkla, isToday, forbi, chosen, forhand, sok, bandhojd, pekare, dekor, sprak }) {
  const sprakCtx = useOpsSprak();
  const o = /** @type {Record<keyof typeof ORD_OPSCALENDARDAGRUTA, string>} */ (forvalda(ORD_OPSCALENDARDAGRUTA, sprak || sprakCtx));
  const vald = chosen || forhand;
  const count = entries.length;
  const borta = antalI(dekor?.borta, "borta");
  const appLager = antalI(dekor?.lager, "lager");
  /*
   * ⛔ RAMAR SOM INTE FÅR PLATS (0.151.0, CP 2026-10-28): OpsCalendar räknar dem ur samma underlag som ramarna (`dekor.ramarEfter`), och lagerbrickan visar "+N" i stället för ett antal lager.
   * Bara när kalendrarnas ramar ritas: appens egen `ram` är en och har inget som blir över. ⛔ Skickar appen OCH räknar ramverket `lager` samma dag är det ramverkets räkning som gäller, och
   * appens `lager` ritas inte den dagen (en utvecklingsvarning, en gång): två betydelser på samma bricka ("3 lager" eller "+1 ram") går inte att läsa. Appen skickar inget `lager` idag.
   * ⛔ PÅ EN VALD DAG RITAS INGA RAMAR (`!vald`, se nedan), och då säger varken brickan eller namnet "+N": en bricka som räknar ramar som inte syns är ett påstående om något som inte finns.
   * Dagpanelen som öppnas av valet har raden "Kalendrar med ram". Appens egna `lager` gäller på den dagen som förut (kontrollgranskningen av PR 458, fynd 2).
   */
  const ramarEfter = !vald && !dekor?.ram && Number.isInteger(dekor?.ramarEfter) && /** @type {number} */ (dekor?.ramarEfter) > 0 ? /** @type {number} */ (dekor?.ramarEfter) : 0;
  if (ramarEfter > 0 && appLager > 0 && !lagerKrockVarnad) {
    lagerKrockVarnad = true;
    utvecklingsvarning("OpsCalendar dagdekor: `lager` skickades en dag då ramverket själv visar `+N` på lagerbrickan för kalendrar med ram som inte får plats. Ramverkets räkning gäller och appens `lager` ritas inte den dagen. Skicka inte `lager` om kalendrarna har ramar.");
  }
  const lager = ramarEfter > 0 ? ramarEfter : appLager;
  const lagerText = ramarEfter > 0 ? (ramarEfter > 9 ? "9+" : `+${ramarEfter}`) : undefined;
  // ⛔ `hornmarken` togs bort i 0.61.0. En app som inte bytt hade fått en tom ruta utan förklaring. EN gång per sidladdning, inte
  // en gång per ruta: 750 likadana rader i konsolen döljer felet de ska visa.
  if (dekor && "hornmarken" in dekor && !hornmarkenVarnad) {
    hornmarkenVarnad = true;
    utvecklingsvarning("OpsCalendar dagdekor: hornmarken finns inte sedan 0.61.0. Skicka { borta: { antal }, lager: { antal } }, och rutan ritar brickorna själv.");
  }
  // ⛔ N/N BARA NÄR INGEN ÄR BORTA (SS `MonthGrid.jsx:529`, `blockedMembers.length === 0`): brickan och talet säger samma sak åt två håll.
  const narvaro = borta === 0 && dekor?.narvaro && dekor.narvaro.totalt > 0 ? dekor.narvaro : null;
  const label = [
    count === 0 ? `${day}` : `${day}, ${count} ${count === 1 ? o.post : o.poster}`,
    ...(borta > 0 ? [o.borta.replace("{n}", String(borta))] : []),
    ...(narvaro ? [o.tillgangliga.replace("{a}", String(narvaro.tillgangliga)).replace("{b}", String(narvaro.totalt))] : []),
    ...(ramarEfter > 0 ? [ramarEfterText(ramarEfter, sprak || sprakCtx)] : lager > 0 ? [lager === 1 ? o.lagerEtt : o.lager.replace("{n}", String(lager))] : []),
  ].join(", ");
  const ramar = ramarAv(dekor);
  const nedtonad = vald ? "" : sok === "miss" ? "sok" : sok === "" && forbi ? "forbi" : "";

  return (
    <button
      type="button"
      data-cal-day={dayKey}
      aria-pressed={chosen}
      aria-label={label}
      {...pekare}
      className={cx(
        /*
         * ⛔ FRÅN 640 PX VÄXER RADEN MED INNEHÅLLET, OCH ALLA RUTOR I VECKAN FÖLJER MED (0.106.0, CP 2026-10-14, med en skärmbild i
         * mörkt tema: "Attest st..." och "Kolla o..." på dag 28 stod långt ned och rann ut under rutans nederkant).
         * Förut: `sm:min-h-20` ovanpå `aspect-[1/1.1]`. En fast minsta höjd i px gör att rutan inte längre kan växa ur sitt innehåll,
         * så etiketterna som inte fick plats ritades utanför. Golvet på 80 px bor nu i radens spår (`OpsCalendar`, `auto-rows`), där
         * det kan följas av att spåret blir högre, och rutan sträcks till spåret (`sm:self-stretch`).
         *
         * ⛔ `sm:w-full` ÄR EN DEL AV SAMMA ÅTGÄRD OCH FÅR INTE TAS BORT. En ruta med proportion och sträckt höjd räknar om sin bredd ur
         * höjden (höjd / 1,1), och växer då ur sin kolumn: mätt, novemberraden hade rutor 91,8 px breda mot 83,6, 10 px ut ur
         * raden och utan glapp mellan dem (check-skalyta avsnitt 48 (e), rött utan raden, grönt med).
         */
        "relative flex aspect-[1/1.1] min-w-0 cursor-pointer select-none flex-col items-stretch border p-1 text-left sm:w-full sm:self-stretch sm:p-2",
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
      {ramar.length > 0 && !vald ? <span aria-hidden="true" data-dagram={ramar[0]} className={cx("pointer-events-none absolute -inset-px z-1 rounded-base border-2 sm:inset-0.5 sm:rounded-sm sm:opacity-70", DAGRAM[ramar[0]])} /> : null}
      {/* ⛔ DEN ANDRA RAMEN LIGGER INUTI DEN FÖRSTA (0.151.0, CP 2026-10-28), en pixel luft emellan så att båda syns som egna linjer: `inset` 3 px längre in än den yttre. Under 640 px är dess linje 1 px och
          från 640 px 2 px som den yttre. Mätt (`scripts/kalenderramar-matt.mjs`, pixel för pixel mot en bild utan ramar): med 2 px och 1 px luft under 640 px gick den inre ramens rundade hörn över "1" i "12" vid 320 px
          (3 pixlar bläck), eftersom rutan är 41 px bred där och siffran börjar där paddingen slutar. Inre rundning = yttre minus avståndet. Utan ramar i rutan, eller med bara en, ritas den inte, och rutan ser ut exakt som förut. */}
      {ramar.length > 1 && !vald ? <span aria-hidden="true" data-dagram-inre={ramar[1]} className={cx("pointer-events-none absolute inset-0.5 z-1 rounded-[calc(var(--radius-base)-3px)] border sm:inset-[5px] sm:border-2 sm:rounded-[calc(var(--radius-sm)-3px)] sm:opacity-70", DAGRAM[ramar[1]])} /> : null}
      <Dagnummer day={day} isToday={isToday} vald={vald}>
        {borta > 0 || lager > 0 || narvaro ? <Indikatorrad borta={borta} lager={lager} lagerText={lagerText} narvaro={narvaro} vald={vald} /> : null}
      </Dagnummer>
      {/* ⛔ PLATS FÖR BANDEN under siffran från 640 px, en rad per fil (SS `:547`). På telefon finns inga band: där är en
          flerdagspost ett streck i varje ruta den täcker, som i SS-appen. */}
      {bandhojd > 0 ? <span aria-hidden="true" data-bandplats="" style={{ height: bandhojd }} className="hidden shrink-0 sm:block" /> : null}
      <Markorrad spann={spann} enkla={enkla} vald={vald} />
      <Pillerrad markerade={markerade} vald={vald} />
      {/* Under 640 px hörnbrickorna (SS-appen), från 640 px raden bredvid siffran (SS webb), se `Indikatorrad`. */}
      {borta > 0 || lager > 0 ? <Hornbrickor borta={borta} lager={lager} lagerText={lagerText} /> : null}
    </button>
  );
}

/**
 * ══ ⛔ EN RUTA RITAS OM BARA NÄR DEN SJÄLV ÄNDRATS (0.134.0, cllp/lifehub.app#402) ═══════════════════════════════════════════════════
 *
 * Ett tryck på en kalenderväxel ska ändra kalendern direkt (CP 2026-10-21: "Utan fördröjning", tak 100 ms). Kalendern ritar 25 månader, ungefär 875 rutor, och utan det här ritades
 * ALLA om för ett tryck som ändrar tre av dem. Mätt i jsdom med 86 märken i rutnätet: 91 ms för ett tryck, strax under taket och inte med marginal. Rutan är nu `memo` med en jämförelse som
 * tittar på det rutan ritar.
 *
 * ⛔ `pekare` JÄMFÖRS INTE, och det är avsiktligt. Den är ett nytt objekt för varje ritning, men dess funktioner läser bara `dayKey` (som jämförs) och referenser och uppdaterare som aldrig byter
 * identitet (`svaljKlick`, `langRef`, `svepRef`, `setValda`, `rensaLang`). En ruta som behåller sin gamla `pekare` beter sig därför exakt som en med den nya. Läser en pekare någon dag något som
 * kan ändras ska den fältet hit, annars blir den inaktuell utan att något syns.
 *
 * @param {Parameters<typeof DagrutaRitad>[0]} a
 * @param {Parameters<typeof DagrutaRitad>[0]} b
 */
function samma(a, b) {
  return (
    a.day === b.day &&
    a.dayKey === b.dayKey &&
    a.isToday === b.isToday &&
    a.forbi === b.forbi &&
    a.chosen === b.chosen &&
    a.forhand === b.forhand &&
    a.sok === b.sok &&
    a.bandhojd === b.bandhojd &&
    a.sprak === b.sprak &&
    listorLika(a.entries, b.entries) &&
    listorLika(a.markerade, b.markerade) &&
    listorLika(a.spann, b.spann) &&
    listorLika(a.enkla, b.enkla) &&
    dekorLika(a.dekor, b.dekor)
  );
}

/** @param {readonly unknown[]} a @param {readonly unknown[]} b */
function listorLika(a, b) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Samma dekor? Appen skickar ett nytt objekt för varje dag och ritning, så objektet jämförs på innehåll: en nivå ner, för `borta`, `lager` och `narvaro`.
 * @param {Dagdekor | undefined} a @param {Dagdekor | undefined} b
 */
function dekorLika(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const nycklar = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const n of nycklar) {
    const x = /** @type {any} */ (a)[n];
    const y = /** @type {any} */ (b)[n];
    if (x === y) continue;
    if (x && y && typeof x === "object" && typeof y === "object") {
      const inre = new Set([...Object.keys(x), ...Object.keys(y)]);
      for (const i of inre) if (x[i] !== y[i]) return false;
      continue;
    }
    return false;
  }
  return true;
}

export const Dagruta = memo(DagrutaRitad, samma);

/**
 * @typedef {object} Dagdekor
 * @property {1|2|3|4|5|6} [ton] En ton ur identitetspaletten som bakgrund på rutan (SS lagrets `tint`).
 * @property {1|2|3|4|5|6} [ram] (0.61.0) En ram på 2 px i identitetspalettens färg runt rutan (SS lagrets `borderColor`). Appens egen: den vinner över `ramar`.
 * @property {ReadonlyArray<1|2|3|4|5|6>} [ramar] (0.151.0) Kalendrarnas ramar, ytterst först, högst två (`MAX_KALENDERRAMAR`): den andra ritas inuti den första. `OpsCalendar` sätter dem ur kalendrarnas visning (Ram eller Båda).
 * @property {number} [ramarEfter] (0.151.0) Så många kalendrar med ram som inte får plats (de ritas högst två): lagerbrickan visar "+N". Sätts av `OpsCalendar`, ur samma underlag som `ramar`; appen skickar den inte.
 * @property {{ antal: number }} [borta] (0.61.0) Så många är borta eller upptagna den dagen (`bortaAntal`). Brickan med
 *   `UserX` i hörnet, räknaren från 2, och "N borta" i knappens namn. 0 eller utelämnad ritar ingenting.
 * @property {{ antal: number }} [lager] (0.61.0) Så många lager gäller den dagen. Brickan med `Layers` under, räknaren
 *   från 2, och "N lager" i knappens namn. ⛔ (0.151.0) På en dag där `ramarEfter` är över noll vinner ramverkets räkning ("+N", ramar som inte får plats) över appens `lager`, och appens ritas inte
 *   den dagen (en utvecklingsvarning, en gång): två betydelser på samma bricka går inte att läsa. Andra dagar, och en vald dag (där inga ramar ritas), är appens `lager` som förut.
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

/** Varningen för `lager` mot ramar som inte får plats skrivs en gång per sidladdning. */
let lagerKrockVarnad = false;

/** Varningen för `hornmarken` skrivs en gång per sidladdning. */
let hornmarkenVarnad = false;

/** Bara för prov: nollställer "en gång per sidladdning", så att provet inte beror på vilka prov som körts före. */
export function aterstallHornmarkenVarning() {
  hornmarkenVarnad = false;
  lagerKrockVarnad = false;
}

/**
 * Ramarna en ruta ritar: appens egen `ram` (en, som förut), annars kalendrarnas `ramar`, högst två.
 * @param {Dagdekor | undefined} dekor @returns {ReadonlyArray<1|2|3|4|5|6>}
 */
function ramarAv(dekor) {
  if (!dekor) return TOMMA_RAMAR;
  if (dekor.ram) return [dekor.ram];
  return dekor.ramar && dekor.ramar.length > 0 ? dekor.ramar.slice(0, MAX_KALENDERRAMAR) : TOMMA_RAMAR;
}
/** @type {ReadonlyArray<1|2|3|4|5|6>} */
const TOMMA_RAMAR = Object.freeze([]);

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
 *
 * ⛔ 2 PX MELLAN SIFFRAN OCH INDIKATORERNA, INTE 4 (#448). Dagen med 12 borta och 12 lager (`12|12`) är raden bredast, och i Plus Jakarta
 * Sans (som appen ritar i) slutade lagerikonen 1,7 px utanför rutan vid 1280 px (mätt), medan det smalare systemtypsnitt som `check-skalyta` råkade
 * mäta på CI rymde den. Rutan är 82 px bred där, så raden får inte ett enda onödigt pixelsteg.
 * @param {{ day: number, isToday: boolean, vald: boolean, children?: import("react").ReactNode }} props
 */
function Dagnummer({ day, isToday, vald, children }) {
  return (
    <span className="relative z-2 flex min-h-7 items-start justify-start gap-0.5 sm:min-h-6">
      <span
        data-dagnummer=""
        className={cx(
          // ⛔ 28 PX SÅ LÄNGE RUTAN RYMMER DET, SMALARE UNDER: `clamp(14, 2 x radbredd - 38, 28)`. Se `Hornbrickor`.
          "flex aspect-square w-[clamp(14px,calc(200%-38px),28px)] shrink-0 items-center justify-center text-meta font-semibold leading-none tabular-nums sm:aspect-auto sm:w-auto sm:text-etikett sm:leading-none",
          isToday ? "ops-contrast-panel rounded-full bg-contrast-panel text-ink sm:px-1.5 sm:py-px" : cx("text-ink", vald && "font-semibold"),
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
 * @param {{ borta: number, lager: number, lagerText?: string, narvaro: { tillgangliga: number, totalt: number } | null, vald: boolean }} props
 */
function Indikatorrad({ borta, lager, lagerText, narvaro, vald }) {
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
          {lagerText ? <span data-raknare="" className="text-raknare tabular-nums">{lagerText}</span> : text(lager)}
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
  const farg = (/** @type {import("../lib/calendar.js").CalendarEntry} */ p) => prickklass(p, vald);
  // ⛔ EN PRELIMINÄR POST (0.127.0, "Datum ej satt") ÄR EN IHÅLIG PRICK: en ring i postens färg. Ett streck på 6 px rymmer ingen streckad kant, så på telefon bär
  // ringen det som kanten bär i pillret och kortet. `data-preliminar` finns för mätningen i en riktig webbläsare (`check-skalyta`).
  const prick = (/** @type {import("../lib/calendar.js").CalendarEntry} */ p) => <span key={p.id} data-prick={p.id} {...(arPreliminar(p) ? { "data-preliminar": "" } : {})} className={cx("size-1.5 shrink-0 rounded-full", farg(p))} />;
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
          {...(arPreliminar(p) ? { "data-preliminar": "" } : {})}
          className={cx(
            "block min-w-0 truncate rounded-md pr-1 pl-1 text-liten",
            // ⛔ EN PRELIMINÄR POST (0.127.0) HAR STRECKAD KANT RUNT OM OCH INGEN FYLLNING: samma färg som en vanlig post av samma slag (`ring`), men ihålig.
            // Kanten är 1 px och luften över och under 0 i stället för 1: pillret är lika högt som ett vanligt, så att veckans rutor inte växer av ett förslag.
            arPreliminar(p)
              ? cx("border border-dashed bg-transparent py-0", vald ? "border-ink text-ink" : cx("text-ink-secondary", postklasser(p).ring))
              : cx("py-px", vald ? "bg-ink/15 text-ink" : cx("border-l-3 bg-ink-secondary/15 text-ink-secondary", postklasser(p).kant)),
          )}
        >
          {p.title}
        </span>
      ))}
      {markerade.length > PILLER ? <span className={cx("pl-1 text-liten tabular-nums", vald ? "text-ink" : "text-ink-muted")}>+{markerade.length - PILLER}</span> : null}
    </span>
  );
}

/**
 * Brickans överhäng, i px: `max(BRICKA_MINSTA_OVERHANG, BRICKA_GRANS - rutbredd)`. SS-appens 4 px så länge rutan är minst
 * `BRICKA_GRANS - 4` = 36 px bred, och mer i smalare rutor, så att brickan aldrig täcker två siffror (se `Hornbrickor`).
 * ⛔ EN SANNING (arbetsreglernas punkt 2): rullytans marginal i `OpsCalendar` härleds ur samma två tal, så att den alltid rymmer
 * överhänget, med eller utan veckonumrets kolumn.
 */
export const BRICKA_MINSTA_OVERHANG = 4;
export const BRICKA_GRANS = 40;
/** Rutans kant, 1 px: `right` räknas från innerkanten, överhänget från ytterkanten. */
const RUTANS_KANT = 1;
/** `right` för klustret: innerbredd P = rutbredd - 2 x kant, överhänget o = -right - kant = GRANS - rutbredd, alltså right = P - (GRANS - kant). */
const BRICKA_HOGER = `min(${-(BRICKA_MINSTA_OVERHANG + RUTANS_KANT)}px, calc(100% - ${BRICKA_GRANS - 2 * RUTANS_KANT + RUTANS_KANT}px))`;

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
 * SS så länge den ryms och krympt bara där den annars hade täckts; och överhänget är `max(4, 40 - rutbredd)` px (`BRICKA_GRANS`),
 * alltså 4 som SS från 36 px rutbredd och mer under det. Rullytans marginal under 640 px härleds i `OpsCalendar` ur samma tal och
 * rymmer alltid överhänget, med eller utan veckonummer; `check-skalyta` avsnitt 41 mäter att brickan inte klipps ned till golvet, 310 px (350 med veckonummer).
 *
 * ⛔ TILLGÄNGLIGHET FÖRST, LAGER SEDAN, OAVSETT ORDNINGEN APPEN SKICKADE DEM I. Lagerbrickan har ALLTID `margin-top: -4`
 * (SS `pillBadgeOverlap`), också när den är ensam, och sitter då 4 px högre än en ensam borta-bricka (CP 2026-10-06: behåll
 * det). Med båda är det 16 px mellan överkanterna, och lagerbrickan ritas ovanpå den röda eftersom den kommer senare.
 *
 * ⛔ EN FAST CIRKEL PÅ 20 PX, OPAK YTA OCH KANTEN I IKONENS FÄRG, INGEN SKUGGA. SS-historiken (#564-#570, fem varv 2026-05-18):
 * en tonad yta var "kladdig", räknaren sköt ut ur en växande pill, lagrets ram ritades över en genomskinlig bricka, och i den
 * valda rutan blev brickan vit-på-vit. Samma bricka i alla lägen, ovanför ton, ram och nedtoning (`z-3`).
 * @param {{ borta: number, lager: number, lagerText?: string }} props
 */
function Hornbrickor({ borta, lager, lagerText }) {
  return (
    <span aria-hidden="true" data-hornmarken="" style={{ right: BRICKA_HOGER }} className="pointer-events-none absolute top-[-5px] z-3 flex flex-col items-end sm:hidden">
      {borta > 0 ? (
        <Bricka id="borta" antal={borta} farg="border-danger text-danger">
          <BortaIkon size={10} />
        </Bricka>
      ) : null}
      {lager > 0 ? (
        <Bricka id="lager" antal={lager} text={lagerText} farg="-mt-1 border-ink-muted text-ink-muted">
          {/* ⛔ "+N" ÄR BREDARE ÄN EN RÄKNARE (0.151.0): plustecknet och siffran är 10 px, med en ikon på 10 px går innehållet 0,9 px över cirkelns kant (mätt). Ikonen är 9 px och spärrningen tätare. */}
          <LagerIkon size={lagerText ? 9 : 10} />
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
 * ⛔ INGET MELLANRUM MELLAN IKON OCH SIFFRA (#448, `gap-0` och inte SS `gap 1`). Ikonen 10 + siffran får rymmas i cirkelns 20 px, och
 * `9+` är 8,5 px bred i SS-appens systemtypsnitt men 9,5 px i Plus Jakarta Sans (bold 8 px, spärrning -0,3, mätt): med gapet blev
 * innehållet 20,5 px och räknaren stack 0,25 px ut på var sida om cirkeln. Kontrollen `check-skalyta` mätte på CI ett smalare
 * systemtypsnitt (8,54 px) och var grön; när den mäter typsnittet appen faktiskt ritar i är det här måttet det som håller. Ikonens egen marginal i
 * 24-rutan (cirka 1 px vid 10 px) bär det mellanrum ögat ser.
 *
 * ⛔ IKONEN KRYMPER INTE (`shrink-0`). En flexrad krymper annars ikonen för att få plats med siffran (mätt: 6,5 px i stället för
 * 10), och då är det ikonen som ändrar storlek mellan dagar i stället för att cirkeln gör det.
 * @param {{ id: string, antal: number, text?: string, farg: string, children: import("react").ReactNode }} props
 */
function Bricka({ id, antal, text: textIn, farg, children }) {
  const text = textIn ?? raknartext(antal);
  return (
    <span
      data-hornmarke={id}
      className={cx("flex size-5 shrink-0 items-center justify-center gap-0 rounded-full border bg-surface px-px [&>svg]:shrink-0", farg)}
    >
      {children}
      {text ? <span data-raknare="" className={cx("text-mikro leading-[9px] tabular-nums", textIn ? "tracking-[-0.8px]" : "tracking-[-0.3px]")}>{text}</span> : null}
    </span>
  );
}
