/**
 * Plockaren för kalenderlager (0.90.7).
 *
 * SessionStudio har menyn under lagerikonen (`CalendarLayersMenu`): en rad per lager med bock, färg och namn, och
 * "Hantera lager" längst ned. På telefon är den ett ark, inte en rad knappar i verktygsfältet (cllp/sessions-platform#2687:
 * lösa knappar växte utan tak). Samma sak här. Under `md` ett ark ovanför bottenraden, från `md` en panel.
 *
 * ⛔ FÄRGEN ÄR `KALENDERPRICK`, identitetspalettens klass. Ingen `style` och ingen `--grupp-kulor`: gruppens ton ska inte
 * följa med in i kalendern och inte ändras av den.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { KALENDERPRICK } from "../lib/kalenderfarg.js";
import { lagerFarg, lagerSektioner, synligaLager } from "../lib/kalenderlager.js";
import { radBehallare, radRubrikKlass } from "../lib/radKlass.js";
import { KryssIkon, LagerIkon } from "./icons.jsx";
import { ValRad } from "./ValRad.jsx";

const TITEL = "Kalenderlager";
const BESKRIVNING = "Välj vilka lager som syns i kalendern.";
const TOM = "Inga kalenderlager ännu.";
const STANG = "Stäng";
const HANTERA = "Hantera kalendrar";
const OVRIGA = "Övriga";

/**
 * @param {object} props
 * @param {import("../lib/kalenderlager.js").Kalenderlager[]} props.lista
 * @param {readonly string[]} props.dolda
 * @param {(id: string) => void} props.onVaxla
 * @param {(() => void) | undefined} props.onHantera
 * @param {string | undefined} props.tomText Saknas: standardmeningen. Tom sträng: ingen mening (appen har redan sagt läget).
 * @param {string} props.knappKlass Klassen för ikonknappen, inklusive om lager syns.
 */
export function OpsKalenderlager({ lista, dolda, onVaxla, onHantera, tomText, knappKlass }) {
  const synliga = synligaLager(lista, dolda);
  const sektioner = lagerSektioner(lista);
  const flera = sektioner.filter((s) => s.namn).length > 0 && sektioner.some((s) => !s.namn);
  const tom = tomText === undefined ? TOM : tomText;

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          data-verktyg-lager=""
          data-lager-antal={synliga.length}
          aria-pressed={synliga.length > 0}
          aria-haspopup="dialog"
          aria-label={TITEL}
          className={cx(knappKlass, "relative")}
        >
          <LagerIkon size={14} />
          {synliga.length > 0 ? (
            <span aria-hidden="true" data-lager-raknare="" className="absolute top-0.5 right-0.5 text-raknare tabular-nums">
              {synliga.length}
            </span>
          ) : null}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim" />
        <Dialog.Content
          data-lager-plockare=""
          className={cx(
            "fixed z-(--z-modal) flex flex-col outline-none",
            radBehallare({ ark: true }),
            "inset-x-0 bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom))] max-h-[min(24rem,70dvh)] pb-(--safe-bottom)",
            "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-80 md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-base md:border md:pb-0",
          )}
        >
          <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-line md:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-2 px-3 pt-2">
            <div className="min-w-0 px-1 pt-1">
              <Dialog.Title className="m-0 text-etikett font-semibold text-ink">{TITEL}</Dialog.Title>
              <Dialog.Description className="m-0 mt-0.5 text-meta text-ink-muted">{BESKRIVNING}</Dialog.Description>
            </div>
            <Dialog.Close
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label={STANG}
            >
              <KryssIkon size={20} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
            {lista.length === 0 && tom ? (
              <p className="m-0 px-3 py-2 text-meta text-ink-muted" data-lager-tom="">
                {tom}
              </p>
            ) : null}
            {sektioner.map((s) => (
              <div key={s.namn || "ovriga"} className="flex flex-col" role="group" aria-label={s.namn || (flera ? OVRIGA : TITEL)}>
                {s.namn || flera ? <p className={radRubrikKlass}>{s.namn || OVRIGA}</p> : null}
                {s.lager.map((l) => {
                  const farg = lagerFarg(l);
                  const syns = synliga.some((x) => x.id === l.id);
                  return (
                    <ValRad
                      key={l.id}
                      chosen={syns}
                      stor={!!l.undertext}
                      onClick={() => onVaxla(l.id)}
                      ikon={<span data-lager-farg={farg} data-lager-id={l.id} className={cx("block size-2.5 rounded-full", KALENDERPRICK[farg])} />}
                      under={l.undertext || undefined}
                    >
                      {l.namn || l.id}
                    </ValRad>
                  );
                })}
              </div>
            ))}
          </div>
          {onHantera ? (
            <div className="border-t border-line p-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  data-hantera-lager=""
                  onClick={onHantera}
                  className="flex min-h-11 w-full cursor-pointer items-center rounded-base px-3 text-left text-meta font-medium text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-8"
                >
                  {HANTERA}
                </button>
              </Dialog.Close>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
