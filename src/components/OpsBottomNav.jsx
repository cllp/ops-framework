import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { KryssIkon, MenyIkon, PlusIkon } from "./icons.jsx";
import { postAktiv, valideraNav } from "../lib/nav.js";

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

const MAX_I_RADEN = 4;

/** Med en huvudåtgärd i mitten ryms färre flikar. Mätt, se filhuvudet. */
const MAX_I_RADEN_MED_ATGARD = 3;

/**
 * @param {object} props
 * @param {import("../lib/nav.js").NavPost[]} props.nav
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
 */
export function OpsBottomNav({
  nav,
  activeHref,
  onNavigate,
  primaryAction,
  menuLabel = "Meny",
  navLabel = "Snabbnavigering",
  sheetLabel = "Meny",
  closeLabel = "Stäng",
  badgeText = "nya",
}) {
  valideraNav(nav, "OpsBottomNav");
  const [oppen, setOppen] = useState(false);

  if (primaryAction && (typeof primaryAction.label !== "string" || typeof primaryAction.onClick !== "function")) {
    throw new Error(
      "OpsBottomNav: primaryAction måste ha label (sträng) och onClick (funktion). " +
        "Etiketten är knappens enda namn för den som inte ser den, och en rund knapp utan namn är en knapp ingen kan använda.",
    );
  }

  const tak = primaryAction ? MAX_I_RADEN_MED_ATGARD : MAX_I_RADEN;
  const iRaden = nav.slice(0, tak);

  // Knappen delar raden på mitten. Udda antal flikar ger en extra till vänster,
  // vilket är rätt håll: den första fliken är den man trycker oftast.
  const brytpunkt = Math.ceil(iRaden.length / 2);

  // ⛔ SHEETEN LISTAR BARA DET SOM INTE REDAN STÅR I BAREN.
  //
  // Den listade hela `nav`, alltså även de fyra som syns en centimeter längre
  // ned i samma vy. Rapporten löd: "hamburgermenyn behöver inte upprepa
  // menyalternativen som redan finns."
  //
  // Det är inte bara onödigt. En meny som upprepar det synliga får läsaren att
  // leta efter skillnaden mellan de två listorna, och svaret är att det inte
  // finns någon. Menyn ska svara på "vad mer finns det", inte "här är allt
  // igen".
  //
  // ⛔ Undantaget: en post med barn står kvar även om den syns i baren,
  // eftersom barnen bara finns här. Utan det blir undersidorna onåbara på
  // telefon, och det är en trasig app snarare än en repetitiv meny.
  const iMenyn = nav.filter((post, i) => i >= tak || (Array.isArray(post.children) && post.children.length > 0));

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
        {iRaden.slice(0, brytpunkt).map((post) => (
          <BottomLank
            key={post.href}
            post={post}
            aktiv={postAktiv(post, activeHref)}
            onClick={(/** @type {any} */ e) => klick(post.href, e)}
            badgeText={badgeText}
          />
        ))}

        {primaryAction ? <Huvudatgard atgard={primaryAction} /> : null}

        {iRaden.slice(brytpunkt).map((post) => (
          <BottomLank
            key={post.href}
            post={post}
            aktiv={postAktiv(post, activeHref)}
            onClick={(/** @type {any} */ e) => klick(post.href, e)}
            badgeText={badgeText}
          />
        ))}

        <Dialog.Root open={oppen} onOpenChange={setOppen}>
          <Dialog.Trigger asChild>
            <button type="button" className={platsKlass(false)}>
              <MenyIkon size={22} />
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
                {iMenyn.map((post) => (
                  <SheetPost key={post.href} post={post} activeHref={activeHref} onNavigate={klick} badgeText={badgeText} />
                ))}
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

/** @param {boolean} aktiv @returns {string} */
function platsKlass(aktiv) {
  return cx(
    "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0 px-1 py-1.5",
    "text-center transition-colors duration-(--duration-fast) ease-standard",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
    aktiv ? "text-accent" : "text-ink-secondary hover:text-ink",
  );
}

/**
 * @param {{ post: import("../lib/nav.js").NavPost, aktiv: boolean, onClick: (e: any) => void, badgeText: string }} props
 */
function BottomLank({ post, aktiv, onClick, badgeText }) {
  return (
    <a
      href={post.href}
      onClick={onClick}
      aria-current={aktiv ? "page" : undefined}
      className={platsKlass(aktiv)}
    >
      <span className="relative inline-flex">
        {post.icon ?? <span className="inline-block h-[22px] w-[22px] rounded-full border-2 border-current" aria-hidden="true" />}
        {typeof post.badge === "number" ? <Badge antal={post.badge} text={badgeText} /> : null}
      </span>
      <span className="mt-0.5 max-w-full truncate text-xs font-medium">{post.label}</span>
    </a>
  );
}

/**
 * @param {{ post: import("../lib/nav.js").NavPost, activeHref: string, onNavigate: (href: string, e: any) => void, badgeText: string }} props
 */
function SheetPost({ post, activeHref, onNavigate, badgeText }) {
  const harBarn = Array.isArray(post.children) && post.children.length > 0;
  return (
    <div className="mb-1">
      <a
        href={post.href}
        onClick={(e) => onNavigate(post.href, e)}
        aria-current={post.href === activeHref ? "page" : undefined}
        className={sheetLankKlass(post.href === activeHref, harBarn)}
      >
        <span className="flex min-w-0 items-center gap-3">
          {post.icon ? <span className="shrink-0">{post.icon}</span> : null}
          <span className="truncate">{post.label}</span>
        </span>
        {typeof post.badge === "number" ? <Badge antal={post.badge} text={badgeText} /> : null}
      </a>
      {harBarn ? (
        <div className="mt-0.5 flex flex-col gap-0.5 pl-4">
          {(post.children ?? []).map((barn) => (
            <a
              key={barn.href}
              href={barn.href}
              onClick={(e) => onNavigate(barn.href, e)}
              aria-current={barn.href === activeHref ? "page" : undefined}
              className={sheetLankKlass(barn.href === activeHref, false)}
            >
              <span className="truncate">{barn.label}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** @param {boolean} aktiv @param {boolean} rubrik @returns {string} */
function sheetLankKlass(aktiv, rubrik) {
  return cx(
    "flex min-h-11 items-center justify-between gap-3 rounded-md px-3 py-2",
    "transition-colors duration-(--duration-fast) ease-standard",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
    rubrik ? "font-semibold" : "text-base",
    aktiv ? "bg-accent-subtle text-ink" : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
  );
}

/**
 * En badge har både siffra och skärmläsartext. En prick utan namn säger
 * ingenting till den som inte ser den.
 * @param {{ antal: number, text: string }} props
 */
function Badge({ antal, text }) {
  return (
    <span className="inline-flex min-h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-accent px-1 text-xs font-bold leading-none text-accent-contrast">
      <span aria-hidden="true">{antal}</span>
      <span className="sr-only">
        {antal} {text}
      </span>
    </span>
  );
}
