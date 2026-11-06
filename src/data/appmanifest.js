/**
 * Läser appens webbmanifest, för gästens hemskärmshjälp.
 *
 * Bor här och inte i vyn eftersom `fetch` hör hemma i en adapter
 * (scripts/check-data-layer.mjs). Svaret plockas ned till de två fält vyn
 * använder, så att inget annat ur manifestet läcker vidare.
 *
 * Ett svar som inte är 2xx ger `null`: utan manifest lovar vyn inget
 * app-läge. Nätverksfel och avbrott kastas, och anroparen avgör vad de betyder.
 *
 * @param {string} href
 * @param {{ signal?: AbortSignal }} [val]
 * @returns {Promise<{ display?: string, start_url?: string } | null>}
 */
export async function lasAppmanifest(href, { signal } = {}) {
  const svar = await fetch(href, { signal });
  if (!svar.ok) return null;
  const json = await svar.json();
  if (!json || typeof json !== "object") return null;
  const m = /** @type {{ display?: unknown, start_url?: unknown }} */ (json);
  return {
    ...(typeof m.display === "string" ? { display: m.display } : {}),
    ...(typeof m.start_url === "string" ? { start_url: m.start_url } : {}),
  };
}
