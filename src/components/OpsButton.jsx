import { cx } from "../lib/cx.js";
import { OpsSpinner } from "./OpsSpinner.jsx";

/**
 * Knapp.
 *
 * ⛔ Tar inte emot `className`, `style` eller `...rest`. Varianter ÄR API:et.
 * Saknas något: lägg till en variant här, lappa inte på anropsstället. Det är
 * den enda regeln som håller ihop resten, och den är vaktad av
 * `scripts/check-closed-api.mjs`.
 *
 * ══ ⛔ #164, CP-BESLUT 2026-09-28 18:20: "KNAPPARNA BLIR PILLER SOM
 * SESSIONSTUDIO." ═══════════════════════════════════════════════════════
 *
 * Textknappar (allt utom `iconOnly`) fick tidigare `rounded-md`, samma
 * skala som kort och paneler. Mätt mot SessionStudios EGEN knappklass,
 * `v7PrimaryButtonClass` i `apps/web/src/components/LoginScreen.jsx`:
 * `rounded-full`, en piller, inte ett kort med rundade hörn. CP:s ord är
 * beslutet, inte en tolkning av en skärmbild: knappen ÄR nu en piller.
 *
 * Ikonknappar (`iconOnly`) ändras INTE. De var redan `rounded-md` (en
 * kvadratisk träffyta med skarpare hörn, t.ex. "Ta bort länken"-krysset i
 * `OpsProfil`), och en ikonknapp som plötsligt blir en cirkel utan att någon
 * bad om det hade sett ut som en ny sorts kontroll mitt i en rad knappar som
 * inte ändrats. `round` (kräver `iconOnly`) gav redan cirkeln, för
 * Huvudatgard-knappen i bottenraden, och gör det fortfarande.
 *
 * ══ ⛔ SAMMA PASS, TYNGD OCH STORLEK: EN ANNAN AGENT MÄTTE VIDARE ═════════
 *
 * `font-semibold` (600) och `text-base` (16 px, `size="md"`) stod kvar från
 * innan pillerbeslutet och avvek från SessionStudio på BÅDA punkterna, mätt
 * mot `apps/web/src/views/ProfileView.jsx` rad ~604 (Spara-knappen) och flera
 * rader i `apps/web/src/components/AppHeader.jsx`: SessionStudios knappar är
 * `font-medium` (500), aldrig `font-semibold`, och Spara-knappens storlek är
 * `text-sm` (14 px), inte 16. Båda rättade i samma commit som pillerformen.
 * `min-h-11` (44 px träffyta) är ORÖRD: den är ett mått för tummen, inte för
 * texten.
 */

const VARIANTER = {
  primary: "border-transparent bg-accent text-accent-contrast hover:bg-accent-hover",
  secondary: "border-line-strong bg-raised text-ink hover:bg-sunken",
  ghost: "border-transparent text-ink-secondary hover:bg-accent-faint hover:text-ink",
  danger: "border-transparent bg-danger text-ink-inverse hover:bg-danger-hover",
};

/**
 * ⛔ Varken bredd eller höjd sätts i pixlar. En knapp som är exakt 32 px hög
 * klipper sin text så fort någon översätter etiketten till tyska. Höjden kommer
 * ur padding och radhöjd, alltså ur innehållet.
 *
 * `min-h-11` på md är däremot avsiktligt: 44 px är den minsta träffytan som
 * fungerar på en telefon, och den gränsen har vi mätt oss fram till en gång för
 * mycket.
 */
const STORLEKAR = {
  // ⛔ 0.31.0: SS `ui/PrimaryButton.jsx:44-47`: `sm` är `px-3 py-1.5 text-xs`, `md` `px-4 py-2 text-sm`. `sm` var `py-1 text-sm`.
  sm: "gap-1.5 px-3 py-1.5 text-meta min-h-8",
  // ⛔ text-sm, INTE text-base (#164, mätt av en annan agent mot
  // SessionStudios `ProfileView.jsx` rad ~604, Spara-knappen): 14 px, inte
  // 16 px. Höjden (min-h-11, 44 px träffyta) är ORÖRD: den är ett mått för
  // tummen, inte för texten, och de två frågorna svarar inte på varandra.
  md: "gap-2 px-4 py-2 text-etikett min-h-11",
};

