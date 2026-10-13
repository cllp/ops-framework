/**
 * Källorna för beskrivna appar (beslut 0005, lifehub.app#213): raderna i en app, och beskrivningarna själva.
 *
 * ══ ⛔ TVÅ KÄLLOR, TVÅ SAMLINGAR, OCH APPEN NAMNGER BÅDA ═══════════════════
 *
 * Raderna ligger i EN samling för alla beskrivna appar (`groupId`, `appId`, `lista`), och beskrivningarna i en annan. Ramverket känner
 * aldrig samlingsnamnen, samma rad som i `bibliotekkalla.js`: det är den raden som gör att en kund senare kan bli ett eget projekt
 * utan att datamodellen ändras.
 *
 * ⛔ EN KÄLLA ÄR EN APPS VY I EN GRUPP. Frågan är alltid `where: { groupId, appId }`. Reglerna är låset (medlem läser), och filtret
 * är det klienten behöver för att frågan ska gå att bevisa. Frågan sorterar inte i databasen: `groupId` plus `appId` plus en
 * sortering på `andrad` hade krävt ett sammansatt index som varje app måste skapa, och en app som glömmer det får ett läsfel i
 * produktion. Sorteringen, nyast först, görs här.
 *
 * ⛔ LÄSNINGEN KASTAR INTE. Svaret bär `kalla` och `fel`, så vyn kan skilja "appen är tom" från "databasen svarade inte". En
 * trasig rad står i `trasiga` och släcker inte de andra.
 *
 * ⛔ SKRIVNINGEN PRÖVAR INNAN DEN SKRIVER. `validateRad` körs mot beskrivningen, och en rad som inte håller skrivs inte: regeln i
 * databasen kan bara låsa formen (se `beskrivenapp.js`), så det här är den enda prövningen av värdena.
 *
 * ⛔ SKRIVNINGEN ÄNDRAR INTE EN RAD I EN ANNAN GRUPP ELLER APP. `spara` och `taBort` läser raden först och vägrar om den inte är
 * den här appens. Regeln nekar det också, men ett tydligt fel här är bättre än "Missing or insufficient permissions".
 *
 * ⛔ RADER EFTER EN ÄNDRAD BESKRIVNING LÄSES ÄNDÅ. En rad vars värden inte längre passar beskrivningen (agenten tog bort ett fält)
 * är inte trasig: den läses, och vyn visar det som finns. Bara en rad som saknar sin form (fel grupp, fel app, en lista som inte
 * finns) är trasig. Prövas värdena vid läsning blir en app som utvecklats osynlig för sin egen data.
 */

import { BESKRIVENAPPDATAFALT, BESKRIVNINGSDOKUMENTFALT, beskrivningsId, byggBeskrivningsdokument, validateBeskrivning, validateRad } from "../lib/beskrivenapp.js";
import { byggSkapare, laesSkapare } from "../lib/skapare.js";

/**
 * @typedef {import("../lib/beskrivenapp.js").Beskrivning} Beskrivning
 * @typedef {import("../lib/skapare.js").Skapare} Skapare
 */

/**
 * @typedef {object} Beskrivenapprad
 * @property {string} id
 * @property {string} groupId
 * @property {string} appId
 * @property {string} lista
 * @property {Record<string, unknown>} varden
 * @property {Skapare} skapadAv
 * @property {number} skapad
 * @property {number} andrad
 */

/**
 * @typedef {object} Beskrivenappsvar
 * @property {Beskrivenapprad[]} rader Nyast först.
 * @property {"databas" | "fel"} kalla
 * @property {Error | null} fel
 * @property {{ id: string, fel: string, groupId?: string, skapadAv?: { uid?: string | null } }[]} trasiga Rader som inte gick att läsa och därför inte står i `rader`.
 */

/**
 * @typedef {object} Beskrivningspost
 * @property {string} id Appens id (`beskrivning.id`).
 * @property {Beskrivning} beskrivning
 * @property {Skapare} skapadAv
 * @property {number} skapad
 * @property {number} andrad
 */

