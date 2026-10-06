import { NAMN_SAKNAS } from "../lib/personnamn.js";
import { FALT_BORT } from "./contract.js";
import { byggMeddelande, byggSamtal, byggTrad, kravTradnamn, motpart, olastaI, samtalsnyckel, utdrag } from "../lib/samtal.js";

/**
 * Samtalskällan: läser och skriver ramverkets samtal genom en datakälla (0.34.0, #182, #185).
 *
 * ⛔ RAMVERKET KÄNNER INTE SAMLINGSNAMNEN. Appen skickar in dem, med samma namn som till `samtalsregelfragment()`.
 * Meddelanden och läst-status är undersamlingar till samtalet: sökvägen byggs här, `<samtal>/<id>/<meddelanden>`.
 *
 * ⛔ UNDERSAMLINGAR OCH INTE EGNA SAMLINGAR, och skälet är arbetsreglernas punkt 2. Ett meddelande i en egen samling
 * hade behövt bära samtalets `groupId` och deltagare för att regeln ska kunna avgöra vem som läser det, alltså en kopia
 * per meddelande av något samtalet redan vet. Som undersamling slår regeln upp samtalet en gång, och ett meddelande kan
 * inte hamna i ett samtal med andra läsare än det skrevs i.
 *
 * ⛔ HÖGST ETT SAMTAL PER PAR KOMMER UR NYCKELN, INTE UR EN FRÅGA FÖRE. `oppnaPrivat` skapar direkt med den härledda
 * nyckeln. Finns samtalet redan är skapelsen en uppdatering som regeln nekar, och då läses det befintliga. Frågan
 * "finns det redan?" före skrivningen hade varit en läs-sedan-skriv-kontroll, och två som öppnar samtidigt hade båda
 * fått "nej".
 *
 * @param {object} konfig
 * @param {import("./contract.js").DataSource<any>} konfig.kalla
 * @param {string} [konfig.samtal] Förval `"samtal"`.
 * @param {string} [konfig.meddelanden] Förval `"meddelanden"`.
 * @param {string} [konfig.last] Förval `"last"`.
 * @param {string} [konfig.tradar] (0.66.0) Trådarnas samlingsnamn. ⛔ INGET FÖRVAL: utan det har källan inga trådfunktioner,
 *   och `OpsMeddelanden` ritar inga trådar. Appen slår på trådarna genom att skicka samma namn som till
 *   `samtalsregelfragment({ tradar })`. Trådens meddelanden ligger under tråden med samma namn som samtalets (`meddelanden`),
 *   eftersom de har samma form och samma regel.
 * @param {number} [konfig.sida] Hur många av de senaste meddelandena som läses per samtal. Förval 50.
 * @param {() => number} [konfig.klocka] Förval `Date.now`. Prov byter den.
 */
