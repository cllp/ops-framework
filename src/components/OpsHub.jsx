import { cx } from "../lib/cx.js";
import { validateNav } from "../lib/nav.js";
import { OpsCountBadge } from "./counter.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { ChevronHogerIkon, ChevronVansterIkon } from "./icons.jsx";
import { text } from "../lib/sprak.js";

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
 * ══ ⛔ VARJE MODUL ÄR ETT KORT, OCH ETT KORT ÄR EN LÄNK (0.30.1) ═══════════
 *
 * CP 2026-09-29 13:44, efter 0.30.0: "ekonomi skall vara expanderbar". Ekonomis
 * sex undersidor stod uppradade under namnet, och ett kort med sex rader stod
 * bredvid kort med noll: fyra kort, tre höjder. Första svaret var ett kort som
 * fälls ut på plats, och CP ändrade det samma dag till detta: KORTET ÄR EN LÄNK
 * TILL MODULENS EGEN SIDA, och en modul med barn har en sida i Hub
 * (`OpsHubModul`): en fast tillbaka-rad ("‹ Hub / Ekonomi") och barnen som
 * mindre kort. Varje steg är sin egen `href`, så webbläsarens och telefonens
 * bakåt fungerar; ett rutnät som byter form på plats har ingen adress.
 *
 * ⛔ KORTET BÄR TRE SAKER UTÖVER NAMNET, OCH ALLA TRE ÄR APPENS DATA:
 *   - `icon`: som förut.
 *   - `badge`: räknaren (vad som väntar). Ritas BARA när den är större än noll:
 *     en "0" på varje kort är brus, och "väntar 0" och "har inte räknat" ser
 *     likadana ut (samma regel som `Counter`).
 *   - `info`: EN kort rad under namnet, dämpad, avkortad. ⛔ TOMHET ÄR ETT SVAR
 *     (arbetsreglernas punkt 5): utelämnad (`undefined`) ritar ingenting, för då
 *     har appen inget att säga; `null` säger uttryckligen "inget", och
 *     ramverket skriver då "Inget nytt" i stället för att lämna en tom rad.
 *     Skillnaden mellan de två är skillnaden mellan "modulen har ingen
 *     infokälla" och "modulen har en källa och den är tom", och en tom rad kan
 *     inte visa vilken av dem det är.
 *
 * ⛔ ALLA KORT I EN RAD ÄR LIKA HÖGA (`items-stretch`, `h-full`). Kort utan
 * `info` bredvid kort med `info` stod annars på två höjder.
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
 * @param {string} [props.sprak] Språket `info` och ramverkets egna ord skrivs på. Förval `sv`.
 * @param {string} [props.ingetNyttEtikett] Texten när en modul har `info: null`. Förval "Inget nytt" (sv), "Nothing new" (en).
 */
export function OpsHub({
  moduler,
  activeHref = "",
  onNavigate,
  ariaLabel = "Moduler",
  tomRubrik = "Inga moduler än",
  tomText = "Den här appen har inga moduler att visa. De läggs till av appens ägare.",
  badgeText = "nya",
  sprak = "sv",
  ingetNyttEtikett,
}) {
  validateNav(moduler, "OpsHub: moduler");
  if (moduler.length === 0) return <OpsEmpty title={tomRubrik} description={tomText} />;
  return <KortRutnat poster={moduler} activeHref={activeHref} onNavigate={onNavigate} ariaLabel={ariaLabel} badgeText={badgeText} sprak={sprak} ingetNyttEtikett={ingetNyttEtikett} />;
}

/**
 * En moduls egen sida i Hub: en fast tillbaka-rad och modulens barn som kort (0.30.1).
 *
 * ⛔ EN SIDA, INTE ETT UTFÄLLT KORT. Se filhuvudet: varje steg har en egen `href`.
 * Appen ritar den på modulens `href` (`/ekonomi`), med `OpsHub` på hubbens (`/hub`).
 *
 * ⛔ TILLBAKA-RADEN ÄR EN LÄNK TILL `hubHref`, ETT STEG UPP, och ligger fast under toppraden
 * (`sticky`), så den nås även längst ner i en lång lista. Den är en `<nav>` med
 * `aria-current="page"` på modulens namn: "‹ Hub / Ekonomi".
 *
 * ⛔ EN MODUL UTAN BARN VISAR TEXT, INTE EN TOM YTA (punkt 5).
 *
 * @param {object} props
 * @param {import("../lib/nav.js").NavPost} props.modul Modulen, med `children`.
 * @param {string} props.hubHref Hubbens `href`: tillbaka-radens mål.
 * @param {string} [props.hubEtikett] Ordet för Hub i tillbaka-raden. Förval "Hub".
 * @param {string} [props.activeHref]
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} [props.brodsmulaEtikett] Skärmläsarnamn på raden. Förval "Var du är".
 * @param {string} [props.tomRubrik]
 * @param {string} [props.tomText]
 * @param {string} [props.badgeText]
 * @param {string} [props.sprak]
 * @param {string} [props.ingetNyttEtikett]
 */