/** @param {unknown} v @returns {v is Record<string, any>} */
const arObjekt = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** @param {unknown} v @returns {string} */
const sakna = (v) => (typeof v === "string" ? v : "");

/**
 * @param {object} config
 * @param {any} config.source
 * @param {string} config.collection Samlingen för all appdata. Appen namnger den.
 * @param {string} config.groupId
 * @param {unknown} config.beskrivning Appens beskrivning. Prövas med `validateBeskrivning` när källan skapas, och en som inte håller kastar med alla fel.
 * @param {string} [config.appId] Appens id. Härleds ur beskrivningen (en sanning). Anges det måste det vara samma.
 * @param {() => { uid?: string | null, namn?: string, typ?: string, kalla?: string }} config.skapare
 */
export function createBeskrivenAppKalla(config) {
  const { source, collection, groupId: groupIdIn, beskrivning: beskrivningIn, appId: appIdIn, skapare } = config ?? /** @type {any} */ ({});

  if (!source || typeof source.list !== "function" || typeof source.create !== "function" || typeof source.update !== "function" || typeof source.read !== "function" || typeof source.remove !== "function") {
    throw new Error("createBeskrivenAppKalla: source krävs och måste kunna list, read, create, update och remove.");
  }
  if (typeof collection !== "string" || !collection.trim()) {
    throw new Error(
      "createBeskrivenAppKalla: collection krävs. Ramverket känner aldrig samlingsnamnet självt, eftersom det är raden som gör en framtida kund till ett eget projekt utan att datamodellen ändras.",
    );
  }
  const groupId = typeof groupIdIn === "string" ? groupIdIn.trim() : "";
  if (!groupId) {
    throw new Error("createBeskrivenAppKalla: groupId krävs. Utan grupp hade källan läst appens rader i varje grupp på en gång.");
  }
  const bv = validateBeskrivning(beskrivningIn);
  if (!bv.ok) {
    throw new Error(`createBeskrivenAppKalla: beskrivningen håller inte, så källan skulle inte kunna pröva en enda rad.\n${bv.fel.join("\n")}`);
  }
  const beskrivning = bv.beskrivning;
  const appId = beskrivning.id;
  if (appIdIn !== undefined && appIdIn !== appId) {
    throw new Error(`createBeskrivenAppKalla: appId "${String(appIdIn)}" är inte beskrivningens id "${appId}". Id:t står på ett ställe, i beskrivningen, och källan läser det därifrån.`);
  }
  if (typeof skapare !== "function") {
    throw new Error("createBeskrivenAppKalla: skapare krävs och ska vara en funktion. Den som skriver raden är den inloggade, och det vet appen, inte ramverket.");
  }

  const fraga = { where: { groupId, appId } };

  /**
   * @param {any} rad
   * @returns {string | null}
   */
  function radFel(rad) {
    if (!arObjekt(rad)) return "Raden saknas.";
    const okanda = Object.keys(rad).filter((k) => k !== "id" && !(/** @type {readonly string[]} */ (BESKRIVENAPPDATAFALT)).includes(k));
    if (okanda.length > 0) return `Fälten ${okanda.join(", ")} hör inte till en rad i en beskriven app.`;
    if (rad.groupId !== groupId) return `Raden hör till gruppen "${sakna(rad.groupId)}" och inte till "${groupId}".`;
    if (rad.appId !== appId) return `Raden hör till appen "${sakna(rad.appId)}" och inte till "${appId}".`;
    if (!beskrivning.listor.some((l) => l.id === rad.lista)) return `Raden hör till listan "${sakna(rad.lista)}", som inte finns i appen. Listor: ${beskrivning.listor.map((l) => l.id).join(", ")}.`;
    if (!arObjekt(rad.varden)) return "Raden saknar sina värden.";
    if (!arObjekt(rad.skapadAv)) return "Raden saknar sin skapare.";
    if (!Number.isFinite(rad.skapad) || !Number.isFinite(rad.andrad)) return "Raden saknar sina tider.";
    return null;
  }

  /**
   * Läser en rad och kräver att den är den här appens.
   * @param {string} id
   * @param {string} vad
   * @returns {Promise<Record<string, any>>}
   */
  async function egen(id, vad) {
    const nyckel = typeof id === "string" ? id.trim() : "";
    if (!nyckel) throw new Error(`createBeskrivenAppKalla.${vad}: id krävs.`);
    const tidigare = await source.read(collection, nyckel);
    if (!tidigare) throw new Error(`${beskrivning.namn}: raden finns inte.`);
    if (tidigare.groupId !== groupId || tidigare.appId !== appId) {
      throw new Error(`${beskrivning.namn}: raden hör till "${sakna(tidigare.groupId)}/${sakna(tidigare.appId)}" och rörs inte i "${groupId}/${appId}".`);
    }
    return tidigare;
  }

  return {
    collection,
    groupId,
    appId,
    beskrivning,

    /**
     * Alla appens rader i gruppen, nyast ändrad först.
     * @returns {Promise<Beskrivenappsvar>}
     */
    async las() {
      try {
        const rader = await source.list(collection, fraga);
        /** @type {Beskrivenapprad[]} */
        const ut = [];
        /** @type {Beskrivenappsvar["trasiga"]} */
        const trasiga = [];
        for (const rad of rader) {
          const id = String(rad?.id ?? "?");
          const fel = radFel(rad);
          if (fel) {
            trasiga.push({
              id,
              fel,
              ...(typeof rad?.groupId === "string" ? { groupId: rad.groupId } : {}),
              ...(arObjekt(rad?.skapadAv) ? { skapadAv: rad.skapadAv } : {}),
            });
            continue;
          }
          ut.push({
            id,
            groupId: rad.groupId,
            appId: rad.appId,
            lista: rad.lista,
            varden: rad.varden,
            skapadAv: laesSkapare(rad.skapadAv),
            skapad: rad.skapad,
            andrad: rad.andrad,
          });
        }
        ut.sort((a, b) => b.andrad - a.andrad || b.skapad - a.skapad || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        return { rader: ut, kalla: "databas", fel: null, trasiga };
      } catch (fel) {
        return { rader: [], kalla: "fel", fel: fel instanceof Error ? fel : new Error(String(fel)), trasiga: [] };
      }
    },

    /**
     * Ny rad i en lista. Gruppen, appen, skaparen och klockslagen sätts här: en vy som fick skriva dem kunde lägga raden i någon
     * annans namn, och regeln hade sagt nej först i produktion.
     *
     * @param {{ lista: string, varden: Record<string, unknown> }} inmatning
     * @returns {Promise<Beskrivenapprad>}
     */
    async skapa(inmatning) {
      const lista = sakna(inmatning?.lista);
      const r = validateRad(beskrivning, lista, inmatning?.varden);
      if (!r.ok) throw new Error(r.fel.join("\n"));
      const nu = Date.now();
      const vem = byggSkapare(skapare());
      /** @type {Omit<Beskrivenapprad, "id">} */
      const rad = { groupId, appId, lista, varden: r.varden, skapadAv: vem, skapad: nu, andrad: nu };
      const skapad = await source.create(collection, rad);
      return { ...rad, id: String(skapad.id) };
    },

    /**
     * Ändrar värdena i en rad. Listan, gruppen, skaparen och `skapad` står stilla. Värdena ersätter de gamla: ett fält som
     * lämnas tomt tas bort från raden.
     *
     * @param {string} id
     * @param {Record<string, unknown>} varden
     * @returns {Promise<Beskrivenapprad>}
     */
    async spara(id, varden) {
      const tidigare = await egen(id, "spara");
      const fel = radFel(tidigare);
      if (fel) throw new Error(`${beskrivning.namn}: raden går inte att ändra. ${fel}`);
      const r = validateRad(beskrivning, tidigare.lista, varden);
      if (!r.ok) throw new Error(r.fel.join("\n"));
      const andrad = Date.now();
      await source.update(collection, id.trim(), { varden: r.varden, andrad });
      return {
        id: id.trim(),
        groupId,
        appId,
        lista: tidigare.lista,
        varden: r.varden,
        skapadAv: laesSkapare(tidigare.skapadAv),
        skapad: tidigare.skapad,
        andrad,
      };
    },

    /**
     * Tar bort en rad. Regeln släpper bara skaparen och en admin, och vyn visar knappen bara för dem.
     * @param {string} id
     */
    async taBort(id) {
      await egen(id, "taBort");
      await source.remove(collection, id.trim());
    },
  };
}

/**
 * Källan för beskrivningarna: en grupps beskrivna appar.
 *
 * ⛔ LÄSNINGEN KASTAR INTE, och en beskrivning som inte längre håller (skriven av en nyare version, eller förbi klienten) står i
 * `trasiga` med alla sina fel. Den hamnar inte i `beskrivningar`: en app som inte går att pröva ska inte ritas.
 *
 * ⛔ DOKUMENTETS ID ÄR `beskrivningsId(groupId, appId)`. Reglerna binder id:t till kroppen, så ägaren av en grupp kan inte skriva
 * på en annan grupps plats.
 *
 * ⛔ ATT TA BORT EN BESKRIVNING TAR INTE BORT RADERNA. De ligger kvar i sin samling, utan app som ritar dem. Att städa dem är ett
 * eget beslut (en körning med Admin SDK), för en borttagen app kan skapas igen med samma id och då är raderna tillbaka.
 *
 * @param {object} config
 * @param {any} config.source
 * @param {string} config.collection Samlingen för beskrivningarna. Appen namnger den.
 * @param {string} config.groupId
 * @param {() => { uid?: string | null, namn?: string, typ?: string, kalla?: string }} config.skapare
 */
export function createBeskrivningskalla(config) {
  const { source, collection, groupId: groupIdIn, skapare } = config ?? /** @type {any} */ ({});

  if (!source || typeof source.list !== "function" || typeof source.create !== "function" || typeof source.update !== "function" || typeof source.read !== "function" || typeof source.remove !== "function") {
    throw new Error("createBeskrivningskalla: source krävs och måste kunna list, read, create, update och remove.");
  }
  if (typeof collection !== "string" || !collection.trim()) {
    throw new Error("createBeskrivningskalla: collection krävs. Ramverket känner aldrig samlingsnamnet självt.");
  }
  const groupId = typeof groupIdIn === "string" ? groupIdIn.trim() : "";
  if (!groupId) {
    throw new Error("createBeskrivningskalla: groupId krävs. Utan grupp hade källan läst varje grupps appar på en gång.");
  }
  if (typeof skapare !== "function") {
    throw new Error("createBeskrivningskalla: skapare krävs och ska vara en funktion. Den som sparar är den inloggade, och det vet appen, inte ramverket.");
  }

  const fraga = { where: { groupId } };

  /**
   * @param {any} rad
   * @returns {{ post: Beskrivningspost } | { fel: string, id: string }}
   */
  function lasPost(rad) {
    const id = String(rad?.id ?? "?");
    if (!arObjekt(rad)) return { id, fel: "Raden saknas." };
    const okanda = Object.keys(rad).filter((k) => k !== "id" && !(/** @type {readonly string[]} */ (BESKRIVNINGSDOKUMENTFALT)).includes(k));
    if (okanda.length > 0) return { id, fel: `Fälten ${okanda.join(", ")} hör inte till en beskrivning.` };
    if (rad.groupId !== groupId) return { id, fel: `Raden hör till gruppen "${sakna(rad.groupId)}" och inte till "${groupId}".` };
    const r = validateBeskrivning(rad.beskrivning);
    if (!r.ok) return { id, fel: r.fel.join(" ") };
    if (id !== beskrivningsId(groupId, r.beskrivning.id)) {
      return { id, fel: `Dokumentets id stämmer inte med appens id "${r.beskrivning.id}" i den här gruppen.` };
    }
    if (!arObjekt(rad.skapadAv) || !Number.isFinite(rad.skapad) || !Number.isFinite(rad.andrad)) {
      return { id, fel: "Raden saknar skapare eller tider." };
    }
    return { post: { id: r.beskrivning.id, beskrivning: r.beskrivning, skapadAv: laesSkapare(rad.skapadAv), skapad: rad.skapad, andrad: rad.andrad } };
  }

  return {
    collection,
    groupId,

    /**
     * Gruppens beskrivna appar, i den ordning de skapades.
     * @returns {Promise<{ beskrivningar: Beskrivningspost[], kalla: "databas" | "fel", fel: Error | null, trasiga: { id: string, fel: string }[] }>}
     */
    async lista() {
      try {
        const rader = await source.list(collection, fraga);
        /** @type {Beskrivningspost[]} */
        const beskrivningar = [];
        /** @type {{ id: string, fel: string }[]} */
        const trasiga = [];
        for (const rad of rader) {
          const r = lasPost(rad);
          if ("fel" in r) trasiga.push({ id: r.id, fel: r.fel });
          else beskrivningar.push(r.post);
        }
        beskrivningar.sort((a, b) => a.skapad - b.skapad || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        return { beskrivningar, kalla: "databas", fel: null, trasiga };
      } catch (fel) {
        return { beskrivningar: [], kalla: "fel", fel: fel instanceof Error ? fel : new Error(String(fel)), trasiga: [] };
      }
    },

    /**
     * En app. `post` är `null` när den inte finns, och det är ett svar och inte ett fel.
     * @param {string} appId
     * @returns {Promise<{ post: Beskrivningspost | null, kalla: "databas" | "fel", fel: Error | null }>}
     */
    async las(appId) {
      try {
        const rad = await source.read(collection, beskrivningsId(groupId, sakna(appId)));
        if (!rad) return { post: null, kalla: "databas", fel: null };
        const r = lasPost({ ...rad, id: beskrivningsId(groupId, sakna(appId)) });
        if ("fel" in r) return { post: null, kalla: "fel", fel: new Error(`${appId}: ${r.fel}`) };
        return { post: r.post, kalla: "databas", fel: null };
      } catch (fel) {
        return { post: null, kalla: "fel", fel: fel instanceof Error ? fel : new Error(String(fel)) };
      }
    },

    /**
     * Skapar appen, eller ändrar beskrivningen när den redan finns. Skaparen och `skapad` står stilla vid en ändring.
     * Kastar med alla fel när beskrivningen inte håller.
     *
     * @param {unknown} beskrivning
     * @returns {Promise<Beskrivningspost>}
     */
    async spara(beskrivning) {
      const nu = Date.now();
      const vem = skapare();
      const ny = byggBeskrivningsdokument({ groupId, beskrivning, skapadAv: vem, skapad: nu });
      if (ny.data.skapadAv.typ !== "manniska" || !ny.data.skapadAv.uid) {
        throw new Error("Beskrivna appar: bara en inloggad person sparar en app härifrån. Agentens appar skrivs av servern.");
      }
      const finns = await source.read(collection, ny.id);
      if (finns) {
        if (finns.groupId !== groupId) {
          throw new Error(`Beskrivna appar: ${ny.id} hör till "${sakna(finns.groupId)}" och skrivs inte över i "${groupId}".`);
        }
        await source.update(collection, ny.id, { beskrivning: ny.data.beskrivning, andrad: ny.data.andrad });
        return { id: ny.data.beskrivning.id, beskrivning: ny.data.beskrivning, skapadAv: laesSkapare(finns.skapadAv), skapad: finns.skapad, andrad: ny.data.andrad };
      }
      await source.create(collection, { id: ny.id, ...ny.data });
      return { id: ny.data.beskrivning.id, beskrivning: ny.data.beskrivning, skapadAv: ny.data.skapadAv, skapad: ny.data.skapad, andrad: ny.data.andrad };
    },

    /**
     * Tar bort appens beskrivning. Raderna ligger kvar, se filhuvudet.
     * @param {string} appId
     */
    async taBort(appId) {
      const id = beskrivningsId(groupId, sakna(appId));
      const finns = await source.read(collection, id);
      if (!finns) throw new Error(`Beskrivna appar: appen "${sakna(appId)}" finns inte i gruppen.`);
      if (finns.groupId !== groupId) {
        throw new Error(`Beskrivna appar: ${id} hör till "${sakna(finns.groupId)}" och tas inte bort i "${groupId}".`);
      }
      await source.remove(collection, id);
    },
  };
}
