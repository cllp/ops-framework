/**
 * Ljust och mörkt läge. Tre tillstånd, inte två.
 *
 * ⛔ Den vanliga buggen är att behandla temat som en boolean. Då finns bara
 * "mörkt av" och "mörkt på", och "följ systemet" försvinner. Användaren som
 * aldrig valt något hamnar då permanent i ljust läge även om telefonen står i
 * mörkt, och det ser ut som att inställningen är trasig.
 *
 * Attributet skrivs på `<html>` eftersom tokenkontraktets selektorer utgår från
 * `:root`. Skriver du det på `<body>` matchar ingenting och felet är stumt.
 */

/** @typedef {"light" | "dark" | "system"} Temalage */

const KEY = "ops-theme";
/** @type {Temalage[]} */
const GILTIGA = ["light", "dark", "system"];

/**
 * Läser användarens val. Aldrig vad systemet råkar stå på: det är ett annat
 * faktum och blandas de ihop går valet inte att skilja från slumpen.
 * @returns {Temalage}
 */
export function getTheme() {
  try {
    const saved = globalThis.localStorage?.getItem(KEY);
    return GILTIGA.includes(/** @type {Temalage} */ (saved)) ? /** @type {Temalage} */ (saved) : "system";
  } catch {
    // Privat fönster eller blockerad lagring. Systemval är rätt svar, inte en krasch.
    return "system";
  }
}

/**
 * Skriver valet till `<html>` och sparar det.
 * @param {Temalage} state
 */
export function setTheme(state) {
  if (!GILTIGA.includes(state)) throw new Error(`setTheme: okänt läge "${state}". Giltiga: ${GILTIGA.join(", ")}.`);
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (state === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", state);
  try {
    globalThis.localStorage?.setItem(KEY, state);
  } catch {
    // Valet gäller för den här sidvisningen även om det inte kan sparas.
  }
}

/**
 * Körs en gång vid uppstart, före första renderingen, så sidan inte blinkar
 * ljust innan valet hunnit läsas.
 */
export function initTheme() {
  setTheme(getTheme());
}
