import { useId, useState } from "react";
import { cx } from "../lib/cx.js";
import { ChevronNedIkon } from "./icons.jsx";
import { OpsToggleRow } from "./OpsToggleRow.jsx";

/**
 * En summa uppdelad i grupper som går att fälla ut och tona ned.
 *
 * ── ⛔ VAD DEN SVARAR PÅ ──────────────────────────────────────────────────
 *
 * "Vad består den här summan av, och vad blir den om jag inte räknar med X?"
 * Det är den fråga varje ops-plattform ställer om kostnader, tid, lagerplats
 * eller vad den nu råkar mäta, och den har två halvor som brukar byggas som två
 * olika komponenter:
 *
 *   - Uppdelningen (vad ingår) blir en tabell eller en lista.
 *   - Urvalet (vad räknas) blir kryssrutor.
 *
 * Här är de samma sak, och det är hela poängen. En rad visar sitt belopp OCH
 * bär sitt urval, så totalen längst upp aldrig kan beskriva något annat än det
 * man ser.
 *
 * ── ⛔ TVÅ KNAPPAR PER RAD, OCH VARFÖR DE INTE ÄR EN ─────────────────────
 *
 * Raden har en chevron som fäller ut posterna och en knapp som tonar ned
 * gruppen. Det hade gått att slå ihop dem, men då betyder samma tryck olika
 * saker på olika sidor i samma app: på en summeringssida tonar ett tryck ned
 * raden, och här hade det öppnat den.
 *
 * ⛔ Gesten ska betyda samma sak överallt, och det vägde tyngre än att spara en
 * kontroll. Därför är radens stora yta samma nedtoningsknapp som i
 * `OpsToggleRow`, och utfällningen sitter i en egen liten knapp med eget namn.
 * De kan inte nästlas: en `<button>` i en `<button>` är ogiltig HTML och
 * webbläsaren river isär den, så de är syskon.
 *
 * ── ⛔ TOTALEN ÄR APPENS, INTE KOMPONENTENS ──────────────────────────────
 *
 * Komponenten summerar ingenting. Den tar emot `total` färdigräknad, eftersom
 * bara appen vet vad som får räknas ihop: okända belopp, intervall, poster i
 * annan valuta. Räknade den själv skulle den behöva gissa, och en gissning som
 * står bredvid mätta tal är det dyraste felet en sådan här lista kan göra.
 */

/**
 * @typedef {object} BreakdownPost
 * @property {string} id
 * @property {import("react").ReactNode} label
 * @property {import("react").ReactNode} [value]
 * @property {import("react").ReactNode} [hint] Andra raden: när, hur ofta, varifrån.
 */

/**
 * @typedef {object} BreakdownGrupp
 * @property {string} id
 * @property {import("react").ReactNode} label
 * @property {import("react").ReactNode} [value]
 * @property {number} [count] Antal poster, visas vid etiketten.
 * @property {boolean} on Räknas med i totalen.
 * @property {BreakdownPost[]} [poster]
 * @property {import("react").ReactNode} [note] Står under gruppen även när den är hopfälld.
 */

/**
 * @param {object} props
 * @param {BreakdownGrupp[]} props.groups
 * @param {(id: string, on: boolean) => void} props.onToggle
 * @param {{ label: import("react").ReactNode, value: import("react").ReactNode, hint?: import("react").ReactNode }} props.total
 * @param {import("react").ReactNode} [props.empty] Visas när `groups` är tom.
 * @param {string} [props.offLabel] Vad nedtonat betyder, för skärmläsare.
 * @param {string} [props.expandLabel] Verb för utfällningsknappens namn, följt av gruppens etikett.
 */
