import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { getTheme, setTheme } from "../lib/theme.js";
import { BockIkon, ManeIkon, SkarmIkon, SolIkon } from "./icons.jsx";

/**
 * Växlare för ljust, mörkt och följ systemet.
 *
 * ⛔ Den här låg tidigare i mallen, alltså kopierad in i varje app. Det betydde
 * att tre plattformar hade tre kopior som kunde glida isär, och att en rättning
 * i en av dem aldrig nådde de andra. Nu är det en primitiv som alla delar.
 *
 * ⛔ TRE lägen, inte en kryssruta. En boolean har bara "mörkt av" och "mörkt
 * på", och då försvinner "följ systemet": den som aldrig valt något fastnar i
 * ljust läge även med telefonen i mörkt, och det ser ut som att inställningen är
 * trasig.
 *
 * ── ⛔ IKONKNAPP, INTE EN TEXTDROPDOWN ─────────────────────────────────────
 *
 * Första versionen var en `OpsSelect` som visade "Följ systemet" i klartext.
 * Två fel följde av det, och båda syntes först på en riktig skärm:
 *
 *   1. Den tog omkring 140 px i sidhuvudet. I en app med många destinationer
 *      knuffade den ut de sista ur navigeringsraden, så "Schema" hamnade under
 *      växlaren och två destinationer försvann helt ur bild.
 *   2. Den ser inte ut som SessionStudios, som är en Sol/Måne-ikonknapp. Hela
 *      poängen med paritet är att samma sak ska se likadan ut.
 *
 * Nu: en 44 px ikonknapp som visar NUVARANDE läge, och en liten meny med de tre
 * valen bakom. Lägena är kvar, ytan är en femtedel.
 *
 * ⛔ Ikonen ensam bär inte betydelsen. Knappen har `aria-label` med läget
 * utskrivet, och menyvalen är text. En ikon utan namn är oläsbar för den som
 * använder skärmläsare och gissningsbar för alla andra.
 */

/**
 * @param {object} props
 * @param {string} [props.ariaLabel]
 * @param {{ system?: string, light?: string, dark?: string }} [props.labels]
 */
export function OpsThemeToggle({ ariaLabel = "Utseende", labels = {} }) {
  // Läses en gång vid montering. Attributet på <html> är redan satt av
  // `initTheme` före första renderingen, så det finns inget att synka här.
  const [state, setLage] = useState(() => getTheme());
  const [oppen, setOppen] = useState(false);

  const choice = [
    { value: "system", label: labels.system ?? "Följ systemet", Ikon: SkarmIkon },
    { value: "light", label: labels.light ?? "Ljust", Ikon: SolIkon },
    { value: "dark", label: labels.dark ?? "Mörkt", Ikon: ManeIkon },
  ];

  const nuvarande = choice.find((v) => v.value === state) ?? choice[0];
  const NuIkon = nuvarande.Ikon;

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        aria-label={`${ariaLabel}: ${nuvarande.label}`}
        className={cx(
          "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md text-ink-secondary",
          "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
      >
        <NuIkon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="z-(--z-dropdown) min-w-44 rounded-md border border-line bg-raised p-1 shadow-md"
        >
          <div role="group" aria-label={ariaLabel} className="flex flex-col">
            {choice.map((v) => {
              const Ikon = v.Ikon;
              const chosen = v.value === state;
              return (
                <button
                  key={v.value}
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => {
                    setTheme(/** @type {any} */ (v.value));
                    setLage(/** @type {any} */ (v.value));
                    setOppen(false);
                  }}
                  className={cx(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-left text-base",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    chosen ? "bg-accent-subtle font-semibold text-ink" : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
                  )}
                >
                  <span aria-hidden="true" className="shrink-0 text-ink-muted">
                    <Ikon size={16} />
                  </span>
                  <span className="flex-1">{v.label}</span>
                  {chosen ? (
                    <span aria-hidden="true" className="shrink-0 text-accent">
                      <BockIkon />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
