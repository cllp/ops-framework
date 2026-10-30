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
 *
 * ⛔ EN NY POST SYNS DIREKT (0.114.0, cllp/ops-framework#403). CP 2026-10-17: efter en röstinspelning syntes inspelningen inte förrän
 * han laddat om. Rotorsaken var att källan bara hade `las()`, en engångsläsning, och att ingen sade åt listan att läsa om när en
 * annan källa (inspelningen, en flytt från en annan grupp, en annan persons ändring) skrev en rad. `prenumerera(lyssnare, onFel)`
 * finns när datakällan har `subscribe` (frivillig, se `contract.js`) och ger samma svar som `las()` vid varje ändring, med samma
 * kontroll per rad. Har källan ingen `subscribe` saknas metoden helt, och vyn läser med `las()` som förut: en metod som låtsades
 * strömma utan att kunna hade varit den tysta nedfallsväg `contract.js` varnar för. Ingen polling.
 */

import { byggPost, farAndra, filInmatningsfel, filSort, kodaToppar, lagringsContentType, mimeUrFilnamn, normaliseraMime, peaksGiltiga, postFel, trimSomRegeln, MAX_LJUD_MS, MAX_BIBLIOTEKFIL, FILMIME, beskrivObjektbibliotek } from "../lib/bibliotek.js";
import { metaUrBytes, wavMetaUrBlob } from "../lib/ljudspelare.js";
import { byggSkapare } from "../lib/skapare.js";
import { bilagaTillBlob } from "../lib/file.js";
import { kommentarbilagaFel } from "../lib/handelsemodell.js";
import { FALT_BORT } from "./contract.js";

/**
 * @typedef {object} Bibliotekssvar
 * @property {(import("../lib/bibliotek.js").Bibliotekspost & { id: string })[]} poster
 * @property {"databas" | "fel"} kalla
 * @property {Error | null} fel
 * @property {{ id: string, fel: string, groupId?: string, skapadAv?: { uid?: string | null } }[]} trasiga Rader som inte gick att läsa och därför inte står i `poster`. `groupId` och `skapadAv` följer med när raden har dem, så att den som får kan radera den.
 */

/**
 * Det en ersättning skrev över, som en uppdatering som sätter tillbaka det (granskningen av PR 408). Filen går tillbaka som ett helt
 * objekt (sökväg, namn, typ, storlek och `klar` som förut), så posten aldrig pekar på en fil som inte laddades upp. Rubriken, längden, vågen,
 * taggarna och utskriften följer med när posten hade dem; `andrad` är nu, eftersom regeln kräver att en ändring bär sin egen tid.
 *
 * @param {Record<string, unknown>} tidigare Posten som den lästes före ersättningen.
 * @returns {Record<string, unknown>}
 */
function aterstallning(tidigare) {
  /** @type {Record<string, unknown>} */
  const ut = { fil: tidigare.fil, andrad: Date.now() };
  for (const falt of ["rubrik", "durationMs", "peaks", "taggar", "utskrift"]) {
    if (falt in tidigare) ut[falt] = tidigare[falt];
  }
  return ut;
}

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

  /**
   * Raderna till ett svar. ⛔ EN KONTROLL, TVÅ VÄGAR: `las()` och `prenumerera()` går båda genom den här, så att en rad som
   * den ena avvisar aldrig släpps igenom av den andra.
   * @param {any[]} rader
   * @returns {Bibliotekssvar}
   */
  const svarUr = (rader) => {
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
  };

  /**
   * Strömmar källan den här samlingen? Frivillig `subscribe`, och en routande källa svarar per samling med `canSubscribe`
   * (samma fråga som `useLiveCollection` ställer). Ett nej gör att `prenumerera` inte finns, inte att den kastar.
   */
  const kanStromma = typeof source.subscribe === "function"
    && (typeof source.canSubscribe === "function" ? Boolean(source.canSubscribe(collection)) : true);

  /**
   * Prenumerationen (0.114.0, cllp/ops-framework#403). Lyssnaren får ett `Bibliotekssvar` (samma form som `las()`) första gången och vid
   * varje ändring i gruppens rader. ⛔ ETT FEL FÖRSVINNER ALDRIG TYST: källans `onError`, ett fel när prenumerationen skulle öppnas och ett
   * fel när en leverans skulle byggas går alla till `onFel`. Båda argumenten krävs, eftersom en lyssnare utan felväg är en vy som
   * fortsätter visa den gamla listan som om den vore färsk. Returnerar en avregistrering som tål att anropas flera gånger, och efter
   * den kommer inget mer.
   *
   * @param {(svar: Bibliotekssvar) => void} lyssnare
   * @param {(fel: Error) => void} onFel
   * @returns {() => void}
   */
  const prenumerera = (lyssnare, onFel) => {
    if (typeof lyssnare !== "function") throw new Error("createBibliotekskalla.prenumerera: lyssnare krävs och ska vara en funktion.");
    if (typeof onFel !== "function") {
      throw new Error("createBibliotekskalla.prenumerera: onFel krävs och ska vara en funktion. Utan den hade ett fel i strömmen försvunnit tyst, och vyn hade fortsatt visa en gammal lista.");
    }
    let stangd = false;
    /** @param {unknown} e */
    const fel = (e) => {
      if (!stangd) onFel(e instanceof Error ? e : new Error(String(e)));
    };
    /** @type {(() => void) | undefined} */
    let avreg;
    try {
      avreg = source.subscribe(collection, fraga, {
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
  };

  return {
    collection,
    groupId,

    /**
     * @returns {Promise<Bibliotekssvar>}
     */
    async las() {
      try {
        const rader = await source.list(collection, fraga);
        return svarUr(rader);
      } catch (fel) {
        return { poster: [], kalla: "fel", fel: fel instanceof Error ? fel : new Error(String(fel)), trasiga: [] };
      }
    },

    // `prenumerera` finns BARA när källan kan strömma. Se filhuvudet.
    ...(kanStromma ? { prenumerera } : {}),

    /**
     * En post, eller `null` när den inte finns. Kastar när raden hör till en annan plats eller inte går att läsa, så att en
     * flytt aldrig bygger på en post den inte förstod (0.101.0).
     *
     * @param {string} id
     * @returns {Promise<(import("../lib/bibliotek.js").Bibliotekspost & { id: string }) | null>}
     */
    async hamta(id) {
      const nyckel = typeof id === "string" ? id.trim() : "";
      if (!nyckel) throw new Error("createBibliotekskalla.hamta: id krävs.");
      const rad = await source.read(collection, nyckel);
      if (!rad) return null;
      if (rad.groupId !== groupId) throw new Error(`Biblioteket: posten hör till "${rad.groupId}" och inte till "${groupId}".`);
      const fel = postFel(rad);
      if (fel) throw new Error(`Biblioteket: posten ${nyckel} går inte att läsa. ${fel}`);
      return { ...byggPost(rad), id: nyckel };
    },

    /**
     * Ny post, eller en ändring av en som redan finns.
     *
     * Författare och klockslag sätts här. Vyn skickar typ, rubrik och text
     * eller adress. En vy som fick skriva `skapadAv` hade kunnat lägga raden
     * i någon annans namn, och regeln hade sagt nej först i produktion.
     *
     * @param {{ id?: string, typ?: string, rubrik?: string, text?: string, url?: string, bild?: string | null, poster?: string[], taggar?: string[], durationMs?: number, peaks?: string, utskrift?: string, fil?: unknown }} inmatning
     *   `bild` (0.128.0) är omslaget på en länk, en https-adress, och `null` tar bort det. `poster` (0.128.0) är en listas postid i ordning. `kalla` ges aldrig: den härleds ur adressen.
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
      // onFyllLjud skickar bara id + durationMs/peaks. Då ska rubrik, text och url
      // stå kvar från den lästa raden, samma mönster som fil/utskrift ovan.
      //
      // ⛔ ETT ANROP SOM BARA FYLLER I LÄNGD OCH VÅG ÄNDRAR INTE `andrad` (0.93.0). Listan sorteras på `andrad`, och
      // en post hoppade överst i listan så fort någon bara lyssnade på den och spelaren räknade fram längden. Författaren
      // hade inte ändrat något. Det är samma anrop som förut (`spara` med id + durationMs/peaks), inte en andra väg:
      // vad som räknas som en ändring avgörs här, på ett ställe. Reglerna släpper just den formen utan ny tid.
      const nycklar = inmatning != null ? Object.keys(inmatning) : [];
      const baraMetaFyll = Boolean(id)
        && nycklar.some((k) => k === "durationMs" || k === "peaks")
        && nycklar.every((k) => k === "id" || k === "durationMs" || k === "peaks");
      /** @type {Record<string, unknown>} */
      const underlag = {
        groupId,
        typ: id ? tidigare?.typ : inmatning?.typ,
        rubrik: inmatning && "rubrik" in inmatning ? inmatning.rubrik : (id ? tidigare?.rubrik : inmatning?.rubrik),
        text: inmatning && "text" in inmatning ? inmatning.text : (id ? tidigare?.text : inmatning?.text),
        url: inmatning && "url" in inmatning ? inmatning.url : (id ? tidigare?.url : inmatning?.url),
        skapadAv: id ? tidigare?.skapadAv : byggSkapare(skapare()),
        skapad: id ? tidigare?.skapad : nu,
        andrad: baraMetaFyll && typeof tidigare?.andrad === "number" ? tidigare.andrad : nu,
      };
      if (fil !== undefined) underlag.fil = fil;
      if (inmatning && "utskrift" in inmatning) underlag.utskrift = inmatning.utskrift;
      else if (id && tidigare && "utskrift" in tidigare) underlag.utskrift = tidigare.utskrift;
      if (inmatning && "durationMs" in inmatning) underlag.durationMs = inmatning.durationMs;
      else if (id && tidigare && "durationMs" in tidigare) underlag.durationMs = tidigare.durationMs;
      if (inmatning && "peaks" in inmatning) underlag.peaks = inmatning.peaks;
      else if (id && tidigare && "peaks" in tidigare) underlag.peaks = tidigare.peaks;
      // ⛔ TAGGARNA (0.100.0). Ges de i inmatningen gäller de, annars står postens kvar. En tom lista betyder "inga taggar".
      if (inmatning && "taggar" in inmatning && inmatning.taggar !== undefined) underlag.taggar = inmatning.taggar;
      else if (id && tidigare && "taggar" in tidigare) underlag.taggar = tidigare.taggar;
      // ⛔ POSTERNA I EN LISTA (0.128.0): ges de gäller de, annars står listans kvar. En ändring av bara rubriken (Byt namn) rör alltså inte posterna.
      if (inmatning && "poster" in inmatning && inmatning.poster !== undefined) underlag.poster = inmatning.poster;
      else if (id && tidigare && "poster" in tidigare) underlag.poster = tidigare.poster;
      // ⛔ OMSLAGET HÖR TILL ADRESSEN (0.128.0). Ges `bild` gäller den (`null` tar bort omslaget). Ges den inte står postens kvar, UTOM när adressen byts i samma anrop: då hade omslaget
      // varit en annan låts, och en länk utan omslag är sann medan en länk med fel omslag inte är det. `kalla` ges aldrig: `byggPost` härleder den ur adressen.
      if (inmatning && "bild" in inmatning) {
        if (inmatning.bild) underlag.bild = inmatning.bild;
      } else if (id && tidigare && "bild" in tidigare && tidigare.url === underlag.url) underlag.bild = tidigare.bild;
      const post = byggPost(underlag);
      if (id) {
        // ⛔ EN UPPDATERING SLÅR IHOP, DEN ERSÄTTER INTE. Tog personen bort sista taggen saknas fältet i `post`, och utan `FALT_BORT`
        // hade de gamla taggarna stått kvar i dokumentet medan vyn sade att de var borta.
        // Bara när dokumentet bär taggar: en tom lista från en annan klient tas inte bort av en ifyllnad av längd och våg, som regeln
        // då hade nekat (taggar räknas som ändrat fält).
        const bort = {
          ...(tidigare && Array.isArray(tidigare.taggar) && tidigare.taggar.length > 0 && !("taggar" in post) ? { taggar: FALT_BORT } : {}),
          // Samma sak för omslaget: en länk vars omslag togs bort eller hörde till den gamla adressen ska inte behålla det i dokumentet.
          ...(tidigare && "bild" in tidigare && !("bild" in post) ? { bild: FALT_BORT } : {}),
        };
        await source.update(collection, id, { ...post, ...bort });
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
     * kan kräva att den finns. ⛔ Den skrivs med `fil.klar: false` och får `klar: true` först när byte finns
     * (lifehub.app, CP 2026-10-18: en ljudpost vars fil aldrig kom fram). Stängs sidan mitt i uppladdningen hinner
     * ingen återtagning köras, och då säger posten själv att filen inte blev klar, i stället för att peka på en fil som saknas. Föll uppladdningen tas en ny post tillbaka. Går inte
     * det heller kastas båda felen, inget sväljs.
     *
     * @param {{ rubrik?: string, namn?: string, fil: { name?: string, namn?: string, type?: string, mime?: string, size?: number, byte?: number, arrayBuffer?: () => Promise<ArrayBuffer> }, blob?: Blob | { arrayBuffer?: () => Promise<ArrayBuffer> }, id?: string, rapportera?: (andel: number) => void, durationMs?: number, peaks?: string, sekunder?: number, taggar?: string[], utskrift?: string }} inmatning `peaks` är vågen som den sparas (`kodaToppar`). En lista av tal räknas inte som en våg, och vågen räknas då ur filen.
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
      const mime = normaliseraMime(fil?.type || fil?.mime || "") || mimeUrFilnamn(namn);
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
        fil: { sokvag: vag, namn, mime, byte, klar: false },
        skapadAv: tidigare ? tidigare.skapadAv : byggSkapare(skapare()),
        skapad: tidigare ? tidigare.skapad : nu,
        andrad: nu,
      };
      if (meta.durationMs != null) underlag.durationMs = meta.durationMs;
      else if (tidigare && "durationMs" in tidigare) underlag.durationMs = tidigare.durationMs;
      if (meta.peaks != null) underlag.peaks = meta.peaks;
      else if (tidigare && "peaks" in tidigare) underlag.peaks = tidigare.peaks;
      // ⛔ TAGGAR OCH UTSKRIFT FÖLJER MED EN FLYTT (0.101.0). Ges de här skrivs de i samma skrivning som filen, så en flyttad post
      // aldrig syns en stund utan sina taggar. Ges de inte står postens kvar.
      if (Array.isArray(inmatning?.taggar)) underlag.taggar = inmatning.taggar;
      else if (tidigare && "taggar" in tidigare) underlag.taggar = tidigare.taggar;
      if (ljud && typeof inmatning?.utskrift === "string") underlag.utskrift = inmatning.utskrift;
      else if (tidigare && "utskrift" in tidigare) underlag.utskrift = tidigare.utskrift;
      const post = byggPost(underlag);
      if (tidigare) await source.update(collection, nyckel, post);
      else await source.create(collection, { ...post, id: nyckel });
      // ⛔ UPPLADDNINGEN OCH DET AVSLUTANDE STEGET HÖR TILL SAMMA FELHANTERING (granskningen av PR 408). `klar: true` sätts efter uppladdningen,
      // och ett fel där lämnade förut posten som `klar: false` fast filen fanns. En ny post tas tillbaka. En ERSÄTTNING (`tidigare`) fick
      // ingen hantering alls: den gamla posten stod kvar med den nya filens uppgifter och `klar: false`, alltså en fungerande fil som
      // ett avbrott. Den återställs nu till vad den var, `klar` inbegripet.
      try {
        await lagring.laddaUpp({
          sokvag: vag,
          fil: inmatning.blob ?? fil,
          // ⛔ En textfil får sin teckenkodning här och bara här (0.153.0, `lagringsContentType`): postens `fil.mime` är `text/plain`.
          contentType: lagringsContentType(mime),
          ...(typeof inmatning.rapportera === "function" ? { rapportera: inmatning.rapportera } : {}),
        });
        // ⛔ `andrad` FÖLJER MED: regeln kräver att en ändring av filen bär sin egen tid (opsBiblioteketNu).
        const klar = { ...post, fil: { .../** @type {Record<string, unknown>} */ (post.fil), klar: true }, andrad: Date.now() };
        await source.update(collection, nyckel, { fil: klar.fil, andrad: klar.andrad });
        return /** @type {typeof post & { id: string }} */ ({ ...klar, id: nyckel });
      } catch (e) {
        try {
          if (!tidigare) await source.remove(collection, nyckel);
          else await source.update(collection, nyckel, aterstallning(tidigare));
        } catch (e2) {
          const a = e instanceof Error ? e.message : String(e);
          const b = e2 instanceof Error ? e2.message : String(e2);
          throw new Error(
            tidigare
              ? `Filen laddades inte upp (${a}). Posten kunde inte återställas (${b}).`
              : `Filen laddades inte upp (${a}). Posten kunde inte tas tillbaka (${b}).`,
          );
        }
        throw e;
      }
    },
  };
}

/**
 * Flyttar eller kopierar en post från en plats till en annan (0.101.0, lifehub.app#226): från gruppen till Mitt bibliotek, från
 * Mitt bibliotek till en grupp, eller mellan två grupper.
 *
 * ⛔ KOPIAN SKRIVS FÖRST, ORIGINALET TAS BORT SEDAN. I den ordningen kan en flytt som faller halvvägs bara lämna posten på två
 * ställen, aldrig på inget. Faller borttagningen säger felet det rakt ut: att posten nu finns på båda ställena. En tyst halv
 * flytt hade sett ut som att den gått bra (regel 5).
 *
 * ⛔ EN FLYTT ÄR EN NY POST PÅ DEN NYA PLATSEN, MED DEN SOM FLYTTAR SOM FÖRFATTARE. Regeln låter ingen skriva i någon annans namn,
 * och i Mitt bibliotek får bara ägaren skriva. Klockslagen blir nya av samma skäl: regeln kräver serverns klocka vid skapandet.
 * Rubriken, texten, adressen, filen, taggarna, längden, vågen och utskriften följer med.
 *
 * ⛔ EN FIL FLYTTAS GENOM SINA BYTE. Sökvägen bär platsen (`grupper/<plats>/bibliotek/<post>/<fil>`), och storage-regeln släpper
 * bara den som får skriva på den platsen. `hamtaFil` hämtar byten från den gamla platsen, och `laddaUppFil` lägger dem på den nya.
 * Den gamla filen tar servern bort när den gamla posten raderas.
 *
 * @param {{
 *   fran: ReturnType<typeof createBibliotekskalla>,
 *   till: ReturnType<typeof createBibliotekskalla>,
 *   id: string,
 *   satt: "flytta" | "kopiera",
 *   hamtaFil?: (sokvag: string) => Promise<Blob>,
 * }} inmatning
 * @returns {Promise<import("../lib/bibliotek.js").Bibliotekspost & { id: string }>} Posten på den nya platsen.
 */
export async function flyttaBibliotekspost(inmatning) {
  const { fran, till, id, satt, hamtaFil } = inmatning ?? /** @type {any} */ ({});
  if (satt !== "flytta" && satt !== "kopiera") throw new Error(`flyttaBibliotekspost: satt är "flytta" eller "kopiera", inte "${satt}".`);
  if (!fran || !till || typeof fran.hamta !== "function" || typeof till.spara !== "function") {
    throw new Error("flyttaBibliotekspost: fran och till krävs, två källor ur createBibliotekskalla.");
  }
  // ⛔ ETT OBJEKTS FILER FLYTTAS INTE IN I ETT ANNAT OBJEKT, OCH DE FLYTTAS UT BARA TILL EN PLATS SOM MAN SORTERAR PÅ (0.121.0, 0.122.0, ändrat 0.155.0). En händelses och ett ärendes filer hör till objektet, och
  // vem som ser dem följer objektet. IN i ett objekt skulle publicera en privat fil för objektets grupp eller gömma en fil för dem som söker i gruppens bibliotek, och flytten kontrollerar inte objektets villkor
  // i klienten (att objektet finns och ligger i gruppen prövar reglerna när posten skapas). Kastar hellre än tiger: en flytt som tyst gjorde något annat hade sett ut som att den gått bra (regel 5).
  //
  // UT till gruppens plats, en egen plats (`plats~…`) eller Mitt bibliotek går, sedan 0.155.0 (cllp/ops-framework#469, CP 2026-10-29): "En fil hamnar i Biblioteket bara för att någon väljer det: Flytta
  // eller Kopiera till en plats." Det är ett val av en person, och det är exakt den flytt som förut nekades. Ett objekt till ett objekt kastar fortfarande, också mellan två händelser.
  const tillObjekt = beskrivObjektbibliotek(till.groupId);
  if (tillObjekt) {
    throw new Error(`flyttaBibliotekspost: ${tillObjekt.ord} flyttas inte till. Filerna hör till ${tillObjekt.objekt}, och vem som ser dem följer ${tillObjekt.objekt}. Flytta eller kopiera dem till gruppens bibliotek eller en egen plats i stället.`);
  }
  if (fran.groupId === till.groupId) throw new Error("Posten ligger redan där.");
  const post = await fran.hamta(id);
  if (!post) throw new Error("Posten finns inte längre.");
  // ⛔ EN LISTA FLYTTAS INTE (0.128.0, lifehub.app#378). Den pekar på id:n i den plats den ligger i, och en kopia på en annan plats hade pekat på poster som inte finns där: varje rad hade sagt
  // "Finns inte längre". Att kopiera listan MED sina poster är en annan funktion (en post flyttas med ett nytt id, och listan måste skrivas om efter dem), och den är inte byggd. Kastar hellre än tiger (regel 5).
  if (post.typ === "lista") {
    throw new Error("En lista flyttas eller kopieras inte till en annan plats: den pekar på poster på den här platsen. Flytta posterna var för sig och gör en ny lista där.");
  }
  /** @type {import("../lib/bibliotek.js").Bibliotekspost & { id: string }} */
  let ny;
  if (post.typ === "fil" && post.fil) {
    if (typeof hamtaFil !== "function") throw new Error("flyttaBibliotekspost: hamtaFil krävs för att flytta en fil.");
    const blob = await hamtaFil(post.fil.sokvag);
    // ⛔ BYTEN STÄMS AV MOT POSTEN INNAN NÅGOT SKRIVS (granskningen av PR 365). En `hamtaFil` som fick en felsida i stället för filen
    // hade annars laddat upp den som filen och sedan raderat originalet. Storleken står på posten, och den ska stämma exakt.
    const byte = Number.isInteger(/** @type {any} */ (blob)?.size) ? /** @type {any} */ (blob).size : -1;
    if (byte !== post.fil.byte) {
      throw new Error(`Filen kunde inte hämtas hel (${byte < 0 ? "ingen storlek" : `${byte} byte`}, posten säger ${post.fil.byte}). Ingenting flyttades.`);
    }
    ny = await till.laddaUppFil({
      rubrik: post.rubrik,
      namn: post.fil.namn,
      fil: { name: post.fil.namn, type: post.fil.mime, size: byte },
      blob,
      ...(post.durationMs != null ? { durationMs: post.durationMs } : {}),
      ...(post.peaks != null ? { peaks: post.peaks } : {}),
      ...(post.taggar ? { taggar: post.taggar } : {}),
      ...(post.utskrift != null ? { utskrift: post.utskrift } : {}),
    });
  } else {
    ny = await till.spara({
      typ: post.typ,
      rubrik: post.rubrik,
      ...(post.typ === "anteckning" ? { text: post.text } : { url: post.url, ...(post.bild ? { bild: post.bild } : {}) }),
      ...(post.taggar ? { taggar: post.taggar } : {}),
    });
  }
  if (satt === "flytta") {
    try {
      await fran.radera(post.id);
    } catch (e) {
      const skal = e instanceof Error ? e.message : String(e);
      throw new Error(`Posten kopierades, men kunde inte tas bort där den låg (${skal}). Den finns nu på båda ställena.`);
    }
  }
  return ny;
}

/**
 * Kan en chattbilaga läggas i Biblioteket? Typen ska vara en som Biblioteket tar emot (`FILMIME`, efter `normaliseraMime`, så `audio/webm;codecs=opus` är `audio/webm`) och bilagan ska klara samma prövning som i chatten.
 * Chattens `text/csv` är den enda typ bilagan får som Biblioteket inte tar emot; den går inte att kopiera dit, och åtgärden ritas inte för den.
 *
 * @param {unknown} bilaga
 * @returns {boolean}
 */
export function bilagaKanKopieras(bilaga) {
  if (kommentarbilagaFel(bilaga)) return false;
  return /** @type {readonly string[]} */ (FILMIME).includes(normaliseraMime(/** @type {any} */ (bilaga).typ));
}

/**
 * Kopierar en chattbilaga till en plats i Biblioteket (0.155.0, cllp/ops-framework#469, CP 2026-10-29: "En fil hamnar i Biblioteket bara för att någon väljer det: Flytta eller Kopiera till en plats.").
 *
 * ══ ⛔ HUR EN CHATTBILAGA LAGRAS, OCH VARFÖR DET HÄR INTE KOSTAR EN REGEL ═══════════════════════════════════════════════
 *
 * En bilaga i en chatt ligger i samtalet och inte i Biblioteket: meddelandet bär märket `{ namn, typ }`, och filen själv ligger som en data-URL i ett eget dokument,
 * `<samtal>/{sid}/<bilagaSamling>/{meddelandets id}` (`samtalsregelfragment` med `bilagor: true`, högst `MAX_KOMMENTARBILAGA` tecken). Den når därför inte agentens `lasBiblioteket` eller sökningen
 * i Biblioteket, som läser bibliotekets poster. Den här funktionen gör bilagan till en vanlig fil på platsen: byte ur data-URL:en (`bilagaTillBlob`) går genom `laddaUppFil`, alltså samma post, samma
 * Storage-sökväg och samma regler som en uppladdning. Ingen ny regel, ingen ny samling och ingen ny uppslagning behövs: den som kopierar är en medlem som skriver en ny post i sitt eget namn på
 * en plats hen redan får skriva i.
 *
 * ⛔ KOPIERA, ALDRIG FLYTTA. Bilagan är en del av meddelandet, och ett meddelande som tappar sin bilaga är ett annat meddelande. Samtalet rörs inte.
 * ⛔ BARA TILL GRUPPENS PLATS, EN EGEN PLATS ELLER MITT BIBLIOTEK. Kastar för en händelses och ett ärendes plats, som för `flyttaBibliotekspost`: filerna där hör till objektet.
 * ⛔ KASTAR HELLRE ÄN GER EN TOM FIL: en typ Biblioteket inte tar emot (`text/csv`), en bilaga utan innehåll och en som inte klarar chattens egen prövning ger ett fel med skälet, och ingenting skrivs.
 *
 * @param {object} inmatning
 * @param {{ namn?: string, typ?: string, dataUrl?: string, tecken?: number }} inmatning.bilaga Bilagan som `bilagaUrDokument` ger den (eller som den står inline på ett äldre meddelande).
 * @param {ReturnType<typeof createBibliotekskalla>} inmatning.till Källan för platsen filen hamnar på.
 * @param {string} [inmatning.rubrik] Förval filens namn.
 * @returns {Promise<import("../lib/bibliotek.js").Bibliotekspost & { id: string }>} Posten på platsen.
 */
export async function kopieraBilagaTillPlats(inmatning) {
  const { bilaga, till, rubrik } = inmatning ?? /** @type {any} */ ({});
  if (!till || typeof till.laddaUppFil !== "function") throw new Error("kopieraBilagaTillPlats: till krävs, en källa ur createBibliotekskalla.");
  const objekt = beskrivObjektbibliotek(till.groupId);
  if (objekt) {
    throw new Error(`kopieraBilagaTillPlats: ${objekt.ord} tar inte emot en kopia av en chattbilaga. Filerna där hör till ${objekt.objekt}. Välj gruppens bibliotek eller en egen plats.`);
  }
  const fel = kommentarbilagaFel(bilaga);
  if (fel) throw new Error(`Bilagan går inte att kopiera: ${fel}`);
  const mime = normaliseraMime(bilaga.typ);
  if (!(/** @type {readonly string[]} */ (FILMIME)).includes(mime)) {
    throw new Error(`Filtypen ${bilaga.typ} går inte att lägga i Biblioteket, så bilagan kopierades inte.`);
  }
  const blob = bilagaTillBlob(bilaga);
  return till.laddaUppFil({
    ...(typeof rubrik === "string" && rubrik.trim() ? { rubrik } : {}),
    namn: bilaga.namn,
    fil: { name: bilaga.namn, type: mime, size: blob.size },
    blob,
  });
}

/**
 * Längd och toppar vid uppladdning och inspelning. Avkodning med AudioContext
 * först. Inspelarens klocka (`sekunder`) är reserv när filen inte går att avkoda,
 * så listan ändå visar en längd. En bild får inget av det.
 *
 * @param {{ durationMs?: unknown, peaks?: unknown, sekunder?: unknown, blob?: { arrayBuffer?: () => Promise<ArrayBuffer> }, fil?: { arrayBuffer?: () => Promise<ArrayBuffer> } }} inmatning
 * @returns {Promise<{ durationMs: number | undefined, peaks: string | undefined }>} `peaks` är vågen som den sparas (`kodaToppar`).
 */
async function lasLjudmeta(inmatning) {
  /** @type {number | undefined} */
  let durationMs = Number.isInteger(inmatning?.durationMs) && /** @type {number} */ (inmatning.durationMs) > 0 && /** @type {number} */ (inmatning.durationMs) <= MAX_LJUD_MS
    ? /** @type {number} */ (inmatning.durationMs)
    : undefined;
  /** @type {string | undefined} */
  let peaks = peaksGiltiga(inmatning?.peaks) ? inmatning.peaks : undefined;
  if (durationMs != null && peaks != null) return { durationMs, peaks };
  const kalla = inmatning?.blob ?? inmatning?.fil;
  /*
   * ⛔ EN STOR FIL LÄSES INTE HEL (CP 2026-10-18, ljud upp till 250 MB). Över `MAX_BIBLIOTEKFIL` räknas vågen för en WAV i bitar
   * (`wavMetaUrBlob`), och andra format sparas utan våg i stället för att avkodas i minnet.
   */
  const kb = /** @type {any} */ (kalla);
  const stor = Number.isFinite(kb?.size) && kb.size > MAX_BIBLIOTEKFIL;
  if (stor) {
    if (typeof kb.slice === "function" && (durationMs == null || peaks == null)) {
      try {
        const meta = await wavMetaUrBlob(kb);
        if (meta) {
          if (durationMs == null && meta.durationMs > 0 && meta.durationMs <= MAX_LJUD_MS) durationMs = meta.durationMs;
          if (peaks == null) peaks = kodaToppar(meta.peaks);
        }
      } catch {
        /* vågen är en hjälp, uppladdningen faller inte för den */
      }
    }
  }
  const las = !stor && kalla && typeof kalla.arrayBuffer === "function" ? kalla.arrayBuffer.bind(kalla) : null;
  if (las && (durationMs == null || peaks == null)) {
    try {
      const data = await las();
      const meta = await metaUrBytes(data);
      if (meta) {
        if (durationMs == null && meta.durationMs > 0) durationMs = meta.durationMs;
        if (peaks == null) peaks = kodaToppar(meta.peaks);
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
