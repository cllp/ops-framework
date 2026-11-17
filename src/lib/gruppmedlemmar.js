/**
 * Medlemsantal, avatarer och medlemslista för EN grupp, härledda ur dess medlemskap (0.32.0, #180 G2).
 *
 * ══ ⛔ ETT ANTAL LAGRAS ALDRIG, DET HÄRLEDS (arbetsreglernas punkt 2) ═══════════════════════════════════════
 *
 * Gruppkortet visar "3 medlemmar" och en avatarrad. En kolumn `medlemsantal` på `groups` hade varit en spegel av `memberships`, och
 * en spegel glider: någon lämnar gruppen och siffran står kvar. Läser appen i stället medlemskapen per grupp (regeln tillåter det för
 * medlemmar sedan 0.32.0) räknas allt HÄR, av samma rader som medlemslistan ritas ur. Appen behöver bara lista `memberships` där
 * `groupId` är gruppens, eller alla sina och låta `groupId` här välja.
 *
 * ⛔ BARA AKTIVA. Ett avslutat medlemskap är historik (`MEDLEMSSTATUS`), inte en medlem, och räknas varken i antalet eller i avatarerna.
 * ⛔ ORDNINGEN ÄR ÄGARE, ADMIN, MEDLEM och därefter namn: avatarraden och listan visar de som förvaltar gruppen först, som SS medlemslista.
 * ⛔ FILEN ÄR REN och ligger därför i båda ingångarna: en Cloud Function som svarar med kortets siffror ska inte dra in React.
 */

/** Ordningen rollerna sorteras i. */
const ROLLORDNING = /** @type {Record<string, number>} */ ({ agare: 0, admin: 1, medlem: 2 });

/**
 * @typedef {object} Gruppmedlem
 * @property {string} id Personens uid, samma som `OpsIdentity seed`.
 * @property {string} namn Ur medlemskapets denormaliserade `namn` (#138). Tom sträng om det saknas.
 * @property {string} bild Ur medlemskapets `bild`, eller tom sträng.
 * @property {string} [epost] Ur medlemskapets `epost` (0.234.0, cllp/lifehub.app#861). `medlemsinfo` sätter den alltid, tom sträng när adressen saknas; valfri så att en app som bygger raden själv inte måste ha den. Visas när namnet saknas (`personnamn`).
 * @property {"agare"|"admin"|"medlem"} roll
 */

/**
 * @typedef {object} Medlemsinfo
 * @property {number} medlemsantal Aktiva medlemmar. `0` är ett svar (tom grupp), aldrig utelämnat.
 * @property {ReadonlyArray<{ id: string, namn: string, bild: string, epost?: string }>} avatarer ALLA aktiva medlemmar i ordning. Kortet ritar de fyra första och "+N", så N går att räkna ur listan.
 * @property {ReadonlyArray<Gruppmedlem>} medlemmar Samma personer med roll, för medlemslistan.
 * @property {ReadonlyArray<Gruppagent>} agenter Gruppens agenter, aktiva och avstängda (lifehub.app#47). Tom lista när det inte finns någon.
 */

/**
 * @typedef {object} Gruppagent
 * @property {string} id Agentens userId, `agentId(groupId)` för gruppens egen.
 * @property {string} namn
 * @property {"aktiv"|"avstangd"} status
 */

/**
 * @param {ReadonlyArray<{ userId?: string, groupId?: string, roll?: string, typ?: string, status?: string, namn?: string, bild?: string, epost?: string }>} medlemskap Rader ur `memberships`.
 * @param {string} [groupId] Bara den här gruppens rader. Utelämnad: alla rader räknas som EN grupp, alltså anropas funktionen med en grupps rader.
 * @returns {Medlemsinfo}
 */
export function medlemsinfo(medlemskap, groupId) {
  if (!Array.isArray(medlemskap)) {
    throw new Error(`medlemsinfo: medlemskap måste vara en lista rader ur memberships, inte ${typeof medlemskap}.`);
  }
  /** @type {Gruppmedlem[]} */
  const medlemmar = [];
  /** @type {Gruppagent[]} */
  const agenter = [];
  const sedda = new Set();
  for (const m of medlemskap) {
    if (!m || typeof m.userId !== "string" || m.userId === "") continue;
    if (groupId !== undefined && m.groupId !== groupId) continue;
    /*
     * ⛔ AGENTEN ÄR INTE EN AV PERSONERNA (lifehub.app#47). Kortets "3 medlemmar" och avatarraden räknar människor, och
     * en agent i varje grupp hade lagt en robot och en etta till allihop. Den står i `agenter`, också avstängd: annars
     * försvinner den ur listan i samma stund som ägaren stänger av den, och då går den inte att slå på igen.
     */
    if (m.typ === "agent") {
      if ((m.status === "aktiv" || m.status === "avstangd") && !sedda.has(m.userId)) {
        sedda.add(m.userId);
        agenter.push({ id: m.userId, namn: typeof m.namn === "string" ? m.namn : "", status: m.status });
      }
      continue;
    }
    if ((m.status ?? "aktiv") !== "aktiv") continue;
    // Samma person två gånger är samma medlem (nyckeln är härledd, men en lista kan ha slagits ihop av två frågor).
    if (sedda.has(m.userId)) continue;
    sedda.add(m.userId);
    const roll = m.roll === "agare" || m.roll === "admin" ? m.roll : "medlem";
    /*
     * ⛔ ADRESSEN FÖLJER MED (0.234.0, cllp/lifehub.app#861). CP 2026-11-16: "Det får ALDRIG stå namn saknas. Det måste
     * alltid finnas en fallback på eposten." Kortet och listan ritar med `personnamn`, som visar adressen när namnet saknas,
     * och då måste adressen finnas på raden de ritar ur.
     */
    medlemmar.push({ id: m.userId, namn: typeof m.namn === "string" ? m.namn : "", bild: typeof m.bild === "string" ? m.bild : "", epost: typeof m.epost === "string" ? m.epost : "", roll });
  }
  // Sorteras på det som visas: namnet, annars adressen (0.234.0). En rad utan namn hamnar inte först bara för att "" sorteras före "A".
  medlemmar.sort((a, b) => ROLLORDNING[a.roll] - ROLLORDNING[b.roll] || (a.namn || a.epost || "").localeCompare(b.namn || b.epost || "", "sv") || a.id.localeCompare(b.id));
  return Object.freeze({
    medlemsantal: medlemmar.length,
    avatarer: Object.freeze(medlemmar.map(({ id, namn, bild, epost }) => ({ id, namn, bild, epost }))),
    medlemmar: Object.freeze(medlemmar),
    agenter: Object.freeze(agenter.sort((a, b) => a.id.localeCompare(b.id))),
  });
}
