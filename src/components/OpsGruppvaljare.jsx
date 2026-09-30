import { OpsIdentity } from "./OpsIdentity.jsx";
import { BockIkon } from "./icons.jsx";
import { text } from "../lib/sprak.js";
import { radKlass } from "../lib/radKlass.js";

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
 * ⛔ INGEN RAD "ALLA" (0.35.0, #190). CP 2026-09-30: "Ja, frågan om alla
 * grupper: Ta bort det." Det finns alltid exakt en aktiv grupp, och listan är
 * bara grupperna.
 */

/**
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/grupp.js").Grupp>} props.grupper Mina, ur `minaGrupper`.
 * @param {string} props.aktiv Den aktiva gruppens id, ur `aktivGrupp`.
 * @param {(groupId: string) => void} props.onValj
 * @param {string} [props.sprak]
 * @param {string} [props.rubrik]
 * @param {string} [props.tomText] Texten när jag inte är medlem i någon grupp.
 */
export function OpsGruppvaljare({ grupper, aktiv, onValj, sprak, rubrik = "Grupp", tomText = "Du är inte medlem i någon grupp." }) {
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
  const rader = mina.map((g) => ({ id: g.id, etikett: text(g.namn, sprak) }));

  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 text-meta font-semibold uppercase tracking-wide text-ink-secondary">{rubrik}</p>
      {mina.length === 0 ? <p className="px-2 py-1 text-etikett text-ink-secondary">{tomText}</p> : null}
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
                className={radKlass({ vald, py: 2 })}
              >
                <OpsIdentity name={rad.etikett} seed={rad.id} size="sm" />
                <span className="grow truncate">{rad.etikett}</span>
                {vald ? <BockIkon size={14} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
