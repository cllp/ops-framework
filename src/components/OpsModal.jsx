import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { KryssIkon } from "./icons.jsx";

/**
 * Modal.
 *
 * ⛔ Beteendet är inte handskrivet, och det är ett medvetet val. En modal ska
 * fånga fokus, lämna tillbaka det till den knapp som öppnade den, stänga på
 * Escape, låsa bakgrundsscrollen utan att sidan hoppar, och dölja resten av
 * sidan för skärmläsare. Att bygga det själv är veckor, och att bygga det fel
 * är osynligt tills någon använder tangentbord eller skärmläsare.
 *
 * ⛔ En modal utan titel är inte tillåten. Titeln är det skärmläsaren annonserar
 * när dialogen öppnas, och utan den får användaren veta att något öppnades men
 * inte vad.
 */

const STORLEKAR = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-3xl",
};

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {"sm"|"md"|"lg"} [props.size]
 * @param {import("react").ReactNode} [props.footer]
 * @param {string} [props.closeLabel] Skärmläsarnamn på stängknappen. Ska översättas.
 * @param {import("react").ReactNode} props.children
 */
export function OpsModal({ open, onOpenChange, title, description, size = "md", footer, closeLabel = "Stäng", children }) {
  const storlekKlass = STORLEKAR[size];
  if (!storlekKlass) {
    throw new Error(`OpsModal: okänd size "${size}". Giltiga: ${Object.keys(STORLEKAR).join(", ")}.`);
  }
  if (!title) {
    throw new Error("OpsModal: title krävs. Skärmläsaren annonserar titeln när dialogen öppnas, och utan den vet användaren inte vad som hände.");
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim" />
        {/* `max-h` + inre scroll i stället för fast höjd: en modal med fast höjd
            klipper sitt innehåll så fort texten översätts till ett längre språk
            eller någon zoomar. */}
        <Dialog.Content
          className={cx(
            "fixed left-1/2 top-1/2 z-(--z-modal) w-[calc(100vw---spacing(8))] -translate-x-1/2 -translate-y-1/2",
            "flex max-h-[calc(100dvh---spacing(8))] flex-col rounded-lg border border-line bg-raised shadow-lg",
            storlekKlass,
          )}
        >
          <div className="flex items-start justify-between gap-4 p-6 pb-4">
            <div className="min-w-0">
              <Dialog.Title className="m-0 text-lg font-bold leading-tight text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-base text-ink-secondary">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className={cx(
                "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-muted",
                "transition-colors duration-(--duration-fast) ease-standard",
                "hover:bg-accent-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              )}
              aria-label={closeLabel}
            >
              <KryssIkon size={20} />
            </Dialog.Close>
          </div>

          {/* Bottenutrymmet kommer ur kroppens padding nar det inte finns
              nagon fot. En tom distans-div i DOM:en ar en ful losning som en
              skarmlasare dessutom stannar pa. */}
          <div className={cx("min-h-0 flex-1 overflow-auto px-6", footer ? "" : "pb-6")}>{children}</div>

          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 p-6 pt-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
