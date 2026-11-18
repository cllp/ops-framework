import { useId, useRef, useState } from "react";
import { useOpsSprak } from "./OpsSprak.jsx";
import { cx } from "../lib/cx.js";
import { validateNav } from "../lib/nav.js";
import { OpsCountBadge } from "./counter.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { ChevronNedIkon, HubIkon, InfoIkon, KryssIkon, PlusIkon } from "./icons.jsx";
import { knappKlass } from "./OpsButton.jsx";
import { useLofteVantan } from "../lib/useLofteVantan.js";
import { OpsView, OpsViewHeader } from "./OpsView.jsx";
import { radKlass } from "../lib/radKlass.js";
import { OpsHubTillbaka } from "./OpsTillbaka.jsx";

export { OpsHubTillbaka };
import { text } from "../lib/sprak.js";
import { arBaraTillagg, hubbForGrupp, hubbPoster, tillaggsmodulerIGrupp } from "../lib/hubb.js";
import { arKarna, medKarna } from "../lib/karna.js";
import { synsPa, synsPaText } from "../lib/tillagg.js";

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
 * @param {boolean} [props.ram] (0.31.2) Sidan ritas i `OpsView` (sidomarginal, avstånd under toppraden, bredd). Förval sant. Sätt falskt bara om appen redan lindat Hub i en `OpsView`.
 */
export function OpsHub({
  moduler,
  activeHref = "",
  onNavigate,
  ariaLabel = "Verktyg",
  tomRubrik = "Inga verktyg än",
  tomText = "Inga verktyg är installerade. Ägaren installerar dem i gruppens inställningar.",
  badgeText = "nya",
  sprak: sprakProp,
  ingetNyttEtikett,
  ram = true,
}) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  validateNav(moduler, "OpsHub: moduler");
  const innehall =
    moduler.length === 0 ? (
      <OpsEmpty title={tomRubrik} description={tomText} />
    ) : (
      <KortRutnat poster={moduler} activeHref={activeHref} onNavigate={onNavigate} ariaLabel={ariaLabel} badgeText={badgeText} sprak={sprak} ingetNyttEtikett={ingetNyttEtikett} />
    );
  return ram ? <OpsView>{innehall}</OpsView> : innehall;
}

/** @type {Record<"sv"|"en", { rubrik: string, tomRubrik: string, tomText: (namn: string, medVag: boolean) => string, valbara: string, ingaValbara: string, installera: string, agarenInstallerar: string, tillaggRubrik: string, synsPa: string, synsPaEgenYta: string, synsPaIngenting: string, ingaRitbara: string, ingaRitbaraText: string, saknadRubrik: string, interegistrerad: (id: string) => string, ingetKort: (id: string) => string, moduler: (namn: string) => string, om: (namn: string) => string, oppna: (namn: string) => string, stang: string, delar: string, ingetNytt: string, delarText: string }>} */
const GRUPPHUBB_TEXT = {
  sv: {
    tomRubrik: "Gruppen har inga verktyg ännu",
    tomText: (namn, medVag) => medVag
      ? `${namn} har inga verktyg ännu. Välj vilka som ska finnas här.`
      : `${namn} har inga verktyg ännu. Ägaren väljer vilka som ska finnas här.`,
    rubrik: "Verktyg",
    valbara: "Verktyg som kan läggas till",
    ingaValbara: "Det finns inga verktyg att lägga till.",
    installera: "Lägg till",
    agarenInstallerar: "Ägaren installerar dem i gruppens inställningar.",
    tillaggRubrik: "Tillägg i gruppen",
    synsPa: "Syns på",
    synsPaEgenYta: "Egen yta",
    synsPaIngenting: "ingen egen yta och inga tillägg",
    ingaRitbara: "Inget av gruppens verktyg kan visas",
    ingaRitbaraText: "Gruppen har verktyg installerade som inte kan visas. Skälet står under.",
    saknadRubrik: "Visas inte",
    interegistrerad: (id) => `Verktyget "${id}" visas inte: det finns inte här.`,
    ingetKort: (id) => `Verktyget "${id}" visas inte: det har inget kort under Verktyg (hubb: null).`,
    moduler: (namn) => `Verktyg i ${namn}`,
    om: (namn) => `Om ${namn}`,
    oppna: (namn) => `Öppna ${namn}`,
    stang: "Stäng",
    delar: "Delar",
    ingetNytt: "Inget nytt",
    delarText: "Delar",
  },
  en: {
    tomRubrik: "The group has no tools yet",
    tomText: (namn, medVag) => medVag
      ? `${namn} has no tools yet. Choose which ones belong here.`
      : `${namn} has no tools yet. The owner chooses which ones belong here.`,
    rubrik: "Tools",
    valbara: "Tools that can be added",
    ingaValbara: "There are no tools to add.",
    installera: "Add",
    agarenInstallerar: "The owner installs them in the group's settings.",
    tillaggRubrik: "Add-ons in the group",
    synsPa: "Visible in",
    synsPaEgenYta: "Own page",
    synsPaIngenting: "no own page and no add-ons",
    ingaRitbara: "None of the group's tools can be shown",
    ingaRitbaraText: "The group has tools installed that cannot be shown. The reason is below.",
    saknadRubrik: "Not shown",
    interegistrerad: (id) => `The tool "${id}" is not shown: it does not exist here.`,
    ingetKort: (id) => `The tool "${id}" is not shown: it has no card under Tools (hubb: null).`,
    moduler: (namn) => `Tools in ${namn}`,
    om: (namn) => `About ${namn}`,
    oppna: (namn) => `Open ${namn}`,
    stang: "Close",
    delar: "Parts",
    ingetNytt: "Nothing new",
    delarText: "Parts",
  },
};

/**
 * Var en tilläggsmodul syns, i ord: tilläggens etiketter och ytorna de sitter på ("Omrösta datum · Syns på: Händelser").
 *
 * ⛔ HÄRLETT UR MANIFESTET (regel 2), med samma källa för ytans namn som gruppens inställningar (`synsPaText` över `PLATSYTOR`).
 * Etiketterna är det användaren ser på ytan, aldrig modulens id eller platsens nyckel.
 *
 * @param {import("../lib/modul.js").Modul} m
 * @param {(typeof GRUPPHUBB_TEXT)["sv"]} t
 * @param {string} sprak
 * @returns {string}
 */