const IKONSTORLEKAR = {
  sm: "px-1 py-1 min-w-8 min-h-8",
  md: "px-2 py-2 min-w-11 min-h-11",
};

// ⛔ Rund ikonknapp i header-klustret: syskonen (OpsIconLink/tema/helskärm) är
// 44 px träffyta med ~18–20 px glyph. En fylld `min-w-11`-cirkel såg ut som en
// jätte-FAB bredvid dem (bolag-ops). `size-8` (32 px) med p-0 håller rund form
// och låter 20 px-Plus sitta i samma skala; appen centrerar i 44 px-slot.
const RUND_IKONSTORLEKAR = {
  sm: "size-7 p-0",
  md: "size-8 p-0",
};

const BAS =
  // ⛔ font-medium, INTE font-semibold (#164, mätt av en annan agent mot
  // SessionStudios `ProfileView.jsx` r604 och flera rader i `AppHeader.jsx`):
  // 500, aldrig 600. Provet i `piller.test.jsx` är rött om font-semibold
  // kommer tillbaka.
  "inline-flex items-center justify-center border font-medium leading-tight " +
  "transition-colors duration-(--duration-fast) ease-standard " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:opacity-55 disabled:cursor-not-allowed aria-disabled:opacity-55 aria-disabled:cursor-not-allowed";

/**
 * Knappens klasser, för en yta som inte kan vara en `OpsButton` (0.83.0).
 *
 * ⛔ FÖR ATT EN AVTRYCKARE SKA SE UT SOM KNAPPEN UTAN ATT VARA EN KOPIA AV DEN. Radix `Popover.Trigger` ritar sitt eget
 * `<button>`, och `OpsButton` har ingen `forwardRef` (stängt API, se `OpsAppShell` om plusset), så "+ Ny" i biblioteket kan
 * inte vara en `OpsButton`. Klasserna bor därför här, och `OpsButton` läser samma funktion: en andra klasssträng hade
 * glidit isär första gången någon rörde knappen (regel 2). Varianten och storleken prövas i `OpsButton`, inte här.
 *
 * @param {{ variant?: keyof typeof VARIANTER, size?: keyof typeof STORLEKAR, iconOnly?: boolean, round?: boolean, fullWidth?: boolean }} [val]
 * @returns {string}
 */
export function knappKlass({ variant = "secondary", size = "md", iconOnly = false, round = false, fullWidth = false } = {}) {
  const variantKlass = VARIANTER[variant];
  const storlekKlass = iconOnly ? (round ? RUND_IKONSTORLEKAR[size] : IKONSTORLEKAR[size]) : STORLEKAR[size];
  return cx(
    BAS,
    // ⛔ #164, CP-BESLUT 2026-09-28 18:20: "KNAPPARNA BLIR PILLER SOM
    // SESSIONSTUDIO." Mätt mot `v7PrimaryButtonClass` i SessionStudios
    // `apps/web/src/components/LoginScreen.jsx`: `rounded-full`, inte
    // `rounded-md`. En TEXTKNAPP (`!iconOnly`) är sedan detta beslut ALLTID
    // en piller, oavsett variant, förvalet är inte längre valfritt. En
    // IKONKNAPP ändras INTE: den var redan `rounded-md` (kvadratisk träffyta,
    // t.ex. Ta bort-krysset i `OpsProfil`), och `round` ger fortfarande
    // cirkeln (Huvudatgard-knappen). Provet i `piller.test.jsx` är rött om
    // `rounded-md` kommer tillbaka på en textknapp.
    round || !iconOnly ? "rounded-full" : "rounded-md",
    variantKlass,
    storlekKlass,
    fullWidth && "w-full",
  );
}

/**
 * @param {object} props
 * @param {"primary"|"secondary"|"ghost"|"danger"} [props.variant]
 * @param {"sm"|"md"} [props.size]
 * @param {"button"|"submit"|"reset"} [props.type]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.busy] Visar och annonserar pågående arbete, och spärrar knappen.
 * @param {boolean} [props.fullWidth]
 * @param {boolean} [props.iconOnly] Kvadratisk träffyta. Kräver `ariaLabel`.
 * @param {boolean} [props.round] Cirkel (`rounded-full`). Kräver `iconOnly`. Samma accentform som bottenradens huvudåtgärd, men `size-8` (inte 44 px fylld skiva) så + i header-klustret matchar syskonikonernas skala.
 * @param {string} [props.href] Anges href renderas en länk i stället för en knapp.
 * @param {boolean} [props.newTab]
 * @param {string} [props.ariaLabel]
 * @param {string} [props.title]
 * @param {string} [props.id]
 * @param {string} [props.form] Id på det `<form>` en `type="submit"` hör till, när knappen står UTANFÖR formuläret (0.31.0: skapa-panelens fasta knapprad).
 * @param {(event: any) => void} [props.onClick]
 * @param {import("react").ReactNode} props.children
 */
