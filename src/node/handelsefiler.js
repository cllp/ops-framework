import { handelseBibliotek } from "../lib/bibliotek.js";

/**
 * Städningen när en händelse tas bort för gott (0.121.0, cllp/lifehub.app#366, docs/beslut/0006).
 *
 * ⛔ DET VANLIGA FALLET BEHÖVER INGEN STÄDNING. En klient raderar aldrig en händelse (`delete: if false` i appens regel och i
 * `gruppadSamling`): den arkiveras, och filerna ligger kvar med den och syns igen om arkiveringen ångras. Den här tjänsten är för
 * hård radering med Admin SDK, en gallring eller en begäran om radering av uppgifter, och bara för den.
 *
 * ⛔ DE KVARLÄMNADE FILERNA LÄCKER INTE. Reglerna kräver att händelsen finns för att en post på dess plats ska gå att läsa, så en post vars
 * händelse är borta är osynlig för klienten i samma stund. Det som återstår är skräp, inte åtkomst, och det är skälet att städningen får vara
 * ett eget, avsiktligt anrop och inte en utlösare som körs vid varje radering.
 *
 * ⛔ BARA POSTERNA. Objekten i bucketen tar appens egen funktion bort när posten försvinner (`bibliotekstadning`, som läser `fil.sokvag` och
 * kräver att andra segmentet är postens `groupId`, vilket gäller platsens sträng som den är). Två vägar till samma objekt glider isär, och
 * ramverket rör aldrig bucketen. Samlingsnamnet skickas in.
 *
 * ⛔ TORRT SOM FÖRVAL: `skarpt` måste sägas, som i `createStandardkalenderService`. Svaret har alltid alla fält, också som 0 och tom lista
 * (arbetsreglernas punkt 5): "inga filer" och "ostält" ska gå att skilja, och ett fel på en post stoppar inte de andra och tystas inte.
 *
 * @typedef {object} HandelsefilerRapport
 * @property {boolean} skarpt
 * @property {string} plats Platsen som städades (`handelse~<grupp>~<händelse>`).
 * @property {number} funna Antal poster på platsen.
 * @property {number} raderade Antal poster som togs bort. Torrt alltid 0.
 * @property {{ id: string, fel: string }[]} fel
 *
 * @param {object} konfig
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla Admin SDK-källan. Måste ha `list` och `remove`.
 * @param {{ bibliotek: string }} konfig.samlingar Appens biblioteksamling. Inget förval: ramverket känner inget samlingsnamn.
 */
export function createHandelsefilerService(konfig) {
  const { kalla, samlingar } = konfig ?? /** @type {any} */ ({});
  if (!kalla || typeof kalla.list !== "function" || typeof kalla.remove !== "function") {
    throw new Error("createHandelsefilerService: en datakälla med list och remove krävs. Ramverket känner ingen databas.");
  }
  const BIBLIOTEK = typeof samlingar?.bibliotek === "string" ? samlingar.bibliotek.trim() : "";
  if (!BIBLIOTEK) {
    throw new Error("createHandelsefilerService: samlingar.bibliotek krävs. Ramverket känner aldrig samlingsnamnet, det är appens val.");
  }

  return {
    /**
     * @param {{ groupId: string, handelseId: string, skarpt: boolean }} b
     * @returns {Promise<HandelsefilerRapport>}
     */
    async stada(b) {
      if (typeof b?.skarpt !== "boolean") throw new Error("stada: skarpt måste vara true eller false. Ett torrt steg som råkar skriva är inte torrt.");
      // Platsen byggs FÖRST, så att ett grupp-id eller händelse-id som inte har formen kastar innan något läses eller raderas.
      // ⛔ Frågan är alltid på hela platsen: en tom eller felformad plats hade annars läst gruppens eget bibliotek.
      const plats = handelseBibliotek(b?.groupId, b?.handelseId);
      const rader = await kalla.list(BIBLIOTEK, { where: { groupId: plats } });
      /** @type {HandelsefilerRapport} */
      const rapport = { skarpt: b.skarpt, plats, funna: rader.length, raderade: 0, fel: [] };
      if (!b.skarpt) return rapport;
      for (const rad of rader) {
        const id = String(rad?.id ?? "");
        try {
          // ⛔ EN RAD SOM INTE HÖR TILL PLATSEN RADERAS INTE, hur frågan än blev besvarad. Källan är appens, och en felsvarande källa ska inte kunna
          // ta bort en annan plats poster.
          if (!id || rad.groupId !== plats) throw new Error(`raden hör inte till platsen ${plats}`);
          await kalla.remove(BIBLIOTEK, id);
          rapport.raderade += 1;
        } catch (e) {
          rapport.fel.push({ id: id || "?", fel: e instanceof Error ? e.message : String(e) });
        }
      }
      return rapport;
    },
  };
}
