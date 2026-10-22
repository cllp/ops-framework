import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayButton, DayPicker, labelDayButton } from "react-day-picker";
import { faltTriggerKlass, faltYtaKlass, radKlass } from "../lib/radKlass.js";
import { cx } from "../lib/cx.js";
import { DEFAULT_LOCALE } from "../lib/calendar.js";
import { formatDate } from "../lib/format.js";
import { forvalda } from "../lib/ord.js";
import { useFieldBinding } from "./OpsField.jsx";
import { ChevronNedIkon } from "./icons.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";

/**
 * Datumväljare.
 *
 * ⛔ Den här komponenten finns för att `OpsInput` FÖRBJUDER `type="date"` och
 * lovar en ersättare. Ett förbud utan ersättare är gnäll, och ett löfte i koden
 * som inte hålls är skuld. Nu är löftet infriat.
 *
 * ⛔ Värdet är en ISO-sträng `"ÅÅÅÅ-MM-DD"`, inte ett `Date`.
 *
 * Skälet är den dyraste datumfällan som finns: `new Date("2026-07-01")` tolkas
 * som midnatt i UTC, medan `new Date("2026-07-01T00:00")` tolkas som lokal tid.
 * I svensk sommartid betyder det att ett kalenderdatum kan visas, sparas eller
 * jämföras som dagen innan. Ett `Date`-objekt i API:et hade bjudit in det felet
 * vid varje anropsställe. En ren datumsträng kan inte gå fel.
 *
 * Kalenderns beteende, alltså tangentbord, månadsnavigering och veckostart, kommer
 * från react-day-picker. Utseendet är vårt.
 *
 * ⛔ SPRÅKET ÄR EN BCP-47-STRÄNG OCH INTE ETT BIBLIOTEKS LOCALE-OBJEKT.
 *
 * Här stod `import { sv } from "react-day-picker/locale"`, alltså ett hårdkodat
 * språk som inte gick att byta utifrån. Att bara göra objektet till en prop hade
 * löst hälften av problemet och skapat ett nytt: appen hade behövt importera
 * react-day-pickers språkobjekt för att kunna säga vilket språk den vill ha,
 * alltså hade ramverkets val av kalenderbibliotek läckt ut i varje app som
 * använder väljaren. Det är precis det ett stängt API finns för att hindra.
 *
 * Månadsrubrik och veckodagsrubrik ritas därför av `Intl` genom `formatters`,
 * och `locale` är samma sorts sträng som resten av ramverket redan använder
 * (cllp/ops-framework#95).
 *
 * ══ ⛔ PRICKARNA RÄKNAS FRAM AV APPEN OCH HÄMTAS ALDRIG AV VÄLJAREN ══════════
 *
 * CP vill se vilka dagar som har händelser, men bara om det inte gör väljaren
 * långsammare. Väljaren som själv frågar efter händelser hade lagt en hämtning
 * i varje öppning, och hade dessutom tvingat in en datakälla i en komponent som
 * i dag inte känner någon. Därför vänds det: `onManadVisas` talar om vilken
 * månad som visas, appen räknar fram dagarna ur sin egen data (som den ändå har
 * eller kan fråga efter på sitt eget sätt) och skickar tillbaka dem som
 * `markeradeDagar`. Väljaren gör bara tre saker: slår upp varje synlig dag i en
 * mängd, ritar en prick, och lägger en mening i dagens tillgängliga namn.
 *
 * ⛔ UTAN PROPS ÄR VÄLJAREN OFÖRÄNDRAD, inte "nästan". `modifiers`, `components`
 * och `labels` skickas inte till kalendern alls när `markeradeDagar` saknas, så
 * det finns ingen ny väg att köra och inget som kan bli långsammare.
 *
 * ⛔ PRICKEN ÄR ETT RIKTIGT ELEMENT OCH INGET `::after`. Ett pseudoelement går
 * inte att fråga efter i jsdom, och ett prov som bara ser klassnamnet mäter inte
 * att pricken ritas (arbetsregler 4: närvarogrep). Elementet bär `data-prick`
 * som kalenderns dagruta (`OpsCalendarDagruta`).
 */

