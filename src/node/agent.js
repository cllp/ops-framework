import { agentId, agentMedlemskap, medlemskapsId } from "../lib/grupp.js";

/**
 * Gruppens agent på serversidan: ägarens strömbrytare och engångssteget som ger en befintlig grupp sin agent (lifehub.app#47).
 *
 * ⛔ BARA HÄR, INTE I HUVUDINGÅNGEN. `memberships` skrivs aldrig av en klient (#136), och samma skäl som för inbjudan:
 * en funktion som skriver medlemskap och ligger där en vy kan nå den är en dörr bredvid regeln `allow write: if false`.
 *
 * ⛔ INGEN TA BORT. Agenten tas inte bort av någon i appen, den stängs av (`avstangd`). Ett borttaget medlemskap hade
 * kommit tillbaka med nästa engångssteg, och då hade ägarens val varit en tillfällighet.
 *
 * @param {object} konfig
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla Admin SDK-källan.
 * @param {{ medlemskap?: string }} [konfig.samlingar]
 */
export function createAgentService(konfig) {
  const { kalla, samlingar = {} } = konfig ?? {};
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.create !== "function" || typeof kalla.update !== "function") {
    throw new Error("createAgentService: en datakälla med read, create och update krävs. Ramverket känner ingen databas.");
  }
  const MEDLEMSKAP = samlingar.medlemskap ?? "memberships";

  return {
    /**
     * Ägaren slår av eller på gruppens agent.
     *
     * @param {{ uid: string, groupId: string, status: "aktiv" | "avstangd" }} b `uid` ur anropets inloggning, aldrig ur indata.
     * @returns {Promise<{ status: "aktiv" | "avstangd" }>}
     */
    async satStatus(b) {
      const uid = typeof b?.uid === "string" ? b.uid : "";
      const groupId = typeof b?.groupId === "string" ? b.groupId : "";
      if (!uid) throw new Error("satStatus: uid krävs.");
      if (!groupId) throw new Error("satStatus: groupId krävs.");
      if (b.status !== "aktiv" && b.status !== "avstangd") {
        throw new Error(`satStatus: statusen "${b.status}" går inte att sätta. Agenten är aktiv eller avstangd, och den tas inte bort.`);
      }
      const jag = await kalla.read(MEDLEMSKAP, medlemskapsId(uid, groupId));
      if (!jag || jag.status !== "aktiv" || jag.roll !== "agare" || (jag.typ ?? "person") !== "person") {
        throw new Error("satStatus: bara ägaren kan stänga av eller slå på gruppens agent.");
      }
      const id = medlemskapsId(agentId(groupId), groupId);
      const rad = await kalla.read(MEDLEMSKAP, id);
      if (!rad || rad.typ !== "agent") {
        throw new Error(`satStatus: gruppen "${groupId}" har ingen agent. Engångssteget lägger till den, strömbrytaren gör det inte.`);
      }
      if (rad.status !== b.status) await kalla.update(MEDLEMSKAP, id, { status: b.status });
      return { status: b.status };
    },

    /**
     * Ger gruppen sin agent om den saknas. Idempotent: en grupp som har den, aktiv eller avstängd, rörs inte.
     *
     * @param {{ groupId: string, skarpt: boolean }} b `skarpt: false` läser bara.
     * @returns {Promise<"finns" | "saknas" | "skapad">} `saknas` bara torrt: så hade det skarpa steget skapat den.
     */
    async sakerstall(b) {
      if (typeof b?.skarpt !== "boolean") throw new Error("sakerstall: skarpt måste vara true eller false. Ett torrt steg som råkar skriva är inte torrt.");
      const rad = agentMedlemskap(b.groupId);
      if (await kalla.read(MEDLEMSKAP, rad.id)) return "finns";
      if (!b.skarpt) return "saknas";
      await kalla.create(MEDLEMSKAP, rad);
      return "skapad";
    },
  };
}
