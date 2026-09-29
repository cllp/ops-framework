import { cx } from "../lib/cx.js";
import { useResolvedTheme } from "../lib/theme.js";
import { OPS_HUB_VARUMARKE } from "../lib/varumarke.js";

/**
 * Varumärkesraden i skalet: märke, produktnamn och ägarrad.
 *
 * Skickas som `brand` till `OpsAppShell`. Skalet gör det åt dig om du bara
 * skickar en sträng, så det vanliga fallet är en rad:
 *
 *   <OpsAppShell brand="Bolag Ops" ... />
 *   <OpsAppShell brand={<OpsBrand title="Bolag Ops" />} ... />
 *
 * ══ ⛔ CP-BESLUT 2026-09-28 19:00: "LOGGORNA SKA VARA DEFAULT FÖR RAMVERKET,
 * TILLS DE BYTS UT ELLER OVERRIDAS AV EN APP." (#164, korrigering B) ═══════
 *
 * Ordmärket och ikonen är sedan detta beslut INTE längre något appen måste
 * skicka in för att få en bild i stället för text. Ramverkets EGET märke,
 * OPS Hub (`OPS_HUB_VARUMARKE`, `src/lib/varumarke.js`), ritas som förval.
 * En app som inte hunnit branda sig ser ändå ett färdigt skal, i stället för
 * att tvingas skriva fyra URL:er bara för att slippa fet text. `ordmarke`
 * och `ikon` är kvar som props, men de är nu en ÖVERRIDNING för appen som
 * VILL ha sin egen bild, inte ett krav för att slippa förvalstexten.
 *
 * ⛔ RENT TEXT-LÄGE FINNS KVAR, MED FLIT (`mark="none"`, ingen `ordmarke`/
 * `ikon`). bolag-ops kör OPS Hub-förvalet: se `create-ops-app`-mallen.
 *
 * ══ ⛔ CP-BESLUT 2026-09-28 19:10: APPENS NAMN SOM UNDERTEXT UNDER BILDEN ══
 *
 * "OpsBrand ritar ordmärket (eller ikonen i smal vy) och under det appens
 * namn ur `title` som en dämpad undertext (SessionStudios 'MADE IN SWEDEN'-
 * stil ... liten, versaler, spärrad, accentfärg)." Bilden ÄR ramverkets namn
 * (OPS Hub eller appens egen logga), `title` är fortfarande APPENS namn
 * ("Bolag Ops"), och skiljer man dem inte åt vet ingen vilken app man är i
 * bara för att skalet ser klart ut.
 *
 * ── PH.ST-märket, en HELT ANNAN rad (`mark`) ────────────────────────────
 *
 * `mark` styr en LITEN ägarmärkning (Claes Philip Staiger AB) bredvid namnet
 * i textläget, från tokenkontraktets `--logo-phst`. Det är ORTOGONALT mot
 * ordmärket/ikonen ovan: ett är "vems produkt", det andra är "vem äger
 * bolaget". Se `assets/README.md` för PH.ST-filerna.
 *
 * ── Varför bilderna kommer ur `new URL(..., import.meta.url)` ──────────────
 *
 * Se filhuvudet i `src/lib/varumarke.js`: Vite-kompatibelt i BÅDE ramverkets
 * egen build och en konsuments (mätt mot `create-ops-app`-mallen), utan att
 * ramverket känner till konsumentens rot.
 *
 * ── Varför temat läses med `useResolvedTheme()` och inte CSS ──────────────
 *
 * `<picture>`/`prefers-color-scheme` lyssnar bara på SYSTEMET, inte på
 * personens val i appen (ljust/mörkt/följ enheten). `useResolvedTheme()`
 * (`src/lib/theme.js`) är samma sanning som resten av gränssnittet ritas
 * efter.
 */

/**
 * Höjd och proportion per utförande. Proportionerna är MÄTTA ur de beskurna
 * filerna, inte uppskattade: fel förhållande ger ett märke som ser nästan rätt
 * ut, vilket är svårare att upptäcka än ett som ser fel ut.
 */
const MARKEN = {
  /** Bara PH.ST. Rätt i en topprad, där "ESTD 1977" ändå vore oläsligt. */
  phst: "h-8 w-auto aspect-[351/447] bg-(image:--logo-phst)",
  /** Med etableringsraden. Rätt i en sidfot eller där märket får ta plats. */
  "phst-estd": "h-10 w-auto aspect-[326/436] bg-(image:--logo-phst-estd)",
  /** För en plattform som inte ska bära PH.ST-märket, OCH inte OPS Hub-förvalet
   * (se filhuvudet 19:00): "mark='none' plus enbart title ger text som förut". */
  none: null,
};

