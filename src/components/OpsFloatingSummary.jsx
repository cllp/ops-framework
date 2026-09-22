import { cx } from "../lib/cx.js";

/**
 * Talet man laborerar med, som håller sin plats i fönstret.
 *
 * ── ⛔ VARFÖR DEN FINNS ──────────────────────────────────────────────────
 *
 * Reglaget och talet det påverkar får inte plats på samma skärm på en telefon.
 * Antingen ser man vad man drar i, eller vad det blir. Scrollar man mellan dem
 * jämför man mot ett MINNE i stället för mot en siffra, och då är hela poängen
 * med ett reglage borta.
 *
 * CP, bolag-ops#210: "man vill se hur reglaget påverkar kassaflödet."
 *
 * ── ⛔ `fixed`, OCH FÖRSTA FÖRSÖKET MED `sticky` VAR FEL ─────────────────
 *
 * Den här komponenten hette `OpsStickySummary` och var `sticky bottom-…`,
 * lånat från SessionStudios "Idag"-knapp. Den lösningen fungerar DÄR, och
 * skälet är värt att kunna:
 *
 *   SessionStudios kalender är ett skal med FAST HÖJD (`h-full overflow-hidden`)
 *   med två kolumner som scrollar var för sig. Panelen bredvid står stilla för
 *   att den inte sitter i samma scroll-behållare som det man scrollar. Det finns
 *   varken `sticky` eller `fixed` inblandat.
 *
 * En sida som scrollar i DOKUMENTET har ingen andra behållare att stå stilla i.
 * Där gör `sticky` att elementet nyper fast bara inom sin egen förälders
 * scrollsträcka, och resultatet blev vad CP såg: en rad i flödet som inte flöt.
 *
 * `fixed` är därför rätt här och inte en genväg. Elementet hör till FÖNSTRET,
 * inte till en förälder.
 *
 * ── ⛔ INVÄNDNINGEN MOT `fixed`, OCH VAD SOM GÖR DEN OGILTIG HÄR ─────────
 *
 * En fast ruta ligger över innehållet för alltid och täcker sista raden, vilket
 * man upptäcker först när någon letar efter sin sista post. Det är ett riktigt
 * problem och skälet till att första versionen undvek `fixed`.
 *
 * Det som gör det ogiltigt: bubblan finns BARA MEDAN NÅGOT ÄR JUSTERAT. Den
 * som inte laborerar ser den aldrig, och den som gör det kan klicka bort den.
 * Appen avgör när den ska finnas; komponenten renderar inte något eget villkor.
 *
 * ── ⛔ BOTTNAR ÖVANFÖR BOTTENRADEN, OCH ÖVANFÖR DESS KNAPP ─────────────
 *
 * `--bottom-nav-h` plus `--safe-bottom`, precis som OpsToast. Räknas det bort
 * hamnar bubblan ovanpå telefonens navigering, alltså över den enda knappen man
 * behöver för att komma därifrån.
 *
 * Det räckte inte. Bottenradens huvudåtgärd är en rund knapp som STICKER UPP
 * ovanför baren (12px lyft plus 4px ring), och bubblan bottnade 8px över baren.
 * CP 2026-09-18, med bild: plusknappen låg mitt över bubblans nederkant.
 * `--bottom-nav-overhang` är den sträckan, och den bor i tokens.css så att den
 * ändras på ett ställe den dagen knappen ändras.
 *
 * ── ⛔ EN STORLEK, OCH TVÅ RADER I DEN ─────────────────────────────────
 *
 * CP 2026-09-20: "det större lägen i bubblan får inte allt plats. Bättre att ha
 * en storlek, den lilla. Och sedan ha två rader med nuvarande i mindre text
 * överst och den justerade i stort grönt under."
 *
 * Den hade två lägen, utfällt och ihopfällt, och man växlade genom att trycka på
 * den. Det var fel på två sätt samtidigt.
 *
 * ⛔ DET UTFÄLLDA LÄGET FICK INTE PLATS. Namn, hint och tal på EN rad betyder
 * att tre texter delar på 320 px. Talet är det enda som inte får kortas, så
 * namnet och hinten trängdes och `truncate` åt upp dem. En bubbla som visar
 * "Nuläget 125 1..." har slutat svara på frågan den finns för.
 *
 * ⛔ OCH VÄXLINGEN VAR EN GEST UTAN NYTTA. Den som drar i ett reglage vill se
 * talet, inte administrera en ruta. Ett tryck som byter storlek mitt under ett
 * drag är dessutom precis den rörelse resten av den här komponenten finns för
 * att undvika.
 *
 * Nu: nuläget litet överst, det simulerade stort och tonat under. Två rader som
 * båda får hela bredden, och ingen växling alls.
 *
 * ⛔ NAMNET MÅLAS INTE LÄNGRE, MEN FINNS KVAR SOM UPPLÄST NAMN. Tre rader ryms
 * inte i "den lilla", och kortet ovanför säger redan vad talet är. Den som inte
 * ser skärmen har inget kort att luta sig mot, så `label` står som en
 * skärmläsartext och `aria-label` på krysset. Att ta bort det helt hade gjort
 * bubblan till två nakna tal för den som lyssnar.
 *
 * ── ⛔ BREDDEN ÄR FAST, FÖR ATT SIFFROR BYTER BREDD ────────────────────
 *
 * CP: "Den svajar lite med siffrornas bredd." När behållaren inte har fast
 * bredd växer den när talet blir en siffra bredare, och rutan man läser rör sig
 * under blicken (åt vänster när den var högerställd, åt båda håll när den är
 * centrerad — samma problem, annan riktning).
 *
 * Därför: full bredd upp till `max-w-xs`, behållaren står still, talet byter
 * bredd inuti den, och `tabular-nums` gör att varje siffra är lika bred som
 * varje annan.
 *
 * ⛔ Och ingenting bryter rad. En hint som blev två rader gjorde bubblan högre
 * och sköt upp den över sitt eget utrymme. Den kortas i stället av med `truncate`:
 * en avhuggen rad är synligt avhuggen, en ombruten ser ut att vara hel.
 *
 * ── ⛔ DEN RÖR INTE KANTERNA, FÖR EN REMSA LÄSES SOM EN LIST ────────────
 *
 * CP 2026-09-19: "Bubblan måste vara väldigt flytande. Och gärna komma in en
 * bit i sidan."
 *
 * Första versionen var `max-w-sm`, alltså 384 px, inuti ett omslag med 16 px
 * luft. På en 390 px bred telefon blev bubblan 358 px och nuddade båda kanterna.
 * Då ser den inte ut som något som svävar ovanför sidan utan som en list fäst i
 * nederkanten, alltså som appskal. Och appskal läser man förbi: bubblan finns
 * just för att TITTAS PÅ medan man drar i ett reglage.
 *
 * Nu 20 rem med 20 px luft, alltså 320 px av 390. Den har luft på båda sidor och
 * ligger tydligt ovanpå innehållet.
 *
 * ⛔ BREDDEN ÄR FORTFARANDE FAST. Det var inte smak utan fixen på att bubblan
 * svajade när talet bytte bredd, och en smalare bubbla som svajar är sämre än en
 * bred som står still.
 *
 * ── ⛔ CENTRERAD, INTE HÖGERSTÄLLD ─────────────────────────────────────
 *
 * CP 2026-09-20 / ops-framework#54: bubblan låg långt ner i högra hörnet och
 * kändes inte som en bubbla. `justify-end` sköt den åt sidan; nu `justify-center`
 * så den ligger ungefär mitt i viewport, fortfarande ovanför botten-nav.
 *
 * ── ⛔ LAGRET ÄR `--z-sticky`, INTE `--z-chrome` ────────────────────────
 *
 * Bubblan är innehåll som fastnar, inte appskal. Kromet ligger på `--z-chrome`
 * sedan en tabellcell målade över logotypen, och en ny fast yta som tar kromets
 * lager gör om exakt det felet, fast nedåt.
 */

