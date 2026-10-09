import { cx } from "./cx.js";

/**
 * Modulens ram: tillbaka-raden och flikraden, en gång för de ytor som ser ut som en modul (0.83.0).
 *
 * ══ ⛔ VARFÖR DET HÄR BOR I EN EGEN FIL ═══════════════════════════════════
 *
 * CP 2026-10-08 17:52, med bilder från telefonen av Bibliotek och Ekonomi: "Bibliotek behöver en tillbaka knapp också
 * precis som ekonomi. Sedan navigeringen på liknande sätt." Ekonomis ram ritas av `OpsModulSida`: "‹ Tillbaka", modulens
 * namn som rubrik och en rad med ikon, namn och accentlinje under den öppna delen. Bibliotekets typer (Alla, Anteckningar,
 * Länkar) är inte delar med egna adresser utan ett urval på samma sida (`OpsTabs`), men de ska SE UT som Ekonomis rad.
 *
 * Före 0.83.0 stod radens klasser bara i `OpsModulSida`. En andra kopia i `OpsTabs` hade glidit isär första gången någon
 * rörde den ena (regel 2), och då hade "samma rad som Ekonomi" slutat vara sant utan att något prov märkt det. Därför
 * bor klasserna och tillbaka-radens ord här, och båda komponenterna läser dem.
 */

/**
 * Radens behållare, med en linje under. En rad, som rullar i sidled när den inte får plats.
 *
 * ⛔ 0.87.0, lane 11, bröt raden (`flex-wrap`). Mätningen då var att "Länkar" slutade på x 411, utanför bodyn,
 * trots `overflow-x-auto`. Orsaken var att raden var ett flexbarn med `min-width: auto`: den växte med innehållet,
 * och då rullade sidan, inte raden. Brytningen löste överflödet och gav Ekonomi fjorton rader på en telefon.
 * CP 2026-10-09, med en skärmbild: flikarna ska ligga på en rad och rulla, som de gjorde före 0.87.0.
 *
 * ⛔ `min-w-0` OCH `w-full` SITTER HÄR OCH PÅ OMSLAGET (`FLIKOMSLAG`). Utan omslaget på flexbarnet växer raden
 * igen, och `overflow-x-auto` rullar ingenting. Samma klass i `OpsModulSida` och i `OpsTabs` med `medOrd`.
 * Surfplattehuvudet (0.87.0, #262) rörs inte: det är märket, knapparnas storlek och vilka åtgärder som flyttar till menyn.
 */
export const FLIKRAD = "m-0 flex w-full min-w-0 list-none flex-nowrap gap-1 overflow-x-auto overscroll-x-contain border-b border-line p-0";

/**
 * Omslaget runt raden, på det flexbarn som ligger i vyns kolumn.
 * Utan `min-w-0` vägrar barnet bli smalare än sitt innehåll, och sidan rullar i sidled.
 */
export const FLIKOMSLAG = "min-w-0 w-full";

/**
 * Rullar den öppna posten in i raden. `scrollLeft` på raden, aldrig `scrollIntoView`,
 * som hade kunnat flytta hela dokumentet i höjdled.
 *
 * @param {HTMLElement | null} rad
 */
export function rullaInAktiv(rad) {
  if (!rad) return;
  const a = /** @type {HTMLElement | null} */ (rad.querySelector('[aria-current="page"], [role="tab"][aria-selected="true"]'));
  if (!a) return;
  const ra = a.getBoundingClientRect();
  const ru = rad.getBoundingClientRect();
  const vanster = ra.left - ru.left + rad.scrollLeft;
  if (vanster < rad.scrollLeft || vanster + ra.width > rad.scrollLeft + rad.clientWidth) {
    rad.scrollLeft = Math.max(0, vanster - (rad.clientWidth - ra.width) / 2);
  }
}

/**
 * En post i raden: ikon och namn bredvid varandra, accentlinjen under den öppna.
 *
 * Mätt i appen (Playwright mot mätbygget, 390 och 1280 px): 44 px hög, `8px 16px` luft, 14 px text, vikt 600, 2 px linje.
 *
 * @param {object} val
 * @param {boolean} val.oppen Den öppna delen eller den valda fliken.
 * @returns {string}
 */
export function flikKlass({ oppen }) {
  return cx(
    "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-t-md border-b-2 px-4 py-2 text-etikett font-semibold",
    "transition-colors duration-(--duration-fast) ease-standard",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
    oppen ? "border-accent text-ink" : "border-transparent text-ink-secondary hover:bg-accent-faint hover:text-ink",
  );
}

/** Ikonens låda i en post. */
export const FLIKIKON = "flex shrink-0 items-center [&_svg]:size-4";

/**
 * Tillbaka-raden för en moduls sida: "‹ Tillbaka" upp till hubben och modulens namn som rubrik, på appens språk.
 *
 * ⛔ SAMMA PROPS TILL `OpsView` FRÅN `OpsModulSida` OCH `OpsBibliotek`, så att länken heter samma sak, leder samma väg och
 * läses upp likadant på båda sidorna.
 *
 * @param {object} arg
 * @param {string} arg.namn Modulens namn, redan på rätt språk.
 * @param {string} arg.hubHref
 * @param {string} [arg.hubEtikett] Förval "Appar".
 * @param {(href: string, event: any) => void} [arg.onNavigate]
 * @param {string} [arg.sprak] "en" ger engelska ord, allt annat svenska.
 */
export function modulTillbaka({ namn, hubHref, hubEtikett = "Appar", onNavigate, sprak = "sv" }) {
  return {
    hubHref,
    hubEtikett,
    etikett: namn,
    onNavigate,
    rubrik: true,
    tillbakaEtikett: sprak === "en" ? "Back" : "Tillbaka",
    tillbakaTillEtikett: sprak === "en" ? "Back to" : "Tillbaka till",
  };
}
