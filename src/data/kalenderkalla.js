import { gruppensRader, katalognyckel } from "../lib/katalog.js";
import { byggGruppkalender, byggKalenderpost, byggMinKalender, validateGruppkalendrar, validateMinaKalendrar } from "../lib/kalendrar.js";
import { byggSvar } from "../lib/handelsemodell.js";

/**
 * Kalenderkällan: läser och skriver gruppens kalendrar, mina kalendrar och posterna i mina kalendrar (0.37.0, #179 F2).
 *
 * ⛔ RAMVERKET KÄNNER INTE SAMLINGSNAMNEN. Appen skickar in dem, med samma namn som till `kalenderregelfragment()`.
 *
 * ⛔ EN FLERRADSÄNDRING SKRIVS I EN BATCH NÄR KÄLLAN KAN. Att byta förvald rör två rader, och att flytta en kalender kan
 * röra flera. Skrivs den nya förvalda och den gamla var för sig och den andra skrivningen misslyckas står två förvalda
 * kvar, och `validateGruppkalendrar` kastar vid nästa läsning. Har källan ingen `batch` skrivs raderna en i taget, och
 * det står i svaret (`atomar: false`), i stället för att se ut som att allt gick ihop.
 *
 * ⛔ `id` LAGRAS INTE PÅ RADEN. Dokumentets nyckel är id:t (för gruppens kalendrar `groupId|id`, samma som katalogen), och
 * adaptern tar `id` ur datan. Se `kalenderregelfragment` om vad 0.36.0 krävde och varför det var fel.
 *
 * @param {object} konfig
 * @param {import("./contract.js").DataSource<any>} konfig.kalla
 * @param {string} [konfig.anvandare] Förval `"users"`, samma som till `regelfragment()`.
 * @param {string} [konfig.gruppkalendrar] Förval `"gruppkalendrar"`.
 * @param {string} [konfig.minaKalendrar] Förval `"minaKalendrar"`.
 * @param {string} [konfig.kalenderposter] Förval `"kalenderposter"`.
 */
export function createKalenderkalla(konfig) {
  const { kalla, anvandare = "users", gruppkalendrar = "gruppkalendrar", minaKalendrar = "minaKalendrar", kalenderposter = "kalenderposter" } = konfig ?? /** @type {any} */ ({});
  if (!kalla || typeof kalla.list !== "function" || typeof kalla.create !== "function") {
    throw new Error("createKalenderkalla: kalla krävs, en datakälla (createFirestoreSource, createMemorySource).");
  }
  for (const [falt, v] of Object.entries({ anvandare, gruppkalendrar, minaKalendrar, kalenderposter })) {
    if (typeof v !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(v)) throw new Error(`createKalenderkalla: ${falt} "${v}" är inte ett samlingsnamn.`);
  }
  /** @param {string} uid */
  const kravUid = (uid) => {
    if (typeof uid !== "string" || !uid) throw new Error("createKalenderkalla: uid krävs. Mina kalendrar är en persons.");
    return uid;
  };
  const minaVag = (/** @type {string} */ uid) => `${anvandare}/${kravUid(uid)}/${minaKalendrar}`;
  const posterVag = (/** @type {string} */ uid) => `${anvandare}/${kravUid(uid)}/${kalenderposter}`;

  /**
   * Skriver raderna, i en batch om källan kan.
   * @param {Array<{ collection: string, data: Record<string, any> }>} ops
   * @returns {Promise<{ skrivna: number, atomar: boolean }>}
   */
  async function skriv(ops) {
    if (ops.length === 0) return { skrivna: 0, atomar: true };
    if (typeof kalla.batch === "function") {
      await kalla.batch(ops.map((o) => ({ op: /** @type {const} */ ("create"), collection: o.collection, data: o.data })));
      return { skrivna: ops.length, atomar: true };
    }
    for (const o of ops) await kalla.create(o.collection, o.data);
    return { skrivna: ops.length, atomar: ops.length === 1 };
  }

  return Object.freeze({
    /**
     * Gruppens kalendrar, alla, också arkiverade (inställningsvyn visar dem), validerade och i sin ordning.
     * @param {string} groupId
     */
    async gruppens(groupId) {
      const rader = await kalla.list(gruppkalendrar, { where: { groupId } });
      return validateGruppkalendrar(gruppensRader(rader, { groupId }).rader).sort((a, b) => a.ordning - b.ordning || a.id.localeCompare(b.id));
    },

    /**
     * Sparar en eller flera av gruppens kalendrar (ny, ändrad, arkiverad, förvald, ordning).
     * @param {string} groupId @param {ReadonlyArray<Record<string, any>>} rader
     */
    async sparaGruppens(groupId, rader) {
      const byggda = rader.map((r) => {
        if (r.groupId && r.groupId !== groupId) throw new Error(`kalenderkalla: kalendern "${r.id}" hör till gruppen "${r.groupId}" och sparas inte i "${groupId}".`);
        return byggGruppkalender({ ...r, groupId });
      });
      return skriv(byggda.map((k) => ({ collection: gruppkalendrar, data: { ...k, id: katalognyckel(groupId, k.id) } })));
    },

    /** Mina kalendrar, också arkiverade, validerade och i sin ordning. @param {string} uid */
    async mina(uid) {
      const rader = await kalla.list(minaVag(uid));
      return validateMinaKalendrar(rader).sort((a, b) => a.ordning - b.ordning || a.id.localeCompare(b.id));
    },

    /** Sparar en eller flera av mina kalendrar. @param {string} uid @param {ReadonlyArray<Record<string, any>>} rader */
    async sparaMina(uid, rader) {
      return skriv(rader.map((r) => ({ collection: minaVag(uid), data: byggMinKalender(r) })));
    },

    /** Posterna i mina kalendrar. @param {string} uid */
    async poster(uid) {
      return (await kalla.list(posterVag(uid))).map((r) => byggKalenderpost(r));
    },

    /**
     * Sparar en post. Kalendern prövas mot mina kalendrar (finns, inte arkiverad) innan skrivningen, och regeln gör samma sak.
     * @param {string} uid @param {Record<string, any>} post @param {ReadonlyArray<{ id: string, arkiverad?: boolean }>} kalendrar
     */
    async sparaPost(uid, post, kalendrar) {
      const p = byggKalenderpost(post, { kalendrar });
      await kalla.create(posterVag(uid), p);
      return p;
    },

    /** Tar bort en post. En privat post får raderas av sin ägare (se `kalenderregelfragment`). @param {string} uid @param {string} id */
    async taBortPost(uid, id) {
      await kalla.remove(posterVag(uid), id);
    },
  });
}

