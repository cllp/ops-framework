import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { BockIkon } from "./icons.jsx";
import { radKlass } from "../lib/radKlass.js";

/**
 * "Skapa i": appens egna mål för det som skapas (0.31.0; utan grupper sedan 0.35.0).
 *
 * ══ ⛔ SESSIONSTUDIOS VÄLJARE, INTE EN EGEN ═══════════════════════════════
 *
 * CP 2026-09-29, skärmbild (b) ur SS: en centrerad dialog med rubriken "Skapa i", en sektion per mål och "Avbryt" längst ned.
 * SS `CalendarCreateDestinationSheet.jsx:53-135`: `ModalShell size="sm" align="bottom"` (ett ark nerifrån på telefon, en
 * centrerad ruta från `sm`), sektionsrubrik `text-[10px] font-semibold uppercase tracking-wider text-muted` (`:75-77`),
 * raden `px-3 py-2.5 rounded-xl`. En vald rad har accentkant. Rundningen är SS egen: arket `rounded-t-2xl` och rutan
 * `sm:rounded-2xl` (`panelClassName`, `:53`, alltså `--radius-card`, 24 px) och raden `rounded-xl` (`:83`, 20 px).
 *
 * ══ ⛔ GRUPPERNA ÄR BORTA UR VÄLJAREN (0.35.0, #190) ════════════════════════
 *
 * CP 2026-09-30: "Ja, frågan om alla grupper: Ta bort det." Allt som skapas hamnar i den AKTIVA gruppen, utan gruppväljare.
 * Sektionen GRUPPER fanns för läget "Alla mina grupper", där det inte fanns någon aktiv grupp att skapa i, och för att byta
 * grupp mitt i ett formulär. Båda är borta med läget. Kvar är appens EGNA mål (t.ex. "Mina kalendrar"):
 * `{ id, rubrik, poster: [{ id, namn, ikon? }] }`. Ramverket vet inte vad en kalender är; det ritar raden och säger vilken
 * som valdes. Posten skapas fortfarande i den aktiva gruppen, och målet är ett fält i formuläret (`mal`).
 *
 * ⛔ ETT ID ÄR ETT ID. `vald` och `onValj(id, sektionId)` går på id, så ett id får inte förekomma i två sektioner.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string | null} [props.vald] Id på den valda raden.
 * @param {(id: string, sektionId: string) => void} props.onValj
 * @param {ReadonlyArray<{ id: string, rubrik: string, poster: ReadonlyArray<{ id: string, namn: string, ikon?: import("react").ReactNode }> }>} [props.sektioner]
 * @param {string} [props.rubrik] Förval "Skapa i".
 * @param {string} [props.avbrytEtikett] Förval "Avbryt".
 * @param {string} [props.tomText]
 */
export function OpsSkapaI({
  open,
  onOpenChange,
  vald = null,
  onValj,
  sektioner = [],
  rubrik = "Skapa i",
  avbrytEtikett = "Avbryt",
  tomText = "Inga destinationer tillgängliga.",
}) {
  const tom = sektioner.every((s) => s.poster.length === 0);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cx(
            "fixed inset-x-0 bottom-0 z-(--z-modal) flex max-h-[85dvh] w-full flex-col rounded-t-card border border-line bg-raised pb-(--safe-bottom) shadow-lg",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw---spacing(8))] sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:pb-0",
          )}
        >
          <div className="border-b border-line px-4 py-3">
            <Dialog.Title className="m-0 text-brod font-semibold text-ink">{rubrik}</Dialog.Title>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-2">
            {sektioner.map((s) => (
              <section key={s.id} aria-label={s.rubrik}>
                <Rubrik>{s.rubrik}</Rubrik>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {s.poster.map((p) => (
                    <li key={p.id}>
                      <Rad vald={vald === p.id} onClick={() => onValj(p.id, s.id)}>
                        {p.ikon ? (
                          <span aria-hidden="true" className="flex size-8.5 shrink-0 items-center justify-center rounded-md bg-accent-faint text-accent [&_svg]:size-5">
                            {p.ikon}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate text-etikett font-medium text-ink">{p.namn}</span>
                      </Rad>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {tom ? <p className="m-0 px-3 py-6 text-center text-etikett text-ink-muted">{tomText}</p> : null}
          </div>
          <div className="flex justify-end border-t border-line px-2 py-2">
            <Dialog.Close className="inline-flex min-h-11 cursor-pointer items-center rounded-base px-4 text-etikett font-medium text-ink-secondary transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
              {avbrytEtikett}
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** @param {{ children: import("react").ReactNode }} props */
function Rubrik({ children }) {
  return <p className="m-0 px-2 py-1 text-liten font-semibold uppercase tracking-wider text-ink-muted">{children}</p>;
}

/** @param {{ vald: boolean, onClick: () => void, children: import("react").ReactNode }} props */
function Rad({ vald, onClick, children }) {
  return (
    <button type="button" aria-pressed={vald} onClick={onClick} className={radKlass({ vald, stor: true, py: 3 })}>
      {children}
      {vald ? (
        <span aria-hidden="true" className="shrink-0 text-accent">
          <BockIkon size={14} />
        </span>
      ) : null}
    </button>
  );
}
