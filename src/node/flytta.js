import { medlemskapsId } from "../lib/grupp.js";
import { handelsefel, handelsensKalenderId } from "../lib/handelsemodell.js";
import { byggKalenderpost, gruppkalendernyckel, validateGruppkalendrar } from "../lib/kalendrar.js";
import { gruppensRader } from "../lib/katalog.js";
import { postensTidsfalt } from "../lib/flytta.js";

/**
 * Flytta en post eller en händelse till en annan kalender, på servern (0.123.0, cllp/lifehub.app#371, docs/beslut/0008).
 *
 * ══ ⛔ VAD TJÄNSTEN GÖR, OCH VARFÖR DEN LIGGER HÄR ═══════════════════════════════════════════════════════════════
 *
 * Tre flytter (CP:s beslut 2026-10-19, se `lib/flytta.js` för tabellen):
 *
 *   - `flyttaPost`: en post byter egen kalender. Personens egen sak.
 *   - `flyttaHandelse`: en händelse byter kalender i samma grupp, för den som får redigera den.
 *   - `goraPostTillHandelse`: en post blir en gruppens händelse och tas bort ur den egna kalendern, i EN batch.
 *
 * Den tredje kan inte vara ett klientanrop: gruppens medlemmar ska se resultatet, och en klient som skriver en händelse i en grupp och
 * sedan tar bort sin post i ett andra anrop lämnar en dubblett när det andra anropet faller. De två första kan klienten göra med
 * reglerna (appens `update` släpper in `kalenderId`), men då prövas inte att målkalendern hör till händelsens grupp på samma ställe som de
 * andra flytterna, och en app får tre vägar att hålla lika. Därför ger tjänsten alla tre med samma prövning, och reglerna är
 * oförändrade.
 *
 * ⛔ SERVERN PRÖVAR, LISTAN I PANELEN ERBJUDER. Allt som avgör om något skrivs läses här ur databasen (posten under personens egen
 * sökväg, medlemskapet, kalendrarna), aldrig ur det klienten skickade förutom vem, vad och vart.
 *
 * ⛔ EN POST ÄR ALLTID PERSONENS EGEN. Den läses under `<anvandare>/<uid>/<kalenderposter>`, så en annans post går inte att nå: den
 * finns inte där. Samma sak som regeln (`request.auth.uid == uid`), men här är den en konsekvens av sökvägen och inte en jämförelse som
 * kan glömmas.
 *
 * ⛔ ALLT ELLER INGET FÖR KONVERTERINGEN. Händelsen skapas och posten tas bort i `kalla.batch`. En källa utan `batch` nekas när tjänsten
 * byggs: en skrivning följd av en annan lämnar antingen en dubblett eller en förlorad post när den andra faller, och det syns inte
 * förrän någon frågar var posten tog vägen (regel 5: en tyst nedsläppsväg är värre än ett fel).
 *
 * ⛔ HÄNDELSEN FÅR POSTENS ID, SÅ ATT UNIKHET ÄR EN NYCKEL OCH INTE EN KONTROLL (arbetsreglernas punkt 2). Två samtidiga anrop för samma
 * post skriver samma dokument två gånger och tar bort samma post två gånger: en händelse blir kvar, aldrig två. Ett genererat id hade
 * gett två. Postens id följer `ID_FORM`, som är en delmängd av en händelses id-form, och `post~` finns bara i adressen. Finns det redan en
 * händelse med id:t avbryts flytten med ett fel i stället för att skriva över den: `create` med eget id ersätter (datakontraktet).
 *
 * ⛔ TIDEN SÄTTS AV RAMVERKET, INTE AV APPEN. `byggHandelse` ger appens egna fält (rubrik, text, typ, vem som skapade den, ...). Datum,
 * klockslag, heldag, grupp och kalender skrivs sedan över ur posten och målet (`postensTidsfalt`), så att en app som bygger händelsen
 * kan inte tappa en dag eller ett klockslag på vägen. Raden går därefter genom `handelsefel`.
 *
 * ⛔ BARA HÄR, INTE I HUVUDINGÅNGEN, av samma skäl som `createStandardkalenderService`: en funktion som skriver i en grupps händelser och
 * ligger där en vy kan nå den är en dörr bredvid reglerna. Samlingsnamnen skickas in.
 *
 * ⛔ FELEN BÄR EN `kod` OCH ÄR INTE ETT MEDDELANDE ATT TOLKA: `finns-inte`, `ej-behorig`, `ogiltigt-mal`, `ogiltig-rad`. Appens callable
 * översätter koden till `not-found`, `permission-denied` och `failed-precondition`. Ett meddelande som ändras får inte ändra vilket svar
 * klienten får.
 *
 * @typedef {"finns-inte" | "ej-behorig" | "ogiltigt-mal" | "ogiltig-rad"} FlyttfelKod
 */

