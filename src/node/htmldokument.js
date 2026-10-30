import { HTML_MIME, lagringsContentDisposition, lagringsContentType } from "../lib/bibliotek.js";
import { arHtmlDokument, byggAterstallning, byggNyVersion, htmlBytes, htmlText, nastaVersionssokvag, nuvarandeVersion, versionslista, VERSIONSFALT } from "../lib/htmldokument.js";

/**
 * Servern för HTML-dokument i Biblioteket (0.156.0, cllp/ops-framework#472): läsa dokumentet som text, skriva en ny version, lista versionerna och återställa en tidigare.
 *
 * CP 2026-10-29: "Se till att det funkar via API också. Jätteviktigt." Tjänsten är det appens API och agent anropar. Den gör inget en klient inte också får göra enligt reglerna, men den gör det som Admin SDK
 * (förbi reglerna) och i en ordning som håller sambandet som reglerna kräver från en klient (`bibliotekregelfragment` med `versioner`, `versionsregelfragment`).
 *
 * ══ ⛔ VEM SOM FÅR ÄR APPENS, PLATSEN ÄR ANROPARENS ═════════════════════════════════════════════════════════════════
 *
 * Tjänsten prövar INTE att den som anropar får läsa eller skriva på platsen: det är appens API (nyckeln, gruppen, rollen). Den tar emot `plats` (ur `gruppForPlats`-världen: gruppens id, `mitt~<uid>`, en händelses, ett ärendes eller en egen
 * plats) som anroparen redan fått rätt till, och kräver att dokumentet ligger PÅ den platsen. Ett dokument på en annan plats svarar `finns-inte`, samma som ett som inte finns: ett postid är ingen behörighet.
 *
 * ══ ⛔ TORRT OCH IDEMPOTENT ═══════════════════════════════════════════════════════════════════════════════════════
 *
 *   `skarpt` MÅSTE sägas (true eller false) på varje skrivande anrop, som övriga tjänster: ett torrt steg som råkar skriva är inte torrt. Torrt prövar allt och skriver ingenting (varken fil eller dokument) och svarar vad som hade hänt.
 *   OFÖRÄNDRAT ÄR INGEN NY VERSION. En text som är byte för byte den nuvarande skriver ingenting och svarar `ny: false`, `orsak: "oforandrad"`. En omsändning av samma anrop (eller en agent som skickar om samma text) ger alltså aldrig en dubblett i historiken.
 *   `fran` (valfri): versionen anroparen utgick från. Är dokumentet redan längre fram (och texten inte redan är den) svarar tjänsten `konflikt`, så att två som uppdaterar ur samma version inte skriver över varandra.
 *   appens API:s `torrkorning` och `idempotensnyckel` (svaret sparas under nyckeln och spelas upp) är routerns och ligger ovanpå det här.
 *
 * ══ ⛔ ORDNINGEN, OCH VAD SOM KAN BLI KVAR ═══════════════════════════════════════════════════════════════════════════
 *
 *   1. Filen skrivs (`lagring.skriv`) på en NY sökväg, unik per försök (`nastaVersionssokvag` med slump): ett HTML-objekt skrivs aldrig över, och förloraren i ett lopp skriver aldrig över vinnarens fil.
 *   2. Versionsnumret TAS: `createNew` på `<postId>|<nr>` (nyckeln är constrainten). Är det taget av någon annan är det en konflikt.
 *   3. Posten flyttas till nästa version med `updateIf` på `andrad`: skriver någon annan mellan läsningen och skrivningen blir det ingen skrivning. Faller det tas versionsdokumentet tillbaka, bara om ingen annan hunnit gå förbi.
 *
 *   Faller steg 2 eller 3 efter steg 1 ligger ett objekt kvar utan att någon version pekar på det. Det är skräp och inte åtkomst (objektet har en egen sökväg som ingenting pekar på), och appens städning av en posts mapp tar det. Ramverket
 *   raderar aldrig i lagringen.
 *
 * ⛔ KÄLLAN MÅSTE HA `createNew` OCH `updateIf` (datakontraktets regel 7 och 8). Utan dem går "det är taget" och "ingen annan hann skriva" inte att avgöra, och en läsning följd av en skrivning gör det inte heller (regel 2 i arbetsreglerna).
 *
 * @typedef {object} HtmlLagring
 * @property {(sokvag: string) => Promise<Uint8Array | ArrayBuffer | string>} las Filens byte (Admin SDK: `bucket.file(sokvag).download()`).
 * @property {(b: { sokvag: string, bytes: Uint8Array, contentType: string, contentDisposition: string }) => Promise<void>} skriv Lägger filen på en ny sökväg med den innehållstyp och `Content-Disposition` som anges. Får vägra att skriva över ett objekt som finns.
 */

