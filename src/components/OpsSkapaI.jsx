import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { text } from "../lib/sprak.js";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { PersonIkon } from "./icons.jsx";

/**
 * "Skapa i": var det som skapas ska hamna (0.31.0).
 *
 * ══ ⛔ SESSIONSTUDIOS VÄLJARE, INTE EN EGEN ═══════════════════════════════
 *
 * CP 2026-09-29, skärmbild (b) ur SS: en centrerad dialog med rubriken "Skapa i", sektionen GRUPPER (en rad per grupp:
 * märke, namn, medlemsikon till höger, vald rad med accentkant), sektionen MINA KALENDRAR och "Avbryt" längst ned. SS
 * `CalendarCreateDestinationSheet.jsx:53-135`: `ModalShell size="sm" align="bottom"` (ett ark nerifrån på telefon, en
 * centrerad ruta från `sm`), sektionsrubrik `text-[10px] font-semibold uppercase tracking-wider text-muted` (`:75-77`),
 * raden `px-3 py-2.5 rounded-xl`, märket 36 px (`:88-95`; här 34 px som gruppanelens `rail`, SS `AppSidebar.jsx:95`) och
 * `UsersRound` till höger (`:97`). En vald rad har accentkant. Rundningen är SS egen: arket `rounded-t-2xl` och rutan `sm:rounded-2xl`
 * (`panelClassName`, `:53`, alltså `--radius-card`, 24 px) och raden `rounded-xl` (`:83`, 20 px).
 *
 * ⛔ SEKTIONERNA ÄR TVÅ, OCH DEN ANDRA ÄR APPENS. Grupper är ramverkets (`grupper`, samma form som `OpsGruppanel`).
 * `sektioner` är appens egna (t.ex. "Mina kalendrar"): `{ id, rubrik, poster: [{ id, namn, ikon? }] }`. Ramverket vet inte
 * vad en kalender är; det ritar raden och säger vilken som valdes.
 *
 * ⛔ ETT ID ÄR ETT ID. `vald` och `onValj(id, sektionId)` går på id, så ett id får inte förekomma i två sektioner.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {ReadonlyArray<import("./OpsGruppanel.jsx").GruppanelGrupp>} [props.grupper]
 * @param {string | null} [props.vald] Id på den vald raden.
 * @param {(id: string, sektionId: string) => void} props.onValj `sektionId` är `"grupper"` för en grupp.
 * @param {ReadonlyArray<{ id: string, rubrik: string, poster: ReadonlyArray<{ id: string, namn: string, ikon?: import("react").ReactNode }> }>} [props.sektioner]
 * @param {string} [props.sprak]
 * @param {string} [props.rubrik] Förval "Skapa i".
 * @param {string} [props.grupperRubrik] Förval "Grupper".
 * @param {string} [props.avbrytEtikett] Förval "Avbryt".
 * @param {string} [props.tomText]
 * @param {string} [props.medlemmarEtikett] Skärmläsarord efter antalet, förval "medlemmar".
 */
export function OpsSkapaI({
  open,
  onOpenChange,
  grupper = [],
  vald = null,
  onValj,
  sektioner = [],
  sprak = "sv",
  rubrik = "Skapa i",
  grupperRubrik = "Grupper",
  avbrytEtikett = "Avbryt",
  tomText = "Inga destinationer tillgängliga.",
  medlemmarEtikett = "medlemmar",
}) {
  const tom = grupper.length === 0 && sektioner.every((s) => s.poster.length === 0);
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
            <Dialog.Title className="m-0 text-base font-semibold text-ink">{rubrik}</Dialog.Title>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-2">
            {grupper.length > 0 ? (
              <section aria-label={grupperRubrik}>
                <Rubrik>{grupperRubrik}</Rubrik>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {grupper.map((g) => {
                    const namn = text(g.namn, sprak);
                    return (
                      <li key={g.id}>
                        <Rad vald={vald === g.id} onClick={() => onValj(g.id, "grupper")}>
                          <OpsIdentity name={namn} seed={g.id} imageUrl={g.bild || undefined} size="rail" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{namn}</span>
                          {typeof g.medlemsantal === "number" ? (
                            <span className="flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                              <PersonIkon size={16} />
                              <span>
                                {g.medlemsantal}
                                <span className="sr-only"> {medlemmarEtikett}</span>
                              </span>
                            </span>
                          ) : (
                            <span aria-hidden="true" className="shrink-0 text-ink-muted">
                              <PersonIkon size={16} />
                            </span>
                          )}
                        </Rad>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
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
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.namn}</span>
                      </Rad>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {tom ? <p className="m-0 px-3 py-6 text-center text-sm text-ink-muted">{tomText}</p> : null}
          </div>
          <div className="flex justify-end border-t border-line px-2 py-2">
            <Dialog.Close className="inline-flex min-h-11 cursor-pointer items-center rounded-base px-4 text-sm font-medium text-ink-secondary transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
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
    <button
      type="button"
      aria-pressed={vald}
      onClick={onClick}
      className={cx(
        "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors duration-(--duration-fast) ease-standard",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        vald ? "border-accent bg-accent-faint" : "border-transparent hover:bg-accent-faint",
      )}
    >
      {children}
    </button>
  );
}
