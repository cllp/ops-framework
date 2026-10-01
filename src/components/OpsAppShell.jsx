import { Children, cloneElement, Component, createContext, Fragment, isValidElement, useContext, useEffect, useId, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { cx } from "../lib/cx.js";
import { OpsBrand } from "./OpsBrand.jsx";
import { OpsBottomNav } from "./OpsBottomNav.jsx";
import { OpsGruppanel, OpsGruppvaxlare } from "./OpsGruppanel.jsx";
import { entryActive, validateNav } from "../lib/nav.js";
import { Counter } from "./counter.jsx";
import { ArendePlusIkon, ChevronNedIkon, HandelsePlusIkon, KryssIkon, MeddelandeIkon, MenuIcon, PlusIkon, GruppIkon } from "./icons.jsx";
import { byggFasta, djupAktiv, validateFasta } from "./fasta.jsx";
import { huvudknappKlass, radBehallare, radKlass } from "../lib/radKlass.js";
import { rapporteraFel } from "../lib/felrapport.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsIconLink } from "./OpsIconLink.jsx";
import { OpsPanelRow } from "./OpsPanel.jsx";
import { OpsSkapaI } from "./OpsSkapaI.jsx";
import { OpsSkapaPanel } from "./OpsSkapaPanel.jsx";
import { OpsSkapa } from "./OpsSkapa.jsx";
import { OpsField } from "./OpsField.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { OpsSwitch } from "./OpsToggle.jsx";
import { giltigtDatum, kalenderval } from "../lib/kalendrar.js";
import { OppnaHandelseKontext } from "../lib/handelsekontext.js";
import { HANDELSEPARAM, handelseIdUrAdress, medHandelse } from "../lib/handelsepanel.js";
import { KALENDERIKON_KOMPONENT } from "../lib/kalenderikoner.js";
import { text } from "../lib/sprak.js";
import { skapalaget, typerAttValja } from "../lib/skapa.js";
import { kordarePafunktion, MenyAvdelningar, menyAppAvdelning, menyFot, MenyRubrikRad, menySektioner, validateMeny } from "./OpsMeny.jsx";

/**
 * En rad i en rullgardin: en modul (Hubs barn) med egna undersidor som fälls ut och in (0.30.1).
 *
 * ⛔ SAMMA REGEL SOM `OpsHub`s KORT (CP 2026-09-29 13:44: "ekonomi skall vara expanderbar"). Före 0.30.1 stod
 * Ekonomis sex undersidor uppradade under namnet varje gång rullgardinen öppnades, och Hub-listan blev tretton
 * rader lång. Namnet är en länk, chevronen en knapp med `aria-expanded`. En rad utan barn har ingen chevron.
 *
 * @param {object} props
 * @param {any} props.b
 * @param {string} props.activeHref
 * @param {(href: string, e: any) => void} props.onActivate
 * @param {() => void} props.stang Stänger rullgardinen innan navigeringen körs.
 * @param {string} props.submenuLabel
 */
function HubModulRad({ b, activeHref, onActivate, stang, submenuLabel }) {
  const barn = /** @type {any[]} */ (b.children ?? []);
  const [ut, setUt] = useState(barn.some((c) => c.href === activeHref));
  const listId = useId();
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center">
        <a
          href={b.href}
          onClick={(e) => {
            stang();
            onActivate(b.href, e);
          }}
          aria-current={b.href === activeHref ? "page" : undefined}
          className={cx(radKlass({ active: b.href === activeHref }), "min-w-0 flex-1 w-auto")}
        >
          {b.icon ? (
            <span aria-hidden="true" className="flex shrink-0 items-center [&_svg]:size-4">
              {b.icon}
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate">{b.label}</span>
        </a>
        {barn.length > 0 ? (
          <button
            type="button"
            onClick={() => setUt((v) => !v)}
            aria-expanded={ut}
            aria-controls={listId}
            aria-label={`${submenuLabel} ${b.label}`}
            className="inline-flex min-h-11 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-secondary transition-colors duration-(--duration-fast) ease-standard hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          >
            <span aria-hidden="true" className={cx("inline-flex transition-transform duration-(--duration-fast) ease-standard", ut && "rotate-180")}>
              <ChevronNedIkon size={14} />
            </span>
          </button>
        ) : null}
      </div>
      {barn.length > 0 ? (
        <div id={listId} hidden={!ut} className="flex flex-col gap-0.5">
          {barn.map((c) => (
            <a
              key={c.href}
              href={c.href}
              onClick={(e) => {
                stang();
                onActivate(c.href, e);
              }}
              aria-current={c.href === activeHref ? "page" : undefined}
              className={cx(radKlass({ active: c.href === activeHref }), "ml-6 w-auto")}
            >
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Hur många åtgärder huvudet bär under `md` (0.30.1).
 *
 * ══ ⛔ HUVUDET FLÖDAR ALDRIG ÖVER (CP 2026-09-29 13:44, med bild från telefonen) ══
 *
 * Märket, temaväljaren, gruppväxlarens namn, inkorg, sök, fråga och avataren låg
 * ovanpå varandra i 390 px. Ramverket lät appen lägga så många ikoner den ville i
 * `actions`, och en topprad har en bredd. SessionStudios mobilhuvud
 * (`AppHeaderMobileToolbar.jsx:34-90`, monterad i `AppHeader.jsx:301`) är ikonen
 * (`AppHeader.jsx:173`, `w-10`), en flexibel lucka (`AppHeader.jsx:299`) och en
 * klunga om FYRA saker: temaknapp, sök, plus, avatar. Ingen gruppväxlare med namn,
 * ingen inkorg (den är en flik i bottenraden), inget fråga.
 *
 * Ramverkets motsvarighet: de TRE första åtgärderna stannar, resten flyttar till
 * menyn (bottenradens Meny) under `md`. Tre plus skalets plus (som bottenraden
 * tagit över i mobil) plus avataren är fyra: SS:s antal. Siffran bor här och inte
 * i appen, så en app som lägger en åttonde ikon inte kan ge ett överlappande huvud.
 */
const ATGARDER_SMAL = 3;

/**
 * `actions` som en platt lista, fragment uppvikta. En app skickar ofta
 * `<>...</>`, och skalet måste se varje ikon för sig för att kunna flytta den.
 * @param {import("react").ReactNode} nod
 * @returns {import("react").ReactElement[]}
 */
function plattaAtgarder(nod) {
  /** @type {import("react").ReactElement[]} */
  const ut = [];
  for (const c of Children.toArray(nod)) {
    if (isValidElement(c) && c.type === Fragment) ut.push(...plattaAtgarder(/** @type {any} */ (c.props).children));
    else if (isValidElement(c)) ut.push(c);
  }
  return ut;
}

/**
 * Felgränsen: alltid på, och en app kan inte stänga av den (#159).
 *
 * ══ ⛔ "ALLTID PÅ" ÄR DET SOM SKILJER DEN HÄR FRÅN VARJE ANNAN PRIMITIV ═══
 *
 * Varje annan komponent i ramverket är något en app VÄLJER att lägga in.
 * Felgränsen är motsatsen: den finns i `OpsAppShell` utan en prop som slår av
 * den, av samma skäl som arbetsreglernas punkt 5 säger att tomhet är ett svar
 * och inte en utelämnad rubrik. Ett fält i en vy som kastar ska ge en felyta
 * med ett id och en knapp för att ladda om, ALDRIG en vit sida: en vit sida
 * ser ut som att ingenting hände, och den som möter den vet inte om appen
 * laddar, hängt sig, eller är trasig.
 *
 * ⛔ EN KLASS, INTE EN HOOK. React har (ännu) inget hook-API för
 * `componentDidCatch`/`getDerivedStateFromError`, en gräns MÅSTE vara en
 * klasskomponent. Det är inte en stilfråga, det är den enda mekanism React
 * ger.
 *
 * ⛔ FELET RAPPORTERAS I `componentDidCatch`, INTE I `render`. `render` kan
 * anropas flera gånger av React (t.ex. i StrictMode, dubbelt i utveckling)
 * utan att felet faktiskt hänt flera gånger, och en loggpunkt som körs i
 * render hade räknat samma fel två gånger på en rad som aldrig var trasig.
 *
 * ⛔ ID:T ÄR FÖR PERSONEN, INTE FÖR SPÅRNING. Ett kastat fel ser likadant ut
 * som "appen laddar för evigt" för den som möter det. Ett kort id (skrivet
 * med versaler och siffror, sex tecken) ger personen något att säga eller
 * skriva ned när hen hör av sig, utan att kräva att hen läser en hel
 * stackspårning högt i telefon.
 */
class OpsFelgrans extends Component {
  /** @param {{ felmottagare?: import("../lib/felrapport.js").Felmottagare | null, children: import("react").ReactNode, laddaOmEtikett: string, rubrik: string, beskrivning: string }} props */
  constructor(props) {
    super(props);
    this.state = /** @type {{ fel: unknown, id: string } | { fel: null }} */ ({ fel: null });
  }

  /** @param {unknown} fel */
  static getDerivedStateFromError(fel) {
    // ⛔ ID:T SÄTTS HÄR OCH INTE I componentDidCatch: getDerivedStateFromError
    // körs FÖRE render, så felytan har sitt id från första målningen.
    return { fel, id: Math.random().toString(36).slice(2, 8).toUpperCase() };
  }

  /** @param {unknown} fel @param {{ componentStack?: string }} info */
  componentDidCatch(fel, info) {
    rapporteraFel(fel, { komponentstack: info?.componentStack, id: /** @type {any} */ (this.state).id }, this.props.felmottagare);
  }

  render() {
    if (this.state.fel) {
      const id = /** @type {any} */ (this.state).id;
      return (
        <div role="alert" className="flex min-h-svh flex-col items-center justify-center gap-3 bg-canvas p-6 text-center">
          <p className="m-0 text-titel font-semibold text-ink">{this.props.rubrik}</p>
          <p className="m-0 max-w-prose text-ink-secondary">{this.props.beskrivning}</p>
          <p className="m-0 font-mono text-etikett text-ink-muted">{id}</p>
          <OpsButton variant="primary" onClick={() => globalThis.location?.reload()}>
            {this.props.laddaOmEtikett}
          </OpsButton>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Flikens sidoluft. Ligger för sig (0.31.0) så att en flik med chevron kan fördela den: vänster på länken, höger på chevronen. */
const FLIK_LUFT = "px-3 lg:px-4";

/**
 * En post i toppraden. Med `children` en riktig meny, utan dem en länk.
 *
 * ══ ⛔ CHEVRONEN VAR ETT LÖFTE SOM INTE INFRIADES ══════════════════════
 *
 * CP 2026-09-22: "Ekonomi är ingen dropdown. Sublänkar saknas."
 *
 * Han hade rätt, och felet var ramverkets. Toppraden ritade en chevron så fort
 * en post hade `children`, men posten var en naken `<a href>`: ett tryck gick
 * till föräldersidan och menyn fanns inte. Barnen ritades bara i MOBILENS
 * Mer-ark. På en dator gick de fem ekonomisidorna alltså att nå enbart genom
 * att först besöka `/ekonomi` och trycka på ett kort, medan raden ovanför
 * visade en pil nedåt som lovade något annat.
 *
 * ⛔ DET ÄR SAMMA REGEL SOM KALENDERKORTETS CHEVRON FICK, tillämpad på navet:
 * en pil som öppnar ingenting är värre än ingen pil, för den lär den som ser
 * den att pilar i den här appen inte betyder något.
 *
 * ⛔ FÖRÄLDERN LIGGER FÖRST I MENYN, inte bara som en rubrik. `/ekonomi` är en
 * riktig sida med siffrorna bredvid varandra, och en meny som listar fem barn
 * men inte vägen till föräldern gör den sidan onåbar från raden.
 *
 * ⛔ EN KNAPP OCH INTE EN LÄNK NÄR DET FINNS BARN. En länk som också öppnar en
 * meny gör ett tryck tvetydigt: navigerade jag eller öppnade jag? Knappen gör
 * en sak, och sidan nås på första raden i det som öppnas.
 *
 * @param {object} props
 * @param {import("../lib/nav.js").NavPost} props.entry
 * @param {boolean} props.active
 * @param {string} props.activeHref
 * @param {(href: string, e: any) => void} props.onActivate
 * @param {string} props.badgeText
 * @param {string} props.classes
 * @param {string} props.submenuLabel Verb för chevronens namn, följt av postens etikett.
 */
function RowEntry({ entry, active, activeHref, onActivate, badgeText, classes, submenuLabel }) {
  const [oppen, setOppen] = useState(false);
  const childEntries = /** @type {any[]} */ (Array.isArray(entry.children) ? entry.children : []);

  const counter = typeof entry.badge === "number" && entry.badge > 0 ? <Counter count={entry.badge} text={badgeText} /> : null;

                {/*
        ⛔ INGEN IKON HÄR, OCH DET ÄR MÄTT, INTE TYCKT.

        Toppraden ritade `s.icon` en kort period, efter rapporten
        "finns inga ikoner?". Den rapporten gällde att ikonfältet
        slängdes överallt, och jag drog slutsatsen till toppraden utan
        att titta på förlagan.

        SessionStudios header (`apps/web/src/components/AppHeader.jsx`)
        renderar `{n.label}` och inget annat. Chevron bara på posten
        med undermeny, badge som en liten cirkel. Ikonerna sitter i
        hamburgermenyn (16 px) och i mobilens bottenrad (20 px), aldrig
        i flikraden.

        Utfallet av min variant beskrevs som "fruktansvärda, ser
        80-tal ut". Med tolv ikoner i rad blir raden en verktygslåda i
        stället för fyra ord, och ett kontosammanhang har inga
        självklara bilder: en spargris för pension är den sortens
        gissning som ser billig ut i just det sammanhang där den ska
        inge förtroende.

        `icon` är kvar i kontraktet. Bottenraden och menyn ritar den.
        Den här raden gör det inte.
      */}

  if (!childEntries.length) {
    return (
      <a href={entry.href} onClick={(e) => onActivate(entry.href, e)} aria-current={active ? "page" : undefined} className={cx(classes, FLIK_LUFT)}>
        {entry.label}
        {counter}
      </a>
    );
  }


  /*
   * ⛔ CHEVRONEN LIGGER INNE I FLIKEN, DIREKT EFTER ORDET (0.31.0, CP 2026-09-29: "Hub ⌄ står längre bort än Idag och
   * Kalender"). Före 0.31.0 hade länken `px-3` på BÅDA sidor och chevronen `pr-2`, så ordet och chevronen låg 12 px isär
   * och flikens högra luft var 8 px, mot 12 (lg: 16) hos en vanlig flik. SessionStudios Bibliotek ⌄ är en enda flik med
   * chevronen `ml-0.5` efter ordet (`AppHeader.jsx:217-230`). Här är länken och chevronen fortfarande två kontroller
   * (etiketten navigerar, chevronen öppnar), men flikens luft är den vanliga: vänster på länken, höger på chevronen,
   * och 2 px mellan ordet och chevronen. Mäts i check-skalyta, avsnitt 11.
   *
   * ⛔ ORDET EN GÅNG, INTE TVÅ. Första versionen lade föräldern som första rad i
   * menyn, så att sidan skulle gå att nå från raden. CP 2026-09-22, med bild:
   * "Men varför står Ekonomi två gånger?" Knappen sa Ekonomi och menyns första
   * rad sa Ekonomi, tjugo pixlar isär, alltså exakt den dubblett som Fråga och
   * Översikt-kortet fick stryka på foten för samma kväll.
   *
   * ⛔ ETIKETTEN ÄR LÄNKEN, CHEVRONEN ÄR KNAPPEN. Två kontroller som gör var sin
   * sak, inte en kontroll som gör två. Skälet att posten inte fick vara EN länk
   * som också öppnar står kvar och är ett annat: då är ett tryck tvetydigt,
   * navigerade jag eller öppnade jag. Här är svaret givet av var man trycker.
   *
   * ⛔ RADEN FINNS BARA FRÅN 768 px, alltså där det finns en pekare eller en
   * surfplatta. Chevronens träffyta är ändå 44 px hög, för en surfplatta är en
   * tumme. På telefon finns ingen topprad: där ligger barnen indragna under
   * föräldern i Mer-arket, som förut.
   */
  /*
   * ⛔ UNDERSTRECKET LÅG LÄGRE PÅ DEN HÄR FLIKEN ÄN PÅ DE ANDRA (#90), och
   * orsaken var min egen konstruktion. Ytterlådan fick `p-0` medan båda barnen
   * fick `min-h-11` för träffytans skull. Då blev lådan 44 px hög medan en
   * vanlig flik är `py-2` runt en 20 px rad, alltså 36. `border-b-2` sitter på
   * lådan, så strecket följde med ned de åtta pixlarna.
   *
   * ⛔ LÖSNINGEN ÄR INTE ATT TA BORT TRÄFFYTAN. 44 px är ett tumkrav och står
   * kvar; den flyttar bara ut ur flödet. Chevronen får samma `py-2` som en
   * vanlig flik och en osynlig `::after` som sträcker målet till 44 px utan att
   * röra lådans höjd.
   *
   * ⛔ OCH LÅDAN BEHÅLLER SIN EGEN `py-2`. Tas den bort krymper lådan till
   * barnens höjd igen, och då sitter strecket för HÖGT i stället. Felet byter
   * bara tecken.
   */
  return (
    <span className={cx(classes, "gap-0")}>
      <a
        href={entry.href}
        onClick={(e) => onActivate(entry.href, e)}
        aria-current={active ? "page" : undefined}
        className="inline-flex items-center self-stretch rounded-l-md pl-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent lg:pl-4"
      >
        {entry.label}
        {counter}
      </a>
      <Popover.Root open={oppen} onOpenChange={setOppen}>
        <Popover.Trigger
          aria-label={`${submenuLabel} ${entry.label}`}
          className={cx(
            "relative inline-flex cursor-pointer items-center self-stretch rounded-r-md pr-3 pl-0.5 lg:pr-4",
            // ⛔ Träffytan, 44 px, utanför flödet. `inset-x-0` täcker chevronens
            // bredd och `-translate-y-1/2` centrerar den kring raden.
            "after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <span aria-hidden="true" className="inline-block shrink-0">
            <ChevronNedIkon size={12} />
          </span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className={cx("z-(--z-dropdown) flex max-h-[min(70vh,32rem)] w-56 flex-col gap-0.5 overflow-y-auto p-1", radBehallare())}
          >
            {/* ⛔ 0.30.0 (#173): RADEN ÄR `radKlass`, som menyn och plussets rader.
                Barn i barnen (Hubs moduler har egna undersidor) ritas indragna
                under sin förälder: en nivå djupare än `nav`, och exakt så djupt
                som Hub behöver. */}
            {childEntries.map((b) => (
              <HubModulRad key={b.href} b={b} activeHref={activeHref} onActivate={onActivate} stang={() => setOppen(false)} submenuLabel={submenuLabel} />
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}

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
 * Ny händelse med typ (0.30.0, #173). ⛔ DATUMFÄLTEN ÄR FORMULÄRETS, INTE RAMVERKETS:
 * ramverket äger raden, typvalet ur katalogen och vem-skapade-det, appen äger vad
 * som fylls i.
 *
 * Händelse har varit ett färdigt `ReactNode` sedan #168, och ett färdigt
 * `ReactNode` kan varken få en `groupId` eller en vald typ: formuläret är redan
 * skapat när skalet frågar. CP 2026-09-29 (#173): "skapa händelse med typ och vem
 * som skapade". Registreringarna (#150) hade redan formen, en komponent som tar
 * `{ groupId, typ, onKlar }`, och händelsen får nu samma.
 * @typedef {object} HandelseSkapare
 * @property {import("react").ComponentType<HandelseFormProps>} form
 * @property {string | null} [katalog] Katalogens id, förval `"handelsetyper"`. `null` = ingen typ att välja.
 * @property {{ gruppens: ReadonlyArray<import("../lib/kalendrar.js").Gruppkalender>, mina: ReadonlyArray<import("../lib/kalendrar.js").MinKalender> }} [kalendrar]
 *   (0.37.0, #179 F2 och F3) Den aktiva gruppens kalendrar och mina. Med dem står "Kalender" överst i formuläret (raden som
 *   öppnar "Skapa i", med gruppens kalendrar och "Mina kalendrar", den aktiva gruppens förvalda förvald), och formuläret får
 *   `kalender`. I en gruppkalender visar skalet "Kräv svar" (av från början), i en av mina "Blockerar tillgänglighet".
 *   ⛔ "Skicka mejl" visas inte: avsändarbeslutet (#180 G3) saknas, och ett val som inte gör något är värre än inget.
 *   ⛔ För händelsen ersätter kalendrarna `skapaISektioner`: två listor i samma väljare hade varit två svar på "var hamnar den".
 */

/**
 * Det formuläret för en ny händelse får (0.37.0). Appen skriver händelsen (gruppkalender) eller posten (min kalender).
 * @typedef {object} HandelseFormProps
 * @property {string | null} groupId Den aktiva gruppen.
 * @property {string | null} typ Vald typ. `null` i en av mina kalendrar: en egen post har ingen typ.
 * @property {() => void} onKlar
 * @property {string} [formId]
 * @property {{ sektion: string, id: string } | null} [mal]
 * @property {string | null} [datum] (0.37.0, #206) Dagen formuläret öppnades för (`useOppnaSkapa()("handelse", { datum })`, adressens
 *   `&datum=`), `YYYY-MM-DD`, eller `null`. Formuläret fyller i den; utan den väljer man själv.
 * @property {{ id: string, slag: "grupp" | "mina" } | null} [kalender] (0.37.0) Vald kalender. `null` utan `kalendrar`.
 * @property {boolean} [kravSvar] (0.37.0) "Kräv svar" är på. Alltid `false` i en av mina kalendrar.
 * @property {boolean} [blockerar] (0.37.0) "Blockerar tillgänglighet" är på. Alltid `false` i en gruppkalender.
 */

/**
 * Skalets `handelsepanel`-prop (0.40.0, #214): händelsen på en egen sida, med Tillbaka.
 *
 * ══ ⛔ SKALET ÄGER ADRESSEN OCH TILLBAKA, APPEN ÄGER HÄNDELSEN ═══════════════════════════════════════════════════════
 *
 * CP 2026-10-01: "Vi behöver en händelsepanel. Så man navigerar dit från kalender och från idag. Händelsepanelen skall ha en tillbaka
 * knapp." Panelen är en SIDA i innehållskolumnen och öppnas som skapa-panelen: `?handelse=<id>` skrivs i adressen med `pushState`, appens
 * vy ligger kvar monterad men dold, och Tillbaka återställer den (kalenderns månad och valda dagar, Idags flik, filter och rullning).
 * Webbläsarens bakåt och framåt gör samma sak, och en omladdning på adressen öppnar samma panel.
 *
 * ⛔ DE TVÅ INGÅNGARNA ÄR RADERNA SJÄLVA. En post med `handelseId` i `OpsEventList` (Idag) och `OpsCalendar` (dagpanel och snabbtitt)
 * öppnar panelen utan att appen kopplar något: raderna frågar skalet. Appen skickar bara `handelseId` på de poster som ÄR händelser
 * (en uppgift eller ett ärende i samma lista har ingen panel), och `rita` nedan.
 *
 * @typedef {object} HandelsepanelKonfiguration
 * @property {(arg: { id: string, onTillbaka: () => void }) => import("react").ReactNode} rita Ritar panelen för ett id, normalt
 *   `({ id, onTillbaka }) => <OpsHandelsePanel handelse={...} laddar={...} svar={<HandelseSvar handelseId={id} />} onTillbaka={onTillbaka} statusWords={...} />`.
 *   En FUNKTION och inte en färdig nod: id:t kommer ur adressen, och appen slår upp händelsen ur sin egen källa med sina egna hooks.
 *   Händelsen kan saknas (`handelse={null}`), eller läsas ännu (`laddar`): panelen har en väg tillbaka i båda.
 * @property {boolean} [adress] Skalet lägger `?handelse=<id>` i adressen, så att Tillbaka i webbläsaren fungerar och panelen går att länka
 *   till. Förval sant; `false` för en app vars router inte tål att någon annan skriver i historiken.
 */

/**
 * Skalets `skapa`-prop (#168), plusset i toppraden.
 * @typedef {object} SkapaKonfiguration
 * @property {import("react").ReactNode | HandelseSkapare} [handelse] Ramverkets egen rad "Ny händelse". `null`/utelämnad döljer raden.
 *   Ett färdigt `ReactNode` (som förut) eller, från 0.30.0 (#173), ett `HandelseSkapare`: ett formulär OCH en katalog
 *   med händelsetyper, så typvalet och `{ groupId, typ, onKlar }` fungerar precis som för en moduls registrering.
 * @property {import("react").ReactNode | ((arg: { formId: string, mal: { sektion: string, id: string } | null }) => import("react").ReactNode)} [arende] Ramverkets egen rad "Nytt ärende".
 *   Ett färdigt `ReactNode` (som förut) eller, från 0.31.1, en FUNKTION `({ formId, mal }) => nod`: appen sätter `id={formId}` på sitt
 *   `<form>` och panelens `sparaEtikett` ritar då den gemensamma Spara-knappen. En färdig nod har ingen `formId` att ta emot, och för
 *   den ritas ingen Spara (annars en död knapp).
 * @property {(arg: { formId: string, onKlar: () => void }) => import("react").ReactNode} [grupp] (0.32.0, #180) Ramverkets egen rad "Ny grupp".
 *   En FUNKTION som ritar formuläret, normalt `({ formId, onKlar }) => <OpsGruppFormular formId={formId} onKlar={onKlar} onSkapa={...} onSkapad={...} />`.
 *   Med den ritar skalet raden i plusset OCH gör "Skapa grupp" i gruppanelen till samma panel (växlarens ark på telefon har ingen sedan 0.37.0): `grupper.onSkapa` behövs då inte,
 *   och om båda finns vinner `skapa.grupp` (en väg att skapa en grupp är en sanning, två är två). `onKlar` stänger panelen UTAN att gå bakåt i
 *   historiken, så att appens egen navigering efter `onSkapad` (till gruppens sida) inte ångras av ett sent `history.back()`.
 * @property {(arg: { formId: string, groupId: string | null, onKlar: () => void }) => import("react").ReactNode} [meddelande] (0.34.0, #182) Ramverkets egen rad
 *   "Nytt meddelande", normalt `({ formId, groupId, onKlar }) => <OpsNyttMeddelande formId={formId} groupId={groupId} ... onKlar={(id) => { onKlar(); gaTill(id); }} />`.
 *   `groupId` är den aktiva gruppen (0.35.0: alltid, det finns ingen gruppväljare före formuläret; ett meddelande hör alltid till en
 *   grupp). Panelens knapp heter `skickaEtikett` ("Skicka"), inte Spara. `onKlar` stänger utan att gå bakåt.
 * @property {(arg: { formId: string, groupId: string, onKlar: () => void }) => import("react").ReactNode} [redigeraGrupp] (0.32.0, #180 G2) Formuläret i REDIGERINGSLÄGE
 *   (`OpsGruppFormular grupp={...}`), öppnat av pennan på gruppkortet i gruppanelen. Med den ritar skalet pennan och öppnar samma panel-form som "Ny grupp"
 *   (`?skapa=redigera-grupp&grupp=<id>`, smal kolumn). Utan den anropas `grupper.onRedigera` i stället, om appen gav en.
 * @property {ReadonlyArray<import("../lib/modul.js").Skaparregistrering & { modulId: string }>} [registreringar] Ur `skaparFor` (#150).
 * @property {string | null} [lage] Den aktiva gruppens id, se `skapalaget`. `null` bara när personen inte är med i någon grupp.
 * @property {ReadonlyArray<{ id: string, kategorier?: ReadonlyArray<any> }>} [kataloger]
 * @property {(namn: string) => import("react").ReactNode} [ikonRitare]
 * @property {string} [sprak]
 * @property {(arg: { registrering: string, typ: string | null }) => void} [onKlar] Anropas när en MODULENS formulär är klart.
 * @property {string} [sparaEtikett] (0.31.0) Ritar en fast `Spara`-knapp längst ned i panelen, kopplad till formuläret med `formId`
 *   (appens `<form id={formId}>`). Utelämnad: formuläret har en egen knapp, och bara `Avbryt` är skalets.
 * @property {string} [avbrytEtikett] Förval "Avbryt".
 * @property {string} [tillbakaEtikett] Förval "Tillbaka".
 * @property {string} [skapasIEtikett] Etiketten före målet i panelens översta rad. Förval "Skapas i".
 * @property {string} [skapaIRubrik] Väljarens rubrik. Förval "Skapa i".
 * @property {ReadonlyArray<{ id: string, rubrik: string, poster: ReadonlyArray<{ id: string, namn: string, ikon?: import("react").ReactNode }> }>} [skapaISektioner]
 *   Appens egna mål i väljaren, t.ex. "Mina kalendrar". Formuläret får det valda som `mal: { sektion, id }`. ⛔ 0.35.0: väljaren har
 *   inga grupper längre; posten skapas i den aktiva gruppen, och målet är ett fält i den.
 * @property {boolean} [adress] Skalet lägger `?skapa=<vad>` i adressen när panelen öppnas, så att Tillbaka i webbläsaren fungerar och
 *   panelen går att länka till. Förval sant; `false` för en app vars router inte tål att någon annan skriver i historiken.
 *
 * `props.grupper`s form (#161). Samma fältnamn som `OpsGruppanel`/
 * `OpsGruppvaxlare` tar direkt, plus `lista` (skickas som `grupper` till båda)
 * och `infalld`/`onInfalld` (styr panelen OCH brandets ikon/ordmärke-val, se
 * `varumarke` i själva komponenten).
 *
 * @typedef {object} OpsAppShellGrupper
 * @property {ReadonlyArray<import("./OpsGruppanel.jsx").GruppanelGrupp>} lista
 * @property {string} aktiv
 * @property {(id: string) => void} onValj
 * @property {() => void} [onSkapa]
 * @property {(id: string) => void} [onInfo] (0.32.0, G2) Info-knappen på gruppkortet: appen öppnar gruppens detaljsida (`OpsGruppSida`). Utelämnad: ingen knapp.
 * @property {(id: string) => void} [onRedigera] (0.32.0, G2) Pennan på gruppkortet, bara för `roll` `agare` eller `admin`. `skapa.redigeraGrupp` går före den.
 * @property {boolean} [infalld]
 * @property {(infalld: boolean) => void} [onInfalld]
 * @property {string} [sprak]
 * @property {string} [listEtikett] (0.35.0) Skärmläsarnamnet på grupplistan. Förval "Mina grupper". Ersätter `allaEtikett`, som var namnet
 *   på raden "Alla mina grupper" (borttagen, #190).
 * @property {string} [ingenGruppEtikett] (0.35.0) Växlarens namn när personen inte är med i någon grupp. Förval "Ingen grupp".
 * @property {string} [skapaEtikett]
 * @property {string} [tomText]
 * @property {string} [kollapsaEtikett]
 * @property {string} [fallUtEtikett]
 * @property {Record<string, string>} [rollNamn]
 * @property {string} [medlemmarEtikett]
 * @property {string} [flerAvatarerEtikett]
 * @property {string} [etikett] Skärmläsarnamn på `OpsGruppvaxlare`s ark (smal skärm).
 * @property {string} [nuEtikett] (0.31.1) Ordet före det aktiva namnet i växlarknappens skärmläsarnamn ("Byt grupp, nu: Alfa AB"). Förval "nu".
 */

/**
 * Ritar `skapa.arende` när det är en funktion (0.31.1). Som en EGEN komponent och inte ett direktanrop i skalets render: en app
 * som använder hooks i sin funktion får då dem på en stabil plats, i stället för i skalets villkorliga gren.
 * @param {{ rita: (arg: { formId: string, mal: any }) => import("react").ReactNode, formId: string, mal: any }} props
 */
function ArendeRitare({ rita, formId, mal }) {
  return <>{rita({ formId, mal })}</>;
}

/**
 * Ritar `skapa.grupp` (0.32.0). Samma skäl som `ArendeRitare`: en egen komponent, så att appens hooks får en stabil plats.
 * @param {{ rita: (arg: { formId: string, onKlar: () => void }) => import("react").ReactNode, formId: string, onKlar: () => void }} props
 */
function GruppRitare({ rita, formId, onKlar }) {
  return <>{rita({ formId, onKlar })}</>;
}

/**
 * Ritar `skapa.meddelande` (0.34.0). Samma skäl som `GruppRitare`.
 * @param {{ rita: (arg: { formId: string, groupId: string | null, onKlar: () => void }) => import("react").ReactNode, formId: string, groupId: string | null, onKlar: () => void }} props
 */
function MeddelandeRitare({ rita, formId, groupId, onKlar }) {
  return <>{rita({ formId, groupId, onKlar })}</>;
}

/**
 * Ritar `handelsepanel.rita` (0.40.0, #214). Samma skäl som `ArendeRitare`: en egen komponent, så att appens hooks (händelsen ur appens
 * källa, svaren) får en stabil plats i stället för skalets villkorliga gren. Nyckeln är händelsens id, så en annan händelse börjar om.
 * @param {{ rita: (arg: { id: string, onTillbaka: () => void }) => import("react").ReactNode, id: string, onTillbaka: () => void }} props
 */
function HandelsepanelRitare({ rita, id, onTillbaka }) {
  return <>{rita({ id, onTillbaka })}</>;
}

/**
 * ⛔ EN SANNING FÖR NYCKEL TILL FORMULÄR (0.34.1). Adressens `?skapa=` och `useOppnaSkapa()` gör samma sak: en nyckel blir
 * en beskrivning av vilket formulär panelen ska visa, eller `null` när skalets `skapa` inte har den posten (ännu).
 * Nycklarna är adressens: "handelse", "arende", "grupp", "meddelande", "redigera-grupp" (med `groupId`) eller en
 * modulregistrerings id.
 *
 * @param {any} skapa Skalets `skapa`-prop.
 * @param {string} nyckel
 * @param {{ groupId?: string | null, nyHandelseEtikett?: string, datum?: string | null }} [extra]
 * @returns {any} Formulärbeskrivningen, eller `null`.
 */
function skapaFormFranNyckel(skapa, nyckel, extra = {}) {
  if (!skapa || !nyckel) return null;
  if (nyckel === "handelse" && skapa.handelse) {
    // ⛔ 0.37.0 (#206): DAGEN FÖLJER MED I BESKRIVNINGEN, INTE I EN GLOBAL. Formuläret får den som prop (`datum`), och
    // adressen bär den som `&datum=`, så att en omladdning ger samma dag. Appens brygga `forifylldDag.js` (en modulvariabel
    // som gällde i två sekunder) behövs då inte.
    return typeof skapa.handelse === "object" && !isValidElement(skapa.handelse) && typeof (/** @type {any} */ (skapa.handelse)).form === "function"
      ? { kind: "modul", registrering: { id: "handelse", namn: extra.nyHandelseEtikett ?? "Ny händelse", katalog: /** @type {any} */ (skapa.handelse).katalog === undefined ? "handelsetyper" : /** @type {any} */ (skapa.handelse).katalog, form: /** @type {any} */ (skapa.handelse).form }, datum: extra.datum ?? null }
      : { kind: "handelse" };
  }
  if (nyckel === "arende" && skapa.arende) return { kind: "arende" };
  if (nyckel === "grupp" && skapa.grupp) return { kind: "grupp" };
  if (nyckel === "meddelande" && typeof skapa.meddelande === "function") return { kind: "meddelande" };
  if (nyckel === "redigera-grupp" && typeof skapa.redigeraGrupp === "function" && extra.groupId) return { kind: "redigeragrupp", groupId: extra.groupId };
  const reg = (skapa.registreringar ?? []).find((/** @type {any} */ r) => r.id === nyckel);
  return reg ? { kind: "modul", registrering: reg } : null;
}

/**
 * Om `skapa.handelse` är ett formulär (`HandelseSkapare`) och inte en färdig nod.
 * @param {any} skapa @returns {boolean}
 */
function handelseSkapareFinns(skapa) {
  return Boolean(skapa && skapa.handelse && typeof skapa.handelse === "object" && !isValidElement(skapa.handelse) && typeof skapa.handelse.form === "function");
}

/** Skalets `oppnaSkapa`, åtkomlig för appens komponenter under skalet. `null` utanför skalet. */
const OppnaSkapaKontext = createContext(/** @type {((nyckel: string, extra?: { groupId?: string, datum?: string }) => void) | null} */ (null));

/**
 * ⛔ Öppnar skalets skapa-panel från appen (0.34.1). Ersätter `window.location.assign(pathname + "?skapa=meddelande")`,
 * som laddade om hela sidan och bara fungerade om posten fanns vid monteringen.
 *
 * `oppna("meddelande")`, `oppna("redigera-grupp", { groupId })`, `oppna(<en modulregistrerings id>)`. Samma nycklar som adressen.
 * `oppna("handelse", { datum: "2026-10-12" })` (0.37.0, #206) öppnar "Ny händelse" på den dagen: formuläret får `datum`, och adressen
 * bär `&datum=`. Ett datum som inte finns (31 februari, fel form) kastar, och ett datum till något annat än händelsen kastar också.
 * Använder skalets egen `oppnaSkapa`, så adressen (`?skapa=`) och webbläsarens Tillbaka fungerar som när panelen öppnas ur plusset.
 * Är posten inte tillgänglig (`skapa.meddelande` saknas, okänd nyckel) kastas ett fel: ingenting sker aldrig tyst.
 * Utanför `OpsAppShell` kastas ett fel direkt när hooken anropas.
 *
 * @returns {(nyckel: string, extra?: { groupId?: string, datum?: string }) => void}
 */
export function useOppnaSkapa() {
  const oppna = useContext(OppnaSkapaKontext);
  if (!oppna) throw new Error("useOppnaSkapa() används utanför OpsAppShell: hooken behöver skalet som förälder.");
  return oppna;
}

/**
 * ⛔ Öppnar händelsepanelen från appen (0.40.0, #214): `oppna("<händelsens id>")`. Samma väg som en rad i Idag och en post i kalenderns
 * dagpanel tar när de har ett `handelseId`: adressen (`?handelse=<id>`) skrivs med `pushState`, appens vy ligger kvar dold, och
 * Tillbaka (knappen och webbläsarens) för tillbaka till exakt det man lämnade. Behövs bara för en egen yta (en länk i inkorgen, ett
 * sökresultat): raderna i `OpsEventList` och `OpsCalendar` gör det själva.
 *
 * Kastar utanför `OpsAppShell` och när skalet saknar `handelsepanel`: en knapp som inte öppnar något är värre än ett fel.
 *
 * @returns {(id: string) => void}
 */
export function useOppnaHandelse() {
  const oppna = useContext(OppnaHandelseKontext);
  if (!oppna) throw new Error("useOppnaHandelse() används utanför OpsAppShell, eller i ett skal utan `handelsepanel`: hooken behöver skalet och dess panel.");
  return oppna;
}

/**
 * @param {object} props
 * @param {import("react").ReactNode} [props.brand] Märket (0.31.0: TEXT, inga bilder). En sträng blir märkets `namn` (rad 1, förval "OPS HUB", första ordet ljusgrått och resten gråorange); en egen `<OpsBrand namn undertext monogram />` används som den är, med panelläget inklonat. Rad 2 är den aktiva gruppens namn när `grupper` finns och en grupp är vald, annars `undertext` på appens egen `OpsBrand`. Länkar till startsidan. ⛔ Före 0.31.0 var `brand` appens namn och ritades under en bild; nu är den märket självt, så en app som vill ha "OPS HUB" utelämnar propen.
 * @param {import("../lib/nav.js").NavPost[]} [props.nav] Toppdestinationer, den GAMLA modellen. `{ href, label }` räcker; `icon`, `badge` och `children` (en nivå) är valfria tillägg. ⛔ Krävs när `fasta` saknas, och FÅR INTE skickas tillsammans med `fasta` (två modeller för samma rad är två sanningar, skalet kastar).
 * @param {import("./fasta.jsx").FastaKonfiguration} [props.fasta] (0.30.0, #173) NYA modellen: de tre fasta posterna
 *   `{ idag: { href }, kalender: { href }, hub: { href } }`. Ramverket äger ordning (Idag, Kalender, Hub), namn
 *   (sv och en) och ikoner; appen säger bara vart var och en leder. Toppraden visar de tre (Hub som en post med
 *   chevron-dropdown över modulerna), bottenraden visar Idag, Kalender, ETT STORT PLUS, Hub, Meny.
 * @param {import("../lib/nav.js").NavPost[]} [props.moduler] (0.30.0) Appens moduler, samma form som `nav` (en nivå
 *   barn). ⛔ De visas i Hub och ALDRIG i menyn, och kräver `fasta`. Se `OpsHub` för kortrutnätet.
 * @param {string} [props.sprak] Språket för de fasta namnen och menyns appsektion ("sv" eller "en"). Förval "sv".
 * @param {string} props.activeHref Vilken sida som visas nu.
 * @param {(href: string, event: any) => void} [props.onNavigate] Anropas i stället för webbläsarens navigering.
 * @param {import("react").ReactNode} [props.actions] Temaväxlare, konto, sök. Ligger till höger.
 * @param {import("react").ReactNode} [props.anvandare] Identiteten, ENSAM: `<OpsIconLink icon={<OpsIdentity .../>} label="Min profil" href={profilHref} />`,
 *   direktlänken till profilen. ⛔ EGET FACK OCH INTE EN `action` (#138): klarkriteriet säger "samma plats i varje app", och en fri slot hamnar till
 *   vänster i en app och i en hamburgare i nästa. Ligger sist i klustret, efter `actions` och före hamburgaren, alltid.
 *   ⛔ #164, ANDRA GRANSKNINGEN: MENYN LIGGER INTE HÄR LÄNGRE. SessionStudios
 *   avatar har ingen meny, den är en direktlänk till profilen, och menyn är
 *   skalets EGEN hamburgare (se `meny`-propen nedan), inte en andra Popover
 *   bredvid avataren i det här facket. Se README §Skalet för exemplet.
 * @param {{ label: string, onClick: () => void, icon?: import("react").ReactNode }} [props.primaryAction] Det man GÖR i appen, inte går till. Blir en rund knapp mitt i bottenraden på telefon. ⛔ På bred skärm finns ingen bottenrad, så appen sätter samma åtgärd i `actions` själv: skalet gissar inte var en knapp hör hemma i en toppradslayout det inte äger.
 * @param {string} [props.menuLabel] Text på Meny-platsen i bottenraden.
 * @param {string} [props.navLabel] Skärmläsarnamn på toppradens navigering.
 * @param {string} [props.submenuLabel] Verb för chevronens namn på en post med undermeny,
 *   följt av postens etikett: "Visa sidorna under Ekonomi".
 * @param {number} [props.maxTopNav] Hur många destinationer som får plats i toppraden på bred skärm (1024 och uppåt). Resten hamnar i hamburgarmenyn.
 * @param {number} [props.maxTopNavSmal] Hur många som får plats mellan 768 och 1024. Mätt: fler än tre ger horisontell scroll på en iPad i stående läge.
 * @param {string} [props.moreLabel] Namn på överflödesmenyn (aria/nav). Knappen visar en hamburgare, inte text.
 * @param {string} [props.badgeText] Skärmläsarord efter siffran i en räknare, t.ex. "olästa". Appen bestämmer vad den räknar.
 * @param {string} [props.bottomNavLabel] Skärmläsarnamn på bottenraden. ⛔ Eget
 *   namn med flit, INTE samma som `navLabel`: se OpsBottomNav för varför två
 *   navigeringar med samma namn gör app-tester tvetydiga.
 * @param {import("react").ReactNode} [props.menuExtras] Extra rader/kontroller i
 *   Mer-menyn (header-hamburgare och botten-Meny). Typiskt tema och helskärm, så
 *   åtgärdsklustret i headern kan hållas till primära ikoner.
 * @param {OpsAppShellGrupper} [props.grupper] Grupp-panelen (#161), SessionStudios arbetsytor. Utelämnad: ingen kolumn, ingen
 *   växlare, skalet oförändrat. `lista` ([`GruppanelGrupp`](./OpsGruppanel.jsx), samma form `OpsGruppanel` tar),
 *   `aktiv` (den aktiva gruppens id, ur `aktivGrupp`), `onValj` (krävs), `onSkapa` (utelämnad: ingen "Skapa grupp"-knapp),
 *   `infalld`/`onInfalld` (styr BÅDE panelens läge och brandets ikon/ordmärke-val, se noten vid `varumarke`
 *   nedan; utelämnade: panelen sköter läget själv och brandet följer bara skärmbredden som förut), `sprak`, samt
 *   `listEtikett`/`ingenGruppEtikett`/`skapaEtikett`/`tomText`/`rollNamn`/`medlemmarEtikett`/`flerAvatarerEtikett`/`etikett`
 *   (samma namn och förval som på `OpsGruppanel`/`OpsGruppvaxlare` direkt). Från 1024 px (`lg`) ritas
 *   `OpsGruppanel` som en vänsterkolumn. Under 1024 px ritas ingen kolumn: i stället en `OpsGruppvaxlare`-knapp i
 *   headern, som öppnar samma lista i `OpsPanel`s ark/rullgardin (se den komponentens filhuvud för brytpunkten).
 * @param {import("./OpsMeny.jsx").MenyKonfiguration} [props.meny] Appens EGEN meny (#164, andra granskningen):
 *   notiser, aktivitet, appens egna destinationer, utloggning, versionen (`sektioner`, `onLoggaUt` krävt,
 *   `appVersion`, `rubrik` förval "Meny", `loggaUtEtikett` förval "Logga ut"). Ritas i SKALETS EGEN
 *   hamburgare, samma knapp som navigeringens överflöd, inte en andra hamburgare bredvid avataren.
 *   Given: hamburgaren ritas ALLTID (inte bara vid överflöd), och innehållet kommer i den här
 *   ordningen: `meny.sektioner` (appens rader, typiskt [Notiser, Aktivitet] först), sedan
 *   navigeringens överflödsrader i en egen sektion, sedan `menuExtras`, sedan Logga ut, sist två
 *   versionsrader (appens, ramverkets). Utan `meny` fungerar skalet som förut: bara överflöd och
 *   `menuExtras`, ingen hamburgare om inget av dem finns. Botten-Mer-arket ritar samma innehåll,
 *   se `OpsBottomNav`.
 * @param {import("../lib/felrapport.js").Felmottagare} [props.felmottagare] (#159) Kallas från felgränsen när en vy
 *   kastar. Utan den skrivs felet ändå till konsolen, se `rapporteraFel`: felgränsen går inte att stänga av.
 * @param {string} [props.felRubrik] Rubriken på felytan.
 * @param {string} [props.felBeskrivning]
 * @param {string} [props.laddaOmEtikett]
 * @param {HandelsepanelKonfiguration} [props.handelsepanel] (0.40.0, #214) Händelsen på en egen sida med Tillbaka, öppnad av en rad i Idag eller en post i kalendern (`handelseId`) eller av `useOppnaHandelse()`. Se `HandelsepanelKonfiguration`.
 * @param {SkapaKonfiguration} [props.skapa] (#168) Plusset i toppraden, mellan `actions` och `anvandare`.
 *   Tryck öppnar en POPOVER med en platt lista (`ss-skapa-meny.png`), aldrig en yta i sidan: `handelse`
 *   och `arende` är ramverkets EGNA rader (Idag/kalendern och Inkorgen är ramverkets vyer, inte moduler),
 *   `registreringar`/`lage`/`kataloger`/`ikonRitare`/`sprak` är samma kontrakt som `OpsSkapa` redan hade
 *   (#150/#153). En rad öppnar en RIKTIG `OpsModal` (stängbar med X, Escape, klick utanför), aldrig en andra
 *   vy inuti popovern: 0.27.0:s inbyggda typval+formulär+"Tillbaka" i `OpsSkapa` själv är borttaget (#168),
 *   det flyttade hit. ⛔ `handelse`/`arende` ÄR FÄRDIGA `ReactNode`: skalet vet inget om deras fält och kan
 *   därför inte stänga modalen åt dem när de sparat, bara via X/Escape/klick-utanför (modalens egna vägar).
 *   En modul-registrerings formulär får `{ groupId, typ, onKlar }` som förut, och `onKlar` stänger modalen.
 *   Utan `skapa`, eller utan NÅGOT den kan visa (inga `handelse`/`arende` OCH modulerna i `ingenGrupp`/`tomt`-
 *   läge), ritas inget plus alls (tomhet är ett svar, arbetsreglernas punkt 5).
 * @param {string} [props.skapaLabel] Skärmläsarnamn på plusknappen.
 * @param {string} [props.closeLabel] Skärmläsarnamn på stängknappen i bottenradens skapa-ark (bara med `fasta`).
 * @param {string} [props.nyHandelseEtikett] Ramverkets rad för `skapa.handelse`.
 * @param {string} [props.nyttArendeEtikett] Ramverkets rad för `skapa.arende`.
 * @param {string} [props.redigeraGruppEtikett] Panelens rubrik för `skapa.redigeraGrupp`. Förval "Redigera grupp".
 * @param {string} [props.nyGruppEtikett] Ramverkets rad för `skapa.grupp`, och panelens rubrik. Förval "Ny grupp".
 * @param {string} [props.nyttMeddelandeEtikett] (0.34.0) Ramverkets rad för `skapa.meddelande`, och panelens rubrik. Förval "Nytt meddelande".
 * @param {string} [props.skickaEtikett] (0.34.0) Panelens knapp för `skapa.meddelande`. Förval "Skicka".
 * @param {string} [props.skapaTypEtikett] Etikett på typväljaren i en modul-registrerings modal.
 * @param {import("react").ReactNode} props.children
 */
export function OpsAppShell({
  brand,
  nav,
  fasta,
  moduler,
  sprak = "sv",
  activeHref,
  onNavigate,
  actions,
  anvandare,
  primaryAction,
  menuLabel = "Meny",
  navLabel = "Huvudnavigering",
  submenuLabel = "Visa sidorna under",
  // ⛔ Fem, inte "så många som får plats". En mätning av tillgänglig bredd vid
  // varje rendering ger hopp när typsnittet laddar och gör ordningen beroende av
  // fönstret. Ett fast tak är förutsägbart, och appen styr vilka fem genom sin
  // ordning.
  maxTopNav = 5,
  maxTopNavSmal,
  moreLabel = "Meny",
  badgeText = "nya",
  bottomNavLabel = "Snabbnavigering",
  menuExtras,
  grupper,
  meny,
  skapa,
  handelsepanel,
  skapaLabel = "Skapa",
  nyHandelseEtikett = "Ny händelse",
  nyttArendeEtikett = "Nytt ärende",
  nyGruppEtikett = "Ny grupp",
  nyttMeddelandeEtikett = "Nytt meddelande",
  skickaEtikett = "Skicka",
  redigeraGruppEtikett = "Redigera grupp",
  skapaTypEtikett = "Typ",
  closeLabel = "Stäng",
  felmottagare,
  felRubrik = "Något gick fel",
  felBeskrivning = "Sidan gick sönder. Ladda om för att försöka igen.",
  laddaOmEtikett = "Ladda om",
  children,
}) {
  // ══ ⛔ TVÅ MODELLER, ALDRIG BÅDA (0.30.0, #173) ══════════════════════════
  //
  // `fasta` är den nya modellen (Idag, Kalender, Hub plus moduler i Hub), `nav`
  // den gamla (en fri lista). En app som skickar BÅDA har inte bestämt sig, och
  // skalet skulle behöva gissa vilken som gäller: den ena skulle tyst tystas.
  // Samma skäl som `maxTopNavSmal`s kast nedan, och som punkt 5 i arbetsreglerna:
  // en tyst nedsläppsväg är värre än ett fel.
  const harFasta = fasta !== undefined;
  if (harFasta) {
    validateFasta(fasta, "OpsAppShell");
    if (Array.isArray(nav) && nav.length > 0) {
      throw new Error(
        "OpsAppShell: både \"fasta\" och \"nav\" är skickade. De är två modeller för samma rad: med fasta är toppraden Idag, Kalender, Hub och appens övriga sidor är MODULER (\"moduler\"), som bor i Hub. Skicka moduler i stället för nav.",
      );
    }
    if (primaryAction) {
      throw new Error(
        "OpsAppShell: \"primaryAction\" tillsammans med \"fasta\". Med fasta äger skalet plusset i mitten av bottenraden och det öppnar samma skapa-meny som plusset i huvudet (\"skapa\"). Ta bort primaryAction.",
      );
    }
  } else {
    validateNav(nav, "OpsAppShell");
    if (moduler !== undefined) {
      throw new Error("OpsAppShell: \"moduler\" utan \"fasta\". Moduler visas i Hub, och Hub finns bara i den nya modellen. Skicka fasta, eller behåll nav.");
    }
  }
  const fastaPoster = harFasta ? byggFasta(fasta, moduler ?? [], sprak) : [];
  const navLista = harFasta ? fastaPoster : /** @type {import("../lib/nav.js").NavPost[]} */ (nav);
  // ⛔ Kastar hellre än att rendera en rad som tyst tappar destinationer:
  // vore taket på smal skärm högre skulle poster mellan talen ligga i raden på
  // smal skärm och ingenstans alls på bred.
  if (maxTopNavSmal !== undefined && maxTopNavSmal > maxTopNav) {
    throw new Error(
      `OpsAppShell: maxTopNavSmal (${maxTopNavSmal}) kan inte vara större än maxTopNav (${maxTopNav}). Den smala skärmen visar aldrig fler än den breda.`,
    );
  }
  // ⛔ SAMMA VALIDERING SOM DEN GAMLA `OpsMeny` HADE, FLYTTAD HIT (#164, andra
  // granskningen). Menyn är nu en av skalets egna ytor, så dess krav på
  // `onLoggaUt` och på att varje rad har `key`+`etikett` hör hemma här, inte
  // i en separat komponent en app kunde glömma att validera mot.
  if (meny) validateMeny(meny, "OpsAppShell");
  // Standardvärdet HÄRLEDS och står inte i signaturen. En app som säger
  // `maxTopNav={2}` har sagt allt som behövs, och ska inte behöva känna till
  // ett andra tal för att slippa ett undantag.
  // ⛔ MED `fasta` FINNS INGET TAK: tre poster får alltid plats (Hub bär resten).
  const smaltTak = harFasta ? 3 : (maxTopNavSmal ?? Math.min(3, maxTopNav));
  const [merOppen, setMerOppen] = useState(false);
  // ⛔ #166: VILKEN RADS `undervy` SOM VISAS I STÄLLET FÖR ROTEN, ELLER `null`
  // (roten). En chevron-rad med `undervy` (t.ex. Aktivitet) byter INTE till en
  // egen Popover: den byter INNEHÅLLET i den här, redan öppna, popovern. Se
  // filhuvudets ärende och `MenySektioner`/`visaUndervy` i OpsMeny.jsx.
  //
  // ⛔ NYCKELN LAGRAS, ALDRIG RADEN (0.29.0, mätt i bolag-ops ompinning till
  // 0.28.0). Första versionen sparade hela `MenyRad`-objektet i state, alltså
  // även `undervy`-noden som den såg ut vid klicket. Appens efterföljande
  // renders skickade nya `undervy`-noder (en OpsSwitch bunden till appens
  // state), men panelen ritade den frysta kopian: knappen såg ut att inte
  // reagera förrän menyn stängdes och öppnades igen. Appen valde att ta bort
  // filtret hellre än att visa en knapp som ljuger. Nu lagras radens `key`,
  // och raden slås upp ur `meny.sektioner` VID VARJE RENDER, så undervyn är
  // alltid den appen just skickade in.
  const [aktivUndervyKey, setAktivUndervyKey] = useState(/** @type {string | null} */ (null));
  const aktivUndervy = aktivUndervyKey
    ? ((meny?.sektioner ?? []).flat().find((rad) => rad.key === aktivUndervyKey && rad.undervy) ?? null)
    : null;
  const setAktivUndervy = (/** @type {import("./OpsMeny.jsx").MenyRad | null} */ rad) => setAktivUndervyKey(rad ? rad.key : null);
  // ⛔ MENYN STÄNGS: UNDERVYN NOLLSTÄLLS MED (#166). Annars visar nästa
  // öppning listan man råkade lämna i stället för menyns rot, se filhuvudets
  // "stängs menyn nollställs undervyn".
  const stangMenyn = (/** @type {boolean} */ nasta) => {
    setMerOppen(nasta);
    if (!nasta) setAktivUndervyKey(null);
  };
  // ⛔ Samma "stäng innan appens onClick körs"-mekanik som gamla `OpsMeny` hade,
  // nu delad med `OpsBottomNav` via `kordarePafunktion`. Se dess filhuvud.
  const kor = kordarePafunktion(() => stangMenyn(false));

  // ══ ⛔ #168: PLUSSET. POPOVERN ÄR SKALETS, MODALEN ÄR SKALETS. ═══════════
  //
  // `skapaOppen` styr popovern under plusknappen (listan). `skapaForm` styr
  // den RIKTIGA modalen som öppnas när en rad väljs: `null` (stängd), eller
  // en liten BESKRIVNING av vad modalen ska visa (aldrig ett färdigrenderat
  // ReactNode i state, se `skapaTyp` nedan för skälet).
  const [skapaOppen, setSkapaOppen] = useState(false);
  const [skapaForm, setSkapaFormRaw] = useState(
    /** @type {{ kind: "handelse" | "arende" | "grupp" | "meddelande" } | { kind: "redigeragrupp", groupId: string } | { kind: "modul", registrering: any, datum?: string | null } | null} */ (null),
  );
  // ⛔ VALD TYP PER REGISTRERING, INTE INUTI `skapaForm`. Ett värde sparat i
  // `skapaForm` vid öppningstillfället är fruset: `OpsSelect`s `onChange`
  // hade behövt skriva om ett redan monterat ReactNode i state, vilket inte
  // går. Typen läses i stället ur `skapaTyp` VARJE RENDERING, se nedan.
  const [skapaTyp, setSkapaTyp] = useState(/** @type {Record<string, string>} */ ({}));
  // ══ ⛔ SKAPA ÄR EN PANEL, INTE EN MODAL (0.31.0, CP 2026-09-29) ═══════════════════
  //
  // "Låt det vara paneler istället för modaler precis som i sessionstudio." Se `OpsSkapaPanel`. `skapaMal` är det valda
  // MÅLET (en grupp eller en app-sektions post) ur `OpsSkapaI`; `skapaVaxlare` öppnar väljaren igen från raden "Skapas i".
  const [skapaMal, setSkapaMal] = useState(/** @type {{ id: string, sektion: string } | null} */ (null));
  const [skapaVaxlare, setSkapaVaxlare] = useState(false);
  // ⛔ 0.37.0 (#179 F3): "Kräv svar" och "Blockerar tillgänglighet" är AV från början, varje gång panelen öppnas.
  const [skapaKravSvar, setSkapaKravSvar] = useState(false);
  const [skapaBlockerar, setSkapaBlockerar] = useState(false);
  const skapaAdress = skapa?.adress !== false;
  const skapaPushad = useRef(false);
  const skapaRullning = useRef(0);
  /** @param {any} form @returns {string} */
  const skapaNyckel = (form) => (form.kind === "modul" ? String(form.registrering.id) : form.kind === "redigeragrupp" ? "redigera-grupp" : form.kind);
  /** Återskapar ett formulär ur adressens `?skapa=`, eller `null`. */
  const skapaUrAdress = () => {
    if (!skapaAdress || typeof window === "undefined" || !skapa) return null;
    const u = new URL(window.location.href);
    const v = u.searchParams.get("skapa");
    if (!v) return null;
    // ⛔ Redigera grupp bär gruppens id i adressen (`&grupp=`), annars går panelen inte att länka till eller ladda om.
    // ⛔ 0.37.0 (#206): "Ny händelse" bär dagen (`&datum=`) på samma sätt. Ett datum som inte finns i adressen (handskrivet,
    // eller trasigt) öppnar formuläret utan dag, och det rapporteras: panelen ska inte vägra öppna för en adress, men felet
    // ska inte heller försvinna tyst.
    const dag = u.searchParams.get("datum");
    const datum = dag && giltigtDatum(dag) ? dag : null;
    if (dag && !datum) rapporteraFel(new Error(`skapa: datum "${dag}" i adressen finns inte, formuläret öppnas utan dag.`), { yta: "OpsAppShell", steg: "läsa datum ur adressen" });
    return skapaFormFranNyckel(skapa, v, { groupId: u.searchParams.get("grupp"), nyHandelseEtikett, datum });
  };
  const skapaFormId = useId();
  /** @param {any} form */
  const oppnaSkapa = (form) => {
    if (typeof window !== "undefined") skapaRullning.current = window.scrollY;
    setSkapaMal(null);
    setSkapaVaxlare(false);
    setSkapaKravSvar(false);
    setSkapaBlockerar(false);
    setSkapaFormRaw(form);
    if (skapaAdress && typeof window !== "undefined") {
      try {
        const u = new URL(window.location.href);
        u.searchParams.set("skapa", skapaNyckel(form));
        if (form.kind === "redigeragrupp") u.searchParams.set("grupp", form.groupId);
        if (form.datum) u.searchParams.set("datum", form.datum);
        else u.searchParams.delete("datum");
        window.history.pushState(window.history.state, "", u);
        skapaPushad.current = true;
      } catch {
        // En adress som inte går att skriva (t.ex. en sandlåda) gör inte panelen sämre: den är ändå ett tillstånd.
      }
    }
  };
  /**
   * @param {boolean} [klar] Sant när formuläret är KLART (en grupp skapades): stäng utan att gå bakåt. `history.back()` är asynkron,
   *   och appen navigerar (pushState) direkt efter `onSkapad`. Ett sent back skulle då landa på panelens egen post (`?skapa=grupp`) och
   *   ångra appens navigering. Posten skrivs i stället om utan parametern.
   * @param {boolean} [aterstallRullning] Förval sant: Tillbaka återställer rullpositionen man kom från. Falskt när panelen stängs
   *   av att man navigerar till en ANNAN vy (0.38.0, #194): den vyn ska börja överst, inte där den förra stod.
   */
  const stangSkapa = (klar = false, aterstallRullning = true) => {
    setSkapaFormRaw(null);
    setSkapaMal(null);
    setSkapaVaxlare(false);
    if (skapaAdress && typeof window !== "undefined") {
      const u = new URL(window.location.href);
      if (u.searchParams.has("skapa")) {
        if (skapaPushad.current && klar !== true) {
          skapaPushad.current = false;
          window.history.back();
        } else {
          skapaPushad.current = false;
          u.searchParams.delete("skapa");
          u.searchParams.delete("grupp");
          u.searchParams.delete("datum");
          window.history.replaceState(window.history.state, "", u);
        }
      }
    }
    // Tillbaka återställer vyn man kom från, också rullpositionen.
    if (aterstallRullning && typeof window !== "undefined" && skapaRullning.current > 0) {
      const y = skapaRullning.current;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  };
  // ══ ⛔ HÄNDELSEPANELEN: `?handelse=<id>`, SAMMA MEKANIK SOM SKAPA-PANELEN (0.40.0, #214) ═════════════════════════════════════
  //
  // CP 2026-10-01: "Vi behöver en händelsepanel. Så man navigerar dit från kalender och från idag. Händelsepanelen skall ha en tillbaka
  // knapp." Se `HandelsepanelKonfiguration`. Tre beslut, alla mätta mot hur skapa-panelen redan beter sig:
  //
  //   1. ADRESSEN BÄR ID:T (`?handelse=`), på sidan man står på, och `pushState` ger Tillbaka i webbläsaren ett steg att gå. Tillbaka-knappen
  //      går samma väg (`history.back()`) när skalet själv pushade posten, så knappen och webbläsarens bakåt är SAMMA gest. Kom man in
  //      på en adress (omladdning, en länk) finns inget steg att gå tillbaka till: då skrivs posten om utan parametern (`replaceState`)
  //      och man står kvar på sidan under.
  //   2. APPENS VY ÄR KVAR, DOLD. Det är därför kalenderns månad och valda dagar, Idags flik och filter finns kvar när man kommer
  //      tillbaka. Rullningen är fönstrets, och den sparas vid öppning och återställs vid Tillbaka (som skapa).
  //   3. WEBBLÄSARENS BAKÅT OCH FRAMÅT STYR PANELEN åt båda hållen (`popstate`): att gå bakåt stänger den, att gå framåt öppnar den igen.
  //      Skapa-panelen lyssnar bara på stängningen, eftersom den inte går att öppna utan ett val; här räcker adressen.
  const handelseAdress = handelsepanel?.adress !== false;
  const [handelseId, setHandelseId] = useState(() => /** @type {string | null} */ (handelseAdress && typeof window !== "undefined" ? handelseIdUrAdress(window.location.href) : null));
  const handelsePushad = useRef(false);
  const handelseRullning = useRef(0);
  // ⛔ Elementet som hade fokus när panelen öppnades (länken man tryckte på): Tillbaka ger fokus tillbaka dit, så att tangentbordet och skärmläsaren
  // fortsätter där de var i stället för från sidans topp.
  const handelseFokus = useRef(/** @type {HTMLElement | null} */ (null));
  /** @param {string} id */
  const oppnaHandelse = (id) => {
    if (typeof id !== "string" || id === "") throw new Error("useOppnaHandelse: id krävs, en sträng som inte är tom.");
    if (!handelsepanel) throw new Error("useOppnaHandelse: skalet saknar `handelsepanel`, så det finns ingen panel att öppna.");
    // Ett öppet skapa-formulär hör till vyn man lämnar: det stängs utan att röra historiken, som när man navigerar bort från det.
    if (skapaForm) setSkapaFormRaw(null);
    if (handelseId === null && typeof window !== "undefined") {
      handelseRullning.current = window.scrollY;
      handelseFokus.current = /** @type {HTMLElement | null} */ (document.activeElement);
    }
    const redanOppen = handelseId !== null;
    setHandelseId(id);
    if (handelseAdress && typeof window !== "undefined") {
      try {
        const till = medHandelse(window.location.href, id);
        // Byter man händelse medan panelen är öppen ersätts posten: två paneler i historiken hade krävt två Tillbaka för att nå sidan.
        if (redanOppen) window.history.replaceState(window.history.state, "", till);
        else {
          window.history.pushState(window.history.state, "", till);
          handelsePushad.current = true;
        }
      } catch {
        // En adress som inte går att skriva (t.ex. en sandlåda) gör inte panelen sämre: den är ändå ett tillstånd.
      }
    }
  };
  /**
   * @param {boolean} [klar] Sant när panelen stängs för att man LÄMNAR vyn (en länk i skalet, en ny `activeHref`): posten skrivs om utan
   *   parametern, ingen `history.back()` (appen pushar sin egen post direkt efter, och ett sent back skulle ångra den).
   * @param {boolean} [aterstallRullning] Förval sant: Tillbaka återställer rullpositionen man kom från. Falskt när man navigerar till en
   *   ANNAN vy: den ska börja överst.
   */
  const stangHandelse = (klar = false, aterstallRullning = true) => {
    setHandelseId(null);
    if (handelseAdress && typeof window !== "undefined") {
      const u = new URL(window.location.href);
      if (u.searchParams.has(HANDELSEPARAM)) {
        if (handelsePushad.current && klar !== true) {
          handelsePushad.current = false;
          window.history.back();
        } else {
          handelsePushad.current = false;
          window.history.replaceState(window.history.state, "", medHandelse(window.location.href, null));
        }
      }
    }
    if (aterstallRullning && typeof window !== "undefined" && handelseRullning.current > 0) {
      const y = handelseRullning.current;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  };
  // Webbläsarens bakåt och framåt: adressen är sanningen, panelen följer den.
  useEffect(() => {
    if (!handelseAdress || typeof window === "undefined") return undefined;
    const lyssna = () => {
      const id = handelseIdUrAdress(window.location.href);
      if (id === null) handelsePushad.current = false;
      setHandelseId(id);
    };
    window.addEventListener("popstate", lyssna);
    return () => window.removeEventListener("popstate", lyssna);
  }, [handelseAdress]);
  // En ny panel börjar överst: appens vy var dold och dess rullning är inte panelens.
  useEffect(() => {
    if (handelseId !== null && typeof window !== "undefined" && window.scrollY > 0) window.scrollTo(0, 0);
    // Panelen stängdes: fokus tillbaka till det som hade det. Ett element som inte längre finns (vyn ritades om) eller som är dolt tar inte emot det.
    if (handelseId === null && handelseFokus.current) {
      const el = handelseFokus.current;
      handelseFokus.current = null;
      if (el.isConnected) el.focus({ preventScroll: true });
    }
  }, [handelseId]);

  // ══ ⛔ ATT NAVIGERA STÄNGER PANELEN (0.38.0, #194) ═════════════════════════════════════════════════════════════════════
  //
  // CP 2026-09-30: "Nytt ärende-panelen låser all annan navigering i appen. Samma sak med Ny händelse. Topnav (Idag/Kalender/Hub)
  // och övrigt går inte att använda medan panelen är uppe." Panelen är ingen dialog och ingenting är `inert`: länkarna gick att
  // klicka och appen navigerade. Men skalet höll `skapaForm` kvar, och appens vy ligger DOLD medan panelen visas, så adressen
  // bytte sida och skärmen stod still. Panelen hör till sidan man öppnade den på. Två vägar stänger den, och båda behövs:
  //   1. Ett klick på en länk skalet själv äger (flikarna, märket, menyns rader, hubbens moduler): `onActivate`. Det är den enda
  //      vägen när man klickar på sidan man redan står på, där `activeHref` inte ändras.
  //   2. Att appens `activeHref` byts medan panelen är öppen: täcker länkarna skalet inte hör (en ikon i `actions`, avataren)
  //      och webbläsarens egen navigering.
  // Stängningen är `stangSkapa(true, false)`: posten i adressen skrivs om UTAN `skapa` (ingen `history.back()`, appen pushar sin
  // egen post direkt efter) och rullpositionen återställs inte, eftersom den nya vyn ska börja överst.
  const foregaendeAktivHref = useRef(activeHref);
  useEffect(() => {
    if (foregaendeAktivHref.current === activeHref) return;
    foregaendeAktivHref.current = activeHref;
    if (skapaForm) stangSkapa(true, false);
    // ⛔ 0.40.0 (#214): händelsepanelen hör också till sidan man öppnade den på.
    if (handelseId !== null) stangHandelse(true, false);
    // `skapaForm` läses vid själva bytet; det är bytet av `activeHref` som är utlösaren, inte formuläret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHref]);

  // Adressen öppnar panelen vid inläsning, och webbläsarens Tillbaka stänger den.
  useEffect(() => {
    const fran = skapaUrAdress();
    if (fran) setSkapaFormRaw(/** @type {any} */ (fran));
    if (typeof window === "undefined") return undefined;
    const lyssna = () => {
      const finns = new URL(window.location.href).searchParams.has("skapa");
      if (!finns) {
        skapaPushad.current = false;
        setSkapaFormRaw(null);
        setSkapaMal(null);
        setSkapaVaxlare(false);
      }
    };
    window.addEventListener("popstate", lyssna);
    return () => window.removeEventListener("popstate", lyssna);
    // Bara vid montering: adressen är en ingång, inte något som ska skriva över ett pågående val.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ⛔ 0.34.1: EN POST SOM KOMMER SENT. Appen skickar in t.ex. `skapa.meddelande` först när samtalskällan finns (efter inloggning och
  // gruppval), alltså efter monteringen. Effekten ovan hann då inte se den och `?skapa=` ignorerades för alltid. Här härleds en sträng
  // av vilka nycklar som finns; när den ändras öppnas panelen om adressen bär en `?skapa=` ingen panel är öppen för. Öppnar bara om
  // inget formulär redan är öppet, och en stängd panel tar bort parametern ur adressen, så den kommer inte tillbaka. Ingen polling.
  const skapaNycklar = skapa
    ? [skapa.handelse ? "handelse" : "", skapa.arende ? "arende" : "", skapa.grupp ? "grupp" : "", typeof skapa.meddelande === "function" ? "meddelande" : "", typeof skapa.redigeraGrupp === "function" ? "redigera-grupp" : "", ...(skapa.registreringar ?? []).map((/** @type {any} */ r) => r.id)].join("|")
    : "";
  useEffect(() => {
    const fran = skapaUrAdress();
    if (fran) setSkapaFormRaw((/** @type {any} */ nu) => nu ?? fran);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skapaNycklar]);

  /** @type {(nyckel: string, extra?: { groupId?: string, datum?: string }) => void} */
  const oppnaFranApp = (nyckel, extra) => {
    const datum = extra?.datum;
    if (datum !== undefined && datum !== null) {
      // ⛔ KASTAR I STÄLLET FÖR ATT TYST ÖPPNA UTAN DAG. Ett datum från appen är ett programvärde, och ett som inte finns är
      // ett fel i appen, inte något användaren kan rätta.
      if (nyckel !== "handelse") throw new Error(`useOppnaSkapa: datum gäller bara "handelse", inte "${nyckel}".`);
      if (typeof datum !== "string" || !giltigtDatum(datum)) throw new Error(`useOppnaSkapa: datum "${String(datum)}" finns inte. Formen är YYYY-MM-DD.`);
      if (!handelseSkapareFinns(skapa)) throw new Error("useOppnaSkapa: datum kräver att skapa.handelse är ett formulär ({ form }), inte en färdig nod som inte kan ta emot dagen.");
    }
    const form = skapaFormFranNyckel(skapa, nyckel, { groupId: extra?.groupId, nyHandelseEtikett, datum: datum ?? null });
    if (!form) throw new Error(`useOppnaSkapa: skalets \`skapa\` har ingen post för "${nyckel}"${nyckel === "redigera-grupp" ? " med groupId" : ""}.`);
    oppnaSkapa(form);
  };

  const skapaLaget = skapa ? skapalaget({ lage: skapa.lage ?? null, registreringar: skapa.registreringar ?? [] }) : null;
  const skapaModulerRedo = skapaLaget?.tillstand === "redo";
  const harRamverksrader = Boolean(skapa?.handelse) || Boolean(skapa?.arende) || typeof skapa?.grupp === "function" || typeof skapa?.meddelande === "function";
  // ⛔ TOMHET ÄR ETT SVAR: INGET PLUS ALLS NÄR DET INTE FINNS NÅGOT ATT VISA.
  // En knapp som öppnar en tom popover är sämre än ingen knapp, den lär den
  // som trycker att plusset i den här appen inte gör något.
  const visaSkapaKnapp = Boolean(skapa) && (harRamverksrader || skapaModulerRedo);
  // ⛔ EN VÄG ATT SKAPA EN GRUPP (0.32.0, #180): finns `skapa.grupp` öppnar "Skapa grupp" i panelen och plusset SAMMA
  // formulär, och appens `grupper.onSkapa` används inte. Utan `skapa.grupp` är `grupper.onSkapa` som förut.
  const grupperOnRedigera = typeof skapa?.redigeraGrupp === "function" ? (/** @type {string} */ id) => oppnaSkapa({ kind: "redigeragrupp", groupId: id }) : grupper?.onRedigera;
  const grupperOnSkapa = typeof skapa?.grupp === "function" ? () => oppnaSkapa({ kind: "grupp" }) : grupper?.onSkapa;

  // ⛔ ETT FORMULÄR MED TYP (0.30.0), INTE ETT FÄRDIGT NOD: se `HandelseSkapare`.
  // En React-nod har `$$typeof`; ett `{ form }` har det inte. Skiljer man inte
  // dem åt renderas objektet som barn och React kastar ett kryptiskt fel.
  const handelseSkapare = /** @type {import("react").ComponentProps<any> | null} */ (
    skapa?.handelse && typeof skapa.handelse === "object" && !isValidElement(skapa.handelse) && typeof (/** @type {any} */ (skapa.handelse)).form === "function"
      ? skapa.handelse
      : null
  );

  // ⛔ MÅLET ÄR ALLTID DEN AKTIVA GRUPPEN (0.35.0, #190). CP 2026-09-30: "Ta bort det", om läget "Alla mina grupper". Allt som
  // skapas hamnar i den aktiva gruppen, utan gruppväljare, och väljaren "Skapa i" visar bara appens EGNA mål (`skapaISektioner`,
  // t.ex. "Mina kalendrar"). Den öppnas bara från raden "Skapas i" och bara för en moduls formulär, eftersom bara det tar emot `mal`.
  // Ett meddelande hör till en grupp och har inga andra mål, så det får ingen väljare.
  const skapaGrupperLista = grupper?.lista ?? [];
  const skapaEffektivGrupp = skapaLaget?.grupp ?? null;
  // ══ ⛔ 0.37.0 (#179 F2, F3): "SKAPA I" FÖR EN HÄNDELSE ÄR KALENDRARNA ════════════════════════════════════════════
  //
  // CP 2026-09-30: "man skall kunna välja att skapa en händelse i olika kalendrar". Med `skapa.handelse.kalendrar` är väljarens
  // sektioner den aktiva gruppens kalendrar och "Mina kalendrar", ur `kalenderval` (samma lista som kalenderns filter), och målet
  // från början är gruppens förvalda. Raden överst i formuläret heter då "Kalender".
  const handelseMedKalendrar = skapaForm?.kind === "modul" && skapaForm.registrering?.id === "handelse" && handelseSkapareFinns(skapa) && Boolean(/** @type {any} */ (skapa)?.handelse?.kalendrar);
  const skapaKalenderval = handelseMedKalendrar
    ? kalenderval({ gruppens: /** @type {any} */ (skapa)?.handelse?.kalendrar?.gruppens ?? [], mina: /** @type {any} */ (skapa)?.handelse?.kalendrar?.mina ?? [], sprak: skapa?.sprak ?? "sv" })
    : [];
  const skapaSektioner = handelseMedKalendrar
    ? (() => {
        const g = skapaGrupperLista.find((x) => x.id === skapaEffektivGrupp);
        const ikon = (/** @type {string} */ id) => {
          const I = KALENDERIKON_KOMPONENT[/** @type {keyof typeof KALENDERIKON_KOMPONENT} */ (id)];
          return I ? <I size={18} /> : undefined;
        };
        return [
          { id: "gruppkalendrar", rubrik: g ? `${text(g.namn, skapa?.sprak ?? "sv")}: kalendrar` : "Gruppens kalendrar", poster: skapaKalenderval.filter((k) => k.grupp).map((k) => ({ id: k.id, namn: k.namn, ikon: ikon(k.ikon) })) },
          { id: "minaKalendrar", rubrik: "Mina kalendrar", poster: skapaKalenderval.filter((k) => !k.grupp).map((k) => ({ id: k.id, namn: k.namn, ikon: ikon(k.ikon) })) },
        ];
      })()
    : (skapa?.skapaISektioner ?? []);
  // Målet från början: gruppens förvalda, annars min förvalda. Inget mål alls när det inte finns någon kalender (då säger raden det).
  const skapaStandardMal = (() => {
    if (!handelseMedKalendrar) return null;
    const k = skapaKalenderval.find((x) => x.grupp && x.forvald) || skapaKalenderval.find((x) => !x.grupp && x.forvald) || null;
    return k ? { id: k.id, sektion: k.grupp ? "gruppkalendrar" : "minaKalendrar" } : null;
  })();
  const skapaEffektivtMal = skapaMal ?? skapaStandardMal;
  const skapaKalender = handelseMedKalendrar && skapaEffektivtMal ? { id: skapaEffektivtMal.id, slag: /** @type {"grupp" | "mina"} */ (skapaEffektivtMal.sektion === "minaKalendrar" ? "mina" : "grupp") } : null;
  const skapaHarVaxlare = skapaForm?.kind === "modul" && skapaSektioner.some((x) => x.poster.length > 0);
  const skapaPanelSyns = Boolean(skapaForm);
  // ⛔ 0.40.0 (#214): ett öppet skapa-formulär vinner. Händelsepanelen visas bara när inget formulär är uppe, och saknas `handelsepanel`
  // ritas ingenting för ett id i adressen: appens vy står kvar synlig, hellre än en tom sida.
  const handelsePanelSyns = Boolean(handelseId !== null && handelsepanel) && !skapaPanelSyns;
  const skapaMalNamn = (() => {
    const sprakSkapa = skapa?.sprak ?? "sv";
    if (skapaEffektivtMal) {
      return skapaSektioner.find((x) => x.id === skapaEffektivtMal.sektion)?.poster.find((x) => x.id === skapaEffektivtMal.id)?.namn ?? null;
    }
    // ⛔ Tomhet är ett svar (punkt 5): utan en enda kalender säger raden det, i stället för att visa gruppens namn som om det vore en kalender.
    if (handelseMedKalendrar) return "Ingen kalender ännu";
    const g = skapaGrupperLista.find((x) => x.id === skapaEffektivGrupp);
    return g ? text(g.namn, sprakSkapa) : null;
  })();

  /** @type {string} */
  let skapaModalTitel = "";
  /** @type {import("react").ReactNode} */
  let skapaModalInnehall = null;
  /** Får det som ritas i panelen `formId`? Bara då är panelens Spara en knapp med något att skicka, annars är den död. */
  let skapaHarFormKonsument = false;
  if (skapaForm?.kind === "handelse") {
    skapaModalTitel = nyHandelseEtikett;
    skapaModalInnehall = /** @type {import("react").ReactNode} */ (skapa?.handelse);
  } else if (skapaForm?.kind === "arende") {
    skapaModalTitel = nyttArendeEtikett;
    // ⛔ 0.31.1: `arende` FÅR VARA EN FUNKTION `({ formId, mal }) => nod`, så appen kan ge sitt `<form id={formId}>` och använda
    // panelens gemensamma Spara (`sparaEtikett`). En färdig nod fungerar som förut. En nod har ingen `formId` att ta emot, och
    // därför ritas Spara inte för den (se `skapaHarFormKonsument`): en knapp som pekar på ett id ingen känner är en död knapp.
    skapaModalInnehall = typeof skapa?.arende === "function" ? <ArendeRitare rita={skapa.arende} formId={skapaFormId} mal={skapaMal} /> : skapa?.arende;
    skapaHarFormKonsument = typeof skapa?.arende === "function";
  } else if (skapaForm?.kind === "grupp" && typeof skapa?.grupp === "function") {
    skapaModalTitel = nyGruppEtikett;
    skapaModalInnehall = <GruppRitare rita={skapa.grupp} formId={skapaFormId} onKlar={() => stangSkapa(true)} />;
    skapaHarFormKonsument = true;
  } else if (skapaForm?.kind === "meddelande" && typeof skapa?.meddelande === "function") {
    skapaModalTitel = nyttMeddelandeEtikett;
    skapaModalInnehall = <MeddelandeRitare rita={skapa.meddelande} formId={skapaFormId} groupId={skapaEffektivGrupp} onKlar={() => stangSkapa(true)} />;
    skapaHarFormKonsument = true;
  } else if (skapaForm?.kind === "redigeragrupp" && typeof skapa?.redigeraGrupp === "function") {
    skapaModalTitel = redigeraGruppEtikett;
    skapaModalInnehall = <GruppRitare rita={(a) => /** @type {NonNullable<typeof skapa.redigeraGrupp>} */ (skapa.redigeraGrupp)({ ...a, groupId: /** @type {any} */ (skapaForm).groupId })} formId={skapaFormId} onKlar={() => stangSkapa(true)} />;
    skapaHarFormKonsument = true;
  } else if (skapaForm?.kind === "modul") {
    const r = skapaForm.registrering;
    const typer = typerAttValja(r.katalog, skapa?.kataloger ?? []);
    const skapaSprak = skapa?.sprak ?? "sv";
    // ⛔ 0.37.0: EN POST I EN AV MINA KALENDRAR HAR INGEN TYP (`KALENDERPOSTFALT`), så typvalet ritas inte och `typ` är `null`.
    const egenPost = skapaKalender?.slag === "mina";
    const vald = egenPost ? null : (skapaTyp[r.id] ?? typer[0]?.id ?? null);
    const Form = /** @type {any} */ (r.form);
    skapaHarFormKonsument = true;
    skapaModalTitel = text(r.namn, skapaSprak);
    const kalenderProps = r.id === "handelse" ? { datum: skapaForm.datum ?? null, kalender: skapaKalender, kravSvar: skapaKalender?.slag === "grupp" && skapaKravSvar, blockerar: skapaKalender?.slag === "mina" && skapaBlockerar } : {};
    skapaModalInnehall = (
      <div className="flex flex-col gap-3">
        {r.katalog !== null && !egenPost ? (
          <OpsField label={skapaTypEtikett}>
            <OpsSelect
              ariaLabel={`${skapaTypEtikett}, ${skapaModalTitel}`}
              value={vald ?? ""}
              onChange={(/** @type {string} */ v) => setSkapaTyp((s) => ({ ...s, [r.id]: v }))}
              options={typer.map((k) => ({ value: k.id, label: text(/** @type {any} */ (k).namn, skapaSprak) || k.id }))}
            />
          </OpsField>
        ) : null}
        {/* ⛔ `groupId` KOMMER UR `skapaLaget`, INTE UR `skapa.lage` DIREKT
            (samma skäl som gamla `OpsSkapa`): i "redo"-läget är de samma
            värde, men beslutet om vad "aktiv grupp" betyder ligger på ETT
            ställe. */}
        <Form groupId={skapaEffektivGrupp} typ={vald} mal={skapaEffektivtMal} formId={skapaFormId} {...kalenderProps} onKlar={() => { skapa?.onKlar?.({ registrering: r.id, typ: vald }); stangSkapa(); }} />
        {/* ⛔ 0.37.0 (#179 F3): VALEN SOM HÖR TILL KALENDERN, EFTER APPENS FÄLT. "Kräv svar" bara i en gruppkalender, "Blockerar
            tillgänglighet" bara i en av mina: i en egen kalender finns inga svar, och gruppens händelser blockerar inte någons
            tillgänglighet. "Skicka mejl" visas inte, se `HandelseSkapare.kalendrar`. */}
        {skapaKalender?.slag === "grupp" ? (
          <div data-krav-svar="">
            <OpsSwitch label="Kräv svar" hint="Varje medlem svarar Kommer eller Kommer inte, och frågan står i var och ens inkorg tills de svarat." checked={skapaKravSvar} onChange={setSkapaKravSvar} />
          </div>
        ) : null}
        {skapaKalender?.slag === "mina" ? (
          <div data-blockerar="">
            <OpsSwitch label="Blockerar tillgänglighet" hint="Syns bara för dig. Gruppen ser att du är upptagen, inte vad du gör." checked={skapaBlockerar} onChange={setSkapaBlockerar} />
          </div>
        ) : null}
      </div>
    );
  }

  // ══ ⛔ ETT PLUS PER YTA (0.30.0, #173) ═══════════════════════════════════
  //
  // Med `fasta` har bottenraden ett stort plus i mitten, och det öppnar SAMMA
  // lista som huvudets plus (`renderSkapaLista`, en funktion, inte en kopia).
  // Huvudets plus göms då under `md`: två plus på samma skärm är två ställen
  // att fråga "vad skapar den här", och de skulle glida isär.
  const bottenPlus = harFasta && visaSkapaKnapp;

  // ══ ⛔ ÅTGÄRDER SOM INTE RYMS UNDER `md` FLYTTAR TILL MENYN (0.30.1) ═══════
  //
  // Se `ATGARDER_SMAL`. Bara `OpsIconLink` kan flyttas (href, etikett, ikon och
  // räknare är data ramverket kan rita som en menyrad), och bara när det FINNS en
  // meny att flytta till: utan `meny` har en flyttad åtgärd inget hem, och en
  // åtgärd som försvinner tyst är värre än en som ligger kvar (punkt 5).
  const atgardsLista = plattaAtgarder(actions);
  const flyttbara = meny ? atgardsLista.slice(ATGARDER_SMAL).filter((a) => a.type === OpsIconLink) : [];
  /** @type {import("../lib/nav.js").NavPost[]} */
  const flyttadeRader = flyttbara.map((a) => {
    const p = /** @type {any} */ (a.props);
    return { href: p.href, label: p.label, icon: p.icon, ...(typeof p.badge === "number" ? { badge: p.badge } : {}) };
  });
  const atgarderIHuvud = atgardsLista.map((a, i) =>
    i >= ATGARDER_SMAL && flyttbara.includes(a) ? (
      // ⛔ `contents`, inte `inline-flex`: omslaget får inte bli en egen ruta i klungan.
      <span key={a.key ?? i} className="hidden md:contents">
        {a}
      </span>
    ) : (
      a
    ),
  );
  const [skapaBottenOppen, setSkapaBottenOppen] = useState(false);

  /**
   * Plussets lista: ramverkets rader, en avdelare, modulernas rader. EN
   * definition för header-popovern och bottenradens ark, se ovan.
   * @param {(form: any) => void} oppna Stänger den yta listan ritas i och öppnar modalen. ⛔ Yta och modal i SAMMA tick gick bra för en popover men inte för ett ark: därför äger anropsstället ordningen.
   */
  const renderSkapaLista = (oppna) => (
    <>
      {/* ⛔ RAMVERKETS EGNA RADER FÖRST (#168, CP:s rättelse 23:35): Idag/kalendern
          och Inkorgen är ramverkets vyer, inte moduler, och deras "Ny …"-rader
          hör därför hit, inte till `OpsSkapa`s modul-lista. */}
      {harRamverksrader ? (
        <div className="flex flex-col gap-0.5 px-1">
          {skapa?.handelse ? (
            <OpsPanelRow
              icon={<HandelsePlusIkon size={18} />}
              label={nyHandelseEtikett}
              accent
              onClick={() =>
                oppna(
                  handelseSkapare
                    ? { kind: "modul", registrering: { id: "handelse", namn: nyHandelseEtikett, katalog: handelseSkapare.katalog === undefined ? "handelsetyper" : handelseSkapare.katalog, form: handelseSkapare.form } }
                    : { kind: "handelse" },
                )
              }
            />
          ) : null}
          {skapa?.arende ? (
            <OpsPanelRow
              icon={<ArendePlusIkon size={18} />}
              label={nyttArendeEtikett}
              accent
              onClick={() => oppna({ kind: "arende" })}
            />
          ) : null}
          {/* ⛔ 0.34.0, #182: "Nytt meddelande" efter ärendet och före gruppen. Ett meddelande är en post som ärendet, gruppen är en plats. */}
          {typeof skapa?.meddelande === "function" ? (
            <OpsPanelRow icon={<MeddelandeIkon size={18} />} label={nyttMeddelandeEtikett} accent onClick={() => oppna({ kind: "meddelande" })} />
          ) : null}
          {/* ⛔ 0.32.0, #180: "Ny grupp" EFTER händelse och ärende, som SS plusmeny (`AppHeader.jsx:398-425`: kalender, session, grupp). */}
          {typeof skapa?.grupp === "function" ? (
            <OpsPanelRow icon={<GruppIkon size={18} />} label={nyGruppEtikett} accent onClick={() => oppna({ kind: "grupp" })} />
          ) : null}
        </div>
      ) : null}
      {/* ⛔ EN AVDELARE MELLAN RAMVERKETS RADER OCH MODULERNAS, bara när BÅDA finns. */}
      {harRamverksrader && skapaModulerRedo ? <div role="separator" className="my-0.5 border-t border-line" /> : null}
      {skapaModulerRedo ? (
        <div className="px-1">
          <OpsSkapa
            registreringar={skapa?.registreringar ?? []}
            lage={skapa?.lage ?? null}
            sprak={skapa?.sprak}
            ikonRitare={skapa?.ikonRitare}
            ariaLabel={skapaLabel}
            onValj={(r) => oppna({ kind: "modul", registrering: r })}
          />
        </div>
      ) : null}
    </>
  );

  // ⛔ En sträng blir ett riktigt märke, inte fet text. Skälet är att det
  // vanliga fallet ska vara det rätta fallet: skriver man `brand="OPS HUB"`
  // får man märket med rätt typsnitt och färger, utan att behöva veta att
  // `OpsBrand` finns.
  //
  // ⛔ #161: BRANDET FÖLJER PANELENS LÄGE, INTE BARA SKÄRMBREDDEN. CP 2026-
  // 09-28: "Skalet äger alltså både panelens läge och brandens form; koppla
  // dem i OpsAppShell." Är `grupper` given SKICKAS `panelInfalld` med, satt
  // till `grupper.infalld`: `OpsBrand` crossfadar då monogram/ordmärke i en fast
  // ruta ur `--logo-bredd`/`--logo-bredd-infalld` (se `OpsBrand`s filhuvud
  // och `tokens.css`), i stället för sitt vanliga smal/bred-beteende. En
  // sträng blir ett nytt `OpsBrand` med propen på raka rör; ett FÄRDIGT
  // `OpsBrand`-element (appens egen `<OpsBrand .../>`) KLONAS med
  // `cloneElement`, eftersom skalet inte kan känna till appens övriga props.
  // ⛔ BARA OM ELEMENTET FAKTISKT ÄR `OpsBrand`. Ett godtyckligt `brand`-nod
  // (en egen logga, ren text) har ingen `panelInfalld`-prop att klona in, och
  // en blind `cloneElement` hade skickat en prop till en komponent som inte
  // frågat efter den.
  //
  // ⛔ 0.31.0: MÄRKET ÄR TEXT, OCH UNDERTEXTEN ÄR DEN AKTIVA GRUPPEN. `brand` som sträng är
  // märkets `namn` (rad 1, "OPS HUB" när den utelämnas). Rad 2 är den aktiva gruppens namn
  // när `grupper` finns och en grupp är aktiv; utan grupp (personen är inte med i någon, eller
  // appen skickar inga `grupper`) används `undertext` på appens egen `OpsBrand`, annars ritas bara rad 1.
  const aktivGrupp = grupper ? grupper.lista.find((g) => g.id === grupper.aktiv) : undefined;
  const gruppUndertext = aktivGrupp ? text(aktivGrupp.namn, grupper?.sprak ?? sprak).toLocaleUpperCase(grupper?.sprak ?? sprak) : undefined;
  const panelProp = grupper ? { panelInfalld: Boolean(grupper.infalld) } : {};
  const varumarke =
    brand === undefined || typeof brand === "string"
      ? <OpsBrand {...(brand === undefined ? {} : { namn: brand })} {...(gruppUndertext ? { undertext: gruppUndertext } : {})} {...panelProp} />
      : isValidElement(brand) && brand.type === OpsBrand
        ? cloneElement(/** @type {any} */ (brand), { ...(gruppUndertext ? { undertext: gruppUndertext } : {}), ...panelProp })
        : brand;

  /** @param {string} href @param {any} e */
  const onActivate = (href, e) => {
    // ⛔ 0.38.0 (#194): en öppen skapa-panel hör till sidan den öppnades på, se `foregaendeAktivHref` ovan.
    if (skapaForm) stangSkapa(true, false);
    if (handelseId !== null) stangHandelse(true, false);
    if (onNavigate) onNavigate(href, e);
  };

  /**
   * ⛔ AKTIV FLIK ÄR EN UNDERSTRYKNING, INTE EN FYLLD PILL.
   *
   * Den första versionen gav aktiv post `bg-accent-subtle`, alltså en ifylld
   * chip. Den läses som en KNAPP man kan trycka på, inte som "du är här", och
   * med tio poster i rad blir resultatet att man inte ser var man står. Det var
   * ordagrant vad som rapporterades: "menyn är enorm, man vet inte var man är".
   *
   * En understruken flik säger position. Det är också vad SessionStudio gör, och
   * den likheten är hela poängen med paritet: samma sak ska se likadan ut.
   *
   * ⛔ TRE LÄGEN, INTE TVÅ, och det tredje finns av ett mätt skäl.
   *
   * När antalet i raden ändras vid `lg` kan samma destination ligga i raden på
   * bred skärm och i menyn på smal. Då måste "du är här" sitta på olika ställen
   * vid olika bredder, och det går inte att uttrycka med en boolean.
   *
   * Klasserna står utskrivna i stället för att byggas, av samma skäl som
   * `OpsCard`s kantfärger: Tailwind läser källkoden som text.
   */
  /**
   * ⛔ `inline-flex` STÅR INTE HÄR, och det är inte en stilfråga.
   *
   * Först gjorde den det, och posterna utanför det smala taket fick
   * `hidden lg:inline-flex` ovanpå. De doldes aldrig. Tailwind skriver
   * `.hidden` före `.inline-flex` i utdatan, så när ett element bär båda vinner
   * den senare, och raden var lika bred som förut. Mätningen i Chromium gav
   * exakt samma 892 px efter "fixen" som före, vilket är skälet till att den
   * finns: enhetstestet såg grönt ut eftersom jsdom inte kör någon CSS alls.
   *
   * Därför äger anropsstället display-klassen, och de två kan inte krocka.
   */
  /**
   * ⛔ KLASSERNA ÄR AVLÄSTA UR SESSIONSTUDIO, INTE VALDA AV MIG.
   *
   * `apps/web/src/components/AppHeader.jsx`, flikknappen:
   *
   *   relative shrink-0 px-3 lg:px-4 py-2 text-sm font-medium whitespace-nowrap
   *   transition-all border-b-2
   *   aktiv:    border-[--color-text-primary] text-[--color-text-primary]
   *   inaktiv:  border-transparent text-[--color-text-muted]
   *             hover:text-[--color-text-secondary]
   *             hover:border-[--color-border-hover]
   *
   * Översatt till tokenkontraktet: `text-primary` är `ink`, `text-muted` är
   * `ink-muted`, `text-secondary` är `ink-secondary`, `border-hover` är
   * `line-strong`.
   *
   * ⛔ Två glidningar rättas här, och båda var mina egna:
   *   - `text-base font-semibold` skulle varit `text-sm font-medium`. Raden såg
   *     tyngre ut än förlagan.
   *   - Inaktiv flik var `text-ink-secondary` med hover till `ink`. Förlagan
   *     går från `muted` till `secondary`, alltså en svagare vila och ett
   *     svagare lyft. Min variant gjorde hela raden mörkare och lät varje flik
   *     se halvaktiv ut, vilket är precis det som gör att man inte ser var man
   *     står.
   */
  const lankKlass = (/** @type {"av"|"pa"|"pa-under-lg"} */ state) =>
    cx(
      "relative shrink-0 items-center gap-1 whitespace-nowrap border-b-2 py-2 text-etikett font-medium",
      "transition-all duration-(--duration-fast) ease-standard",
      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
      state === "pa" && "border-ink text-ink",
      state === "av" && "border-transparent text-ink-muted hover:border-line-strong hover:text-ink-secondary",
      state === "pa-under-lg" &&
        "border-ink text-ink lg:border-transparent lg:text-ink-muted lg:hover:border-line-strong lg:hover:text-ink-secondary",
    );

  // ⛔ Bara de första får plats i raden, resten hamnar i hamburgarmenyn.
  //
  // Skälet är mätt: bolag-ops har tretton destinationer, och tretton platta
  // textlänkar får inte plats på någon skärm. De klämdes ihop tills de sista
  // hamnade under temaväxlaren och två försvann helt. Ingen "smart" prioritering
  // och ingen mätning av tillgänglig bredd: appen listar sina destinationer i
  // den ordning den vill ha dem, och de första syns. Samma regel som
  // bottenraden, av samma skäl.
  //
  // ⛔ TVÅ TAL, INTE ETT, OCH DET ANDRA KOMMER UR EN MÄTNING.
  //
  // Ett enda `maxTopNav` fick raden att fungera på 1280 och spricka på 768.
  // Mätt i Chromium mot en riktig app: vid 768 px blev sidan 892 px bred,
  // alltså horisontell scroll på VARJE rutt, med länkarna och överflödesknappen
  // utanför kanten. Länkarna vägde 110 till 129 px styck, knappen ~44, varumärket och
  // temaväxlaren omkring 184 tillsammans. Tre länkar plus "Mer" får plats vid
  // 768, fyra gör det inte.
  //
  // Bytet sker i CSS vid `lg`, inte genom att mäta bredd i JavaScript. En
  // ResizeObserver hade gett samma utseende och tre nya problem: ett hopp
  // första renderingen, en rad som inte finns i markup förrän JS kört, och ett
  // test som måste låtsas ha en layout. CSS vet redan hur bred skärmen är.
  // ⛔ MED `fasta` ÄR ALLA TRE I RADEN OCH INGET LIGGER I MENYN. Hub bär det som
  // annars hade blivit överflöd. Utan `fasta` är raden och överflödet som förut.
  const inRow = harFasta ? navLista : navLista.slice(0, maxTopNav);
  const inMenu = harFasta ? [] : navLista.slice(smaltTak);
  const aktivIndex = harFasta ? -1 : navLista.findIndex((s) => entryActive(s, activeHref));

  // Ligger den aktiva posten i menyn på BÅDA bredderna, eller bara på den
  // smala? Utan den skillnaden är ingenting markerat mellan 768 och 1024, och
  // det är exakt felet raden skulle rätta: man ser inte var man är.
  const merLage =
    aktivIndex >= maxTopNav ? "pa" : aktivIndex >= smaltTak ? "pa-under-lg" : "av";

  // ⛔ MED `meny` RITAS HAMBURGAREN ALLTID (#164, andra granskningen), inte
  // bara vid överflöd: menyn (notiser, aktivitet, Logga ut, versionen) finns
  // oavsett om navigeringen råkar rymmas. Utan `meny` är villkoret oförändrat:
  // bara nav-överflöd eller menuExtras tvingar fram knappen.
  const visaHamburgare = Boolean(meny) || inMenu.length > 0 || Boolean(menuExtras);

  // ⛔ MENYNS ORDNING, en lista och inte en JSX-trädgren per yta: ramverkets
  // sektioner (Aktivitet, Inställningar, Hjälp, Notiser), appens egna länkar
  // (`meny.app`, egen rubrik), navigeringens överflödsrader (bara den gamla
  // `nav`-modellen: med `fasta` ligger modulerna i Hub och ALDRIG här),
  // `menuExtras`, Logga ut, sist versionerna. Bottenraden bygger SAMMA lista i
  // `OpsBottomNav`, så de två ytorna inte kan glida isär.
  /** @type {import("./OpsMeny.jsx").MenyAvdelning[]} */
  const rotAvdelningar = [];
  if (meny) rotAvdelningar.push(...menySektioner({ sektioner: meny.sektioner ?? [], kor, visaUndervy: setAktivUndervy }));
  if (meny) {
    const app = menyAppAvdelning({ meny: { sprak, ...meny }, activeHref, onNavigate: onActivate, stang: () => stangMenyn(false), badgeText });
    if (app) rotAvdelningar.push(app);
  }
  if (inMenu.length > 0) {
    rotAvdelningar.push({
      key: "nav",
      innehall: (
        // ⛔ Egen nav med eget namn. Menyn är en lista destinationer, alltså
        // navigering, och utan namn blir den en tredje anonym `<nav>`.
        <nav aria-label={moreLabel} className="flex flex-col gap-0.5">
          {inMenu.map((s, i) => (
            <a
              key={s.href}
              href={s.href}
              onClick={(e) => {
                stangMenyn(false);
                onActivate(s.href, e);
              }}
              aria-current={entryActive(s, activeHref) ? "page" : undefined}
              // Ligger i raden vid `lg`, alltså inte också här.
              className={cx(radKlass({ active: entryActive(s, activeHref) }), smaltTak + i < maxTopNav && "lg:hidden")}
            >
              {s.icon ? (
                <span aria-hidden="true" className="flex shrink-0 items-center [&_svg]:size-4">
                  {s.icon}
                </span>
              ) : null}
              {s.label}
            </a>
          ))}
        </nav>
      ),
    });
  }
  if (menuExtras) rotAvdelningar.push({ key: "extras", innehall: <div className="flex items-center gap-0.5 px-1 py-0.5">{menuExtras}</div> });
  if (meny) rotAvdelningar.push(...menyFot({ onLoggaUt: meny.onLoggaUt, loggaUtEtikett: meny.loggaUtEtikett, appVersion: meny.appVersion, kor }));

  // ⛔ BOTTENRADENS TRE FASTA POSTER, med Hubs barn PLATTA. `OpsBottomNav` validerar
  // `nav` med EN nivå barn, och Hub bär moduler som själva har barn. Raden ritar
  // aldrig barnen (de finns i Hub), men `entryActive` läser dem: därför platta
  // ut dem hit, så Hub lyser även när man står på en moduls undersida.
  const bottenNav = harFasta
    ? navLista.map((p, i) => (i === 2 ? { ...p, children: (moduler ?? []).flatMap((m) => [{ href: m.href, label: m.label }, ...(m.children ?? [])]) } : p))
    : navLista;

  return (
    <OppnaSkapaKontext.Provider value={oppnaFranApp}>
    <OppnaHandelseKontext.Provider value={handelsepanel ? oppnaHandelse : null}>
    <div className="min-h-dvh bg-canvas">
      {/* ⛔ 0.31.2 (CP 2026-09-29 22:33, appen på hemskärmen, iOS standalone med `viewport-fit=cover` och `black-translucent`): HEADERN
          BÖRJAR VID SKÄRMENS ÖVERKANT OCH BÄR SJÄLV DEN SÄKRA ZONEN SOM PADDING (`top-0`, `pt-(--safe-top)`). Före 0.31.2 var den
          `top-(--safe-top)` utan padding: den satt 47 px NED, och remsan ovanför, statusfältets höjd, var otäckt, så sidan
          rullade förbi bakom klockan och headern såg ut att flyta. `check-skalyta` avsnitt 21 emulerar zonerna (`--safe-top: 47px`)
          och mäter att headern börjar vid y = 0. Övriga fasta ytor räknar redan `safe-top + topbar-height`, det är headerns nya höjd. */}
      <header className="sticky top-0 z-(--z-chrome) border-b border-line bg-surface pt-(--safe-top)">
        {/*
          ⛔ TRE KOLUMNER PÅ md+, TVÅ UNDER.

          Brand vänster, primärflikar mitt i headern, åtgärder + hamburgare
          höger — samma upplägg som SessionStudio. En `flex-1`-nav vänsterjusterar
          flikarna mot varumärket. Grid med `1fr auto 1fr` håller mitten mitt
          utan att absolutpositionera över åtgärderna.

          ⛔ Under md är nav `display:none` och FÖRSVINNER UR GRIDEN. Med tre
          kolumner (`1fr auto 1fr`) landade då actions i mitten-`auto` och
          höger-`1fr` blev tom — ikonerna mitt i headern med lucka till höger
          (bolag-ops mobil). Därför: `1fr auto` under md (brand | actions),
          tre kolumner från md.

          ⛔ #167: `h-(--topbar-height)` I STÄLLET FÖR `py-2`. SessionStudios
          toppradshöjd är fast, 56 px (`AppHeader.jsx:169`, `h-14`), inte
          innehållsstyrd. Talet bor i tokens.css `--topbar-height`
          (`tokens/sessionstudio-profil.json` "topprad"), inte här.
        */}
        <div className="mx-auto flex h-(--topbar-height) max-w-7xl items-center gap-3 px-4">
          {/*
            ⛔ #161: INGEN BREDD HÄR. `OpsBrand` sätter SIN EGEN bredd ur
            `--logo-bredd`/`--logo-bredd-infalld` när `panelInfalld` är
            given (se `varumarke` ovan och `OpsBrand`s filhuvud), och en
            bredd på den här cellen OCKSÅ hade varit en TREDJE plats att
            synka mot `--panel-bredd`/`--panel-bredd-infalld`, den panelen
            själv redan äger (`OpsGruppanel`). Cellen är bara en flex-rad.
          */}
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            {/* ⛔ 0.30.1: INGEN `px-1`. Märkesrutan ska stå på panelens vänsterkant
                (SS `AppHeader.jsx:173`, loggan i en ruta utan egen luft), och 4 px
                padding på länken flyttade den 4 px in. Fokusringen ritas ändå
                utanför med `outline-offset-2`. */}
            {/* ⛔ 0.31.1: UNDER `md` RITAS MÄRKET INTE ALLS när `grupper` finns. Gruppväxlaren (ikonen) står längst till vänster i
                stället (CP 2026-09-29 18:40: "Header i mobil skall vi ta bort texten helt"). Startsidan nås ur bottenraden.
                Utan `grupper` finns ingen växlare att ersätta märket med, och monogrammet står kvar som förut. */}
            <a
              href="/"
              onClick={(e) => onActivate("/", e)}
              className={cx("shrink-0 rounded-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", grupper ? "hidden md:flex md:items-center md:gap-2" : "block")}
            >
              {varumarke}
            </a>
            {/*
              ⛔ #161: GRUPPVÄXLAREN, UNDER 1024 PX. Från `lg` tar panelen över
              (kolumnen ovan), så knappen här döljs där i stället för att ge
              TVÅ vägar att byta grupp på samma sida. Se `OpsGruppanel`s
              filhuvud för varför den delar sina rader men inte sin brytpunkt
              med `OpsPanel`.
            */}
            {grupper ? (
              <div className="min-w-0 lg:hidden">
                <OpsGruppvaxlare
                  grupper={grupper.lista}
                  aktiv={grupper.aktiv}
                  onValj={grupper.onValj}
                  sprak={grupper.sprak}
                  listEtikett={grupper.listEtikett}
                  ingenGruppEtikett={grupper.ingenGruppEtikett}
                  tomText={grupper.tomText}
                  rollNamn={grupper.rollNamn}
                  etikett={grupper.etikett}
                  nuEtikett={grupper.nuEtikett}
                />
              </div>
            ) : null}
          </div>

          {/* Bred skärm: länkarna centrerade. Smal: bottenraden nedan. */}
          {/* ⛔ 0.30.1: FLEX OCH INTE GRID, SOM SS (`AppHeader.jsx:194`, `flex-1 justify-center`).
              Med `1fr auto 1fr` stod flikarna mitt på SIDAN och rörde sig aldrig; i SS ligger de mitt i
              det som är kvar EFTER loggan, så de följer med när loggan går från 180 till 40 px.
              Under `md` tar luckan (`flex-1`) den plats flikarna lämnar, så åtgärderna hamnar till höger. */}
          <nav aria-label={navLabel} className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
            {inRow.map((s, i) => (
              <RowEntry
                key={s.href}
                entry={s}
                active={harFasta ? djupAktiv(s, activeHref) : entryActive(s, activeHref)}
                activeHref={activeHref}
                onActivate={onActivate}
                badgeText={badgeText}
                submenuLabel={submenuLabel}
                classes={cx(
                  lankKlass((harFasta ? djupAktiv(s, activeHref) : entryActive(s, activeHref)) ? "pa" : "av"),
                  // Utanför det som får plats vid 768: finns i menyn i stället,
                  // och `display:none` tar bort den ur uppläsningen också, så
                  // ingen möter samma destination två gånger.
                  i >= smaltTak ? "hidden lg:inline-flex" : "inline-flex",
                )}
              />
            ))}
          </nav>

          {/*
            ⛔ Hamburgaren LIGGER EFTER actions, längst till höger.
            Inte inne i den centrerade nav-klustret och inte före temaväxlaren.
            SessionStudio: sök/tema/… sedan hamburgare sist.

            ⛔ gap-0.5, inte gap-1/gap-2. Klustret är 44 px-ikonknappar;
            CP ville dem tätare än gap-1 på desktop (bolag-ops header polish).
          */}
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            {atgarderIHuvud}
            {/* ⛔ #168: PLUSSET LIGGER EFTER actions OCH FÖRE avataren, SOM I
                SESSIONSTUDIO (`ss-skapa-meny.png`: växlare, expandera, sök,
                PLUS, avatar, hamburgare). Ett tryck öppnar en popover med
                listan, aldrig en yta inuti sidan; en rad öppnar en RIKTIG
                `OpsModal`, se filhuvudets ärende (#168). */}
            {visaSkapaKnapp ? (
              <Popover.Root open={skapaOppen} onOpenChange={setSkapaOppen}>
                {/*
                  ⛔ EN CIRKEL SOM SESSIONSTUDIOS (0.30.0, #173), INTE EN
                  ACCENTFYLLD KNAPP. SS `AppHeader.jsx:376`: `p-2 rounded-full`,
                  dämpad ikon, `hover:bg-card`, och `bg-card text-accent` medan
                  menyn är öppen. Före 0.30.0 var plusset en 32 px accentfylld
                  cirkel (samma klasser som `OpsButton variant="primary" round
                  iconOnly`), alltså det enda i klustret som skrek, och tre
                  olika höjder i samma rad. Accentfärgen är bottenradens stora
                  plus, som är den enda ytan där plusset ÄR huvudsaken.

                  ⛔ INTE `asChild` RUNT `OpsButton` (#168, andra granskningen).
                  `OpsButton` är en vanlig funktionskomponent utan `forwardRef`
                  (den är ett STÄNGT API med flit), och Radix `asChild` behöver
                  barnets `ref` för att POSITIONERA popovern. Trigger ritar sitt
                  EGET `<button>`.

                  ⛔ GÖMD I MOBIL NÄR BOTTENRADENS PLUS FINNS: ett plus per yta.
                  `hidden md:inline-flex`, aldrig `inline-flex` ovanpå `hidden`
                  (se `huvudknappKlass`).
                */}
                <Popover.Trigger
                  aria-label={skapaLabel}
                  className={huvudknappKlass({ visning: bottenPlus ? "hidden md:inline-flex" : "inline-flex", aktiv: skapaOppen })}
                >
                  <PlusIkon size={20} />
                </Popover.Trigger>
                <Popover.Portal>
                  {/*
                    ⛔ MÄTT UR SESSIONSTUDIO (#168, andra granskningen), inte
                    gissat: `apps/web/src/components/AppHeader.jsx`, create-
                    menyns rader ("Ny session" m.fl.):
                      - Popoverns bredd: `w-56` (14rem, 224 px)
                      - Popoverns padding: `py-1.5` (6 px topp/botten)
                      - Radens padding: `px-4 py-2.5` (16 px / 10 px)
                      - Avstånd ikon-ord: `gap-3` (12 px)
                      - Ikon: `w-4.5 h-4.5` (18 px), accent
                      - Ord: `text-sm font-medium`, accent
                      - Yta: `bg-surface`, `rounded-[var(--radius)]`, skugga,
                        `border` (0.30.0: `radBehallare`, se dess filhuvud)
                  */}
                  <Popover.Content
                    align="end"
                    sideOffset={4}
                    className={cx("z-(--z-dropdown) w-56 max-w-[calc(100vw-1.5rem)] overflow-hidden py-1.5", radBehallare())}
                  >
                    {renderSkapaLista((form) => {
                      setSkapaOppen(false);
                      oppnaSkapa(form);
                    })}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            ) : null}
            {/* ⛔ Efter actions och FÖRE hamburgaren. Kontot är personens egen
                yta och hör ihop med appens åtgärder; hamburgaren är resten av
                navigeringen och ligger ytterst. Se noten vid propen. */}
            {anvandare}
            {/* ⛔ Hamburgaren syns också när nav ryms men menuExtras eller
                meny finns, annars blir tema/helskärm/menyn oåtkomliga på md+. */}
            {visaHamburgare ? (
              <Popover.Root open={merOppen} onOpenChange={stangMenyn}>
                <Popover.Trigger
                  className={cx(
                    // ⛔ INGEN bar `inline-flex` här. Tailwind skriver `.hidden`
                    // före `.inline-flex` i CSS:et, så när båda sitter på
                    // knappen vinner den senare och hamburgaren syns PÅ MOBIL
                    // parallellt med bottenradens Meny (bolag-ops). Display
                    // ägs av `hidden md:inline-flex` ensam.
                    // ⛔ 0.30.0: EN CIRKEL, 36 px synlig och 44 px träffyta, som
                    // SessionStudio (`AppHeader.jsx:494`), se `huvudknappKlass`.
                    huvudknappKlass({ visning: "hidden md:inline-flex", aktiv: merOppen }),
                    // "Du är här" på en överflödespost: mörkare ikon, ingen platta.
                    !merOppen && merLage === "pa" && "text-ink",
                    !merOppen && merLage === "pa-under-lg" && "text-ink lg:text-ink-muted",
                    // Ryms allt i raden vid `lg` finns ingen meny att öppna där,
                    // utom när menuExtras eller meny tvingar fram den.
                    navLista.length <= maxTopNav && !menuExtras && !meny && "lg:hidden",
                  )}
                  // ⛔ Ingen siffra i namnet. Antalet bakom knappen beror på
                  // skärmbredden, och ett tal som bara stämmer ibland är värre
                  // än inget tal.
                  aria-label={
                    inMenu.length
                      ? `${moreLabel}, fler destinationer`
                      : `${moreLabel}, fler åtgärder`
                  }
                >
                  <MenuIcon size={20} />
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    align="end"
                    sideOffset={4}
                    className={cx(
                      // ⛔ 0.31.0 (CP: "Aktivitet ... modalen blir superbred. Skall vara samma som i dropdown så det inte
                      // känns hackigt"): MENYN HAR EN BREDD, INTE EN INNEHÅLLSBREDD. Före 0.31.0 var den `min-w-52` och
                      // växte med det bredaste som ritades, så en undervy med en lång rad gjorde ytan till en bred ruta.
                      // SS `AppHeader.jsx:514` är `w-80` (320 px), och undervyn ritas i samma ruta. Utan `meny` är det
                      // fortfarande den rena överflödsmenyn, som är innehållsstyrd.
                      "z-(--z-dropdown) max-w-[calc(100vw-1.5rem)] overflow-hidden",
                      // ⛔ 0.31.2 (CP 2026-09-29 20:57: "Se till att aktivitetspanelen blir lika hög som menyn så den inte
                      // hoppar. Kanske att meny skall vara en standardhöjd."): MED `meny` HAR RULLGARDINEN EN HÖJD, INTE
                      // EN INNEHÅLLSHÖJD. Roten var innehållsstyrd (ingen höjdgräns alls) och undervyn Aktivitet hade eget
                      // tak, så ytan hoppade i höjd när man växlade. Nu är höjden densamma i båda lägena
                      // (fönstrets höjd minus toppraden, tak 32 rem) och innehållet rullar inuti.
                      meny ? "flex h-[min(32rem,calc(100dvh-var(--safe-top)-var(--topbar-height)-1.5rem))] w-80 flex-col" : "min-w-52",
                      radBehallare(),
                    )}
                  >
                    {/* ⛔ RUBRIKEN STÅR EN GÅNG, ÖVERST, SAMMA FORM SOM GAMLA
                        `OpsMeny` (mätt i SessionStudio: ett `<h2>` med "Meny",
                        inget namn eller e-post bredvid). Bara med `meny`: utan
                        den är detta fortfarande den rena överflödsmenyn, som
                        aldrig hade en rubrik.
                        ⛔ #166: I EN UNDERVY VISAR SAMMA RAD EN TILLBAKAPIL +
                        radens EGEN etikett i stället, se `MenyRubrikRad`. Det är
                        SAMMA `Popover.Content`, alltså SAMMA panel, som
                        `ss-jamfor-ss-meny.png` (mät: raden byts, den öppnas
                        inte i en ny yta). */}
                    {meny ? (
                      <MenyRubrikRad
                        className="px-3 pt-3 pb-1"
                        rubrik={aktivUndervy ? aktivUndervy.etikett : (meny.rubrik ?? "Meny")}
                        onBack={aktivUndervy ? () => setAktivUndervy(null) : undefined}
                        action={aktivUndervy ? aktivUndervy.undervyAction : undefined}
                      />
                    ) : null}
                    {meny && aktivUndervy ? (
                      // ⛔ UNDERVYNS INNEHÅLL ERSÄTTER RESTEN AV MENYN (#166):
                      // sektioner, nav-överflöd, menuExtras och Logga ut hör
                      // till ROTEN, inte till en undervy man just öppnat.
                      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-1 pb-2">
                        {aktivUndervy.undervy}
                      </div>
                    ) : null}
                    {/* ⛔ 0.30.0: ALLT I ROTEN GÅR GENOM `MenyAvdelningar`, som
                        ritar EN avgränsare mellan varje par och ingen före den
                        första. Se dess filhuvud för felet (två linjer på varandra). */}
                    {!aktivUndervy ? (
                      <div className={cx(meny && "min-h-0 flex-1 overflow-y-auto overscroll-contain")}>
                        <MenyAvdelningar avdelningar={rotAvdelningar} />
                      </div>
                    ) : null}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            ) : null}
          </div>
        </div>
      </header>

      {/*
        ⛔ #161, ANDRA GRANSKNINGEN: PANELEN BÖRJAR UNDER TOPPRADEN, INTE
        BREDVID DEN. SessionStudio (App.jsx:1364-1367): headern spänner hela
        bredden, och under den ligger `<AppSidebar>` och innehållet som två
        flex-barn i samma rad. Första utkastet lade panelen bredvid header
        och main (full höjd), så loggan hamnade till höger om panelen i
        stället för ovanför den. CP: "Var noga med utfälld och infällt läge
        och vad som händer med logotypen." Loggrutan i headern (180/40 px,
        `--logo-bredd*`) står nu rakt ovanför panelen (184/44 px,
        `--panel-bredd*`), samma 4 px-skillnad som i förebilden.
        Panelen är sticky under toppraden och tar viewportens resterande höjd.
      */}
      {/* ⛔ 0.30.1: SAMMA BEHÅLLARE SOM TOPPRADEN (`mx-auto max-w-7xl`) NÄR PANELEN FINNS. SS `App.jsx:1364`:
          headern och panelen ligger i samma `max-w-[1400px] mx-auto`. Utan den låg panelen vid fönstrets
          kant och märket i den centrerade toppraden: 157 px isär vid 1600. */}
      <div className={cx(grupper && "mx-auto max-w-7xl lg:flex")}>
        {/* ⛔ 0.34.0: PANELENS HÖJD ÄR FÖNSTRET MINUS HUVUDET, OCH HUVUDET ÄR SÄKER ZON PLUS 56 PLUS SIN KANT PÅ 1 PX. Före 0.34.0 drogs
            bara 56 ifrån, så varje sida med gruppanelen var 1 px (plus den säkra zonen) högre än fönstret och rullade. Det syntes inte
            på en lång sida, men på Meddelanden (som fyller fönstret) gav det en rullning och en rullningslist. Mätt i check-skalyta avsnitt 29. */}
        {grupper ? (
          <div className="hidden shrink-0 lg:sticky lg:z-(--z-sticky-header) lg:top-[calc(var(--safe-top)+var(--topbar-height))] lg:block lg:h-[calc(100dvh-var(--safe-top)-var(--topbar-height)-1px)] lg:pl-4 lg:pt-5">
            <OpsGruppanel
              grupper={grupper.lista}
              aktiv={grupper.aktiv}
              onValj={grupper.onValj}
              onSkapa={grupperOnSkapa}
              onInfo={grupper.onInfo}
              onRedigera={grupperOnRedigera}
              infalld={grupper.infalld}
              onInfalld={grupper.onInfalld}
              sprak={grupper.sprak}
              listEtikett={grupper.listEtikett}
              skapaEtikett={grupper.skapaEtikett}
              tomText={grupper.tomText}
              kollapsaEtikett={grupper.kollapsaEtikett}
              fallUtEtikett={grupper.fallUtEtikett}
              rollNamn={grupper.rollNamn}
              medlemmarEtikett={grupper.medlemmarEtikett}
              flerAvatarerEtikett={grupper.flerAvatarerEtikett}
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">

      {/* `padding-bottom` lika med bottenradens höjd plus säker yta, men bara
          under md där baren finns. Utan den ligger sista kortet under baren, och
          det upptäcks först när någon inte hittar sin sista rad. */}
      <main className="pb-[calc(var(--bottom-nav-h)+var(--safe-bottom))] md:pb-0">
        {/* ⛔ #159: ALLTID PÅ, se OpsFelgrans filhuvud. Ingen prop stänger av den. */}
        <OpsFelgrans felmottagare={felmottagare} rubrik={felRubrik} beskrivning={felBeskrivning} laddaOmEtikett={laddaOmEtikett}>
          {/* ⛔ 0.31.0: APPENS VY ÄR KVAR I DOM:EN, DOLD, medan skapa-panelen visas. Tillbaka återställer då exakt vyn man kom
              från (filter, rullning, ifyllda fält) i stället för att appen ritar om den från noll. */}
          <div hidden={skapaPanelSyns || handelsePanelSyns}>{children}</div>
        </OpsFelgrans>
        {handelsePanelSyns && handelsepanel ? <HandelsepanelRitare key={handelseId} rita={handelsepanel.rita} id={/** @type {string} */ (handelseId)} onTillbaka={() => stangHandelse()} /> : null}
        {skapaPanelSyns ? (
          <OpsSkapaPanel
            kolumn={skapaForm?.kind === "grupp" || skapaForm?.kind === "redigeragrupp" || skapaForm?.kind === "meddelande" ? "smal" : "bred"}
            titel={skapaModalTitel || skapaLabel}
            onTillbaka={stangSkapa}
            tillbakaEtikett={skapa?.tillbakaEtikett}
            skapasIEtikett={handelseMedKalendrar ? "Kalender" : skapa?.skapasIEtikett}
            skapasI={skapaForm?.kind === "modul" || skapaForm?.kind === "meddelande" ? skapaMalNamn : null}
            onByt={skapaHarVaxlare ? () => setSkapaVaxlare(true) : undefined}
            avbrytEtikett={skapa?.avbrytEtikett}
            sparaEtikett={skapaForm?.kind === "meddelande" ? skickaEtikett : skapaHarFormKonsument ? skapa?.sparaEtikett : undefined}
            formId={skapaFormId}
          >
            {skapaModalInnehall}
          </OpsSkapaPanel>
        ) : null}
      </main>
        </div>
      </div>

      {/* ⛔ Botten-Mer speglar header-Mer, men får inte börja senare än barens
          tak. Med primaryAction rymmer baren 3 (OpsBottomNav); om smaltTak är 4
          skulle slice(smaltTak) hoppa över index 3 och göra den oåtkomlig under md. */}
      <OpsBottomNav
        nav={bottenNav}
        moreNav={harFasta ? [] : navLista.slice(Math.min(smaltTak, primaryAction ? 3 : 4))}
        activeHref={activeHref}
        onNavigate={onNavigate}
        primaryAction={harFasta ? (visaSkapaKnapp ? { label: skapaLabel, onClick: () => setSkapaBottenOppen(true) } : undefined) : primaryAction}
        menuLabel={menuLabel}
        navLabel={bottomNavLabel}
        badgeText={badgeText}
        menuExtras={menuExtras}
        meny={meny ? { sprak, ...meny, app: [...flyttadeRader, ...(meny.app ?? [])] } : meny}
      />

      {/* ⛔ BOTTENRADENS PLUS ÖPPNAR ETT ARK MED SAMMA LISTA SOM HUVUDETS PLUS
          (0.30.0, #173, `renderSkapaLista`). Ett ark och inte en popover: en
          popover kräver ett synligt ankare i dokumentflödet, och bottenradens
          plus är en `fixed` knapp i en annan komponent. Arket är också det som
          en tumme når, och det som Meny redan är. Ordningen (stäng arket, öppna
          modalen ett tick senare) är `kordarePafunktion`s lärdom (#158): två
          Radix-dialoger som byter plats i samma händelse låser sidan. */}
      {bottenPlus ? (
        <Dialog.Root open={skapaBottenOppen} onOpenChange={setSkapaBottenOppen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim md:hidden" />
            <Dialog.Content
              aria-describedby={undefined}
              className={cx("fixed inset-x-0 bottom-0 z-(--z-modal) flex max-h-[85dvh] flex-col pb-(--safe-bottom) md:hidden", radBehallare({ ark: true }))}
            >
              <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
                <Dialog.Title className="m-0 min-w-0 flex-1 truncate text-rubrik font-bold text-ink">{skapaLabel}</Dialog.Title>
                <Dialog.Close
                  aria-label={closeLabel}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-(--duration-fast) ease-standard hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <KryssIkon size={20} />
                </Dialog.Close>
              </div>
              <div className="min-h-0 flex-1 overflow-auto py-1.5">
                {renderSkapaLista((form) => {
                  setSkapaBottenOppen(false);
                  setTimeout(() => oppnaSkapa(form), 0);
                })}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}

      {/* ⛔ 0.31.0: "SKAPA I" ÄR EN DIALOG (SS bild b), PANELEN ÄR EN SIDA. 0.35.0 (#190): den öppnas bara från raden "Skapas i" och
          visar bara appens egna mål. Det finns ingen gruppväljare före formuläret, eftersom allt skapas i den aktiva gruppen. */}
      {skapaForm && skapaHarVaxlare ? (
        <OpsSkapaI
          open={skapaVaxlare}
          onOpenChange={(v) => {
            if (!v) setSkapaVaxlare(false);
          }}
          vald={skapaEffektivtMal?.id ?? null}
          valdSektion={skapaEffektivtMal?.sektion ?? null}
          onValj={(id, sektion) => {
            setSkapaMal({ id, sektion });
            setSkapaVaxlare(false);
          }}
          sektioner={skapaSektioner}
          rubrik={handelseMedKalendrar ? "Kalender" : skapa?.skapaIRubrik}
          avbrytEtikett={skapa?.avbrytEtikett}
          tomText={handelseMedKalendrar ? "Gruppen har inga kalendrar och du har inga egna. Skapa en under Hantera kalendrar." : undefined}
        />
      ) : null}
    </div>
    </OppnaHandelseKontext.Provider>
    </OppnaSkapaKontext.Provider>
  );
}
