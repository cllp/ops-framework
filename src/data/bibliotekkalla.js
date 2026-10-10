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
 *
 * ⛔ EN TRASIG RAD SLÄCKER INTE DE ANDRA (granskningen av #304). En rad som
 * `postFel` avvisar, eller som bär en annan grupp, hoppas över och står i
 * `trasiga` med sitt id och sitt skäl. Förut gav en enda sådan rad `kalla: "fel"`
 * och en tom lista för hela gruppen, och eftersom ingen fick radera kunde den
 * inte heller tas bort. Att den hoppas över tyst hade varit regel 5 igen, så
 * vyn visar antalet och skälet. Sedan #311 raderar författaren eller admin i
 * gruppen, också en trasig rad, när `radera` får `jag` och `anteckna`.
 */

import { byggPost, farAndra, filInmatningsfel, filSort, normaliseraMime, peaksGiltiga, postFel, trimSomRegeln, MAX_LJUD_MS } from "../lib/bibliotek.js";
import { metaUrBytes } from "../lib/ljudspelare.js";
import { byggSkapare } from "../lib/skapare.js";

/**
 * @typedef {object} Bibliotekssvar
 * @property {(import("../lib/bibliotek.js").Bibliotekspost & { id: string })[]} poster
 * @property {"databas" | "fel"} kalla
 * @property {Error | null} fel
 * @property {{ id: string, fel: string, groupId?: string, skapadAv?: { uid?: string | null } }[]} trasiga Rader som inte gick att läsa och därför inte står i `poster`. `groupId` och `skapadAv` följer med när raden har dem, så att den som får kan radera den.
 */

/**
 * @param {object} config
 * @param {any} config.source
 * @param {string} config.collection
 * @param {string} config.groupId
 * @param {() => { uid?: string | null, namn?: string, typ?: string, kalla?: string }} config.skapare
 * @param {() => { uid?: string | null, roll?: string, groupId?: string } | null} [config.jag] Den inloggades medlemskap. Krävs när `radera` anropas.
 * @param {(rad: { id: string, post: Record<string, unknown>, av: { uid?: string | null, roll?: string, groupId?: string } | null }) => Promise<void> | void} [config.anteckna] Skriver vem som raderar, innan raden tas bort. Krävs när `radera` anropas. Kastar den lämnas posten kvar.
 * @param {{ laddaUpp: (inmatning: { sokvag: string, fil: unknown, contentType?: string }) => Promise<unknown> }} [config.lagring] Krävs när `laddaUppFil` anropas.
 * @param {(delar: { groupId: string, postId: string, namn: string }) => string} [config.sokvag] Appen bygger sökvägen. Krävs när `laddaUppFil` anropas.
 */
export function createBibliotekskalla(config) {
  const { source, collection, groupId: groupIdIn, skapare, jag, anteckna, lagring, sokvag } = config ?? /** @type {any} */ ({});

  if (!source || typeof source.list !== "function" || typeof source.create !== "function" || typeof source.update !== "function" || typeof source.read !== "function") {
    throw new Error("createBibliotekskalla: source krävs och måste kunna list, read, create och update.");
  }
  if (typeof collection !== "string" || !collection.trim()) {
    throw new Error(
      "createBibliotekskalla: collection krävs. Ramverket känner aldrig samlingsnamnet självt, eftersom det är raden som gör en framtida kund till ett eget projekt utan att datamodellen ändras.",
    );
  }
  // Samma trim som postFel och regeln (`trimSomRegeln`), så gruppen i frågan är den som raden bär efter byggPost.
  const groupId = trimSomRegeln(groupIdIn);
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
        /** @type {{ id: string, fel: string, groupId?: string, skapadAv?: { uid?: string | null } }[]} */
        const trasiga = [];
        for (const rad of rader) {
          const id = String(rad?.id ?? "?");
          const fel = rad?.groupId !== groupId
            ? `Raden hör till gruppen "${rad?.groupId ?? ""}" och inte till "${groupId}".`
            : postFel(rad);
          if (fel) {
            trasiga.push({
              id,
              fel,
              ...(typeof rad?.groupId === "string" ? { groupId: rad.groupId } : {}),
              ...(rad?.skapadAv && typeof rad.skapadAv === "object" ? { skapadAv: rad.skapadAv } : {}),
            });
            continue;
          }
          try {
            poster.push({ ...byggPost(rad), id });
          } catch (e) {
            trasiga.push({ id, fel: e instanceof Error ? e.message : String(e) });
          }
        }
        return { poster, kalla: "databas", fel: null, trasiga };
      } catch (fel) {
        return { poster: [], kalla: "fel", fel: fel instanceof Error ? fel : new Error(String(fel)), trasiga: [] };
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
      const fil = inmatning && "fil" in inmatning ? inmatning.fil : (id ? tidigare?.fil : undefined);
      /** @type {Record<string, unknown>} */
      const underlag = {
        groupId,
        typ: id ? tidigare?.typ : inmatning?.typ,
        rubrik: inmatning?.rubrik,
        text: inmatning?.text,
        url: inmatning?.url,
        skapadAv: id ? tidigare?.skapadAv : byggSkapare(skapare()),
        skapad: id ? tidigare?.skapad : nu,
        andrad: nu,
      };
      if (fil !== undefined) underlag.fil = fil;
      if (inmatning && "utskrift" in inmatning) underlag.utskrift = inmatning.utskrift;
      else if (id && tidigare && "utskrift" in tidigare) underlag.utskrift = tidigare.utskrift;
      if (inmatning && "durationMs" in inmatning) underlag.durationMs = inmatning.durationMs;
      else if (id && tidigare && "durationMs" in tidigare) underlag.durationMs = tidigare.durationMs;
      if (inmatning && "peaks" in inmatning) underlag.peaks = inmatning.peaks;
      else if (id && tidigare && "peaks" in tidigare) underlag.peaks = tidigare.peaks;
      const post = byggPost(underlag);
      if (id) {
        await source.update(collection, id, post);
        return { ...post, id };
      }
      const skapad = await source.create(collection, post);
      return { ...post, id: String(skapad.id) };
    },

    /**
     * Tar bort en post. Bara författaren, eller ägare eller admin i gruppen,
     * samma villkor som regelns `delete` och som `farAndra`.
     *
     * ⛔ ANTECKNINGEN SKRIVS FÖRST. Kastar `anteckna` lämnas posten kvar: en
     * radering utan vem som tog bort den syns inte, och det är värre än en
     * anteckning om en radering som sedan föll. Föll själva borttagningen
     * kastas felet, det sväljs inte.
     *
     * Filen i lagringen tar servern bort när dokumentet försvinner. Källan
     * raderar dokumentet, inte objektet: två vägar till samma fil glider isär.
     *
     * @param {string} id
     */
    async radera(id) {
      const nyckel = typeof id === "string" ? id.trim() : "";
      if (!nyckel) throw new Error("createBibliotekskalla.radera: id krävs.");
      if (typeof jag !== "function") {
        throw new Error("createBibliotekskalla.radera: jag krävs och ska vara en funktion som ger medlemskapet ({ uid, roll, groupId }). Utan den syns inte vem som raderar.");
      }
      if (typeof anteckna !== "function") {
        throw new Error("createBibliotekskalla.radera: anteckna krävs. En radering utan vem som tog bort den syns inte i aktiviteten.");
      }
      if (typeof source.remove !== "function") {
        throw new Error("createBibliotekskalla.radera: source.remove krävs.");
      }
      const tidigare = await source.read(collection, nyckel);
      if (!tidigare) throw new Error(`Biblioteket: ${collection}/${nyckel} finns inte.`);
      if (tidigare.groupId !== groupId) {
        throw new Error(`Biblioteket: posten hör till "${tidigare.groupId}" och raderas inte i "${groupId}".`);
      }
      const av = jag();
      if (!farAndra(tidigare, av)) {
        throw new Error("Biblioteket: bara författaren eller en admin i gruppen raderar posten.");
      }
      await anteckna({ id: nyckel, post: tidigare, av });
      await source.remove(collection, nyckel);
    },

    /**
     * Sparar en filpost och laddar upp byte. Posten skrivs först, så storage-regeln
     * kan kräva att den finns. Föll uppladdningen tas en ny post tillbaka. Går inte
     * det heller kastas båda felen, inget sväljs.
     *
     * @param {{ rubrik?: string, namn?: string, fil: { name?: string, namn?: string, type?: string, mime?: string, size?: number, byte?: number, arrayBuffer?: () => Promise<ArrayBuffer> }, blob?: Blob | { arrayBuffer?: () => Promise<ArrayBuffer> }, id?: string, rapportera?: (andel: number) => void, durationMs?: number, peaks?: number[], sekunder?: number }} inmatning
     */
    async laddaUppFil(inmatning) {
      if (typeof sokvag !== "function") {
        throw new Error("createBibliotekskalla.laddaUppFil: sokvag krävs. Appen namnger sökvägen, ramverket känner den inte.");
      }
      if (!lagring || typeof lagring.laddaUpp !== "function") {
        throw new Error("createBibliotekskalla.laddaUppFil: lagring krävs.");
      }
      const fil = inmatning?.fil;
      const namn = trimSomRegeln(inmatning?.namn) || (typeof fil?.name === "string" ? fil.name : fil?.namn);
      const mime = normaliseraMime(fil?.type || fil?.mime || "");
      const byte = Number.isInteger(fil?.size) ? fil.size : fil?.byte;
      const yta = filInmatningsfel({ namn, mime, byte });
      if (yta) throw new Error(yta);
      const rubrik = trimSomRegeln(inmatning?.rubrik) || trimSomRegeln(namn);
      const nyckel = typeof inmatning?.id === "string" && inmatning.id.trim() ? inmatning.id.trim() : nyttPostId();
      const vag = sokvag({ groupId, postId: nyckel, namn: trimSomRegeln(namn) });
      if (typeof vag !== "string" || !trimSomRegeln(vag)) throw new Error("Sökvägen saknas.");
      /** @type {Record<string, unknown> | null} */
      let tidigare = null;
      if (inmatning?.id) {
        tidigare = await source.read(collection, nyckel);
        if (!tidigare) throw new Error(`Biblioteket: ${collection}/${nyckel} finns inte.`);
        if (tidigare.groupId !== groupId) {
          throw new Error(`Biblioteket: posten hör till "${tidigare.groupId}" och sparas inte i "${groupId}".`);
        }
      }
      const nu = Date.now();
      const ljud = filSort(mime) === "ljud";
      const meta = ljud ? await lasLjudmeta(inmatning) : { durationMs: undefined, peaks: undefined };
      /** @type {Record<string, unknown>} */
      const underlag = {
        groupId,
        typ: "fil",
        rubrik,
        fil: { sokvag: vag, namn, mime, byte },
        skapadAv: tidigare ? tidigare.skapadAv : byggSkapare(skapare()),
        skapad: tidigare ? tidigare.skapad : nu,
        andrad: nu,
      };
      if (meta.durationMs != null) underlag.durationMs = meta.durationMs;
      else if (tidigare && "durationMs" in tidigare) underlag.durationMs = tidigare.durationMs;
      if (meta.peaks != null) underlag.peaks = meta.peaks;
      else if (tidigare && "peaks" in tidigare) underlag.peaks = tidigare.peaks;
      const post = byggPost(underlag);
      if (tidigare) await source.update(collection, nyckel, post);
      else await source.create(collection, { ...post, id: nyckel });
      try {
        await lagring.laddaUpp({
          sokvag: vag,
          fil: inmatning.blob ?? fil,
          contentType: mime,
          ...(typeof inmatning.rapportera === "function" ? { rapportera: inmatning.rapportera } : {}),
        });
      } catch (e) {
        if (!tidigare) {
          try {
            await source.remove(collection, nyckel);
          } catch (e2) {
            const a = e instanceof Error ? e.message : String(e);
            const b = e2 instanceof Error ? e2.message : String(e2);
            throw new Error(`Filen laddades inte upp (${a}). Posten kunde inte tas tillbaka (${b}).`);
          }
        }
        throw e;
      }
      return { ...post, id: nyckel };
    },
  };
}

