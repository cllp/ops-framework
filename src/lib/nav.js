import { ID_FORM } from "./katalog.js";

/**
 * Delade regler för navigeringen: validering av nav-kontraktet och matchning av
 * aktiv post. Både OpsAppShell (toppraden) och OpsBottomNav (bottenraden) läser
 * härifrån, så att "vad räknas som aktivt" har EN definition och inte två som
 * glider isär.
 *
 * Nav-kontraktet:
 *   { href, label, icon?, badge?, skapa?, children?: { href, label }[] }
 * EN nivå barn, aldrig fler. Se issue #1 för varför djupare hierarki är en egen
 * vy, inte en djupare meny.
 */

/**
 * @typedef {object} NavPost
 * @property {string} href
 * @property {string} label
 * @property {import("react").ReactNode} [icon] Krävs i praktiken för bottenraden.
 * @property {number} [badge] Oläst, att göra, vad appen nu räknar.
 * @property {string | { sv: string, en?: string } | null} [info] (0.30.1) EN kort rad under namnet på modulens kort i Hub.
 *   Utelämnad: ingen rad. `null`: ramverket skriver "Inget nytt" (tomhet är ett svar, arbetsreglernas punkt 5).
 * @property {{ href: string, label: string, badge?: number, info?: string | { sv: string, en?: string } | null }[]} [children] EN nivå, aldrig fler.
 * @property {string} [breddklass] (0.177.0) En Tailwind-klass som döljer raden på de bredder där posten ligger någon annanstans. Skalet sätter den på appraderna i Meny som är dolda i toppraden på just de breddarna
 *   (`max-[359px]:hidden` i raden ↔ `min-[360px]:hidden` här), så att en app finns på exakt ett ställe på varje bredd. Ritas på radens omslag i `MenyAppPoster` och i bottenradens ark.
 * @property {string | null} [skapa] (0.103.0) Vad ett långtryck på postens ikon skapar: en nyckel som `useOppnaSkapa()` tar
 *   ("handelse", "arende", "grupp", "meddelande" eller en moduls registrerings id). Skalet öppnar den med sin `oppnaSkapa`.
 *   Har nyckeln ingen mottagare i skalet just nu händer inget, och ikonen går inte att hålla in. `null` eller utelämnad: ingen genväg.
 *   Bara på en post i raden, inte på ett barn: barnen ritas som rader i en meny, och där finns ingen ikon att hålla in.
 */


/**
 * `skapa` är en nyckel eller `null`/utelämnad. Formen är en registrerings id (`ID_FORM`, samma som `skapar[].id` i `modul.js`). ⛔ En tom sträng och en nyckel med fel form kastar: en genväg som aldrig kan få en
 * mottagare hade sett ut som en ikon man kan hålla in och inte gjort något, och felet hade bara syntes som tystnad.
 * ⛔ "talk" kastar också: TALK är mittknappen och ingen skapa-panel, och en genväg dit hade varit en andra mikrofon.
 * @param {any} skapa
 * @param {string} component
 * @param {string} label
 */
export function validateSkapaNyckel(skapa, component, label) {
  if (skapa === undefined || skapa === null) return;
  if (typeof skapa !== "string" || !ID_FORM.test(skapa)) {
    throw new Error(`${component}: skapa på "${label}" måste vara en nyckel som useOppnaSkapa() tar ("handelse", "arende", "grupp", "meddelande" eller en registrerings id), eller null. Fick ${JSON.stringify(skapa)}.`);
  }
  if (skapa === "talk") {
    throw new Error(`${component}: skapa på "${label}" är "talk". TALK är mittknappen och ingen skapa-panel: en genväg dit hade varit en andra mikrofon.`);
  }
}

/**
 * `info` är en icke-tom sträng, ett `{ sv, en? }` med icke-tom `sv`, `null` eller utelämnad.
 * ⛔ En tom sträng kastar: den är varken "inget" (det är `null`) eller en text, och den skulle ritas som en
 * tom rad som ser ut som ett kort som inte laddat klart.
 * @param {any} info
 * @param {string} component
 * @param {string} label
 */
function validateInfo(info, component, label) {
  if (info === undefined || info === null) return;
  const ok = typeof info === "string" ? info.trim() !== "" : typeof info === "object" && typeof info.sv === "string" && info.sv.trim() !== "" && (info.en === undefined || typeof info.en === "string");
  if (!ok) {
    throw new Error(`${component}: info på "${label}" måste vara en icke-tom sträng, { sv, en? }, eller null ("Inget nytt"). En tom sträng är varken "inget" eller en text.`);
  }
}

/**
 * Kastar med förklarande text om nav har fel form. `children` som själv
 * innehåller `children` failar direkt — begränsningen "en nivå" är bara verklig
 * om den vaktas, inte om den står i en kommentar.
 *
 * @param {any} nav
 * @param {string} component Namnet som ska stå i felmeddelandet.
 */
