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
 *
 * ── ⛔ KNAPPEN RITAS INTE ALLS DÄR HELSKÄRM INTE FINNS ───────────────────
 *
 * Rapporterat från en iPhone: "fullscreen som inte funkar i mobil". Det stämde,
 * och skälet är att Safari på iPhone inte har Fullscreen-API:et för vanliga
 * element alls, bara för video. Knappen satt alltså i sidhuvudet och gjorde
 * ingenting, på den skärm där utrymmet i sidhuvudet är som dyrast.
 *
 * ⛔ Villkoret är webbläsarens EGET svar (`document.fullscreenEnabled` plus att
 * metoden finns), inte en brytpunkt på skärmbredd. En brytpunkt hade gömt
 * knappen på en liten men fullt kapabel skärm och visat den på en stor iPad där
 * den ändå inte fungerar. Frågan är "kan den här webbläsaren", och den frågan
 * kan bara webbläsaren svara på.
 *
 * ⛔ Den gamla webkit-prefixen (`webkitRequestFullscreen`) räknas MED FLIT inte
 * som ett ja. Komponenten anropar bara den oprefixade metoden, så ett ja på den
 * prefixade hade gett tillbaka exakt den döda knapp raden finns för att ta bort.
 */

/**
 * @param {object} props
 * @param {string} [props.enterLabel]
 * @param {string} [props.exitLabel]
 */
export function OpsFullscreenToggle({ enterLabel = "Helskärm", exitLabel = "Avsluta helskärm" }) {
  const [helskarm, setHelskarm] = useState(false);
  // Läses en gång vid montering. Svaret ändras inte under en sidas livstid, och
  // ett värde som läses vid varje rendering är ett värde som kan hoppa.
  const [kanHelskarm] = useState(
    () =>
      typeof document !== "undefined" &&
      Boolean(document.fullscreenEnabled) &&
      typeof document.documentElement.requestFullscreen === "function",
  );

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

  // ⛔ Inget alls, och inte en utgråad knapp. En avstängd kontroll säger "det här
  // går att göra, men inte nu", vilket är osant här: det går aldrig i den här
  // webbläsaren. Då är rätt mängd knappar noll.
  if (!kanHelskarm) return null;

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
