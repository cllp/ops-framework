import { useId, useState } from "react";
import { cx } from "../lib/cx.js";
import { validateNav } from "../lib/nav.js";
import { OpsCountBadge } from "./counter.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { ChevronHogerIkon, ChevronNedIkon } from "./icons.jsx";
import { OpsView } from "./OpsView.jsx";
import { radKlass } from "../lib/radKlass.js";
import { OpsHubTillbaka } from "./OpsTillbaka.jsx";

export { OpsHubTillbaka };
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
 * @param {string} [props.visaEtikett] Ordet före modulens namn på raden som öppnar modulens egen sida ("Visa Ekonomi"). Förval "Visa" (sv), "Show" (en).
 * @param {boolean} [props.ram] (0.31.2) Sidan ritas i `OpsView` (sidomarginal, avstånd under toppraden, bredd). Förval sant. Sätt falskt bara om appen redan lindat Hub i en `OpsView`.
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
  visaEtikett,
  ram = true,
}) {
  validateNav(moduler, "OpsHub: moduler");
  const innehall =
    moduler.length === 0 ? (
      <OpsEmpty title={tomRubrik} description={tomText} />
    ) : (
      <KortRutnat poster={moduler} activeHref={activeHref} onNavigate={onNavigate} ariaLabel={ariaLabel} badgeText={badgeText} sprak={sprak} ingetNyttEtikett={ingetNyttEtikett} visaEtikett={visaEtikett} />
    );
  return ram ? <OpsView>{innehall}</OpsView> : innehall;
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
 * @param {boolean} [props.ram] (0.31.2) Som `OpsHub`: ritas i `OpsView`. Förval sant.
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
  ram = true,
}) {
  if (!modul || typeof modul.href !== "string" || typeof modul.label !== "string") {
    throw new Error("OpsHubModul: modul krävs och måste vara { href, label, children? }.");
  }
  if (typeof hubHref !== "string" || hubHref === "") {
    throw new Error("OpsHubModul: hubHref krävs. Tillbaka-raden är ett steg upp till Hub, och en rad som inte vet vart den leder är en knapp som inte gör något.");
  }
  validateNav([modul], "OpsHubModul: modul");
  const barn = modul.children ?? [];
  const innehall = (
    <>
      <OpsHubTillbaka hubHref={hubHref} hubEtikett={hubEtikett} etikett={modul.label} onNavigate={onNavigate} brodsmulaEtikett={brodsmulaEtikett} rubrik />
      {barn.length === 0 ? (
        <OpsEmpty title={tomRubrik} description={tomText} />
      ) : (
        <KortRutnat poster={barn} activeHref={activeHref} onNavigate={onNavigate} ariaLabel={modul.label} badgeText={badgeText} sprak={sprak} ingetNyttEtikett={ingetNyttEtikett} />
      )}
    </>
  );
  return ram ? <OpsView>{innehall}</OpsView> : <div className="flex flex-col gap-4">{innehall}</div>;
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
 * @param {string} [props.visaEtikett]
 */
function KortRutnat({ poster, activeHref, onNavigate, ariaLabel, badgeText, sprak, ingetNyttEtikett, visaEtikett }) {
  return (
    <ul aria-label={ariaLabel} className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {poster.map((m) => (
        <li key={m.href} className="min-w-0">
          {(m.children ?? []).length > 0 ? (
            <UtfallbartKort post={m} activeHref={activeHref} onNavigate={onNavigate} badgeText={badgeText} sprak={sprak} ingetNyttEtikett={ingetNyttEtikett} visaEtikett={visaEtikett} />
          ) : (
            <ModulKort post={m} activeHref={activeHref} onNavigate={onNavigate} badgeText={badgeText} sprak={sprak} ingetNyttEtikett={ingetNyttEtikett} />
          )}
        </li>
      ))}
    </ul>
  );
}

const KORT = "rounded-card bg-surface text-ink transition-colors duration-(--duration-fast) ease-standard";
const KORT_FOKUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Kortets innehåll: ikon, namn, räknare, tomt slutstycke (chevron), och en rad `info`. Delas av länkkortet och det utfällbara
 * kortets rubrik, så att de två aldrig ser olika ut (en sanning per faktum).
 * @param {object} props
 * @param {any} props.post
 * @param {string} props.badgeText
 * @param {string} props.sprak
 * @param {string} [props.ingetNyttEtikett]
 * @param {import("react").ReactNode} [props.slut] Sista platsen på namnraden (chevronen).
 */
function KortInnehall({ post, badgeText, sprak, ingetNyttEtikett, slut }) {
  const ingetNytt = ingetNyttEtikett ?? (sprak === "en" ? "Nothing new" : "Inget nytt");
  /** @type {string | null} */
  const infoText = post.info === undefined ? null : post.info === null ? ingetNytt : text(post.info, sprak);
  const ingetNyttRad = post.info === null;
  const harBadge = typeof post.badge === "number" && post.badge > 0;
  return (
    <>
      <span className="flex min-h-11 items-center gap-2.5 text-sm font-medium">
        {post.icon ? (
          <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-5">
            {post.icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{post.label}</span>
        {harBadge ? <OpsCountBadge count={post.badge} text={badgeText} placement="inline" /> : null}
        {slut}
      </span>
      {/* ⛔ 0.31.0 (fynd 8 i cllp/bolag-ops#475, "svag kontrast i info-rad och Inget nytt"): infon står i `ink-secondary` (7,65:1
          mot kortet i ljust läge, `ink-muted` gav 3,76:1) och "Inget nytt" har en EGEN tyst statusstil: en liten punkt före
          texten, så att den skiljs från metadata utan att bli svagare. Se paren i check-kontrast. */}
      {infoText ? (
        ingetNyttRad ? (
          <span data-status="inget-nytt" className="flex items-center gap-1.5 truncate text-xs text-ink-secondary">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-line-strong" />
            <span className="truncate">{infoText}</span>
          </span>
        ) : (
          <span className="block truncate text-xs text-ink-secondary">{infoText}</span>
        )
      ) : null}
    </>
  );
}

/**
 * Ett kort utan barn: hela kortet är länken.
 * @param {object} props
 * @param {any} props.post
 * @param {string} props.activeHref
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} props.badgeText
 * @param {string} props.sprak
 * @param {string} [props.ingetNyttEtikett]
 */
function ModulKort({ post, activeHref, onNavigate, badgeText, sprak, ingetNyttEtikett }) {
  return (
    <a
      href={post.href}
      onClick={(e) => onNavigate?.(post.href, e)}
      aria-current={post.href === activeHref ? "page" : undefined}
      className={cx("flex h-full flex-col gap-1 p-4 hover:bg-raised", KORT, KORT_FOKUS, post.href === activeHref && "ring-2 ring-accent")}
    >
      <KortInnehall post={post} badgeText={badgeText} sprak={sprak} ingetNyttEtikett={ingetNyttEtikett} />
    </a>
  );
}

/**
 * Ett kort med barn (0.31.2): FÄLLS UT PÅ PLATS på Hub-sidan i stället för att bara navigera (CP 2026-09-29 20:57: "Ekonomi
 * fäller inte ut submenyer"). Rubriken är en knapp (`aria-expanded`, `aria-controls`, chevron som vrids), och under den ligger
 * modulens undersidor som rader, med en första rad "Visa Ekonomi" som leder till modulens egen sida.
 *
 * ⛔ SAMMA MÖNSTER SOM RAMVERKETS EGEN RULLGARDIN (`HubModulRad` i `OpsAppShell`): en knapp som fäller ut och in, undersidorna
 * som länkar under, en chevron som vrids. SessionStudio har ingen utfällbar korthög, men dess utfällning är alltid en
 * `<button aria-expanded aria-controls>` med en chevron som vrids 180 grader (`MoreSettingsDisclosure.jsx:66-80`), och det är formen här.
 * ⛔ MODULENS EGEN SIDA ÄR KVAR (0.30.1: varje steg har en `href`): raden "Visa Ekonomi" öppnar den, och `OpsHubModul` ritar den.
 * Kortet börjar utfällt när en av dess sidor är den aktiva.
 *
 * @param {object} props
 * @param {any} props.post
 * @param {string} props.activeHref
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} props.badgeText
 * @param {string} props.sprak
 * @param {string} [props.ingetNyttEtikett]
 * @param {string} [props.visaEtikett]
 */
function UtfallbartKort({ post, activeHref, onNavigate, badgeText, sprak, ingetNyttEtikett, visaEtikett }) {
  const barn = /** @type {any[]} */ (post.children ?? []);
  const [ut, setUt] = useState(barn.some((c) => c.href === activeHref));
  const listId = useId();
  const visa = visaEtikett ?? (sprak === "en" ? "Show" : "Visa");
  const ingetNytt = ingetNyttEtikett ?? (sprak === "en" ? "Nothing new" : "Inget nytt");
  return (
    <div className={cx("h-full", KORT, (post.href === activeHref || barn.some((c) => c.href === activeHref)) && "ring-2 ring-accent")}>
      <button
        type="button"
        onClick={() => setUt((v) => !v)}
        aria-expanded={ut}
        aria-controls={listId}
        className={cx("flex w-full cursor-pointer flex-col gap-1 rounded-card p-4 text-left hover:bg-raised", KORT_FOKUS)}
      >
        <KortInnehall
          post={post}
          badgeText={badgeText}
          sprak={sprak}
          ingetNyttEtikett={ingetNyttEtikett}
          slut={
            <span aria-hidden="true" className={cx("flex shrink-0 items-center text-ink-muted transition-transform duration-(--duration-fast) ease-standard", ut && "rotate-180")}>
              <ChevronNedIkon size={16} />
            </span>
          }
        />
      </button>
      <div id={listId} hidden={!ut} className="flex flex-col gap-0.5 px-2 pb-2">
        <a
          href={post.href}
          onClick={(e) => onNavigate?.(post.href, e)}
          aria-current={post.href === activeHref ? "page" : undefined}
          className={cx(radKlass({ stor: true, active: post.href === activeHref }), "font-medium")}
        >
          <span className="min-w-0 flex-1 truncate">{`${visa} ${post.label}`}</span>
          <span aria-hidden="true" className="flex shrink-0 items-center text-ink-muted">
            <ChevronHogerIkon size={16} />
          </span>
        </a>
        {barn.map((c) => (
          <a
            key={c.href}
            href={c.href}
            onClick={(e) => onNavigate?.(c.href, e)}
            aria-current={c.href === activeHref ? "page" : undefined}
            className={radKlass({ stor: true, active: c.href === activeHref })}
          >
            {c.icon ? (
              <span aria-hidden="true" className="flex shrink-0 items-center [&_svg]:size-4">
                {c.icon}
              </span>
            ) : null}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{c.label}</span>
              {c.info !== undefined ? <span className="truncate text-xs text-ink-muted">{c.info === null ? ingetNytt : text(c.info, sprak)}</span> : null}
            </span>
            {typeof c.badge === "number" && c.badge > 0 ? <OpsCountBadge count={c.badge} text={badgeText} placement="inline" /> : null}
          </a>
        ))}
      </div>
    </div>
  );
}
