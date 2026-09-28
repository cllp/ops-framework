import { cloneElement, Component, isValidElement, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { OpsBrand } from "./OpsBrand.jsx";
import { OpsBottomNav } from "./OpsBottomNav.jsx";
import { OpsGruppanel, OpsGruppvaxlare } from "./OpsGruppanel.jsx";
import { entryActive, validateNav } from "../lib/nav.js";
import { Counter } from "./counter.jsx";
import { ArendePlusIkon, ChevronNedIkon, HandelsePlusIkon, MenuIcon, PlusIkon } from "./icons.jsx";
import { rapporteraFel } from "../lib/felrapport.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsPanelRow } from "./OpsPanel.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { OpsSkapa } from "./OpsSkapa.jsx";
import { OpsField } from "./OpsField.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { text } from "../lib/sprak.js";
import { skapalaget, typerAttValja } from "../lib/skapa.js";
import { kordarePafunktion, MenyFooter, MenyRubrikRad, MenySektioner, validateMenySektioner } from "./OpsMeny.jsx";

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
          <p className="m-0 text-lg font-semibold text-ink">{this.props.rubrik}</p>
          <p className="m-0 max-w-prose text-ink-secondary">{this.props.beskrivning}</p>
          <p className="m-0 font-mono text-sm text-ink-muted">{id}</p>
          <OpsButton variant="primary" onClick={() => globalThis.location?.reload()}>
            {this.props.laddaOmEtikett}
          </OpsButton>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const childEntries = Array.isArray(entry.children) ? entry.children : [];

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
      <a href={entry.href} onClick={(e) => onActivate(entry.href, e)} aria-current={active ? "page" : undefined} className={classes}>
        {entry.label}
        {counter}
      </a>
    );
  }


  /*
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
    <span className={cx(classes, "gap-0 px-0")}>
      <a
        href={entry.href}
        onClick={(e) => onActivate(entry.href, e)}
        aria-current={active ? "page" : undefined}
        className="inline-flex items-center self-stretch rounded-l-md px-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent lg:pl-4"
      >
        {entry.label}
        {counter}
      </a>
      <Popover.Root open={oppen} onOpenChange={setOppen}>
        <Popover.Trigger
          aria-label={`${submenuLabel} ${entry.label}`}
          className={cx(
            "relative inline-flex cursor-pointer items-center self-stretch rounded-r-md pr-2 pl-0.5",
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
            className="z-(--z-dropdown) flex w-56 flex-col rounded-md border border-line bg-raised p-2 shadow-md"
          >
            {childEntries.map((b) => (
              <a
                key={b.href}
                href={b.href}
                onClick={(e) => {
                  setOppen(false);
                  onActivate(b.href, e);
                }}
                aria-current={b.href === activeHref ? "page" : undefined}
                className={cx(
                  "flex min-h-11 items-center rounded-sm px-3 text-sm",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  b.href === activeHref
                    ? "bg-accent-subtle font-semibold text-ink"
                    : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
                )}
              >
                {b.label}
              </a>
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
 * Skalets `skapa`-prop (#168), plusset i toppraden.
 * @typedef {object} SkapaKonfiguration
 * @property {import("react").ReactNode} [handelse] Ramverkets egen rad "Ny händelse". `null`/utelämnad döljer raden.
 * @property {import("react").ReactNode} [arende] Ramverkets egen rad "Nytt ärende".
 * @property {ReadonlyArray<import("../lib/modul.js").Skaparregistrering & { modulId: string }>} [registreringar] Ur `skaparFor` (#150).
 * @property {string | null} [lage] Aktivt gruppläge, se `skapalaget`.
 * @property {ReadonlyArray<{ id: string, kategorier?: ReadonlyArray<any> }>} [kataloger]
 * @property {(namn: string) => import("react").ReactNode} [ikonRitare]
 * @property {string} [sprak]
 * @property {(arg: { registrering: string, typ: string | null }) => void} [onKlar] Anropas när en MODULENS formulär är klart.
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
 * @property {boolean} [infalld]
 * @property {(infalld: boolean) => void} [onInfalld]
 * @property {string} [sprak]
 * @property {string} [allaEtikett]
 * @property {string} [skapaEtikett]
 * @property {string} [tomText]
 * @property {string} [kollapsaEtikett]
 * @property {string} [fallUtEtikett]
 * @property {Record<string, string>} [rollNamn]
 * @property {string} [medlemmarEtikett]
 * @property {string} [flerAvatarerEtikett]
 * @property {string} [etikett] Skärmläsarnamn på `OpsGruppvaxlare`s ark (smal skärm).
 */