function tillaggText(m, t, sprak) {
  const etiketter = [...new Set((m.tillagg ?? []).map((x) => text(x.etikett, sprak)))].join(", ");
  const platser = synsPaText(synsPa(m), { egenYta: t.synsPaEgenYta, ingenting: t.synsPaIngenting }, sprak);
  return `${etiketter} · ${t.synsPa}: ${platser}`;
}

/*
 * ══ ⛔ VERKTYG SOM RUTOR (0.239.0, CP 2026-11-18: "ja, bygg rutorna", cllp/lifehub.app#864) ══════════════════════════════════
 *
 * Skissen i cllp/lifehub.app#842 del C: Verktyg är ett rutnät av rutor, tre per rad på en telefon (390 px) och fler på en bredare
 * skärm. En ruta är verktygets ikon på en rund platta och namnet under. De installerade står först. Under rubriken "Verktyg som kan
 * läggas till" står resten som streckade, nedtonade rutor, och ett tryck på en sådan installerar verktyget (samma `installera` som
 * förut) i stället för en knapp "Installera" per rad.
 *
 * Före 0.239.0 var varje installerat verktyg ett kort med en chevron som fällde ut delarna, en infolinje och räknaren (0.83.0, CP
 * 2026-10-08: "Varje app/modul borde kunna expanderas med chevron"). 0.239.0 tog bort både infolinjen och delarna, och då försvann
 * till exempel raden "2 obetalda kundfakturor, nästa förfaller ..." ur appen helt. `OpsHub` (appens egen lista) har kvar korten.
 *
 * ══ ⛔ (i) FÄLLER UT EN PANEL ÖVER HELA RADEN (0.240.0, CP 2026-11-18) ══════════════════════════════════════════════════════════
 *
 * CP: "man skall kunna expandera ett verktyg för att läsa mer om verktyget ... Kanske en (i) eller info som visar status på grejer i
 * projektet. Eller om det kan finnas ett snyggt sätt att fälla ut ett kort så att det blir stort och brett över andra kort och fälla in
 * det igen." Och om förslaget nedan: "Perfekt".
 *
 * - Ett tryck på RUTAN öppnar verktyget, som förut. Ett tryck på (i) i rutans övre vänstra hörn fäller ut en panel i full bredd direkt
 *   under raden rutan står på: läget (`info`, "Inget nytt" när appen skickar `null`), delarna som länkar, och "Öppna <verktyg>".
 * - En panel åt gången. Den stängs med (i) igen, med Stäng i panelen eller med Escape, och fokus går då tillbaka till (i).
 * - ⛔ PANELEN SKJUTER NED RADERNA UNDER, DEN LÄGGER SIG INTE OVANPÅ. En panel ovanpå hade dolt de andra verktygen, varit svår att
 *   stänga på telefonen och svår att läsa för en skärmläsare. Det var invändningen till CP, och skälet till mönstret: en utfällbar rad.
 * - ⛔ HUR PANELEN HAMNAR UNDER RADEN UTAN ATT VI RÄKNAR KOLUMNER: panelen står i DOM direkt efter sin ruta och spänner hela
 *   bredden (`col-span-full`), och rutnätet packas `grid-flow-row-dense`. Rutorna efter panelen fyller då hålet till höger om den
 *   öppnade rutan, och panelen hamnar på raden under, vid 3, 4, 5 eller 6 kolumner. Ingen mätning i JS och ingen kolumnräkning som
 *   kan glida isär från CSS:en.
 * - (i) är en egen knapp bredvid länken, aldrig inuti den: en knapp i en länk är två mål i ett, och ett tryck skulle göra båda.
 *   Träffytan är 44 px (rutan är 44 px hög som minst), ikonen 16 px.
 * - ⛔ RUTAN FÖRBLIR EN RUND RING NÄR DEN ÄR UTFÄLLD. CP om första skärmbilden: "Men ekonomi skall ju också vara en rund ring tills
 *   man fäller ut den eller hur?" Den öppna rutan fick en ljus rektangel bakom sig, och rutnätet slutade se ut som ringar. Nu
 *   markeras den öppna med en ring i accentfärgen runt plattan, och inget annat ändras på rutan.
 * - ⛔ DE SOM KAN LÄGGAS TILL HAR OCKSÅ (i). CP samma gång: "de som inte är installerade vill man kunna veta mer om innan man
 *   installerar". Panelen säger vad verktyget är (manifestets `beskrivning`), vilka delar det har och var det syns, och har knappen
 *   "Lägg till <verktyg>" med samma väg och samma väntan som rutan. En panel åt gången över båda rutnäten.
 *
 * ⛔ RAMVERKETS TOKENS, INGA EGNA FÄRGER. Plattan är `bg-surface` med `border-line` och `shadow-sm`, den streckade är platt med
 * `border-dashed` i `ink-muted` till hälften, dämpad ikon och dämpad text. Mätt i en skärmbild vid 390 px i ljust tema: med
 * `border-line-strong` syntes den streckade kanten knappt mot `canvas`, och den installerade plattan utan skugga inte alls.
 * Namnet är rollen `meta` med `font-medium` (skillen interaktionsdesign, avsnitt 5: en etikett på en flik). Rutan är minst 44 px hög (plattan är 56 px), och den som trycker träffar hela rutan, inte bara plattan.
 */
/*
 * ⛔ KORT, INTE RINGAR (0.241.0, CP 2026-11-18 21.48, med en skärmbild av 0.239.0: "Jag tänkte mig mer att det blir kort istället ungefär
 * som grupp korten fast för verktyg samma princip med de sträckade och sådär men just nu är det glest och rörigt."). Ringarna i tre
 * kolumner lämnade stora tomma ytor, och texten under de valbara klipptes mitt i. Nu är varje verktyg ett kort i en lista, med gruppkortens
 * radie och kant: ikonen i en ruta, namnet och en rad under. Det som finns i gruppen är fyllt, med läget på raden och (i) till höger. Det
 * som kan läggas till är streckat, med beskrivningen på raden och Lägg till som en knapp på kortet.
 * ⛔ TVÅ PÅ RADEN, SAMMA KORT ÖVERALLT (CP samma kväll: "visa korten två på en rad också, då behöver man inte scrolla om det är många",
 * och om det valbara kortet: "Lägg till knappen kanske inte behövs ... kanske räcker med at man trycker på dom? och att det finns en ikon
 * för att visa info?"). Beslutet, CP 22.25 ("Bra det kör vi på"): ett tryck på kortet gör det vanligaste, alltså öppnar ett installerat
 * verktyg och lägger till ett valbart. (i) i övre högra hörnet på alla kort fäller ut vad verktyget är. Raden under namnet är läget på ett
 * installerat kort och "+ Lägg till" på ett streckat, så att den som ser sidan första gången vet vad trycket gör. Beskrivningen står i (i).
 * Panelen under ett kort är densamma som förut och hamnar fortfarande på raden under (`col-span-full`, `grid-flow-row-dense`).
 */
