/**
 * Grupper och medlemskap: de fyra samlingar ramverket äger, och vad som avvisas.
 *
 * ══ ⛔ VARFÖR EN GRUPP OCH INTE EN LISTA MEDLEMMAR (#136) ══════════════
 *
 * Fas 2.5 i epiken #92, beslutat av CP 2026-09-27. Fas 1 gav appen
 * `members/{uid}`, alltså "vem får använda appen". Det svarar inte på "vems rad
 * är det här", och utan det svaret kan två verksamheter inte dela en app.
 *
 * ══ ⛔ EXAKT EN GRUPPNYCKEL PER RAD, OCH DET ÄR HELA POÄNGEN ═══════════
 *
 * Varje rad bär `groupId`, ett värde, aldrig en lista. Läsregeln blir ETT
 * uppslag: finns `memberships/{uid}_{groupId}` med status aktiv.
 *
 * Skälet är mätt någon annanstans och dyrt: SessionStudio bar `invitedGroupIds`
 * på raderna, alltså delning inbakad i datamodellen, och varje regel, varje
 * fråga och varje vy fick bära "eller någon av de här". Det går inte att ta
 * bort sedan, eftersom datan redan har formen. `check-gruppnyckel` vaktar den
 * här raden, och den vakten är billig i dag och omöjlig att eftermontera.
 *
 * ⛔ SAMMANSLAGNING ÄR INTE DELNING. Att se flera gruppers rader i samma vy
 * (#139) görs med en fråga per grupp och en hopslagning i ramverket. Ingen rad
 * ändras, ingen regel ändras, och en rad tillhör fortfarande en grupp.
 *
 * ══ ⛔ `memberships` SKRIVS ALDRIG AV KLIENTEN ═════════════════════════
 *
 * Den som kan skriva sitt eget medlemskap kan ge sig själv rollen ägare i vilken
 * grupp som helst vars id hen gissar. Därför skrivs samlingen bara av
 * serversidan, och regelfragmentet nedan säger det med `allow write: if false`.
 * Samma beslut som SessionStudio ADR-019, och det är det enda stället i
 * modellen där en klient inte får skriva sin egen rad.
 */

import { ID_FORM } from "./katalog.js";
import { byggSkapare } from "./skapare.js";
import { byggNamn } from "./sprak.js";
import { SPRAK } from "./sprak.js";

/**
 * Rollerna i en grupp. Två, och fler kräver en ändring här och i reglerna.
 *
 * ⛔ TVÅ OCH INTE FYRA. En roll finns för att STOPPA något, och i dag finns
 * exakt en sådan gräns: vem som får ändra gruppens konfiguration och dess
 * medlemmar. En "läsare" som inte får skriva rader vore en tredje, men ingen
 * yta i appen skiljer på det ännu, och en roll utan en regel bakom sig är ett
 * löfte i en rullgardin.
 */
export const ROLLER = /** @type {const} */ (["agare", "medlem"]);

/**
 * Vad en medlem ÄR. Samma delning som `SKAPARTYPER` men utan `okand`: ett
 * medlemskap skrivs alltid av serversidan, så det finns ingen väg in för en
 * post som inte vet vad den är.
 */
export const MEDLEMSTYPER = /** @type {const} */ (["person", "agent"]);

/**
 * Medlemskapets läge.
 *
 * ⛔ `avslutad` OCH INTE RADERING. En raderad rad tar med sig svaret på varför
 * någon inte längre har åtkomst, och den frågan kommer alltid efteråt. Samma
 * skäl som `arkiverad` på en grupp.
 */
export const MEDLEMSSTATUS = /** @type {const} */ (["aktiv", "avslutad"]);

/** Inbjudans läge. Flödet som flyttar den hör till #137, formen hör hit. */
export const INBJUDNINGSSTATUS = /** @type {const} */ (["vantar", "accepterad", "aterkallad"]);

/** Teman en person kan välja. `system` är förvalet och betyder "fråga enheten". */
export const TEMAN = /** @type {const} */ (["system", "ljust", "morkt"]);

