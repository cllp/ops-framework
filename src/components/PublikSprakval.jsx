import { cx } from "../lib/cx.js";
import { SPRAK } from "../lib/sprak.js";

/**
 * Språkväljaren i huvudet på en publik sida: SV och EN, en knapp var, den valda markerad (`aria-pressed`).
 *
 * ⛔ EN VÄLJARE FÖR DE PUBLIKA SIDORNA (regel 2, 0.131.0). Den delade händelsesidan (`OpsDeladHandelse`) hade den som en privat funktion; gästsidan (`OpsGastSida`) behöver samma
 * knappar med samma mått och samma markering, och en andra kopia hade glidit isär första gången någon rörde den. Märkningen (`data-dh-sprak`) är oförändrad.
 *
 * @param {{ aktivt: string, etikett: string, onVal: (s: string) => void }} props
 */
export function PublikSprakval({ aktivt, etikett, onVal }) {
  return (
    <div role="group" aria-label={etikett} data-dh-sprak="" className="flex shrink-0 items-center gap-1 text-meta font-medium">
      {SPRAK.map((s) => (
        <button
          key={s}
          type="button"
          lang={s}
          aria-pressed={s === aktivt}
          onClick={() => onVal(s)}
          className={cx(
            "min-h-9 min-w-10 cursor-pointer rounded-full px-3 py-1 transition-colors duration-(--duration-fast) ease-standard",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            s === aktivt ? "bg-publik-ljus-text/10 text-publik-ljus-text" : "text-publik-ljus-text/65 hover:text-publik-ljus-text",
          )}
        >
          {s.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
