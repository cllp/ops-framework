/**
 * Kopplingar en modul deklarerar (0.89.0).
 *
 * ══ ⛔ RAMVERKET VISAR LÄGET, DET LAGRAR INTE HEMLIGHETEN ═══════════════
 *
 * CP 2026-10-09: varje modul ska kunna visa sina kopplingar (Ekonomi: bank via
 * Enable Banking och Bokio, senare Billo och Kivra) med status, behörigheter
 * och senaste synk. Nyckeln, token och lösenordet får aldrig stå i klartext
 * i den vyn.
 *
 * Hemligheten har redan ett hem. LifeHub-identiteten sparar personens nycklar
 * i valvet (`ai_valv`, klienten nekas) och visar bara ett tips i
 * `anslutningar`. Hubben ber identiteten göra anropet och får aldrig nyckeln
 * tillbaka (docs/ai-byok.md och docs/integrationer.md i lifehub.identity).
 * Banken och Bokio ligger som skript i lifehub.app tills de flyttas in i samma
 * lager. En andra samling här hade varit en parallell kopia av samma hemlighet
 * (regel 2), och den kopian hade läckt första gången någon skrev ut läget.
 *
 * Därför bär manifestet bara id, namn, hjälptext och behörigheternas ord.
 * Läget (ansluten, ej ansluten, fel, senaste synk, feltext) skickar appen in
 * när den ritar. Ett fält som ser ut som en nyckel avvisas i manifestet och
 * läses inte ur läget.
 */

import { ID_FORM } from "./katalog.js";

/** Statusar kortet kan visa. Allt annat blir "ej ansluten", inte en gissning. */
export const KOPPLINGSSTATUS = /** @type {const} */ (["ansluten", "ej-ansluten", "fel"]);

/** Tak, samma storleksordning som modulens egna inställningar. */
export const MAX_KOPPLINGAR = 8;

/** Fält manifestet får bära. En nyckel här hade varit klartext i källan. */
export const KOPPLINGSDEKLARATIONFALT = /** @type {const} */ (["id", "namn", "hint", "behorigheter"]);

/**
 * Namn som aldrig får följa med in i vyn, om appen råkar lägga dem i läget.
 * Värdet ritas inte, och det läses inte.
 */
export const HEMLIGA_FALT = /** @type {const} */ ([
  "nyckel",
  "hemlighet",
  "token",
  "secret",
  "key",
  "password",
  "losenord",
  "apiNyckel",
  "apiKey",
]);

/**
 * @typedef {object} Kopplingsdeklaration
 * @property {string} id
 * @property {{ sv: string, en: string }} namn
 * @property {{ sv: string, en: string } | null} hint
 * @property {ReadonlyArray<{ sv: string, en: string }>} behorigheter
 */

/**
 * @typedef {object} Kopplingslage
 * @property {"ansluten" | "ej-ansluten" | "fel"} status
 * @property {string} fel Tom sträng när status inte är fel, eller när ingen text kom.
 * @property {string | number | null} senasteSynk ISO-sträng, millisekunder, eller null när ingen synk finns.
 */

/**
 * @param {unknown} varde
 * @param {(falt: string, skal: string) => Error} var_
 * @param {string} falt
 * @returns {{ sv: string, en: string }}
 */
function namnPar(varde, var_, falt) {
  const o = varde && typeof varde === "object" && !Array.isArray(varde) ? /** @type {any} */ (varde) : null;
  const sv = typeof o?.sv === "string" ? o.sv.trim() : "";
  const en = typeof o?.en === "string" ? o.en.trim() : "";
  if (!sv || !en) {
    throw var_(falt, `måste vara { sv, en } med båda språken, och ${!sv && !en ? "båda saknas" : !sv ? "sv saknas" : "en saknas"}.`);
  }
  return Object.freeze({ sv, en });
}

