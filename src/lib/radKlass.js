import { cx } from "./cx.js";

/** @type {Record<number, string>} */
const PY = { 1.5: "py-1.5", 2: "py-2", 2.5: "py-2.5", 3: "py-3" };

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
 * @param {boolean} [val.vald] Raden är ETT VAL i en lista (`true` = det valda, `false` = ett av de andra), inte en destination. Valt: `bg-accent-subtle text-ink` och en accentbock (SS `--color-gold-overlay-subtle`, `text-primary`, `ThemedDropdown.jsx:122`); övriga hovrar i `bg-hover` (SS `themedSelectShared.js:82`, `FormDropdown`). ⛔ `raised` går inte att använda här: i ljust läge är den SAMMA färg som behållarens `surface`, så en vald rad syntes inte alls.
 * @param {1.5 | 2 | 2.5 | 3} [val.py] Radens lodräta luft. ⛔ 0.31.2 (koordinatorn: "CP vill exakt SS"): `2.5` är AppHeaderns menyrad (`AppHeader.jsx:514`, `py-2.5`, förval); `1.5` är ThemedDropdown-motsvarigheterna (`ThemedDropdown.jsx:122`, `py-1.5`, filter, chip, tema); `2` formulärlistor och gruppfiltret; `3` `InviteGroupPickerDialog`. Höjden är SS egen från `md` (`md:min-h-0`, radhöjd = 16 eller 20 px text + 2 x luften), och 44 px träffyta under `md`.
 * ⛔ `py: 1.5` ger OCKSÅ `font-medium` (500): ThemedDropdown-raden är `font-medium` (`ThemedDropdown.jsx:122`), mätt i skalyta avsnitt 18.
 * @param {boolean} [val.stor] Raden bär mer än en textrad (märke, namn, antal): `text-sm`, `gap-3`. SS `InviteGroupPickerDialog.jsx:33-36` (`gap-3`, `text-sm`) och `EventStatusDropdown.jsx:34` (`px-3 py-2`, `text-sm`).
 * @param {boolean} [val.accentFarg] Raden är en åtgärd i accentfärg ('Rensa'), inte ett val och inte plussets stora rad.
 * @returns {string}
 */
export function radKlass({ accent = false, active = false, klickbar = true, accentFarg = false, stor = false, vald, py = 2.5 } = {}) {
  const luft = PY[py] ?? PY[2.5];
  return cx(
    "flex min-h-11 md:min-h-0 w-full items-center rounded-base text-left transition-colors duration-(--duration-fast) ease-standard",
    accent ? "gap-3 px-4 py-2.5 text-etikett leading-5 font-medium text-accent hover:bg-raised" : stor ? cx("gap-3 px-3 text-etikett leading-5", luft) : cx("gap-2.5 px-3 text-meta leading-4", luft, py === 1.5 && "font-medium"),
    !accent && vald !== undefined && (vald ? "bg-accent-subtle text-ink" : "text-ink-secondary hover:bg-hover hover:text-ink"),
    !accent && vald === undefined && (active ? "bg-raised text-accent" : accentFarg ? "text-accent hover:bg-raised" : "text-ink-secondary hover:bg-raised hover:text-ink"),
    // ⛔ 0.31.2: FOKUS ÄR EN YTA, INTE EN RAM. Radix flyttar fokus in i en öppnad meny, och första raden
    // ("Alla slag", också den valda) fick då en tjock accentram runt sig, som såg ut som ett tredje tillstånd bredvid "vald".
    // SS-raderna har ingen egen fokusram alls (webbläsarens, bara vid tangentbord). Fokuserad rad får `bg-hover`; den valda raden behåller sin tonade yta (fokus syns när piltangenten flyttar det till nästa rad).
    "focus-visible:outline-none",
    !(vald === true || active) && "focus-visible:bg-hover",
    klickbar && "cursor-pointer",
  );
}

/**
 * Rubriken över en grupp rader i en meny eller dropdown ("SLAG", "SORTERA"). EN definition (0.31.2): `px-3`, som raderna under den,
 * så att rubrik och rader står i samma kolumn. Före 0.31.2 var den `px-2` och stod 4 px till vänster om sina egna rader.
 */
