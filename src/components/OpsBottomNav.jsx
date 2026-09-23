import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { KryssIkon, MenuIcon, PlusIkon } from "./icons.jsx";
import { entryActive, validateNav } from "../lib/nav.js";

/**
 * Bottennavigering för smal skärm (under `md`). Renderas av `OpsAppShell` men
 * exporteras också fristående.
 *
 * ⛔ Varför den ligger fast i botten och inte i dokumentflödet: en meny som
 * knuffar innehållet när den öppnas gör att sidan hoppar, och det är just den
 * ryckigheten som gjorde det gamla skalet knöligt i mobilen. Fast position plus
 * `padding-bottom` på `main` (som `OpsAppShell` sätter) löser båda.
 *
 * ⛔ Beteendet i överflödes-sheeten (fokusfälla, Escape, klick utanför,
 * scroll-lås, ur DOM när stängd, fokus tillbaka till knappen) är Radix, inte
 * handskrivet. Se skälen i OpsModal.
 *
 * Kontraktet: högst fyra toppdestinationer i raden, `Meny` alltid sist och
 * öppnar resten i en sheet. Ordningen i `nav` är appens beslut, ingen "smart"
 * prioritering.
 *
 * ── ⛔ HUVUDÅTGÄRDEN, OCH VARFÖR DEN TAR EN PLATS I RADEN ────────────────
 *
 * `primaryAction` är den enda saken man GÖR i stället för går till. Den ritas
 * som en rund knapp mitt i raden, större än flikarna och i accentfärg, eftersom
 * den inte är en destination bland andra.
 *
 * ⛔ NÄR DEN FINNS RYMS EN DESTINATION MINDRE, och det är ingen besparing att
 * göra på. Raden är 390 px på en telefon. Fyra flikar plus Meny plus en knapp på
 * 56 px ger 6 platser, alltså 56 px var med noll luft, och etiketterna blir
 * avhuggna. Med tre flikar plus Meny blir det 4 textplatser runt knappen, vilket
 * är exakt vad mönstret på telefoner ser ut som.
 *
 * ⛔ Knappen är INTE en länk och hamnar inte i menyn. Den öppnar något i appen,
 * och en åtgärd som ligger i en destinationslista läses som en sida man kan
 * navigera tillbaka från.
 */

const MAX_IN_ROW = 4;

/** Med en huvudåtgärd i mitten ryms färre flikar. Mätt, se filhuvudet. */
const MAX_IN_ROW_WITH_ACTION = 3;

/**
 * @param {object} props
 * @param {import("../lib/nav.js").NavPost[]} props.nav
 * @param {import("../lib/nav.js").NavPost[]} [props.moreNav] Överlopp till Mer-sheeten. ⛔ När skalet skickar den här är det SAMMA lista som header-hamburgaren (`nav.slice(smaltTak)`). Utan den (fristående användning) beräknas överlopp från `tak`.
 * @param {string} props.activeHref
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} [props.menuLabel] Text på Meny-platsen.
 * @param {string} [props.navLabel] Skärmläsarnamn på bottenraden. ⛔ MÅSTE skilja
 *   sig från toppradens. Båda raderna ligger i DOM:en samtidigt och döljs med
 *   CSS, så i en riktig webbläsare är bara en i tillgänglighetsträdet, men i ett
 *   test finns ingen CSS. Delar de namn går de inte att skilja åt, och varje
 *   `getByRole` i en app som bygger på ramverket får dubbletter.
 * @param {string} [props.sheetLabel] Rubrik i överflödes-sheeten (annonseras av skärmläsaren).
 * @param {string} [props.closeLabel] Skärmläsarnamn på stängknappen i sheeten.
 * @param {string} [props.badgeText] Skärmläsarord efter siffran i en badge, t.ex. "olästa" eller "att göra". Appen bestämmer vad den räknar.
 * @param {{ label: string, onClick: () => void, icon?: import("react").ReactNode }} [props.primaryAction] Det man GÖR här, inte går till. Ritas som en rund knapp mitt i raden. `label` är knappens namn för skärmläsare och står aldrig som text: en rund knapp har ingen plats för ord.
 * @param {import("react").ReactNode} [props.menuExtras] Extra kontroller i Mer-sheeten (samma som header-hamburgaren), t.ex. tema och helskärm.
 */
