/**
 * Textstorleken: Liten, Mellan eller Stor (cllp/lifehub.app#873, CP 2026-11-17).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Ärendet bad om ett val med tre lägen i samma panel som hubbens färger, och att det ska gälla hela appen utan att
 * varje komponent rörs. Läsbarhet är personlig: hubbens färger är gemensamma för alla i hubben, textstorleken är
 * den som läser. Därför sparas den som temat, per person, och inte på hubben.
 *
 * ══ ⛔ HUR SKALNINGEN GÖRS ════════════════════════════════════════════════════════════════════════════════
 *
 * Typografins roller (`--text-etikett`, `--text-meta`, `--text-brod` och de andra) skrivs av
 * `scripts/generate-tokens.mjs` som `calc(<storlek> * var(--textskala))`, och radhöjder i rem på samma sätt.
 * `--textskala` är 1 på `:root` och byts av `<html data-textstorlek="liten|stor">`. Ingen komponent vet om valet:
 * de skriver `text-etikett` som förut, och `text-etikett` blir större.
 *
 * ⛔ INTE `html { font-size }`. Det hade skalat allt i rem, alltså också luften (`gap-4`, `p-4`), ikonernas rutor
 * (`size-9`) och radernas golv (`min-h-11`). Valet gäller TEXTEN. En större knapp är ett annat val (zoom), och
 * webbläsaren har redan ett sådant.
 *
 * ⛔ EN SANNING: FAKTORERNA STÅR BARA HÄR. Generatorn läser `TEXTSKALOR` och skriver väljarna i tokens.css, och
 * `--kontrollera` fäller en fil som glidit isär från listan.
 *
 * ⛔ FÄLT ÄR ALDRIG UNDER 16 PX PÅ EN PEKSKÄRM. iOS Safari zoomar in sidan när ett fält under 16 px får fokus, och
 * vid Liten hade fältets 16 px blivit 14,4. Golvet står i tokens.css (`pointer: coarse`), också skrivet av
 * generatorn, och gäller i alla tre lägen.
 *
 * Attributet skrivs på `<html>`, som temat (`theme.js`): väljarna utgår från `:root`, och `--textskala` måste
 * stå på samma element som rollerna räknas på. Skrivs det på `<body>` ärver rollerna det redan uträknade värdet och
 * ingenting ändras.
 */

/** @typedef {"liten" | "mellan" | "stor"} Textstorlek */

/**
 * Lägena och deras faktor, i ordningen väljaren visar dem. `mellan` är 1, alltså dagens storlek och förvalet.
 * @type {Readonly<Record<Textstorlek, number>>}
 */
export const TEXTSKALOR = Object.freeze({ liten: 0.9, mellan: 1, stor: 1.15 });

/** Lägena i ordning. Härledd ur `TEXTSKALOR`, inte avskriven. @type {ReadonlyArray<Textstorlek>} */
export const TEXTSTORLEKAR = Object.freeze(/** @type {Textstorlek[]} */ (Object.keys(TEXTSKALOR)));

/** Förvalet: dagens storlek. */
export const FORVALD_TEXTSTORLEK = /** @type {Textstorlek} */ ("mellan");

/** Attributet på `<html>`. Saknas det gäller förvalet. */
export const TEXTSTORLEK_ATTRIBUT = "data-textstorlek";

const NYCKEL = "ops-textstorlek";

/**
 * @param {unknown} v
 * @returns {v is Textstorlek}
 */
export function arTextstorlek(v) {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(TEXTSKALOR, v);
}

/**
 * Personens val på den här enheten, eller förvalet.
 * @returns {Textstorlek}
 */
export function getTextstorlek() {
  try {
    const sparad = globalThis.localStorage?.getItem(NYCKEL);
    return arTextstorlek(sparad) ? sparad : FORVALD_TEXTSTORLEK;
  } catch {
    // Privat fönster eller blockerad lagring: förvalet, aldrig en krasch.
    return FORVALD_TEXTSTORLEK;
  }
}

/**
 * Skriver valet till `<html>` och sparar det. Träder i kraft direkt: ingen nätväg, ingen väntan.
 * @param {Textstorlek} storlek
 */
export function setTextstorlek(storlek) {
  if (!arTextstorlek(storlek)) {
    throw new Error(`setTextstorlek: okänt läge "${storlek}". Giltiga: ${TEXTSTORLEKAR.join(", ")}.`);
  }
  const rot = globalThis.document?.documentElement;
  if (rot) {
    // Förvalet tar bort attributet, som "system" i temat: utan attribut gäller `:root`, och det är dagens storlek.
    if (storlek === FORVALD_TEXTSTORLEK) rot.removeAttribute(TEXTSTORLEK_ATTRIBUT);
    else rot.setAttribute(TEXTSTORLEK_ATTRIBUT, storlek);
  }
  try {
    globalThis.localStorage?.setItem(NYCKEL, storlek);
  } catch {
    // Valet gäller för den här sidvisningen även om det inte kan sparas.
  }
}

/** Körs en gång vid uppstart, före första renderingen, så texten inte hoppar när valet läses. */
export function initTextstorlek() {
  setTextstorlek(getTextstorlek());
}
