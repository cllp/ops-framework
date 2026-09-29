import { cx } from "../lib/cx.js";
import { radKlass } from "../lib/radKlass.js";
import { validateNav } from "../lib/nav.js";
import { OpsCountBadge } from "./counter.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";

/**
 * Hub: appens moduler som ett rutnät av kort (0.30.0, #173).
 *
 * ══ ⛔ VARFÖR MODULERNA BOR HÄR OCH INTE I MENYN ═══════════════════════════
 *
 * bolag-ops hade tretton poster i navigeringen: Händelser, Översikt, Ekonomi
 * med fem barn, och så vidare. De fick inte plats i toppraden, hamnade under
 * "Meny", och menyn blev en andra navigering bredvid den första: en lista över
 * ALLT, i samma rad som Logga ut och versionen. CP 2026-09-29: "menyn ska bara
 * ha ramverkets saker, appens moduler ska ligga i Hub". SessionStudio gör så:
 * Idag och Kalender är alltid nära, resten är ett steg bort.
 *
 * Hub är det steget. Skalet (`OpsAppShell` med `fasta` och `moduler`) ritar Hub
 * som en post i toppraden och bottenraden; den här komponenten är SIDAN Hub
 * leder till, ett kort per modul med modulens undersidor som länkar under.
 * Appen skickar samma `moduler` till båda, så dropdownen i toppraden och sidan
 * aldrig visar olika listor.
 *
 * ⛔ TOM LISTA VISAR TEXT, ALDRIG EN TOM YTA (arbetsreglernas punkt 5). En Hub
 * utan moduler säger att den är tom och varför, i stället för att se ut som
 * en sida som inte laddat klart.
 *
 * ⛔ RUNDNING OCH HOVER SOM SESSIONSSTUDIO: kortet är `rounded-card` (24 px,
 * SS `rounded-2xl`), raderna i det är `radKlass` (`rounded-base`,
 * `hover:bg-raised`), samma rad som menyn och plusset.
 *
 * @param {object} props
 * @param {import("../lib/nav.js").NavPost[]} props.moduler Appens moduler, samma form som `nav` (en nivå barn).
 * @param {string} [props.activeHref] Markerar modulens kort som "du är här".
 * @param {(href: string, event: any) => void} [props.onNavigate] Anropas i stället för webbläsarens navigering.
 * @param {string} [props.ariaLabel] Skärmläsarnamn på listan.
 * @param {string} [props.tomRubrik] Rubriken när `moduler` är tom.
 * @param {string} [props.tomText] Texten när `moduler` är tom: vad som saknas och vad man gör åt det.
 * @param {string} [props.badgeText] Skärmläsarord efter en räknare, t.ex. "nya".
 */
export function OpsHub({
  moduler,
  activeHref = "",
  onNavigate,
  ariaLabel = "Moduler",
  tomRubrik = "Inga moduler än",
  tomText = "Den här appen har inga moduler att visa. De läggs till av appens ägare.",
  badgeText = "nya",
}) {
  validateNav(moduler, "OpsHub: moduler");
  if (moduler.length === 0) return <OpsEmpty title={tomRubrik} description={tomText} />;

  return (
    <ul aria-label={ariaLabel} className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {moduler.map((m) => {
        const aktiv = m.href === activeHref || (m.children ?? []).some((c) => c.href === activeHref);
        return (
          <li key={m.href} className="min-w-0">
            <section
              aria-label={m.label}
              className={cx("flex h-full flex-col gap-1 rounded-card bg-surface p-4", aktiv && "ring-2 ring-accent")}
            >
              <a
                href={m.href}
                onClick={(e) => onNavigate?.(m.href, e)}
                aria-current={m.href === activeHref ? "page" : undefined}
                className={cx(radKlass({ active: m.href === activeHref }), "text-sm font-medium")}
              >
                {m.icon ? (
                  <span aria-hidden="true" className="flex shrink-0 items-center [&_svg]:size-5">
                    {m.icon}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate">{m.label}</span>
                {typeof m.badge === "number" ? <OpsCountBadge count={m.badge} text={badgeText} placement="inline" /> : null}
              </a>
              {(m.children ?? []).length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {(m.children ?? []).map((c) => (
                    <a
                      key={c.href}
                      href={c.href}
                      onClick={(e) => onNavigate?.(c.href, e)}
                      aria-current={c.href === activeHref ? "page" : undefined}
                      className={cx(radKlass({ active: c.href === activeHref }), "pl-11")}
                    >
                      <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </section>
          </li>
        );
      })}
    </ul>
  );
}
