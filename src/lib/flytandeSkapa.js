import { useEffect, useState } from "react";

/**
 * Den flytande Skapa-knappen på telefon (0.176.0, cllp/lifehub.app#582): vad som avgör om den ritas.
 *
 * ══ ⛔ HÄNDELSEN ═══════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-02: under 768 px är bottenradens mittknapp en mikrofon (TALK). Ett tryck spelar in, ett långtryck öppnar skalets
 * skapa-lista, och ingenting på skärmen säger att det går att skapa. Plustecknet på mikrofonen togs bort i 0.104.0 ("ser bara
 * skräpig ut"), så vägen dit får inte vara en markering på mikrofonen. Svaret är en egen, rund plusknapp nere till höger ovanför
 * bottenraden som öppnar SAMMA lista som långtrycket (`oppnaSkapaLista` i `OpsAppShell`, en funktion och inte en kopia).
 *
 * ══ ⛔ DEN SKA INTE STÅ I VÄGEN ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * En knapp som alltid syns är en knapp som ligger över innehåll, över ett öppet ark och över tangentbordet. Beslutet har därför en
 * ren funktion (`flytandeSkapaSyns`) som går att pröva utan webbläsare, och fyra villkor som alla måste vara uppfyllda:
 *   1. Appen har sagt att den aktiva vyn är en plats där man skapar (`flytandeSkapaPa`). Förval: nej.
 *   2. Ingen panel, inget ark och ingen dialog är öppen.
 *   3. TALK vilar. Medan den lyssnar, sparar eller visar ett kvitto ligger fältet öppet, och en lista ovanpå det vore ett andra ärende.
 *   4. Tangentbordet är inte uppe (`useTangentbordUppe`, samma mätning som bottenraden: ett textfält har fokus OCH `visualViewport` har
 *      krympt tydligt). Ingen egen mätning här: två mått på samma sak hade glidit isär (arbetsreglernas punkt 2).
 */

/**
 * Appens besked: är den här vyn en plats där man skapar? Antingen en lista med adresser (en adress gäller också för sina undersidor,
 * `/kalender` för `/kalender/2026`; `/` gäller bara startsidan) eller en funktion av aktiv adress.
 *
 * ⛔ Fel form kastar. Ett `true` som tyst blev "av" hade gett en app som tror att knappen finns (arbetsreglernas punkt 5).
 * @typedef {ReadonlyArray<string> | ((activeHref: string) => boolean)} FlytandeSkapaVal
 */

/**
 * @param {FlytandeSkapaVal | undefined} val
 * @param {string} activeHref
 * @returns {boolean} `false` när `val` utelämnats.
 */
export function flytandeSkapaPa(val, activeHref) {
  if (val === undefined) return false;
  if (typeof val === "function") {
    const svar = val(activeHref);
    if (typeof svar !== "boolean") {
      throw new Error(`OpsAppShell: flytandeSkapa som funktion måste svara true eller false för "${activeHref}", inte ${svar === undefined ? "undefined" : typeof svar}. Ett svar som saknas hade tyst gett en knapp som aldrig syns.`);
    }
    return svar;
  }
  if (!Array.isArray(val) || val.some((h) => typeof h !== "string" || h === "")) {
    throw new Error("OpsAppShell: flytandeSkapa ska vara en lista med adresser (['/kalender', '/inkorg']) eller en funktion (activeHref) => boolean. Ett enkelt true/false finns inte med flit: knappen hör till vissa vyer, inte alla.");
  }
  const adress = activeHref.split(/[?#]/)[0] || "/";
  return val.some((h) => (h === "/" ? adress === "/" : adress === h || adress.startsWith(h.endsWith("/") ? h : `${h}/`)));
}

/**
 * Ska knappen ritas just nu? Ren: allt den behöver kommer in som argument.
 * @param {{ pa: boolean, tangentbordUppe: boolean, panelOppen: boolean, dialogOppen: boolean, talkLage: string }} nu
 *   `pa`: appen har slagit på knappen för vyn och skalet har en lista att öppna. `panelOppen`: skalets egna ytor (skapa-panel, händelsepanel, skapa-arket, Skapa-i, app-arket). `dialogOppen`: någon annan dialog i dokumentet (Radix-ark, bottenradens Meny).
 * @returns {boolean}
 */
export function flytandeSkapaSyns({ pa, tangentbordUppe, panelOppen, dialogOppen, talkLage }) {
  return pa && !tangentbordUppe && !panelOppen && !dialogOppen && talkLage === "vila";
}

/**
 * ⛔ EN YTA SOM BÄR SIN EGEN SKAPA ELLER LIGGER DÄR KNAPPEN STÅR SÄGER DET MED DET HÄR ATTRIBUTET (0.176.1).
 *
 * CP 2026-11-02 20:55, med en skärmbild från telefonen: "Här blir en krock i mobilen." Kalenderns dagpanel staplas under rutnätet på
 * telefon och har en egen Skapa-ruta nere till höger, och den flytande knappen låg ovanpå den: två plus i samma hörn, det ena över
 * det andra. Dagpanelen är ingen Radix-dialog, och snabbtitten är en `role="dialog"` utan `data-state`, så ingen av dem fångades av
 * frågan nedan. Komponenten själv vet att den tar platsen, och den säger det här i stället för att skalet gissar ur klasser eller roller.
 */
export const DOLJER_FLYTANDE_SKAPA = "data-ops-doljer-flytande-skapa";

/**
 * Står något öppet där knappen inte ska ligga? En Radix-dialog (`role="dialog"` och `data-state="open"`, tas ur DOM när den stängs)
 * eller en yta som bär `DOLJER_FLYTANDE_SKAPA` (kalenderns dagpanel och snabbtitt).
 * @param {ParentNode} [rot]
 * @returns {boolean}
 */
export function arDialogOppen(rot) {
  const r = rot ?? (typeof document !== "undefined" ? document : null);
  if (!r) return false;
  if (r.querySelector(`[${DOLJER_FLYTANDE_SKAPA}]`) !== null) return true;
  const dialoger = r.querySelectorAll(`[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]`);
  for (const d of dialoger) {
    // ⛔ SKAPA-SNABBMENYN ÄR SJÄLV PLUSKNAPPEN (0.184.0). Den dimmar bakgrunden och byter plus mot kryss. Räknades den som
    // en dialog här hade knappen försvunnit i samma ögonblick den skulle bli ett kryss.
    if (d.getAttribute("data-ops-snabbmeny") === "skapa") continue;
    return true;
  }
  return false;
}

/**
 * `arDialogOppen`, hållen aktuell medan `aktiv`. Observatören finns bara medan någon frågar, så en app utan knappen bär den inte.
 * @param {boolean} aktiv
 * @returns {boolean}
 */
export function useDialogOppen(aktiv) {
  const [oppen, setOppen] = useState(() => (aktiv ? arDialogOppen() : false));
  useEffect(() => {
    if (!aktiv || typeof document === "undefined" || typeof MutationObserver !== "function") {
      setOppen(false);
      return undefined;
    }
    const mat = () => setOppen(arDialogOppen());
    mat();
    const ob = new MutationObserver(mat);
    ob.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
    return () => ob.disconnect();
  }, [aktiv]);
  return oppen;
}
