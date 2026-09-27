import { cx } from "../lib/cx.js";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { BockIkon } from "./icons.jsx";
import { ALLA_GRUPPER } from "../lib/grupplage.js";
import { text } from "../lib/sprak.js";

/**
 * Gruppväljaren i sidopanelen.
 *
 * ══ ⛔ EN LISTA OCH INTE EN RULLGARDIN (#139) ══════════════════════════
 *
 * Formen är avläst ur SessionStudios arbetsytor: raderna ligger framme i
 * panelen, inte bakom ett klick. Med en handfull grupper är listan kortare än
 * menyn som hade dolt den, och den som just loggat in ser att det FINNS flera
 * grupper utan att leta efter dem.
 *
 * ⛔ OCH DEN ÄR AVSIKTLIGT UTAN RADIX. Dagens lärdom: en popover går inte att
 * driva med `fireEvent` i jsdom, alltså blir bytet av grupp något ett prov
 * inte kan mäta. Här är varje rad en knapp, och provet trycker på den.
 *
 * ⛔ "ALLA" LIGGER FÖRST OCH ÄR INTE ETT SPECIALFALL I RITNINGEN. Den är ett
 * läge bland lägena, och att rita den som en avvikande rad hade antytt att den
 * gör något annat än de andra. Det den gör är att fråga varje grupp en gång,
 * och det är inte synligt härifrån.
 */

/**
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/grupp.js").Grupp>} props.grupper Mina, ur `minaGrupper`.
 * @param {string} props.aktiv `ALLA_GRUPPER` eller ett grupp-id, ur `valtLage`.
 * @param {(lage: string) => void} props.onValj
 * @param {string} [props.sprak]
 * @param {string} [props.rubrik]
 * @param {string} [props.allaEtikett]
 * @param {string} [props.tomText] Texten när jag inte är medlem i någon grupp.
 */
export function OpsGruppvaljare({ grupper, aktiv, onValj, sprak, rubrik = "Grupp", allaEtikett = "Alla grupper", tomText = "Du är inte medlem i någon grupp." }) {
  if (typeof onValj !== "function") {
    throw new Error("OpsGruppvaljare: onValj krävs. En väljare som inte kan välja är en lista som ser ut som en kontroll.");
  }
  const mina = grupper ?? [];

  /*
   * ⛔ TOMHETEN SKRIVS UT (arbetsreglernas punkt 5). En person utan medlemskap
   * ska läsa varför appen är tom, inte se en rubrik utan rader och dra en egen
   * slutsats. Sidan som tar hand om det fallet är `OpsUtanMedlemskap` i #137;
   * den här raden finns för att panelen inte ska ljuga under tiden.
   */
  const rader = [{ id: ALLA_GRUPPER, etikett: allaEtikett }, ...mina.map((g) => ({ id: g.id, etikett: text(g.namn, sprak) }))];

  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">{rubrik}</p>
      {mina.length === 0 ? <p className="px-2 py-1 text-sm text-ink-secondary">{tomText}</p> : null}
      <ul className="flex flex-col gap-0.5" aria-label={rubrik}>
        {rader.map((rad) => {
          const vald = rad.id === aktiv;
          return (
            <li key={rad.id}>
              <button
                type="button"
                onClick={() => onValj(rad.id)}
                /*
                 * ⛔ `aria-current` OCH INTE BARA EN FÄRG. Vilken grupp jag
                 * står i avgör vad varje siffra på skärmen betyder, och den
                 * upplysningen får inte bara finnas som en bakgrundsnyans.
                 */
                aria-current={vald ? "true" : undefined}
                className={cx(
                  "flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm",
                  "transition-colors duration-(--duration-fast) ease-standard",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  vald ? "bg-sunken font-semibold text-ink" : "text-ink-secondary hover:bg-sunken hover:text-ink",
                )}
              >
                {rad.id === ALLA_GRUPPER ? <span className="size-6 shrink-0" aria-hidden="true" /> : <OpsIdentity name={rad.etikett} seed={rad.id} size="sm" />}
                <span className="grow truncate">{rad.etikett}</span>
                {vald ? <BockIkon /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