export function OpsBottomNav({
  nav,
  moreNav,
  activeHref,
  onNavigate,
  primaryAction,
  menuLabel = "Meny",
  navLabel = "Snabbnavigering",
  sheetLabel = "Meny",
  closeLabel = "Stäng",
  badgeText = "nya",
  menuExtras,
}) {
  validateNav(nav, "OpsBottomNav");
  const [oppen, setOppen] = useState(false);

  if (primaryAction && (typeof primaryAction.label !== "string" || typeof primaryAction.onClick !== "function")) {
    throw new Error(
      "OpsBottomNav: primaryAction måste ha label (sträng) och onClick (funktion). " +
        "Etiketten är knappens enda namn för den som inte ser den, och en rund knapp utan namn är en knapp ingen kan använda.",
    );
  }

  const tak = primaryAction ? MAX_IN_ROW_WITH_ACTION : MAX_IN_ROW;
  const inRow = nav.slice(0, tak);

  // Knappen delar raden på mitten. Udda antal flikar ger en extra till vänster,
  // vilket är rätt håll: den första fliken är den man trycker oftast.
  const brytpunkt = Math.ceil(inRow.length / 2);

  // ⛔ SHEETEN = HEADERNS MER-LISTA, INTE EN ANDRA SANNING.
  //
  // Skalet skickar `moreNav` (= `nav.slice(smaltTak)`), samma poster som
  // desktop-hamburgaren. Då är det EN meny med två ytor: popover på md+,
  // sheet under md. Utan `moreNav` (fristående) är fallback överlopp från `tak`.
  //
  // ⛔ Ingen barn-lyft av bar-poster. Ekonomi syns i bottenraden; dess
  // undersidor nås via Ekonomisidan, inte som dubblett i Mer.
  /** @type {import("../lib/nav.js").NavPost[]} */
  const inMenu = Array.isArray(moreNav) ? moreNav : nav.slice(tak);

  /** @param {string} href @param {any} e */
  const klick = (href, e) => {
    setOppen(false);
    if (onNavigate) onNavigate(href, e);
  };

  return (
    // `pb-(--safe-bottom)`: utan säker yta hamnar knapparna under hemindikatorn
    // på en iPhone, och det syns bara på riktig hårdvara.
    <nav
      aria-label={navLabel}
      className="fixed inset-x-0 bottom-0 z-(--z-chrome) border-t border-line bg-surface pb-(--safe-bottom) md:hidden"
    >
      <div className="mx-auto flex h-(--bottom-nav-h) max-w-md items-stretch">
        {inRow.slice(0, brytpunkt).map((entry) => (
          <BottomLank
            key={entry.href}
            entry={entry}
            active={entryActive(entry, activeHref)}
            onClick={(/** @type {any} */ e) => klick(entry.href, e)}
            badgeText={badgeText}
          />
        ))}

        {primaryAction ? <Huvudatgard atgard={primaryAction} /> : null}

        {inRow.slice(brytpunkt).map((entry) => (
          <BottomLank
            key={entry.href}
            entry={entry}
            active={entryActive(entry, activeHref)}
            onClick={(/** @type {any} */ e) => klick(entry.href, e)}
            badgeText={badgeText}
          />
        ))}

        <Dialog.Root open={oppen} onOpenChange={setOppen}>
          <Dialog.Trigger asChild>
            <button type="button" className={platsKlass(false)}>
              <MenuIcon size={22} />
              <span className="mt-0.5 max-w-full truncate text-xs font-medium">{menuLabel}</span>
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim md:hidden" />
            {/* `max-h` i `dvh` och inte `vh`: Safaris verktygsrad ändrar höjd, och
                100vh räknar med den största så innehållet hamnar under kanten. */}
            <Dialog.Content
              className="fixed inset-x-0 bottom-0 z-(--z-modal) flex max-h-[85dvh] flex-col rounded-t-xl border-t border-line bg-raised pb-(--safe-bottom) md:hidden"
              aria-describedby={undefined}
            >
              <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
                <Dialog.Title className="m-0 text-md font-bold text-ink">{sheetLabel}</Dialog.Title>
                <Dialog.Close
                  aria-label={closeLabel}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-muted transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <KryssIkon size={20} />
                </Dialog.Close>
              </div>
              <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
                {inMenu.map((entry) => (
                  <SheetPost key={entry.href} entry={entry} activeHref={activeHref} onNavigate={klick} badgeText={badgeText} />
                ))}
                {menuExtras ? (
                  <>
                    {inMenu.length ? (
                      <div role="separator" className="my-2 border-t border-line" />
                    ) : null}
                    <div className="flex items-center gap-0.5 px-1 py-0.5">{menuExtras}</div>
                  </>
                ) : null}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </nav>
  );
}

