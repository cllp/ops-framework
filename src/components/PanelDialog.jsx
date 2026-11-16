import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { skyddaOvanforPanel, usePanelRegistrering } from "../lib/panellager.js";

/**
 * Dialogen som `OpsRadPanel` och `OpsExternPanel` ritas i: en modal panel ovanpå listan eller kalendern (0.231.0, cllp/ops-framework#602).
 *
 * ⛔ EN DIALOG FÖR BÅDA PANELERNA (regel 2). Före 0.231.0 hade de varsin `Dialog.Root` med samma klasssträng, tecken för tecken. Att TALK ska stå
 * kvar ovanpå panelen ändrar slöjan, kanterna och vad som räknas som ett tryck utanför, och det hade behövt göras två gånger och glida isär.
 *
 * ══ ⛔ TALK STÅR KVAR PÅ SIN PLATS (CP 2026-11-15, "Snyggt kör på skissen") ══════════════════════════════════════════════════
 *
 * Skissen: mikrofonen flyttar aldrig, och ingen panel täcker den. Tre saker gör det, och alla tre behövs:
 *
 *   1. KANTERNA. På telefonen slutar panelen och slöjan ovanför bottenraden (`--panel-botten`), så att raden och TALK-knappen i mitten syns. På datorn
 *      börjar slöjan och panelen under skalets huvud (`--sloja-topp`), så att TALK-knappen i huvudet syns. Talen bor i `tokens.css`.
 *   2. TRYCKET. Radix stänger en modal dialog på ett tryck utanför dess React-träd, och TALK ligger utanför. `onInteractOutside` släpper igenom det som
 *      bär `OVANFOR_PANEL` (`skyddaOvanforPanel`): TALK-knappen, bottenraden och TALK:s yta. Fältet där markören står fångas vid knappens
 *      `pointerdown` (`src/lib/talkfalt.js`), före allt detta, så att det talet går till är kvar.
 *   3. REGISTRET (`usePanelRegistrering`): medan panelen är öppen dämpar bottenraden sina flikar och gör dem `inert`, och bara TALK går att trycka på.
 *
 * ⛔ PÅ TELEFONEN BÖRJAR PANELEN UNDER STATUSFÄLTET (`max-md:pt-(--safe-top)`, som `OpsSkapaPanel`). CP 2026-11-13, skärmbild från appen i TestFlight: "I native fastnar jag
 * på ärende eller händelse detalj. Menyn att komma tillbaka är för högt upp för att nå." Panelen var `fixed inset-0` under `md`, och utan den säkra zonen låg Tillbaka
 * bakom klockan, där ett tryck når statusfältet och inte knappen. Den säkra zonen NEDTILL bär bottenraden numera själv (`--panel-botten` räknar med den); utan
 * bottenrad lägger panelen den på sin egen `padding-bottom`, som förut.
 *
 * @param {object} props
 * @param {boolean} props.oppen
 * @param {() => void} props.onStang Tillbaka, Escape och ett tryck på slöjan.
 * @param {string} props.titel Dialogens namn för skärmläsaren (`sr-only`).
 * @param {import("react").ReactNode} props.children
 * @param {Record<string, string>} [props.markor] Attribut på panelen, `{ "data-radpanel": "" }`: proven och appens montage hittar den på dem.
 */
export function PanelDialog({ oppen, onStang, titel, children, markor = {} }) {
  usePanelRegistrering(oppen);
  return (
    <Dialog.Root open={oppen} onOpenChange={(o) => (o ? undefined : onStang())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-x-0 top-0 bottom-(--panel-botten) z-(--z-overlay) bg-scrim md:top-(--sloja-topp) md:bottom-0" />
        <Dialog.Content
          {...markor}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={skyddaOvanforPanel}
          className={cx(
            "fixed inset-x-0 top-0 bottom-(--panel-botten) z-(--z-modal) overflow-y-auto bg-canvas outline-none",
            "max-md:pt-(--safe-top) max-md:pb-[max(0px,calc(var(--safe-bottom)-var(--panel-botten)))]",
            "md:inset-auto md:top-[calc(var(--sloja-topp)+1.5rem)] md:left-1/2 md:max-h-[calc(100dvh-var(--sloja-topp)-3rem)] md:w-[min(48rem,calc(100vw-3rem))] md:-translate-x-1/2 md:rounded-base md:border md:border-line",
          )}
        >
          <Dialog.Title className="sr-only">{titel}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
