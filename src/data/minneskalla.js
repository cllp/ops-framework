/**
 * Minneskällan: en grupps rader i en samling appen namnger.
 *
 * ⛔ SAMLINGSNAMNET KOMMER UTIFRÅN. Skrev ramverket namnet här vore det ett antagande om appens databas.
 *
 * ⛔ EN KÄLLA ÄR EN GRUPPS VY. Frågan är alltid `where: { groupId }`. Reglerna är låset.
 *
 * ⛔ LÄSNINGEN KASTAR INTE. Svaret bär `kalla` och `fel`, så vyn kan skilja "minnet är tomt" från
 * "databasen svarade inte". En trasig rad släcker inte de andra: den står i `trasiga`.
 *
 * ⛔ AGENTEN SKRIVER INTE GENOM DEN HÄR KÄLLAN. `skapare` är den inloggade personen, och `byggMinnesrad`
 * avvisar typen agent. Det finns ingen metod som skriver i någon annans namn.
 */

import { trimSomRegeln } from "../lib/bibliotek.js";
import { byggMinnesrad, minnesradFel } from "../lib/minne.js";
import { byggSkapare } from "../lib/skapare.js";

/**
 * @typedef {object} Minnessvar
 * @property {(import("../lib/minne.js").Minnesrad & { id: string })[]} rader
 * @property {"databas" | "fel"} kalla
 * @property {Error | null} fel
 * @property {{ id: string, fel: string }[]} trasiga
 */

/**
 * @param {{ source: any, collection: string, groupId: string, skapare: () => { uid?: string | null, namn?: string, typ?: string, kalla?: string } }} config
 */
export function createMinneskalla(config) {
  const { source, collection, groupId: groupIdIn, skapare } = config ?? /** @type {any} */ ({});

  if (!source || typeof source.list !== "function" || typeof source.create !== "function" || typeof source.update !== "function" || typeof source.read !== "function" || typeof source.remove !== "function") {
    throw new Error("createMinneskalla: source krävs och måste kunna list, read, create, update och remove.");
  }
  if (typeof collection !== "string" || !collection.trim()) {
    throw new Error("createMinneskalla: collection krävs. Ramverket känner aldrig samlingsnamnet självt.");
  }
  const groupId = trimSomRegeln(groupIdIn);
  if (!groupId) {
    throw new Error("createMinneskalla: groupId krävs. Utan grupp hade källan läst hela samlingen, alltså varje grupps minne på en gång.");
  }
  if (typeof skapare !== "function") {
    throw new Error("createMinneskalla: skapare krävs och ska vara en funktion. Den som lyfter raden är den inloggade, och det vet appen, inte ramverket.");
  }

  const fraga = { where: { groupId } };

  /**
   * @param {string} id
   */
  async function egen(id) {
    const tidigare = await source.read(collection, id);
    if (!tidigare) throw new Error(`Minnet: ${collection}/${id} finns inte.`);
    if (tidigare.groupId !== groupId) {
      throw new Error(`Minnet: raden hör till "${tidigare.groupId}" och rörs inte i "${groupId}".`);
    }
    return tidigare;
  }

  return {
    collection,
    groupId,

    /**
     * @returns {Promise<Minnessvar>}
     */
    async las() {
      try {
        const raderIn = await source.list(collection, fraga);
        /** @type {(import("../lib/minne.js").Minnesrad & { id: string })[]} */
        const rader = [];
        /** @type {{ id: string, fel: string }[]} */
        const trasiga = [];
        for (const rad of raderIn) {
          const id = String(rad?.id ?? "?");
          const fel = rad?.groupId !== groupId
            ? `Raden hör till gruppen "${rad?.groupId ?? ""}" och inte till "${groupId}".`
            : minnesradFel(rad);
          if (fel) {
            trasiga.push({ id, fel });
            continue;
          }
          try {
            rader.push({ ...byggMinnesrad(rad), id });
          } catch (e) {
            trasiga.push({ id, fel: e instanceof Error ? e.message : String(e) });
          }
        }
        rader.sort((a, b) => b.lyft - a.lyft);
        return { rader, kalla: "databas", fel: null, trasiga };
      } catch (fel) {
        return { rader: [], kalla: "fel", fel: fel instanceof Error ? fel : new Error(String(fel)), trasiga: [] };
      }
    },

    /**
     * Lyft en rad. Text och källa kommer från vyn. Vem och när sätts här.
     *
     * @param {{ text?: string, kalla?: { slag?: string, samtal?: string, trad?: string, meddelande?: string } }} inmatning
     */
    async lyft(inmatning) {
      const nu = Date.now();
      const rad = byggMinnesrad({
        groupId,
        text: inmatning?.text,
        kalla: inmatning?.kalla,
        lyftAv: byggSkapare(skapare()),
        lyft: nu,
        andrad: nu,
      });
      const skapad = await source.create(collection, rad);
      return { ...rad, id: String(skapad.id) };
    },

    /**
     * Skriv om texten. Gruppen, källan, vem och `lyft` står stilla.
     *
     * @param {string} id
     * @param {string} text
     */
    async andra(id, text) {
      const tidigare = await egen(id);
      const rad = byggMinnesrad({ ...tidigare, text, andrad: Date.now() });
      await source.update(collection, id, rad);
      return { ...rad, id };
    },

    /**
     * Ta bort raden. Regeln avgör vem. Källan vägrar en rad som hör till en annan grupp.
     *
     * @param {string} id
     */
    async taBort(id) {
      await egen(id);
      await source.remove(collection, id);
    },
  };
}