/**
 * @param {object} props
 * @param {string} props.label Vad siffran är. Syns utfälld, och är knappens namn för den som lyssnar.
 * @param {string} props.value Siffran, färdigformaterad.
 * @param {"neutral"|"success"|"danger"} [props.tone] Färg på värdet.
 * @param {string} [props.hint] En rad till under värdet, till exempel skillnaden mot nuläget.
 * @param {() => void} [props.onDismiss] Finns den får bubblan ett kryss som stänger den.
 * @param {string} [props.dismissLabel] Kryssets namn för den som lyssnar.
 */
export function OpsFloatingSummary({ label, value, tone = "neutral", hint, onDismiss, dismissLabel = "Dölj" }) {
  if (!label || !value) {
    throw new Error(
      "OpsFloatingSummary: label och value krävs. En bubbla med ett tal utan namn säger inte vad talet är, och en med ett namn utan tal är en tom ruta som ligger i vägen.",
    );
  }

  const tonklass = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-ink";

  return (
    /*
     * ⛔ `pointer-events-none` på omslaget och `pointer-events-auto` på bubblan.
     * Omslaget spänner hela bredden så bubblan kan centreras med flex; utan det
     * hade den osynliga remsan ätit varje tryck längs nederkanten.
     */
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom)+var(--bottom-nav-overhang)+0.75rem)] z-(--z-sticky) flex justify-center px-5 md:bottom-[calc(var(--safe-bottom)+1.25rem)]">
      {/* ⛔ `rounded-3xl` OCH INTE `rounded-full`. Pillerformen hörde till en rad
          text. Två rader gör rutan omkring 70 px hög, och en helrund kant på den
          höjden äter 35 px i vardera änden av en bubbla som är 320 px bred. Det
          är utrymme talet behöver.

          ⛔ `rounded-2xl` VAR DÖD KOD. `--radius-*: initial` nollar Tailwinds
          egna steg, och skalan hade bara sm–xl/full — ingen 2xl. Klassen emitterade
          ingen border-radius, och bubblan såg ut som en fyrkant (ops-framework#54).
          3xl (24px) är tydligt rundad utan att äta layouten. */}
      {/* ⛔ SVEPET IN, samma som kalenderns bubblor. CP 2026-09-22: "Alla bubblor
          både i kalendern och Översikt får en snabbt svepande känsla in."
          Bubblan dyker upp mitt under att man drar i ett reglage, och utan
          rörelsen står den plötsligt bara där. Ingen trappa här: det är ett
          element, och en trappa på ett är bara en fördröjning. */}
      <div className="ops-contrast-panel pointer-events-auto flex w-full max-w-xs animate-svep items-center gap-2 rounded-3xl border border-line bg-contrast-panel py-3 pl-4 pr-3 shadow-lg">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* ⛔ Namnet bara för den som lyssnar, se doktexten ovan. */}
          <span className="sr-only">{label}</span>

          {/* ⛔ NULÄGET ÖVERST OCH LITET. Det är referensen man jämför mot, inte
              svaret, och en referens som är lika stor som svaret tvingar ögat
              att välja mellan två tal som ser lika viktiga ut.

              `truncate`: hinten är appens ord och kan bli hur lång som helst. En
              avhuggen rad är synligt avhuggen, en ombruten gör bubblan högre och
              skjuter upp den över sitt eget utrymme. */}
          {hint ? <span className="w-full truncate tabular-nums text-sm text-ink-secondary">{hint}</span> : null}

          {/* ⛔ TALET UNDER, STORT OCH TONAT. `whitespace-nowrap` och
              `tabular-nums`: talet är hela poängen med bubblan och får varken
              kortas eller brytas, och siffror som byter bredd får rutan att
              svaja under blicken. */}
          <span className={cx("whitespace-nowrap tabular-nums text-lg font-bold leading-tight", tonklass)}>{value}</span>
        </div>

        {/* ⛔ KRYSSET BÄR NAMNET, eftersom det är den enda knappen kvar i
            bubblan. Utan `label` i sitt namn blir det "Dölj" i en lista med
            andra kryss, och då vet den som lyssnar inte vad som döljs. */}
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={`${dismissLabel} ${label}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-secondary"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