export function createSamtalskalla(konfig) {
  const { kalla, samtal = "samtal", meddelanden = "meddelanden", last = "last", tradar, sida = 50, klocka = Date.now } = konfig ?? /** @type {any} */ ({});
  if (!kalla || typeof kalla.list !== "function") {
    throw new Error("createSamtalskalla: kalla krävs, en datakälla (createFirestoreSource, createMemorySource).");
  }
  for (const [falt, v] of Object.entries({ samtal, meddelanden, last, ...(tradar === undefined ? {} : { tradar }) })) {
    if (typeof v !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(v)) {
      throw new Error(`createSamtalskalla: ${falt} "${v}" är inte ett samlingsnamn.`);
    }
  }
  // ⛔ KAN 7 (granskningen av PR 268): samma namn som en annan undersamling hade blandat trådar med meddelanden eller läsmärken.
  if (tradar !== undefined && (tradar === meddelanden || tradar === last)) {
    throw new Error(`createSamtalskalla: tradar "${tradar}" krockar med ${tradar === meddelanden ? "meddelanden" : "last"}.`);
  }

  /** @param {string} sid */
  const meddelandevag = (sid) => `${samtal}/${sid}/${meddelanden}`;
  /** @param {string} sid */
  const lastvag = (sid) => `${samtal}/${sid}/${last}`;

  /**
   * Gruppchatten och mina privata samtal i en grupp.
   *
   * ⛔ TVÅ FRÅGOR, INTE EN. En fråga över hela gruppen hade tagit med andras privata samtal, och regeln nekar den (prov
   * i `rules/__tests__/samtal.test.mjs`). Därför frågas gruppchatten på `slag` och de privata på `deltagare`.
   *
   * @param {{ groupId: string, uid: string }} fraga
   * @returns {Promise<import("../lib/samtal.js").Samtal[]>}
   */
  async function lista({ groupId, uid }) {
    if (!groupId || !uid) throw new Error("samtalskalla.lista: groupId och uid krävs.");
    const [gruppens, mina] = await Promise.all([
      kalla.list(samtal, { where: { groupId, slag: "grupp" } }),
      kalla.list(samtal, { where: { groupId }, innehaller: { deltagare: uid } }),
    ]);
    const sedda = new Set();
    return [...gruppens, ...mina].filter((s) => (sedda.has(s.id) ? false : (sedda.add(s.id), true)));
  }

  /**
   * @param {import("../lib/samtal.js").Samtal} s
   * @param {string} uid
   */
  async function skapaEllerHamta(s, uid) {
    try {
      const { id, ...falt } = s;
      await kalla.create(samtal, { id, ...falt, ...(falt.deltagare ? { deltagare: [...falt.deltagare] } : {}) });
      return s;
    } catch (fel) {
      // Finns samtalet redan nekas skapelsen (den är en uppdatering). Då är det befintliga svaret.
      const finns = (await lista({ groupId: s.groupId, uid })).find((x) => x.id === s.id);
      if (finns) return finns;
      throw fel;
    }
  }

  /**
   * Gruppens chatt. Skapas första gången någon öppnar den.
   *
   * @param {{ groupId: string, uid: string }} d
   */
  async function oppnaGrupp({ groupId, uid }) {
    const id = samtalsnyckel({ groupId, slag: "grupp" });
    const finns = (await lista({ groupId, uid })).find((x) => x.id === id);
    if (finns) return finns;
    return skapaEllerHamta(byggSamtal({ groupId, slag: "grupp", skapadAv: uid, skapad: klocka() }), uid);
  }

  /**
   * Ett privat samtal mellan `uid` och `annan`, eller ett agentsamtal (`slag: "agent"`). Högst ett per par och grupp.
   *
   * @param {{ groupId: string, uid: string, annan: string, slag?: "personer" | "agent" }} d
   */
  async function oppnaPrivat({ groupId, uid, annan, slag = "personer" }) {
    const s = byggSamtal({ groupId, slag, deltagare: [uid, annan], skapadAv: uid, skapad: klocka() });
    /*
     * ⛔ LISTAN FÖRST ÄR EN BESPARING, INTE UNIKHETEN. Den som redan har samtalet i sin inkorg ska inte göra en skrivning
     * som regeln ändå nekar. Unikheten kommer ur nyckeln och regeln, se filhuvudet, och gäller även när två öppnar
     * samtidigt och båda får "finns inte" här.
     */
    const finns = (await lista({ groupId, uid })).find((x) => x.id === s.id);
    return finns ?? skapaEllerHamta(s, uid);
  }

  /**
   * De senaste meddelandena i ett samtal, i stigande tid.
   *
   * @param {string} sid
   * @param {{ limit?: number }} [val]
   * @returns {Promise<Array<import("../lib/samtal.js").Meddelande & { id: string }>>}
   */
  async function lasMeddelanden(sid, val = {}) {
    const rader = await kalla.list(meddelandevag(sid), { sortBy: "tid", direction: "desc", limit: val.limit ?? sida });
    return [...rader].reverse();
  }

  /**
   * Lyssnar på ett samtals meddelanden, om källan kan prenumerera. Annars `null`, och vyn läser om efter varje skickat.
   *
   * @param {string} sid
   * @param {{ onData: (rader: any[]) => void, onError: (fel: Error) => void }} lyssnare
   * @returns {(() => void) | null}
   */
  function prenumerera(sid, lyssnare) {
    if (typeof kalla.subscribe !== "function") return null;
    return kalla.subscribe(meddelandevag(sid), { sortBy: "tid", direction: "desc", limit: sida }, {
      onData: (rader) => lyssnare.onData([...rader].reverse()),
      onError: lyssnare.onError,
    });
  }

  /**
   * @param {string} sid
   * @param {{ text: string, av: string }} d
   */
  async function skicka(sid, { text, av }) {
    const m = byggMeddelande({ text, av, tid: klocka() });
    return kalla.create(meddelandevag(sid), { ...m });
  }

  /**
   * @param {string} sid
   * @param {string} uid
   * @returns {Promise<number>} 0 när inget läsmärke finns: allt är oläst.
   */
  async function lastTill(sid, uid) {
    const rad = await kalla.read(lastvag(sid), uid);
    return rad && typeof rad.lastTill === "number" ? rad.lastTill : 0;
  }

  /**
   * Sätter läsmärket till `tid`, den senaste tid personen sett. Vyn skickar bara en tid som är senare än den förra.
   *
   * @param {string} sid
   * @param {string} uid
   * @param {number} tid
   */
  async function markeraLast(sid, uid, tid) {
    if (!Number.isInteger(tid)) throw new Error("samtalskalla.markeraLast: tid är millisekunder, ett heltal.");
    await kalla.create(lastvag(sid), { id: uid, lastTill: tid });
  }

  /**
   * Inkorgens rader: varje samtal med det senaste meddelandet, antal olästa och läsmärket, nyast först.
   *
   * @param {{ groupId: string, uid: string }} fraga
   * @returns {Promise<Array<{ samtal: import("../lib/samtal.js").Samtal, senaste: (import("../lib/samtal.js").Meddelande & { id: string }) | null, olasta: number, lastTill: number, motpart: string | null }>>}
   */
  async function oversikt({ groupId, uid }) {
    const alla = await lista({ groupId, uid });
    const rader = await Promise.all(
      alla.map(async (s) => {
        const [ms, till] = await Promise.all([lasMeddelanden(s.id), lastTill(s.id, uid)]);
        return { samtal: s, senaste: ms[ms.length - 1] ?? null, olasta: olastaI(ms, till, uid), lastTill: till, motpart: motpart(s, uid) };
      }),
    );
    return rader.sort((a, b) => (b.senaste?.tid ?? b.samtal.skapad ?? 0) - (a.senaste?.tid ?? a.samtal.skapad ?? 0));
  }

  /*
   * ══ ⛔ TRÅDARNA (0.66.0, cllp/lifehub.app#60) ═══════════════════════════════════════════════════════════════════
   *
   * Modellen och skälen står i `lib/samtal.js`. Här: hur källan läser och skriver dem. Bara när appen skickat `tradar`.
   *
   * ⛔ EN TRÅD SKAPAS FÖRST NÄR DET FÖRSTA SVARET SKICKAS (`skickaITrad`), inte när någon öppnar den. "Svara i tråd" som
   * ångras lämnar då ingen tom tråd efter sig, och märket under meddelandet ljuger aldrig om ett svar som inte finns.
   *
   * ⛔ LÄSNINGARNA ÄR RÄKNADE (granskningen av PR 268, BÖR 4). Första versionen läste alla trådar i samtalet och 50 meddelanden
   * per tråd, vid varje nytt meddelande. Nu:
   *   - `tradarFor(sid, rotter)` läser en tråd per rot, och bara de rötter vyn ber om: vyn frågar bara om nya rötter.
   *     Kontraktet har ingen `in`-fråga, och en per rot kräver ingen ny form i varje adapter (regel 13);
   *   - `antalSvar` är en aggregatfråga (`count`) där källan kan, och annars en lista med `sida` som tak (minneskällan);
   *   - märkets namn kräver inga meddelanden: det är trådens `namn`, eller rotmeddelandet som redan står i chatten.
   * Antalet svar räknas fram och lagras inte: en räknare på tråden hade varit en andra sanning om meddelandena.
   */

  /** @param {string} sid */
  const tradvag = (sid) => `${samtal}/${sid}/${tradar}`;
  /** @param {string} sid @param {string} tid */
  const tradmeddelandevag = (sid, tid) => `${tradvag(sid)}/${tid}/${meddelanden}`;

  /**
   * En tråd, eller `null` om den inte finns än.
   * @param {string} sid @param {string} tid
   * @returns {Promise<import("../lib/samtal.js").Trad | null>}
   */
  async function trad(sid, tid) {
    return /** @type {any} */ (await kalla.read(tradvag(sid), tid));
  }

  /**
   * Öppnar tråden ur rotmeddelandet `rot`: den befintliga, eller en ny. Högst en per meddelande.
   *
   * ⛔ UNIKHETEN BÄRS AV REGELN, INTE AV DEN HÄR FUNKTIONEN (KAN 8). Nyckeln är rotens id, och regeln nekar en andra skapelse:
   * kontraktets `create` med eget id ersätter (som `setDoc`), och en ersättning är en uppdatering som rör mer än `namn`. Läsningen
   * först är en besparing, och läsningen efter ett nej ger den befintliga. ⛔ I EN KÄLLA UTAN REGLER (minneskällan, ett prov)
   * finns ingen sådan spärr: två som öppnar samma tråd i samma ögonblick, båda före den andras skrivning, skriver båda, och den
   * sista skaparen står kvar. Svaren går inte förlorade, de ligger under samma nyckel; bara `skapadAv` kan bli den andras.
   *
   * @param {{ sid: string, rot: string, uid: string }} d
   * @returns {Promise<import("../lib/samtal.js").Trad>}
   */
  async function oppnaTrad({ sid, rot, uid }) {
    if (!sid) throw new Error("samtalskalla.oppnaTrad: sid krävs.");
    const ny = byggTrad({ rot, skapadAv: uid, skapad: klocka() });
    const finns = await trad(sid, ny.id);
    if (finns) return finns;
    try {
      const { id, ...falt } = ny;
      await kalla.create(tradvag(sid), { id, ...falt });
      return ny;
    } catch (fel) {
      const igen = await trad(sid, ny.id);
      if (igen) return igen;
      throw fel;
    }
  }

  /**
   * De trådar som finns bland rötterna, en läsning per rot. Rötter utan tråd ger ingen rad.
   *
   * @param {string} sid @param {ReadonlyArray<string>} rotter
   * @returns {Promise<Array<import("../lib/samtal.js").Trad>>}
   */
  async function tradarFor(sid, rotter) {
    if (!Array.isArray(rotter)) throw new Error("samtalskalla.tradarFor: rotter krävs, de meddelanden vars trådar ska läsas. Hela samtalet läses aldrig.");
    const rader = await Promise.all(rotter.map((r) => trad(sid, r)));
    return /** @type {any} */ (rader.filter(Boolean));
  }

  /**
   * Antalet svar i en tråd. `fler` när källan saknar `count` och taket `sida` nåddes.
   * @param {string} sid @param {string} tid
   * @returns {Promise<{ antal: number, fler: boolean }>}
   */
  async function antalSvar(sid, tid) {
    if (typeof kalla.count === "function") return { antal: await kalla.count(tradmeddelandevag(sid, tid)), fler: false };
    const ms = await kalla.list(tradmeddelandevag(sid, tid), { limit: sida });
    return { antal: ms.length, fler: ms.length >= sida };
  }

  /**
   * De senaste meddelandena i en tråd, i stigande tid.
   * @param {string} sid @param {string} tid
   * @returns {Promise<Array<import("../lib/samtal.js").Meddelande & { id: string }>>}
   */
  async function tradmeddelanden(sid, tid) {
    const rader = await kalla.list(tradmeddelandevag(sid, tid), { sortBy: "tid", direction: "desc", limit: sida });
    return [...rader].reverse();
  }

  /**
   * Lyssnar på en tråds meddelanden, om källan kan prenumerera. Annars `null`.
   * @param {string} sid @param {string} tid
   * @param {{ onData: (rader: any[]) => void, onError: (fel: Error) => void }} lyssnare
   * @returns {(() => void) | null}
   */
  function prenumereraTrad(sid, tid, lyssnare) {
    if (typeof kalla.subscribe !== "function") return null;
    return kalla.subscribe(tradmeddelandevag(sid, tid), { sortBy: "tid", direction: "desc", limit: sida }, {
      onData: (rader) => lyssnare.onData([...rader].reverse()),
      onError: lyssnare.onError,
    });
  }

  /**
   * Skickar i tråden ur `tid`, och öppnar tråden först om den inte finns.
   * @param {string} sid @param {string} tid
   * @param {{ text: string, av: string }} d
   */
  async function skickaITrad(sid, tid, { text, av }) {
    // Meddelandet byggs först: ett tomt svar ska inte lämna en tom tråd efter sig.
    const m = byggMeddelande({ text, av, tid: klocka() });
    await oppnaTrad({ sid, rot: tid, uid: av });
    return kalla.create(tradmeddelandevag(sid, tid), { ...m });
  }

  /**
   * Döper om tråden, eller (med `null` eller tomt) går tillbaka till det härledda namnet.
   * @param {string} sid @param {string} tid @param {string | null} namn
   */
  async function dopOm(sid, tid, namn) {
    const n = kravTradnamn(namn, "samtalskalla.dopOm");
    return kalla.update(tradvag(sid), tid, { namn: n ?? FALT_BORT });
  }

  /**
   * Rotmeddelandet en tråd startades ur, eller `null`.
   * @param {string} sid @param {string} tid
   */
  async function rotmeddelande(sid, tid) {
    return /** @type {any} */ (await kalla.read(meddelandevag(sid), tid));
  }

  const tradfunktioner = tradar === undefined ? {} : { tradar, trad, oppnaTrad, tradarFor, antalSvar, tradmeddelanden, prenumereraTrad, skickaITrad, dopOm, rotmeddelande };

  return Object.freeze({
    lista,
    oppnaGrupp,
    oppnaPrivat,
    meddelanden: lasMeddelanden,
    prenumerera,
    skicka,
    lastTill,
    markeraLast,
    oversikt,
    sida,
    ...tradfunktioner,
  });
}