/** Felkoderna, i den ordning de dokumenteras. @type {readonly FlyttfelKod[]} */
export const FLYTTFELKODER = Object.freeze(["finns-inte", "ej-behorig", "ogiltigt-mal", "ogiltig-rad"]);

/**
 * @param {FlyttfelKod} kod @param {string} meddelande @returns {Error & { kod: FlyttfelKod }}
 */
function fel(kod, meddelande) {
  return Object.assign(new Error(meddelande), { kod });
}

/** @param {unknown} v @returns {boolean} */
const arText = (v) => typeof v === "string" && v.trim() !== "";

/**
 * @typedef {object} FlyttaKonfig
 * @property {import("../data/contract.js").DataSource<any>} kalla Admin SDK-källan. Måste ha `read`, `list`, `update`, `create`, `remove` och `batch`.
 * @property {{ handelser: string, anvandare?: string, minaKalendrar?: string, kalenderposter?: string, gruppkalendrar?: string, medlemskap?: string }} samlingar
 *   `handelser` är APPENS samling och har inget förval. De andra är ramverkets egna, med samma förval som `createKalenderkalla` och `regelfragment()`.
 * @property {(arg: { post: import("../lib/kalendrar.js").Kalenderpost, uid: string, groupId: string, kalenderId: string, nu: Date }) => Record<string, any> | Promise<Record<string, any>>} byggHandelse
 *   Appens egna fält på händelsen som posten blir: rubrik, text, typ, vem som skapade den, arkiverad, allt som är appens (ramverket känner
 *   inte `rubrik` eller `typ`). Tid, grupp och kalender sätts av ramverket efteråt, och `id` likaså. Posten har också `plats`, som en
 *   händelse kanske inte har ett eget fält för: det är appens val var den hamnar (till exempel sist i texten).
 * @property {(arg: { uid: string, groupId: string, medlemskap: Record<string, any>, handelse: Record<string, any> }) => boolean | Promise<boolean>} [farRedigera]
 *   Appens regel för vem som får redigera en händelse, om den är snävare än "aktiv medlem". Prövas EFTER medlemskapet, aldrig i stället för det.
 * @property {(arg: { uid: string, groupId: string, medlemskap: Record<string, any>, post: import("../lib/kalendrar.js").Kalenderpost }) => boolean | Promise<boolean>} [farSkapa]
 *   Appens regel för vem som får skapa en händelse i gruppen, om den är snävare än "aktiv medlem". Samma ordning som `farRedigera`.
 * @property {() => Date} [klocka] Förval `() => new Date()`. Provas med en fast klocka.
 */

/**
 * @param {FlyttaKonfig} konfig
 */