/**
 * @typedef {object} Anvandare
 * @property {string} id Firebase Auth-uid.
 * @property {string} namn Ur inloggningen.
 * @property {string} epost Identiteten. Ändras aldrig här.
 * @property {string} bild URL, eller tom sträng.
 * @property {string} sprak Ur `SPRAK`.
 * @property {"system"|"ljust"|"morkt"} tema
 */

/**
 * @typedef {object} Grupp
 * @property {string} id
 * @property {import("./sprak.js").Namn} namn
 * @property {ReadonlyArray<string>} moduler Modul-id, samma form som `defineModule`.
 * @property {boolean} arkiverad
 * @property {import("./skapare.js").Skapare} skapadAv
 */

/**
 * @typedef {object} Medlemskap
 * @property {string} id `${userId}_${groupId}`. Härledd, aldrig skriven för hand.
 * @property {string} userId
 * @property {string} groupId
 * @property {"agare"|"medlem"} roll
 * @property {"person"|"agent"} typ
 * @property {"aktiv"|"avslutad"} status
 */

/**
 * @typedef {object} Inbjudan
 * @property {string} id
 * @property {string} epost Gemener. Se noten i `byggInbjudan`.
 * @property {string} groupId
 * @property {"agare"|"medlem"} roll
 * @property {"vantar"|"accepterad"|"aterkallad"} status
 * @property {import("./skapare.js").Skapare} skapadAv
 */

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Fälten varje samling får bära. Allt annat avvisas.
 *
 * ⛔ LISTORNA ÄR OCKSÅ VAKTENS UNDERLAG. `check-gruppnyckel` läser dem och
 * fäller varje fältnamn som pekar på FLER än en grupp. Står ett fält inte i en
 * sådan lista är det heller inte vaktat, så en ny samling utan sin lista är ett
 * hål och inte en förenkling.
 */
export const ANVANDARFALT = ["id", "namn", "epost", "bild", "sprak", "tema"];
export const GRUPPFALT = ["id", "namn", "moduler", "arkiverad", "skapadAv"];
export const MEDLEMSKAPSFALT = ["id", "userId", "groupId", "roll", "typ", "status"];
export const INBJUDNINGSFALT = ["id", "epost", "groupId", "roll", "status", "skapadAv"];

/**
 * @param {string} samling
 * @param {Record<string, any>} d
 * @param {readonly string[]} tillatna
 * @param {string} id
 */
function avvisaOkanda(samling, d, tillatna, id) {
  const okanda = Object.keys(d).filter((n) => !tillatna.includes(n));
  if (okanda.length > 0) {
    throw new Error(
      `${samling}: fälten ${okanda.join(", ")} för "${id}" känns inte igen. En rad bär ${tillatna.join(", ")}. Ett fält som slängs tyst blir en rad som ser hel ut och saknar sin halva.`,
    );
  }
}

/** @param {unknown} v @returns {Record<string, any>} */
function somObjekt(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? /** @type {Record<string, any>} */ (v) : {};
}

/**
 * Bygger en användarrad, eller kastar med skälet.
 *
 * ⛔ E-POSTEN NORMALISERAS TILL GEMENER, och det är inte kosmetik. Inbjudan i
 * #137 matchar på e-post, och `CP@Staiger.se` och `cp@staiger.se` är samma
 * brevlåda men två strängar. Matchas de inte blir följden en person som loggar
 * in och inte får sin inbjudan, alltså en tom app utan förklaring.
 *
 * @param {Record<string, any>} d
 * @returns {Anvandare}
 */
