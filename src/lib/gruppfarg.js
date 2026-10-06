import { identityTone } from "./identity.js";

/**
 * Gruppens färg som KULÖR (0.65.0, #265).
 *
 * ══ ⛔ VALET: KULÖRVÄGEN, INTE EN KURERAD PALETT ═══════════════════════════════════════════════════════════════
 *
 * CP 2026-10-06 (#265): "Ingen helt fri färgväljare. Användaren väljer kulör, mättnad och ljushet härleds ur temat,
 * i ljust och mörkt läge. Alternativet, en kurerad palett med 12 till 16 färger, väljs bara om kulörvägen inte håller
 * kontrastkraven."
 *
 * Kulörvägen håller, och det är mätt: `scripts/check-gruppfarg.mjs` räknar ALLA 360 kulörer i båda lägena med
 * ljusheten och mättnaden ur `tokens.css` (`--gruppmarke-*`). Sämsta kulören ger ikonen mot plattan 4,9:1 i ljust
 * (kulör 192) och 6,8:1 i mörkt (golv 4,5), och ikonen mot ytan 5,6:1 respektive 7,6:1 (golv 3). Skälet till att det
 * går: OKLCH-ljusheten är perceptuell, så en fast ljushet ger nästan samma luminans oavsett kulör. Vakten räknar både
 * med CSS Color 4:s gamut-kartläggning och med Chromiums klippning, och check-skalyta 22b läser av den ritade färgen
 * pixel för pixel (Petrol ljust 4,95:1 i Chromium mot vaktens 4,93:1).
 *
 * ══ ⛔ LAGRINGEN: `kulor:<grader>`, OCH DE ÄLDRE TONERNA LÄSES VIDARE ════════════════════════════════════════════
 *
 * `Grupp.farg` är `kulor:210`, eller som före 0.65.0 en av de sex tonerna `"1"` till `"6"`, eller tom. Ingenting
 * skrivs om i databasen. En äldre ton RITAS med sin egen kulör (`ARV_TON_KULOR`, tonens kulör i OKLCH ur
 * `--color-identity-N`), i det nya märket: ikonen i färgen på en tonad platta. Det är den dokumenterade migreringen,
 * på läsvägen: samma kulör som förut, ny form, och en grupp utan sparad färg får sin kulör ur `id` precis som den
 * fick sin ton ur `id`. Sparas gruppen i formuläret utan att färgen ändras står `"3"` kvar.
 *
 * ⛔ `ARV_TON_KULOR` ÄR EN HÄRLEDD KOPIA MED VAKT, inte ett andra original: provet `gruppfarg.test.js` räknar
 * kulören ur hexvärdena i `tokens.css` och blir rött om de skiljer sig.
 */

/**
 * `kulor:` följt av 0 till 359, utan inledande nollor (granskningen av PR 266): en lagrad form per kulör, så att
 * `kulor:7` och `kulor:007` aldrig är två värden för samma färg. Övre gränsen prövas i `fargTillKulor`.
 */
export const GRUPPKULOR_FORM = /^kulor:(0|[1-9]\d{0,2})$/;

/** De äldre tonerna (`PROFILFARGER`, "1" till "6") som kulör, i grader. Härledd ur `--color-identity-N`, se filhuvudet. */
export const ARV_TON_KULOR = Object.freeze({ 1: 166, 2: 88, 3: 29, 4: 240, 5: 336, 6: 119 });

/**
 * Tolv kulörer som snabbval i väljaren, var 30:e grad. ⛔ De är förslag, inte en palett: reglaget ger alla 360.
 * Namnen är skärmläsarens och tooltipens, och en kulör bär aldrig betydelse ensam (ikonen gör jobbet).
 */
export const GRUPPKULORFORSLAG = Object.freeze([
  Object.freeze({ kulor: 15, sv: "Hallon", en: "Raspberry" }),
  Object.freeze({ kulor: 45, sv: "Tegel", en: "Brick" }),
  Object.freeze({ kulor: 75, sv: "Orange", en: "Orange" }),
  Object.freeze({ kulor: 105, sv: "Senap", en: "Mustard" }),
  Object.freeze({ kulor: 135, sv: "Oliv", en: "Olive" }),
  Object.freeze({ kulor: 165, sv: "Grön", en: "Green" }),
  Object.freeze({ kulor: 195, sv: "Petrol", en: "Teal" }),
  Object.freeze({ kulor: 225, sv: "Turkos", en: "Cyan" }),
  Object.freeze({ kulor: 255, sv: "Himmel", en: "Sky" }),
  Object.freeze({ kulor: 285, sv: "Blå", en: "Blue" }),
  Object.freeze({ kulor: 315, sv: "Violett", en: "Violet" }),
  Object.freeze({ kulor: 345, sv: "Rosa", en: "Pink" }),
]);

/**
 * Namnet på det snabbval som ligger närmast en kulör, runt cirkeln. Reglagets `aria-valuetext` bär det ("227 grader, Turkos"),
 * så att den som inte ser färgen hör ungefär vilken det är.
 * @param {number} grader @param {string} [sprak]
 */
export function narmasteKulornamn(grader, sprak = "sv") {
  let basta = GRUPPKULORFORSLAG[0];
  let avstand = 361;
  for (const f of GRUPPKULORFORSLAG) {
    const d = Math.min(Math.abs(f.kulor - grader), 360 - Math.abs(f.kulor - grader));
    if (d < avstand) {
      avstand = d;
      basta = f;
    }
  }
  return sprak === "en" ? basta.en : basta.sv;
}

/** @param {number} grader @returns {string} Lagringsformen. */
export function kulorTillFarg(grader) {
  if (!Number.isInteger(grader) || grader < 0 || grader > 359) {
    throw new Error(`gruppfarg: kulören måste vara ett heltal 0 till 359, inte ${JSON.stringify(grader)}.`);
  }
  return `kulor:${grader}`;
}

/**
 * Kulören en sparad färg uttrycker, eller `null` när fältet inte är en känd form.
 * @param {string | undefined | null} farg
 * @returns {number | null}
 */
export function fargTillKulor(farg) {
  const varde = typeof farg === "string" ? farg.trim() : "";
  const m = GRUPPKULOR_FORM.exec(varde);
  if (m) {
    const g = Number(m[1]);
    return g <= 359 ? g : null;
  }
  // ⛔ `Object.hasOwn`, aldrig `in`: `in` når prototypkedjan, så "toString", "constructor" och "__proto__" godtogs som
  // en äldre ton och sparades av `byggGrupp` och `byggAnvandare` (granskningen av PR 275).
  if (Object.hasOwn(ARV_TON_KULOR, varde)) return ARV_TON_KULOR[/** @type {1|2|3|4|5|6} */ (Number(varde))];
  return null;
}

/** Är `farg` något `byggGrupp` får spara? Tom sträng, en äldre ton eller `kulor:0..359`. @param {string} farg */
export function arGiltigGruppfarg(farg) {
  return farg === "" || fargTillKulor(farg) !== null;
}

/**
 * Kulören gruppens märke ritas med: den sparade, annars den som tonen ur `id` hade haft (samma familj som förut).
 * @param {{ farg?: string, id?: string } | null | undefined} grupp
 * @param {string} [seed] Används när gruppen saknar `id` (formulärets nya grupp).
 * @returns {number}
 */
export function gruppKulor(grupp, seed) {
  const sparad = fargTillKulor(grupp?.farg);
  if (sparad !== null) return sparad;
  return ARV_TON_KULOR[identityTone(grupp?.id ?? seed ?? "")];
}