/**
 * @param {object} props
 * @param {string} props.title Appens namn, t.ex. "Bolag Ops". Undertext under bilden (19:10), eller texten själv i textläget.
 * @param {string} [props.subtitle] Ägare eller sammanhang i TEXTLÄGET (`mark="none"`). Ritas aldrig i bildläget:
 *   `title` är redan undertexten där, och två dämpade rader under en bild är en som ingen bad om.
 * @param {"phst"|"phst-estd"|"none"} [props.mark] Styr BÅDA: PH.ST-badgen i textläget, OCH om OPS Hub-förvalet
 *   ritas alls. `"none"` = ingen bild, ingen PH.ST-badge, bara `title` som text (och `subtitle` om satt).
 * @param {{ ljus: string, mork: string }} [props.ordmarke] Ordmärket som bild, ÖVERRIDER OPS Hub-förvalet. Ritas i
 *   BRED vy (och alltid när `ikon` saknas).
 * @param {{ ljus: string, mork: string }} [props.ikon] Ikonen som bild, ÖVERRIDER OPS Hub-förvalet. Ritas i SMAL vy
 *   när `ordmarke` också finns.
 * @param {string} [props.ordmarkeHojd] Tailwind-HÖJD på ordmärkets bild. Förval `"h-10"` (40 px), SessionStudios
 *   topprad (`AppHeader.jsx:191`, `sm:h-10`). `OpsInloggning` skickar `"h-20"` (80 px): SessionStudios
 *   inloggningslogga är 4:1 och `max-w-[330px]` (`LoginScreen.jsx:224`), alltså 82 px hög.
 *
 *   ⛔ HÖJD, ALDRIG BREDD (CP 2026-09-28 23:50: "Login alldeles för stor"). Propen hette `ordmarkeMaxWidth`
 *   och bar SessionStudios 330 px rakt av. Men OPS Hub-ordmärket är 2,6:1 där SessionStudios är 4:1, så
 *   samma bredd gav 128 px höjd i stället för 82. Det ögat läser som "storlek" på en logga är höjden;
 *   bredden följer av bildens proportion. Därför är måttet en höjd, och bredden `w-auto`.
 * @param {boolean} [props.endastOrdmarke] Ritar BARA ordmärket, aldrig ikonen, oavsett skärmbredd (`OpsInloggning`,
 *   #164). En helskärmsvy är inte `OpsAppShell`s responsiva topprad: smal/bred-växlingen (punkt 9) hör dit, inte hit.
 * @param {boolean} [props.undertext] (0.30.0, #173) Ritar appens namn som dämpad undertext UNDER bilden. Förval FALSKT.
 *   ⛔ Toppraden ritar aldrig undertexten: CP 2026-09-29 "loggan utan text under", och SessionStudios topprad har bara
 *   bilden (`AppHeader.jsx:174-193`). Undertexten (19:10-beslutet) hör till en yta där märket står ENSAMT och appen
 *   annars inte syns: inloggningen sätter den. I bildläget bär `title` i stället bilderna som `alt`, så namnet
 *   finns kvar för skärmläsare och som länktext utan att ta en rad av toppradens 56 px.
 * @param {boolean} [props.panelInfalld] Grupp-panelens läge (#161), NÄR `OpsAppShell`s `grupper`-panel finns.
 *   Mätt ur SessionStudios `AppHeader.jsx` (rad 174-193), inte gissat: BÅDA bilderna monteras alltid, växlingen
 *   sker med `opacity` (aldrig mount/unmount, annars flimrar det, samma lärdom som `AppSidebar.jsx` rad 13-16),
 *   och rutan har en FAST bredd ur `--logo-bredd`/`--logo-bredd-infalld` (`tokens.css`), inte `OpsAppShell`s
 *   vanliga `md:hidden`/`md:block`-brytpunkt. Utelämnad: brandet följer bara skärmbredden, som förut.
 */
