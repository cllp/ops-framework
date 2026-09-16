import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { KryssIkon, MenyIkon } from "./icons.jsx";
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
 */

const MAX_I_RADEN = 4;

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
 */
export function OpsBottomNav({
  nav,
  activeHref,
  onNavigate,
  menuLabel = "Meny",
  navLabel = "Snabbnavigering",
  sheetLabel = "Meny",
  closeLabel = "Stäng",
  badgeText = "nya",
}) {
  valideraNav(nav, "OpsBottomNav");
  const [oppen, setOppen] = useState(false);

  const iRaden = nav.slice(0, MAX_I_RADEN);

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
  const iMenyn = nav.filter((post, i) => i >= MAX_I_RADEN || (Array.isArray(post.children) && post.children.length > 0));

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
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-line bg-surface pb-(--safe-bottom) md:hidden"
    >
      <div className="mx-auto flex h-(--bottom-nav-h) max-w-md items-stretch">
        {iRaden.map((post) => (
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
