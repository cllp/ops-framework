import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { PANEL, skyddaOvanforPanel, usePanelRegistrering } from "../lib/panellager.js";
import { useOpsSprak } from "./OpsSprak.jsx";
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
 *
 * ══ ⛔ PÅ TELEFONEN SLUTAR BLADET OVANFÖR BOTTENRADEN (0.235.0) ═══════════════════════════════════════════════════════════
 *
 * CP 2026-11-16, skärmbild från appen: i bladet Nytt projekt var knapparna Avbryt och Skapa projekt avklippta längst ned. Bladet var en bottnad sheet
 * med `bottom-0` och bara den säkra ytan som luft (`pb-(--safe-bottom)`), alltså på samma plats som bottenraden och TALK:s lyft, och utan säker yta
 * alls där `env(safe-area-inset-bottom)` är 0. Sedan 0.231.0 slutar panelerna ovanför bottenraden (`PanelDialog`, `OpsSkapaPanel`), och bladet gör nu
 * samma sak på samma tal (regel 2):
 *   1. Bladet och slöjan slutar på `--panel-botten` (bottenraden, dess kantlinje, säkra yta och mikrofonens lyft; 0 utan bottenrad, `tokens.css`).
 *   2. Den säkra ytan läggs bara på när bottenraden inte redan bär den: `max(0px, --safe-bottom - --panel-botten)`.
 *   3. Höjden räknar med båda, så att innehållet rullar ovanför knappraden och knappraden aldrig trycks ut ur bladet.
 *   4. Bladet är en panel (`usePanelRegistrering`, `skyddaOvanforPanel`): medan det är öppet är radens flikar dämpade, och ett tryck på TALK stänger det inte.
 * På datorn (`md`) är det den centrerade rutan som förut.
 */

// ⛔ 0.31.0: SS `ui/ModalShell.jsx:13-15`: `sm` max-w-md (448), `md` max-w-2xl (672), `lg` max-w-5xl (1024). Före 0.31.0 var det
// 384, 512 och 768 px: samma tre namn, mindre rutor. Rundningen är SS `--radius` (`ModalShell.jsx:40`, 12 px), inte 16.
const STORLEKAR = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-5xl",
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
export function OpsModal({ open, onOpenChange, title, description, size = "md", footer, closeLabel: closeLabelProp, children }) {
  // 0.172.0 (cllp/lifehub.app#580): förvalet på appens språk.
  const sprak = useOpsSprak();
  const closeLabel = closeLabelProp ?? (sprak === "en" ? "Close" : "Stäng");
  const storlekKlass = STORLEKAR[size];
  if (!storlekKlass) {
    throw new Error(`OpsModal: okänd size "${size}". Giltiga: ${Object.keys(STORLEKAR).join(", ")}.`);
  }
  if (!title) {
    throw new Error("OpsModal: title krävs. Skärmläsaren annonserar titeln när dialogen öppnas, och utan den vet användaren inte vad som hände.");
  }

  usePanelRegistrering(open);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-ops-modal-sloja="" className="fixed inset-x-0 top-0 bottom-(--panel-botten) z-(--z-overlay) bg-scrim md:bottom-0" />
        {/* `max-h` + inre scroll i stället för fast höjd: en modal med fast höjd
            klipper sitt innehåll så fort texten översätts till ett längre språk
            eller någon zoomar.

            ⛔ På telefon en bottnad sheet i nästan full höjd med säker yta i
            botten, inte en centrerad ruta vars marginaler knappt får plats på
            390px. På md+ den centrerade rutan. `dvh`, aldrig `vh`: Safaris
            verktygsrad ändrar höjd och 100vh räknar med den största. */}
        <Dialog.Content
          {...{ [PANEL]: "" }}
          data-ops-modal=""
          onInteractOutside={skyddaOvanforPanel}
          className={cx(
            "fixed inset-x-0 bottom-(--panel-botten) z-(--z-modal) flex max-h-[calc(100dvh-var(--safe-top)-var(--panel-botten))] w-full flex-col",
            "rounded-t-lg border border-line bg-raised pb-[max(0px,calc(var(--safe-bottom)-var(--panel-botten)))] shadow-lg",
            "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[calc(100vw---spacing(8))]",
            "md:max-h-[calc(100dvh---spacing(8))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-base md:pb-0",
            storlekKlass,
          )}
        >
          <div className="flex items-start justify-between gap-4 p-6 pb-4">
            <div className="min-w-0">
              <Dialog.Title className="m-0 text-titel leading-tight text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-etikett text-ink-secondary">{description}</Dialog.Description>
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

          {/* `shrink-0`: knappraden krymper aldrig, det är innehållet ovanför som rullar. */}
          {footer ? <div data-ops-modal-fot="" className="flex shrink-0 flex-wrap items-center justify-end gap-2 p-6 pt-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
