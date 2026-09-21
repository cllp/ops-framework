/**
 * Promptkällan: appens väg ut till en modell, och ramverkets enda kontrakt mot den.
 *
 * ── ⛔ SAMMA GRÄNS SOM DATALAGRET, AV SAMMA SKÄL ────────────────────────
 *
 * Ramverket når aldrig ett nätverk själv. `skapaDatakalla` finns för att en
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
 * In: `{ prompt, sammanhang }`. Ut: `{ text, tokens }`. Inget `model`, inget
 * `system`, inget `max_tokens`, ingen `anthropic`. Ett leverantörsfält här är
 * början på en primitiv som inte går att använda i nästa app, och det är exakt
 * den drift ramverket finns för att stoppa.
 *
 * `sammanhang` är ogenomskinligt för ramverket. Appen vet vad som får skickas
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
 * @typedef {object} Promptsvar
 * @property {string} text Svaret, i markdown. Renderas av `OpsMarkdown`.
 * @property {{ in: number, ut: number }} [tokens] Vad anropet kostade, när appen vet det.
 */

/**
 * @typedef {object} Promptkalla
 * @property {(fraga: { prompt: string, sammanhang?: any }) => Promise<Promptsvar>} fraga
 * @property {number} maxTecken
 */

/**
 * Bygger en promptkälla ur appens egen skicka-funktion.
 *
 * ⛔ KASTAR PÅ EN TRASIG KONFIGURATION I STÄLLET FÖR VID FÖRSTA FRÅGAN.
 * En källa utan `skicka` ser ut att fungera ända tills någon skrivit en fråga
 * och tryckt, alltså upptäcks felet av användaren i stället för av den som
 * kopplade in den.
 *
 * @param {object} [konfig]
 * @param {(fraga: { prompt: string, sammanhang?: any }) => Promise<any>} [konfig.skicka]
 * @param {number} [konfig.maxTecken] Tak för frågans längd. ⛔ Ett tak i tecken och inte i
 *   tokens: tokens går inte att räkna i webbläsaren utan att ta in en tokenizer, och ett tak
 *   som kräver ett bibliotek är ett tak som inte kommer att finnas.
 * @returns {Promptkalla}
 */
export function skapaPromptkalla({ skicka, maxTecken = 2000 } = {}) {
  if (typeof skicka !== "function") {
    throw new Error(
      "skapaPromptkalla: skicka måste vara en funktion. Ramverket når aldrig ett nätverk själv, appen skickar in vägen ut.",
    );
  }
  if (!Number.isFinite(maxTecken) || maxTecken <= 0) {
    throw new Error(`skapaPromptkalla: maxTecken måste vara ett positivt tal, fick ${maxTecken}.`);
  }

  return {
    maxTecken,

    /** @param {{ prompt?: string, sammanhang?: any }} [fraga] */
    async fraga({ prompt, sammanhang } = {}) {
      const text = typeof prompt === "string" ? prompt.trim() : "";
      if (!text) {
        throw new Error("Skriv en fråga först.");
      }
      if (text.length > maxTecken) {
        // ⛔ Stoppas här och inte i funktionen på andra sidan. En fråga som
        // avvisas efter ett nätanrop har redan kostat väntan, och felet är
        // dessutom något användaren kan rätta själv innan hen trycker.
        throw new Error(`Frågan är ${text.length} tecken. Taket är ${maxTecken}.`);
      }

      const svar = await skicka({ prompt: text, sammanhang });

      /*
       * ⛔ ETT SVAR UTAN TEXT ÄR ETT FEL, INTE ETT TOMT SVAR.
       *
       * En tyst nedsläppsväg hade ritat en tom svarsyta, och en tom yta ser ut
       * som att modellen inte hade något att säga. Skillnaden mot "anropet gick
       * sönder" är hela skillnaden mellan att fråga om igen och att ge upp.
       */
      if (!svar || typeof svar.text !== "string" || !svar.text.trim()) {
        throw new Error("Svaret kom tillbaka tomt. Frågan gick fram, men modellen svarade inget.");
      }

      return { text: svar.text, tokens: svar.tokens };
    },
  };
}
