/**
 * Att dela en egen kalender med en person eller en grupp, bara för läsning (0.154.0, cllp/lifehub.app#485).
 *
 * ══ ⛔ BESLUTET ════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-28: "Vill att man skall kunna dela den ordentligt, inte bara upptagen. Och med samma principer som bibliotek mm." Och samma kväll, på frågan om
 * gruppen ska kunna ändra: en kalender som delats kan bara LÄSAS av de andra. Ägaren skriver, som med en post i Biblioteket som någon annan skrivit.
 *
 * Det som fanns före 0.154.0: gruppens kalendrar ser alla medlemmar, en egen kalender bara ägaren, och gruppen och agenten ser bara "upptagen" (appens
 * frånvaro, servern läser posterna och skickar start och slut). Den vägen ändras inte här. Det här är den andra: hela posten, rubrik, tid, plats och text, till
 * den som fått delningen.
 *
 * ══ ⛔ EN DELNING ÄR EN RAD, OCH RADEN ÄR DEN ENDA SANNINGEN OM DELNINGEN ══════════════════════════════════════════════
 *
 * `<kalenderdelningar>/{ägare}|{kalender}|{mottagare}` med fälten `agare`, `kalenderId` och antingen `person` eller `groupId`. Samlingsnamnet skickar appen
 * (ramverket känner aldrig samlingsnamn eller projekt-id). Nyckeln är härledd ur fälten på samma sätt som ett medlemskap (`{uid}|{gid}`, `medlemskapsId`), och
 * reglerna kräver att de stämmer, så samma delning kan aldrig stå två gånger. Kalendern och posterna rörs inte: inget fält läggs till på dem, ingen kopia skrivs
 * någonstans. Att sluta dela är att ta bort raden, och då stänger reglerna läsningen i samma ögonblick.
 *
 * ⛔ MOTTAGAREN ÄR `person~<uid>` ELLER `grupp`, OCH EN KALENDER DELAS MED HÖGST EN GRUPP. Det är mätt och inte valt för enkelhetens skull. Reglerna som släpper
 * in mottagarens läsning av en post måste hitta delningen med ett uppslag på en känd nyckel, och en regel kan inte gå igenom en lista. För en person är nyckeln
 * känd (den som läser är `request.auth.uid`). För en grupp vet regeln inte vilken grupp den som läser kommer ifrån, så gruppens plats har ett fast namn och
 * gruppen står i raden. Mätt i emulatorn 2026-10-29 (PR-texten): en lista med grupper på kalendern går att pröva per dokument men inte att FRÅGA efter för en
 * gruppmedlem (`array-contains` på gruppen nekas, regeln kan inte bevisa medlemskapet för ett okänt element), och flera fasta platser kostar ett uppslag till per
 * grupp och läsning. En grupp och hur många personer som helst täcker beslutet.
 *
 * ══ ⛔ SERVERN FILTRERAR INTE HÄR, REGLERNA GÖR DET, OCH KOSTNADEN ÄR MÄTT ═════════════════════════════════════════
 *
 * ADR-020 och regel 13 säger att läsregler inte ska avgöra synlighet. Skälet var SessionStudios kedjor av `exists()` per grupp som föll på Firestores tak
 * (`subscribe_blocked_shared_error`). Här är kostnaden fast och liten: en läsning av en delad post gör högst sju av Firestores tio dokumentanrop (personens delning,
 * gruppens delning, den läsandes medlemskap, ägarens medlemskap, kalenderns arkivering), oavsett hur många grupper någon är med i eller hur många som fått delningen. Frågan efter posterna begränsar `kalenderId` (`deladeVagar`),
 * och en fråga utan den nekas, så ingen kan svepa en annans alla poster. Se `kalenderregelfragment`.
 */

import { ID_FORM } from "./katalog.js";
import { postTillHandelse, postTillRad } from "./kalendrar.js";
import { KALENDERVALNYCKEL_FORM } from "./kalendersynlighet.js";
import { forvalda } from "./ord.js";

/** Fälten en delning bär. `id` är nyckeln och lagras inte (adaptern tar den ur datan). */
export const KALENDERDELNINGFALT = /** @type {const} */ (["agare", "kalenderId", "person", "groupId"]);

/** Avgränsaren i nyckeln, samma som i ett medlemskap. Ingen av delarna får innehålla den (formerna nedan släpper inte in den). */
export const KALENDERDELNING_AVGRANSARE = "|";

