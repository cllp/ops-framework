/**
 * Typerna för de tolkade filformaten i Biblioteket (0.270.0, cllp/lifehub.app#884), utan tolkarna.
 *
 * ⛔ VARFÖR EN EGEN FIL. `lib/bibliotek.js` behöver typerna i `FILMIME` och `mimeUrFilnamn`, och den ligger i varje apps startfil. Importerade den typerna ur
 * `lib/sie.js`, `lib/kalenderfil.js` och `lib/mejlfil.js` följde tolkarna med in i startfilen, också när förhandsvisningarna hämtas först när de visas
 * (`BibliotekFilvisningLat`): `check:delbarhet` mätte `tolkaSie`, `tolkaIcs` och `tolkaEml` i startfilen. ⛔ ETT HEM (regel 2): tolkarna exporterar dem vidare härifrån.
 */

/** Ändelserna en SIE-fil har: `.se` (typ 1 till 4), `.si` (typ 4i) och `.sie`. */
export const SIE_ANDELSER = Object.freeze(["se", "si", "sie"]);

/** MIME en SIE-fil får i Biblioteket. SIE har ingen registrerad typ, så det här är vår (0.268.0). */
export const SIE_MIME = "text/x-sie";

/** Kalenderfilens MIME i Biblioteket. ⛔ INTE `ICS_MIME` i `node/ics.js`: den är bilagans typ i ett mejl, med teckenkodningen, och hör till en annan väg. */
export const KALENDERFIL_MIME = "text/calendar";

/** Kontaktfilens MIME (RFC 6350). Äldre program säger `text/x-vcard` eller `text/directory` (`MIMEALIAS`). */
export const KONTAKTFIL_MIME = "text/vcard";

/** Typen ett sparat mejl har. */
export const MEJLFIL_MIME = "message/rfc822";
