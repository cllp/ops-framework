import { standardGruppkalender, gruppkalendernyckel, STANDARDKALENDER_ID } from "../lib/kalendrar.js";

/**
 * Standardkalendern för grupper som redan finns (cllp/lifehub.app#367): engångssteget som ger en grupp utan kalender sin
 * `kalender`, och samma rad som `createGroupService` skriver vid skapandet (`standardGruppkalender`).
 *
 * ⛔ BARA HÄR, INTE I HUVUDINGÅNGEN, av samma skäl som `createAgentService`: en funktion som skriver i gruppens samlingar och
 * ligger där en vy kan nå den är en dörr bredvid reglerna. Samlingsnamnen skickas in, ramverket känner inga.
 *
 * ⛔ TRE LÄGEN, OCH ETT AV DEM RÖRS ALDRIG.
 *   - `finns`: gruppen har minst en aktiv gruppkalender. Rörs inte.
 *   - `bara_arkiverade`: gruppen har kalendrar och alla är arkiverade. Rörs inte och rapporteras, eftersom en admin som arkiverat
 *     allt har gjort ett val, och ett engångssteg som kom tillbaka med en ny kalender hade varit att ångra det åt hen.
 *   - `saknas`: gruppen har ingen rad alls. Torrt: `saknas`. Skarpt: raden skrivs och läget är `skapad`.
 *
 * ⛔ IDEMPOTENT PÅ DET SOM FINNS PÅ RIKTIGT: raden skrivs med `createNew`, som aldrig skriver över. Hinner någon annan skriva
 * `kalender` mellan läsningen och skrivningen blir svaret `finns`, inte en tyst ersättning och inte ett fel. En datakälla utan
 * `createNew` nekas när tjänsten byggs, för en källa som bara kan läsa och sedan skriva gör det här steget till en läs-sedan-skriv-kontroll.
 *
 * @typedef {"finns" | "bara_arkiverade" | "saknas" | "skapad"} Standardkalenderlage
 *
 * @typedef {object} StandardkalenderRapport Alla fält finns alltid, också som 0 eller tom lista: "noll" och "ostält" ska gå att skilja (arbetsreglernas punkt 5).
 * @property {boolean} skarpt
 * @property {number} lasta Antal grupper som lästes.
 * @property {number} finns
 * @property {number} saknas Torrt: grupperna som skulle få en kalender. Skarpt: de som inte fick en, vilket bara händer om skrivningen föll (då står de också i `fel`).
 * @property {number} skapade
 * @property {string[]} bara_arkiverade Grupp-id, så att de som tittar på rapporten kan se vilka.
 * @property {{ groupId: string, fel: string }[]} fel Ett fel på en grupp stoppar inte de andra och tystas inte.
 *
 * @param {object} konfig
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla Admin SDK-källan. Måste ha `createNew`.
 * @param {{ grupper?: string, gruppkalendrar?: string }} [konfig.samlingar] Förval `groups` och `gruppkalendrar`.
 */
export function createStandardkalenderService(konfig) {
  const { kalla, samlingar = {} } = konfig ?? /** @type {any} */ ({});
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.list !== "function") {
    throw new Error("createStandardkalenderService: en datakälla med read och list krävs. Ramverket känner ingen databas.");
  }
  if (typeof kalla.createNew !== "function") {
    throw new Error("createStandardkalenderService: datakällan saknar createNew. Utan den vore steget en läsning följd av en skrivning, och en kalender någon hann skapa mellan de två hade skrivits över. Se datakontraktets regel 8.");
  }
  const GRUPPER = samlingar.grupper ?? "groups";
  const GRUPPKALENDRAR = samlingar.gruppkalendrar ?? "gruppkalendrar";

  /**
   * @param {{ groupId: string, skarpt: boolean }} b `skarpt: false` läser bara.
   * @returns {Promise<Standardkalenderlage>}
   */
  async function sakerstallStandardkalender(b) {
    if (typeof b?.skarpt !== "boolean") throw new Error("sakerstallStandardkalender: skarpt måste vara true eller false. Ett torrt steg som råkar skriva är inte torrt.");
    const groupId = typeof b?.groupId === "string" ? b.groupId.trim() : "";
    if (!groupId) throw new Error("sakerstallStandardkalender: groupId krävs.");
    // Nyckeln byggs FÖRST, så att ett groupId som inte har id-formen kastar innan något läses eller skrivs.
    const nyckel = gruppkalendernyckel(groupId, STANDARDKALENDER_ID);
    const rader = await kalla.list(GRUPPKALENDRAR, { where: { groupId } });
    if (rader.some((r) => r && r.arkiverad !== true)) return "finns";
    if (rader.length > 0) return "bara_arkiverade";
    if (!b.skarpt) return "saknas";
    const rad = standardGruppkalender(groupId);
    if (rad.id !== nyckel) throw new Error(`sakerstallStandardkalender: radens nyckel "${rad.id}" är inte "${nyckel}".`);
    const svar = await /** @type {NonNullable<typeof kalla.createNew>} */ (kalla.createNew).call(kalla, GRUPPKALENDRAR, /** @type {any} */ (rad));
    return svar.created ? "skapad" : "finns";
  }

  return {
    sakerstallStandardkalender,

    /**
     * Går igenom alla grupper, en gång, och rapporterar. Ett fel på en grupp stoppar inte de andra.
     * @param {{ skarpt: boolean }} b
     * @returns {Promise<StandardkalenderRapport>}
     */
    async sakerstallAlla(b) {
      if (typeof b?.skarpt !== "boolean") throw new Error("sakerstallAlla: skarpt måste vara true eller false. Ett torrt steg som råkar skriva är inte torrt.");
      const grupper = await kalla.list(GRUPPER, {});
      /** @type {StandardkalenderRapport} */
      const rapport = { skarpt: b.skarpt, lasta: grupper.length, finns: 0, saknas: 0, skapade: 0, bara_arkiverade: [], fel: [] };
      for (const g of grupper) {
        const groupId = String(g?.id ?? "");
        try {
          const lage = await sakerstallStandardkalender({ groupId, skarpt: b.skarpt });
          if (lage === "finns") rapport.finns += 1;
          else if (lage === "bara_arkiverade") rapport.bara_arkiverade.push(groupId);
          else if (lage === "saknas") rapport.saknas += 1;
          else rapport.skapade += 1;
        } catch (e) {
          rapport.fel.push({ groupId, fel: e instanceof Error ? e.message : String(e) });
        }
      }
      return rapport;
    },
  };
}
