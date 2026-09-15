import { useId, useState } from "react";
import { cx } from "../lib/cx.js";
import { KryssIkon } from "./icons.jsx";

/**
 * Appskalet: varumärke, navigering och ett utrymme för konto och tema.
 *
 * ⛔ Skalet är ROUTER-AGNOSTISKT, och det är ett medvetet val.
 *
 * Ramverket får inte bero på react-router, för då tvingar det varje plattform
 * till samma routerval för all framtid. Lösningen är att skalet renderar riktiga
 * `<a href>` och tar emot ett valfritt `onNavigate`. Appen skickar in en
 * hanterare som anropar sin router och stoppar webbläsarens omladdning.
 *
 * Vinsten är dubbel: utan JavaScript, i en ny flik, eller vid högerklick och
 * "öppna i nytt fönster" fungerar länkarna ändå, eftersom de är riktiga länkar.
 * En nav byggd av `<div onClick>` tappar allt det, och ingen märker det förrän
 * någon försöker dela en länk till en sida.
 */

/**
 * @param {object} props
 * @param {import("react").ReactNode} props.brand Namn eller logotyp. Länkar till startsidan.
 * @param {{ href: string, label: string }[]} props.nav
 * @param {string} props.activeHref Vilken sida som visas nu.
 * @param {(href: string, event: any) => void} [props.onNavigate] Anropas i stället för webbläsarens navigering.
 * @param {import("react").ReactNode} [props.actions] Temaväxlare, konto, sök. Ligger till höger.
 * @param {string} [props.menuLabel] Skärmläsarnamn på menyknappen i smalt läge.
 * @param {string} [props.navLabel] Skärmläsarnamn på navigeringen.
 * @param {import("react").ReactNode} props.children
 */
export function OpsAppShell({
  brand,
  nav,
  activeHref,
  onNavigate,
  actions,
  menuLabel = "Meny",
  navLabel = "Huvudnavigering",
  children,
}) {
  const [oppen, setOppen] = useState(false);
  const menyId = useId();

  if (!Array.isArray(nav)) {
    throw new Error("OpsAppShell: nav krävs och måste vara en lista av { href, label }.");
  }

  /** @param {string} href @param {any} e */
  const klick = (href, e) => {
    setOppen(false);
    if (onNavigate) onNavigate(href, e);
  };

  const lankKlass = (/** @type {boolean} */ aktiv) =>
    cx(
      "rounded-md px-3 py-2 text-base font-semibold",
      "transition-colors duration-(--duration-fast) ease-standard",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      aktiv ? "bg-accent-subtle text-ink" : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
    );

  return (
    <div className="min-h-dvh bg-canvas">
      {/* `top-(--safe-top)` och inte `top-0`: utan säker yta hamnar raden under
          statusfältet på en telefon, och det syns bara på riktig hårdvara. */}
      <header className="sticky top-(--safe-top) z-(--z-sticky) border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
          <a
            href="/"
            onClick={(e) => klick("/", e)}
            className="shrink-0 rounded-md px-1 py-1 text-md font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {brand}
          </a>

          {/* Bred skärm: länkarna i raden. Smal: knappen nedan. */}
          <nav aria-label={navLabel} className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
            {nav.map((s) => (
              <a
                key={s.href}
                href={s.href}
                onClick={(e) => klick(s.href, e)}
                aria-current={s.href === activeHref ? "page" : undefined}
                className={lankKlass(s.href === activeHref)}
              >
                {s.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={() => setOppen((v) => !v)}
              aria-label={menyLabelText(menuLabel, oppen)}
              aria-expanded={oppen}
              aria-controls={menyId}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-secondary hover:bg-accent-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:hidden"
            >
              {oppen ? <KryssIkon size={20} /> : <HamburgerIkon />}
            </button>
          </div>
        </div>

        {/* ⛔ Menyn tas UR DOM:en när den är stängd, i stället för att döljas med
            CSS. En dold meny som ligger kvar fångar tabb-fokus, och användaren
            hamnar då i en osynlig lista utan att förstå var fokus tog vägen. */}
        {oppen ? (
          <nav id={menyId} aria-label={navLabel} className="flex flex-col gap-1 border-t border-line px-4 py-2 md:hidden">
            {nav.map((s) => (
              <a
                key={s.href}
                href={s.href}
                onClick={(e) => klick(s.href, e)}
                aria-current={s.href === activeHref ? "page" : undefined}
                className={lankKlass(s.href === activeHref)}
              >
                {s.label}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      <main>{children}</main>
    </div>
  );
}

/** @param {string} bas @param {boolean} oppen @returns {string} */
function menyLabelText(bas, oppen) {
  return oppen ? `${bas}, stäng` : `${bas}, öppna`;
}

function HamburgerIkon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}