/** @param {Date} d @returns {string} */
function tillIso(d) {
  const ar = d.getFullYear();
  const man = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${ar}-${man}-${day}`;
}

/**
 * ⛔ Byggs som LOKAL midnatt, med avsikt. Kalendern arbetar i användarens
 * tidszon, och att skapa datumet via `new Date(iso)` hade gett UTC-midnatt,
 * alltså fel dag markerad för halva jordklotet.
 * @param {string | undefined} iso @returns {Date | undefined}
 */
function franIso(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [ar, man, day] = iso.split("-").map(Number);
  return new Date(ar, man - 1, day);
}

/**
 * Månadens första dag som ISO-sträng, ur ett datum i användarens tidszon.
 * @param {Date} d @returns {string}
 */
function forstaDagIManad(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * ⛔ ETIKETTEN BOR I EN ORDBOK OCH INTE SOM SVENSKT FÖRVAL I PARAMETERLISTAN: `check-sprak` håller ett tak som bara får sjunka, och en app
 * på engelska ska höra "has events", inte ett svenskt ord. Appens egen `markeradEtikett` vinner alltid.
 * @type {import("../lib/ord.js").Ordbok}
 */
const ORD_DATUMVALJARE = {
  markerad: { sv: "har händelser", en: "has events" },
};

const ISO_DAG = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mängden av markerade dagar, med varje dag prövad.
 *
 * ⛔ EN FELFORMATERAD DAG KASTAR OCH TYSTAS INTE. En `"2026-10-14T10:00"` eller ett `"14/10"` matchar aldrig en
 * ISO-dag i rutnätet, så pricken hade bara uteblivit: ett fel som ser ut som att månaden saknar händelser
 * (arbetsregler 5: en tyst nedsläppsväg ser ut som att allt gick bra).
 *
 * En `Set` används som den är (ingen kopia), en lista blir en `Set` en gång per ny lista.
 *
 * @param {ReadonlySet<string> | readonly string[] | undefined} dagar
 * @returns {ReadonlySet<string> | undefined}
 */
function markeradMangd(dagar) {
  if (dagar === undefined) return undefined;
  const mangd = dagar instanceof Set ? dagar : new Set(dagar);
  for (const dag of mangd) {
    if (typeof dag !== "string" || !ISO_DAG.test(dag)) {
      throw new Error(`OpsDatePicker: markeradeDagar innehåller "${String(dag)}", som inte är en ISO-dag ("ÅÅÅÅ-MM-DD"). Skicka dagen utan klockslag.`);
    }
  }
  return mangd;
}

/**
 * Dagknappen när väljaren har markerade dagar: samma knapp som kalenderns egen, plus en prick under siffran.
 *
 * ⛔ Kalenderns egen `DayButton` ritas inuti (inte en kopia av den), eftersom den sköter fokus på tangentbordets dag.
 * ⛔ Pricken är `aria-hidden`: den som inte ser den får samma besked som mening i knappens namn (`markeradEtikett`).
 * ⛔ Färgen är accenten, och i den valda dagen (som själv är accent) accentens kontrastfärg, annars försvinner pricken.
 *
 * @param {import("react-day-picker").DayButtonProps} props
 */
function MarkeradDagknapp({ day, modifiers, className, children, ...rest }) {
  return (
    <DayButton day={day} modifiers={modifiers} className={cx(className, modifiers.markerad && "relative")} {...rest}>
      {children}
      {modifiers.markerad ? (
        <span aria-hidden="true" data-prick="" className={cx("absolute bottom-1 md:bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full", modifiers.selected ? "bg-accent-contrast" : "bg-accent")} />
      ) : null}
    </DayButton>
  );
}

/** Stabil identitet, så att kalendern inte räknar om sina komponenter vid varje ritning. */
const MARKERADE_KOMPONENTER = { DayButton: MarkeradDagknapp };

/**
 * @param {object} props
 * @param {string} [props.value] ISO-datum, "ÅÅÅÅ-MM-DD".
 * @param {(iso: string | undefined) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 * @param {string} [props.ariaLabel] Bara när väljaren står utanför en OpsField.
 * @param {string} [props.clearLabel]
 * @param {string} [props.locale] BCP-47, standard `sv-SE`.
 * @param {ReadonlySet<string> | readonly string[]} [props.markeradeDagar] ISO-dagar ("ÅÅÅÅ-MM-DD") som får en prick under siffran. Appen räknar fram dem
 *   för månaden som visas (se `onManadVisas`); väljaren hämtar ingenting. En dag som inte är en ISO-dag kastar.
 * @param {(forstaDag: string) => void} [props.onManadVisas] Anropas med månadens första dag ("ÅÅÅÅ-MM-01") när kalendern öppnas och varje gång
 *   användaren bläddrar till en annan månad, så att appen kan räkna fram `markeradeDagar` för just den månaden.
 * @param {string} [props.markeradEtikett] Läggs efter dagens namn för en markerad dag, så att en skärmläsare hör det pricken visar. Standard "har händelser"
 *   (på engelska "has events", efter appens språk i `OpsSprakProvider`).
 */
export function OpsDatePicker({
  value,
  onChange,
  placeholder = "Välj datum",
  disabled = false,
  ariaLabel,
  clearLabel = "Rensa datum",
  locale = DEFAULT_LOCALE,
  markeradeDagar,
  onManadVisas,
  markeradEtikett,
}) {
  const [oppen, setOppen] = useState(false);
  const f = useFieldBinding();
  const chosen = franIso(value);

  /*
   * ⛔ MELLANLAGRADE, för att `Intl.DateTimeFormat` är dyr att konstruera och
   * `formatWeekdayName` anropas sju gånger per ritning.
   *
   * ⛔ Veckodagen är `short` och inte `narrow`. Narrow ger "M T O T F L S" på
   * svenska, alltså två par som inte går att skilja åt.
   */
  const rubriker = useMemo(
    () => ({
      manad: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
      veckodag: new Intl.DateTimeFormat(locale, { weekday: "short" }),
    }),
    [locale],
  );

  const markerade = useMemo(() => markeradMangd(markeradeDagar), [markeradeDagar]);
  const sprak = useOpsSprak();
  const etikett = markeradEtikett ?? forvalda(ORD_DATUMVALJARE, sprak).markerad;

  /*
   * ⛔ BARA NÄR DAGAR SKICKATS IN skickas något extra till kalendern. Annars är anropet exakt det som fanns före.
   * `modifiers` ger dagknappen `modifiers.markerad`; `labels` lägger meningen efter det standardnamn kalendern redan ger.
   */
  const markering = useMemo(
    () =>
      markerade
        ? {
            modifiers: { markerad: (/** @type {Date} */ d) => markerade.has(tillIso(d)) },
            labels: {
              labelDayButton: (/** @type {Date} */ datum, /** @type {any} */ m, /** @type {any} */ val, /** @type {any} */ lib) =>
                `${labelDayButton(datum, m, val, lib)}${m.markerad ? `, ${etikett}` : ""}`,
            },
          }
        : undefined,
    [markerade, etikett],
  );

  /**
   * ⛔ ÖPPNINGEN ÄR EN HÄNDELSE OCH INGEN EFFEKT. Popovern monteras om vid varje öppning och startar på det valda datumet
   * (eller idag), så månaden som visas är känd redan här. En effekt hade gett ett anrop per ritning i stället för ett per öppning.
   * @param {boolean} nasta
   */
  function andraOppen(nasta) {
    setOppen(nasta);
    if (nasta) onManadVisas?.(forstaDagIManad(chosen ?? new Date()));
  }

  return (
    <Popover.Root open={oppen} onOpenChange={andraOppen}>
      <Popover.Trigger
        id={f.id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={f.invalid || undefined}
        aria-describedby={f.describedBy}
        className={faltTriggerKlass({ invalid: f.invalid, filled: Boolean(chosen) })}
      >
        {chosen ? formatDate(value, { locale }) : placeholder}
        <ChevronNedIkon />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          className={cx(faltYtaKlass, "max-w-[calc(100vw---spacing(6))] p-3")}
        >
          <DayPicker
            mode="single"
            weekStartsOn={1}
            formatters={{
              formatCaption: (m) => rubriker.manad.format(m),
              formatWeekdayName: (d) => {
                const ord = rubriker.veckodag.format(d);
                return ord.charAt(0).toUpperCase() + ord.slice(1);
              },
            }}
            showOutsideDays
            selected={chosen}
            // ⛔ 0.31.0: `defaultMonth`, inte `month`. `month` gör månaden STYRD, och en styrd månad utan
            // `onMonthChange` går inte att bläddra i: pilarna gör ingenting så fort ett datum är valt (CP 2026-09-29:
            // "datum går inte att välja"). Popovern monteras om vid varje öppning, så `defaultMonth` startar på det valda.
            defaultMonth={chosen}
            // Ostyrd månad: kalendern bläddrar själv och säger bara vilken månad den hamnade i.
            onMonthChange={onManadVisas ? (m) => onManadVisas(forstaDagIManad(m)) : undefined}
            {...(markering ? { modifiers: markering.modifiers, labels: markering.labels, components: MARKERADE_KOMPONENTER } : {})}
            onSelect={(d) => {
              onChange(d ? tillIso(d) : undefined);
              setOppen(false);
            }}
            classNames={{
              months: "text-meta text-ink",
              month_caption: "flex items-center justify-center py-1 text-meta font-semibold text-ink",
              nav: "flex items-center justify-between",
              // 44px träffyta på telefon (size-11), tätare på desktop (md:size-9).
              button_previous: "inline-flex size-11 md:size-9 items-center justify-center rounded-md text-ink-secondary hover:bg-accent-faint",
              button_next: "inline-flex size-11 md:size-9 items-center justify-center rounded-md text-ink-secondary hover:bg-accent-faint",
              weekday: "text-liten text-ink-muted",
              day: "p-0",
              day_button:
                "inline-flex size-11 md:size-9 items-center justify-center rounded-base text-meta text-ink hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
              selected: "[&_button]:bg-accent [&_button]:text-accent-contrast",
              today: "[&_button]:font-semibold [&_button]:text-accent",
              outside: "[&_button]:text-ink-muted",
              disabled: "[&_button]:opacity-40",
            }}
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOppen(false);
              }}
              className={cx(radKlass(), "mt-2")}
            >
              {clearLabel}
            </button>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