/**
 * Bygger modulens kopplingar, eller kastar med skälet.
 *
 * Utelämnat fält blir en tom lista, samma avvägning som `installningar`: ett
 * krav hade fällt varje modul som redan är skriven. En tom lista är ett
 * påstående om att modulen inte har några kopplingar.
 *
 * @param {unknown} varde
 * @param {(falt: string, skal: string) => Error} var_
 * @returns {ReadonlyArray<Kopplingsdeklaration>}
 */
export function byggKopplingar(varde, var_) {
  if (varde === undefined) return Object.freeze([]);
  if (!Array.isArray(varde)) {
    throw var_("kopplingar", `måste vara en lista, inte ${varde === null ? "null" : typeof varde}. En modul utan kopplingar utelämnar fältet eller skriver kopplingar: [].`);
  }
  if (varde.length > MAX_KOPPLINGAR) {
    throw var_("kopplingar", `har ${varde.length} poster. Taket är ${MAX_KOPPLINGAR}.`);
  }
  /** @type {Kopplingsdeklaration[]} */
  const ut = [];
  varde.forEach((/** @type {any} */ f, /** @type {number} */ i) => {
    if (!f || typeof f !== "object" || Array.isArray(f)) {
      throw var_(`kopplingar[${i}]`, `måste vara ett objekt { ${KOPPLINGSDEKLARATIONFALT.join(", ")} }.`);
    }
    const okanda = Object.keys(f).filter((n) => !KOPPLINGSDEKLARATIONFALT.includes(/** @type {any} */ (n)));
    if (okanda.length > 0) {
      const hemlig = okanda.find((n) => HEMLIGA_FALT.includes(/** @type {any} */ (n)));
      throw var_(
        `kopplingar[${i}]`,
        hemlig
          ? `bär fältet ${hemlig}. En nyckel, en token eller ett lösenord hör hemma i identitetens valv, inte i manifestet och inte i vyn.`
          : `bär fälten ${okanda.join(", ")} som inte känns igen. En koppling bär ${KOPPLINGSDEKLARATIONFALT.join(", ")}.`,
      );
    }
    const id = typeof f.id === "string" ? f.id.trim() : "";
    if (!id || !ID_FORM.test(id)) {
      throw var_(`kopplingar[${i}].id ${JSON.stringify(f.id)}`, "måste vara ett id med små bokstäver, siffror, bindestreck och understreck.");
    }
    if (ut.some((x) => x.id === id)) throw var_(`kopplingar[${i}].id "${id}"`, "står två gånger i samma modul.");
    const namn = namnPar(f.namn, var_, `kopplingar[${i}].namn för "${id}"`);
    const hint = f.hint === undefined || f.hint === null ? null : namnPar(f.hint, var_, `kopplingar[${i}].hint för "${id}"`);
    if (!Array.isArray(f.behorigheter)) {
      throw var_(`kopplingar[${i}].behorigheter för "${id}"`, "måste vara en lista { sv, en }. Inga behörigheter skrivs som [].");
    }
    const behorigheter = f.behorigheter.map((/** @type {any} */ b, /** @type {number} */ j) => namnPar(b, var_, `kopplingar[${i}].behorigheter[${j}] för "${id}"`));
    ut.push(Object.freeze({ id, namn, hint, behorigheter: Object.freeze(behorigheter) }));
  });
  return Object.freeze(ut);
}

/**
 * Läget kortet får rita. Hemliga fält kopieras inte, även om appen skickade dem.
 *
 * Saknas raden är svaret "ej ansluten", inte en tom ruta: modulen deklarerade
 * kopplingen, och ingen har anslutit den.
 *
 * @param {unknown} rad
 * @returns {Kopplingslage}
 */
export function lasKopplingslage(rad) {
  const o = rad && typeof rad === "object" && !Array.isArray(rad) ? /** @type {any} */ (rad) : null;
  const status = o && KOPPLINGSSTATUS.includes(o.status) ? o.status : "ej-ansluten";
  const fel = status === "fel" && typeof o?.fel === "string" ? o.fel : "";
  const senasteSynk = o && (typeof o.senasteSynk === "string" || typeof o.senasteSynk === "number") && o.senasteSynk !== "" ? o.senasteSynk : null;
  return { status, fel, senasteSynk };
}
