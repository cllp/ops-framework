import { useId } from "react";
import { cx } from "../lib/cx.js";

/**
 * Ett val bland flera, alla synliga.
 *
 * ── ⛔ VARFÖR DEN FINNS, MÄTT OCH INTE ANAT ───────────────────────────────
 *
 * Ramverket hade tre sätt att välja EN sak och inget av dem passade fyra
 * alternativ med en förklaring var:
 *
 *   - `OpsSegmented` kastar vid fyra lägen, med flit: fler lägen gör orden för
 *     korta för att betyda något.
 *   - `OpsSelect` göms bakom ett klick. Det är rätt för tjugo länder och fel för
 *     fyra sorter man vill jämföra innan man väljer.
 *   - `OpsToggleRow` är på/av per rad. Fyra sådana där bara en får vara på är en
 *     radiogrupp som ritats som något annat, och en skärmläsare läser upp dem
 *     som fyra lösa knappar utan att säga att de hör ihop.
 *
 * Den här stängde luckan när bolag-ops fick en fjärde sort att skicka in.
 *
 * ── ⛔ NATIVA RADIOKNAPPAR UNDER YTAN, INTE KNAPPAR MED ARIA ─────────────
 *
 * Varje alternativ ÄR en `<input type="radio">`, visuellt dold men i
 * tabbordningen. Det ger piltangentnavigering, gruppering, formulärsemantik och
 * "3 av 4" uppläst, gratis och korrekt.
 *
 * ⛔ Skriv aldrig om det till `<button role="radio">`. Då måste piltangenterna,
 * fokushanteringen och `aria-checked` byggas för hand, och den koden är fel i
 * något hörn i varje kodbas som har den. Det är dessutom omöjligt att se att den
 * är fel utan att prova med tangentbord.
 *
 * ── ⛔ UTSEENDET ÄR CP:s EGET FÖRSLAG ────────────────────────────────────
 *
 * "knappar med text och rundade hörn som blir utgråade (unselected) och
 * aktiverade genom tryckning". Samma yta som `OpsToggleRow`: vald är upphöjd med
 * stark kant, ovald är nedsänkt och dämpad.
 *
 * ⛔ Dämpad till `ink-secondary` och aldrig `ink-muted`. Mätt på `OpsToggleRow`:
 * `ink-muted` gav 3,13:1 i ljust läge mot WCAG AA:s 4,5:1 för brödtext.
 * Undantaget för inaktiva kontroller gäller inte, eftersom ett ovalt alternativ
 * är fullt valbart.
 */

/**
 * @typedef {object} RadioVal
 * @property {string} value
 * @property {import("react").ReactNode} label
 * @property {import("react").ReactNode} [hint] Andra raden: vad alternativet är TILL FÖR. ⛔ Inte en omskrivning av etiketten.
 */

/**
 * @param {object} props
 * @param {RadioVal[]} props.options
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.ariaLabel] Vad gruppen frågar om. ⛔ Utelämnas bara när gruppen ligger i en `OpsField`, som redan namnger den.
 * @param {string} [props.name] Formulärnamn. Ett genereras när det saknas.
 * @param {1 | 2} [props.columns] Två kolumner på bred skärm. Alltid en på smal: en etikett med förklaring i halva telefonbredden bryts sönder.
 */
export function OpsRadioGroup({ options, value, onChange, ariaLabel, name, columns = 1 }) {
  const genererat = useId();
  const groupName = name ?? genererat;

  if (!Array.isArray(options) || options.length < 2) {
    throw new Error(
      `OpsRadioGroup: minst två alternativ krävs, fick ${Array.isArray(options) ? options.length : 0}. ` +
        "Ett ensamt alternativ är inget val, och noll är ett tomt formulärfält som ser ut att ladda.",
    );
  }

  return (
    // ⛔ `role="radiogroup"` PÅ BEHÅLLAREN trots att radioknapparna är nativa.
    // Nativa radios grupperas av sitt `name`, men gruppen får då inget eget namn
    // uppläst. Med rollen och etiketten hör man vad man svarar PÅ, inte bara vad
    // alternativen heter.
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx("grid gap-2", columns === 2 && "sm:grid-cols-2")}
    >
      {options.map((o) => {
        const chosen = o.value === value;
        return (
          <label
            key={o.value}
            className={cx(
              "flex cursor-pointer flex-col gap-0.5 rounded-lg border px-4 py-3",
              "transition-colors duration-(--duration-fast) ease-standard",
              // ⛔ Fokusringen sitter på ETIKETTEN och inte på den dolda inputen,
              // eftersom det är etiketten man ser. Utan `focus-within` syns inte
              // var tangentbordsfokus är, och gruppen blir omöjlig att använda
              // utan mus trots att den fungerar.
              "focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-accent",
              chosen
                ? "border-line-strong bg-raised text-ink hover:border-accent"
                : "border-line bg-sunken text-ink-secondary hover:border-line-strong",
            )}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name={groupName}
                value={o.value}
                checked={chosen}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {/* Pricken är dekor: tillståndet bärs av den nativa inputen. */}
              <span
                aria-hidden="true"
                className={cx(
                  "inline-flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                  chosen ? "border-accent" : "border-line-strong",
                )}
              >
                {chosen ? <span className="size-2 rounded-full bg-accent" /> : null}
              </span>
              <span className="min-w-0 font-semibold">{o.label}</span>
            </span>
            {o.hint ? <span className="pl-7 text-sm text-ink-muted">{o.hint}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
