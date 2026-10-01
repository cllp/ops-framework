import { cx } from "../lib/cx.js";
import { gruppRutaKlass } from "../lib/radKlass.js";

/**
 * Märket i skalet: TEXT, inte en bild (0.31.0).
 *
 * ══ ⛔ CP 2026-09-29: "VI TAR BORT BILDER, KÖR MED TEXT" ═══════════════════
 *
 * "Font: Glacial Indifference Regular. Colors: Light Gray och Gray Orange. Ha
 * detta både på inloggning och inne i appen. Följ detta exakt." Före 0.31.0
 * var märket fyra webp-bilder (OPS Hub) plus PH.ST-märket i fyra utföranden,
 * med generatorer, vakter och ett bildläge i den här komponenten. De är
 * borta. Det som finns kvar är text i två rader och ett monogram, och allt
 * som gör att det ser ut som CP:s förlaga är tokens (`tokens/tokens.css`,
 * `--marke-*`, `--font-marke`, `--color-marke-accent`), aldrig en literal här.
 *
 *   Utfälld (180 px, panelens innehållsbredd):   Infälld / mobil (40 px):
 *
 *        O P S  H U B                              ┌────┐
 *   C L A E S  P H I L I P  S T A I G E R  A B     │ OH │
 *                                                   └────┘
 *
 * Rad 1 är `namn`: första ordet ljusgrått (`ink`), andra ordet gråorange
 * (`marke-accent`). Rad 2 är `undertext`: appens eller gruppens namn, mindre,
 * ljusgrå. Båda är versaler med spärrning mätt i CP:s bild (`cp-utfalld.webp`),
 * se CHANGELOG 0.31.0 och tokenkommentaren för hur.
 *
 * ── ⛔ #203: OH OCH GRUPPEN, INTE OH ELLER GRUPPEN ─────────────────────────
 *
 * CP 2026-09-30: "OH kvarstår (plattformskoncept OPS HUB). Bredvid OH: aktivt
 * gruppnamn (max ~20 tecken, truncate) så det är tydligt vilken grupp man
 * jobbar i. Desktop infällt grupper-panel: OH | Travel (inte byta ut OH mot
 * gruppbokstäver). [...] Appnamn (Bolag Ops) ≠ OH ≠ grupp, tre lager." Den
 * infällda panelen visade bara monogrammet OH, så man såg inte vilken grupp
 * man arbetade i förrän panelen fälldes ut. Nu står OH kvar OCH gruppens namn
 * bredvid (`data-marke="gruppnamn"`), avkortat i CSS vid ungefär 20 tecken
 * (`max-w-[calc(20ch+20*spärrningen)]`, `truncate`), med hela namnet i `title` och
 * i skärmläsartexten. OH byts aldrig mot gruppens bokstäver: gruppens märke är
 * remsans och gruppväxlarens, inte märkets. Utfälld och på telefon är det som
 * förut (rad 2 respektive bara gruppmärket): tre rader som tävlar om 56 px är
 * det CP bad oss undvika.
 *
 * ── Rörelse och placering, som SessionStudio (`AppHeader.jsx:174-193`) ───
 *
 * Med `panelInfalld` (skalet skickar den när `grupper` finns) ritas BÅDA
 * formerna alltid, och växlingen är en opacity-crossfade på 200 ms, aldrig
 * mount/unmount (samma lärdom som `AppSidebar.jsx:13-16`: en nod som kommer
 * och går ur DOM:en trasslar layouten i samma tick som opaciteten hade kunnat
 * sköta ensam). Rutan är 180 px från `md` när panelen är utfälld, annars 40 px,
 * och står över panelens INNEHÅLLSBREDD (`--panel-kant` in från panelens kant),
 * så ordmärkets mittlinje är kortens mittlinje och monogramrutan är exakt en
 * remsruta (`gruppRutaKlass`, samma funktion som remsan). Utan `panelInfalld`
 * (mobil eller en app utan grupper): monogramrutan under `md`, ordmärket från `md`.
 *
 * ⛔ SPÄRRNINGEN LÄGGER ETT TOMT AVSTÅND EFTER SISTA BOKSTAVEN. Utan
 * kompensation hamnar den synliga texten en halv spärrning till vänster om
 * mitten, och CP:s krav är att mittlinjerna stämmer inom 1 px. Därför bär varje
 * rad lika mycket `padding-left` som den har spärrning.
 *
 * ── Tillgänglighet ─────────────────────────────────────────────────────────
 *
 * Ordmärket och monogrammet är `aria-hidden` och namnet står EN gång som
 * `sr-only`-text: annars läser en skärmläsare samma märke två gånger (båda
 * formerna finns i DOM:en) och en tredje gång i länkens namn.
 *
 * @typedef {string | { forsta: string, andra?: string }} MarkeNamn
 */

