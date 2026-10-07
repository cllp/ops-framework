/**
 * Bibliotekskällan: en grupps poster i en samling appen namnger.
 *
 * ⛔ SAMLINGSNAMNET KOMMER UTIFRÅN, samma rad som i katalogkällan. Skrev
 * ramverket namnet här vore det ett antagande om appens databas.
 *
 * ⛔ EN KÄLLA ÄR EN GRUPPS VY. Frågan är alltid `where: { groupId }`. Reglerna
 * är låset. Den här filtreringen är det klienten behöver för att frågan ska
 * gå att bevisa.
 *
 * ⛔ LÄSNINGEN KASTAR INTE. Svaret bär `kalla` och `fel`, så en vy kan skilja
 * "biblioteket är tomt" från "databasen svarade inte". En tom lista ensam är
 * båda, och det är regel 5.
 */

import { byggPost, postFel } from "../lib/bibliotek.js";
import { byggSkapare } from "../lib/skapare.js";

/**
 * @typedef {object} Bibliotekssvar
 * @property {(import("../lib/bibliotek.js").Bibliotekspost & { id: string })[]} poster
 * @property {"databas" | "fel"} kalla
 * @property {Error | null} fel
 */

/**
 * @param {{ source: any, collection: string, groupId: string, skapare: () => { uid?: string | null, namn?: string, typ?: string, kalla?: string } }} config
 */
export function createBibliotekskalla(config) {
  const { source, collection, groupId: groupIdIn, skapare } = config ?? /** @type {any} */ ({});

  if (!source || typeof source.list !== "function" || typeof source.create !== "function" || typeof source.update !== "function" || typeof source.read !== "function") {
    throw new Error("createBibliotekskalla: source krävs och måste kunna list, read, create och update.");
  }
  if (typeof collection !== "string" || !collection.trim()) {
    throw new Error(
      "createBibliotekskalla: collection krävs. Ramverket känner aldrig samlingsnamnet självt, eftersom det är raden som gör en framtida kund till ett eget projekt utan att datamodellen ändras.",
    );
  }
  const groupId = typeof groupIdIn === "string" ? groupIdIn.trim() : "";
  if (!groupId) {
    throw new Error(
      "createBibliotekskalla: groupId krävs. Utan grupp hade källan läst hela samlingen, alltså varje grupps bibliotek på en gång.",
    );
  }
  if (typeof skapare !== "function") {
    throw new Error("createBibliotekskalla: skapare krävs och ska vara en funktion. Den som skriver raden är den inloggade, och det vet appen, inte ramverket.");
  }

  const fraga = { where: { groupId } };

  return {
    collection,
    groupId,

    /**
     * @returns {Promise<Bibliotekssvar>}
     */
    async las() {
      try {
        const rader = await source.list(collection, fraga);
        const poster = [];
        for (const rad of rader) {
          const fel = postFel(rad);
          if (fel) {
            return {
              poster: [],
              kalla: "fel",
              fel: new Error(`${collection}/${rad?.id ?? "?"}: ${fel}`),
            };
          }
          poster.push({ ...byggPost(rad), id: String(rad.id) });
        }
        return { poster, kalla: "databas", fel: null };
      } catch (fel) {
        return { poster: [], kalla: "fel", fel: fel instanceof Error ? fel : new Error(String(fel)) };
      }
    },

    /**
     * Ny post, eller en ändring av en som redan finns.
     *
     * Författare och klockslag sätts här. Vyn skickar typ, rubrik och text
     * eller adress. En vy som fick skriva `skapadAv` hade kunnat lägga raden
     * i någon annans namn, och regeln hade sagt nej först i produktion.
     *
     * @param {{ id?: string, typ?: string, rubrik?: string, text?: string, url?: string }} inmatning
     */
    async spara(inmatning) {
      const id = typeof inmatning?.id === "string" ? inmatning.id.trim() : "";
      const nu = Date.now();
      /** @type {Record<string, unknown> | null} */
      let tidigare = null;
      if (id) {
        tidigare = await source.read(collection, id);
        if (!tidigare) throw new Error(`Biblioteket: ${collection}/${id} finns inte.`);
        if (tidigare.groupId !== groupId) {
          throw new Error(`Biblioteket: posten hör till "${tidigare.groupId}" och sparas inte i "${groupId}".`);
        }
      }
      const post = byggPost({
        groupId,
        typ: id ? tidigare?.typ : inmatning?.typ,
        rubrik: inmatning?.rubrik,
        text: inmatning?.text,
        url: inmatning?.url,
        skapadAv: id ? tidigare?.skapadAv : byggSkapare(skapare()),
        skapad: id ? tidigare?.skapad : nu,
        andrad: nu,
      });
      if (id) {
        await source.update(collection, id, post);
        return { ...post, id };
      }
      const skapad = await source.create(collection, post);
      return { ...post, id: String(skapad.id) };
    },
  };
}
