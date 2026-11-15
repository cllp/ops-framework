import { useEffect, useSyncExternalStore } from "react";

/**
 * TALK ovanpå panelerna (0.231.0, cllp/ops-framework#602).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * 0.230.0 gjorde TALK till den enda röstknappen: står markören i ett fält när man trycker på TALK går talet dit. Men panelerna täckte TALK.
 * `OpsSkapaPanel` (Nytt ärende) var helskärm under `md` och låg över bottenraden, och `OpsRadPanel` (ärendet i detalj) var en modal Radix-dialog
 * vars slöja låg över huvudet på datorn och över bottenraden på telefonen. Där man skriver mest fanns alltså ingen röst alls. CP 2026-11-15:
 * "TAlk finns ju inte när man skall skriva text i ärenden mm", och om skissen där mikrofonen står kvar på samma plats: "Snyggt kör på skissen."
 *
 * ══ VAD MODULEN ÄGER ═════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   1. `OVANFOR_PANEL`, attributet på det som ligger OVANFÖR en öppen panel: TALK-knappen i huvudet, bottenraden på telefonen och TALK:s yta.
 *      En modal panel (`PanelDialog`) läser det i `onInteractOutside` (`skyddaOvanforPanel`): ett tryck där är inte ett tryck utanför, och panelen
 *      stängs inte. Radix räknar annars allt utanför panelens React-träd som utanför, också TALK.
 *   2. Hur många paneler som är öppna (`usePanelRegistrering`, `usePanelOppen`). Bottenraden läser det: medan en panel är öppen är flikarna
 *      dämpade och `inert`, så att ingen lämnar ett halvskrivet ärende av misstag, och bara TALK går att trycka på.
 *   3. Två märken på <html> (`useRotmarke`) som `tokens.css` räknar panelernas kanter ur: att skalets huvud finns (`data-ops-med-huvud`, slöjan
 *      börjar under det på datorn) och att bottenraden finns (`data-ops-med-bottenrad`, panelen slutar ovanför den på telefonen). Ett märke på
 *      <html> och inte en CSS-variabel i skalet: en Radix-dialog ritas i en portal direkt i <body>, utanför skalets element, och ärver inget därifrån.
 *
 * ⛔ EN MODUL OCH INTE TRE (regel 2). Attributet, registret och märkena är samma beslut, att TALK står kvar på sin plats när en panel öppnas,
 * och de ska ändras tillsammans.
 */

/** Attributet på det som ligger ovanför en öppen panel. Se filhuvudet. */
export const OVANFOR_PANEL = "data-ops-ovanfor-panel";

/**
 * Ligger målet för ett tryck (eller ett fokus) i något som står ovanför en öppen panel?
 * @param {EventTarget | null | undefined} mal
 * @returns {boolean}
 */
export function arOvanforPanel(mal) {
  return typeof Element !== "undefined" && mal instanceof Element && mal.closest(`[${OVANFOR_PANEL}]`) !== null;
}

/**
 * Tryck (`pointerdown`) som började i något ovanför en öppen panel, avgjort NÄR de kom. Se `skyddaOvanforPanel`.
 * @type {WeakSet<Event>}
 */
const TRYCK_OVANFOR = new WeakSet();

/** @param {Event} e */
function vidTryck(e) {
  if (arOvanforPanel(e.target)) TRYCK_OVANFOR.add(e);
}

/**
 * `onInteractOutside` för en modal panel: ett tryck eller ett fokus i TALK eller i bottenraden stänger inte panelen.
 *
 * ⛔ TRYCKET AVGÖRS NÄR DET KOM, INTE NÄR RADIX FRÅGAR. Mätt i check-skalyta avsnitt 67 vid 390 px: panelen stängdes av trycket på mikrofonen i
 * bottenraden, fast knappen bar attributet. Radix modala dialog skjuter upp "tryck utanför" till klicket (`deferPointerDownOutside`) och skickar det
 * då på målet från `pointerdown`. Men klicket startar TALK först, knappen ritas om med en ny ikon, och målet (ikonens `svg`) har lämnat sidan:
 * `closest` på ett element utanför sidan hittar ingenting. På datorn träffade trycket knappen själv, som står kvar, och där syntes inget fel. Därför
 * noteras varje `pointerdown` i fångstfasen medan en panel är öppen (`registreraPanel`), och skyddet frågar efter just det trycket
 * (`detail.originalEvent`) i stället för efter var målet står nu.
 * @param {{ target: EventTarget | null, detail?: { originalEvent?: Event } | null, preventDefault: () => void }} event
 */
export function skyddaOvanforPanel(event) {
  const ursprung = event.detail?.originalEvent;
  if (arOvanforPanel(event.target) || (ursprung !== undefined && TRYCK_OVANFOR.has(ursprung))) event.preventDefault();
}

/** @type {Set<() => void>} */
const lyssnare = new Set();
let oppna = 0;

/** @param {() => void} lyssna */
function prenumerera(lyssna) {
  lyssnare.add(lyssna);
  return () => {
    lyssnare.delete(lyssna);
  };
}

function meddela() {
  for (const l of [...lyssnare]) l();
}

/**
 * Räknar upp en öppen panel. Ger en funktion som räknar ned den, en gång.
 * @returns {() => void}
 */
export function registreraPanel() {
  oppna += 1;
  // Trycken noteras bara medan någon panel är öppen: en sida utan panel bär ingen lyssnare.
  if (oppna === 1 && typeof document !== "undefined") document.addEventListener("pointerdown", vidTryck, true);
  meddela();
  let kvar = true;
  return () => {
    if (!kvar) return;
    kvar = false;
    oppna -= 1;
    if (oppna === 0 && typeof document !== "undefined") document.removeEventListener("pointerdown", vidTryck, true);
    meddela();
  };
}

/**
 * Registrerar panelen som öppen så länge `oppen` är sant och komponenten är monterad.
 * @param {boolean} oppen
 */
export function usePanelRegistrering(oppen) {
  useEffect(() => (oppen ? registreraPanel() : undefined), [oppen]);
}

/**
 * Är någon panel öppen? (`OpsSkapaPanel`, `OpsRadPanel`, `OpsExternPanel`.)
 * @returns {boolean}
 */
export function usePanelOppen() {
  return useSyncExternalStore(prenumerera, () => oppna > 0, () => false);
}

/** Hur många som bär varje märke. Två instanser av samma yta tar inte bort märket för varandra. @type {Map<string, number>} */
const marken = new Map();

/**
 * Sätter ett tomt attribut på <html> medan komponenten är monterad (och `aktiv`), räknat per namn.
 * @param {"data-ops-med-huvud" | "data-ops-med-bottenrad"} namn
 * @param {boolean} [aktiv]
 */
export function useRotmarke(namn, aktiv = true) {
  useEffect(() => {
    if (!aktiv || typeof document === "undefined") return undefined;
    const rot = document.documentElement;
    marken.set(namn, (marken.get(namn) ?? 0) + 1);
    rot.setAttribute(namn, "");
    return () => {
      const kvar = (marken.get(namn) ?? 1) - 1;
      marken.set(namn, kvar);
      if (kvar <= 0) rot.removeAttribute(namn);
    };
  }, [namn, aktiv]);
}
