import { useState } from "react";
import { definierade, forvalda } from "../lib/ord.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { KryssIkon, MenuIcon, PlusIkon } from "./icons.jsx";
import { TALK_ORD } from "../lib/talk.js";
import { entryActive, validateNav } from "../lib/nav.js";
import { OpsCountBadge } from "./counter.jsx";
import { radBehallare, radKlass } from "../lib/radKlass.js";
import { kordarePafunktion, MenyAvdelningar, menyAppAvdelning, menyFot, menySektioner, MenyTillbakaKnapp, validateMeny } from "./OpsMeny.jsx";

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
 * @param {{ label: string, onClick: () => void, icon?: import("react").ReactNode, talk?: { lage: string, knapp: Record<string, any> } }} [props.primaryAction] Det man GÖR här, inte går till. Ritas som en rund knapp mitt i raden. `label` är knappens namn för skärmläsare och står aldrig som text: en rund knapp har ingen plats för ord.
 * @param {import("react").ReactNode} [props.menuExtras] Extra kontroller i Mer-sheeten (samma som header-hamburgaren), t.ex. tema och helskärm.
 * @param {import("./OpsMeny.jsx").MenyKonfiguration} [props.meny] Skalets meny (#164, andra granskningen), SAMMA `meny`-prop som
 *   `OpsAppShell` (`meny.sektioner`, `meny.onLoggaUt`, `meny.appVersion`, `meny.rubrik`,
 *   `meny.loggaUtEtikett`). Sheeten visar samma innehåll och i samma ordning som header-
 *   hamburgaren: appens sektioner, navigeringens överflödsrader, `menuExtras`, Logga ut, versionerna.
 *   `meny.rubrik` styr då även sheetens rubrikrad (annars `sheetLabel`).
 */
function OpsBottomNavRitad({
  nav,
  moreNav,
  activeHref,
  onNavigate,
  primaryAction,
  menuLabel = ORD_OPSBOTTOMNAV.menuLabel.sv,
  navLabel = ORD_OPSBOTTOMNAV.navLabel.sv,
  sheetLabel = ORD_OPSBOTTOMNAV.sheetLabel.sv,
  closeLabel = ORD_OPSBOTTOMNAV.closeLabel.sv,
  badgeText = ORD_OPSBOTTOMNAV.badgeText.sv,
  menuExtras,
  meny,
}) {
  validateNav(nav, "OpsBottomNav");
  if (meny) validateMeny(meny, "OpsBottomNav");
  const [oppen, setOppen] = useState(false);
  // ⛔ #166: SAMMA UNDERVY-VÄXLING SOM `OpsAppShell`s header-popover, se dess
  // filhuvud. Sheeten är den SMALA skärmens yta för samma meny, och den ska
  // byta innehåll på plats precis som popovern, inte öppna en egen dialog.
  const [aktivUndervy, setAktivUndervy] = useState(/** @type {import("./OpsMeny.jsx").MenyRad | null} */ (null));
  const stangArket = (/** @type {boolean} */ nasta) => {
    setOppen(nasta);
    if (!nasta) setAktivUndervy(null);
  };
  const kor = kordarePafunktion(() => stangArket(false));

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

  // ⛔ SAMMA ORDNING SOM HEADER-HAMBURGAREN (`OpsAppShell`), och SAMMA
  // avgränsarlogik (0.30.0, se `MenyAvdelningar`): ramverkets sektioner,
  // appens egna länkar, navigeringens överflödsrader, `menuExtras`, Logga ut,
  // sist versionerna. Bara med `meny`; utan den är sheeten det gamla
  // överflödet och `menuExtras`.
  /** @type {import("./OpsMeny.jsx").MenyAvdelning[]} */
  const avdelningar = [];
  if (meny) avdelningar.push(...menySektioner({ sektioner: meny.sektioner ?? [], kor, visaUndervy: setAktivUndervy }));
  if (meny) {
    const app = menyAppAvdelning({ meny, activeHref, onNavigate, stang: () => stangArket(false), badgeText });
    if (app) avdelningar.push(app);
  }
  if (inMenu.length > 0) {
    avdelningar.push({
      key: "nav",
      innehall: inMenu.map((entry) => <SheetPost key={entry.href} entry={entry} activeHref={activeHref} onNavigate={klick} badgeText={badgeText} />),
    });
  }
  if (menuExtras) avdelningar.push({ key: "extras", innehall: <div className="flex items-center gap-0.5 px-1 py-0.5">{menuExtras}</div> });
  if (meny) avdelningar.push(...menyFot({ onLoggaUt: meny.onLoggaUt, loggaUtEtikett: meny.loggaUtEtikett, appVersion: meny.appVersion, kor }));

  return (
    // `pb-(--safe-bottom)`: utan säker yta hamnar knapparna under hemindikatorn
    // på en iPhone, och det syns bara på riktig hårdvara.
    // `data-ops-bottenrad`: `useFullHeight` mäter radens övre kant här (0.32.1), och ett attribut är stabilare än ett aria-namn appen kan byta.
    <nav
      aria-label={navLabel}
      data-ops-bottenrad=""
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

        <Dialog.Root open={oppen} onOpenChange={stangArket}>
          <Dialog.Trigger asChild>
            <button type="button" className={platsKlass(false)}>
              <span className="inline-flex [&_svg]:size-6">
                <MenuIcon size={24} />
              </span>
              <span className="max-w-full truncate text-liten">{menuLabel}</span>
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim md:hidden" />
            {/* `max-h` i `dvh` och inte `vh`: Safaris verktygsrad ändrar höjd, och
                100vh räknar med den största så innehållet hamnar under kanten. */}
            <Dialog.Content
              className={cx(
                "fixed inset-x-0 bottom-0 z-(--z-modal) flex flex-col pb-(--safe-bottom) md:hidden",
                // ⛔ 0.31.2: ARKET HAR EN HÖJD, INTE EN INNEHÅLLSHÖJD (CP: "Se till att aktivitetspanelen blir lika hög som
                // menyn så den inte hoppar"). Roten och undervyn (Aktivitet) ritas i samma ruta med samma höjd: `min(85dvh, 36rem)`.
                meny ? "h-[min(85dvh,36rem)]" : "max-h-[85dvh]",
                radBehallare({ ark: true }),
              )}
              aria-describedby={undefined}
            >
              <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
                {/* ⛔ #164, andra granskningen: MED `meny` styr `meny.rubrik`
                    rubriken (samma form som header-hamburgarens h2), annars
                    oförändrat `sheetLabel`. Samma rad, samma prioritet.
                    ⛔ #166: I EN UNDERVY BÄR `Dialog.Title` SJÄLV radens etikett
                    och en tillbakapil framför sig, i stället för `sheetLabel`.
                    Det är fortfarande EN `Dialog.Title` (Radix kräver exakt en),
                    bara omrenderad, inte en ny dialog. Stäng-krysset ligger kvar
                    till höger: det stänger HELA arket, tillbakapilen bara ett
                    steg. */}
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <MenyTillbakaKnapp onBack={aktivUndervy ? () => setAktivUndervy(null) : undefined} />
                  {/* ⛔ EN `Dialog.Title`, ALLTID (Radix kräver exakt en per
                      dialog): INNEHÅLLET byts, elementet gör det inte. */}
                  <Dialog.Title className="m-0 min-w-0 flex-1 truncate text-rubrik font-bold text-ink">
                    {aktivUndervy ? aktivUndervy.etikett : (meny?.rubrik ?? sheetLabel)}
                  </Dialog.Title>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {aktivUndervy?.undervyAction ?? null}
                  <Dialog.Close
                    aria-label={closeLabel}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-(--duration-fast) ease-standard hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <KryssIkon size={20} />
                  </Dialog.Close>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
                {/* ⛔ #166: EN UNDERVY ERSÄTTER RESTEN AV ARKET, precis som i
                    header-popovern, se `OpsAppShell.jsx`. */}
                {aktivUndervy ? (
                  <div>{aktivUndervy.undervy}</div>
                ) : (
                  <MenyAvdelningar avdelningar={avdelningar} />
                )}
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
 * ⛔ Den STICKER UPP ur raden (`-translate-y-4`) och har en ring i ytans färg.
 *
 * ⛔ 0.59.1 (bolag-ops#563): raden blev 8 px högre, och knappen är centrerad i den. Lyftet gick därför från 12 till 16
 * px, så att knappen sticker upp exakt lika långt över radens överkant som förut och `--bottom-nav-overhang` (16 px)
 * fortfarande stämmer. Med kvar `-translate-y-3` hade knappen sjunkit 4 px ned i raden.
 * Utan det blir den en cirkel bland fyra ikoner, alltså en femte flik som råkar
 * vara rund, och hela poängen med att skilja "gör" från "gå till" försvinner.
 *
 * ⛔ Namnet ligger i `aria-label` och som `sr-only`-text, aldrig som synlig
 * etikett. En knapp på 56 px rymmer inget ord, och ett avhugget ord under den
 * ser ut som ett fel.
 *
 * ⛔ MED `talk` (0.57.0, cllp/lifehub.app#2) är ett långtryck TALK och ett vanligt tryck `onClick` som förut. `talk`
 * är vad `useTalk` lämnar, så den som äger kroken äger också fältet (`OpsTalk`) och raden i Skapa.
 *
 * @param {{ atgard: { label: string, onClick: () => void, icon?: import("react").ReactNode, talk?: { lage: string, knapp: Record<string, any> } } }} props
 */
function Huvudatgard({ atgard }) {
  const talk = atgard.talk;
  // ⛔ MED TALK STYR KROKEN KLICKET (`useTalk`): ett långtryck följs av ett klick, och det får inte öppna Skapa.
  const handelser = talk ? talk.knapp : { onClick: atgard.onClick };
  const haller = talk?.lage === "haller";
  return (
    <div className="flex shrink-0 items-center justify-center px-1">
      <button
        type="button"
        {...handelser}
        data-talk-knapp={talk ? talk.lage : undefined}
        aria-label={haller ? TALK_ORD : atgard.label}
        className={cx(
          "-translate-y-4 inline-flex size-14 cursor-pointer touch-none items-center justify-center rounded-full select-none [-webkit-touch-callout:none]",
          "bg-accent text-accent-contrast ring-4 ring-surface",
          "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-hover",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
      >
        {/* ⛔ CP 2026-10-04: "Den skall bara heta en sak. TALK medans man håller inne knappen." */}
        {haller ? <span className="text-etikett font-bold tracking-wide">{TALK_ORD}</span> : (atgard.icon ?? <PlusIkon size={26} />)}
      </button>
    </div>
  );
}

/**
 * En plats i bottenraden. Mätt ur SessionStudios `MobileTabBar.jsx:73-87`:
 * ikon 20 px (`w-5 h-5`), etikett 10 px med `leading-tight` (rollen `liten`),
 * aktiv accent, inaktiv dämpad (`text-muted`), `gap-0.5`, raden `h-14`.
 *
 * ⛔ 0.59.1: IKONEN ÄR 24 PX OCH RADEN 64, INTE FÖREBILDENS 20 OCH 56. CP 2026-10-05
 * (cllp/bolag-ops#563): "Ikonerna i huvudmenyerna botten och toppen är lite väl
 * små. Svårt att träffa dom med fingret." Etikett och färger står kvar som mätt.
 *
 * ⛔ 0.30.0 (#173): FÖRE VAR IKONEN 22 PX, ETIKETTEN 12 PX OCH INAKTIV FÄRG
 * `ink-secondary`. Tre tal som alla var lite för stora och en färg som var lite
 * för mörk, och tillsammans gjorde de att raden lät högre än förebilden.
 * @param {boolean} active @returns {string}
 */
function platsKlass(active) {
  return cx(
    "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5",
    "text-center transition-colors duration-(--duration-fast) ease-standard",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
    active ? "text-accent" : "text-ink-muted hover:text-ink-secondary",
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
      <span className="relative inline-flex [&_svg]:size-6">
        {entry.icon ?? <span className="inline-block size-6 rounded-full border-2 border-current" aria-hidden="true" />}
        {typeof entry.badge === "number" ? <OpsCountBadge count={entry.badge} text={badgeText} placement="inline" /> : null}
      </span>
      <span className="max-w-full truncate text-liten">{entry.label}</span>
    </a>
  );
}

/**
 * @param {{ entry: import("../lib/nav.js").NavPost, activeHref: string, onNavigate: (href: string, e: any) => void, badgeText: string }} props
 */
function SheetPost({ entry, activeHref, onNavigate, badgeText }) {
  const hasChildren = Array.isArray(entry.children) && entry.children.length > 0;
  return (
    <div className="flex flex-col gap-0.5">
      <a
        href={entry.href}
        onClick={(e) => onNavigate(entry.href, e)}
        aria-current={entry.href === activeHref ? "page" : undefined}
        className={cx(radKlass({ active: entry.href === activeHref }), "justify-between", hasChildren && "font-semibold")}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {entry.icon ? <span className="shrink-0 [&_svg]:size-4">{entry.icon}</span> : null}
          <span className="truncate">{entry.label}</span>
        </span>
        {typeof entry.badge === "number" ? <OpsCountBadge count={entry.badge} text={badgeText} placement="inline" /> : null}
      </a>
      {hasChildren ? (
        <div className="flex flex-col gap-0.5 pl-4">
          {(entry.children ?? []).map((childEntries) => (
            <a
              key={childEntries.href}
              href={childEntries.href}
              onClick={(e) => onNavigate(childEntries.href, e)}
              aria-current={childEntries.href === activeHref ? "page" : undefined}
              className={radKlass({ active: childEntries.href === activeHref })}
            >
              <span className="truncate">{childEntries.label}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * OpsBottomNavs förvalda texter (0.46.0, cllp/bolag-ops#528). Den enda källan till dem: den inre komponentens förval pekar hit.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSBOTTOMNAV = {
  menuLabel: { sv: "Meny", en: "Menu" },
  navLabel: { sv: "Snabbnavigering", en: "Quick navigation" },
  sheetLabel: { sv: "Meny", en: "Menu" },
  closeLabel: { sv: "Stäng", en: "Close" },
  badgeText: { sv: "nya", en: "new" },
};

/**
 * OpsBottomNav på det språk appen ritas på (`OpsSprakProvider`), med ordbokens texter där appen inte skickat egna.
 * @param {Parameters<typeof OpsBottomNavRitad>[0]} props
 */
export function OpsBottomNav(props) {
  const kontext = useOpsSprak();
  return <OpsBottomNavRitad {...forvalda(ORD_OPSBOTTOMNAV, kontext)} {...definierade(props)} />;
}
