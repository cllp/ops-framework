import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { OpsBrand } from "./OpsBrand.jsx";
import { OpsBottomNav } from "./OpsBottomNav.jsx";
import { postAktiv, valideraNav } from "../lib/nav.js";
import { ChevronNedIkon } from "./icons.jsx";

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
 * ⛔ Skalet vet aldrig vilka destinationer en plattform har. Listan kommer in
 * som `nav`-data. Dyker ett plattformsspecifikt ord upp här är något fel.
 *
 * Navigering i två lägen, en sanning:
 *   - Bred skärm (md+): länkarna i toppraden.
 *   - Smal skärm (under md): `OpsBottomNav`, en fast bottenrad med en Meny-sheet
 *     för överflödet. Den gamla push-menyn i headern finns inte längre — två
 *     mobila menyer parallellt är två sanningar.
 */

/**
 * @param {object} props
 * @param {import("react").ReactNode} props.brand Appens namn som sträng, eller en egen `OpsBrand`. Länkar till startsidan.
 * @param {import("../lib/nav.js").NavPost[]} props.nav Toppdestinationer. `{ href, label }` räcker; `icon`, `badge` och `children` (en nivå) är valfria tillägg.
 * @param {string} props.activeHref Vilken sida som visas nu.
 * @param {(href: string, event: any) => void} [props.onNavigate] Anropas i stället för webbläsarens navigering.
 * @param {import("react").ReactNode} [props.actions] Temaväxlare, konto, sök. Ligger till höger.
 * @param {string} [props.menuLabel] Text på Meny-platsen i bottenraden.
 * @param {string} [props.navLabel] Skärmläsarnamn på toppradens navigering.
 * @param {number} [props.maxTopNav] Hur många destinationer som får plats i toppraden. Resten hamnar under "Mer".
 * @param {string} [props.moreLabel] Texten på överflödesknappen i toppraden.
 * @param {string} [props.bottomNavLabel] Skärmläsarnamn på bottenraden. ⛔ Eget
 *   namn med flit, INTE samma som `navLabel`: se OpsBottomNav för varför två
 *   navigeringar med samma namn gör app-tester tvetydiga.
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
  // ⛔ Fem, inte "så många som får plats". En mätning av tillgänglig bredd vid
  // varje rendering ger hopp när typsnittet laddar och gör ordningen beroende av
  // fönstret. Ett fast tak är förutsägbart, och appen styr vilka fem genom sin
  // ordning.
  maxTopNav = 5,
  moreLabel = "Mer",
  bottomNavLabel = "Snabbnavigering",
  children,
}) {
  valideraNav(nav, "OpsAppShell");
  const [merOppen, setMerOppen] = useState(false);

  // ⛔ En sträng blir ett riktigt varumärke, inte fet text. Skälet är att det
  // vanliga fallet ska vara det rätta fallet: skriver man `brand="Bolag Ops"`
  // får man PH.ST-märket och namnet, utan att behöva veta att `OpsBrand` finns.
  const varumarke = typeof brand === "string" ? <OpsBrand title={brand} /> : brand;

  /** @param {string} href @param {any} e */
  const klick = (href, e) => {
    if (onNavigate) onNavigate(href, e);
  };

  /**
   * ⛔ AKTIV FLIK ÄR EN UNDERSTRYKNING, INTE EN FYLLD PILL.
   *
   * Den första versionen gav aktiv post `bg-accent-subtle`, alltså en ifylld
   * chip. Den läses som en KNAPP man kan trycka på, inte som "du är här", och
   * med tio poster i rad blir resultatet att man inte ser var man står. Det var
   * ordagrant vad som rapporterades: "menyn är enorm, man vet inte var man är".
   *
   * En understruken flik säger position. Det är också vad SessionStudio gör, och
   * den likheten är hela poängen med paritet: samma sak ska se likadan ut.
   */
  const lankKlass = (/** @type {boolean} */ aktiv) =>
    cx(
      "inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-base font-semibold",
      "transition-colors duration-(--duration-fast) ease-standard",
      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
      aktiv ? "border-ink text-ink" : "border-transparent text-ink-secondary hover:border-line-strong hover:text-ink",
    );

  // ⛔ Bara de första får plats i raden, resten hamnar under "Mer".
  //
  // Skälet är mätt: bolag-ops har tretton destinationer, och tretton platta
  // textlänkar får inte plats på någon skärm. De klämdes ihop tills de sista
  // hamnade under temaväxlaren och två försvann helt. Ingen "smart" prioritering
  // och ingen mätning av tillgänglig bredd: appen listar sina destinationer i
  // den ordning den vill ha dem, och de första syns. Samma regel som
  // bottenraden, av samma skäl.
  const iRaden = nav.slice(0, maxTopNav);
  const iMenyn = nav.slice(maxTopNav);
  const nagotIMenynArAktivt = iMenyn.some((s) => postAktiv(s, activeHref));

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
            {varumarke}
          </a>

          {/* Bred skärm: länkarna i raden. Smal: bottenraden nedan. */}
          <nav aria-label={navLabel} className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
            {iRaden.map((s) => (
              <a
                key={s.href}
                href={s.href}
                onClick={(e) => klick(s.href, e)}
                aria-current={postAktiv(s, activeHref) ? "page" : undefined}
                className={lankKlass(postAktiv(s, activeHref))}
              >
                {s.icon ? (
                  <span aria-hidden="true" className="shrink-0">
                    {s.icon}
                  </span>
                ) : null}
                {s.label}
              </a>
            ))}

            {iMenyn.length ? (
              <Popover.Root open={merOppen} onOpenChange={setMerOppen}>
                <Popover.Trigger
                  className={cx(lankKlass(nagotIMenynArAktivt), "cursor-pointer")}
                  aria-label={`${moreLabel}, ${iMenyn.length} till`}
                >
                  {moreLabel}
                  <span aria-hidden="true" className={cx("transition-transform duration-(--duration-fast)", merOppen && "rotate-180")}>
                    <ChevronNedIkon />
                  </span>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    align="start"
                    sideOffset={4}
                    className="z-(--z-dropdown) min-w-52 rounded-md border border-line bg-raised p-1 shadow-md"
                  >
                    {/* ⛔ Egen nav med eget namn. Menyn är en lista destinationer,
                        alltså navigering, och utan namn blir den en tredje
                        anonym `<nav>` i dokumentet. */}
                    <nav aria-label={moreLabel} className="flex flex-col">
                      {iMenyn.map((s) => (
                        <a
                          key={s.href}
                          href={s.href}
                          onClick={(e) => {
                            setMerOppen(false);
                            klick(s.href, e);
                          }}
                          aria-current={postAktiv(s, activeHref) ? "page" : undefined}
                          className={cx(
                            "flex min-h-11 items-center gap-2 rounded-sm px-3 text-base",
                            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                            postAktiv(s, activeHref) ? "bg-accent-subtle font-semibold text-ink" : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
                          )}
                        >
                          {s.icon ? (
                            <span aria-hidden="true" className="shrink-0">
                              {s.icon}
                            </span>
                          ) : null}
                          {s.label}
                        </a>
                      ))}
                    </nav>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            ) : null}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
        </div>
      </header>

      {/* `padding-bottom` lika med bottenradens höjd plus säker yta, men bara
          under md där baren finns. Utan den ligger sista kortet under baren, och
          det upptäcks först när någon inte hittar sin sista rad. */}
      <main className="pb-[calc(var(--bottom-nav-h)+var(--safe-bottom))] md:pb-0">{children}</main>

      <OpsBottomNav nav={nav} activeHref={activeHref} onNavigate={onNavigate} menuLabel={menuLabel} navLabel={bottomNavLabel} />
    </div>
  );
}