/**
 * @param {object} props
 * @param {import("react").ReactNode} props.brand Appens namn som sträng, eller en egen `OpsBrand`. Länkar till startsidan.
 * @param {import("../lib/nav.js").NavPost[]} props.nav Toppdestinationer. `{ href, label }` räcker; `icon`, `badge` och `children` (en nivå) är valfria tillägg.
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
 *   `aktiv` (`ALLA_GRUPPER` eller ett grupp-id), `onValj` (krävs), `onSkapa` (utelämnad: ingen "Skapa grupp"-knapp),
 *   `infalld`/`onInfalld` (styr BÅDE panelens läge och brandets ikon/ordmärke-val, se noten vid `varumarke`
 *   nedan; utelämnade: panelen sköter läget själv och brandet följer bara skärmbredden som förut), `sprak`, samt
 *   `allaEtikett`/`skapaEtikett`/`tomText`/`rollNamn`/`medlemmarEtikett`/`flerAvatarerEtikett`/`etikett`
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
 * @param {SkapaKonfiguration} [props.skapa] (#168) Plusset i toppraden, mellan `actions` och `anvandare`.
 *   Tryck öppnar en POPOVER med en platt lista (`ss-skapa-meny.png`), aldrig en yta i sidan: `handelse`
 *   och `arende` är ramverkets EGNA rader (Idag/kalendern och Inkorgen är ramverkets vyer, inte moduler),
 *   `registreringar`/`lage`/`kataloger`/`ikonRitare`/`sprak` är samma kontrakt som `OpsSkapa` redan hade
 *   (#150/#153). En rad öppnar en RIKTIG `OpsModal` (stängbar med X, Escape, klick utanför), aldrig en andra
 *   vy inuti popovern: 0.27.0:s inbyggda typval+formulär+"Tillbaka" i `OpsSkapa` själv är borttaget (#168),
 *   det flyttade hit. ⛔ `handelse`/`arende` ÄR FÄRDIGA `ReactNode`: skalet vet inget om deras fält och kan
 *   därför inte stänga modalen åt dem när de sparat, bara via X/Escape/klick-utanför (modalens egna vägar).
 *   En modul-registrerings formulär får `{ groupId, typ, onKlar }` som förut, och `onKlar` stänger modalen.
 *   Utan `skapa`, eller utan NÅGOT den kan visa (inga `handelse`/`arende` OCH modulerna i `valjGrupp`/`tomt`-
 *   läge), ritas inget plus alls (tomhet är ett svar, arbetsreglernas punkt 5).
 * @param {string} [props.skapaLabel] Skärmläsarnamn på plusknappen.
 * @param {string} [props.nyHandelseEtikett] Ramverkets rad för `skapa.handelse`.
 * @param {string} [props.nyttArendeEtikett] Ramverkets rad för `skapa.arende`.
 * @param {string} [props.skapaTypEtikett] Etikett på typväljaren i en modul-registrerings modal.
 * @param {import("react").ReactNode} props.children
 */