const KORTPAR = "m-0 grid list-none grid-cols-2 gap-2 p-0 grid-flow-row-dense md:grid-cols-3";
/** Kortets yta: ikonen överst, namnet och raden under. `pr-12` lämnar plats åt (i) i hörnet. */
const VERKTYGSKORT = "flex h-full min-h-24 w-full min-w-0 flex-col items-start gap-2 rounded-card p-3 pr-12 text-left transition-colors duration-(--duration-fast) ease-standard";
const IKONRUTA = "relative flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5";
const KORTNAMN = "block truncate text-etikett font-medium";
/** Två rader, inte en: i halv bredd vid 390 px klipptes "Skatten förfaller 12 oktober" efter "1" (mätt i skalytan). */
const KORTRAD = "line-clamp-2 break-words text-meta text-ink-secondary";
/** (i) i det installerade kortets övre högra hörn. Träffytan är 44 px. */
const INFO_HORN = "absolute top-0.5 right-0.5 flex size-11 items-center justify-center rounded-full";

/**
 * De installerade verktygen som rutor: en länk per verktyg, till verktygets startsida (0.239.0), och en (i) som fäller ut en panel
 * med läget och delarna (0.240.0). Se blocket ovan.
 *
 * ⛔ RUTAN ÄR EN LÄNK. (i) står bredvid den, inte i den. Länkens namn är verktygets namn och räknarens skärmläsartext ("Ekonomi 3
 * nya"), eftersom plattan är dold för skärmläsaren och märket bär sin egen text.
 *
 * @param {object} props
 * @param {ReadonlyArray<VerktygPost>} props.poster
 * @param {string} props.activeHref
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} props.ariaLabel
 * @param {string} props.badgeText
 * @param {"sv"|"en"} props.sprak
 * @param {(typeof GRUPPHUBB_TEXT)["sv"]} props.t
 * @param {string | null} props.oppen Nyckeln för den öppna panelen, delad med de streckade rutorna: en panel åt gången på sidan.
 * @param {(nyckel: string | null) => void} props.setOppen
 */
function VerktygRutor({ poster, activeHref, onNavigate, ariaLabel, badgeText, sprak, t, oppen, setOppen }) {
  const basId = useId();
  /** @type {import("react").MutableRefObject<Record<string, HTMLButtonElement | null>>} */
  const knappar = useRef({});
  /** @param {string} href */
  const stang = (href) => {
    setOppen(null);
    knappar.current[href]?.focus();
  };
  return (
    <ul aria-label={ariaLabel} data-verktygsrutor="" className={KORTPAR}>
      {poster.flatMap((m, i) => {
        const aktiv = m.href === activeHref;
        const ar = oppen === `v:${m.href}`;
        const panelId = `${basId}-panel-${i}`;
        const lage = m.info === undefined ? "" : m.info === null ? t.ingetNytt : text(m.info, sprak);
        const ruta = (
          <li key={m.href} data-verktyg={m.id} className="relative min-w-0">
            <a
              href={m.href}
              onClick={(e) => onNavigate?.(m.href, e)}
              aria-current={aktiv ? "page" : undefined}
              className={cx(VERKTYGSKORT, "border border-line bg-surface text-ink shadow-sm hover:bg-raised", KORT_FOKUS, (aktiv || ar) && "ring-2 ring-accent")}
            >
              <span aria-hidden="true" className={cx(IKONRUTA, "bg-accent/10 text-accent")}>
                {m.icon ?? <HubIkon size={20} />}
              </span>
              <span className="w-full min-w-0">
                <span className={KORTNAMN}>{m.label}</span>
                {lage ? <span data-verktyg-rad="" className={KORTRAD}>{lage}</span> : null}
              </span>
              {/* ⛔ MÄRKET STÅR SIST I LÄNKEN, så att länkens namn blir "Ekonomi 3 nya" och inte "3 nya Ekonomi": skärmläsaren läser i källans
                  ordning. Det ritas på ikonrutans hörn (`top-3 left-3` är kortets `p-3`). */}
              {typeof m.badge === "number" && m.badge > 0 ? (
                <span className="pointer-events-none absolute top-3 left-3 size-10">
                  <OpsCountBadge count={m.badge} text={badgeText} placement="icon" />
                </span>
              ) : null}
            </a>
            <button
              type="button"
              ref={(el) => {
                knappar.current[m.href] = el;
              }}
              data-verktyg-info={m.id}
              aria-label={t.om(m.label)}
              aria-expanded={ar}
              aria-controls={ar ? panelId : undefined}
              onClick={() => setOppen(ar ? null : `v:${m.href}`)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && ar) {
                  e.preventDefault();
                  setOppen(null);
                }
              }}
              className={cx(INFO_HORN, KORT_FOKUS, ar ? "text-accent" : "text-ink-muted hover:text-ink")}
            >
              <InfoIkon size={16} />
            </button>
          </li>
        );
        if (!ar) return [ruta];
        return [ruta, <VerktygPanel key={`${m.href}#panel`} id={panelId} post={m} sprak={sprak} t={t} onNavigate={onNavigate} onStang={() => stang(m.href)} />];
      })}
    </ul>
  );
}

/**
 * @typedef {object} VerktygPost
 * @property {string} id
 * @property {string} href
 * @property {string} label
 * @property {import("react").ReactNode} [icon]
 * @property {number} [badge]
 * @property {string | { sv: string, en?: string } | null} [info]
 * @property {ReadonlyArray<{ href: string, label: string, icon?: import("react").ReactNode }>} [children]
 * @property {import("../lib/sprak.js").Namn | null} [beskrivning]
 */