export const radRubrikKlass = "m-0 px-3 pb-1 text-meta font-semibold uppercase tracking-wide text-ink-muted";

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
 * ⛔ 0.59.1: IKONEN ÄR 24 PX, CIRKELN FORTFARANDE 36 (6 + 24 + 6). CP 2026-10-05 i
 * cllp/bolag-ops#563: "Ikonerna i huvudmenyerna botten och toppen är lite väl små.
 * Svårt att träffa dom med fingret." Cirkeln och träffytan står kvar, så raden och
 * klustrets mittlinjer rör sig inte; bara det man ser i cirkeln växer.
 *
 * ⛔ BARA UNDER `md`. CP samma dag: "563 är bara i mobil." På dator står SS 20 px
 * kvar (`md:p-2 md:[&_svg]:size-5`): klagomålet gällde fingret, inte musen.
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
    "relative size-9 shrink-0 cursor-pointer items-center justify-center rounded-full p-1.5 [&_svg]:size-6 md:p-2 md:[&_svg]:size-5",
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
 * Plusset i toppraden: en fylld accentcirkel på dator (0.60.0), den dämpade 36 px cirkeln kvar där ingen bottenrad har ett eget plus.
 *
 * ══ ⛔ VARFÖR PLUSSET INTE LÄNGRE ÄR DÄMPAT PÅ DATOR (CP 2026-10-05) ═════════
 *
 * Från 0.30.0 (#168, #173) var plusset en dämpad 36 px cirkel som de andra ikonerna i klustret, för att en accentfylld knapp
 * i raden "skrek" bland likar. Det var rätt så länge plusset var en ikon bland ikoner. CP 2026-10-05: "Kan man göra +et sådär
 * framträdande som det är på mobil. Samma position men större och framträdande. Kanske skall ligga längst till vänster av
 * ikonerna i topraden till höger?" Plusset är huvudåtgärden, och på mobil är det redan den enda fyllda ytan i bottenraden.
 * Därför från `md`: 40 px fylld accent (`bg-accent text-accent-contrast`), 24 px plus, först i klustret.
 *
 * ⛔ UNDER `md` ÄR ALLT SOM FÖRE. Finns ingen bottenrad med eget plus (`synligMobil`) står den dämpade 36 px cirkeln kvar, så
 * bara datorn ändras. Med bottenraden är plusset gömt under `md` (ett plus per yta).
 *
 * ⛔ DISPLAY ÄGS AV EN KLASSTRÄNG: `inline-flex` eller `hidden md:inline-flex`, aldrig båda (se `huvudknappKlass`).
 * ⛔ Träffytan är 44 px som en osynlig `after:`-yta, också på den 40 px stora cirkeln.
 *
 * @param {object} [val]
 * @param {boolean} [val.synligMobil] Plusset syns under `md` (ingen bottenrad med eget plus). Förval sant.
 * @param {boolean} [val.aktiv] Popovern är öppen.
 * @returns {string}
 */
export function huvudPlusKlass({ synligMobil = true, aktiv = false } = {}) {
  return cx(
    "relative size-9 shrink-0 cursor-pointer items-center justify-center rounded-full p-1.5 [&_svg]:size-6 md:size-10 md:p-2",
    synligMobil ? "inline-flex" : "hidden md:inline-flex",
    "transition-colors duration-(--duration-fast) ease-standard",
    // Under md: som toppradens övriga ikoner.
    aktiv ? "bg-raised text-accent" : "text-ink-muted hover:bg-raised hover:text-ink-secondary",
    // Från md: fylld accent, också när popovern är öppen och vid hover.
    "md:bg-accent md:text-accent-contrast md:hover:bg-accent-hover md:hover:text-accent-contrast",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
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

/**
 * Fältets utseende: ETT ställe för `OpsInput`, `OpsTextarea`, `OpsSelect`, `OpsDatePicker` och `OpsTimePicker` (0.31.0).
 *
 * ══ ⛔ SESSIONSTUDIOS FÄLT, MÄTT (CP 2026-09-29: "dubbelkolla alla primitiver så att det blir enhetligt med sessionstudio") ═══
 *
 * SS `forms/TextInput.jsx:102`: `py-2 px-3 rounded border-[1.5px] bg-surface`, där `rounded` är SS `--radius` (12 px, `index.css:215`,
 * `.rounded-app .rounded`) och ytan är `--color-surface`; fokus `.ss-field:focus-visible` (`index.css:1424-1428`): 2 px accentkontur
 * `outline-offset: -2px` och accentkant. `dropdown/themedSelectShared.js:71-75` (väljaren i ett formulär): samma radie, kant 1 px,
 * `hover:border-hover`. Före 0.31.0 var fälten `rounded-md` (10 px), kant 1 px, `bg-canvas` och konturen UTANFÖR kanten
 * (`outline-offset-1`), alltså tre skillnader mot SS i samma kontroll, skrivna på fem ställen.
 *
 * ⛔ 0.32.0: FÄLTETS TEXT ÄR `text-brod` (16 px, 400) PÅ ALLA BREDDER. 0.31.2 skrev `text-rubrik md:text-brod`, och rollen `rubrik` bär
 * vikt 700, så varje fält under 768 px skrev fet text (mätt 16 px/700 i `ny grupp 390`, CP 19:50 "Stor text"). 16 px hindrar iOS zoom.
 *
 * ⛔ TEXTFÄLT HAR 1,5 PX KANT (`kant: "falt"`), VÄLJARE 1 PX (`kant: "val"`), SOM SS. Talet är SS egna och inte en gissning.
 *
 * @param {{ invalid?: boolean, filled?: boolean, trigger?: boolean, kant?: "falt" | "val" }} [val]
 * @returns {string}
 */
export function faltKlass({ invalid = false, filled = true, trigger = false, kant = "falt" } = {}) {
  return cx(
    "w-full rounded-base bg-surface px-3 py-2 min-h-11 text-brod transition-colors duration-(--duration-fast) ease-standard",
    trigger && "inline-flex items-center justify-between gap-2",
    kant === "falt" ? "border-[1.5px]" : "border",
    filled ? "text-ink" : "text-ink-muted",
    "placeholder:text-ink-muted",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent focus-visible:border-accent",
    "disabled:opacity-55 disabled:cursor-not-allowed",
    invalid ? "border-danger" : "border-line hover:border-line-strong",
  );
}

/** Fältknapp som öppnar en lista eller kalender (`OpsSelect`, `OpsDatePicker`, `OpsTimePicker`): 1 px kant som SS väljare. */
export function faltTriggerKlass({ invalid = false, filled = true } = {}) {
  return faltKlass({ invalid, filled, trigger: true, kant: "val" });
}

/** Ytan en fältknapp öppnar: ovanför modalen (se `--z-dropdown`), samma radie, kant och skugga överallt. SS `themedSelectShared.js:76-79`: `--radius`, kant, skugga.
 * ⛔ 0.31.2: `bg-surface` och `shadow-lg` som `radBehallare` (SS `listboxBase`: `bg-surface`, `shadow-lg`). Var `bg-raised`, samma färg som den valda raden, så valet syntes inte. */
export const faltYtaKlass = "z-(--z-dropdown) rounded-base border border-line bg-surface shadow-lg";

/**
 * Ett alternativ i en LISTA I ETT FORMULÄR (`OpsSelect`, `OpsTimePicker`): Radix `Select.Item`. 0.31.2.
 *
 * ══ ⛔ SS FORMULÄRLISTA, MÄTT (CP 2026-09-29 19:50: "Typsnitten är inte syncade. Stor text ... Har ni verkligen gått igenom allt?") ═══
 *
 * SS `dropdown/themedSelectShared.js:81-86` (`ThemedSelectListbox.jsx:44-48`): `w-full flex items-center gap-1.5 text-left text-primary
 * hover:bg-hover`, `optionSizeForm`: `px-3 py-2 text-sm`, vald rad tonad och en bock `w-3 h-3` accent SIST i raden. Före 0.31.2 var
 * alternativen `text-base` (16 px) med bocken FÖRE texten och `pl-8`, alltså både större och åt fel håll.
 * Markeringen är Radix `data-highlighted` (piltangenter och hover), valet `data-state=checked`.
 *
 * @param {{ dampad?: boolean }} [val] `dampad`: platshållarens rad ('--'), dämpad text.
 * @returns {string}
 */
export function valjAlternativKlass({ dampad = false } = {}) {
  return cx(
    "relative flex min-h-11 md:min-h-0 w-full cursor-pointer select-none items-center gap-1.5 rounded-base px-3 py-2 text-left text-etikett leading-5",
    dampad ? "text-ink-muted" : "text-ink",
    "data-[highlighted]:bg-hover data-[highlighted]:outline-none data-[state=checked]:bg-accent-subtle",
    "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55",
  );
}