export function OpsAppShell({
  brand,
  nav,
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
  skapaLabel = "Skapa",
  nyHandelseEtikett = "Ny händelse",
  nyttArendeEtikett = "Nytt ärende",
  skapaTypEtikett = "Typ",
  felmottagare,
  felRubrik = "Något gick fel",
  felBeskrivning = "Sidan gick sönder. Ladda om för att försöka igen.",
  laddaOmEtikett = "Ladda om",
  children,
}) {
  validateNav(nav, "OpsAppShell");
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
  if (meny) {
    if (typeof meny.onLoggaUt !== "function") {
      throw new Error("OpsAppShell: meny.onLoggaUt krävs (en funktion) när \"meny\" skickas in. Utan den kan ingen logga ut från menyn.");
    }
    validateMenySektioner(meny.sektioner ?? [], "OpsAppShell: meny.sektioner");
  }
  // Standardvärdet HÄRLEDS och står inte i signaturen. En app som säger
  // `maxTopNav={2}` har sagt allt som behövs, och ska inte behöva känna till
  // ett andra tal för att slippa ett undantag.
  const smaltTak = maxTopNavSmal ?? Math.min(3, maxTopNav);
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
  const [skapaForm, setSkapaForm] = useState(
    /** @type {{ kind: "handelse" | "arende" } | { kind: "modul", registrering: any } | null} */ (null),
  );
  // ⛔ VALD TYP PER REGISTRERING, INTE INUTI `skapaForm`. Ett värde sparat i
  // `skapaForm` vid öppningstillfället är fruset: `OpsSelect`s `onChange`
  // hade behövt skriva om ett redan monterat ReactNode i state, vilket inte
  // går. Typen läses i stället ur `skapaTyp` VARJE RENDERING, se nedan.
  const [skapaTyp, setSkapaTyp] = useState(/** @type {Record<string, string>} */ ({}));

  const skapaLaget = skapa ? skapalaget({ lage: skapa.lage ?? null, registreringar: skapa.registreringar ?? [] }) : null;
  const skapaModulerRedo = skapaLaget?.tillstand === "redo";
  const harRamverksrader = Boolean(skapa?.handelse) || Boolean(skapa?.arende);
  // ⛔ TOMHET ÄR ETT SVAR: INGET PLUS ALLS NÄR DET INTE FINNS NÅGOT ATT VISA.
  // En knapp som öppnar en tom popover är sämre än ingen knapp, den lär den
  // som trycker att plusset i den här appen inte gör något.
  const visaSkapaKnapp = Boolean(skapa) && (harRamverksrader || skapaModulerRedo);

  /** @type {string} */
  let skapaModalTitel = "";
  /** @type {import("react").ReactNode} */
  let skapaModalInnehall = null;
  if (skapaForm?.kind === "handelse") {
    skapaModalTitel = nyHandelseEtikett;
    skapaModalInnehall = skapa?.handelse;
  } else if (skapaForm?.kind === "arende") {
    skapaModalTitel = nyttArendeEtikett;
    skapaModalInnehall = skapa?.arende;
  } else if (skapaForm?.kind === "modul") {
    const r = skapaForm.registrering;
    const typer = typerAttValja(r.katalog, skapa?.kataloger ?? []);
    const skapaSprak = skapa?.sprak ?? "sv";
    const vald = skapaTyp[r.id] ?? typer[0]?.id ?? null;
    const Form = /** @type {any} */ (r.form);
    skapaModalTitel = text(r.namn, skapaSprak);
    skapaModalInnehall = (
      <div className="flex flex-col gap-3">
        {r.katalog !== null ? (
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
        <Form groupId={skapaLaget?.grupp ?? null} typ={vald} onKlar={() => { skapa?.onKlar?.({ registrering: r.id, typ: vald }); setSkapaForm(null); }} />
      </div>
    );
  }

  // ⛔ En sträng blir ett riktigt varumärke, inte fet text. Skälet är att det
  // vanliga fallet ska vara det rätta fallet: skriver man `brand="Bolag Ops"`
  // får man PH.ST-märket och namnet, utan att behöva veta att `OpsBrand` finns.
  //
  // ⛔ #161: BRANDET FÖLJER PANELENS LÄGE, INTE BARA SKÄRMBREDDEN. CP 2026-
  // 09-28: "Skalet äger alltså både panelens läge och brandens form; koppla
  // dem i OpsAppShell." Är `grupper` given SKICKAS `panelInfalld` med, satt
  // till `grupper.infalld`: `OpsBrand` crossfadar då ikon/ordmärke i en fast
  // ruta ur `--logo-bredd`/`--logo-bredd-infalld` (se `OpsBrand`s filhuvud
  // och `tokens.css`), i stället för sitt vanliga smal/bred-beteende. En
  // sträng blir ett nytt `OpsBrand` med propen på raka rör; ett FÄRDIGT
  // `OpsBrand`-element (appens egen `<OpsBrand .../>`) KLONAS med
  // `cloneElement`, eftersom skalet inte kan känna till appens övriga props.
  // ⛔ BARA OM ELEMENTET FAKTISKT ÄR `OpsBrand`. Ett godtyckligt `brand`-nod
  // (en egen logga, ren text) har ingen `panelInfalld`-prop att klona in, och
  // en blind `cloneElement` hade skickat en prop till en komponent som inte
  // frågat efter den.
  const varumarke = grupper
    ? typeof brand === "string"
      ? <OpsBrand title={brand} panelInfalld={Boolean(grupper.infalld)} />
      : isValidElement(brand) && brand.type === OpsBrand
        ? cloneElement(/** @type {any} */ (brand), { panelInfalld: Boolean(grupper.infalld) })
        : brand
    : typeof brand === "string"
      ? <OpsBrand title={brand} />
      : brand;

  /** @param {string} href @param {any} e */
  const onActivate = (href, e) => {
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
      "relative shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium lg:px-4",
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
  const inRow = nav.slice(0, maxTopNav);
  const inMenu = nav.slice(smaltTak);
  const aktivIndex = nav.findIndex((s) => entryActive(s, activeHref));

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

  return (
    <div className="min-h-dvh bg-canvas">
      {/* `top-(--safe-top)` och inte `top-0`: utan säker yta hamnar raden under
          statusfältet på en telefon, och det syns bara på riktig hårdvara. */}
      <header className="sticky top-(--safe-top) z-(--z-chrome) border-b border-line bg-surface">
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
        <div className="mx-auto grid h-(--topbar-height) max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-4 md:grid-cols-[1fr_auto_1fr]">
          {/*
            ⛔ #161: INGEN BREDD HÄR. `OpsBrand` sätter SIN EGEN bredd ur
            `--logo-bredd`/`--logo-bredd-infalld` när `panelInfalld` är
            given (se `varumarke` ovan och `OpsBrand`s filhuvud), och en
            bredd på den här cellen OCKSÅ hade varit en TREDJE plats att
            synka mot `--panel-bredd`/`--panel-bredd-infalld`, den panelen
            själv redan äger (`OpsGruppanel`). Cellen är bara en flex-rad.
          */}
          <div className="flex min-w-0 items-center gap-2 justify-self-start">
            <a
              href="/"
              onClick={(e) => onActivate("/", e)}
              className="shrink-0 rounded-md px-1 py-1 text-md font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
                  onSkapa={grupper.onSkapa}
                  sprak={grupper.sprak}
                  allaEtikett={grupper.allaEtikett}
                  skapaEtikett={grupper.skapaEtikett}
                  tomText={grupper.tomText}
                  rollNamn={grupper.rollNamn}
                  etikett={grupper.etikett}
                />
              </div>
            ) : null}
          </div>

          {/* Bred skärm: länkarna centrerade. Smal: bottenraden nedan. */}
          <nav aria-label={navLabel} className="hidden items-center gap-1 justify-self-center md:flex">
            {inRow.map((s, i) => (
              <RowEntry
                key={s.href}
                entry={s}
                active={entryActive(s, activeHref)}
                activeHref={activeHref}
                onActivate={onActivate}
                badgeText={badgeText}
                submenuLabel={submenuLabel}
                classes={cx(
                  lankKlass(entryActive(s, activeHref) ? "pa" : "av"),
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
          <div className="flex shrink-0 items-center justify-self-end gap-0.5">
            {actions}
            {/* ⛔ #168: PLUSSET LIGGER EFTER actions OCH FÖRE avataren, SOM I
                SESSIONSTUDIO (`ss-skapa-meny.png`: växlare, expandera, sök,
                PLUS, avatar, hamburgare). Ett tryck öppnar en popover med
                listan, aldrig en yta inuti sidan; en rad öppnar en RIKTIG
                `OpsModal`, se filhuvudets ärende (#168). */}
            {visaSkapaKnapp ? (
              <Popover.Root open={skapaOppen} onOpenChange={setSkapaOppen}>
                {/*
                  ⛔ INTE `asChild` RUNT `OpsButton` (#168, andra granskningen).
                  `OpsButton` är en vanlig funktionskomponent utan `forwardRef`
                  (den är ett STÄNGT API med flit, se dess filhuvud), och Radix
                  `asChild` klonar barnet och behöver dess `ref` för att
                  POSITIONERA popovern mot rätt element. En `ref` till en
                  funktionskomponent blir `null`; popovern hade då antingen
                  varnat i konsolen eller positionerat sig fel, och felet
                  hade varit osynligt tills någon råkade se var rutan hamnade.
                  Klasserna nedan är ORDAGRANT desamma som `OpsButton
                  variant="primary" round iconOnly size="md"` bygger (se dess
                  `VARIANTER.primary`, `RUND_IKONSTORLEKAR.md`, `BAS`,
                  `"rounded-full"`): en riktig `Popover.Trigger` (utan
                  `asChild`, Radix ritar sitt EGET `<button>`) med SAMMA form.
                  `piller.test.jsx` bevisar redan `OpsButton`s klasser; ett
                  eget prov här bevisar att de INTE glidit isär.
                */}
                <Popover.Trigger
                  aria-label={skapaLabel}
                  className={cx(
                    "inline-flex items-center justify-center border font-medium leading-tight",
                    "transition-colors duration-(--duration-fast) ease-standard",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    "rounded-full border-transparent bg-accent text-accent-contrast hover:bg-accent-hover",
                    "size-8 p-0",
                  )}
                >
                  {/* ⛔ 20 px, SAMMA GLYFSKALA SOM RUND_IKONSTORLEKARs egen
                      kommentar redan föreskriver för just den här knappen. */}
                  <PlusIkon size={20} />
                </Popover.Trigger>
                <Popover.Portal>
                  {/*
                    ⛔ MÄTT UR SESSIONSTUDIO (#168, andra granskningen), inte
                    gissat: `apps/web/src/components/AppHeader.jsx`, create-
                    menyns rader ("Ny session" m.fl.):
                      - Popoverns bredd: `w-56` (14rem, 224 px)
                      - Popoverns padding: `py-1.5` (6 px topp/botten), ingen
                        egen horisontell padding (raderna bär sin egen)
                      - Radens padding: `px-4 py-2.5` (16 px / 10 px)
                      - Avstånd ikon–ord: `gap-3` (12 px)
                      - Ikon: `w-4.5 h-4.5` (18 px), `text-[var(--color-accent)]`
                      - Ord: `text-sm font-medium` (14 px / 500), samma accentfärg
                      - Yta: `rounded-[var(--radius)]`, `shadow-xl`,
                        `border border-[var(--color-border-hover)]`
                    Se `OpsPanelRow props.accent` för hur ikon+ord-färgen och
                    måtten flyttades dit (`text-accent` ärvs av ikonens
                    `currentColor`, ingen egen ikonfärgklass här).
                  */}
                  <Popover.Content
                    align="end"
                    sideOffset={4}
                    className="z-(--z-dropdown) w-56 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-line bg-raised py-1.5 shadow-md"
                  >
                    {/* ⛔ RAMVERKETS EGNA RADER FÖRST (#168, CP:s rättelse
                        23:35): Idag/kalendern och Inkorgen är ramverkets vyer,
                        inte moduler, och deras "Ny …"-rader hör därför hit,
                        inte till `OpsSkapa`s modul-lista. */}
                    {harRamverksrader ? (
                      <div className="flex flex-col gap-0.5">
                        {skapa?.handelse ? (
                          <OpsPanelRow
                            icon={<HandelsePlusIkon size={18} />}
                            label={nyHandelseEtikett}
                            accent
                            onClick={() => {
                              setSkapaOppen(false);
                              setSkapaForm({ kind: "handelse" });
                            }}
                          />
                        ) : null}
                        {skapa?.arende ? (
                          <OpsPanelRow
                            icon={<ArendePlusIkon size={18} />}
                            label={nyttArendeEtikett}
                            accent
                            onClick={() => {
                              setSkapaOppen(false);
                              setSkapaForm({ kind: "arende" });
                            }}
                          />
                        ) : null}
                      </div>
                    ) : null}
                    {/* ⛔ EN AVDELARE MELLAN RAMVERKETS RADER OCH MODULERNAS,
                        bara när BÅDA finns (samma "tunn avdelare"-mönster som
                        `OpsSkapa` nu använder mellan moduler, se dess filhuvud). */}
                    {harRamverksrader && skapaModulerRedo ? <div role="separator" className="my-0.5 border-t border-line" /> : null}
                    {skapaModulerRedo ? (
                      <OpsSkapa
                        registreringar={skapa?.registreringar ?? []}
                        lage={skapa?.lage ?? null}
                        sprak={skapa?.sprak}
                        ikonRitare={skapa?.ikonRitare}
                        ariaLabel={skapaLabel}
                        onValj={(r) => {
                          setSkapaOppen(false);
                          setSkapaForm({ kind: "modul", registrering: r });
                        }}
                      />
                    ) : null}
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
                    // ägs av `hidden md:inline-flex` ensam — samma mönster som
                    // flikarna i raden.
                    "hidden min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md md:inline-flex",
                    "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    merLage === "pa" && "text-ink",
                    merLage === "pa-under-lg" && "text-ink lg:text-ink-secondary",
                    merLage === "av" && "text-ink-secondary",
                    // Ryms allt i raden vid `lg` finns ingen meny att öppna där —
                    // utom när menuExtras eller meny tvingar fram den (menyn
                    // finns oavsett om navigeringen råkar rymmas).
                    nav.length <= maxTopNav && !menuExtras && !meny && "lg:hidden",
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
                      "z-(--z-dropdown) min-w-52 max-w-[calc(100vw-1.5rem)] rounded-md border border-line bg-raised shadow-md",
                      // ⛔ Utan `meny` behåller poppovern sin gamla enkla form:
                      // ett enda `p-1` runt bara nav+extras (ingen rubrik, inga
                      // sektioner, ingen Logga ut). MED `meny` sköter varje
                      // block sin egen kant (rubrik, `MenySektioner`, nav,
                      // `menuExtras`, `MenyFooter`), som gamla `OpsMeny` gjorde.
                      meny ? "overflow-hidden" : "p-1",
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
                      <div className="max-h-[min(70vh,32rem)] overflow-y-auto overscroll-contain px-2 pt-1 pb-2">
                        {aktivUndervy.undervy}
                      </div>
                    ) : null}
                    {meny && !aktivUndervy ? (
                      <MenySektioner sektioner={meny.sektioner ?? []} kor={kor} visaUndervy={setAktivUndervy} />
                    ) : null}
                    {!aktivUndervy && (inMenu.length || menuExtras) ? (
                      <div className={cx(meny ? "border-t border-line p-1" : null)}>
                        {/* ⛔ Egen nav med eget namn. Menyn är en lista destinationer,
                            alltså navigering, och utan namn blir den en tredje
                            anonym `<nav>` i dokumentet. */}
                        <nav aria-label={moreLabel} className="flex flex-col">
                          {inMenu.map((s, i) => (
                            <a
                              key={s.href}
                              href={s.href}
                              onClick={(e) => {
                                stangMenyn(false);
                                onActivate(s.href, e);
                              }}
                              aria-current={entryActive(s, activeHref) ? "page" : undefined}
                              className={cx(
                                "flex min-h-11 items-center gap-2 rounded-sm px-3 text-base",
                                // Ligger i raden vid `lg`, alltså inte också här.
                                smaltTak + i < maxTopNav && "lg:hidden",
                                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                                entryActive(s, activeHref) ? "bg-accent-subtle font-semibold text-ink" : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
                              )}
                            >
                              {s.icon ? (
                                <span aria-hidden="true" className="shrink-0">
                                  {s.icon}
                                </span>
                              ) : null}
                              {s.label}
                            </a>
                          ))}
                          {menuExtras ? (
                            <>
                              {inMenu.length ? (
                                <div role="separator" className="my-1 border-t border-line" />
                              ) : null}
                              <div className="flex items-center gap-0.5 px-1 py-0.5">{menuExtras}</div>
                            </>
                          ) : null}
                        </nav>
                      </div>
                    ) : null}
                    {meny && !aktivUndervy ? (
                      <MenyFooter onLoggaUt={meny.onLoggaUt} loggaUtEtikett={meny.loggaUtEtikett} appVersion={meny.appVersion} kor={kor} />
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
      <div className={cx(grupper && "lg:flex")}>
        {grupper ? (
          <div className="hidden shrink-0 lg:sticky lg:top-[calc(var(--safe-top)+var(--topbar-height))] lg:block lg:h-[calc(100dvh-var(--topbar-height))] lg:pl-4 lg:pt-5">
            <OpsGruppanel
              grupper={grupper.lista}
              aktiv={grupper.aktiv}
              onValj={grupper.onValj}
              onSkapa={grupper.onSkapa}
              infalld={grupper.infalld}
              onInfalld={grupper.onInfalld}
              sprak={grupper.sprak}
              allaEtikett={grupper.allaEtikett}
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
          {children}
        </OpsFelgrans>
      </main>
        </div>
      </div>

      {/* ⛔ Botten-Mer speglar header-Mer, men får inte börja senare än barens
          tak. Med primaryAction rymmer baren 3 (OpsBottomNav); om smaltTak är 4
          skulle slice(smaltTak) hoppa över index 3 och göra den oåtkomlig under md. */}
      <OpsBottomNav
        nav={nav}
        moreNav={nav.slice(Math.min(smaltTak, primaryAction ? 3 : 4))}
        activeHref={activeHref}
        onNavigate={onNavigate}
        primaryAction={primaryAction}
        menuLabel={menuLabel}
        navLabel={bottomNavLabel}
        badgeText={badgeText}
        menuExtras={menuExtras}
        meny={meny}
      />

      {/* ⛔ #168: MODALEN ÄR ÉN, DELAD MELLAN RAMVERKETS RADER OCH MODULERNAS.
          Monteras bara medan `skapaForm` finns (se filhuvudets note vid
          `OpsModal`: en `title`-lös modal kastar, så den ska inte finnas i
          DOM:en när det inte finns något att visa). */}
      {skapaForm ? (
        <OpsModal open onOpenChange={(v) => { if (!v) setSkapaForm(null); }} title={skapaModalTitel || skapaLabel}>
          {skapaModalInnehall}
        </OpsModal>
      ) : null}
    </div>
  );
}