/**
 * Längd och toppar vid uppladdning och inspelning. Avkodning med AudioContext
 * först. Inspelarens klocka (`sekunder`) är reserv när filen inte går att avkoda,
 * så listan ändå visar en längd. En bild får inget av det.
 *
 * @param {{ durationMs?: unknown, peaks?: unknown, sekunder?: unknown, blob?: { arrayBuffer?: () => Promise<ArrayBuffer> }, fil?: { arrayBuffer?: () => Promise<ArrayBuffer> } }} inmatning
 * @returns {Promise<{ durationMs: number | undefined, peaks: number[] | undefined }>}
 */
async function lasLjudmeta(inmatning) {
  /** @type {number | undefined} */
  let durationMs = Number.isInteger(inmatning?.durationMs) && /** @type {number} */ (inmatning.durationMs) > 0 && /** @type {number} */ (inmatning.durationMs) <= MAX_LJUD_MS
    ? /** @type {number} */ (inmatning.durationMs)
    : undefined;
  /** @type {number[] | undefined} */
  let peaks = peaksGiltiga(inmatning?.peaks) ? [.../** @type {number[]} */ (inmatning.peaks)] : undefined;
  if (durationMs != null && peaks != null) return { durationMs, peaks };
  const kalla = inmatning?.blob ?? inmatning?.fil;
  const las = kalla && typeof kalla.arrayBuffer === "function" ? kalla.arrayBuffer.bind(kalla) : null;
  if (las && (durationMs == null || peaks == null)) {
    try {
      const data = await las();
      const meta = await metaUrBytes(data);
      if (meta) {
        if (durationMs == null && meta.durationMs > 0) durationMs = meta.durationMs;
        if (peaks == null) peaks = meta.peaks;
      }
    } catch {
      /* avkodningen är en hjälp. Uppladdningen ska inte falla för att vågen inte gick att räkna. */
    }
  }
  if (durationMs == null && typeof inmatning?.sekunder === "number" && Number.isFinite(inmatning.sekunder) && inmatning.sekunder > 0) {
    const ms = Math.round(inmatning.sekunder * 1000);
    if (ms > 0 && ms <= MAX_LJUD_MS) durationMs = ms;
  }
  return { durationMs, peaks };
}

/** Ett id appen kan använda i sökvägen innan Firestore hunnit dela ut ett. */
function nyttPostId() {
  const cryptoId = /** @type {{ randomUUID?: () => string }} */ (globalThis.crypto);
  if (typeof cryptoId?.randomUUID === "function") return cryptoId.randomUUID();
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