/**
 * Svarskällan: Kommer / Kommer inte på en händelse (0.37.0, #179 F3).
 *
 * ⛔ SÖKVÄGEN ÄR `<händelser>/{händelse}/<svar>/{uid}`, och nyckeln är personen (se `handelsemodell.js`).
 *
 * @param {object} konfig
 * @param {import("./contract.js").DataSource<any>} konfig.kalla
 * @param {string} [konfig.handelser] APPENS samling med händelser. Förval `"handelser"`.
 * @param {string} [konfig.svar] Undersamlingens namn. Förval `"svar"`.
 */
export function createSvarskalla(konfig) {
  const { kalla, handelser = "handelser", svar = "svar" } = konfig ?? /** @type {any} */ ({});
  if (!kalla || typeof kalla.list !== "function" || typeof kalla.read !== "function") {
    throw new Error("createSvarskalla: kalla krävs, en datakälla (createFirestoreSource, createMemorySource).");
  }
  for (const [falt, v] of Object.entries({ handelser, svar })) {
    if (typeof v !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(v)) throw new Error(`createSvarskalla: ${falt} "${v}" är inte ett samlingsnamn.`);
  }
  /** @param {string} hid */
  const vag = (hid) => {
    if (typeof hid !== "string" || !hid || hid.includes("/")) throw new Error(`createSvarskalla: händelsens id "${hid}" är inte ett id.`);
    return `${handelser}/${hid}/${svar}`;
  };

  return Object.freeze({
    /**
     * Alla svar på en händelse: `[{ id: uid, svar }]`.
     * @param {string} hid @returns {Promise<Array<{ id: string, svar: "kommer" | "kommerInte" }>>}
     */
    async lista(hid) {
      return (await kalla.list(vag(hid))).map((r) => ({ id: r.id, ...byggSvar(r.svar) }));
    },

    /**
     * Personens egna svar på händelserna, som en karta händelse-id till svar. En läsning per händelse, av personens
     * egen rad: inkorgen behöver bara veta om HEN svarat, inte vad alla andra sagt.
     * @param {ReadonlyArray<string>} hids @param {string} uid @returns {Promise<Map<string, "kommer" | "kommerInte">>}
     */
    async mina(hids, uid) {
      if (!uid) throw new Error("createSvarskalla.mina: uid krävs. Svaren är en persons.");
      const rader = await Promise.all(hids.map(async (hid) => [hid, await kalla.read(vag(hid), uid)]));
      return new Map(rader.filter(([, r]) => r).map(([hid, r]) => [/** @type {string} */ (hid), byggSvar(/** @type {any} */ (r).svar).svar]));
    },

    /**
     * Personens svar. Samma rad skrivs om när man ändrar sig.
     * @param {string} hid @param {string} uid @param {"kommer" | "kommerInte"} val
     */
    async svara(hid, uid, val) {
      if (!uid) throw new Error("createSvarskalla.svara: uid krävs. Bara personen själv svarar.");
      await kalla.create(vag(hid), { id: uid, ...byggSvar(val) });
    },
  });
}