export function OpsBrand({ title, subtitle, mark = "phst", ordmarke, ikon, ordmarkeHojd = "h-10", endastOrdmarke = false, undertext = false, panelInfalld }) {
  if (!title) throw new Error("OpsBrand: title krävs. Ett märke utan namn säger inte vilken app man är i, och är undertexten under bilden.");

  if (!(mark in MARKEN)) {
    throw new Error(`OpsBrand: okänt mark "${mark}". Giltiga: ${Object.keys(MARKEN).join(", ")}.`);
  }

  // ⛔ "mark='none' plus enbart title ger text som förut" (CP 19:00): `none`
  // stänger av BÅDE PH.ST-badgen OCH OPS Hub-förvalet. En app som uttryckligen
  // valt "inget märke" ska inte ändå få ramverkets logga i knäet.
  //
  // ⛔ ÖVERRIDNING ÄR ALLT-ELLER-INGET, INTE FÄLT FÖR FÄLT. Skickar appen bara
  // `ordmarke` ska INTE ikonen tyst falla tillbaka på OPS Hub-förvalet: då
  // blandas appens ordmärke med ramverkets ikon i smal vy, två olika märken i
  // samma komponent. En app som bara har EN bild lämnar `ikon` helt utanför,
  // och hamnar i EN-bilds-läget nedan (samma bild i alla brytpunkter).
  const appenOverridar = ordmarke !== undefined || ikon !== undefined;
  const visadOrdmarke = appenOverridar ? ordmarke : (mark === "none" ? undefined : OPS_HUB_VARUMARKE.ordmarke);
  // ⛔ `endastOrdmarke` (OpsInloggning, #164): en helskärmsvy är inte en
  // responsiv topprad. Den smala/breda IKON-VÄXLINGEN hör till `OpsAppShell`s
  // header (#164 punkt 9), och ska INTE tysta göra en 480 px mobilskärm till
  // "smal vy" och rita den lilla ikonen i stället för det avsedda ordmärket.
  const visadIkon = endastOrdmarke ? undefined : appenOverridar ? ikon : (mark === "none" ? undefined : OPS_HUB_VARUMARKE.ikon);

  return visadOrdmarke || visadIkon ? (
    <OpsBrandBild
      title={title}
      ordmarke={visadOrdmarke}
      ikon={visadIkon}
      ordmarkeHojd={ordmarkeHojd}
      undertext={undertext}
      panelInfalld={panelInfalld}
    />
  ) : (
    <OpsBrandText title={title} subtitle={subtitle} mark={mark} />
  );
}

