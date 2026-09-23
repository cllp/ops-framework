import { cx } from "../lib/cx.js";
import { Counter } from "./counter.jsx";

/**
 * En destination som en ikon, för åtgärdsklustret längst till höger i toppraden.
 *
 * ══ ⛔ VARFÖR DEN INTE ÄR ETT NAV-OBJEKT ════════════════════════════════
 *
 * Toppradens navigering tar destinationer som text, och de ryms inte hur många
 * som helst: vid 768 px får tre plats. En destination man vill nå från VARJE
 * sida, hela tiden, konkurrerar då med de destinationer man bara ibland ska till,
 * och förlorar så fort listan växer.
 *
 * En ikon bredvid temaväxlaren konkurrerar inte med den listan alls. Den kostar
 * 44 px och är kvar på alla bredder. Det är rätt plats för en inkorg, en
 * notislista eller en sökruta: ytor man återvänder till och som har ett tillstånd
 * (ett antal) värt att se utan att gå in.
 *
 * ⛔ DEN ÄR EN LÄNK OCH INTE EN KNAPP. Den går till en sida, alltså ska
 * högerklick, ny flik och kopiera länk fungera. Appen ger `onNavigate` och får
 * sin router att ta över klicket, precis som i skalet och av samma skäl.
 *
 * ⛔ IKONEN ENSAM BÄR ALDRIG BETYDELSEN. `label` blir knappens uppläsning, och
 * räknaren bär sitt eget substantiv. En ikon utan namn är oläsbar för den som
 * använder skärmläsare och gissningsbar för alla andra.
 *
 * ⛔ Ingen text bredvid ikonen, inte ens på bred skärm. Åtgärdsklustret är en rad
 * ikoner (tema, helskärm, konto), och ett ord mitt bland dem läses som en knapp av
 * ett annat slag. Namnet finns i uppläsningen och i webbläsarens titel.
 */

/**
 * @param {object} props
 * @param {string} props.href
 * @param {import("react").ReactNode} props.icon
 * @param {string} props.label Vad destinationen heter. Blir länkens uppläsning.
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {number} [props.badge] Antal. ⛔ 0 ritar ingen räknare: en nolla i en cirkel är en notis om att det inte finns någon notis.
 * @param {string} [props.badgeText] Substantivet efter siffran, t.ex. "nya". Appen bestämmer vad den räknar.
 * @param {boolean} [props.active] Står man på sidan just nu.
 */
export function OpsIconLink({ href, icon, label, onNavigate, badge, badgeText = "nya", active = false }) {
  if (!label) {
    throw new Error(
      "OpsIconLink: label krävs. En ikonlänk utan namn läses upp som sin adress, alltså \"/inkorg\", och det är inte ett namn på något.",
    );
  }

  const count = typeof badge === "number" && badge > 0 ? badge : 0;

  return (
    <a
      href={href}
      onClick={(e) => {
        if (onNavigate) onNavigate(href, e);
      }}
      aria-current={active ? "page" : undefined}
      // ⛔ Namnet innehåller INTE antalet. Räknaren har sin egen uppläsning, och
      // vore talet också i namnet skulle "Inkorg, 3 nya, 3 nya" läsas upp.
      aria-label={label}
      className={cx(
        "relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md",
        "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        // ⛔ Aktiv är MÖRKARE BLÄCK och ingen ifylld platta. En platta i
        // åtgärdsklustret ser ut som ett påslaget läge, alltså som att man tryckt
        // på en växlare, inte som "du är här".
        active ? "text-ink" : "text-ink-secondary",
      )}
    >
      <span aria-hidden="true">{icon}</span>
      {count > 0 ? <Counter count={count} text={badgeText} /> : null}
    </a>
  );
}
