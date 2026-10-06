/**
 * OKLCH till sRGB, och WCAG-kontrast, för gruppens kulör (#265).
 *
 * ⛔ VARFÖR EN EGEN LITEN OMRÄKNING. Märket ritas i webbläsaren med `oklch(L C H)` (tokens.css, `.ops-gruppmarke`),
 * och kontrastvakten (`scripts/check-gruppfarg.mjs`) och provet för de äldre tonernas kulör måste räkna på EXAKT
 * samma färg. Formlerna är Björn Ottossons (OKLab) och CSS Color 4:s, utan beroenden.
 *
 * ⛔ GAMUT: en kulör vid en viss ljushet och mättnad finns inte alltid i sRGB (gult vid låg ljushet, cyan vid hög
 * mättnad). CSS Color 4 föreslår att mättnaden SÄNKS och ljusheten står kvar (`iGamut`), men Chromium KLIPPER i dag
 * varje kanal för sig (`klippt`), mätt i check-skalyta 22b: Petrol ljust gav ikonen rgb(0, 111, 113), alltså en klippt
 * kanal. Klippningen flyttar luminansen. Vakten räknar därför BÅDA och håller golvet för den sämre.
 */

/**
 * Färgen med varje kanal klippt till 0 till 1, som Chromium ritar den.
 * @param {number} L @param {number} C @param {number} H
 * @returns {[number, number, number]} Linjär sRGB.
 */
export function klippt(L, C, H) {
  const g = oklchTillLinjar(L, C, H).map((v) => {
    // Klippningen sker i GAMMAKODAD sRGB (det webbläsaren lagrar), inte i linjär.
    const kod = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.sign(v) * Math.abs(v) ** (1 / 2.4) - 0.055;
    const k = Math.min(1, Math.max(0, kod));
    return k <= 0.04045 ? k / 12.92 : ((k + 0.055) / 1.055) ** 2.4;
  });
  return /** @type {[number, number, number]} */ (g);
}

/**
 * @param {number} L 0 till 1.
 * @param {number} C
 * @param {number} H Grader.
 * @returns {[number, number, number]} Linjär sRGB, kan ligga utanför 0 till 1.
 */
export function oklchTillLinjar(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const EPS = 1e-6;
/** @param {[number, number, number]} rgb */
const inom = (rgb) => rgb.every((v) => v >= -EPS && v <= 1 + EPS);

/**
 * Färgen som webbläsaren ritar för `oklch(L C H)`: mättnaden sänks tills färgen ryms i sRGB.
 * @param {number} L @param {number} C @param {number} H
 * @returns {[number, number, number]} Linjär sRGB inom 0 till 1.
 */
export function iGamut(L, C, H) {
  let rgb = oklchTillLinjar(L, C, H);
  if (inom(rgb)) return /** @type {[number, number, number]} */ (rgb.map((v) => Math.min(1, Math.max(0, v))));
  let lag = 0;
  let hog = C;
  for (let i = 0; i < 40; i++) {
    const mitt = (lag + hog) / 2;
    if (inom(oklchTillLinjar(L, mitt, H))) lag = mitt;
    else hog = mitt;
  }
  rgb = oklchTillLinjar(L, lag, H);
  return /** @type {[number, number, number]} */ (rgb.map((v) => Math.min(1, Math.max(0, v))));
}

/** WCAG relativ luminans ur LINJÄR sRGB. @param {[number, number, number]} rgb */
export function luminans([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {string} hex `#rrggbb` @returns {[number, number, number]} linjär sRGB */
export function hexTillLinjar(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`oklch: "${hex}" är inte #rrggbb.`);
  const kanal = (/** @type {number} */ i) => {
    const v = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return [kanal(0), kanal(2), kanal(4)];
}

/** Kulören (grader 0 till 359) för en hex-färg, i OKLCH. @param {string} hex */
export function hexKulor(hex) {
  const [r, g, b] = hexTillLinjar(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(bb, a) * 180) / Math.PI;
  return Math.round((h + 360) % 360) % 360;
}

/** WCAG-kontrast mellan två luminanser. @param {number} y1 @param {number} y2 */
export function kontrast(y1, y2) {
  const [ljus, mork] = y1 > y2 ? [y1, y2] : [y2, y1];
  return (ljus + 0.05) / (mork + 0.05);
}
