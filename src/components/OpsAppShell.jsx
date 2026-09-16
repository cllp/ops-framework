import { cx } from "../lib/cx.js";
import { OpsBrand } from "./OpsBrand.jsx";
import { OpsBottomNav } from "./OpsBottomNav.jsx";
import { postAktiv, valideraNav } from "../lib/nav.js";

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
  bottomNavLabel = "Snabbnavigering",
  children,
}) {
  valideraNav(nav, "OpsAppShell");

  // ⛔ En sträng blir ett riktigt varumärke, inte fet text. Skälet är att det
  // vanliga fallet ska vara det rätta fallet: skriver man `brand="Bolag Ops"`
  // får man PH.ST-märket och namnet, utan att behöva veta att `OpsBrand` finns.
  const varumarke = typeof brand === "string" ? <OpsBrand title={brand} /> : brand;

  /** @param {string} href @param {any} e */
  const klick = (href, e) => {
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
            {varumarke}
          </a>

          {/* Bred skärm: länkarna i raden. Smal: bottenraden nedan. */}
          <nav aria-label={navLabel} className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
            {nav.map((s) => (
              <a
                key={s.href}
                href={s.href}
                onClick={(e) => klick(s.href, e)}
                aria-current={postAktiv(s, activeHref) ? "page" : undefined}
                className={lankKlass(postAktiv(s, activeHref))}
              >
                {s.label}
              </a>
            ))}
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
