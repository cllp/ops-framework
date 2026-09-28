import { useEffect, useState } from "react";

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

/**
 * Det FAKTISKT visade läget just nu: "light" eller "dark", aldrig "system".
 * Skiljer sig från `getTheme()`, som kan svara "system" utan att säga vilket
 * det blev. En bildväxlare (`OpsBrand`, #164 korrigering B: "ordmärket som
 * bild via OpsBrand-bilder") måste veta VILKEN fil som ska visas, inte att
 * frågan är "fråga enheten".
 *
 * @returns {"light"|"dark"}
 */
export function resolvedTheme() {
  const attribut = globalThis.document?.documentElement?.getAttribute("data-theme");
  if (attribut === "light" || attribut === "dark") return attribut;
  // ⛔ Ingen `matchMedia` i jsdom/SSR: samma skydd som `OpsPanel.jsx` redan
  // har för sin breddfråga. Ljust är den befintliga defaulten i hela
  // ramverket (tokens.css `:root`), inte en gissning som lagts till här.
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * React-hook: samma svar som `resolvedTheme()`, men omritad när valet ändras.
 * Bevakar TVÅ källor, för temat kan ändras av två helt olika skäl: ett tryck
 * i `OpsSelect`/en toggle NU (attributet på `<html>` ändras direkt, ingen
 * `storage`-händelse i samma flik) eller att systemet bytt läge medan "system"
 * är valt (ingen attributändring alls, bara `matchMedia` säger något nytt).
 *
 * @returns {"light"|"dark"}
 */
export function useResolvedTheme() {
  const [tema, setTema] = useState(resolvedTheme);
  useEffect(() => {
    const uppdatera = () => setTema(resolvedTheme());
    const root = globalThis.document?.documentElement;
    const observer = root && typeof MutationObserver !== "undefined" ? new MutationObserver(uppdatera) : null;
    observer?.observe(/** @type {Element} */ (root), { attributes: true, attributeFilter: ["data-theme"] });
    const media = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    media?.addEventListener("change", uppdatera);
    return () => {
      observer?.disconnect();
      media?.removeEventListener("change", uppdatera);
    };
  }, []);
  return tema;
}