/** @param {{ title: string, subtitle?: string, mark: "phst"|"phst-estd"|"none" }} props */
function OpsBrandText({ title, subtitle, mark }) {
  const markKlass = MARKEN[mark];
  return (
    <span className="inline-flex items-center gap-3">
      {/* ⛔ `aria-hidden`, och det är inte slarv. Märket står alltid bredvid
          produktnamnet i text, och en skärmläsare som säger "PH.ST-logotyp,
          Bolag Ops" läser samma sak två gånger. */}
      {markKlass ? <span aria-hidden="true" className={cx("block shrink-0 bg-contain bg-center bg-no-repeat", markKlass)} /> : null}

      <span className="inline-flex flex-col leading-none">
        <span className="font-display text-md font-bold text-ink">{title}</span>
        {/* ⛔ Ägarraden är liten, versal och gles. Den ska gå att känna igen på
            en halv sekund utan att konkurrera med produktnamnet ovanför: två
            rader som skriker lika högt läses som en enda lång rubrik. */}
        {subtitle ? (
          <span className="mt-0.5 text-xs font-semibold tracking-widest text-accent uppercase">{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * @param {{ title: string, ordmarke?: { ljus: string, mork: string }, ikon?: { ljus: string, mork: string }, ordmarkeHojd: string, undertext: boolean, panelInfalld?: boolean }} props
 */
function OpsBrandBild({ title, ordmarke, ikon, ordmarkeHojd, undertext: medUndertext, panelInfalld }) {
  // ⛔ `useResolvedTheme()` SVARAR "light"/"dark" (samma `Temalage`-typ som
  // resten av `theme.js`). Bildernas nycklar är "ljus"/"mork", KORTFORMEN CP
  // gav i uppdraget, skild från `TEMAN` (grupp.js: "ljust"/"morkt"). Kartan
  // står HÄR, en gång, i stället för att varje anropsställe gissar rätt ord.
  const tema = useResolvedTheme() === "dark" ? "mork" : "ljus";

  // ⛔ UNDERTEXTEN (CP 19:10): titeln, dämpad, versal, spärrad, i accentfärg,
  // SessionStudios "MADE IN SWEDEN"-stil. Samma rad oavsett om en eller två
  // bilder ritas ovanför, för det är bildväxlingen (ikon/ordmärke) som skiljer
  // sig med bredden, inte appens namn.
  // ⛔ 0.30.0: BARA NÄR YTAN BAD OM DEN (`undertext`). Toppraden gör det aldrig.
  //
  // Före 0.30.0 ritades den ALLTID, och märket blev en kolumn: 40 px bild plus
  // en 11 px rad med marginal, omkring 60 px i en topprad som är 56. CP: "loggan
  // utan text under". Namnet försvinner inte: bilderna bär det som `alt`, och
  // med en `<a>` runt märket blir det länkens namn. Utan undertext är `alt`
  // det ENDA stället namnet står på, så den är `title` och aldrig tom.
  const undertext = medUndertext ? <span className="mt-1 block text-center text-hjalp font-medium uppercase tracking-[0.22em] text-accent">{title}</span> : null;
  const alt = medUndertext ? "" : title;

  if (ordmarke && ikon) {
    // ⛔ #161: `panelInfalld` GIVEN (BOOLEAN, INTE `undefined`) ÄR EN ANNAN
    // RUTA ÄN DEN VANLIGA SMAL/BRED-VÄXLINGEN NEDANFÖR. Mätt ur
    // SessionStudios `AppHeader.jsx` rad 174-193, inte gissat: en FAST
    // bredd ur `--logo-bredd`/`--logo-bredd-infalld` (`tokens.css`), och
    // BÅDA bilderna ALLTID monterade med `opacity`-crossfade, aldrig
    // `hidden`/mount-unmount. Samma lärdom som `AppSidebar.jsx` rad 13-16
    // (bort med bredd-`transition`, flimrade): en bild som kommer och går
    // ur DOM:en trasslar layouten i samma tick som opaciteten hade kunnat
    // sköta ensam.
    if (typeof panelInfalld === "boolean") {
      return (
        <span
          className={cx(
            "relative flex shrink-0 items-center overflow-hidden",
            // ⛔ 0.30.1: UNDER `md` ÄR RUTAN ALLTID IKONENS. SS `AppHeader.jsx:173`:
            // `usePhoneLayout || sidebarCollapsed ? "w-10 justify-center" : "md:w-[180px]"`.
            // Före 0.30.1 var ordmärket 180 px brett även på en telefon (panelen
            // är då utfälld i state men inte ritad), och tog hälften av 390 px.
            panelInfalld ? "w-(--logo-bredd-infalld) justify-center" : "w-(--logo-bredd-infalld) justify-center md:w-(--logo-bredd) md:justify-start",
          )}
        >
          <img
            src={ikon[tema]}
            alt={alt}
            aria-hidden={!panelInfalld}
            className={cx(
              "absolute inset-0 m-auto size-8 object-contain object-center transition-opacity duration-200 ease-out",
              panelInfalld ? "opacity-100" : "pointer-events-none opacity-0 max-md:pointer-events-auto max-md:opacity-100",
            )}
          />
          <img
            src={ordmarke[tema]}
            alt={alt}
            aria-hidden={panelInfalld}
            className={cx(
              "h-10 w-full object-contain object-left transition-opacity duration-200 ease-out",
              panelInfalld ? "pointer-events-none opacity-0" : "opacity-100 max-md:pointer-events-none max-md:opacity-0",
            )}
          />
        </span>
      );
    }

    // ⛔ IKONEN I SMAL VY, ORDMÄRKET I BRED (#164 punkt 9). `hidden md:block` /
    // `md:hidden` är samma brytpunkt `OpsAppShell` redan använder för sin egen
    // topprad, inte ett nytt tal påhittat här.
    return (
      <span className="inline-flex flex-col items-center">
        <span className="inline-flex items-center">
          <img src={ikon[tema]} alt={alt} className="block h-8 w-8 object-contain md:hidden" />
          <img src={ordmarke[tema]} alt={alt} className={cx("hidden md:block w-auto object-contain", ordmarkeHojd)} />
        </span>
        {undertext}
      </span>
    );
  }

  const kalla = /** @type {{ ljus: string, mork: string }} */ (ordmarke ?? ikon);
  return (
    <span className="inline-flex flex-col items-center">
      {/* ⛔ `alt=""`: BILDEN är dekor sedan `title` flyttade till en egen,
          synlig och uppläst textrad (`undertext`). Två uppläsningar av samma
          namn, en på bilden och en under den, hade sagt "Bolag Ops, Bolag
          Ops" för en skärmläsare. */}
      <img src={kalla[tema]} alt={alt} className={cx("block object-contain", ordmarke ? cx("w-auto", ordmarkeHojd) : "h-8 w-8")} />
      {undertext}
    </span>
  );
}
