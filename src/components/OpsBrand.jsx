import { cx } from "../lib/cx.js";

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
 * @param {object} props
 * @param {string} props.title Produktens namn. "Operations Hub", "Bolag Ops".
 * @param {string} [props.subtitle] Ägare eller sammanhang. Står i accentfärg under namnet.
 * @param {"phst"|"phst-estd"|"none"} [props.mark]
 */
export function OpsBrand({ title, subtitle, mark = "phst" }) {
  if (!title) throw new Error("OpsBrand: title krävs. Ett märke utan namn säger inte vilken app man är i.");

  if (!(mark in MARKEN)) {
    throw new Error(`OpsBrand: okänt mark "${mark}". Giltiga: ${Object.keys(MARKEN).join(", ")}.`);
  }
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
