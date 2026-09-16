import { useCallback, useEffect, useState } from "react";
import { cx } from "../lib/cx.js";
import { HelskarmIkon, HelskarmAvIkon } from "./icons.jsx";

/**
 * Helskärm på och av, via webbläsarens egen API.
 *
 * Avläst ur SessionStudios `useFullscreenToggle` och knappen bredvid sökningen i
 * headern. Samma ikoner, samma beteende.
 *
 * ── ⛔ TILLSTÅNDET LÄSES UR WEBBLÄSAREN, INTE UR EN BOOLEAN VI ÄGER ───────
 *
 * Man kan lämna helskärm med Escape, med F11 och genom att byta flik, utan att
 * någon knapp tryckts. En egen `useState` som sätts vid klick blir då fel, och
 * knappen visar "avsluta helskärm" när man redan är ute.
 *
 * Därför lyssnar den på `fullscreenchange` och speglar `document.fullscreenElement`.
 * Det är samma sorts fel som ett lagrat `isOnline`: två sanningar om ett
 * tillstånd som någon annan äger.
 *
 * ⛔ `requestFullscreen` kan AVSLÅS, till exempel när anropet inte kommer från
 * en användargest eller när sidan ligger i en iframe utan `allow="fullscreen"`.
 * Löftet fångas därför, och knappen blir helt enkelt kvar i sitt läge i stället
 * för att kasta ett ohanterat fel i konsolen.
 */

/**
 * @param {object} props
 * @param {string} [props.enterLabel]
 * @param {string} [props.exitLabel]
 */
export function OpsFullscreenToggle({ enterLabel = "Helskärm", exitLabel = "Avsluta helskärm" }) {
  const [helskarm, setHelskarm] = useState(false);

  useEffect(() => {
    const vid = () => setHelskarm(Boolean(document.fullscreenElement));
    // ⛔ Sätts en gång direkt också: monteras knappen medan sidan redan ligger i
    // helskärm hade den annars börjat i fel läge tills något ändrades.
    vid();
    document.addEventListener("fullscreenchange", vid);
    return () => document.removeEventListener("fullscreenchange", vid);
  }, []);

  const vaxla = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.()?.catch(() => {});
      return;
    }
    document.documentElement.requestFullscreen?.()?.catch(() => {});
  }, []);

  const Ikon = helskarm ? HelskarmAvIkon : HelskarmIkon;

  return (
    <button
      type="button"
      onClick={vaxla}
      aria-label={helskarm ? exitLabel : enterLabel}
      className={cx(
        "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md text-ink-secondary",
        "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      <Ikon size={20} />
    </button>
  );
}