/** Mottagarens plats i nyckeln för en person: `person~<uid>`. */
export const KALENDERDELNING_PERSON = "person~";

/** Mottagarens plats i nyckeln för gruppen. Fast, eftersom en kalender delas med högst en grupp (se filhuvudet). */
export const KALENDERDELNING_GRUPP = "grupp";

/**
 * Formen på ett uid i en delning: bokstäver, siffror, `-` och `_`, högst 128 tecken. Firebase ger 28 tecken bokstäver och siffror; formen är bredare för en egen
 * inloggning, men släpper aldrig in avgränsaren, `~` eller ett snedstreck, så att en nyckel aldrig kan betyda två saker. Reglerna har samma uttryck.
 */
export const DELNINGSUID_FORM = /^[A-Za-z0-9_-]{1,128}$/;

/** Längsta grupp-id i en delning. Samma tak som kalendervalens dokument (`MAX_KALENDERVALGRUPP`). */
export const MAX_DELNINGSGRUPP = 80;

/** Längsta kalender-id i en delning: samma som en kalenders (`MAX_KALENDERID` i `kalendrar.js`). */
const MAX_DELNINGSKALENDER = 80;

/** @typedef {{ person: string } | { grupp: string }} Kalendermottagare */

/**
 * @typedef {object} Kalenderdelning
 * @property {string} id `{agare}|{kalenderId}|person~{uid}` eller `{agare}|{kalenderId}|grupp`.
 * @property {string} agare
 * @property {string} kalenderId En av ägarens egna kalendrar.
 * @property {string} [person] Mottagaren, när det är en person.
 * @property {string} [groupId] Mottagaren, när det är en grupp.
 */

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/** @param {string} v @param {string} falt @param {string} var_ */
function uidKrav(v, falt, var_) {
  if (!DELNINGSUID_FORM.test(v)) throw new Error(`${var_}: ${falt} "${v.slice(0, 40)}" är inte ett uid (bokstäver, siffror, - och _, högst 128 tecken).`);
  return v;
}

/** @param {string} v @param {string} var_ */
function kalenderKrav(v, var_) {
  if (!ID_FORM.test(v) || v.length > MAX_DELNINGSKALENDER) throw new Error(`${var_}: kalenderId "${v.slice(0, 40)}" är inte ett kalender-id.`);
  return v;
}

/** @param {string} v @param {string} var_ */
function gruppKrav(v, var_) {
  if (!ID_FORM.test(v) || v.length > MAX_DELNINGSGRUPP) throw new Error(`${var_}: groupId "${v.slice(0, 40)}" är inte ett grupp-id (små bokstäver, siffror, - och _, högst ${MAX_DELNINGSGRUPP} tecken).`);
  return v;
}

/**
 * Nyckeln för en delning. HÄRLEDD, aldrig skriven för hand (samma skäl som `medlemskapsId`): samma delning kan då inte stå två gånger, och reglerna hittar den med
 * ett uppslag.
 *
 * @param {string} agare @param {string} kalenderId @param {Kalendermottagare} mottagare
 * @returns {string}
 */
export function kalenderdelningId(agare, kalenderId, mottagare) {
  const var_ = "kalenderdelningId";
  const a = uidKrav(rensa(agare), "agare", var_);
  const k = kalenderKrav(rensa(kalenderId), var_);
  const m = mottagare && typeof mottagare === "object" ? /** @type {Record<string, unknown>} */ (mottagare) : {};
  if ("person" in m === "grupp" in m) throw new Error(`${var_}: mottagaren är { person } eller { grupp }, exakt en av dem.`);
  const plats = "person" in m ? `${KALENDERDELNING_PERSON}${uidKrav(rensa(m.person), "person", var_)}` : (gruppKrav(rensa(m.grupp), var_), KALENDERDELNING_GRUPP);
  return [a, k, plats].join(KALENDERDELNING_AVGRANSARE);
}

/**
 * Bygger en delning, eller kastar med skälet. Skrivvägen och läsvägen är samma: reglerna släpper bara in den här formen, så en rad som står i databasen har den.
 *
 * ⛔ ÄGAREN DELAR INTE MED SIG SJÄLV. Det hade varit en rad som inte öppnar något, och i listan "Delas med" ett namn som ser ut som en mottagare.
 *
 * @param {Record<string, any>} d `{ agare, kalenderId, person }` eller `{ agare, kalenderId, groupId }`. Ett `id` som följer med prövas mot det härledda.
 * @returns {Kalenderdelning}
 */