/**
 * Den utfällda panelen under en ruta (0.240.0): läget, delarna och "Öppna <verktyg>". Spänner hela raden (`col-span-full`).
 *
 * ⛔ LÄGET ÄR APPENS `info`, SAMMA KARTA SOM FÖRUT. `null` är ett svar och ritas som "Inget nytt" (regel 5); saknas nyckeln
 * (`undefined`) har verktyget ingen lägesrad, och då står ingen rad.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {VerktygPost} props.post
 * @param {"sv"|"en"} props.sprak
 * @param {(typeof GRUPPHUBB_TEXT)["sv"]} props.t
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {() => void} props.onStang
 */
function VerktygPanel({ id, post, sprak, t, onNavigate, onStang }) {
  const rubrikId = `${id}-rubrik`;
  const beskrivning = post.beskrivning ? text(post.beskrivning, sprak) : "";
  const lage = post.info === undefined ? null : post.info === null ? t.ingetNytt : text(post.info, sprak);
  const delar = post.children ?? [];
  return (
    <li className="col-span-full min-w-0" data-verktygspanel={post.id}>
      <section
        id={id}
        aria-labelledby={rubrikId}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onStang();
          }
        }}
        className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-sm"
      >
        <div className="flex min-h-11 items-center gap-2.5">
          {post.icon ? (
            <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-5">
              {post.icon}
            </span>
          ) : null}
          <h3 id={rubrikId} className="m-0 min-w-0 flex-1 truncate text-etikett font-medium text-ink">
            {post.label}
          </h3>
          <button type="button" onClick={onStang} aria-label={t.stang} className={knappKlass({ variant: "ghost", iconOnly: true })}>
            <KryssIkon size={16} />
          </button>
        </div>
        {beskrivning ? <p data-verktyg-beskrivning="" className="m-0 max-w-prose text-etikett text-ink-secondary">{beskrivning}</p> : null}
        {lage !== null ? (
          <p data-verktyg-lage="" className={cx("m-0 text-etikett", post.info === null ? "text-ink-secondary" : "text-ink")}>
            {lage}
          </p>
        ) : null}
        {delar.length > 0 ? (
          <nav aria-label={`${t.delar}: ${post.label}`}>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {delar.map((d) => (
                <li key={d.href}>
                  <a href={d.href} onClick={(e) => onNavigate?.(d.href, e)} className={knappKlass({ variant: "secondary", size: "sm" })}>
                    {d.icon ? (
                      <span aria-hidden="true" className="flex items-center [&_svg]:size-4">
                        {d.icon}
                      </span>
                    ) : null}
                    {d.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div>
          <a href={post.href} onClick={(e) => onNavigate?.(post.href, e)} className={knappKlass({ variant: "primary", size: "sm" })}>
            {t.oppna(post.label)}
          </a>
        </div>
      </section>
    </li>
  );
}

/**
 * Verktyg som gruppen inte har, som streckade rutor. Ett tryck på en ruta installerar verktyget när den som tittar får göra det
 * (0.239.0, tidigare en rad med en knapp "Installera" per verktyg).
 *
 * Tom grupp och en grupp som redan har verktyg använder samma rutor, så erbjudandet inte försvinner så fort Meddelanden är på och
 * Bibliotek saknas (CP 2026-10-10). En modul utan kort och utan tillägg (`hubb: null`) kommer inte med: den har ingen yta att visa.
 * En modul som bara är ett tillägg kommer med (0.124.0, CP 2026-10-19: "Datumomröstning finns inte"), med ett plus på plattan och en
 * rad om var den syns.
 *
 * ⛔ RUTANS NAMN SÄGER ATT VERKTYGET KAN LÄGGAS TILL ("Lägg till Ekonomi", "Add Finance"), eftersom den synliga texten bara är
 * namnet. Utan den hade en skärmläsare läst upp en knapp som heter "Ekonomi" och som inte öppnar Ekonomi. `installera.etikett` byter
 * det första ordet, som den förut bytte knappens text.
 *
 * ⛔ VÄNTAN SYNS (skillen interaktionsdesign, avsnitt 7). Ger appens `onInstallera` eller `onClick` ett löfte står en snurra på
 * plattan, rutan är `aria-busy` och spärrad mot ett andra tryck tills löftet är klart (`useLofteVantan`, samma mönster som
 * `OpsButton`). Ett löfte som avslås sväljs inte: det går vidare till appen.
 *
 * ⛔ UTAN `installera` ÄR RUTAN INGEN KNAPP. Den som inte får installera ser vad som finns och raden om att ägaren installerar,
 * men inget som går att trycka på och som inte gör något.
 *
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/modul.js").Modul>} props.moduler
 * @param {string} props.sprak
 * @param {(typeof GRUPPHUBB_TEXT)["sv"]} props.t
 * @param {{ href?: string, onClick?: (id?: string) => void | Promise<unknown>, onInstallera?: (id: string) => void | Promise<unknown>, etikett?: string } | undefined} props.installera
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {boolean} [props.visaAgarRad] Sant när rutorna står bredvid redan installerade verktyg och den som tittar inte får installera.
 * @param {string | null} props.oppen Nyckeln för den öppna panelen, delad med de installerade (en panel åt gången på sidan).
 * @param {(nyckel: string | null) => void} props.setOppen
 * @param {Readonly<Record<string, import("react").ReactNode>>} [props.ikoner] Se `OpsGruppHubb`.
 */
function ValbaraRutor({ moduler, sprak, t, installera, onNavigate, visaAgarRad = false, oppen, setOppen, ikoner }) {
  const medVag = Boolean(installera && (installera.href || installera.onClick || installera.onInstallera));
  return (
    <section className="flex w-full flex-col gap-2 text-left">
      <h2 className="m-0 text-etikett font-medium text-ink">{t.valbara}</h2>
      <ul aria-label={t.valbara} data-hubb-valbara="" className={KORTPAR}>
        {moduler.map((m) => (
          <ValbarPost
            key={m.id}
            modul={m}
            sprak={sprak}
            t={t}
            installera={medVag ? installera : undefined}
            onNavigate={onNavigate}
            visaAgarRad={!medVag}
            ar={oppen === `l:${m.id}`}
            onVaxla={(ny) => setOppen(ny ? `l:${m.id}` : null)}
            ikon={ikoner?.[m.id]}
          />
        ))}
      </ul>
      {!medVag && visaAgarRad ? <p className="m-0 text-hjalp text-ink-secondary">{t.agarenInstallerar}</p> : null}
    </section>
  );
}

/**
 * En streckad ruta och, när dess (i) är öppen, panelen under raden (0.240.0). Rutan är en länk till `installera.href`, en knapp som
 * installerar, eller (utan väg) bara verktyget att se. Panelens "Lägg till" går samma väg och delar rutans väntan (`useLofteVantan`):
 * ett tryck på den ena gör båda upptagna, så ingen kan lägga till samma verktyg två gånger.
 *
 * @param {object} props
 * @param {import("../lib/modul.js").Modul} props.modul
 * @param {string} props.sprak
 * @param {(typeof GRUPPHUBB_TEXT)["sv"]} props.t
 * @param {{ href?: string, onClick?: (id?: string) => void | Promise<unknown>, onInstallera?: (id: string) => void | Promise<unknown>, etikett?: string } | undefined} props.installera
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {boolean} props.visaAgarRad Sant när den som tittar inte får lägga till: panelen säger då att ägaren gör det.
 * @param {boolean} props.ar Panelen är öppen.
 * @param {(oppna: boolean) => void} props.onVaxla
 * @param {import("react").ReactNode} [props.ikon] Appens ikon för ett tillägg utan kort (`OpsGruppHubb` `ikoner`).
 */
function ValbarPost({ modul: m, sprak, t, installera, onNavigate, visaAgarRad, ar, onVaxla, ikon }) {
  const synsId = useId();
  const panelId = useId();
  const infoRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const direkt = typeof installera?.onInstallera === "function";
  const viaKlick = !direkt && typeof installera?.onClick === "function";
  // ⛔ Svaret lämnas tillbaka (0.129.0, cllp/lifehub.app#217): ett löfte ur appen gör rutan upptagen tills det är klart.
  const { upptagen, anropa } = useLofteVantan(direkt || viaKlick ? () => (direkt ? installera?.onInstallera?.(m.id) : installera?.onClick?.(m.id)) : undefined);
  const namn = text(m.namn, sprak);
  const etikett = `${installera?.etikett || t.installera} ${namn}`;
  const syns = arBaraTillagg(m) ? tillaggText(m, t, sprak) : "";
  const href = installera?.href ?? "";
  const medVag = direkt || viaKlick || href !== "";
  const innehall = (
    <>
      <span aria-hidden="true" className={cx(IKONRUTA, "border border-dashed border-ink-muted/50 text-ink-muted")}>
        {/* ⛔ KORTETS IKON, ANNARS APPENS (`ikoner`), ANNARS ETT PLUS (0.241.0). Datumomröstning och Bokning ritades med ett plus, eftersom ett tillägg
            (`hubb: null`) inte har någon ikon i manifestet. Appen har dem redan (lifehub.app `APPIKON_UTAN_KORT`) och skickar in dem. */}
        {upptagen ? <OpsSpinner size="sm" decorative /> : m.hubb?.ikon ? /** @type {import("react").ReactNode} */ (m.hubb.ikon) : ikon ?? <PlusIkon size={20} />}
      </span>
      <span className="w-full min-w-0">
        <span className={cx(KORTNAMN, "text-ink")}>{namn}</span>
        {/* Länkens och knappens namn är "Lägg till Ekonomi" (`aria-label`), så raden är bara för ögat. */}
        {medVag ? (
          <span aria-hidden="true" data-hubb-lagg-till="" className={cx(KORTRAD, "text-accent")}>
            + {installera?.etikett || t.installera}
          </span>
        ) : null}
      </span>
    </>
  );
  const klass = cx(VERKTYGSKORT, "border border-dashed border-ink-muted/50 text-ink-secondary", medVag && "cursor-pointer hover:bg-surface", KORT_FOKUS, ar && "ring-2 ring-accent");
  /** @type {import("react").ReactNode} */
  let ruta;
  if (direkt || viaKlick) {
    ruta = (
      <button
        type="button"
        aria-label={etikett}
        aria-describedby={syns ? synsId : undefined}
        aria-busy={upptagen || undefined}
        disabled={upptagen}
        data-valbar-ruta=""
        onClick={() => anropa()}
        className={cx(klass, "disabled:cursor-wait")}
      >
        {innehall}
      </button>
    );
  } else if (href !== "") {
    ruta = (
      <a href={href} aria-label={etikett} aria-describedby={syns ? synsId : undefined} data-valbar-ruta="" onClick={(e) => onNavigate?.(href, e)} className={klass}>
        {innehall}
      </a>
    );
  } else {
    ruta = (
      <div data-valbar-ruta="" className={klass}>
        {innehall}
      </div>
    );
  }
  const stang = () => {
    onVaxla(false);
    infoRef.current?.focus();
  };
  const beskrivning = m.beskrivning ? text(m.beskrivning, sprak) : "";
  const delar = m.hubb?.delar ?? [];
  const rubrikId = `${panelId}-rubrik`;
  return (
    <>
      <li data-hubb-valbar={m.id} className="relative min-w-0">
        {ruta}
        {syns ? (
          <span id={synsId} data-hubb-syns="" className="sr-only">
            {syns}
          </span>
        ) : null}
        <button
          ref={infoRef}
          type="button"
          data-valbar-info={m.id}
          aria-label={t.om(namn)}
          aria-expanded={ar}
          aria-controls={ar ? panelId : undefined}
          onClick={() => onVaxla(!ar)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && ar) {
              e.preventDefault();
              onVaxla(false);
            }
          }}
          className={cx(INFO_HORN, KORT_FOKUS, ar ? "text-accent" : "text-ink-muted hover:text-ink")}
        >
          <InfoIkon size={16} />
        </button>
      </li>
      {ar ? (
        <li className="col-span-full min-w-0" data-valbarpanel={m.id}>
          <section
            id={panelId}
            aria-labelledby={rubrikId}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                stang();
              }
            }}
            className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-sm"
          >
            <div className="flex min-h-11 items-center gap-2.5">
              {m.hubb?.ikon ? (
                <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-5">
                  {/** @type {import("react").ReactNode} */ (m.hubb.ikon)}
                </span>
              ) : null}
              <h3 id={rubrikId} className="m-0 min-w-0 flex-1 truncate text-etikett font-medium text-ink">
                {namn}
              </h3>
              <button type="button" onClick={stang} aria-label={t.stang} className={knappKlass({ variant: "ghost", iconOnly: true })}>
                <KryssIkon size={16} />
              </button>
            </div>
            {beskrivning ? <p data-verktyg-beskrivning="" className="m-0 max-w-prose text-etikett text-ink">{beskrivning}</p> : null}
            {/* ⛔ DELARNA SOM TEXT, INTE LÄNKAR: verktyget är inte installerat, och en länk dit hade lett till en sida gruppen inte har. */}
            {delar.length > 1 ? (
              <p data-verktyg-delar="" className="m-0 text-etikett text-ink-secondary">
                {t.delarText}: {delar.map((d) => text(d.namn, sprak)).join(", ")}
              </p>
            ) : null}
            {syns ? <p className="m-0 text-etikett text-ink-secondary">{syns}</p> : null}
            {direkt || viaKlick ? (
              <div>
                <button
                  type="button"
                  aria-busy={upptagen || undefined}
                  disabled={upptagen}
                  onClick={() => anropa()}
                  className={cx(knappKlass({ variant: "primary", size: "sm" }), "disabled:cursor-wait")}
                >
                  {upptagen ? <OpsSpinner size="sm" decorative /> : null}
                  {etikett}
                </button>
              </div>
            ) : href !== "" ? (
              <div>
                <a href={href} onClick={(e) => onNavigate?.(href, e)} className={knappKlass({ variant: "primary", size: "sm" })}>
                  {etikett}
                </a>
              </div>
            ) : visaAgarRad ? (
              <p className="m-0 text-hjalp text-ink-secondary">{t.agarenInstallerar}</p>
            ) : null}
          </section>
        </li>
      ) : null}
    </>
  );
}

