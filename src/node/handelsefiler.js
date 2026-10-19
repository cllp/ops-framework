import { arObjektbibliotek, handelseBibliotek } from "../lib/bibliotek.js";

/**
 * Städningen när en händelse eller ett ärende tas bort för gott (händelse 0.121.0, ärende 0.122.0, cllp/lifehub.app#366,
 * docs/beslut/0006 och 0007).
 *
 * ⛔ DET VANLIGA FALLET BEHÖVER INGEN STÄDNING. En klient raderar aldrig en händelse (`delete: if false` i appens regel och i
 * `gruppadSamling`): den arkiveras, och filerna ligger kvar med den och syns igen om arkiveringen ångras. Ett ärende raderas inte heller av en
 * klient (inkorgens `update, delete: if false`). Den här tjänsten är för hård radering med Admin SDK, en gallring eller en begäran om
 * radering av uppgifter, och bara för den.
 *
 * ⛔ DE KVARLÄMNADE FILERNA LÄCKER INTE. Reglerna kräver att händelsen eller ärendet finns för att en post på dess plats ska gå att läsa, så en
 * post vars objekt är borta är osynlig för klienten i samma stund. Det som återstår är skräp, inte åtkomst, och det är skälet att städningen får
 * vara ett eget, avsiktligt anrop och inte en utlösare som körs vid varje radering.
 *
 * ⛔ BARA POSTERNA. Objekten i bucketen tar appens egen funktion bort när posten försvinner (`bibliotekstadning`, som läser `fil.sokvag` och
 * kräver att andra segmentet är postens `groupId`, vilket gäller platsens sträng som den är). Två vägar till samma objekt glider isär, och
 * ramverket rör aldrig bucketen. Samlingsnamnet skickas in.
 *
 * ⛔ TORRT SOM FÖRVAL: `skarpt` måste sägas, som i `createStandardkalenderService`. Svaret har alltid alla fält, också som 0 och tom lista
 * (arbetsreglernas punkt 5): "inga filer" och "ostält" ska gå att skilja, och ett fel på en post stoppar inte de andra och tystas inte.
 *
 * ⛔ BARA EN OBJEKTPLATS. `stada({ plats })` kastar för allt som inte är en händelses eller ett ärendes plats, före något läses: gruppens egen
 * plats är gruppens bibliotek, och en städning av den hade tagit bort alla gruppens filer.
 *
 * @typedef {object} HandelsefilerRapport
 * @property {boolean} skarpt
 * @property {string} plats Platsen som städades (`handelse~<grupp>~<händelse>` eller `arende~<grupp>~<id>`).
 * @property {number} funna Antal poster på platsen.
 * @property {number} raderade Antal poster som togs bort. Torrt alltid 0.
 * @property {{ id: string, fel: string }[]} fel
 */

/**
 * Tjänsten bakom `createPlatsfilerService` och `createHandelsefilerService`. Namnet är den exporterade fabrikens, så att ett fel pekar på det anropet
 * appen faktiskt skrev.
 * @param {any} konfig
 * @param {string} fabrik
 */
function byggTjanst(konfig, fabrik) {
  const { kalla, samlingar } = konfig ?? /** @type {any} */ ({});
  if (!kalla || typeof kalla.list !== "function" || typeof kalla.remove !== "function") {
    throw new Error(`${fabrik}: en datakälla med list och remove krävs. Ramverket känner ingen databas.`);
  }
  const BIBLIOTEK = typeof samlingar?.bibliotek === "string" ? samlingar.bibliotek.trim() : "";
  if (!BIBLIOTEK) {
    throw new Error(`${fabrik}: samlingar.bibliotek krävs. Ramverket känner aldrig samlingsnamnet, det är appens val.`);
  }

  return {
    /**
     * @param {{ plats: string, skarpt: boolean }} b
     * @returns {Promise<HandelsefilerRapport>}
     */
    async stada(b) {
      if (typeof b?.skarpt !== "boolean") throw new Error("stada: skarpt måste vara true eller false. Ett torrt steg som råkar skriva är inte torrt.");
      // ⛔ Platsen prövas FÖRST, så att allt som inte är en objektplats kastar innan något läses eller raderas. Frågan är alltid på hela platsen:
      // en tom eller felformad plats hade annars läst gruppens eget bibliotek.
      if (!arObjektbibliotek(b?.plats)) {
        throw new Error(`stada: "${String(b?.plats ?? "")}" är ingen händelses eller ärendes plats (handelseBibliotek eller arendeBibliotek). Gruppens egen plats städas inte här: den är gruppens bibliotek.`);
      }
      const plats = b.plats;
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

/**
 * Städningen av ETT OBJEKTS filer, en händelses eller ett ärendes (0.122.0): `stada({ plats, skarpt })` med platsen ur `handelseBibliotek` eller
 * `arendeBibliotek`.
 *
 * @param {object} konfig
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla Admin SDK-källan. Måste ha `list` och `remove`.
 * @param {{ bibliotek: string }} konfig.samlingar Appens biblioteksamling. Inget förval: ramverket känner inget samlingsnamn.
 */
export function createPlatsfilerService(konfig) {
  return byggTjanst(konfig, "createPlatsfilerService");
}

/**
 * Städningen av en HÄNDELSES filer (0.121.0), kvar med samma anrop: `stada({ groupId, handelseId, skarpt })`. Samma tjänst som
 * `createPlatsfilerService`, med platsen byggd ur grupp och händelse. För ett ärende: `createPlatsfilerService`.
 *
 * @param {object} konfig
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla Admin SDK-källan. Måste ha `list` och `remove`.
 * @param {{ bibliotek: string }} konfig.samlingar Appens biblioteksamling. Inget förval: ramverket känner inget samlingsnamn.
 */
export function createHandelsefilerService(konfig) {
  const tjanst = byggTjanst(konfig, "createHandelsefilerService");
  return {
    /**
     * @param {{ groupId: string, handelseId: string, skarpt: boolean }} b
     * @returns {Promise<HandelsefilerRapport>}
     */
    async stada(b) {
      if (typeof b?.skarpt !== "boolean") throw new Error("stada: skarpt måste vara true eller false. Ett torrt steg som råkar skriva är inte torrt.");
      // Platsen byggs FÖRST, så att ett grupp-id eller händelse-id som inte har formen kastar innan något läses eller raderas.
      return tjanst.stada({ plats: handelseBibliotek(b?.groupId, b?.handelseId), skarpt: b.skarpt });
    },
  };
}
