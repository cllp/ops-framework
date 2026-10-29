/**
 * Platskällan: en grupps egna platser i Biblioteket, i en samling appen namnger (0.155.0, cllp/ops-framework#469).
 *
 * ⛔ SAMLINGSNAMNET KOMMER UTIFRÅN. Ramverket känner aldrig samlingsnamnet eller projekt-id:t (det är raden som gör att en kund senare kan bli ett eget Firebase-projekt utan att datamodellen ändras).
 * Appen skickar källan (`createFirestoreSource` mot sitt projekt) och namnet, med samma namn som till `platsregelfragment`.
 *
 * ⛔ EN KÄLLA ÄR EN GRUPPS VY, som bibliotekskällan: frågan är alltid `where: { groupId }`, och reglerna är låset. Läsningen kastar inte: svaret bär `kalla` och `fel`, så vyn kan skilja "gruppen har inga egna
 * platser" från "databasen svarade inte" (regel 5), och en trasig rad står i `trasiga` i stället för att släcka de andra.
 *
 * ⛔ ID:T ÄR UNIKT GENOM DOKUMENT-ID:T, OCH KÄLLAN GÖR INGEN LÄS-SEDAN-SKRIV-KONTROLL FÖR DET. Nyckeln är `<grupp>|<id>` (`platsnyckel`). Skriver en andra person samma nyckel är det en ändring av en rad som
 * redan finns, och reglerna släpper bara in `namn` och `arkiverad` där: skaparen och tiden måste vara de gamla. Det andra skrivet nekas alltså av databasen, och `skapa` översätter nekandet till en mening som säger
 * det. Med en källa som har `createNew` (minnet, Admin SDK) skrivs aldrig något över. Listan som `skapa` läser först används bara för att härleda ett ledigt id och ge ett vänligt besked om ett dubblettnamn: den är
 * inte skyddet.
 *
 * ⛔ SKAPARE OCH KLOCKA SÄTTS HÄR. Vyn skickar namn (och eventuellt id). En vy som fick skriva `skapadAv` hade kunnat lägga en plats i någons namn, och regeln hade sagt nej först i produktion.
 */

import { byggPlats, lasPlatser, platsFranRad, platsnamnFel, platsnyckel } from "../lib/platser.js";
import { trimSomRegeln } from "../lib/bibliotek.js";
import { ID_FORM } from "../lib/katalog.js";
import { byggSkapare } from "../lib/skapare.js";

/**
 * @typedef {object} Platssvar
 * @property {import("../lib/platser.js").Plats[]} platser Sorterade på namn. Arkiverade ingår: det är `platsval` som döljer dem, så att en vy kan visa dem under Inställningar.
 * @property {{ id: string, fel: string }[]} trasiga Rader som inte gick att läsa. Också tomt är ett svar.
 * @property {"databas" | "fel"} kalla
 * @property {Error | null} fel
 */

/**
 * @param {object} config
 * @param {any} config.source En datakälla (`createFirestoreSource`, `createMemorySource`).
 * @param {string} config.platser Samlingsnamnet appen valt. Samma som till `platsregelfragment`.
 * @param {string} config.groupId Gruppen vars platser källan visar.
 * @param {() => { uid?: string | null, namn?: string, typ?: string, kalla?: string }} config.skapare Den inloggade. Appen vet vem det är, inte ramverket.
 */
