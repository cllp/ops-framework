import { cx } from "../lib/cx.js";
import { useResolvedTheme } from "../lib/theme.js";

/**
 * Varumärkesraden i skalet: märke, produktnamn och ägarrad.
 *
 * Skickas som `brand` till `OpsAppShell`. Skalet gör det åt dig om du bara
 * skickar en sträng, så det vanliga fallet är en rad:
 *
 *   <OpsAppShell brand="Bolag Ops" ... />
 *   <OpsAppShell brand={<OpsBrand title="Operations Hub" subtitle="CPS AB" />} ... />
 *
 * ⛔ PH.ST-märket ligger HÄR och inte som en fil i varje app. Samma märke ska
 * bäras av alla plattformar, och en kopia per repo är ett andra original:
 * rättas det ena rättas inte det andra, och efter ett år finns två loggor som
 * nästan är samma. Det är inte hypotetiskt. SessionStudio har i dag BÅDE de
 * riktiga PNG-filerna OCH en handritad `phst-logo.svg` som föreställer ett
 * annat märke, och den senare gick att förväxla med den riktiga.
 *
 * ── Varför märket kommer ur CSS och inte ur ett `src` ──────────────────────
 *
 * Märket finns i två utföranden, mörkt bläck och gräddvitt. Vilket som ska
 * visas är samma fråga som vilken bakgrundsfärg som gäller, alltså en
 * temafråga, och den är redan löst en gång i tokenkontraktet med tre lägen.
 * Därför är märket ett token (`--logo-phst`) och ritas som bakgrundsbild.
 *
 * ⛔ Alternativet, `<picture>` med `prefers-color-scheme`, ser enklare ut och
 * är trasigt: det lyssnar bara på systemet. Den som kör mörk telefon men valt
 * ljust läge i appen hade fått gräddvitt märke på vit botten, alltså en tom
 * ruta. Som token ärver märket hela maskineriet, och bara den variant som
 * faktiskt visas laddas ner.
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
  /** För en plattform som inte ska bära PH.ST-märket alls. */
  none: null,
};

/**
 * ⛔ ORDMÄRKE OCH IKON SOM BILDER, VALFRITT (#164, korrigering B och punkt 9).
 *
 * CP mätt mot en skärmbild av SessionStudio: ordmärket är en BILD som "följer
 * temat", inte text ritad av CSS-tokens. `OpsBrand` känner fortfarande INTE
 * appens filer, precis som `lagring`/`sdk` på andra ställen i ramverket: appen
 * skickar in två URL:er per bild (`{ ljus, mork }`), en för varje upplöst
 * tema, och `OpsBrand` väljer med `useResolvedTheme()` (`src/lib/theme.js`).
 *
 * ⛔ VARFÖR INTE `<picture>`/`prefers-color-scheme`, SAMMA SVAR SOM FÖR
 * PH.ST-MÄRKET OVAN: det lyssnar bara på SYSTEMET, inte på personens eget val
 * i appen (ljust/mörkt/följ enheten). `useResolvedTheme()` är samma sanning
 * som resten av gränssnittet redan ritas efter.
 *
 * ⛔ UTAN BILDER RITAS NAMNET SOM TEXT, PRECIS SOM FÖRUT. `ordmarke`/`ikon` är
 * tillägg, inte ett krav: en app utan loggofiler (t.ex. under utveckling) får
 * ändå ett läsbart märke.
 *
 * @param {object} props
 * @param {string} props.title Produktens namn. "Operations Hub", "Bolag Ops". Alt-text när `ordmarke`/`ikon` ritas.
 * @param {string} [props.subtitle] Ägare eller sammanhang. Står i accentfärg under namnet. Ritas INTE när `ordmarke` finns:
 *   bilden bär redan hela märket, och en textrad under en bild ser ut som en bildtext ingen bad om.
 * @param {"phst"|"phst-estd"|"none"} [props.mark]
 * @param {{ ljus: string, mork: string }} [props.ordmarke] Ordmärket som bild. Ritas i BRED vy (och alltid när `ikon` saknas).
 * @param {{ ljus: string, mork: string }} [props.ikon] Ikonen som bild. Ritas i SMAL vy när `ordmarke` också finns.
 * @param {string} [props.ordmarkeMaxWidth] Tailwind-bredd på ordmärkets bild, t.ex. `"max-w-[330px]"` (OpsInloggning).
 *   Förval `"max-w-40"`, rätt mått för en topprad.
 */
export function OpsBrand({ title, subtitle, mark = "phst", ordmarke, ikon, ordmarkeMaxWidth = "max-w-40" }) {
  if (!title) throw new Error("OpsBrand: title krävs. Ett märke utan namn säger inte vilken app man är i, och är alt-texten när en bild ritas.");

  if (!(mark in MARKEN)) {
    throw new Error(`OpsBrand: okänt mark "${mark}". Giltiga: ${Object.keys(MARKEN).join(", ")}.`);
  }

  return ordmarke || ikon ? (
    <OpsBrandBild title={title} ordmarke={ordmarke} ikon={ikon} ordmarkeMaxWidth={ordmarkeMaxWidth} />
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
 * @param {{ title: string, ordmarke?: { ljus: string, mork: string }, ikon?: { ljus: string, mork: string }, ordmarkeMaxWidth: string }} props
 */
function OpsBrandBild({ title, ordmarke, ikon, ordmarkeMaxWidth }) {
  // ⛔ `useResolvedTheme()` SVARAR "light"/"dark" (samma `Temalage`-typ som
  // resten av `theme.js`). Bildernas nycklar är "ljus"/"mork", KORTFORMEN CP
  // gav i uppdraget, skild från `TEMAN` (grupp.js: "ljust"/"morkt"). Kartan
  // står HÄR, en gång, i stället för att varje anropsställe gissar rätt ord.
  const tema = useResolvedTheme() === "dark" ? "mork" : "ljus";

  if (ordmarke && ikon) {
    // ⛔ IKONEN I SMAL VY, ORDMÄRKET I BRED (#164 punkt 9). `hidden md:block` /
    // `md:hidden` är samma brytpunkt `OpsAppShell` redan använder för sin egen
    // topprad, inte ett nytt tal påhittat här.
    return (
      <span className="inline-flex items-center">
        <img src={ikon[tema]} alt={title} className="block h-8 w-auto md:hidden" />
        <img src={ordmarke[tema]} alt={title} className={cx("hidden md:block object-contain", ordmarkeMaxWidth)} />
      </span>
    );
  }

  const kalla = /** @type {{ ljus: string, mork: string }} */ (ordmarke ?? ikon);
  return <img src={kalla[tema]} alt={title} className={cx("block object-contain", ordmarke ? ordmarkeMaxWidth : "h-8 w-auto")} />;
}
