import { cx } from "./cx.js";

/**
 * Klasserna för EN rad i en meny, en dropdown, ett ark eller plussets lista.
 *
 * ══ ⛔ EN FUNKTION, INTE FYRA KOPIOR (0.30.0, #173) ═══════════════════════
 *
 * Före 0.30.0 ritades samma rad på fyra ställen med fyra handskrivna
 * klasssträngar: `OpsPanelRow`, toppradens dropdown i `OpsAppShell`,
 * arkets `SheetPost` och (i tanken) appens egna länkar. Två av dem hade
 * `rounded-sm` och `hover:bg-accent-faint`, en tredje `rounded-md`, och
 * ingen av dem såg ut som SessionStudios rad. CP 2026-09-29: hover och
 * rundning "ska vara som SS". Att rätta fyra kopior är att rätta fyra gånger
 * och missa en, så raden bor här.
 *
 * ⛔ MÄTT UR SESSIONSTUDIO, INTE VALD (`apps/web/src/components/`):
 *   - `MobileHamburgerMenu.jsx:288`: `w-full flex items-center gap-2.5 px-3
 *     py-2.5 rounded-[var(--radius)] text-xs text-secondary hover:bg-card`
 *   - `MobileHamburgerMenu.jsx:346`: aktiv rad `bg-card text-accent`
 *   - `AppHeader.jsx:384`: plussets rad `px-4 py-2.5`, `gap-3`, `text-sm
 *     font-medium`, accent
 * `--radius` är fixturens `radier.bas` (12 px), alltså `rounded-base`, och
 * `bg-card` är fixturens `raised`. Behållaren ska därför vara `bg-surface`,
 * annars finns ingen skillnad att se: se `radBehallare`.
 *
 * @param {object} [val]
 * @param {boolean} [val.accent] Plussets rad: större, accentfärgad, alltid.
 * @param {boolean} [val.active] "Du är här": `bg-raised text-accent`.
 * @param {boolean} [val.klickbar] Ger pekaren. Förval sant.
 * @returns {string}
 */
export function radKlass({ accent = false, active = false, klickbar = true } = {}) {
  return cx(
    "flex min-h-11 w-full items-center rounded-base text-left transition-colors duration-(--duration-fast) ease-standard",
    accent ? "gap-3 px-4 py-2.5 text-sm font-medium text-accent hover:bg-raised" : "gap-2.5 px-3 py-2.5 text-xs",
    !accent && (active ? "bg-raised text-accent" : "text-ink-secondary hover:bg-raised hover:text-ink"),
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
    klickbar && "cursor-pointer",
  );
}

/**
 * Behållaren en rad ritas i: meny, dropdown, popover, ark.
 *
 * ⛔ `bg-surface`, INTE `bg-raised`. Radens hover är `bg-raised`, och en rad
 * som hovrar mot en behållare av samma färg är osynlig. SessionStudio ritar
 * behållaren i `--color-bg-surface` (`AppHeader.jsx:384`, `:514`) av just det
 * skälet. `shadow-lg` och inte SS:s `shadow-xl`: ramverkets skuggskala har tre
 * steg (fixturen `skuggor`), och ett fjärde vore ett eget beslut.
 *
 * @param {object} [val]
 * @param {boolean} [val.ark] Ett ark som glider upp från botten: `rounded-t-card` i stället för runt om (SS `rounded-t-2xl`, `MobileHamburgerMenu.jsx:118`).
 * @returns {string}
 */
export function radBehallare({ ark = false } = {}) {
  return cx("border-line bg-surface shadow-lg", ark ? "rounded-t-card border-t" : "rounded-base border");
}