/**
 * @typedef {object} Tradfunktioner (0.66.0) Det en samtalskälla har när appen skickat `tradar`.
 * @property {string} tradar
 * @property {(sid: string, tid: string) => Promise<import("../lib/samtal.js").Trad | null>} trad
 * @property {(d: { sid: string, rot: string, uid: string }) => Promise<import("../lib/samtal.js").Trad>} oppnaTrad
 * @property {(sid: string, rotter: ReadonlyArray<string>) => Promise<Array<import("../lib/samtal.js").Trad>>} tradarFor
 * @property {(sid: string, tid: string) => Promise<{ antal: number, fler: boolean }>} antalSvar
 * @property {(sid: string, tid: string) => Promise<Array<import("../lib/samtal.js").Meddelande & { id: string }>>} tradmeddelanden
 * @property {(sid: string, tid: string, lyssnare: { onData: (rader: any[]) => void, onError: (fel: Error) => void }) => (() => void) | null} prenumereraTrad
 * @property {(sid: string, tid: string, d: { text: string, av: string }) => Promise<any>} skickaITrad
 * @property {(sid: string, tid: string, namn: string | null) => Promise<any>} dopOm
 * @property {(sid: string, tid: string) => Promise<(import("../lib/samtal.js").Meddelande & { id: string }) | null>} rotmeddelande
 */

