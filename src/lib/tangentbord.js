import { useSyncExternalStore } from "react";

/**
 * Är tangentbordet uppe? Bottenraden göms medan det är det (0.152.0, cllp/ops-framework#461, punkt 1).
 *
 * ══ ⛔ HÄNDELSEN ═══════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-28 20:25, en skärmbild från iPhone i en chatt med agenten, tangentbordet uppe ("Så ser det ut"). Uppifrån och ned:
 * meddelandena, skrivfältet, BOTTENRADEN (Idag, Kalender, mikrofonen, Appar, Meny), Safaris formulärrad, tangentbordet. Raden tog
 * ungefär 110 px och lämnade en sjättedel av skärmen åt meddelandena. Mönstret i Meddelanden och WhatsApp är det motsatta: navigeringen
 * göms medan man skriver. Ingen navigerar medan tangentbordet är uppe, och den som vill det fäller ned det först.
 *
 * ══ ⛔ TVÅ VILLKOR, BÅDA MÅSTE GÄLLA ═══════════════════════════════════════════════════════════════════════════════════
 *
 *   1. Ett TEXTFÄLT HAR FOKUS: `input` som tar text, `textarea` eller `contenteditable`. Ett fokus på en knapp eller en länk lyfter inget
 *      tangentbord.
 *   2. `visualViewport` HAR KRYMPT TYDLIGT mot fönstret (`TANGENTBORD_MINST_PX`). Fokus ensamt räcker inte: en extern tangentbordsenhet
 *      (en iPad med Magic Keyboard, en telefon med Bluetooth-tangentbord) ger fokus i fältet utan att något krymper, och där ska ingenting
 *      gömmas. Krympning ensam räcker inte heller: zoom krymper `visualViewport` (därför `scale`), och Safaris verktygsfält ändrar höjden
 *      med tiotals pixlar utan något fält.
 *
 * ⛔ GRÄNSEN 150 PX. Ett iPhone-tangentbord är 250 till 300 px (liggande ungefär 200), och Safaris genvägsrad på en iPad med externt
 * tangentbord ligger runt 55 till 70. 150 ligger mitt emellan med marginal åt båda hållen. Bottenraden själv är 68 px: krymper det mindre
 * än så är det inte raden som är i vägen.
 *
 * ⛔ (hypotes, inte mätt på en riktig iPhone) iOS krymper `visualViewport` men inte `window.innerHeight` när tangentbordet kommer, och det är
 * skillnaden de två som mäts här. Chromium har inget virtuellt tangentbord: `check-skalyta` avsnitt 47 (5) prövar med ett `visualViewport`
 * som krymper. En webbläsare som i stället krymper hela layout-fönstret (Android med `interactive-widget=resizes-content`) ger ingen skillnad
 * här, och där följer layouten tangentbordet av sig själv.
 *
 * ══ ⛔ DEN ANDRA HALVAN: PLATSEN SOM RADEN RESERVERAR ═══════════════════════════════════════════════════════════════════
 *
 * Att gömma raden räcker inte. `main` har en `padding-bottom` lika hög som raden, toasten, spelraden och chattens höjd räknar med den, och
 * lämnas de kvar blir det ett tomt glapp där raden satt. De räknar alla med `--bottom-nav-h` och `--bottom-nav-overhang`, så medan
 * tangentbordet är uppe sätts `data-ops-tangentbord` på <html> och `tokens.css` nollar de två talen under det. En plats, inte en klass per
 * komponent.
 *
 * ⛔ EN GEMENSAM MÄTNING OCH INTE EN PER KOMPONENT. Modulen håller ETT svar och EN uppsättning lyssnare, oavsett hur många komponenter som
 * frågar. Lyssnarna sätts upp när den första frågar och tas bort när den sista går, så en app utan bottenrad bär inga.
 *
 * ⛔ FOKUS LÄMNAS MED EN TICK DRÖJSMÅL. Byter man fält går fokus ut ur det ena och in i det andra, och en mätning mitt emellan hade sagt "inget
 * fält" och fått raden att blinka till. Mätningen efter `focusout` körs därför en tick senare, när `focusin` hunnit komma.
 */

/** Så mycket mindre än fönstret `visualViewport` ska vara för att det räknas som ett tangentbord, i pixlar. Se filhuvudet. */
export const TANGENTBORD_MINST_PX = 150;

/** `input`-typer som inte tar text och alltså inte lyfter ett tangentbord. */
const INTE_TEXT = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);

/**
 * Tar elementet text? `input` som inte är en knapp-, val- eller filtyp, `textarea` och `contenteditable`, inte skrivskyddade och inte avstängda.
 * @param {Element | null | undefined} el
 * @returns {boolean}
 */
export function arTextfalt(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return !INTE_TEXT.has(el.type) && !el.readOnly && !el.disabled && el.getAttribute("inputmode") !== "none";
  const ce = el.getAttribute("contenteditable");
  return ce !== null && ce !== "false";
}

