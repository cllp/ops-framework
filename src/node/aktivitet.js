/**
 * Vägen in i aktivitetsloggen, för det som körs utanför en webbläsare.
 *
 * ══ ⛔ VARFÖR DEN FINNS, OCH VAD DEN LÖSER ══════════════════════════════
 *
 * CP (bolag-ops): "Notiser skall byggas in i ramverket. Och en tydlig väg in för
 * att skriva dom."
 *
 * De som har något att berätta är importskript, synkjobb och utlösare, alltså
 * kod som kör med adminrättigheter och inte har någon skärm. Utan en väg in
 * skriver var och en sitt eget dokument, och listan i appen blir sex olika
 * former som ritas olika.
 *
 * ══ ⛔ EN LOGG SOM KAN SÄNKA JOBBET DEN LOGGAR ÄR VÄRRE ÄN INGEN LOGG ════
 *
 * Det här är hela skälet till att skrivaren ser ut som den gör: `skriv` KASTAR
 * ALDRIG. Den returnerar utfallet.
 *
 * Alternativet vore att låta anroparen linda varje anrop i try. Det fungerar
 * tills någon glömmer en gång, och då faller en lyckad import på att
 * anteckningen om den inte gick att spara. En importerad siffra som rullas
 * tillbaka för att loggen krånglade är exakt fel utfall.
 *
 * ⛔ OCH DEN TIGER INTE HELLER. `skriv` svarar `{ ok, fel }`, så den som vill
 * säga något i sin egen utskrift kan göra det. En logg som sväljer sina egna
 * fel är en logg man tror på utan skäl.
 *
 * ══ ⛔ SKRIVNINGEN INJICERAS, RAMVERKET KÄNNER INGEN DATABAS ════════════
 *
 * `append` kommer utifrån, precis som `fetcher` i `caseMirror` och `db` i
 * datakällorna. Ramverket får inget beroende till firebase-admin, och den som
 * kör mot något annat behöver inte byta ramverk för att få en logg.
 *
 * ══ Användning ══════════════════════════════════════════════════════════
 *
 *   import { createActivityLog, createActivityWriter } from "@staiger/ops-framework/node";
 *
 *   ⛔ BÅDA UR NODSIDAN. Huvudingången har också `createActivityLog`, men den
 *   är webbuntlen: mätt 1946 ms att importera mot nodsidans 8.
 *
 *   const logg = createActivityWriter({
 *     model: createActivityLog({ kinds: SLAG }),
 *     append: (rad) => db.collection("aktivitet").add(rad),
 *     kalla: "import-to-firestore.mjs",
 *   });
 *
 *   const utfall = await logg.skriv({ slag: "import", rubrik: "13 underlag skrevs" });
 *   if (!utfall.ok) console.warn(`aktivitetsloggen: ${utfall.fel}`);
 */

/** @typedef {import("../lib/aktivitet.js").Handelse} Handelse */

/**
 * @typedef {object} Skrivarkonfig
 * @property {ReturnType<typeof import("../lib/aktivitet.js").createActivityLog>} model
 *   Appens modell. ⛔ Krävs: utan den vet skrivaren inte vilka slag som finns,
 *   och en okänd sort blir en rad som ritas tom.
 * @property {(rad: Handelse) => Promise<unknown>} append Skriver raden. Injiceras.
 * @property {string} [kalla] Vilket jobb det är. Sätts på varje rad som inte
 *   säger något annat, så den som läser listan slipper gissa varifrån den kom.
 * @property {() => string} [nu] Bara för prov. Produktionen har en klocka.
 */

/**
 * Bygger skrivaren.
 *
 * ⛔ KONTROLLERAR KONFIGURATIONEN VID UPPSTART, precis som `createCaseMirror`.
 * En skrivare utan `append` hade sett ut att fungera hela vägen till den första
 * raden ingen hittar.
 *
 * @param {Skrivarkonfig} config
 */
export function createActivityWriter(config) {
  if (!config || !config.model || typeof config.model.buildEntry !== "function") {
    throw new Error(
      "createActivityWriter: model krävs, alltså resultatet av createActivityLog. Utan den kan skrivaren varken kontrollera slaget eller bygga raden.",
    );
  }
  if (typeof config.append !== "function") {
    throw new Error(
      "createActivityWriter: append krävs, en funktion som skriver raden. Ramverket känner ingen databas och ska inte göra det.",
    );
  }

  const { model, append, kalla, nu } = config;

  return {
    /**
     * Skriver en rad. Kastar aldrig.
     *
     * ⛔ TVÅ SORTERS FEL SKILJS ÅT I SVARET, och det är inte kosmetik. Ett
     * trasigt utkast är ett PROGRAMFEL hos den som anropar och åtgärdas i koden;
     * en misslyckad skrivning är DRIFT och åtgärdas någon annanstans. Samma
     * `{ ok: false }` för båda hade gjort dem omöjliga att skilja i en utskrift.
     *
     * @param {Partial<Handelse>} utkast
     * @returns {Promise<{ ok: boolean, fel?: string, orsak?: "utkast" | "skrivning", rad?: Handelse }>}
     */
    async skriv(utkast) {
      /** @type {Handelse} */
      let rad;
      try {
        rad = model.buildEntry({ kalla, ...utkast }, nu ? { nu } : undefined);
      } catch (e) {
        return { ok: false, orsak: "utkast", fel: e instanceof Error ? e.message : String(e) };
      }

      try {
        await append(rad);
        return { ok: true, rad };
      } catch (e) {
        return { ok: false, orsak: "skrivning", fel: e instanceof Error ? e.message : String(e), rad };
      }
    },

    /**
     * Skriver en rad om att något gick sönder.
     *
     * ⛔ EN EGEN METOD OCH INTE EN FLAGGA. Den som just fångat ett undantag ska
     * kunna skicka in felet som det är, utan att först komma ihåg att sätta
     * `resultat: "fel"`. Glöms flaggan hamnar ett misslyckande i listan som ett
     * lyckat jobb, och det är den sortens fel som gör hela loggen värdelös.
     *
     * @param {Partial<Handelse>} utkast @param {unknown} fel
     */
    async misslyckades(utkast, fel) {
      return this.skriv({
        ...utkast,
        resultat: "fel",
        fel: fel instanceof Error ? fel.message : String(fel ?? ""),
      });
    },
  };
}