/**
 * Har källan trådar, alltså har appen slagit på dem med `tradar`? (0.66.0, granskningen av PR 268, BÖR 2.)
 *
 * ⛔ EN FRÅGA, ETT STÄLLE. Vyn ritar "Svara i tråd" och märkena bara när svaret är ja, så att en app som inte bett om trådar
 * aldrig får en knapp som skriver till en samling dess regler inte släpper in.
 *
 * @template {object} K
 * @param {K | null | undefined} kalla
 * @returns {kalla is K & Tradfunktioner}
 */
export function harTradar(kalla) {
  return Boolean(kalla) && typeof (/** @type {any} */ (kalla).oppnaTrad) === "function";
}

/**
 * Notiser för olästa meddelanden i privata samtal, som en källa för ytan `notiser` (0.34.0, #182 F4).
 *
 * ══ ⛔ INGET NYTT NOTISSYSTEM, OCH INGEN NY RAD SOM SKRIVS ════════════════════════════════════════════
 *
 * Ramverket har redan notisytan (`OpsNotiser`, källkontraktets `notiser`), med läsmärken som appens data. Den här
 * funktionen fyller den. Notisen SKRIVS inte någonstans när ett meddelande kommer: den härleds ur samtalet och
 * läsmärket när notiserna hämtas, så att den försvinner i samma stund som meddelandet läses. En skriven notis hade
 * varit en andra sanning om samma oläst, och hade krävt en server som skriver den åt mottagaren (en klient får inte
 * skriva i någon annans namn).
 *
 * Notisens id är `<samtalets id>|<senaste meddelandets id>`, så ett nytt meddelande i samma samtal är en ny notis.
 *
 * @param {object} konfig
 * @param {ReturnType<typeof createSamtalskalla>} konfig.samtal
 * @param {string} konfig.uid
 * @param {(uid: string) => string} konfig.namnFor Visningsnamnet för ett uid, ur gruppens medlemskap.
 * @param {(samtalId: string) => string} [konfig.href] Vart notisen leder.
 * @param {(namn: string) => string} [konfig.titel] Förval `"<namn> skickade ett meddelande"`.
 * @returns {(fraga: { groupId: string }) => Promise<Array<{ id: string, titel: string, text: string, prio: "normal", href?: string }>>}
 */
export function samtalsnotiser({ samtal, uid, namnFor, href, titel = (namn) => `${namn} skickade ett meddelande` }) {
  if (!samtal || typeof samtal.oversikt !== "function") throw new Error("samtalsnotiser: samtal krävs, en källa ur createSamtalskalla.");
  if (!uid) throw new Error("samtalsnotiser: uid krävs. Notiserna är en persons, inte gruppens.");
  if (typeof namnFor !== "function") throw new Error("samtalsnotiser: namnFor krävs. En notis utan namn säger inte vem som skrev.");
  return async ({ groupId }) => {
    const rader = await samtal.oversikt({ groupId, uid });
    return rader
      .filter((r) => r.samtal.slag !== "grupp" && r.olasta > 0 && r.senaste)
      .map((r) => {
        const s = /** @type {NonNullable<typeof r.senaste>} */ (r.senaste);
        return {
          id: `${r.samtal.id}|${s.id}`,
          titel: titel(namnFor(s.av) || NAMN_SAKNAS),
          text: utdrag(s.text),
          prio: /** @type {const} */ ("normal"),
          ...(href ? { href: href(r.samtal.id) } : {}),
        };
      });
  };
}