/**
 * Hur mycket av layoutfönstret som tangentbordet täcker, i pixlar. 0 utan `visualViewport`, och 0 för en zoomad sida.
 *
 * ⛔ EN MÄTNING FÖR ALLA (0.152.0, granskningen av PR 462). Chatten (`OpsMeddelanden`) hade en egen, som drog bort `visualViewport.offsetTop`, och raden en annan som inte gjorde det: två
 * sanningar om samma faktum. Nu räknar båda med den här. Den mäts mot LAYOUTFÖNSTRET (`document.documentElement.clientHeight`) och inte mot `window.innerHeight`: en webbläsare där
 * `innerHeight` krymper med tangentbordet (Android Chrome) hade gett skillnaden 0 och aldrig gömt raden, medan layoutfönstret står kvar. `clientHeight` är 0 där det inte finns någon
 * layout (jsdom), och då gäller `innerHeight`. `offsetTop` räknas med: det som täcks är det som ligger under den synliga delen, inte bara hur mycket den synliga delen krympt.
 *
 * ⛔ (hypotes, inte mätt på en riktig enhet) På iOS står layoutfönstret kvar och `visualViewport` krymper. En webbläsare som krymper layoutfönstret självt (`resizes-content`) ger 0 här,
 * och där följer layouten tangentbordet av sig själv.
 * @returns {number}
 */
export function tangentbordTackt() {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  const vv = window.visualViewport;
  if (!vv) return 0;
  // Zoomat (scale > 1) krymper visualViewport utan att något tangentbord finns.
  if (typeof vv.scale === "number" && vv.scale > 1.01) return 0;
  const layout = document.documentElement.clientHeight || window.innerHeight;
  return Math.max(0, Math.round(layout - vv.height - (vv.offsetTop || 0)));
}

/**
 * Har `visualViewport` krympt tydligt mot layoutfönstret, utan att det är en zoom? (`tangentbordTackt` minst `TANGENTBORD_MINST_PX`.)
 * @returns {boolean}
 */
export function viewportKrympt() {
  return tangentbordTackt() >= TANGENTBORD_MINST_PX;
}

/**
 * Är tangentbordet uppe just nu: ett textfält har fokus OCH viewporten har krympt tydligt. Mäter om varje gång, ur webbläsaren.
 * @returns {boolean}
 */
export function tangentbordUppe() {
  if (typeof document === "undefined") return false;
  return arTextfalt(document.activeElement) && viewportKrympt();
}

/** @type {Set<() => void>} */
const lyssnare = new Set();
let uppe = false;
/** @type {(() => void) | null} */
let avlyssna = null;

/** Mäter om, och säger till alla om svaret ändrats. Sätter attributet på <html> som `tokens.css` nollar bottenradens tal under. */
function matOm() {
  const nu = tangentbordUppe();
  if (nu === uppe) return;
  uppe = nu;
  document.documentElement.toggleAttribute("data-ops-tangentbord", nu);
  for (const l of [...lyssnare]) l();
}

function starta() {
  /** @type {ReturnType<typeof setTimeout> | 0} */
  let senare = 0;
  const efterFokus = () => {
    // En tick senare: byter man fält kommer focusin direkt efter focusout, och raden ska inte hinna blinka till.
    clearTimeout(senare || undefined);
    senare = setTimeout(() => {
      senare = 0;
      matOm();
    }, 0);
  };
  const vv = window.visualViewport;
  document.addEventListener("focusin", matOm);
  document.addEventListener("focusout", efterFokus);
  window.addEventListener("resize", matOm);
  window.addEventListener("orientationchange", matOm);
  // ⛔ TILLBAKA FRÅN BAKGRUNDEN (granskningen av PR 462): en sida som återställs ur bfcache, eller en flik som blir synlig igen, kan ha missat både fokus- och viewporthändelserna medan den
  // låg stilla. Utan en omätning kunde raden stå gömd tills nästa fokus.
  window.addEventListener("pageshow", matOm);
  document.addEventListener("visibilitychange", matOm);
  vv?.addEventListener("resize", matOm);
  vv?.addEventListener("scroll", matOm);
  avlyssna = () => {
    clearTimeout(senare || undefined);
    document.removeEventListener("focusin", matOm);
    document.removeEventListener("focusout", efterFokus);
    window.removeEventListener("resize", matOm);
    window.removeEventListener("orientationchange", matOm);
    window.removeEventListener("pageshow", matOm);
    document.removeEventListener("visibilitychange", matOm);
    vv?.removeEventListener("resize", matOm);
    vv?.removeEventListener("scroll", matOm);
  };
  matOm();
}

function stoppa() {
  avlyssna?.();
  avlyssna = null;
  uppe = false;
  document.documentElement.removeAttribute("data-ops-tangentbord");
}

/** @param {() => void} lyssna */
function prenumerera(lyssna) {
  lyssnare.add(lyssna);
  if (lyssnare.size === 1) starta();
  return () => {
    lyssnare.delete(lyssna);
    if (lyssnare.size === 0) stoppa();
  };
}

/**
 * Är tangentbordet uppe? `true` medan ett textfält har fokus och `visualViewport` har krympt tydligt, annars `false`. Se filhuvudet.
 * Medan någon komponent frågar står `data-ops-tangentbord` på <html> när svaret är ja.
 * @returns {boolean}
 */
export function useTangentbordUppe() {
  return useSyncExternalStore(prenumerera, () => uppe, () => false);
}
