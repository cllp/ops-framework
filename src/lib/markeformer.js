import { GRUPPIKONKATALOG } from "./gruppikonkatalog.generated.js";

/**
 * Märkets former för personer och grupper, utan beroenden utöver katalogen (0.70.0, lifehub.identity#27). Flyttade ur
 * `grupp.js`, som återexporterar dem, så att `ops-framework/gruppmarke` når dem utan byggarna för grupper och medlemskap.
 */

/**
 * Standardikoner för en profilbild UTAN Storage (#164, korrigering C).
 *
 * ⛔ VARFÖR DEN HÄR LISTAN FINNS: CP 2026-09-28, mätt mot en skärmbild av
 * SessionStudios profilvy: "PROFILBILD-sektionen erbjuder 'Välj standardikon'
 * ... Det viktiga: standardikon plus färg kräver INGEN Storage, så
 * profilbilden fungerar i bolag-ops i dag." bolag-ops har ingen Storage-
 * konfiguration ännu (`OpsProfil props.lagring` är valfri av precis det
 * skälet), och en profilbild som KRÄVER uppladdning hade alltså varit
 * oanvändbar där tills den dagen. Ett ikon-id plus ett palett-id är två
 * strängar i `users/{uid}`, inga filer, ingen regel för lagring.
 *
 * ⛔ IKON-ID:N ÄR RAMVERKETS EGNA, INTE LUCIDE-KOMPONENTNAMN. `OpsProfil` slår
 * upp id:t mot `src/lib/profilikoner.js` för att rita SVG:n. Skulle raden bära
 * ett Lucide-namn direkt hade ett byte av ikonbibliotek förvandlat varje sparad
 * profil till ett fält ingen kod längre känner igen.
 */
export const PROFILIKONER = /** @type {const} */ (["person", "stjarna", "hjarta", "blixt", "leende", "krona"]);

/**
 * Palettens id:n för en profils bakgrundsfärg, samma sex toner som
 * `OpsIdentity` redan väljer AUTOMATISKT ur `seed` (#164, korrigering C).
 * Ett uttryckligt val åsidosätter det härledda: `identityTone(seed)` förblir
 * FÖRVALET så länge `farg` är tom sträng, ingen ny färgskala.
 */
export const PROFILFARGER = /** @type {const} */ (["1", "2", "3", "4", "5", "6"]);

/**
 * Standardikoner för en GRUPPS märke (0.32.0, #180), utan Storage, samma tanke som `PROFILIKONER`.
 *
 * ⛔ EGNA ID:N OCH EN EGEN LISTA, INTE `PROFILIKONER`. En profil är en person (person, leende), en
 * grupp är en verksamhet (grupp, portfölj, byggnad, hus, bok, jordglob), och att låta en grupp
 * bära "leende" hade sparat ett id vars mening är en annan. Ikonerna ritas ur
 * `src/lib/gruppikoner.js`.
 *
 * ⛔ SEDAN 0.65.0 (#265) ÄR DE HÄR TIO ÄLDRE ID:N, som läses vidare men inte längre skrivs av formuläret. En ny ikon
 * sparas som sitt Lucide-namn ur den sökbara katalogen (`gruppikonkatalog.generated.js`), och ett äldre id ritas med
 * samma Lucide-ikon som förut (`ARV_GRUPPIKON` i `gruppikoner.js`).
 *
 * ⛔ SS-GRUPPERNAS IKONER ÄR MUSIKALISKA (`groupDefaults.js`: gitarr, mikrofon, piano ...). Det är
 * SessionStudios domän, inte ramverkets, och en ops-plattform för bolag ska inte bära den.
 * Formen är densamma: ett ikon-id, eller initialer.
 */
export const GRUPPIKONER = /** @type {const} */ (["grupp", "portfolj", "byggnad", "hus", "bok", "jordglob", "stjarna", "hjarta", "blixt", "krona"]);

/**
 * En grupps märke kan vara initialer i stället för en ikon: `initialer:AB` (1 till 3 tecken).
 * Formen är SS `GROUP_ICON_INITIALS_ID` plus `initialsOverride` i ETT fält, så en grupp har en
 * sanning om sitt märke och inte två fält som kan säga emot varandra.
 */
export const GRUPPINITIALER_FORM = /^initialer:([A-Za-zÅÄÖåäö0-9]{1,3})$/;

/** Katalogens ikonnamn (#265), för att pröva ett sparat namn. */
export const KATALOGNAMN = new Set(GRUPPIKONKATALOG.map((i) => i.namn));

/**
 * Får en PERSON spara `ikon`? Tom sträng, ett namn ur katalogen, eller ett av de sex äldre profil-id:na (0.70.0,
 * lifehub.identity#27). ⛔ Inte `initialer:AB` och inte gruppens äldre id: personens initialer härleds ur namnet, och ett
 * grupp-id på en person har aldrig skrivits av någon väljare.
 * @param {string} ikon
 */
export function arGiltigProfilikon(ikon) {
  return ikon === "" || KATALOGNAMN.has(ikon) || /** @type {readonly string[]} */ (PROFILIKONER).includes(ikon);
}