export function byggKalenderdelning(d) {
  const var_ = "kalenderdelningar";
  const r = d && typeof d === "object" ? d : {};
  const okanda = Object.keys(r).filter((f) => f !== "id" && !(/** @type {readonly string[]} */ (KALENDERDELNINGFALT)).includes(f));
  if (okanda.length > 0) throw new Error(`${var_}: fälten ${okanda.join(", ")} känns inte igen. En delning bär ${KALENDERDELNINGFALT.join(", ")}.`);
  const agare = uidKrav(rensa(r.agare), "agare", var_);
  const kalenderId = kalenderKrav(rensa(r.kalenderId), var_);
  const harPerson = r.person !== undefined;
  const harGrupp = r.groupId !== undefined;
  if (harPerson === harGrupp) throw new Error(`${var_}: en delning har antingen person eller groupId, exakt en av dem.`);
  /** @type {Kalenderdelning} */
  let ut;
  if (harPerson) {
    const person = uidKrav(rensa(r.person), "person", var_);
    if (person === agare) throw new Error(`${var_}: ${agare} delar inte en kalender med sig själv.`);
    ut = { id: kalenderdelningId(agare, kalenderId, { person }), agare, kalenderId, person };
  } else {
    const groupId = gruppKrav(rensa(r.groupId), var_);
    ut = { id: kalenderdelningId(agare, kalenderId, { grupp: groupId }), agare, kalenderId, groupId };
  }
  if (r.id !== undefined && r.id !== ut.id) throw new Error(`${var_}: nyckeln "${String(r.id).slice(0, 60)}" stämmer inte med fälten (${ut.id}).`);
  return ut;
}

/**
 * Delningarna ur databasen, byggda och unika. KASTAR på en rad som inte går att lita på, som `validateGruppkalendrar`: reglerna släpper bara in formen, så en
 * annan rad är ett fel i läsvägen och inte en delning att visa.
 *
 * @param {unknown} rader @returns {Kalenderdelning[]}
 */
export function lasKalenderdelningar(rader) {
  if (!Array.isArray(rader)) throw new Error(`kalenderdelningar: delningarna måste vara en lista, inte ${typeof rader}.`);
  /** @type {Map<string, Kalenderdelning>} */
  const ut = new Map();
  for (const r of rader) {
    const d = byggKalenderdelning(r);
    ut.set(d.id, d);
  }
  return [...ut.values()];
}

/** Mottagaren i en delning. @param {Kalenderdelning} d @returns {Kalendermottagare} */
export function kalendermottagare(d) {
  return d.person !== undefined ? { person: d.person } : { grupp: /** @type {string} */ (d.groupId) };
}

/**
 * Ägarens delningar av en av sina kalendrar: gruppen först, sedan personerna i den ordning de kom.
 * @param {ReadonlyArray<Kalenderdelning>} delningar @param {string} kalenderId @returns {Kalenderdelning[]}
 */
export function delningarAvKalender(delningar, kalenderId) {
  const egna = delningar.filter((d) => d.kalenderId === kalenderId);
  return [...egna.filter((d) => d.groupId !== undefined), ...egna.filter((d) => d.person !== undefined)];
}

/**
 * Raden i listan Kalendrar för en kalender som delats med mig: `delad:<ägare>:<kalender>`.
 *
 * ⛔ EN RAD PER KALENDER, INTE PER DELNING. Har samma kalender delats med mig både som person och via gruppen är det en kalender, med en växel och ett val.
 * ⛔ NYCKELN FÖLJER KALENDERVALENS FORM (`KALENDERVALNYCKEL_FORM`), annars nekar reglerna valet att dölja den. Blir den för lång (ett långt uid och ett långt
 * kalender-id) används en stabil hash av samma två delar: valet följer kalendern också då, och två kalendrar får aldrig samma rad av en slump som går att se.
 *
 * @param {string} agare @param {string} kalenderId @returns {string}
 */
export function deladKalenderRadId(agare, kalenderId) {
  const rak = `delad:${agare}:${kalenderId}`;
  if (KALENDERVALNYCKEL_FORM.test(rak)) return rak;
  return `delad:h${fnv1a(`${agare}|${kalenderId}`)}${fnv1a(`${kalenderId}|${agare}`)}`;
}