/** Felkoderna tjänsten kastar med (`fel.kod`). Appens API översätter dem: `finns-inte` till 404, `konflikt` till 409, resten till 422. */
export const HTMLDOKUMENTFELKODER = /** @type {const} */ (["finns-inte", "inte-html", "ej-klar", "konflikt", "version-saknas", "ogiltigt", "for-stor", "tomt"]);

/**
 * @param {typeof HTMLDOKUMENTFELKODER[number]} kod
 * @param {string} meddelande
 */
function fel(kod, meddelande) {
  return Object.assign(new Error(meddelande), { kod });
}

/** Åtta slumptecken för en ny versions sökväg (`nastaVersionssokvag`): två samtidiga försök skriver aldrig till samma objekt. */
function slump() {
  const b = new Uint8Array(4);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * @param {unknown} s
 * @returns {Uint8Array}
 */
function tillBytes(s) {
  if (typeof s === "string") return new TextEncoder().encode(s);
  return s instanceof Uint8Array ? s : new Uint8Array(/** @type {ArrayBuffer} */ (s));
}

/**
 * @param {object} konfig
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla Admin SDK-källan. Måste ha `read`, `list`, `createNew`, `updateIf` och `remove`.
 * @param {{ bibliotek: string, versioner: string }} konfig.samlingar Appens biblioteksamling och samlingen för de ersatta versionerna (samma namn som till `bibliotekregelfragment` och `versionsregelfragment`). Inga förval: ramverket känner inga samlingsnamn.
 * @param {HtmlLagring} konfig.lagring
 * @param {() => number} [konfig.klocka] Millisekunder. Förval `Date.now`.
 */
export function createHtmlDokumentService(konfig) {
  const { samlingar, lagring, klocka = Date.now } = konfig ?? /** @type {any} */ ({});
  /** @type {any} */
  const kalla = konfig?.kalla;
  for (const m of ["read", "list", "createNew", "updateIf", "remove"]) {
    if (!kalla || typeof (/** @type {any} */ (kalla))[m] !== "function") throw new Error(`createHtmlDokumentService: datakällan saknar ${m}. Ramverket känner ingen databas, och ett versionsnummer som tas och en post som flyttas utan att någon annan hunnit före kräver createNew och updateIf (datakontraktets regel 7 och 8).`);
  }
  const BIBLIOTEK = typeof samlingar?.bibliotek === "string" ? samlingar.bibliotek.trim() : "";
  const VERSIONER = typeof samlingar?.versioner === "string" ? samlingar.versioner.trim() : "";
  if (!BIBLIOTEK || !VERSIONER) throw new Error("createHtmlDokumentService: samlingar.bibliotek och samlingar.versioner krävs. Ramverket känner aldrig samlingsnamnen, det är appens val.");
  if (BIBLIOTEK === VERSIONER) throw new Error("createHtmlDokumentService: versionerna och posterna kan inte dela samling.");
  if (!lagring || typeof lagring.las !== "function" || typeof lagring.skriv !== "function") throw new Error("createHtmlDokumentService: lagring med las och skriv krävs.");

  /**
   * Dokumentet på platsen, eller ett fel. En post på en annan plats är `finns-inte`.
   * @param {unknown} plats
   * @param {unknown} postId
   */
  async function hamtaDokument(plats, postId) {
    if (typeof plats !== "string" || plats === "") throw fel("ogiltigt", "plats krävs.");
    if (typeof postId !== "string" || postId === "") throw fel("ogiltigt", "postId krävs.");
    const post = await kalla.read(BIBLIOTEK, postId);
    if (!post || post.groupId !== plats) throw fel("finns-inte", `Dokumentet ${postId} finns inte på platsen.`);
    if (!arHtmlDokument(post)) throw fel("inte-html", `Posten ${postId} är inget HTML-dokument (en filpost med MIME ${HTML_MIME}).`);
    if (post.fil?.klar === false) throw fel("ej-klar", `Dokumentet ${postId} är inte färdigt uppladdat än.`);
    return post;
  }

  /**
   * @param {string} plats
   * @param {string} postId
   * @returns {Promise<Record<string, any>[]>}
   */
  async function hamtaVersioner(plats, postId) {
    return kalla.list(VERSIONER, { where: { groupId: plats, postId } });
  }

  /**
   * @param {string} sokvag
   * @returns {Promise<Uint8Array>}
   */
  async function lasBytes(sokvag) {
    return tillBytes(await lagring.las(sokvag));
  }

  /** @param {Record<string, any>} post @param {string} postId @param {string} plats */
  function dokumentsvar(post, postId, plats) {
    const nu = nuvarandeVersion(post);
    return { postId, plats, rubrik: String(post.rubrik ?? ""), namn: String(post.fil.namn), byte: post.fil.byte, nr: nu.nr, av: nu.av, tid: nu.tid, skapadAv: post.skapadAv, andrad: post.andrad };
  }

  /**
   * Skriver versionen: fil, nummer och post, i den ordning filhuvudet säger.
   *
   * @param {{ postId: string, post: Record<string, any>, plan: ReturnType<typeof byggNyVersion>, bytes: Uint8Array | null, skarpt: boolean }} b
   */
  async function skrivVersion({ postId, post, plan, bytes, skarpt }) {
    if (!skarpt) return;
    // 1. Filen, om den är ny. En återställning pekar på ett objekt som redan finns.
    if (bytes) {
      await lagring.skriv({ sokvag: plan.post.fil.sokvag, bytes, contentType: lagringsContentType(HTML_MIME), contentDisposition: /** @type {string} */ (lagringsContentDisposition(HTML_MIME, post.fil.namn)) });
    }
    // 2. Numret tas. Är nyckeln redan tagen och dokumentet är exakt det vi skulle skriva är det en rest av ett avbrutet försök på samma nummer (versionsdokumentet är posten som den var, alltså samma för alla som utgår från den).
    const nytt = await kalla.createNew(VERSIONER, { id: plan.id, ...plan.version });
    if (!nytt.created) {
      const finns = nytt.row ?? {};
      const lika = VERSIONSFALT.every((f) => JSON.stringify(finns[f]) === JSON.stringify(/** @type {any} */ (plan.version)[f]));
      const nuNr = nuvarandeVersion(await kalla.read(BIBLIOTEK, postId)).nr;
      if (!lika || nuNr !== plan.nr) throw fel("konflikt", `Någon annan hann före: dokumentet är redan på version ${nuNr}.`);
    }
    // 3. Posten går vidare, bara om ingen annan skrivit den sedan vi läste.
    let flyttad = false;
    try {
      const svar = await kalla.updateIf(BIBLIOTEK, postId, { andrad: post.andrad }, plan.post);
      flyttad = svar.updated === true;
    } finally {
      if (!flyttad) {
        // Tillbaka med numret, men bara om ingen annan gått förbi: då är det deras versionsdokument.
        const nu = await kalla.read(BIBLIOTEK, postId);
        if (nu && arHtmlDokument(nu) && nuvarandeVersion(nu).nr === plan.nr) await kalla.remove(VERSIONER, plan.id);
      }
    }
    if (!flyttad) throw fel("konflikt", `Någon annan hann före: dokumentet ändrades medan versionen skrevs. Hämta det igen.`);
  }

  /** @param {unknown} skarpt @param {string} namn */
  function kravSkarpt(skarpt, namn) {
    if (typeof skarpt !== "boolean") throw fel("ogiltigt", `${namn}: skarpt måste vara true eller false. Ett torrt steg som råkar skriva är inte torrt.`);
  }

  /** @param {unknown} fran @param {number} nr */
  function kontrolleraFran(fran, nr) {
    if (fran === undefined || fran === null) return;
    if (!Number.isInteger(fran)) throw fel("ogiltigt", "fran ska vara versionsnumret du utgick från, ett heltal.");
    if (fran !== nr) throw fel("konflikt", `Du utgick från version ${fran}, men dokumentet är på version ${nr}. Läs det igen.`);
  }

  return {
    /**
     * Dokumentet som text, med uppgifter om den version det är.
     * @param {{ plats: string, postId: string }} b
     */
    async las(b) {
      const post = await hamtaDokument(b?.plats, b?.postId);
      const bytes = await lasBytes(post.fil.sokvag);
      return { ...dokumentsvar(post, b.postId, b.plats), text: htmlText(bytes) };
    },

    /**
     * Versionerna, den nyaste först. En version som borde finnas men saknas står med `saknas: true`.
     * @param {{ plats: string, postId: string }} b
     */
    async versioner(b) {
      const post = await hamtaDokument(b?.plats, b?.postId);
      return versionslista({ post, postId: b.postId, versioner: await hamtaVersioner(b.plats, b.postId) });
    },

    /**
     * En tidigare (eller den nuvarande) versions innehåll som text.
     * @param {{ plats: string, postId: string, nr: number }} b
     */
    async lasVersion(b) {
      const post = await hamtaDokument(b?.plats, b?.postId);
      const lista = versionslista({ post, postId: b.postId, versioner: await hamtaVersioner(b.plats, b.postId) });
      const rad = lista.versioner.find((v) => v.nr === b.nr);
      if (!rad) throw fel("version-saknas", `Dokumentet har ${lista.nuvarande} versioner och ingen version ${String(b.nr)}.`);
      if (rad.saknas || !rad.fil) throw fel("version-saknas", `Version ${b.nr} saknas i historiken.`);
      return { postId: b.postId, plats: b.plats, nr: rad.nr, nuvarande: rad.nuvarande, av: rad.av, tid: rad.tid, byte: rad.fil.byte, text: htmlText(await lasBytes(rad.fil.sokvag)) };
    },

    /**
     * Skriver en ny version ur en text. Oförändrad text skriver ingenting.
     *
     * @param {{ plats: string, postId: string, text: string, av: Record<string, unknown>, fran?: number, skarpt: boolean }} b
     *   `av` är den som skriver, en person (`byggSkapare`, med `via` när en nyckel skriver åt hen).
     */
    async uppdatera(b) {
      kravSkarpt(b?.skarpt, "uppdatera");
      let bytes;
      try {
        bytes = htmlBytes(b?.text);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        throw fel(m.includes("Taket") ? "for-stor" : m.includes("tomt") ? "tomt" : "ogiltigt", m);
      }
      const post = await hamtaDokument(b.plats, b.postId);
      const nu = nuvarandeVersion(post);
      const nuvarandeBytes = await lasBytes(post.fil.sokvag);
      if (nuvarandeBytes.length === bytes.length && nuvarandeBytes.every((v, i) => v === bytes[i])) {
        return { skarpt: b.skarpt, ny: false, orsak: /** @type {const} */ ("oforandrad"), nr: nu.nr, tidigareNr: nu.nr, byte: nuvarandeBytes.length, sokvag: post.fil.sokvag };
      }
      kontrolleraFran(b.fran, nu.nr);
      let plan;
      try {
        plan = byggNyVersion({ post, postId: b.postId, sokvag: nastaVersionssokvag(post, slump()), byte: bytes.length, av: b.av, nu: klocka() });
      } catch (e) {
        throw fel("ogiltigt", e instanceof Error ? e.message : String(e));
      }
      await skrivVersion({ postId: b.postId, post, plan, bytes, skarpt: b.skarpt });
      return { skarpt: b.skarpt, ny: true, nr: plan.post.version.nr, tidigareNr: nu.nr, byte: bytes.length, sokvag: plan.post.fil.sokvag };
    },

    /**
     * Återställer en tidigare version som en NY version (plus ett) som pekar på den gamla versionens objekt. Är den nuvarande redan det innehållet skrivs ingenting.
     *
     * @param {{ plats: string, postId: string, nr: number, av: Record<string, unknown>, fran?: number, skarpt: boolean }} b
     */
    async aterstall(b) {
      kravSkarpt(b?.skarpt, "aterstall");
      const post = await hamtaDokument(b.plats, b.postId);
      const nu = nuvarandeVersion(post);
      const lista = versionslista({ post, postId: b.postId, versioner: await hamtaVersioner(b.plats, b.postId) });
      const rad = lista.versioner.find((v) => v.nr === b.nr);
      if (!rad) throw fel("version-saknas", `Dokumentet har ${lista.nuvarande} versioner och ingen version ${String(b.nr)}.`);
      if (rad.saknas || !rad.fil) throw fel("version-saknas", `Version ${b.nr} saknas i historiken och går inte att återställa.`);
      if (rad.nuvarande || rad.fil.sokvag === post.fil.sokvag) {
        return { skarpt: b.skarpt, ny: false, orsak: /** @type {const} */ ("oforandrad"), nr: nu.nr, tidigareNr: nu.nr, byte: post.fil.byte, sokvag: post.fil.sokvag };
      }
      kontrolleraFran(b.fran, nu.nr);
      let plan;
      try {
        plan = byggAterstallning({ post, postId: b.postId, versioner: await hamtaVersioner(b.plats, b.postId), nr: b.nr, av: b.av, nu: klocka() });
      } catch (e) {
        throw fel("ogiltigt", e instanceof Error ? e.message : String(e));
      }
      await skrivVersion({ postId: b.postId, post, plan, bytes: null, skarpt: b.skarpt });
      return { skarpt: b.skarpt, ny: true, nr: plan.post.version.nr, tidigareNr: nu.nr, byte: plan.post.fil.byte, sokvag: plan.post.fil.sokvag, aterstallning: b.nr };
    },
  };
}