export function OpsBreakdown({ groups, onToggle, total, empty, offLabel = "räknas inte", expandLabel = "Visa poster i" }) {
  const [oppna, setOppna] = useState(/** @type {string[]} */ ([]));
  const idBas = useId();

  if (!groups || groups.length === 0) {
    return empty ?? null;
  }

  /** @param {string} id */
  const vaxlaOppen = (id) => setOppna((f) => (f.indexOf(id) >= 0 ? f.filter((x) => x !== id) : [...f, id]));

  return (
    <div className="flex flex-col">
      {/* ⛔ Totalen står ÖVER uppdelningen, inte under. Läser man uppifrån vill
          man veta svaret först och sedan varifrån det kommer. En summa i foten
          tvingar en att läsa hela listan för att få veta vad den blev. */}
      <div className="flex items-baseline justify-between gap-3 border-b border-line-strong pb-3">
        <span className="text-sm font-semibold text-ink-secondary">{total.label}</span>
        <span className="text-lg font-bold tabular-nums text-ink">{total.value}</span>
      </div>
      {total.hint ? <p className="mt-1 mb-0 text-sm text-ink-muted">{total.hint}</p> : null}

      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
        {groups.map((g) => {
          const oppen = oppna.indexOf(g.id) >= 0;
          const panelId = `${idBas}-${g.id}`;
          const harPoster = Boolean(g.poster && g.poster.length);

          return (
            <li key={g.id}>
              <div className="flex items-stretch gap-1">
                {harPoster ? (
                  <button
                    type="button"
                    onClick={() => vaxlaOppen(g.id)}
                    aria-expanded={oppen}
                    aria-controls={panelId}
                    className={cx(
                      "flex min-h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted",
                      "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    )}
                  >
                    {/* Namnet är inte "expandera": uppläst i följd blir tio
                        likadana "expandera" obrukbart. */}
                    <span className="sr-only">
                      {expandLabel} {typeof g.label === "string" ? g.label : ""}
                    </span>
                    <span aria-hidden="true" className={cx("transition-transform duration-(--duration-fast)", oppen && "rotate-180")}>
                      <ChevronNedIkon size={16} />
                    </span>
                  </button>
                ) : (
                  // Tom yta i samma bredd, så etiketterna står i linje oavsett
                  // om gruppen går att fälla ut. Ojämna vänsterkanter läses som
                  // slarv, inte som information.
                  <span aria-hidden="true" className="w-11 shrink-0" />
                )}

                {/* ⛔ SAMMA KOMPONENT som en rad i en summeringslista, inte en
                    kopia av den. Här låg tidigare en egen `<button>` med egen
                    styling, och två uppsättningar klassnamn för samma gest är
                    precis den drift ramverket finns för att stoppa: den dagen
                    utseendet ändrades skulle bara den ena följa med.

                    Chevronen står UTANFÖR knappen och inte i den. En `<button>`
                    inuti en `<button>` är ogiltig HTML som webbläsaren river
                    isär, så de måste vara syskon. */}
                <div className="min-w-0 flex-1">
                  <OpsToggleRow
                    label={
                      <>
                        {g.label}
                        {typeof g.count === "number" ? <span className="ml-2 text-sm font-normal tabular-nums text-ink-muted">{g.count}</span> : null}
                      </>
                    }
                    value={g.value}
                    on={g.on}
                    onChange={(pa) => onToggle(g.id, pa)}
                    offLabel={offLabel}
                  />
                </div>
              </div>

              {g.note ? <p className="mt-1 mb-0 pl-12 text-sm text-ink-muted">{g.note}</p> : null}

              {harPoster ? (
                <div id={panelId} hidden={!oppen}>
                  <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 pl-12">
                    {(g.poster ?? []).map((p) => (
                      <li key={p.id} className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 text-sm text-ink-secondary">
                          {p.label}
                          {p.hint ? <span className="block text-sm text-ink-muted">{p.hint}</span> : null}
                        </span>
                        {p.value === undefined || p.value === null ? null : (
                          <span className="shrink-0 text-sm tabular-nums text-ink-secondary">{p.value}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
