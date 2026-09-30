/**
 * Skapa-kontraktet: vad plusset erbjuder, och i vilken grupp det hamnar (#150).
 *
 * ══ ⛔ SPEGELBILDEN AV KÄLLORNA ════════════════════════════════════════
 *
 * En källa läser IN i en av ramverkets ytor. En skapa-registrering skriver UT
 * ur plusset. Samma delning i båda riktningarna: ramverket äger panelen,
 * flikarna och typvalet, modulen äger formuläret och skrivningen.
 *
 * ⛔ RAMVERKET SKRIVER ALDRIG MODULENS RAD. Det vore att känna till modulens
 * samling, och det är precis den raden som gör att en kund senare kan bli ett
 * eget Firebase-projekt utan att datamodellen ändras.
 *
 * ══ ⛔ VARFÖR KATALOGKONTROLLEN INTE KAN BO I `defineModule` ═══════════
 *
 * Ärendet säger "kastar vid uppstart". Kataloger kommer ur `kallor.kataloger`,
 * alltså ur en FUNKTION som frågas per grupp, och ingen lista finns förrän den
 * frågats. En kontroll i manifestvalideringen hade alltså behövt gissa, och en
 * vakt som gissar är en vakt som utlovar ett skydd den inte har.
 *
 * `kontrolleraSkaparkataloger` körs i stället så tidigt den KAN: när gruppens
 * kataloger är lästa. Det är senare än ärendets ord, och tidigare än det
 * ögonblick då en användare öppnar en flik vars typlista är tom.
 */

/**
 * Registreringarna som ska ritas, i modulernas registreringsordning.
 *
 * ⛔ EN MODUL SOM INTE ÄR PÅSLAGEN I GRUPPEN BIDRAR INTE. Gruppens `moduler`
 * är listan, och en registrering från en avstängd modul vore en flik som
 * skapar rader ingen kan se efteråt.
 *
 * @param {ReadonlyArray<import("./modul.js").Modul>} moduler Alla registrerade moduler.
 * @param {ReadonlyArray<string>} pasladaModuler Gruppens `moduler`.
 * @returns {Array<import("./modul.js").Skaparregistrering & { modulId: string }>}
 */
export function skaparFor(moduler, pasladaModuler) {
  const pa = new Set(pasladaModuler ?? []);
  /** @type {Array<any>} */
  const ut = [];
  for (const modul of moduler ?? []) {
    if (!pa.has(modul.id)) continue;
    /*
     * ⛔ `modulId` STÄMPLAS AV RAMVERKET, precis som i källregistret. Svaret på
     * "vem äger den här fliken" ska inte vara modulens eget påstående.
     */
    for (const reg of modul.skapar) ut.push({ ...reg, modulId: modul.id });
  }
  return ut;
}

/**
 * Kastar när en registrering pekar på en katalog gruppen inte har.
 *
 * ⛔ ETT FEL OCH INTE EN TOM LISTA. En flik vars typval är tomt ser ut som en
 * katalog någon glömt fylla, alltså som ett konfigurationsfel användaren kan
 * rätta. Det här är ett programmeringsfel: katalogen finns inte alls.
 *
 * @param {ReadonlyArray<{ id: string, katalog: string | null, modulId?: string }>} registreringar
 * @param {ReadonlyArray<string>} kandaKataloger Id på katalogerna gruppen faktiskt har.
 * @returns {void}
 */
export function kontrolleraSkaparkataloger(registreringar, kandaKataloger) {
  if (!Array.isArray(kandaKataloger)) {
    throw new Error(
      `kontrolleraSkaparkataloger: kandaKataloger måste vara en lista katalog-id, inte ${typeof kandaKataloger}. En tom lista är ett svar, en utelämnad är en gissning.`,
    );
  }
  const kanda = new Set(kandaKataloger);
  for (const reg of registreringar ?? []) {
    if (reg.katalog === null) continue;
    if (!kanda.has(reg.katalog)) {
      throw new Error(
        `skapa "${reg.id}"${reg.modulId ? ` i modulen "${reg.modulId}"` : ""}: katalogen "${reg.katalog}" finns inte i gruppen. Kända kataloger: ${kandaKataloger.length > 0 ? kandaKataloger.join(", ") : "inga"}. En flik vars typlista är tom ser ut som en katalog någon glömt fylla, och det här är något annat.`,
      );
    }
  }
}

/**
 * Typerna som går att välja i en registrering, ur gruppens kataloger.
 *
 * ⛔ ARKIVERADE KATEGORIER GÅR INTE ATT VÄLJA MEN FÖRSVINNER INTE UR GAMLA
 * RADER. Det är hela skälet till att arkivering finns i stället för radering:
 * en rad som pekar på en borttagen kategori blir en rad utan ord.
 *
 * @param {string | null} katalogId
 * @param {ReadonlyArray<{ id: string, kategorier?: ReadonlyArray<{ id: string, arkiverad?: boolean, ordning?: number }> }>} kataloger
 * @returns {ReadonlyArray<{ id: string }>} Tom lista när registreringen inte har någon katalog.
 */
export function typerAttValja(katalogId, kataloger) {
  if (katalogId === null) return [];
  const katalogen = (kataloger ?? []).find((k) => k.id === katalogId);
  if (!katalogen) return [];
  return (katalogen.kategorier ?? [])
    .filter((k) => k.arkiverad !== true)
    .slice()
    .sort((a, b) => (a.ordning ?? 0) - (b.ordning ?? 0) || String(a.id).localeCompare(String(b.id), "sv"));
}

/**
 * Vad plusset ska göra för den aktiva gruppen.
 *
 * ⛔ TRE UTFALL OCH INTE TVÅ. "Du är inte med i någon grupp" är inte samma sak
 * som "ingenting att skapa", och en panel som visar samma text för båda lär
 * användaren att plusset är trasigt.
 *
 * ⛔ DET FINNS INGEN GRUPPVÄLJARE FÖRE FORMULÄRET (0.35.0, #190). Allt som
 * skapas hamnar i den aktiva gruppen, och den enda gången det inte finns någon
 * är när personen inte är med i någon grupp alls (`ingenGrupp`).
 *
 * @param {object} arg
 * @param {string | null} arg.lage Den aktiva gruppens id, eller `null` när personen inte har någon grupp.
 * @param {ReadonlyArray<{ id: string }>} arg.registreringar
 * @returns {{ tillstand: "ingenGrupp" | "tomt" | "redo", grupp: string | null }}
 */
export function skapalaget({ lage, registreringar }) {
  /*
   * ⛔ GRUPPFRÅGAN GÅR FÖRST. Utan grupp finns ingen att skriva i, oavsett hur
   * många registreringar som finns. Frågades tomheten först hade en grupplös
   * användare fått veta att det inte finns något att skapa, vilket är fel svar
   * på rätt fråga.
   */
  const grupp = typeof lage === "string" ? lage.trim() : "";
  if (!grupp) return { tillstand: "ingenGrupp", grupp: null };
  if ((registreringar ?? []).length === 0) return { tillstand: "tomt", grupp };
  return { tillstand: "redo", grupp };
}