/**
 * Den runda knappen mitt i raden.
 *
 * ⛔ Den STICKER UPP ur raden (`-translate-y-3`) och har en ring i ytans färg.
 * Utan det blir den en cirkel bland fyra ikoner, alltså en femte flik som råkar
 * vara rund, och hela poängen med att skilja "gör" från "gå till" försvinner.
 *
 * ⛔ Namnet ligger i `aria-label` och som `sr-only`-text, aldrig som synlig
 * etikett. En knapp på 56 px rymmer inget ord, och ett avhugget ord under den
 * ser ut som ett fel.
 *
 * @param {{ atgard: { label: string, onClick: () => void, icon?: import("react").ReactNode } }} props
 */
function Huvudatgard({ atgard }) {
  return (
    <div className="flex shrink-0 items-center justify-center px-1">
      <button
        type="button"
        onClick={atgard.onClick}
        aria-label={atgard.label}
        className={cx(
          "-translate-y-3 inline-flex size-14 cursor-pointer items-center justify-center rounded-full",
          "bg-accent text-accent-contrast ring-4 ring-surface",
          "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-hover",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
      >
        {atgard.icon ?? <PlusIkon size={26} />}
      </button>
    </div>
  );
}

/** @param {boolean} active @returns {string} */
function platsKlass(active) {
  return cx(
    "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0 px-1 py-1.5",
    "text-center transition-colors duration-(--duration-fast) ease-standard",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
    active ? "text-accent" : "text-ink-secondary hover:text-ink",
  );
}

/**
 * @param {{ entry: import("../lib/nav.js").NavPost, active: boolean, onClick: (e: any) => void, badgeText: string }} props
 */
function BottomLank({ entry, active, onClick, badgeText }) {
  return (
    <a
      href={entry.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={platsKlass(active)}
    >
      <span className="relative inline-flex">
        {entry.icon ?? <span className="inline-block h-[22px] w-[22px] rounded-full border-2 border-current" aria-hidden="true" />}
        {typeof entry.badge === "number" ? <Badge count={entry.badge} text={badgeText} /> : null}
      </span>
      <span className="mt-0.5 max-w-full truncate text-xs font-medium">{entry.label}</span>
    </a>
  );
}

/**
 * @param {{ entry: import("../lib/nav.js").NavPost, activeHref: string, onNavigate: (href: string, e: any) => void, badgeText: string }} props
 */
function SheetPost({ entry, activeHref, onNavigate, badgeText }) {
  const hasChildren = Array.isArray(entry.children) && entry.children.length > 0;
  return (
    <div className="mb-1">
      <a
        href={entry.href}
        onClick={(e) => onNavigate(entry.href, e)}
        aria-current={entry.href === activeHref ? "page" : undefined}
        className={sheetLankKlass(entry.href === activeHref, hasChildren)}
      >
        <span className="flex min-w-0 items-center gap-3">
          {entry.icon ? <span className="shrink-0">{entry.icon}</span> : null}
          <span className="truncate">{entry.label}</span>
        </span>
        {typeof entry.badge === "number" ? <Badge count={entry.badge} text={badgeText} /> : null}
      </a>
      {hasChildren ? (
        <div className="mt-0.5 flex flex-col gap-0.5 pl-4">
          {(entry.children ?? []).map((childEntries) => (
            <a
              key={childEntries.href}
              href={childEntries.href}
              onClick={(e) => onNavigate(childEntries.href, e)}
              aria-current={childEntries.href === activeHref ? "page" : undefined}
              className={sheetLankKlass(childEntries.href === activeHref, false)}
            >
              <span className="truncate">{childEntries.label}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** @param {boolean} active @param {boolean} title @returns {string} */
function sheetLankKlass(active, title) {
  return cx(
    "flex min-h-11 items-center justify-between gap-3 rounded-md px-3 py-2",
    "transition-colors duration-(--duration-fast) ease-standard",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
    title ? "font-semibold" : "text-base",
    active ? "bg-accent-subtle text-ink" : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
  );
}

/**
 * En badge har både siffra och skärmläsartext. En prick utan namn säger
 * ingenting till den som inte ser den.
 * @param {{ count: number, text: string }} props
 */
function Badge({ count, text }) {
  return (
    <span className="inline-flex min-h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-accent px-1 text-xs font-bold leading-none text-accent-contrast">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">
        {count} {text}
      </span>
    </span>
  );
}