/**
 * Ikonknappar i toppraden: plusset, hamburgaren, ikonlänkarna (inkorgen, klockan).
 * En CIRKEL, inte en rundad ruta.
 *
 * ══ ⛔ MÄTT UR SESSIONSTUDIO (0.30.0, #173) ═══════════════════════════════
 *
 * `AppHeader.jsx:360` (sök), `:376` (plus) och `:494` (hamburgare) är alla
 * `p-2 ... rounded-full transition-colors` med `hover:bg-[var(--color-bg-card)]`
 * och en 20 px ikon (`w-5 h-5`): 8 + 20 + 8 = 36 px synlig cirkel. Före 0.30.0
 * var de `min-h-11 min-w-11 rounded-md` (44 px rundad ruta) utom plusset, som
 * var en 32 px accentfylld cirkel. Fyra knappar i samma rad med tre olika
 * former och tre olika höjder.
 *
 * ⛔ 44 PX TRÄFFYTA BEHÅLLS, MEN SOM EN OSYNLIG YTA. Storleken man SER är 36;
 * storleken man TRÄFFAR är 44 (`after:size-11`), utan att röra radens höjd.
 * Samma lösning som toppradens chevron redan hade (#90): en synlig storlek som
 * ändras för att kroppen ska se rätt ut får inte dra ner tumkravet med sig.
 *
 * ⛔ DISPLAY ÄGS AV ANROPSSTÄLLET (`visning`). Tailwind skriver `.hidden` före
 * `.inline-flex`, så en knapp som bär båda får `inline-flex` och syns på mobil.
 * Samma fälla som toppradens flikar (se `OpsAppShell`).
 *
 * @param {object} [val]
 * @param {string} [val.visning] Display-klasserna, t.ex. "inline-flex" eller "hidden md:inline-flex".
 * @param {boolean | "mork"} [val.aktiv] `true`: menyn den öppnar är öppen, `bg-raised text-accent`. `"mork"`: man står på sidan (en ikonlänk), mörkare bläck och ingen platta, eftersom en platta i klustret läses som ett påslaget läge.
 * @returns {string}
 */
export function huvudknappKlass({ visning = "inline-flex", aktiv = false } = {}) {
  return cx(
    "relative size-9 shrink-0 cursor-pointer items-center justify-center rounded-full p-2 [&_svg]:size-5",
    visning,
    "transition-colors duration-(--duration-fast) ease-standard",
    aktiv === true && "bg-raised text-accent",
    aktiv === "mork" && "text-ink hover:bg-raised",
    !aktiv && "text-ink-muted hover:bg-raised hover:text-ink-secondary",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    // Träffytan, 44 px, utanför flödet.
    "after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
  );
}

/**
 * En 40 px ruta med kant: en post i den infällda gruppremsan, chevronknappen där, och
 * loggans monogram (0.31.0). EN definition, för att de tre ska vara samma ruta.
 *
 * ══ ⛔ VARFÖR MONOGRAMMET HÄMTAR SIN RUTA HÄR (CP 2026-09-29) ════════════════
 *
 * "Infällt: monogrammet OH centreras i en ruta som är EXAKT samma som gruppernas
 * rutor i remsan: samma storlek, rundning, kantfärg och kantbredd, samma yta."
 * Skrivs rutan två gånger (en i `OpsGruppanel`, en i `OpsBrand`) glider den isär
 * första gången någon rättar den ena, och märket står då snett mot remsan under
 * sig. Mätt förlaga: SS `AppSidebar.jsx:54,77,89` (`w-10 h-10 ... rounded-[var(--radius)] border`).
 *
 * @param {object} [val]
 * @param {boolean} [val.vald] Vald grupp: accentkant och tonad yta.
 * @param {boolean} [val.interaktiv] Hover på kanten. Förval sant; monogrammet är ingen knapp och sätter falskt.
 * @returns {string}
 */
export function gruppRutaKlass({ vald = false, interaktiv = true } = {}) {
  return cx(
    "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-base border p-0.5 transition-all",
    vald ? "border-accent bg-accent/10 shadow-sm" : cx("border-line bg-surface", interaktiv && "hover:border-line-strong"),
  );
}
