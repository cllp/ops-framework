/**
 * Källan för en moduls egna inställningar, en rad per grupp och modul.
 *
 * ⛔ SAMLINGSNAMNET KOMMER UTIFRÅN. Pinnen "Visa i huvudmenyn" skrivs inte här.
 * Den bor på gruppen (`groups.huvudmeny`), och källan kastar om någon försöker
 * lägga den i värdena.
 *
 * ⛔ LÄSNINGEN KASTAR INTE. En trasig rad står i `trasiga` och släcker inte de andra.
 */

import { trimSomRegeln } from "../lib/bibliotek.js";
import { byggInstallningsvarden, lasInstallningsvarden, MAX_INSTALLNINGSGRUPP, modulinstallningsId, MODULINSTALLNINGFALT } from "../lib/modulinstallningar.js";
import { ID_FORM } from "../lib/katalog.js";
import { byggSkapare } from "../lib/skapare.js";

/**
 * @typedef {object} Modulinstallningssvar
 * @property {{ id: string, modulId: string, varden: Record<string, boolean | string> }[]} poster
 * @property {"databas" | "fel"} kalla
 * @property {Error | null} fel
 * @property {{ id: string, fel: string }[]} trasiga
 */

/**
 * @param {object} config
 * @param {any} config.source
 * @param {string} config.collection
 * @param {string} config.groupId
 * @param {() => { uid?: string | null, namn?: string, typ?: string, kalla?: string }} config.skapare
 */
export function createModulinstallningskalla(config) {
  const { source, collection, groupId: groupIdIn, skapare } = config ?? /** @type {any} */ ({});
  if (!source || typeof source.list !== "function" || typeof source.create !== "function" || typeof source.update !== "function" || typeof source.read !== "function") {
    throw new Error("createModulinstallningskalla: source krävs och måste kunna list, read, create och update.");
  }
  if (typeof collection !== "string" || !collection.trim()) {
    throw new Error("createModulinstallningskalla: collection krävs. Ramverket känner aldrig samlingsnamnet självt.");
  }
  const groupId = trimSomRegeln(groupIdIn);
  if (!groupId || !ID_FORM.test(groupId) || groupId.length > MAX_INSTALLNINGSGRUPP) {
    throw new Error("createModulinstallningskalla: groupId krävs och ska vara ett grupp-id. Utan grupp hade källan läst varje grupps inställningar på en gång.");
  }
  if (typeof skapare !== "function") {
    throw new Error("createModulinstallningskalla: skapare krävs och ska vara en funktion. Den som sparar är den inloggade, och det vet appen, inte ramverket.");
  }

  const fraga = { where: { groupId } };

  return {
    collection,
    groupId,

    /**
     * @returns {Promise<Modulinstallningssvar>}
     */
    async las() {
      try {
        const rader = await source.list(collection, fraga);
        /** @type {Modulinstallningssvar["poster"]} */
        const poster = [];
        /** @type {{ id: string, fel: string }[]} */
        const trasiga = [];
        for (const rad of rader) {
          const id = String(rad?.id ?? "?");
          const fel = radFel(rad, groupId);
          if (fel) {
            trasiga.push({ id, fel });
            continue;
          }
          const last = lasInstallningsvarden(rad.varden);
          if ("fel" in last) {
            trasiga.push({ id, fel: last.fel });
            continue;
          }
          poster.push({ id, modulId: rad.modulId, varden: last.varden });
        }
        return { poster, kalla: "databas", fel: null, trasiga };
      } catch (fel) {
        return { poster: [], kalla: "fel", fel: fel instanceof Error ? fel : new Error(String(fel)), trasiga: [] };
      }
    },

    /**
     * Skriver modulens egna värden. Pinnen hör inte hemma här.
     *
     * @param {{ id: string, installningar?: ReadonlyArray<import("../lib/modulinstallningar.js").Installningsdeklaration> }} modul
     * @param {Readonly<Record<string, boolean | string>>} varden
     */
    async spara(modul, varden) {
      if (!modul || typeof modul.id !== "string" || !ID_FORM.test(modul.id) || modul.id.length > MAX_INSTALLNINGSGRUPP) {
        throw new Error(`Modulens inställningar: modulens id ska vara ett id på högst ${MAX_INSTALLNINGSGRUPP} tecken, samma tak som regeln. Utan det skriver klienten en rad reglerna sedan nekar.`);
      }
      const lista = byggInstallningsvarden(modul, varden);
      const id = modulinstallningsId(groupId, modul.id);
      const vem = byggSkapare(skapare());
      if (vem.typ !== "manniska" || !vem.uid) {
        throw new Error("Modulens inställningar: bara en inloggad person sparar. Agenten skriver inte.");
      }
      const dokument = {
        groupId,
        modulId: modul.id,
        varden: lista,
        uppdateradAv: vem,
        uppdaterad: Date.now(),
      };
      const finns = await source.read(collection, id);
      if (finns) {
        if (finns.groupId !== groupId || finns.modulId !== modul.id) {
          throw new Error(`Modulens inställningar: raden ${id} hör inte till ${groupId}/${modul.id} och skrivs inte över.`);
        }
        await source.update(collection, id, dokument);
      } else {
        await source.create(collection, { id, ...dokument });
      }
      return { id, modulId: modul.id, varden };
    },
  };
}

/**
 * @param {any} rad
 * @param {string} groupId
 * @returns {string | null}
 */
function radFel(rad, groupId) {
  if (!rad || typeof rad !== "object") return "Raden saknas.";
  const okanda = Object.keys(rad).filter((k) => k !== "id" && !MODULINSTALLNINGFALT.includes(/** @type {any} */ (k)));
  if (okanda.length > 0) return `Fälten ${okanda.join(", ")} hör inte till modulens inställningar.`;
  if (rad.groupId !== groupId) return `Raden hör till gruppen "${rad.groupId ?? ""}" och inte till "${groupId}".`;
  if (typeof rad.modulId !== "string" || !ID_FORM.test(rad.modulId)) return "Raden saknar ett modul-id.";
  return null;
}
