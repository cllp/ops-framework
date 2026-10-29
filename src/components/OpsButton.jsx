import { useEffect, useRef, useState } from "react";
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
  // ⛔ 0.153.0 (cllp/ops-framework#460 punkt 2): 44 px hög under md, 32 från md. lifehub.app:s `check:layout` mätte `sm` till 32 till 36 px på telefon, och en liten knapp är inte mindre träffbar på en
  // telefon än en stor: tummen är lika bred. Samma gräns som toastens stängknapp (`min-h-11 md:min-h-8`). Höjden kommer ur `min-h`, inte ur padding, så texten sitter lika högt som förut på dator.
  sm: "gap-1.5 px-3 py-1.5 text-meta min-h-11 md:min-h-8",
  // ⛔ text-sm, INTE text-base (#164, mätt av en annan agent mot
  // SessionStudios `ProfileView.jsx` rad ~604, Spara-knappen): 14 px, inte
  // 16 px. Höjden (min-h-11, 44 px träffyta) är ORÖRD: den är ett mått för
  // tummen, inte för texten, och de två frågorna svarar inte på varandra.
  md: "gap-2 px-4 py-2 text-etikett min-h-11",
};

const IKONSTORLEKAR = {
  sm: "px-1 py-1 min-w-11 min-h-11 md:min-w-8 md:min-h-8",
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
 * @param {boolean} [props.busy] Visar och annonserar pågående arbete, och spärrar knappen. ⛔ UTELÄMNAD (0.129.0) sköter knappen det själv: ger
 *   `onClick` ett löfte är knappen upptagen tills löftet är klart, och ett andra tryck under tiden gör ingenting. SÄTTS den (också till `false`)
 *   är det appens: knappen rör då varken snurra eller spärr, eftersom två som styr samma tillstånd glider isär.
 * @param {string} [props.busyLabel] (0.141.0) Verbet i pågående form medan knappen väntar: "Sparar…", "Kopplar…", "Tar bort…". Står bredvid snurran i stället för
 *   etiketten, och knappen behåller etikettens bredd (den osynliga etiketten ligger kvar under verbet, så ingenting intill hoppar när knappen spärras).
 *   Ignoreras av en ikonknapp (ingen etikett) och när knappen inte väntar. Utelämnad står etiketten kvar, som förut.
 * @param {boolean} [props.fullWidth]
 * @param {boolean} [props.iconOnly] Kvadratisk träffyta. Kräver `ariaLabel`.
 * @param {boolean} [props.round] Cirkel (`rounded-full`). Kräver `iconOnly`. Samma accentform som bottenradens huvudåtgärd, men `size-8` (inte 44 px fylld skiva) så + i header-klustret matchar syskonikonernas skala.
 * @param {string} [props.href] Anges href renderas en länk i stället för en knapp.
 * @param {boolean} [props.newTab]
 * @param {string} [props.ariaLabel]
 * @param {string} [props.title]
 * @param {string} [props.id]
 * @param {string} [props.form] Id på det `<form>` en `type="submit"` hör till, när knappen står UTANFÖR formuläret (0.31.0: skapa-panelens fasta knapprad).
 * @param {(event: any) => void | Promise<unknown>} [props.onClick] Ett returnerat löfte gör knappen upptagen tills det är klart (se `busy`).
 * @param {import("react").ReactNode} props.children
 */
export function OpsButton({
  variant = "secondary",
  size = "md",
  type = "button",
  disabled = false,
  busy,
  busyLabel,
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
  /*
   * ══ ⛔ EN KNAPP SOM VÄNTAR VISAR DET (0.129.0, cllp/lifehub.app#217) ═════════════════════════════════════════════
   *
   * CP 2026-10-13: "Vi behöver ha en progress bar på saker och ting som dröjer, till exempel avfärda, spara, överallt, så att man vet vad som
   * händer i appen." Före 0.129.0 visade bara de knappar som själva skrev `busy={...}` att något pågick, och det var en sak per anropsställe att
   * komma ihåg: mätt över ramverket hade drygt hälften av knapparna vars `onClick` ger ett löfte (Radera, Ta bort, Arkivera, Spara i
   * katalogen, Skapa grupp) ingen `busy`. Tryckte man på en av dem hände ingenting synligt, och man tryckte igen.
   *
   * ⛔ KNAPPEN SKÖTER DET SJÄLV NÄR `onClick` GER ETT LÖFTE OCH `busy` INTE ÄR SATT, så att ingen kan glömma det. Upptagen betyder snurra,
   * `aria-busy` och spärr, som med `busy`. Spärren sitter också i en `ref`, inte bara i tillståndet: två tryck i samma tick (en dubbelklick)
   * ser båda ett tillstånd som ännu inte ritats om.
   *
   * ⛔ ETT LÖFTE SOM FALLER SVÄLJS INTE. Knappen blir ledig igen, och avslagningen når den som hör efter (ett `unhandledrejection` precis som
   * förut, eftersom knappen aldrig var den som skulle fånga felet). Knappen visar inget fel: den vet inte vad felet betyder för just den ytan.
   *
   * ⛔ ÄR `busy` SATT, OCKSÅ TILL `false`, RÖR KNAPPEN INGET. Appen styr då, och en spärr som knappen la ovanpå hade kunnat stå kvar utan att
   * något syntes (en grå knapp utan snurra är precis felet det här ska ta bort).
   *
   * ⛔ ETT RETURVÄRDE SOM INTE ÄR ETT LÖFTE LÄMNAS ORÖRT: de allra flesta knappar öppnar, stänger eller byter något direkt.
   */
  const [egenBusy, setEgenBusy] = useState(false);
  const pagar = useRef(false);
  const monterad = useRef(true);
  useEffect(() => {
    monterad.current = true;
    return () => {
      monterad.current = false;
    };
  }, []);
  /** @param {any} event */
  const klick = (event) => {
    if (!onClick) return undefined;
    if (busy !== undefined) return onClick(event);
    if (pagar.current) {
      // Ett andra tryck medan det första väntar: ingenting, och inte heller formulärets submit för en `type="submit"` med egen onClick.
      event?.preventDefault?.();
      return undefined;
    }
    const svar = onClick(event);
    if (svar && typeof svar.then === "function") {
      pagar.current = true;
      setEgenBusy(true);
      const klart = () => {
        pagar.current = false;
        if (monterad.current) setEgenBusy(false);
      };
      Promise.resolve(svar).finally(klart);
    }
    return svar;
  };

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
  const upptagen = busy === undefined ? egenBusy : busy;
  const blocked = disabled || upptagen;

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
  /*
   * ══ ⛔ VERBET I PÅGÅENDE FORM (0.141.0, CP 2026-10-23) ═══════════════════════════════════════════════════════════
   *
   * CP, om en knapp som blev blek utan att något syntes medan servern svarade: "Medans man kopplar måste man få en progress." En snurra säger
   * att något pågår, men inte vad. `busyLabel` ("Kopplar…") säger det. Etiketten ligger kvar OSYNLIG i samma ruta (ett rutnät med en cell), så
   * knappen är exakt lika bred som verbet eller etiketten, den bredaste av dem, och ingenting bredvid hoppar. Den osynliga kopian är
   * `aria-hidden`: skärmläsaren hör verbet, inte båda.
   */
  const etikett =
    busyLabel && !iconOnly ? (
      <span className="inline-grid">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5">
          {children}
        </span>
        <span className="col-start-1 row-start-1 text-center">{busyLabel}</span>
      </span>
    ) : (
      children
    );
  const innehall = upptagen ? (
    <>
      <OpsSpinner size="sm" tone="current" decorative />
      {iconOnly ? null : etikett}
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
        aria-busy={upptagen || undefined}
        title={title}
        onClick={blocked ? undefined : klick}
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
      aria-busy={upptagen || undefined}
      title={title}
      onClick={klick}
    >
      {innehall}
    </button>
  );
}