/**
 * Delar ett namn i första ordet och resten. `{ forsta, andra }` används som det är.
 * @param {MarkeNamn} namn
 * @returns {{ forsta: string, andra: string }}
 */
export function delaNamn(namn) {
  if (typeof namn === "object" && namn !== null) {
    return { forsta: String(namn.forsta ?? "").trim(), andra: String(namn.andra ?? "").trim() };
  }
  const ord = String(namn).trim().split(/\s+/).filter(Boolean);
  return { forsta: ord[0] ?? "", andra: ord.slice(1).join(" ") };
}

/**
 * Förvalt monogram: första bokstaven i varje ord ("OPS HUB" blir "OH").
 * @param {string} forsta @param {string} andra
 * @returns {string}
 */
export function standardMonogram(forsta, andra) {
  return [...forsta.split(/\s+/), ...andra.split(/\s+/)]
    .filter(Boolean)
    .map((ord) => [...ord][0].toLocaleUpperCase())
    .join("");
}

/**
 * Ordmärkets två rader. Delas av toppradens ordmärke och inloggningens.
 * @param {{ forsta: string, andra: string, undertext?: string, stor?: boolean }} props
 */
function Rader({ forsta, andra, undertext, stor = false }) {
  return (
    <>
      <span
        data-marke="rad1"
        className={cx(
          "block max-w-full whitespace-nowrap",
          stor ? "text-(length:--marke-storlek-stor)" : "text-(length:--marke-storlek)",
          "tracking-(--marke-sparrning) pl-(--marke-sparrning)",
        )}
      >
        <span className="text-ink">{forsta}</span>
        {andra ? (
          <>
            {" "}
            <span className="text-marke-accent">{andra}</span>
          </>
        ) : null}
      </span>
      {undertext ? (
        <span
          data-marke="rad2"
          className={cx(
            "block max-w-full truncate text-ink",
            stor ? "text-(length:--marke-undertext-stor)" : "text-(length:--marke-undertext)",
            "tracking-(--marke-undertext-sparrning) pl-(--marke-undertext-sparrning)",
          )}
        >
          {undertext}
        </span>
      ) : null}
    </>
  );
}

/**
 * Raderna i sin kolumn: centrerade, i märkets typsnitt, versaler.
 * @param {{ children: import("react").ReactNode, className?: string }} props
 */
function Kolumn({ children, className }) {
  return (
    <span className={cx("flex min-w-0 flex-col items-center justify-center gap-(--marke-radavstand) text-center font-marke leading-none uppercase", className)}>
      {children}
    </span>
  );
}

/**
 * Monogrammet: första bokstaven ljusgrå, resten gråorange.
 * @param {{ tecken: string }} props
 */
function Monogram({ tecken }) {
  const [forsta, ...rest] = [...tecken];
  return (
    <span className="font-marke text-(length:--marke-monogram) leading-none tracking-(--marke-monogram-sparrning) pl-(--marke-monogram-sparrning)">
      <span className="text-ink">{forsta}</span>
      <span className="text-marke-accent">{rest.join("")}</span>
    </span>
  );
}

/**
 * @param {object} props
 * @param {MarkeNamn} [props.namn] Rad 1. Förval "OPS HUB". Första ordet ljusgrått, resten gråorange. Ett objekt `{ forsta, andra }` bestämmer delningen själv.
 * @param {string} [props.undertext] Rad 2: appens eller gruppens namn. Utelämnad: bara rad 1, centrerad lodrätt. ⛔ Skalet sätter den till den aktiva gruppens namn när `grupper` finns och en grupp är vald, och faller annars tillbaka på det här värdet.
 * @param {string} [props.monogram] Tecknen i monogramrutan. Förval: första bokstaven i varje ord i `namn` ("OH").
 * @param {boolean} [props.panelInfalld] Grupp-panelens läge, NÄR `OpsAppShell`s `grupper`-panel finns (skalet sätter den). Given: båda formerna är monterade och växlar med en crossfade på 200 ms i en ruta som är 180 px (utfälld, från `md`) eller 40 px (infälld, alltid under `md`). Utelämnad: monogramrutan under `md`, ordmärket från `md`.
 * @param {"topp" | "stor"} [props.storlek] `"topp"` (förval): toppradens storlek, ryms i 56 px. `"stor"`: inloggningens (rad 1 32 px), bara ordmärket, centrerat, aldrig något monogram.
 */
