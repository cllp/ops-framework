/**
 * Modellerna en agent kan svara med (0.90.2).
 *
 * CP: han ska kunna välja och byta modell. Ingen förteckning fanns, varken i
 * ramverket eller i funktionerna. Lifehub har en enda konstant,
 * `gemini-2.5-flash-lite`, och Identity tar en leverantör (`vertex`, `google`,
 * `openai`, `anthropic`) utan modellnamn. Den här listan är den lilla
 * förteckningen, en modell per leverantör som kan chatta.
 *
 * ⛔ CURSOR FINNS INTE HÄR. Identity har en cursor-nyckel, men den chattar inte.
 * En rad som inte går att svara med hade varit en död kontroll.
 *
 * ⛔ FUNKTIONERNA LÄSER INTE FÄLTET ÄN. `modellFor` i lifehub anropar alltid
 * konstanten, och `sparaAgent` avvisar en okänd åtgärd. Vyn sparar
 * `{ id, leverantor }`. Bygget som ska läsa det är ett funktionspass, och det
 * måste deployas innan ett val ändrar vad agenten svarar med.
 */

/** @typedef {{ id: string, leverantor: string, nyckel: boolean, namn: { sv: string, en: string }, beskrivning: { sv: string, en: string } }} AgentModell */

/** @type {readonly AgentModell[]} */
export const AGENTMODELLER = Object.freeze([
  Object.freeze({
    id: "gemini-2.5-flash-lite",
    leverantor: "vertex",
    nyckel: false,
    namn: { sv: "Gemini Flash Lite", en: "Gemini Flash Lite" },
    beskrivning: { sv: "Snabb och kort. Körs i gruppens moln, utan egen nyckel.", en: "Fast and short. Runs in the group's cloud, without your own key." },
  }),
  Object.freeze({
    id: "gemini-2.5-flash",
    leverantor: "google",
    nyckel: true,
    namn: { sv: "Gemini Flash", en: "Gemini Flash" },
    beskrivning: { sv: "Mer utrymme än Flash Lite. Kräver en Google-nyckel.", en: "More room than Flash Lite. Needs a Google key." },
  }),
  Object.freeze({
    id: "gpt-4.1-mini",
    leverantor: "openai",
    nyckel: true,
    namn: { sv: "GPT-4.1 mini", en: "GPT-4.1 mini" },
    beskrivning: { sv: "OpenAI:s snabba modell. Kräver en OpenAI-nyckel.", en: "OpenAI's fast model. Needs an OpenAI key." },
  }),
  Object.freeze({
    id: "claude-sonnet-4-5",
    leverantor: "anthropic",
    nyckel: true,
    namn: { sv: "Claude Sonnet", en: "Claude Sonnet" },
    beskrivning: { sv: "Anthropic. Kräver en Anthropic-nyckel.", en: "Anthropic. Needs an Anthropic key." },
  }),
]);

const utanNyckel = AGENTMODELLER.filter((m) => m.nyckel === false);
if (utanNyckel.length !== 1) {
  throw new Error("AGENTMODELLER: exakt en modell ska gå att välja utan nyckel. Annars vet varken vyn eller funktionen vad som är förvalet.");
}

/** Modellen som svarar när ingen nyckel är kopplad. Samma id som lifehubs `MODELL` i dag. */
export const FORVALD_AGENTMODELL = utanNyckel[0];

/**
 * Modellen med det id:t, eller med samma visningsnamn. Tom sträng och ett okänt
 * id är `null`: det är ett svar, inte ett kast, och id:t ritas inte.
 *
 * @param {unknown} id
 * @returns {AgentModell | null}
 */
export function modellUrId(id) {
  if (typeof id !== "string") return null;
  const s = id.trim();
  if (!s) return null;
  return AGENTMODELLER.find((m) => m.id === s || m.namn.sv === s || m.namn.en === s) ?? null;
}

/**
 * En modell utan nyckel går alltid att välja. En med nyckel bara när leverantören
 * står i `kopplade`. Utan lista är svaret nej: en utelämnad nyckel är inte en
 * kopplad nyckel.
 *
 * @param {AgentModell | null | undefined} modell
 * @param {readonly string[] | null | undefined} kopplade
 */
export function modellKanValjas(modell, kopplade) {
  if (!modell) return false;
  if (modell.nyckel !== true) return true;
  if (!Array.isArray(kopplade)) return false;
  return kopplade.includes(modell.leverantor);
}