export function OpsButton({
  variant = "secondary",
  size = "md",
  type = "button",
  disabled = false,
  busy = false,
  fullWidth = false,
  iconOnly = false,
  round = false,
  href,
  newTab = false,
  ariaLabel,
  title,
  id,
  form,
  onClick,
  children,
}) {
  const variantKlass = VARIANTER[variant];
  if (!variantKlass) {
    throw new Error(
      `OpsButton: okänd variant "${variant}". Giltiga: ${Object.keys(VARIANTER).join(", ")}. ` +
        "En femte variant läggs till i OpsButton.jsx, inte på anropsstället.",
    );
  }
  const storlekKlass = iconOnly
    ? (round ? RUND_IKONSTORLEKAR[size] : IKONSTORLEKAR[size])
    : STORLEKAR[size];
  if (!storlekKlass) {
    throw new Error(`OpsButton: okänd size "${size}". Giltiga: ${Object.keys(STORLEKAR).join(", ")}.`);
  }

  // ⛔ En ikonknapp utan namn är osynlig för skärmläsare och för röststyrning.
  // Att låta det passera är att bygga in ett tillgänglighetsfel som ingen ser
  // förrän någon faktiskt behöver det, alltså när det är dyrast att laga.
  if (iconOnly && !ariaLabel) {
    throw new Error("OpsButton: iconOnly kräver ariaLabel. En ikon utan namn går inte att nå med tangentbord eller röst.");
  }

  // ⛔ `round` utan `iconOnly` ger en textknapp med cirkelhörn — alltså en
  // pillerform som inte är den rundade plusknappen. Kräv båda så formen
  // betyder samma sak överallt: cirkel = ikonmitten, som Huvudatgard.
  if (round && !iconOnly) {
    throw new Error(
      "OpsButton: round kräver iconOnly. En rund textknapp är en pillerform, inte bottenradens cirkel.",
    );
  }

  const klass = knappKlass({ variant, size, iconOnly, round, fullWidth });
  const blocked = disabled || busy;

  /**
   * ⛔ `busy` satte tidigare BARA `aria-busy` och spärrade knappen. Det betydde
   * att en skärmläsare fick beskedet medan ögat fick en knapp som såg
   * avstängd ut utan förklaring, alltså precis tvärtom mot hur den sortens
   * fel brukar se ut. Den som klickar "Spara" och möter en grå knapp utan
   * rörelse klickar igen, eller lämnar sidan mitt i skrivningen.
   *
   * ⛔ Etiketten står KVAR bredvid snurran. Att byta ut den mot enbart en
   * snurra gör att knappen ändrar bredd i samma ögonblick som den spärras, och
   * då hoppar allt som ligger bredvid. Undantaget är `iconOnly`, som inte har
   * någon etikett att behålla.
   *
   * Snurran är `decorative`: knappen bär redan `aria-busy`, och två besked om
   * samma väntan är värre än ett.
   */
  const innehall = busy ? (
    <>
      <OpsSpinner size="sm" tone="current" decorative />
      {iconOnly ? null : children}
    </>
  ) : (
    children
  );

  if (href) {
    // En spärrad länk har inget href. `pointer-events-none` räcker inte: den
    // stoppar musen men inte tangentbordet, och länken är kvar i tabordningen.
    return (
      <a
        id={id}
        className={klass}
        href={blocked ? undefined : href}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noreferrer noopener" : undefined}
        aria-label={ariaLabel}
        aria-disabled={blocked || undefined}
        aria-busy={busy || undefined}
        title={title}
        onClick={blocked ? undefined : onClick}
      >
        {innehall}
      </a>
    );
  }

  return (
    <button
      id={id}
      form={form}
      className={klass}
      type={type}
      disabled={blocked}
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      title={title}
      onClick={onClick}
    >
      {innehall}
    </button>
  );
}