export function validateNav(nav, component) {
  if (!Array.isArray(nav)) {
    throw new Error(`${component}: nav krävs och måste vara en lista av { href, label }.`);
  }
  for (const entry of nav) {
    if (!entry || typeof entry.href !== "string" || typeof entry.label !== "string") {
      throw new Error(`${component}: varje nav-post måste ha href och label som strängar.`);
    }
    validateInfo(entry.info, component, entry.label);
    validateSkapaNyckel(entry.skapa, component, entry.label);
    if (entry.children === undefined) continue;
    if (!Array.isArray(entry.children)) {
      throw new Error(`${component}: nav-postens children måste vara en lista av { href, label }.`);
    }
    for (const children of entry.children) {
      if (!children || typeof children.href !== "string" || typeof children.label !== "string") {
        throw new Error(`${component}: varje barn i children måste ha href och label som strängar.`);
      }
      validateInfo(children.info, component, children.label);
      if (children.skapa !== undefined && children.skapa !== null) {
        throw new Error(`${component}: barnet "${children.label}" har skapa. En genväg är ett långtryck på en ikon i raden, och ett barn ritas som en rad i en meny utan ikon att hålla in. Lägg skapa på föräldern.`);
      }
      if (children.children !== undefined) {
        throw new Error(
          `${component}: nav får ha EN nivå barn. Posten "${children.label}" ligger i children och har själv children. ` +
            "En meny djupare än så hittar ingen i, och det finns ingen telefon där nivå tre är rätt. " +
            "Vill du ha djupare hierarki är svaret en egen vy, inte en djupare meny.",
        );
      }
    }
  }
}

/**
 * Sant om posten är den aktiva sidan, inklusive när en av dess undersidor är
 * aktiv (så att ett avsnitt markeras när man står på en av dess undersidor).
 *
 * @param {{ href: string, children?: { href: string }[] }} entry
 * @param {string} activeHref
 * @returns {boolean}
 */
export function entryActive(entry, activeHref) {
  if (entry.href === activeHref) return true;
  if (Array.isArray(entry.children)) {
    return entry.children.some((children) => children.href === activeHref);
  }
  return false;
}

/**
 * Bredden (px) från vilken en `breddklass` döljer en rad, eller `null` när klassen inte är en `min-*:hidden` eller `md:hidden`/`lg:hidden` som skalet kan resonera om (0.177.0).
 * Tailwind 4: `min-[360px]:hidden` är `width >= 360px`, `md:hidden` är `width >= 48rem` (768) och `lg:hidden` är `width >= 64rem` (1024).
 * @param {string} klass
 * @returns {number | null}
 */
function doljFran(klass) {
  const min = /(?:^|\s)min-\[(\d+)px\]:hidden(?:\s|$)/.exec(klass);
  if (min) return Number(min[1]);
  if (/(?:^|\s)lg:hidden(?:\s|$)/.test(klass)) return 1024;
  if (/(?:^|\s)md:hidden(?:\s|$)/.test(klass)) return 768;
  return null;
}

/**
 * Klassen som döljer en HEL avdelning i Meny på de bredder där alla dess rader är dolda (0.177.0).
 *
 * ⛔ HÄNDELSEN: granskningen av 360f0ed. Raderna för en app vars ikon syns i toppraden bär en `breddklass` (`min-[360px]:hidden` m.fl.). Med två eller tre fästa appar vid
 * 600 px är alla raderna i avdelningen "Appen" dolda, men rubriken ovanför står kvar: en rubrik över ingenting. Rubriken får inte stå ensam.
 *
 * Alla raderna dolda betyder att bredden är minst lika stor som VARJE rads gräns, alltså den största gränsen: avdelningen får klassen från den rad som döljs sist. Det räknas ur
 * radernas egna klasser vid ritningen, ingen mätning i JS. En avdelning där någon rad saknar klass (en app som lägger egna rader, överskottet, en åtgärd) syns alltid, och då
 * ska rubriken stå kvar: svaret är `undefined`. Samma för en klass vi inte kan tolka: hellre en rubrik för mycket än en rad som försvinner.
 *
 * @param {ReadonlyArray<{ breddklass?: string }> | null | undefined} poster
 * @returns {string | undefined}
 */
export function avdelningsBreddklass(poster) {
  if (!Array.isArray(poster) || poster.length === 0) return undefined;
  let storst = -1;
  /** @type {string | undefined} */
  let klass;
  for (const p of poster) {
    if (typeof p?.breddklass !== "string" || p.breddklass === "") return undefined;
    const fran = doljFran(p.breddklass);
    if (fran === null) return undefined;
    if (fran > storst) {
      storst = fran;
      klass = p.breddklass;
    }
  }
  return klass;
}