export function createPlatskalla(config) {
  const { source, platser: samling, groupId: groupIdIn, skapare } = config ?? /** @type {any} */ ({});
  if (!source || typeof source.list !== "function" || typeof source.create !== "function" || typeof source.update !== "function" || typeof source.read !== "function") {
    throw new Error("createPlatskalla: source krävs och måste kunna list, read, create och update.");
  }
  if (typeof samling !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(samling)) {
    throw new Error(
      "createPlatskalla: platser krävs, samlingsnamnet. Ramverket känner aldrig samlingsnamnet självt, eftersom det är raden som gör en framtida kund till ett eget projekt utan att datamodellen ändras.",
    );
  }
  const groupId = trimSomRegeln(groupIdIn);
  if (!ID_FORM.test(groupId)) {
    throw new Error("createPlatskalla: groupId krävs och ska vara ett grupp-id. Utan grupp hade källan läst hela samlingen, alltså varje grupps platser på en gång.");
  }
  if (typeof skapare !== "function") {
    throw new Error("createPlatskalla: skapare krävs och ska vara en funktion. Den som skriver raden är den inloggade, och det vet appen, inte ramverket.");
  }
  const fraga = { where: { groupId } };

  /** @param {any[]} rader @returns {Platssvar} */
  const svarUr = (rader) => ({ ...lasPlatser(rader), kalla: "databas", fel: null });

  const kanStromma = typeof source.subscribe === "function" && (typeof source.canSubscribe === "function" ? Boolean(source.canSubscribe(samling)) : true);

  /**
   * Skälet i en mening, för ett nekat skrivförsök. Databasens kod (`permission-denied`) säger inte VAD som nekades, så meningen nämner de två möjligheterna.
   * @param {unknown} e
   * @param {string} nar
   * @returns {Error}
   */
  const skrivfel = (e, nar) => {
    const kod = e && typeof e === "object" && typeof (/** @type {any} */ (e).code) === "string" ? /** @type {any} */ (e).code : "";
    const text = e instanceof Error ? e.message : String(e);
    if (kod === "permission-denied" || /permission|insufficient/i.test(text)) {
      return new Error(`${nar} Platsen kan redan finnas med det id:t, eller så får du inte ändra den (bara den som skapade platsen, ägare och admin).`);
    }
    return e instanceof Error ? e : new Error(text);
  };

  /** @param {string} platsId */
  const hamta = async (platsId) => {
    const rad = await source.read(samling, platsnyckel(groupId, platsId));
    if (!rad) throw new Error(`Platsen ${platsId} finns inte.`);
    const svar = platsFranRad(rad);
    if (!("plats" in svar)) throw new Error(`Platsen ${platsId} går inte att läsa. ${svar.fel}`);
    return svar.plats;
  };

  return {
    samling,
    groupId,

    /** @returns {Promise<Platssvar>} */
    async las() {
      try {
        return svarUr(await source.list(samling, fraga));
      } catch (fel) {
        return { platser: [], trasiga: [], kalla: "fel", fel: fel instanceof Error ? fel : new Error(String(fel)) };
      }
    },

    // `prenumerera` finns BARA när källan kan strömma, som bibliotekskällans: en metod som låtsades strömma hade varit den tysta nedfallsväg `contract.js` varnar för.
    ...(kanStromma
      ? {
          /**
           * @param {(svar: Platssvar) => void} lyssnare
           * @param {(fel: Error) => void} onFel Krävs: en lyssnare utan felväg är en vy som fortsätter visa en gammal lista.
           * @returns {() => void}
           */
          prenumerera(lyssnare, onFel) {
            if (typeof lyssnare !== "function") throw new Error("createPlatskalla.prenumerera: lyssnare krävs och ska vara en funktion.");
            if (typeof onFel !== "function") throw new Error("createPlatskalla.prenumerera: onFel krävs och ska vara en funktion.");
            let stangd = false;
            /** @param {unknown} e */
            const fel = (e) => {
              if (!stangd) onFel(e instanceof Error ? e : new Error(String(e)));
            };
            /** @type {(() => void) | undefined} */
            let avreg;
            try {
              avreg = source.subscribe(samling, fraga, {
                onData: (/** @type {any[]} */ rader) => {
                  if (stangd) return;
                  let svar;
                  try {
                    svar = svarUr(rader);
                  } catch (e) {
                    fel(e);
                    return;
                  }
                  lyssnare(svar);
                },
                onError: fel,
              });
            } catch (e) {
              fel(e);
            }
            return () => {
              if (stangd) return;
              stangd = true;
              if (typeof avreg === "function") avreg();
            };
          },
        }
      : {}),

    /**
     * Skapar en plats. Id:t anges av anroparen (Projekt-modulen: projektets tagg) eller härleds ur namnet. Kastar med skälet: ett namn som saknas eller redan finns, ett id som inte går att använda eller redan finns.
     *
     * @param {{ namn: string, id?: string }} inmatning
     * @returns {Promise<import("../lib/platser.js").Plats>}
     */
    async skapa(inmatning) {
      // Listan används för ett ledigt id och ett vänligt besked, inte som skydd (se filhuvudet). Går den inte att läsa kastar vi: ett id härlett utan att veta vad som finns kan krocka.
      const lasta = await source.list(samling, fraga);
      const { platser } = lasPlatser(lasta);
      const bygg = byggPlats({
        groupId,
        namn: inmatning?.namn,
        ...(inmatning?.id !== undefined ? { id: inmatning.id } : {}),
        skapadAv: byggSkapare(/** @type {any} */ (skapare())),
        befintliga: platser,
      });
      const data = { id: bygg.nyckel, ...bygg.rad };
      try {
        if (typeof source.createNew === "function") {
          const svar = await source.createNew(samling, data);
          if (!svar.created) throw new Error(`Det finns redan en plats med id:t ${bygg.id} i gruppen.`);
        } else {
          await source.create(samling, data);
        }
      } catch (e) {
        throw skrivfel(e, "Platsen skapades inte.");
      }
      return { id: bygg.id, groupId, plats: bygg.plats, ...bygg.rad };
    },

    /**
     * Byter namn. Id:t, och därmed adressen posterna pekar på, ändras aldrig.
     * @param {string} platsId
     * @param {string} namn
     * @returns {Promise<import("../lib/platser.js").Plats>}
     */
    async byttNamn(platsId, namn) {
      const { platser } = lasPlatser(await source.list(samling, fraga));
      const fel = platsnamnFel(namn, { befintliga: platser, utom: platsId });
      if (fel) throw new Error(fel);
      try {
        await source.update(samling, platsnyckel(groupId, platsId), { namn: trimSomRegeln(namn) });
      } catch (e) {
        throw skrivfel(e, "Namnet byttes inte.");
      }
      return hamta(platsId);
    },

    /**
     * Arkiverar: platsen döljs i växlaren (`platsval`), och posterna ligger kvar. Ingenting raderas.
     * @param {string} platsId
     * @returns {Promise<import("../lib/platser.js").Plats>}
     */
    async arkivera(platsId) {
      try {
        await source.update(samling, platsnyckel(groupId, platsId), { arkiverad: true });
      } catch (e) {
        throw skrivfel(e, "Platsen arkiverades inte.");
      }
      return hamta(platsId);
    },

    /**
     * Tar fram en arkiverad plats igen. Utan den kunde filerna på en arkiverad plats aldrig nås och flyttas ut.
     * @param {string} platsId
     * @returns {Promise<import("../lib/platser.js").Plats>}
     */
    async taFram(platsId) {
      try {
        await source.update(samling, platsnyckel(groupId, platsId), { arkiverad: false });
      } catch (e) {
        throw skrivfel(e, "Platsen togs inte fram.");
      }
      return hamta(platsId);
    },
  };
}