export function OpsHubModul({
  modul,
  hubHref,
  hubEtikett = "Hub",
  activeHref = "",
  onNavigate,
  brodsmulaEtikett = "Var du är",
  tomRubrik = "Inga undersidor än",
  tomText = "Den här modulen har inga undersidor att visa.",
  badgeText = "nya",
  sprak = "sv",
  ingetNyttEtikett,
}) {
  if (!modul || typeof modul.href !== "string" || typeof modul.label !== "string") {
    throw new Error("OpsHubModul: modul krävs och måste vara { href, label, children? }.");
  }
  if (typeof hubHref !== "string" || hubHref === "") {
    throw new Error("OpsHubModul: hubHref krävs. Tillbaka-raden är ett steg upp till Hub, och en rad som inte vet vart den leder är en knapp som inte gör något.");
  }
  validateNav([modul], "OpsHubModul: modul");
  const barn = modul.children ?? [];
  return (
    <div>
      {/* ⛔ `top-[calc(var(--safe-top)+var(--topbar-height))]`: under toppraden, som panelen. `z-(--z-sticky)` ligger
          UNDER `--z-chrome` (toppraden), så raden går in under den och inte över. */}
      <nav
        aria-label={brodsmulaEtikett}
        className="sticky top-[calc(var(--safe-top)+var(--topbar-height))] z-(--z-sticky) -mx-4 mb-3 flex items-center gap-1 border-b border-line bg-canvas px-4"
      >
        <a
          href={hubHref}
          onClick={(e) => onNavigate?.(hubHref, e)}
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-base px-2 text-sm text-ink-secondary transition-colors duration-(--duration-fast) ease-standard hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronVansterIkon size={16} />
          {hubEtikett}
        </a>
        <span aria-hidden="true" className="text-ink-muted">
          /
        </span>
        <span aria-current="page" className="min-w-0 truncate text-sm font-semibold text-ink">
          {modul.label}
        </span>
      </nav>
      {barn.length === 0 ? (
        <OpsEmpty title={tomRubrik} description={tomText} />
      ) : (
        <KortRutnat poster={barn} activeHref={activeHref} onNavigate={onNavigate} ariaLabel={modul.label} badgeText={badgeText} sprak={sprak} ingetNyttEtikett={ingetNyttEtikett} />
      )}
    </div>
  );
}

/**
 * @param {object} props
 * @param {ReadonlyArray<any>} props.poster
 * @param {string} props.activeHref
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} props.ariaLabel
 * @param {string} props.badgeText
 * @param {string} props.sprak
 * @param {string} [props.ingetNyttEtikett]
 */
function KortRutnat({ poster, activeHref, onNavigate, ariaLabel, badgeText, sprak, ingetNyttEtikett }) {
  return (
    <ul aria-label={ariaLabel} className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {poster.map((m) => (
        <li key={m.href} className="min-w-0">
          <ModulKort post={m} activeHref={activeHref} onNavigate={onNavigate} badgeText={badgeText} sprak={sprak} ingetNyttEtikett={ingetNyttEtikett} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Ett kort: ikon, namn, räknare, och en rad `info`. Hela kortet är länken.
 * @param {object} props
 * @param {any} props.post
 * @param {string} props.activeHref
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} props.badgeText
 * @param {string} props.sprak
 * @param {string} [props.ingetNyttEtikett]
 */
function ModulKort({ post, activeHref, onNavigate, badgeText, sprak, ingetNyttEtikett }) {
  const barn = post.children ?? [];
  const aktiv = post.href === activeHref || barn.some((/** @type {any} */ c) => c.href === activeHref);
  const ingetNytt = ingetNyttEtikett ?? (sprak === "en" ? "Nothing new" : "Inget nytt");
  /** @type {string | null} */
  const infoText = post.info === undefined ? null : post.info === null ? ingetNytt : text(post.info, sprak);
  const harBadge = typeof post.badge === "number" && post.badge > 0;
  return (
    <a
      href={post.href}
      onClick={(e) => onNavigate?.(post.href, e)}
      aria-current={post.href === activeHref ? "page" : undefined}
      className={cx(
        "flex h-full flex-col gap-1 rounded-card bg-surface p-4 text-ink transition-colors duration-(--duration-fast) ease-standard hover:bg-raised",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        aktiv && "ring-2 ring-accent",
      )}
    >
      <span className="flex min-h-11 items-center gap-2.5 text-sm font-medium">
        {post.icon ? (
          <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-5">
            {post.icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{post.label}</span>
        {harBadge ? <OpsCountBadge count={post.badge} text={badgeText} placement="inline" /> : null}
        {barn.length > 0 ? (
          <span aria-hidden="true" className="flex shrink-0 items-center text-ink-muted">
            <ChevronHogerIkon size={16} />
          </span>
        ) : null}
      </span>
      {infoText ? <span className="block truncate text-xs text-ink-muted">{infoText}</span> : null}
    </a>
  );
}
