import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { OpsIdentity } from "./OpsIdentity.jsx";

/**
 * Användarmenyn i toppraden: vem du är, vägen till profilen, och utloggningen.
 *
 * ══ ⛔ VARFÖR EN EGEN PLATS OCH INTE EN `action` BLAND ANDRA (#138) ════
 *
 * `OpsAppShell` tar emot `actions`, och appen bestämmer vad som ligger där.
 * Det är rätt för temaväxlare och söksymbol, och fel här: klarkriteriet säger
 * "samma plats i varje app". Ligger utloggningen i en fri slot hamnar den till
 * vänster i en app och i en hamburgare i nästa, och då får den som använder
 * båda leta efter samma knapp på två ställen.
 *
 * Därför ett eget `anvandare`-fack i skalet, sist i klustret, alltid.
 *
 * ══ ⛔ AVATAREN ÄR KNAPPEN, OCH DEN HAR ETT NAMN ══════════════════════
 *
 * En bild utan tillgängligt namn är en knapp en skärmläsare läser som "knapp".
 * `aria-label` bär personens namn, eftersom det är det menyn handlar om.
 *
 * ⛔ OCH INGEN TEXT BREDVID PÅ SMAL SKÄRM. Ett namn i toppraden är det första
 * som tvingar fram horisontell scroll på en telefon, och namnet står redan i
 * menyn när man öppnat den.
 *
 * @param {object} props
 * @param {import("../lib/grupp.js").Anvandare} props.anvandare
 * @param {() => void} props.onLoggaUt
 * @param {() => void} [props.onProfil] Utelämnad: ingen profilrad i menyn.
 * @param {string} [props.profilEtikett]
 * @param {string} [props.loggaUtEtikett]
 * @param {string} [props.menyEtikett] Skärmläsarnamn på knappen, följt av namnet.
 */
export function OpsAnvandarmeny({
  anvandare,
  onLoggaUt,
  onProfil,
  profilEtikett = "Profil",
  loggaUtEtikett = "Logga ut",
  menyEtikett = "Konto",
}) {
  const [oppen, setOppen] = useState(false);
  const visningsnamn = anvandare.namn || anvandare.epost;

  const rad =
    "flex w-full cursor-pointer items-center rounded-sm px-3 py-2 text-left text-ink " +
    "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        className={cx(
          "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full",
          "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
        aria-label={`${menyEtikett}, ${visningsnamn}`}
      >
        <OpsIdentity name={visningsnamn} seed={anvandare.id} imageUrl={anvandare.bild} size="sm" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} className="z-(--z-dropdown) min-w-52 rounded-md border border-line bg-raised p-1 shadow-md">
          {/* ⛔ Namn och e-post står överst och är INTE en knapp. Den som öppnar
              menyn behöver först veta vem hen är inloggad som, och det är
              särskilt sant för den som har två konton. */}
          <div className="border-b border-line px-3 py-2">
            <p className="truncate font-medium text-ink">{visningsnamn}</p>
            <p className="truncate text-sm text-ink-secondary">{anvandare.epost}</p>
          </div>
          {onProfil ? (
            <button
              type="button"
              className={rad}
              onClick={() => {
                setOppen(false);
                onProfil();
              }}
            >
              {profilEtikett}
            </button>
          ) : null}
          <button
            type="button"
            className={rad}
            onClick={() => {
              setOppen(false);
              onLoggaUt();
            }}
          >
            {loggaUtEtikett}
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