export function byggAnvandare(d) {
  const rad = somObjekt(d);
  const id = rensa(rad.id);
  if (!id) throw new Error("users: id krävs. Det är Firebase Auth-uid och nyckeln varje medlemskap pekar på.");
  avvisaOkanda("users", rad, ANVANDARFALT, id);

  const epost = rensa(rad.epost).toLowerCase();
  if (!epost) throw new Error(`users: epost krävs för "${id}". Den är identiteten, och det är den en inbjudan matchar mot.`);

  const sprak = rensa(rad.sprak) || "sv";
  if (!(/** @type {readonly string[]} */ (SPRAK).includes(sprak))) {
    throw new Error(`users: språket "${sprak}" för "${id}" finns inte. Giltiga: ${SPRAK.join(", ")}.`);
  }

  const tema = rensa(rad.tema) || "system";
  if (!(/** @type {readonly string[]} */ (TEMAN).includes(tema))) {
    throw new Error(`users: temat "${tema}" för "${id}" finns inte. Giltiga: ${TEMAN.join(", ")}.`);
  }

  return Object.freeze({
    id,
    namn: rensa(rad.namn),
    epost,
    bild: rensa(rad.bild),
    sprak,
    tema: /** @type {Anvandare["tema"]} */ (tema),
  });
}

/**
 * Bygger en grupp, eller kastar med skälet.
 *
 * ⛔ `moduler` ÄR MODUL-ID OCH INTE NAMN, samma form som `defineModule`. Det är
 * den listan som avgör vilka ytor gruppen ser, alltså måste den gå att jämföra
 * med ett manifest utan att någon gissar hur ett namn blev ett id.
 *
 * @param {Record<string, any>} d
 * @returns {Grupp}
 */
export function byggGrupp(d) {
  const rad = somObjekt(d);
  const id = rensa(rad.id);
  if (!id) throw new Error("groups: id krävs. Det är nyckeln varje rad i varje samling pekar på.");
  if (!ID_FORM.test(id)) {
    throw new Error(
      `groups: id "${id}" får bara innehålla små bokstäver, siffror, bindestreck och understreck. Ett id med punkt blir en sökväg i en Firestore-regel, och gruppnyckeln står i varje regel.`,
    );
  }
  avvisaOkanda("groups", rad, GRUPPFALT, id);

  if (typeof rad.namn === "string") {
    throw new Error(`groups: namn för "${id}" är en sträng. Ett namn är { sv, en }. Gruppnamnet visas i gruppväljaren, alltså på varje sida.`);
  }
  let namn;
  try {
    namn = byggNamn(somObjekt(rad.namn));
  } catch (fel) {
    throw new Error(`groups: namn för "${id}" ${fel instanceof Error ? fel.message.replace(/^byggNamn: /, "") : String(fel)}`);
  }

  if (!Array.isArray(rad.moduler)) {
    throw new Error(`groups: moduler för "${id}" krävs och måste vara en lista, även när den är tom. En grupp utan moduler och en grupp som glömt listan ser likadana ut om fältet är valfritt.`);
  }
  /** @type {string[]} */
  const moduler = [];
  rad.moduler.forEach((/** @type {any} */ m, /** @type {number} */ i) => {
    const modulId = rensa(m);
    if (!modulId || !ID_FORM.test(modulId)) {
      throw new Error(`groups: moduler[${i}] för "${id}" måste vara ett modul-id i samma form som i defineModule, inte ${JSON.stringify(m)}.`);
    }
    if (moduler.includes(modulId)) {
      throw new Error(`groups: moduler[${i}] "${modulId}" för "${id}" står två gånger.`);
    }
    moduler.push(modulId);
  });

  return Object.freeze({
    id,
    namn,
    moduler: Object.freeze(moduler),
    arkiverad: rad.arkiverad === true,
    skapadAv: byggSkapare(somObjekt(rad.skapadAv)),
  });
}

/**
 * Nyckeln till ett medlemskap.
 *
 * ⛔ HÄRLEDD OCH ALDRIG SKRIVEN FÖR HAND. Vore id fritt kunde samma person och
 * grupp få två rader med olika roll, och vilken som gäller avgörs då av vilken
 * regeln råkar slå upp. Med ett härlett id är unikheten en egenskap hos nyckeln
 * i stället för en kontroll någon måste komma ihåg, alltså arbetsreglernas
 * punkt 2 om riktiga constraints.
 *
 * @param {string} userId
 * @param {string} groupId
 * @returns {string}
 */
export function medlemskapsId(userId, groupId) {
  const u = rensa(userId);
  const g = rensa(groupId);
  if (!u || !g) throw new Error("medlemskapsId: både userId och groupId krävs.");
  return `${u}_${g}`;
}

