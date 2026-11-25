import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ordet } from "../lib/ord.js";
import { cx } from "../lib/cx.js";
import { huvudknappKlass, radBehallare } from "../lib/radKlass.js";
import { DubbelChevronVansterIkon } from "./icons.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";

/**
 * « i toppraden: appikonerna som inte ryms på bredden, utfällda i sidled (0.247.0).
 *
 * ══ ⛔ HÄNDELSEN: CP 2026-11-19 22:06, cllp/lifehub.app#909 ═══════════════════════════════════════════════════════════════════════
 * "När vi har många ikoner i toppraden kan vi fälla ut med en << som visar fler i sidled." Till och med 0.246 lades en appikon som inte rymdes som en rad i Meny. Därifrån
 * syns den inte, och den som letar efter en app i toppraden letar inte i hamburgaren. Nu står « sist bland appikonerna, och ett tryck visar de dolda ikonerna på en vågrät
 * rad direkt under toppraden, högerställd under knappen.
 *
 * ⛔ UNDER, INTE BREDVID. Första versionen fällde ut raden till vänster om knappen, ovanpå toppraden. Skärmbilden vid 390 px visade att den då täckte de ikoner som
 * syns, och att deras räknare stack fram under kanten. Under toppraden står raden fri, och de synliga ikonerna går fortfarande att trycka på.
 *
 * ⛔ VAD SOM ÄR DOLT AVGÖRS AV CSS, INTE AV EN MÄTNING. Skalet ger varje ikon i raden en klass som döljer den där den inte ryms, och samma ikon i raden här en klass som döljer den
 * där den syns i toppraden (`huvudmenyFordelning`). Knappen själv bär en klass som döljer den där alla ryms. En app står därför på exakt ett ställe på varje bredd, och raden
 * hoppar inte när sidan ritats. Mätt i Chromium i `scripts/huvudmeny-matt.mjs`.
 * ⛔ OCH EN MÄTNING RÄTTAR CSS:EN NÄR DEN SLÅR FEL (0.260.0, CP 2026-11-24 i iPhone-appen). Banden räknar bara appikonerna och mättes med en åtgärd, och LifeHubs
 * topprad har två: vid 390 px rullade raden 8 px och ingen « syntes. Skalets `useToppradRyms` mäter raden före målning och flyttar ikoner hit tills den ryms. Då
 * byts klasserna mot `hidden` på exakt den bredden, och regeln står kvar: en app på exakt ett ställe.
 *
 * ⛔ ETT TRYCK PÅ EN IKON STÄNGER RADEN. Ikonen navigerar som i toppraden (samma element, samma `onNavigate`), och en rad som stod kvar över nästa sida hade dolt gruppens namn.
 * Escape och ett tryck utanför stänger också (Radix).
 */

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_OPSHUVUDMENYFLER = {
  fler: { sv: "Fler appar", en: "More apps" },
};

/**
 * @param {object} props
 * @param {import("react").ReactNode} props.children Ikonerna, var och en i ett omslag med sin klass ur `huvudmenyFordelning(...).fler`.
 * @param {string} [props.klass] Klassen som döljer knappen där alla ikoner ryms (`huvudmenyFordelning(...).knapp`).
 */
export function OpsHuvudmenyFler({ children, klass = "" }) {
  const sprak = useOpsSprak();
  const [oppen, setOppen] = useState(false);
  const namn = ordet(ORD_OPSHUVUDMENYFLER, "fler", sprak);
  return (
    <span data-huvudmeny-fler="" className={cx("contents", klass)}>
      <Popover.Root open={oppen} onOpenChange={setOppen}>
        <Popover.Trigger type="button" aria-label={namn} data-huvudmeny-fler-knapp="" className={huvudknappKlass({ aktiv: oppen ? true : false })}>
          <DubbelChevronVansterIkon size={24} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="end"
            sideOffset={4}
            collisionPadding={8}
            aria-label={namn}
            data-huvudmeny-fler-rad=""
            className={cx("z-(--z-dropdown) flex max-w-[calc(100vw-1rem)] flex-row items-center gap-0.5 overflow-x-auto p-1", radBehallare())}
            onClickCapture={(e) => {
              // En länk inne i raden navigerar; raden stängs i samma tryck.
              if (e.target instanceof Element && e.target.closest("a[href]")) setOppen(false);
            }}
          >
            {children}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}