export function createFlyttaService(konfig) {
  const { kalla, samlingar, byggHandelse, farRedigera, farSkapa, klocka = () => new Date() } = konfig ?? /** @type {any} */ ({});
  for (const metod of ["read", "list", "update", "create", "remove"]) {
    if (!kalla || typeof (/** @type {any} */ (kalla))[metod] !== "function") {
      throw new Error(`createFlyttaService: kalla krävs, en Admin SDK-källa med ${metod}. Ramverket känner ingen databas.`);
    }
  }
  if (typeof kalla.batch !== "function") {
    throw new Error("createFlyttaService: datakällan saknar batch. Att göra en post till en händelse är en skrivning och en radering som måste lyckas tillsammans, och två anrop efter varandra lämnar en dubblett eller en förlorad post när det andra faller. Se datakontraktets regel 6.");
  }
  if (typeof byggHandelse !== "function") {
    throw new Error("createFlyttaService: byggHandelse krävs, en funktion som ger appens egna fält på händelsen. Ramverket känner inte appens händelse.");
  }
  for (const [namn, v] of [["farRedigera", farRedigera], ["farSkapa", farSkapa]]) {
    if (v !== undefined && typeof v !== "function") throw new Error(`createFlyttaService: ${namn} måste vara en funktion (eller utelämnas).`);
  }
  if (!arText(samlingar?.handelser)) {
    throw new Error("createFlyttaService: samlingar.handelser krävs, appens händelsesamling. Ramverket känner aldrig appens samlingsnamn och gissar inget.");
  }
  const HANDELSER = samlingar.handelser.trim();
  const ANVANDARE = samlingar.anvandare ?? "users";
  const MINA = samlingar.minaKalendrar ?? "minaKalendrar";
  const POSTER = samlingar.kalenderposter ?? "kalenderposter";
  const GRUPPKALENDRAR = samlingar.gruppkalendrar ?? "gruppkalendrar";
  const MEDLEMSKAP = samlingar.medlemskap ?? "memberships";
  for (const [falt, v] of Object.entries({ handelser: HANDELSER, anvandare: ANVANDARE, minaKalendrar: MINA, kalenderposter: POSTER, gruppkalendrar: GRUPPKALENDRAR, medlemskap: MEDLEMSKAP })) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(v)) throw new Error(`createFlyttaService: ${falt} "${v}" är inte ett samlingsnamn.`);
  }

  /** @param {string} uid */
  const minaVag = (uid) => `${ANVANDARE}/${uid}/${MINA}`;
  /** @param {string} uid */
  const posterVag = (uid) => `${ANVANDARE}/${uid}/${POSTER}`;

  /**
   * @param {Record<string, unknown>} b @param {string[]} falt @param {string} metod
   */
  function krav(b, falt, metod) {
    for (const f of falt) {
      if (!arText(b?.[f])) throw new Error(`${metod}: ${f} krävs, en text som inte är tom.`);
    }
  }

  /**
   * Personens egen post, validerad, eller `finns-inte`. Sökvägen är personens, så en annans post finns inte här.
   * @param {string} uid @param {string} postId @param {string} metod
   */
  async function lasPost(uid, postId, metod) {
    const rad = await kalla.read(posterVag(uid), postId);
    if (!rad) throw fel("finns-inte", `${metod}: posten "${postId}" finns inte i din kalender.`);
    return byggKalenderpost({ ...rad, id: postId });
  }

  /**
   * Medlemskapet om personen är en aktiv medlem (inte en agent) i gruppen, annars `ej-behorig`. Samma predikat som `createShareService`.
   * @param {string} uid @param {string} groupId @param {string} vad @param {string} metod
   */
  async function kravMedlem(uid, groupId, vad, metod) {
    const rad = await kalla.read(MEDLEMSKAP, medlemskapsId(uid, groupId));
    if (!rad || rad.status !== "aktiv" || rad.typ === "agent") {
      throw fel("ej-behorig", `${metod}: du är inte aktiv medlem i gruppen "${groupId}" och får inte ${vad}.`);
    }
    return rad;
  }

  /**
   * Gruppens kalendrar, alla, validerade. Samma läsning som `createKalenderkalla().gruppens`.
   * @param {string} groupId
   */
  async function gruppensKalendrar(groupId) {
    const rader = await kalla.list(GRUPPKALENDRAR, { where: { groupId } });
    return validateGruppkalendrar(gruppensRader(rader, { groupId }).rader);
  }

  /**
   * Målkalendern i gruppen, eller `ogiltigt-mal`. Nyckeln innehåller gruppen, så en annan grupps kalender med samma id är en annan rad.
   * @param {ReadonlyArray<import("../lib/kalendrar.js").Gruppkalender>} kalendrar @param {string} groupId @param {string} till @param {string} metod
   */
  function malkalender(kalendrar, groupId, till, metod) {
    const k = kalendrar.find((x) => x.id === till);
    if (!k) throw fel("ogiltigt-mal", `${metod}: kalendern "${till}" finns inte bland gruppens kalendrar (${gruppkalendernyckel(groupId, till)}).`);
    if (k.arkiverad) throw fel("ogiltigt-mal", `${metod}: kalendern "${till}" är arkiverad och tar inte emot händelser.`);
    return k;
  }

  return {
    /**
     * En post byter egen kalender. Direkt: personen äger båda.
     *
     * @param {{ uid: string, postId: string, tillKalenderId: string }} b
     * @returns {Promise<{ atgard: "byt", postId: string, kalenderId: string }>}
     */
    async flyttaPost(b) {
      krav(b, ["uid", "postId", "tillKalenderId"], "flyttaPost");
      const post = await lasPost(b.uid, b.postId, "flyttaPost");
      if (post.kalenderId === b.tillKalenderId) throw fel("ogiltigt-mal", `flyttaPost: posten ligger redan i kalendern "${b.tillKalenderId}".`);
      const mal = await kalla.read(minaVag(b.uid), b.tillKalenderId);
      if (!mal) throw fel("ogiltigt-mal", `flyttaPost: kalendern "${b.tillKalenderId}" finns inte bland dina kalendrar.`);
      if (mal.arkiverad === true) throw fel("ogiltigt-mal", `flyttaPost: kalendern "${b.tillKalenderId}" är arkiverad och tar inte emot poster.`);
      await kalla.update(posterVag(b.uid), b.postId, { kalenderId: b.tillKalenderId });
      return { atgard: "byt", postId: b.postId, kalenderId: b.tillKalenderId };
    },

    /**
     * En händelse byter kalender i samma grupp. Aldrig till en egen kalender och aldrig till en annan grupp: händelsen stannar i gruppen.
     *
     * @param {{ uid: string, handelseId: string, tillKalenderId: string }} b
     * @returns {Promise<{ atgard: "byt", handelseId: string, groupId: string, kalenderId: string }>}
     */
    async flyttaHandelse(b) {
      krav(b, ["uid", "handelseId", "tillKalenderId"], "flyttaHandelse");
      const h = await kalla.read(HANDELSER, b.handelseId);
      if (!h) throw fel("finns-inte", `flyttaHandelse: händelsen "${b.handelseId}" finns inte.`);
      if (!arText(h.groupId)) throw fel("ogiltig-rad", `flyttaHandelse: händelsen "${b.handelseId}" saknar groupId och går inte att pröva.`);
      const groupId = h.groupId;
      // ⛔ MEDLEMSKAPET FÖRE ALLT SOM RÖR HÄNDELSENS INNEHÅLL: den som inte tillhör gruppen får veta att händelsen finns, men inget om den.
      const medlemskap = await kravMedlem(b.uid, groupId, "redigera gruppens händelser", "flyttaHandelse");
      if (farRedigera && (await farRedigera({ uid: b.uid, groupId, medlemskap, handelse: h })) !== true) {
        throw fel("ej-behorig", `flyttaHandelse: du får inte redigera händelsen "${b.handelseId}".`);
      }
      if (h.arkiverad === true) throw fel("ogiltigt-mal", `flyttaHandelse: händelsen "${b.handelseId}" är arkiverad och flyttas inte.`);
      const kalendrar = await gruppensKalendrar(groupId);
      malkalender(kalendrar, groupId, b.tillKalenderId, "flyttaHandelse");
      if (handelsensKalenderId(h, /** @type {any} */ (kalendrar)) === b.tillKalenderId) {
        throw fel("ogiltigt-mal", `flyttaHandelse: händelsen ligger redan i kalendern "${b.tillKalenderId}".`);
      }
      await kalla.update(HANDELSER, b.handelseId, { kalenderId: b.tillKalenderId });
      return { atgard: "byt", handelseId: b.handelseId, groupId, kalenderId: b.tillKalenderId };
    },

    /**
     * En post blir en gruppens händelse, och posten tas bort. Händelsen får postens id. Gruppens medlemmar ser den då, och
     * panelen har bett personen bekräfta det innan anropet.
     *
     * @param {{ uid: string, postId: string, groupId: string, tillKalenderId: string }} b
     * @returns {Promise<{ atgard: "konvertera", handelseId: string, groupId: string, kalenderId: string }>}
     */
    async goraPostTillHandelse(b) {
      krav(b, ["uid", "postId", "groupId", "tillKalenderId"], "goraPostTillHandelse");
      const post = await lasPost(b.uid, b.postId, "goraPostTillHandelse");
      const medlemskap = await kravMedlem(b.uid, b.groupId, "skapa händelser där", "goraPostTillHandelse");
      if (farSkapa && (await farSkapa({ uid: b.uid, groupId: b.groupId, medlemskap, post })) !== true) {
        throw fel("ej-behorig", `goraPostTillHandelse: du får inte skapa händelser i gruppen "${b.groupId}".`);
      }
      const kalendrar = await gruppensKalendrar(b.groupId);
      malkalender(kalendrar, b.groupId, b.tillKalenderId, "goraPostTillHandelse");
      const nu = klocka();
      const appens = await byggHandelse({ post, uid: b.uid, groupId: b.groupId, kalenderId: b.tillKalenderId, nu });
      if (!appens || typeof appens !== "object" || Array.isArray(appens)) {
        throw fel("ogiltig-rad", "goraPostTillHandelse: byggHandelse gav ingen rad. Den ska svara med appens fält på händelsen.");
      }
      // Ramverkets fält sist, så att appens rad aldrig kan tappa eller byta dem. `id` är postens (se filhuvudet). ⛔ Appens egna tidsfält tas
      // bort FÖRE, inte skrivs över: en rest som `heldag: true` på en post med klockslag, eller ett `tid` på en heldag, hade annars stått kvar.
      const { id: _id, datum: _d, slutDatum: _sd, tid: _t, slutTid: _st, heldag: _h, ...appensFalt } = /** @type {Record<string, any>} */ (appens);
      const rad = { ...appensFalt, ...postensTidsfalt(post), groupId: b.groupId, kalenderId: b.tillKalenderId };
      const felen = handelsefel(rad, { gruppkalendrar: kalendrar });
      if (felen.length > 0) throw fel("ogiltig-rad", `goraPostTillHandelse: händelsen blir inte giltig: ${felen.join("; ")}.`);
      // ⛔ SKRIV ALDRIG ÖVER EN ANNAN HÄNDELSE: `create` med eget id ersätter. Spärren är för det osannolika fallet, inte för dubbeltryck (det löser nyckeln).
      if (await kalla.read(HANDELSER, b.postId)) {
        throw fel("ogiltigt-mal", `goraPostTillHandelse: det finns redan en händelse med id "${b.postId}". Posten flyttas inte, så att ingenting skrivs över.`);
      }
      await /** @type {NonNullable<typeof kalla.batch>} */ (kalla.batch).call(kalla, [
        { op: "create", collection: HANDELSER, data: { ...rad, id: b.postId } },
        { op: "remove", collection: posterVag(b.uid), id: b.postId },
      ]);
      return { atgard: "konvertera", handelseId: b.postId, groupId: b.groupId, kalenderId: b.tillKalenderId };
    },
  };
}