/** FNV-1a, 32 bitar, som åtta hexadecimala tecken. Ingen kryptografi: bara en kort, stabil nyckel. @param {string} s */
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * @typedef {object} DeladKalender
 * @property {string} agare
 * @property {string} kalenderId
 * @property {string} radId Raden i listan Kalendrar (`deladKalenderRadId`).
 * @property {Array<"person" | "grupp">} via Hur den nått mig. Båda när den delats med mig och med gruppen.
 */

/**
 * Kalendrarna som delats med den som tittar, i den aktiva gruppen: de som delats med personen (i varje grupp, som Mina kalendrar) och de som delats med den
 * aktiva gruppen (bara där, som gruppens kalendrar). En gång per kalender, i den ordning de kom.
 *
 * ⛔ ÄGARENS EGNA KOMMER INTE MED. Är ägaren med i gruppen hon delat med har hon redan kalendern under Mina kalendrar, och en andra rad hade varit två växlar
 * för samma kalender.
 *
 * ⛔ EN GRUPPS DELNING FRÅN NÅGON SOM INTE LÄNGRE ÄR AKTIV MEDLEM KOMMER INTE MED (granskningen av PR 468), när appen ger `medlemmar`. Reglerna släpper inte
 * längre in läsningen av en sådan kalender, och raden hade blivit en kalender som inte går att läsa. Raden står kvar i databasen tills ägaren slutar dela; en fråga
 * efter gruppens delningar kan inte pröva ägarens medlemskap (den begränsar inte `agare`), så det sker här, ur den medlemslista appen redan har.
 *
 * @param {ReadonlyArray<Kalenderdelning>} delningar Delningarna till mig och till gruppen (`createKalenderkalla().deladeMedMig`).
 * @param {{ uid: string, groupId?: string | null, medlemmar?: Iterable<string> | null }} vem `medlemmar`: uid för gruppens AKTIVA medlemmar (appens medlemslista).
 * @returns {DeladKalender[]}
 */
export function deladeKalendrar(delningar, { uid, groupId = null, medlemmar = null }) {
  const aktiva = medlemmar ? new Set(medlemmar) : null;
  /** @type {Map<string, DeladKalender>} */
  const ut = new Map();
  for (const d of delningar) {
    if (d.agare === uid) continue;
    /** @type {"person" | "grupp" | null} */
    const via = d.person !== undefined ? (d.person === uid ? "person" : null) : groupId && d.groupId === groupId && (!aktiva || aktiva.has(d.agare)) ? "grupp" : null;
    if (!via) continue;
    const nyckel = `${d.agare}${KALENDERDELNING_AVGRANSARE}${d.kalenderId}`;
    const fanns = ut.get(nyckel);
    if (fanns) {
      if (!fanns.via.includes(via)) fanns.via.push(via);
      continue;
    }
    ut.set(nyckel, { agare: d.agare, kalenderId: d.kalenderId, radId: deladKalenderRadId(d.agare, d.kalenderId), via: [via] });
  }
  return [...ut.values()];
}

/**
 * Orden för en delad kalender, på båda språken. `{namn}` byts mot ägarens namn.
 */
export const ORD_KALENDERDELNING = {
  sektion: { sv: "Delade med mig", en: "Shared with me" },
  marke: { sv: "Delad av {namn}. Bara läsning", en: "Shared by {namn}. Read only" },
  okandAgare: { sv: "någon i gruppen", en: "someone in the group" },
};

/**
 * En delad kalender som en rad i listan Kalendrar (`OpsKalenderLista`): namn, färg, sektionen "Delade med mig" och märket "Delad av Anna. Bara läsning".
 * Raden har samma växel och samma visning (Händelser, Ram, Båda) som varje annan kalender, och valet att dölja den sparas som för de andra.
 *
 * ⛔ EN ARKIVERAD KALENDER GER `null` (granskningen av PR 468): den delas inte längre, reglerna släpper inte in dess poster, och raden ska inte stå i listan.
 * Kalenderns eget dokument går att läsa just för att mottagaren ska kunna se det här, i stället för att en läsning faller utan förklaring.
 *
 * @param {import("./kalendrar.js").MinKalender} kalender Ägarens kalender, läst med `createKalenderkalla().deladKalender`.
 * @param {DeladKalender} delad
 * @param {{ agarnamn?: string, sprak?: string }} [val]
 * @returns {import("../components/OpsCalendar.jsx").KalenderVal | null}
 */
