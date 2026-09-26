import { useCallback, useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { ChevronHogerIkon, ChevronVansterIkon, KryssIkon } from "./icons.jsx";
import { OpsCountBadge } from "./counter.jsx";

/**
 * En panel med vyer i en stack: rot, undervy, detalj.
 *
 * ══ ⛔ VARFÖR EN PANEL OCH INTE EN MODAL ════════════════════════════════════
 *
 * CP 2026-09-25, om notiserna: "Navigeringen är inte bra att det kommer upp en
 * detalj mitt i skärmen det skall kännas som att man är i samma panel."
 *
 * En modal säger "lämna det du gjorde och ta ställning till det här". Ett
 * notisflöde säger inget sådant: man tittar, går in på en rad, går tillbaka och
 * stänger. Mönstret är avläst ur SessionStudio, där menyn och notiserna delar
 * panel och innehållet byts PÅ PLATS med `<` tillbaka.
 *
 * ⛔ SKILLNADEN ÄR INTE KOSMETISK. En modal mörklägger sidan, flyttar fokus och
 * döljer bakgrunden för skärmläsare. Gör man det för att visa att ett jobb kört
 * i natt har man avbrutit någon för något som inte kräver ett svar.
 *
 * ══ ⛔ RADIX SOM BOTTEN, INTE EN EGEN YTA ═══════════════════════════════════
 *
 * Klick utanför, Escape, fokushantering och portalen finns redan och är svåra
 * att få rätt. Panelen ska SE UT som menyn, för den är samma sak.
 *
 * ══ ⛔ OCH MENYN ÄR INTE SAMMA YTA I BÅDA BREDDERNA ═════════════════════════
 *
 * CP 2026-09-26, om notiserna: "Vill ha notisers funktion med inkorgs
 * utseende. Alltså bara att det är en egen panel och ingen ful dropdown. Den
 * ser inte ut som i SessionStudio och är inget nice i mobil."
 *
 * Regeln ovan var rätt hela tiden. Det var den här filen som inte följde den
 * under `md`: på bred skärm är menyn en rullgardin i headern, men på smal skärm
 * är den en SHEET i `OpsBottomNav`. Panelen var en rullgardin i båda, alltså
 * såg den ut som menyn på datorn och som ingenting alls på telefonen.
 *
 * ⛔ EN 22 REM BRED RULLGARDIN I EN 390 PX VY ÄR INTE EN PANEL. Den kapades av
 * `max-w-[calc(100vw-1.5rem)]`, hängde under klockan med sidan synlig runt om,
 * och behövde en egen dämpning för att inte läsas som en del av sidan. Alla tre
 * raderna var lappar på samma sak: ytan var fel.
 *
 * ⛔ DÄRFÖR: SHEET UNDER `md`, RULLGARDIN FRÅN `md` OCH UPP. Samma yta som
 * `OpsBottomNav`s Meny-sheet, ned i minsta detalj (rundad överkant, `bg-raised`,
 * `85dvh`, `--safe-bottom`), så de två är samma sak och inte två saker som
 * liknar varandra.
 *
 * ⛔ EN RADIX-ROT OCH INTE TVÅ. Att rendera båda och dölja den ena med CSS är
 * mönstret i `OpsAppShell`, och det duger för en NAV. Här bär panelen en
 * fokusfälla och en triggerknapp: två rötter hade gett två fokusfällor, två
 * klockor i DOM:en och dubbletter i varje `getByRole` hos appen som bygger på
 * ramverket. Valet görs därför i JS, och bara den ena monteras.
 *
 * ══ ⛔ STACKEN ÄGS AV PANELEN, INTE AV APPEN ════════════════════════════════
 *
 * Appen anropar `push` och `pop` och slipper hålla reda på var den är. Låg
 * tillståndet hos anroparen skulle varje app återuppfinna tillbakaknappen, och
 * halva dem skulle glömma att nollställa stacken vid stängning.
 *
 * ⛔ STACKEN NOLLSTÄLLS VID STÄNGNING. Öppnar man igen vill man se roten, inte
 * den detalj man råkade läsa sist.
 *
 * ══ Användning ══════════════════════════════════════════════════════════════
 *
 *   <OpsPanel label="Aktivitet" trigger={<Klocka />}>
 *     {(nav) => (
 *       <OpsPanelRow label="Notiser" badge={3} onClick={() =>
 *         nav.push({ key: "notiser", title: "Notiser", content: <Lista /> })} />
 *     )}
 *   </OpsPanel>
 */

/**
 * @typedef {object} Panelvy
 * @property {string} key Stabil nyckel. ⛔ Krävs: utan den kan React inte skilja
 *   två vyer åt, och en detalj byts inte ut när man öppnar nästa rad.
 * @property {string} title Rubriken i huvudet, bredvid tillbakapilen.
 * @property {import("react").ReactNode} [action] Åtgärd till höger i huvudet.
 * @property {import("react").ReactNode} content
 */

/**
 * En rad i panelen: ikon, etikett, räknare och chevron.
 *
 * ⛔ CHEVRONEN RITAS BARA NÄR RADEN LEDER VIDARE. En pil på en rad som bara
 * växlar något lovar en vy som inte finns, och det är den sortens löfte man
 * bara bryter en gång innan man slutar lita på raden.
 *
 * ⛔ HELA RADEN ÄR MÅLET, inte chevronen. Ett 16 px mål i högerkanten är det
 * säkraste sättet att göra en lista som inte går att använda med tummen.
 *
 * @param {object} props
 * @param {import("react").ReactNode} [props.icon]
 * @param {import("react").ReactNode} props.label
 * @param {number} [props.badge] Antal. Noll och uppåt; noll ritar ingenting.
 * @param {string} [props.badgeText] Vad antalet betyder, för skärmläsare.
 * @param {boolean} [props.chevron] Raden öppnar en undervy.
 * @param {() => void} [props.onClick]
 * @param {string} [props.href] Länk i stället för knapp.
 * @param {boolean} [props.active]
 */
export function OpsPanelRow({ icon, label, badge, badgeText = "", chevron, onClick, href, active }) {
  /* ⛔ SAMMA KLASSER SOM HAMBURGERMENYNS RADER i `OpsAppShell`. Panelen ska inte
     likna menyn ungefär, den ska vara densamma. Glider de isär ser en app ut att
     ha två olika menyer beroende på vad man tryckte på. */
  const klass = cx(
    "flex min-h-11 w-full items-center gap-2 rounded-sm px-3 text-left text-base",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
    active ? "bg-accent-subtle font-semibold text-ink" : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
    (onClick || href) && "cursor-pointer",
  );

  const inre = (
    <>
      {icon ? (
        <span aria-hidden="true" className="flex shrink-0 items-center">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof badge === "number" && badge > 0 ? (
        /* ⛔ INLINE OCH INTE `Counter`. Den är absolutpositionerad för att sitta
           i hörnet på en ikonknapp; i en rad hade den hamnat ovanpå texten.
           Samma tokens, `bg-badge` och `text-badge-contrast`, så siffran ser
           likadan ut var den än står. */
        <OpsCountBadge count={badge} text={badgeText} placement="inline" />
      ) : null}
      {chevron ? (
        <span aria-hidden="true" className="flex shrink-0 items-center text-ink-muted">
          <ChevronHogerIkon size={16} />
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} aria-current={active ? "page" : undefined} className={klass}>
        {inre}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={klass}>
      {inre}
    </button>
  );
}

/**
 * Huvudet i en undervy: tillbaka, titel, åtgärd.
 *
 * ⛔ TILLBAKA ÄR EN IKONKNAPP MED ETT NAMN, inte ett kryss. Ett kryss stänger
 * hela panelen; en pil går ett steg. CP: "Bättre att vi har en chevron down?"
 * Riktningen blev vänster och inte ned, eftersom rörelsen är tillbaka i en
 * stack och inte att fälla ihop något, men invändningen bakom är densamma: den
 * stora kryssrutan skrek och lovade fel sak.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {(() => void)} [props.onBack] Utan den ritas ingen pil, alltså roten.
 * @param {string} [props.backLabel]
 * @param {string} [props.closeLabel] Skärmläsarnamn på stängknappen i sheeten (smal skärm).
 * @param {import("react").ReactNode} [props.action]
 */
export function OpsPanelHeader({ title, onBack, backLabel = "Tillbaka", action }) {
  return (
    <div className="flex items-center gap-1 border-b border-divider px-1 pb-1">
      {/* ⛔ INGEN TILLBAKAPIL PÅ ROTEN. En pil som inte går någonstans är ett
          löfte som bryts vid första trycket, och roten HAR ingen förälder. */}
      {onBack ? (
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className={cx(
          "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-sm text-ink-secondary",
          "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        )}
      >
        <ChevronVansterIkon size={18} />
      </button>
      ) : (
        <span className="w-2 shrink-0" />
      )}
      {/* ⛔ EN RIKTIG RUBRIK. Panelen byter innehåll utan att sidan byts, så
          utan rubrikelement har den som lyssnar inget att hoppa till. */}
      <h2 className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-ink">{title}</h2>
      {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
    </div>
  );
}

/**
 * Tailwinds `md`, avläst i JS i stället för i CSS.
 *
 * ⛔ TALET ÄR TAILWINDS EGET OCH INTE ETT PÅHITT. `md` är 48rem, så allt under
 * det är smal skärm. Skrevs ett eget tal här hade panelen bytt yta vid en annan
 * bredd än resten av skalet, och de två sekunderna mellan brytpunkterna hade
 * visat en sheet bredvid en headermeny.
 */
const SMAL = "(max-width: 47.99rem)";

/**
 * Om skärmen är smal just nu.
 *
 * ⛔ SVARAR `false` NÄR `matchMedia` SAKNAS, alltså i jsdom och under en
 * serverrendering. Det är det säkra svaret: rullgardinen är den yta som
 * fungerar utan att veta något om fönstret, och en sheet på en bred skärm är
 * fel på ett sätt man ser direkt. Prov som vill åt sheeten definierar
 * `window.matchMedia` själva, och det är med flit: en global stubb i
 * `setup.js` hade tyst flyttat varje befintligt panelprov till den nya vägen.
 */
function useSmalSkarm() {
  const [smal, setSmal] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const fraga = window.matchMedia(SMAL);
    setSmal(fraga.matches);
    /** @param {any} e */
    const lyssna = (e) => setSmal(Boolean(e.matches));
    // ⛔ `addEventListener` med `addListener` som reserv. Safari under 14 har
    // bara den gamla, och en panel som inte byter yta när man vrider telefonen
    // är precis det fel den här ändringen finns till för att ta bort.
    if (typeof fraga.addEventListener === "function") {
      fraga.addEventListener("change", lyssna);
      return () => fraga.removeEventListener("change", lyssna);
    }
    fraga.addListener?.(lyssna);
    return () => fraga.removeListener?.(lyssna);
  }, []);

  return smal;
}

/**
 * Panelen.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.trigger Knappen som öppnar. Får inte vara en knapp i sig: panelen gör den till en.
 * @param {string} props.label Panelens namn, för skärmläsare.
 * @param {string} [props.title] Rubrik på ROTEN. Utan den ritas inget huvud där, vilket är rätt för en meny.
 * @param {import("react").ReactNode} [props.action] Åtgärd till höger i rotens huvud.
 * @param {(nav: { push: (vy: Panelvy) => void, pop: () => void, close: () => void, depth: number }) => import("react").ReactNode} props.children
 *   Rotvyn. Får `nav` och bestämmer själv vad som öppnar vad.
 * @param {boolean} [props.open] Styrd öppning. Utan den sköter panelen det själv.
 * @param {(open: boolean) => void} [props.onOpenChange]
 * @param {"start"|"center"|"end"} [props.align]
 * @param {string} [props.backLabel]
 * @param {string} [props.closeLabel] Skärmläsarnamn på stängknappen i sheeten (smal skärm).
 */
export function OpsPanel({
  trigger,
  label,
  title,
  action,
  children,
  open,
  onOpenChange,
  align = "end",
  backLabel = "Tillbaka",
  closeLabel = "Stäng",
}) {
  const styrd = typeof open === "boolean";
  const [egetOppet, setEgetOppet] = useState(false);
  const oppet = styrd ? open : egetOppet;

  /** @type {[Panelvy[], Function]} */
  const [stack, setStack] = useState(/** @type {Panelvy[]} */ ([]));

  const satt = useCallback(
    /** @param {boolean} nytt */
    (nytt) => {
      if (!styrd) setEgetOppet(nytt);
      onOpenChange?.(nytt);
      // ⛔ NOLLSTÄLLS VID STÄNGNING, se noten överst.
      if (!nytt) setStack([]);
    },
    [styrd, onOpenChange],
  );

  const push = useCallback(/** @param {Panelvy} vy */ (vy) => setStack((/** @type {Panelvy[]} */ s) => [...s, vy]), []);
  const pop = useCallback(() => setStack((/** @type {Panelvy[]} */ s) => s.slice(0, -1)), []);
  const close = useCallback(() => satt(false), [satt]);

  const overst = stack.length ? stack[stack.length - 1] : null;
  const nav = { push, pop, close, depth: stack.length };
  const smal = useSmalSkarm();

  /*
   * ⛔ INNEHÅLLET BYGGS EN GÅNG OCH DELAS AV BÅDA YTORNA. Skrevs det två gånger
   * vore stacken, rubriken och rullningen ett par som glider isär, och den som
   * glider är den man inte tittar på. Det enda som skiljer ytorna är BEHÅLLAREN.
   */
  const innehall = overst ? (
    <div className="flex flex-col gap-1">
      <OpsPanelHeader title={overst.title} onBack={pop} backLabel={backLabel} action={overst.action} />
      {/* ⛔ TAK PÅ HÖJDEN OCH EGEN RULLNING. Utan det växer panelen förbi
          skärmens underkant med en lång lista, och då är raderna längst ned
          inte åtkomliga alls. I sheeten sköter behållaren höjden, så taket
          gäller bara rullgardinen. */}
      <div className={cx("overflow-y-auto overscroll-contain px-2 pt-1 pb-2", !smal && "max-h-[min(70vh,32rem)]")}>
        {overst.content}
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-1">
      {title ? <OpsPanelHeader title={title} action={action} /> : null}
      <div className={cx("overflow-y-auto overscroll-contain", !smal && "max-h-[min(70vh,32rem)]", title && "px-2 pt-1 pb-2")}>
        {children(nav)}
      </div>
    </div>
  );

  /*
   * ══ ⛔ SMAL SKÄRM: SAMMA SHEET SOM MENYN I BOTTENRADEN ══════════════════
   *
   * Klasserna är avskrivna ur `OpsBottomNav` med flit, ned i `85dvh` och
   * `--safe-bottom`. De två ska inte likna varandra, de ska vara samma yta:
   * öppnar man Meny och sedan klockan ska ingenting röra sig.
   *
   * ⛔ `dvh` OCH INTE `vh`. Safaris verktygsrad ändrar höjd, och `100vh` räknar
   * med den största, så underkanten hamnar utanför skärmen.
   */
  if (smal) {
    return (
      <Dialog.Root open={oppet} onOpenChange={satt}>
        <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim" />
          <Dialog.Content
            aria-label={label}
            className="fixed inset-x-0 bottom-0 z-(--z-modal) flex max-h-[85dvh] flex-col rounded-t-xl border-t border-line bg-raised pb-(--safe-bottom)"
            aria-describedby={undefined}
          >
            {/*
              ⛔ EN EGEN STÄNGKNAPP, som i Meny-sheeten. En rullgardin stängs
              genom att man trycker bredvid den, och det är hela ytan man ser.
              En sheet täcker underkanten av skärmen med dämpning ovanför, och
              på en telefon är "bredvid" då en remsa man inte siktar på.

              ⛔ RUBRIKEN ÄR PANELENS NAMN OCH INTE VYNS. `title` byts när man
              går in i en detalj, och en sheet vars rubrik hoppar ser ut som en
              ny sheet. Vyns egen rubrik står i `OpsPanelHeader` inuti, med sin
              tillbakapil bredvid sig.
            */}
            <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
              <Dialog.Title className="m-0 text-md font-bold text-ink">{label}</Dialog.Title>
              <Dialog.Close
                aria-label={closeLabel}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-muted transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <KryssIkon size={20} />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-1">{innehall}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  /*
   * ══ BRED SKÄRM: RULLGARDIN BREDVID SIN KNAPP ═══════════════════════════
   *
   * ⛔ DÄMPNINGEN ÄR BORTA HÄRIFRÅN. Den fanns bara för telefonen (bolag-ops
   * #363), där panelen hängde över sidan utan att skilja sig från den. På bred
   * skärm ligger rullgardinen bredvid sin knapp och krockar inte med något, och
   * sheeten ovan har Radix egen `Dialog.Overlay` i stället.
   */
  return (
    <Popover.Root open={oppet} onOpenChange={satt}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={4}
          aria-label={label}
          /* ⛔ SAMMA YTA SOM HEADERMENYN: rundad, `bg-raised`, tunn linje, mjuk
             skugga.
             ⛔ `isolate` GER PANELEN EGEN STAPLINGSKONTEXT, så inget i en rad
             (ett märke med `absolute`, en rullande lista) kan hamna utanför
             eller under dess kant. `bg-raised` är ogenomskinlig i båda teman. */
          className={cx(
            "isolate z-(--z-dropdown) w-88 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-line bg-raised p-1 shadow-lg",
          )}
        >
          {innehall}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
