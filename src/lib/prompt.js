/**
 * Promptkällan: appens väg ut till en modell, och ramverkets enda kontrakt mot den.
 *
 * ── ⛔ SAMMA GRÄNS SOM DATALAGRET, AV SAMMA SKÄL ────────────────────────
 *
 * Ramverket når aldrig ett nätverk själv. `createDataSource` finns för att en
 * primitiv som kan sina egna HTTP-anrop är en primitiv som bara passar den app
 * den skrevs i, och det gäller ordagrant här: nyckeln, modellen, taket och
 * vilken leverantör det är hör hemma i appen. Ramverket äger rutan, väntan och
 * felen.
 *
 * Vaktad av `scripts/check-data-layer.mjs`: hittar den en `fetch` eller en
 * SDK-import utanför adaptrarna blir den röd.
 *
 * ── ⛔ KONTRAKTET NÄMNER INGEN LEVERANTÖR ───────────────────────────────
 *
 * In: `{ prompt, context }`. Ut: `{ text, tokens }`. Inget `model`, inget
 * `system`, inget `max_tokens`, ingen `anthropic`. Ett leverantörsfält här är
 * början på en primitiv som inte går att använda i nästa app, och det är exakt
 * den drift ramverket finns för att stoppa.
 *
 * `context` är ogenomskinligt för ramverket. Appen vet vad som får skickas
 * med och bär ansvaret för det: i bolag-ops får ingenting ur `assets/data/**`
 * någonsin nå en prompt.
 *
 * ── ⛔ EN ADAPTER, INTE TVÅ ─────────────────────────────────────────────
 *
 * Formen ska bära ett leverantörsbyte, koden ska bära ett fall. En abstraktion
 * som aldrig haft två implementationer är en gissning om vad som skiljer dem,
 * och gissningen visar sig vara fel just den dagen den andra ska in.
 */

/**
 * @typedef {object} PromptAnswer
 * @property {string} text Svaret, i markdown. Renderas av `OpsMarkdown`.
 * @property {{ in: number, out: number }} [tokens] Vad anropet kostade, när appen vet det.
 */

/**
 * @typedef {object} PromptSource
 * @property {(query: { prompt: string, context?: any }) => Promise<PromptAnswer>} ask
 * @property {number} maxChars
 */

/**
 * Bygger en promptkälla ur appens egen skicka-funktion.
 *
 * ⛔ KASTAR PÅ EN TRASIG KONFIGURATION I STÄLLET FÖR VID FÖRSTA FRÅGAN.
 * En källa utan `send` ser ut att fungera ända tills någon skrivit en fråga
 * och tryckt, alltså upptäcks felet av användaren i stället för av den som
 * kopplade in den.
 *
 * @param {object} [config]
 * @param {(query: { prompt: string, context?: any }) => Promise<any>} [config.send]
 * @param {number} [config.maxChars] Tak för frågans längd. ⛔ Ett tak i tecken och inte i
 *   tokens: tokens går inte att räkna i webbläsaren utan att ta in en tokenizer, och ett tak
 *   som kräver ett bibliotek är ett tak som inte kommer att finnas.
 * @returns {PromptSource}
 */
export function createPromptSource({ send, maxChars = 2000 } = {}) {
  if (typeof send !== "function") {
    throw new Error(
      "createPromptSource: send måste vara en funktion. Ramverket når aldrig ett nätverk själv, appen skickar in vägen ut.",
    );
  }
  if (!Number.isFinite(maxChars) || maxChars <= 0) {
    throw new Error(`createPromptSource: maxChars måste vara ett positivt tal, fick ${maxChars}.`);
  }

  return {
    maxChars,

    /** @param {{ prompt?: string, context?: any }} [query] */
    async ask({ prompt, context } = {}) {
      const text = typeof prompt === "string" ? prompt.trim() : "";
      if (!text) {
        throw new Error("Skriv en fråga först.");
      }
      if (text.length > maxChars) {
        // ⛔ Stoppas här och inte i funktionen på andra sidan. En fråga som
        // avvisas efter ett nätanrop har redan kostat väntan, och felet är
        // dessutom något användaren kan rätta själv innan hen trycker.
        throw new Error(`Frågan är ${text.length} tecken. Taket är ${maxChars}.`);
      }

      const answer = await send({ prompt: text, context });

      /*
       * ⛔ ETT SVAR UTAN TEXT ÄR ETT FEL, INTE ETT TOMT SVAR.
       *
       * En tyst nedsläppsväg hade ritat en tom svarsyta, och en tom yta ser ut
       * som att modellen inte hade något att säga. Skillnaden mot "anropet gick
       * sönder" är hela skillnaden mellan att fråga om igen och att ge upp.
       */
      if (!answer || typeof answer.text !== "string" || !answer.text.trim()) {
        throw new Error("Svaret kom tillbaka tomt. Frågan gick fram, men modellen svarade inget.");
      }

      return { text: answer.text, tokens: answer.tokens };
    },
  };
}