export function deladKalenderTillVal(kalender, delad, { agarnamn, sprak = "sv" } = {}) {
  if (kalender.arkiverad) return null;
  const o = forvalda(ORD_KALENDERDELNING, sprak);
  const namn = rensa(agarnamn) || o.okandAgare;
  return { id: delad.radId, namn: kalender.namn, farg: kalender.farg, sektion: o.sektion, marke: o.marke.replace("{namn}", namn) };
}

/** Prefixet på `handelseId` för en post i en kalender som delats med mig. Skiljer sig från egna posters (`post~`), så appen aldrig öppnar den som sin egen. */
export const DELADPOST_HANDELSEPREFIX = "deladpost~";

/** @param {string} agare @param {string} postId @returns {string} */
export function deladPostHandelseId(agare, postId) {
  return `${DELADPOST_HANDELSEPREFIX}${uidKrav(rensa(agare), "agare", "deladPostHandelseId")}~${rensa(postId)}`;
}

/**
 * Ägaren och postens id ur ett `handelseId`, eller `null` när det inte är en delad posts. Den enda platsen prefixet tolkas.
 * @param {unknown} handelseId @returns {{ agare: string, postId: string } | null}
 */
export function deladPostUrHandelseId(handelseId) {
  if (typeof handelseId !== "string" || !handelseId.startsWith(DELADPOST_HANDELSEPREFIX)) return null;
  const rest = handelseId.slice(DELADPOST_HANDELSEPREFIX.length);
  const i = rest.indexOf("~");
  if (i <= 0 || i === rest.length - 1) return null;
  const agare = rest.slice(0, i);
  const postId = rest.slice(i + 1);
  return DELNINGSUID_FORM.test(agare) && ID_FORM.test(postId) ? { agare, postId } : null;
}

/**
 * En post i en delad kalender som en rad i `OpsCalendar`. Samma omvandling som för en egen post (`postTillRad`), med raden i listan som kalender och ett
 * `handelseId` som säger att den är någon annans (`deladPostHandelseId`).
 *
 * @param {import("./kalendrar.js").Kalenderpost} post
 * @param {{ id: string, namn: string, farg: number }} rad Den delade kalenderns rad (`deladKalenderTillVal`).
 * @param {string} agare
 * @returns {import("./calendar.js").CalendarEntry}
 */
export function deladPostTillRad(post, rad, agare) {
  const handelseId = deladPostHandelseId(agare, post.id);
  return { ...postTillRad({ ...post, kalenderId: rad.id }, [rad]), id: handelseId, handelseId };
}

/**
 * En post i en delad kalender som en `HandelseVy` för `OpsHandelsePanel`: samma som för en egen post. Den som fått delningen får inga åtgärder: appen ger
 * panelen varken Ändra, Flytta eller Ta bort för en sådan post, och reglerna nekar dem ändå.
 *
 * @param {import("./kalendrar.js").Kalenderpost} post
 * @param {{ id: string, namn: string, farg: number }} rad
 * @param {string} agare
 * @returns {import("../components/OpsHandelsePanel.jsx").HandelseVy}
 */
export function deladPostTillHandelse(post, rad, agare) {
  return { ...postTillHandelse({ ...post, kalenderId: rad.id }, [rad]), id: deladPostHandelseId(agare, post.id) };
}

/** Det som gör något med en händelse i `OpsHandelsePanel`, och som den som fått en delning inte får: ändra, flytta, dela vidare och egna åtgärder. */
export const DELADPOST_UTAN_PROPS = /** @type {const} */ (["onRedigera", "flyttmal", "onFlytta", "onDela", "delningar", "onAterkalla", "onMejlaLank", "delningGruppdel", "atgarder", "knapprad"]);

/**
 * Panelens props för en händelse: oförändrade för en egen, och utan allt som ändrar den för en post i en kalender som delats med mig (granskningen av PR 468).
 * Appen ger panelen sina vanliga props genom den här, så att en delad post öppnas utan Ändra, Flytta, Dela och Ta bort, och ingen knapp ritas som reglerna sedan
 * nekar. "Kopiera till" står kvar: att kopiera till en egen kalender är att läsa, inte att ändra.
 *
 * @template {Record<string, any>} P
 * @param {unknown} handelseId
 * @param {P} props
 * @returns {P}
 */
export function panelForDeladPost(handelseId, props) {
  if (!deladPostUrHandelseId(handelseId)) return props;
  const ut = /** @type {Record<string, any>} */ ({ ...props });
  for (const f of DELADPOST_UTAN_PROPS) delete ut[f];
  return /** @type {P} */ (ut);
}