export function OpsBrand({ namn = "OPS HUB", undertext, monogram, panelInfalld, storlek = "topp" }) {
  const { forsta, andra } = delaNamn(namn);
  if (!forsta) {
    throw new Error("OpsBrand: namn får inte vara tomt. Märket är text, och utan text är det ingenting att rita. Utelämna propen för förvalet \"OPS HUB\".");
  }
  if (storlek !== "topp" && storlek !== "stor") {
    throw new Error(`OpsBrand: okänd storlek "${storlek}". Giltiga: topp, stor.`);
  }
  const under = typeof undertext === "string" && undertext.trim() !== "" ? undertext.trim() : undefined;
  const heltNamn = [forsta, andra].filter(Boolean).join(" ");

  if (storlek === "stor") {
    // Inloggningen: ordmärket ensamt, centrerat. Texten är synlig och läses som den är, ingen dubblett att dölja.
    return (
      <Kolumn className="w-full">
        <Rader forsta={forsta} andra={andra} undertext={under} stor />
      </Kolumn>
    );
  }

  const tecken = monogram ?? standardMonogram(forsta, andra);
  const namnForSkarmlasare = under ? `${heltNamn}, ${under}` : heltNamn;
  const ordmarke = (
    <Kolumn className="size-full">
      <Rader forsta={forsta} andra={andra} undertext={under} />
    </Kolumn>
  );
  const monogramRuta = (
    <span data-marke="ruta" className={cx(gruppRutaKlass({ interaktiv: false }), "font-marke")}>
      <Monogram tecken={tecken} />
    </span>
  );

  if (typeof panelInfalld === "boolean") {
    return (
      <>
      <span
        className={cx(
          "relative block h-10 shrink-0 lg:ml-(--panel-kant)",
          panelInfalld ? "w-(--logo-bredd-infalld)" : "w-(--logo-bredd-infalld) md:w-(--logo-bredd)",
        )}
      >
        <span className="sr-only">{namnForSkarmlasare}</span>
        {/* Båda formerna ALLTID i DOM:en, växlingen är opacity (SS `AppHeader.jsx:174-193`). */}
        <span
          data-marke="ordmarke"
          aria-hidden="true"
          className={cx(
            "absolute inset-0 transition-opacity duration-200 ease-out",
            panelInfalld ? "pointer-events-none opacity-0" : "opacity-100 max-md:pointer-events-none max-md:opacity-0",
          )}
        >
          {ordmarke}
        </span>
        <span
          data-marke="monogram"
          aria-hidden="true"
          className={cx(
            "absolute inset-y-0 left-0 transition-opacity duration-200 ease-out",
            panelInfalld ? "opacity-100" : "pointer-events-none opacity-0 max-md:pointer-events-auto max-md:opacity-100",
          )}
        >
          {monogramRuta}
        </span>
      </span>
      {/* ⛔ #203: INFÄLLD PANEL, DATOR: OH + DEN AKTIVA GRUPPENS NAMN. Se filhuvudet. Ett SYSKON till rutan och inte ett barn:
          rutan (`a > span:first-child`) är fortfarande exakt 40 px över panelens innehållsbredd, och namnet tar sin egen
          plats i raden så att flikarna flyttas undan i stället för att läggas under det. Utfälld syns namnet redan som
          rad 2 i ordmärket, så här ritas det bara när panelen är infälld, och bara från `lg` (där panelen finns; under
          `lg` bär gruppväxlaren namnet). Avkortningen är CSS, inte en `slice` av strängen, så hela namnet finns kvar för
          `title` och skärmläsare. */}
      {under ? (
        <span
          data-marke="gruppnamn"
          aria-hidden="true"
          title={under}
          className={cx("hidden min-w-0 items-center gap-2 font-marke uppercase", panelInfalld && "lg:flex")}
        >
          <span className="h-4 w-px shrink-0 bg-line-strong" />
          <span
            className="block truncate text-ink text-(length:--marke-storlek) leading-none tracking-(--marke-undertext-sparrning) max-w-[calc(20ch+20*var(--marke-undertext-sparrning))]"
          >
            {under}
          </span>
        </span>
      ) : null}
      </>
    );
  }

  // Utan panel: monogramrutan under md, ordmärket från md. Ingen crossfade, det är två skärmstorlekar och inte ett tillstånd.
  return (
    <span className="inline-flex h-10 items-center">
      <span className="sr-only">{namnForSkarmlasare}</span>
      <span data-marke="monogram" aria-hidden="true" className="md:hidden">
        {monogramRuta}
      </span>
      <span data-marke="ordmarke" aria-hidden="true" className="hidden md:flex md:h-full md:items-center">
        <Kolumn className="px-1">
          <Rader forsta={forsta} andra={andra} undertext={under} />
        </Kolumn>
      </span>
    </span>
  );
}