/**
 * Hubben för den aktiva gruppen, sidan Verktyg: en ruta per modul i `grupp.moduler`, i gruppens ordning (0.37.0, #184; rutor 0.239.0).
 *
 * ══ ⛔ GRUPPENS MODULER OCH INGET ANNAT ═══════════════════════════════════
 *
 * CP 2026-09-30: "Ekonomi är EN modul." Före 0.37.0 skickade appen sin egen lista till `OpsHub`, samma lista i varje grupp,
 * och varje del av Ekonomi var ett eget kort. Nu ritar hubben det gruppens ägare valt (`groups.moduler`), och varje ruta leder
 * till modulens egen insida (`OpsModulSida`). Beslutet om vad som ritas bor i `hubbForGrupp`, så det går att pröva utan att rita.
 *
 * ⛔ TOMHET ÄR ETT SVAR (arbetsreglernas punkt 5), på fyra sätt:
 *   - en grupp utan moduler säger det, och visar verktygen som kan läggas till, med en väg till valet när appen skickar `installera`;
 *   - en grupp som redan har verktyg visar samma erbjudande under rutorna, så Bibliotek syns i Travel fast Meddelanden är installerat (CP 2026-10-10);
 *   - en modul appen inte registrerat, eller en utan kort, ritas inte, och en rad under rutorna säger vilken och varför;
 *   - pekar gruppen BARA på sådana står det också, i stället för rubriken "inga moduler", som vore osann.
 *
 * ⛔ RUTOR, INTE KORT SOM FÄLLS UT (0.239.0, CP 2026-11-18: "ja, bygg rutorna", cllp/lifehub.app#864). Se avsnittet om rutorna
 * ovanför `VerktygRutor`. Här stod från 0.83.0 att korten fälls ut med en chevron och visar modulens delar (CP 2026-10-08 17:54:
 * "Varje app/modul borde kunna expanderas med chevron"). Det beslutet är ersatt för den här sidan: en ruta öppnar verktyget, och
 * delarna nås inne i det. Toppradens rullgardin har aldrig visat delarna och gör det inte nu heller.
 *
 * ⛔ `info` RITAS I (i)-PANELEN (0.240.0). 0.239.0 tog emot den utan att rita den, och raden om till exempel obetalda kundfakturor
 * försvann ur appen. Nu är den läget i panelen under rutan.
 *
 * @param {object} props
 * @param {{ id: string, namn: import("../lib/sprak.js").Namn, moduler: ReadonlyArray<string> }} props.grupp Den aktiva gruppen.
 * @param {ReadonlyArray<import("../lib/modul.js").Modul>} props.moduler Appens registrerade moduler, ur `validateModuler`.
 * @param {string} [props.activeHref]
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {"sv"|"en"} [props.sprak]
 * @param {Readonly<Record<string, string | { sv: string, en?: string } | null>>} [props.info] Läget per modul-id, i (i)-panelen under rutan (0.240.0). `null` ritas som Inget nytt; saknas nyckeln står ingen lägesrad.
 * @param {Readonly<Record<string, number>>} [props.badge] Räknaren per modul-id, ett litet märke på rutans platta.
 * @param {string} [props.badgeText] Skärmläsarordet efter räknaren. Förval "nya" (sv), "new" (en).
 * @param {boolean} [props.ram] Ritas i `OpsView`. Förval sant.
 * @param {{ href?: string, onClick?: (id?: string) => void | Promise<unknown>, onInstallera?: (id: string) => void | Promise<unknown>, etikett?: string }} [props.installera] Vägen till modulvalet. Appen skickar den bara för den som får välja appar: ägaren, och sedan 0.128.0 en admin (0.87.0, lifehub.app#129). Ett tryck på en streckad ruta anropar `onInstallera` med appens id, annars `onClick` med appens id, eller så öppnas `href`. Ett löfte ur appen gör rutan upptagen tills det är klart. `etikett` är första ordet i rutans namn, förval "Lägg till" (sv), "Add" (en).
 * @param {Readonly<Record<string, import("react").ReactNode>>} [props.ikoner] (0.241.0) Ikonen per modul-id för ett tillägg utan kort (`hubb: null`), på dess streckade kort. Ett kort med egen ikon (`hubb.ikon`) använder den. Utan ikon ritas ett plus.
 * @param {import("react").ReactNode} [props.atgard] (0.103.0) Åtgärden i sidans huvud, till exempel `<OpsVyAtgard>Skapa app</OpsVyAtgard>`.
 */
