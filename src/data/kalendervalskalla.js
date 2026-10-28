import { ID_FORM } from "../lib/katalog.js";
import { MAX_KALENDERVALGRUPP, kalenderValDokument } from "../lib/kalendersynlighet.js";

/**
 * Kalendervalens källa: vilka kalendrar som syns och hur, på kontot (0.151.0, CP 2026-10-28).
 *
 * ══ ⛔ HÄNDELSEN ═══════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-28: "Väljer jag ram i mobilen syns det inte på datorn." Valen bodde i webbläsarens `localStorage` och följde enheten. Det här är kontots halva: ett dokument per person
 * och grupp, `<användare>/{uid}/<samling>/{gruppId}`, i formen `kalenderValDokument` bygger (samma som `useKalenderSynlighet` läser och skriver). Reglerna är
 * `kalendervalsregelfragment`: bara personen själv läser och skriver.
 *
 * ⛔ RAMVERKET KÄNNER INTE SAMLINGSNAMNET OCH INTE PROJEKTET. Appen skickar källan (`createFirestoreSource` mot sitt projekt) och namnet, med samma namn som till
 * `kalendervalsregelfragment`. Ramverket känner inte heller appens minnesnyckel (`person:grupp`): personen och gruppen skickas var för sig, och `konto(uid, gruppId)` binder ihop dem.
 *
 * ⛔ UTAN FIREBASE: `createMemorySource` räcker (och är vad proven använder). En app som inte har någon källa skickar inget `konto` till `OpsCalendar`, och allt beter sig som förut.
 *
 * @param {object} konfig
 * @param {import("./contract.js").DataSource<any>} konfig.kalla
 * @param {string} [konfig.anvandare] Förval `"users"`, samma som till `kalendervalsregelfragment`.
 * @param {string} konfig.kalenderval Samlingsnamnet appen valt. Krävs: ramverket känner det aldrig självt.
 */
export function createKalendervalskalla(konfig) {
  const { kalla, anvandare = "users", kalenderval } = konfig ?? /** @type {any} */ ({});
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.create !== "function") {
    throw new Error("createKalendervalskalla: kalla krävs, en datakälla (createFirestoreSource, createMemorySource).");
  }
  for (const [falt, v] of Object.entries({ anvandare, kalenderval })) {
    if (typeof v !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(v)) throw new Error(`createKalendervalskalla: ${falt} "${v}" är inte ett samlingsnamn.`);
  }
  /** @param {string} uid */
  const vag = (uid) => {
    if (typeof uid !== "string" || !uid || uid.includes("/")) throw new Error(`createKalendervalskalla: uid "${uid}" är inte ett id. Kalenderval är en persons.`);
    return `${anvandare}/${uid}/${kalenderval}`;
  };
  /** @param {string} gruppId */
  const krav = (gruppId) => {
    if (typeof gruppId !== "string" || !ID_FORM.test(gruppId) || gruppId.length > MAX_KALENDERVALGRUPP) {
      throw new Error(`createKalendervalskalla: gruppId "${gruppId}" är inte ett grupp-id. Dokumentet heter efter gruppen, och reglerna släpper bara in ID_FORM (högst ${MAX_KALENDERVALGRUPP} tecken).`);
    }
    return gruppId;
  };

  /**
   * Dokumentet, eller `null` när personen aldrig sparat något i gruppen. KASTAR när det inte gick att fråga: "fanns inget" och "kunde inte fråga" är olika saker.
   * @param {string} uid @param {string} gruppId
   */
  async function las(uid, gruppId) {
    const rad = await kalla.read(vag(uid), krav(gruppId));
    if (!rad) return null;
    const { id: _id, ...dokument } = rad;
    return dokument;
  }

  /**
   * Ersätter dokumentet. Bygger det ur `kalenderValDokument`, som kastar vid för många poster innan reglerna hinner neka det.
   * @param {string} uid @param {string} gruppId @param {import("../lib/kalendersynlighet.js").KalenderSynlighet} val
   */
  async function skriv(uid, gruppId, val) {
    const id = krav(gruppId);
    await kalla.create(vag(uid), { id, ...kalenderValDokument(val) });
  }

  return Object.freeze({
    las,
    skriv,
    /**
     * Kontot för EN person och EN grupp, i den form `useKalenderSynlighet` och `OpsCalendar kalenderKonto` tar. Skapa det med `useMemo` på `[uid, gruppId]`.
     * @param {string} uid @param {string} gruppId
     * @returns {import("../lib/useKalenderSynlighet.js").Kalenderkonto}
     */
    konto(uid, gruppId) {
      vag(uid);
      krav(gruppId);
      return { las: () => las(uid, gruppId), skriv: (val) => skriv(uid, gruppId, val) };
    },
  });
}