/**
 * Bygger ett medlemskap, eller kastar med skälet.
 *
 * @param {Record<string, any>} d
 * @returns {Medlemskap}
 */
export function byggMedlemskap(d) {
  const rad = somObjekt(d);
  const userId = rensa(rad.userId);
  const groupId = rensa(rad.groupId);
  if (!userId) throw new Error("memberships: userId krävs.");
  if (!groupId) throw new Error("memberships: groupId krävs. Det är den enda gruppnyckeln, och regeln slår upp exakt den.");
  const id = medlemskapsId(userId, groupId);
  avvisaOkanda("memberships", rad, MEDLEMSKAPSFALT, id);

  /*
   * ⛔ ETT INSKICKAT `id` SOM INTE STÄMMER AVVISAS, det rättas inte. Ett id som
   * tyst skrivs om döljer att anroparen trodde något annat om raden, och nästa
   * gång är det inte id:t som är fel utan gruppen.
   */
  const inskickat = rensa(rad.id);
  if (inskickat && inskickat !== id) {
    throw new Error(`memberships: id "${inskickat}" stämmer inte med userId och groupId, som ger "${id}". Nyckeln härleds, den skrivs inte.`);
  }

  const roll = rensa(rad.roll);
  if (!(/** @type {readonly string[]} */ (ROLLER).includes(roll))) {
    throw new Error(`memberships: rollen "${roll}" för "${id}" finns inte. Giltiga: ${ROLLER.join(", ")}.`);
  }
  const typ = rensa(rad.typ);
  if (!(/** @type {readonly string[]} */ (MEDLEMSTYPER).includes(typ))) {
    throw new Error(`memberships: typen "${typ}" för "${id}" finns inte. Giltiga: ${MEDLEMSTYPER.join(", ")}.`);
  }
  const status = rensa(rad.status) || "aktiv";
  if (!(/** @type {readonly string[]} */ (MEDLEMSSTATUS).includes(status))) {
    throw new Error(`memberships: statusen "${status}" för "${id}" finns inte. Giltiga: ${MEDLEMSSTATUS.join(", ")}.`);
  }

  return Object.freeze({
    id,
    userId,
    groupId,
    roll: /** @type {Medlemskap["roll"]} */ (roll),
    typ: /** @type {Medlemskap["typ"]} */ (typ),
    status: /** @type {Medlemskap["status"]} */ (status),
  });
}

/**
 * Bygger en inbjudan, eller kastar med skälet. Flödet hör till #137.
 *
 * @param {Record<string, any>} d
 * @returns {Inbjudan}
 */
export function byggInbjudan(d) {
  const rad = somObjekt(d);
  const id = rensa(rad.id);
  if (!id) throw new Error("invitations: id krävs.");
  avvisaOkanda("invitations", rad, INBJUDNINGSFALT, id);

  const epost = rensa(rad.epost).toLowerCase();
  if (!epost) throw new Error(`invitations: epost krävs för "${id}". Det är det enda inbjudan har att matcha på innan personen finns.`);
  const groupId = rensa(rad.groupId);
  if (!groupId) throw new Error(`invitations: groupId krävs för "${id}".`);

  const roll = rensa(rad.roll);
  if (!(/** @type {readonly string[]} */ (ROLLER).includes(roll))) {
    throw new Error(`invitations: rollen "${roll}" för "${id}" finns inte. Giltiga: ${ROLLER.join(", ")}.`);
  }
  const status = rensa(rad.status) || "vantar";
  if (!(/** @type {readonly string[]} */ (INBJUDNINGSSTATUS).includes(status))) {
    throw new Error(`invitations: statusen "${status}" för "${id}" finns inte. Giltiga: ${INBJUDNINGSSTATUS.join(", ")}.`);
  }

  return Object.freeze({
    id,
    epost,
    groupId,
    roll: /** @type {Inbjudan["roll"]} */ (roll),
    status: /** @type {Inbjudan["status"]} */ (status),
    skapadAv: byggSkapare(somObjekt(rad.skapadAv)),
  });
}
