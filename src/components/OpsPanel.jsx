import { useCallback, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { ChevronHogerIkon, ChevronVansterIkon } from "./icons.jsx";
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
 * ══ ⛔ RADIX POPOVER SOM BOTTEN, INTE EN EGEN YTA ═══════════════════════════
 *
 * Klick utanför, Escape, fokushantering och portalen finns redan och är svåra
 * att få rätt. Menyn i `OpsAppShell` står på samma primitiv, vilket är själva
 * poängen: panelen ska SE UT som menyn för att den är samma sak.
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
 */
export function OpsPanel({ trigger, label, title, action, children, open, onOpenChange, align = "end", backLabel = "Tillbaka" }) {
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

  return (
    <Popover.Root open={oppet} onOpenChange={satt}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      {/* Egen portal: Radix portal bär bara ETT barn. */}
      <Popover.Portal>
        {/* ⛔ DÄMPNINGEN BAKOM PANELEN PÅ TELEFON (bolag-ops #363). CP: "Menyn
            krockar med komponenter i bakomliggande panel." Panelen är 22 rem
            bred och högst 70 % av höjden, så på en telefon syns sidans kort
            både till höger om den och under dess nederkant, i samma ton som
            panelens egna rader. Det såg ut som att sidan låg i panelen.
            Dämpningen skiljer dem åt. Den ligger UNDER kromet (`--z-scrim`),
            så headern och bottenraden står kvar orörda, och över allt innehåll.
            Ett tryck på den är ett tryck utanför panelen, och det stänger.
            ⛔ Bara under md: på bred skärm är panelen en vanlig rullgardin
            bredvid sin knapp och krockar inte med något. */}
        <div aria-hidden="true" data-ops-panel-scrim="" className="fixed inset-0 z-(--z-scrim) bg-scrim md:hidden" />
      </Popover.Portal>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={4}
          aria-label={label}
          /* ⛔ SAMMA YTA SOM MENYN: rundad, `bg-raised`, tunn linje, mjuk skugga.
             ⛔ Bredden är begränsad av FÖNSTRET och inte bara av innehållet. En
             panel på 22 rem i en 360 px vy hänger utanför kanten, och det syns
             bara på en telefon. */
          className={cx(
            /* ⛔ `isolate` GER PANELEN EGEN STAPLINGSKONTEXT, så inget i en rad
               (ett märke med `absolute`, en rullande lista) kan hamna utanför
               eller under dess kant. `bg-raised` är ogenomskinlig i båda teman. */
            "isolate z-(--z-dropdown) w-88 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-line bg-raised p-1 shadow-lg",
          )}
        >
          {overst ? (
            <div className="flex flex-col gap-1">
              <OpsPanelHeader title={overst.title} onBack={pop} backLabel={backLabel} action={overst.action} />
              {/* ⛔ TAK PÅ HÖJDEN OCH EGEN RULLNING. Utan det växer panelen förbi
                  skärmens underkant med en lång lista, och då är raderna längst
                  ned inte åtkomliga alls. */}
              <div className="max-h-[min(70vh,32rem)] overflow-y-auto overscroll-contain px-2 pt-1 pb-2">{overst.content}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {title ? <OpsPanelHeader title={title} action={action} /> : null}
              <div className={cx("max-h-[min(70vh,32rem)] overflow-y-auto overscroll-contain", title && "px-2 pt-1 pb-2")}>
                {children(nav)}
              </div>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