export function OpsGruppHubb({ grupp, moduler, activeHref = "", onNavigate, sprak: sprakProp, info, badge, badgeText, ram = true, installera, atgard, ikoner }) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const { kort, saknade } = hubbForGrupp({ grupp, moduler });
  const t = GRUPPHUBB_TEXT[sprak === "en" ? "en" : "sv"];
  const gruppnamn = text(grupp.namn, sprak);
  // ⛔ 0.240.0: läget (`info`) och delarna följer med till (i)-panelen. Samma `hubbPoster` som toppradens rullgardin, så namn, ikon och räknare är desamma.
  const poster = hubbPoster(kort, { sprak, badge, info: info ?? {}, delar: true }).map((p, i) => ({ ...p, id: kort[i].id, beskrivning: kort[i].beskrivning }));
  // ⛔ EN PANEL ÅT GÅNGEN PÅ HELA SIDAN, över de installerade och de som kan läggas till: `v:<href>` eller `l:<id>`.
  const [oppen, setOppen] = useState(/** @type {string | null} */ (null));
  // Appar med ett kort som gruppen inte har. En modul utan kort (hubb: null) blir ingen ruta här: den syns inte i hubben.
  // ⛔ En kärnmodul står aldrig här (0.106.0, #386): den är alltid installerad, och `medKarna` räknar den så.
  const installerade = medKarna(grupp.moduler, moduler);
  // ⛔ 0.124.0: en modul som bara är ett tillägg (`hubb: null`, minst ett tillägg) kan också installeras. Den har inget kort att visa,
  // men den syns på sina ytor, och utan den här raden fanns ingen väg att slå på den (CP 2026-10-19: "Datumomröstning finns inte").
  const tillaggningsbara = moduler.filter((m) => (m.hubb || arBaraTillagg(m)) && !arKarna(m) && !installerade.includes(m.id));
  const tillaggsmoduler = tillaggsmodulerIGrupp({ grupp, moduler });
  const medVag = Boolean(installera && (installera.href || installera.onClick || installera.onInstallera));
  const harInnehall = poster.length > 0 || saknade.length > 0 || tillaggsmoduler.length > 0;
  // ⛔ 0.239.0: rutorna som kan läggas till står UNDER tomläget, inte i det. Tomlägets yta centrerar sitt innehåll och krymper det till
  // sin bredd, och ett rutnät med tre kolumner i en krympt ruta blev en kolumn av avkortade namn. Samma sektion som i en grupp med verktyg.
  const valbarSektion = tillaggningsbara.length > 0 ? (
    <ValbaraRutor moduler={tillaggningsbara} sprak={sprak} t={t} installera={installera} onNavigate={onNavigate} visaAgarRad={harInnehall} oppen={oppen} setOppen={setOppen} ikoner={ikoner} />
  ) : null;
  const innehall = (
    <div className="flex flex-col gap-4" data-grupphubb={grupp.id}>
      {/* ⛔ SIDAN HAR VYNS TUNNA HUVUD (0.103.0), som Meddelanden: ikonen, "Appar" och appens åtgärd. CP 2026-10-14: "App panelen och
          Skapa app kan få vara enligt samma princip i header som meddelanden." Förut började sidan direkt med korten. */}
      <OpsViewHeader title={t.rubrik} ikon={<HubIkon size={18} />} actions={atgard ?? undefined} />
      {poster.length > 0 ? (
        <VerktygRutor poster={poster} activeHref={activeHref} onNavigate={onNavigate} ariaLabel={t.moduler(gruppnamn)} badgeText={badgeText ?? (sprak === "en" ? "new" : "nya")} sprak={sprak === "en" ? "en" : "sv"} t={t} oppen={oppen} setOppen={setOppen} />
      ) : tillaggsmoduler.length > 0 ? null : saknade.length > 0 ? (
        <OpsEmpty title={t.ingaRitbara} description={t.ingaRitbaraText} />
      ) : (
        <OpsEmpty
          title={t.tomRubrik}
          description={t.tomText(gruppnamn, medVag)}
          action={tillaggningsbara.length > 0 ? undefined : <p className="m-0 text-etikett text-ink-secondary">{t.ingaValbara}</p>}
        />
      )}
      {tillaggsmoduler.length > 0 ? (
        <section aria-label={t.tillaggRubrik} data-hubb-tillagg="" className="flex w-full flex-col gap-2 text-left">
          <h2 className="m-0 text-etikett font-medium text-ink">{t.tillaggRubrik}</h2>
          <ul aria-label={t.tillaggRubrik} className="m-0 flex list-none flex-col gap-2 p-0">
            {tillaggsmoduler.map((m) => (
              <li key={m.id} data-hubb-tillagg-modul={m.id} className="flex min-h-11 min-w-0 flex-col justify-center rounded-base border border-line bg-surface px-3 py-2">
                <span className="truncate text-etikett text-ink">{text(m.namn, sprak)}</span>
                <span className="truncate text-meta text-ink-secondary">{tillaggText(m, t, sprak)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {valbarSektion}
      {saknade.length > 0 ? (
        <section aria-label={t.saknadRubrik} data-hubb-saknade="" className="flex flex-col gap-1">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {saknade.map((s) => (
              <li key={s.id} data-saknad={s.skal} className="flex items-start gap-2 text-meta text-ink-secondary">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-line-strong" />
                <span>{s.skal === "inte-registrerad" ? t.interegistrerad(s.id) : t.ingetKort(s.id)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
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
  hubEtikett = "Verktyg",
  activeHref = "",
  onNavigate,
  brodsmulaEtikett = "Var du är",
  tomRubrik = "Inga undersidor än",
  tomText = "Den här modulen har inga undersidor att visa.",
  badgeText = "nya",
  sprak: sprakProp,
  ingetNyttEtikett,
  ram = true,
}) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
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
 */
function KortRutnat({ poster, activeHref, onNavigate, ariaLabel, badgeText, sprak, ingetNyttEtikett }) {
  /*
   * ⛔ VILKA KORT SOM ÄR UTFÄLLDA BOR HÄR OCH INTE I KORTET (0.83.0). Rutnätet sträcker korten till radens höjd, så att ett
   * kort utan `info` står lika högt som ett med. Mätt med Playwright i lifehub, 1280 px: fälldes Ekonomi ut (fjorton delar)
   * sträcktes Bibliotek bredvid till samma 1 000 px, ett tomt kort över halva skärmen. Medan ett kort är utfällt lägger sig
   * korten därför i sin egen höjd (`items-start`), och när alla är stängda står de lika höga igen.
   */
  const [utfallda, setUtfallda] = useState(() => new Set(poster.filter((m) => (m.children ?? []).some((/** @type {any} */ c) => c.href === activeHref)).map((m) => m.href)));
  const vaxla = (/** @type {string} */ href) =>
    setUtfallda((fore) => {
      const nya = new Set(fore);
      if (nya.has(href)) nya.delete(href);
      else nya.add(href);
      return nya;
    });
  return (
    <ul aria-label={ariaLabel} className={cx("m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3", utfallda.size > 0 && "items-start")}>
      {poster.map((m) => (
        <li key={m.href} className="min-w-0">
          {(m.children ?? []).length > 0 ? (
            <UtfallbartKort post={m} ut={utfallda.has(m.href)} onVaxla={() => vaxla(m.href)} activeHref={activeHref} onNavigate={onNavigate} badgeText={badgeText} sprak={sprak} ingetNyttEtikett={ingetNyttEtikett} />
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
      <span className="flex min-h-11 items-center gap-2.5 text-etikett font-medium">
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
          <span data-status="inget-nytt" className="flex items-center gap-1.5 truncate text-meta text-ink-secondary">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-line-strong" />
            <span className="truncate">{infoText}</span>
          </span>
        ) : (
          <span className="block truncate text-meta text-ink-secondary">{infoText}</span>
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
 * Ett kort med barn: hela kortet är en länk till modulens startsida, och en chevron fäller ut barnen under (0.83.0).
 *
 * ══ ⛔ KORTET ÄR LÄNKEN, CHEVRONEN ÄR KNAPPEN (0.83.0) ═══════════════════════
 *
 * CP 2026-10-08 17:54, med en bild av Hubben där Ekonomi och Bibliotek var två kort utan väg till delarna: "Varje app/modul
 * borde kunna expanderas med chevron." Kortet leder som förut till modulens startsida, och bara chevronen fäller ut. Före
 * 0.83.0 var hela rubriken en knapp (0.31.2) och vägen till modulen en egen rad "Visa Ekonomi" i den utfällda listan, så
 * ett tryck på kortet gjorde något annat än i Hubben för grupper (där kortet var en länk). Nu är det samma gest överallt:
 * trycket på kortet öppnar modulen, och chevronen visar vad som finns i den. Raden "Visa Ekonomi" är borta, eftersom kortet
 * självt är den länken.
 *
 * ⛔ KNAPPEN LIGGER BREDVID LÄNKEN, INTE I DEN. En knapp inuti en länk är två interaktiva element i varandra: skärmläsaren
 * läser upp dem som ett, och ett tryck på chevronen hade också följt länken. Kortets yta är en `div`, med länken och knappen
 * som syskon.
 *
 * ⛔ CHEVRONEN ÄR EN `<button aria-expanded aria-controls>` MED EGET NAMN ("Visa delarna i Ekonomi"), som SessionStudios
 * utfällning (`MoreSettingsDisclosure.jsx:66-80`), 44 px träffyta, och den vrids 180 grader när listan är öppen. Enter och
 * mellanslag fäller ut, eftersom det är en knapp.
 *
 * ⛔ LÄGET SPARAS INTE MELLAN BESÖK. Kortet börjar utfällt när en av dess sidor är den aktiva, annars stängt. Att minnas
 * läget hade krävt en lagring per person och modul för en sak som tar ett tryck att göra om.
 *
 * @param {object} props
 * @param {any} props.post
 * @param {boolean} props.ut Utfällt. Läget bor i rutnätet (`KortRutnat`), se där.
 * @param {() => void} props.onVaxla
 * @param {string} props.activeHref
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} props.badgeText
 * @param {string} props.sprak
 * @param {string} [props.ingetNyttEtikett]
 */
function UtfallbartKort({ post, ut, onVaxla, activeHref, onNavigate, badgeText, sprak, ingetNyttEtikett }) {
  const barn = /** @type {any[]} */ (post.children ?? []);
  const listId = useId();
  const ingetNytt = ingetNyttEtikett ?? (sprak === "en" ? "Nothing new" : "Inget nytt");
  const chevronNamn = sprak === "en" ? `Show the parts of ${post.label}` : `Visa delarna i ${post.label}`;
  return (
    <div
      data-utfallbart={post.href}
      className={cx("flex h-full flex-col", KORT, "has-[[data-kortlank]:hover]:bg-raised", (post.href === activeHref || barn.some((c) => c.href === activeHref)) && "ring-2 ring-accent")}
    >
      <div className="flex items-start">
        <a
          href={post.href}
          data-kortlank=""
          onClick={(e) => onNavigate?.(post.href, e)}
          aria-current={post.href === activeHref ? "page" : undefined}
          className={cx("flex min-w-0 flex-1 flex-col gap-1 rounded-card py-4 pl-4", KORT_FOKUS)}
        >
          <KortInnehall post={post} badgeText={badgeText} sprak={sprak} ingetNyttEtikett={ingetNyttEtikett} />
        </a>
        <button
          type="button"
          onClick={onVaxla}
          aria-expanded={ut}
          aria-controls={listId}
          aria-label={chevronNamn}
          className={cx(
            "mt-4 mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted",
            "transition-colors duration-(--duration-fast) ease-standard hover:bg-raised hover:text-ink",
            KORT_FOKUS,
          )}
        >
          <span aria-hidden="true" className={cx("flex items-center transition-transform duration-(--duration-fast) ease-standard", ut && "rotate-180")}>
            <ChevronNedIkon size={16} />
          </span>
        </button>
      </div>
      <div id={listId} hidden={!ut} className="flex flex-col gap-0.5 px-2 pb-2">
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
              {c.info !== undefined ? <span className="truncate text-meta text-ink-muted">{c.info === null ? ingetNytt : text(c.info, sprak)}</span> : null}
            </span>
            {typeof c.badge === "number" && c.badge > 0 ? <OpsCountBadge count={c.badge} text={badgeText} placement="inline" /> : null}
          </a>
        ))}
      </div>
    </div>
  );
}
