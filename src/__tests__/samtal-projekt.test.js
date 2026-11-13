import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla, harProjekt, samtalsnotiser } from "../data/samtalskalla.js";
import { PROJEKTTAGGFORM } from "../lib/gast.js";
import { samtalsregelfragment } from "../lib/regler.js";
import { PROJEKTSAMTAL, SAMTALSSLAG, arDelatSamtal, byggSamtal, delaSamtalsnyckel, motpart, samtalsdeltagare, samtalsnyckel } from "../lib/samtal.js";

/**
 * Projektens chattar (0.215.0, cllp/lifehub.app#760 skiva 2): modellen, källan, notiserna och reglerna. CP sa kör på förslaget: "Varje projekt får en egen chatt ... Gruppens medlemmar
 * och projektets gäster är med. En gäst i projektet når bara den chatten och aldrig gruppens." Gästens halva provas i `gast-projekt.test.js`, reglerna mot emulatorn i
 * `rules/__tests__/projektchatt.test.mjs`.
 * ⛔ VARJE PROV HAR SETTS FALLA: mutationerna och utfallen står i rapporten (arbetsreglernas punkt 4).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const G = "g1";

describe("modellen: slaget projekt och nyckeln <grupp>|projekt|<tagg>", () => {
  it("nyckeln byggs ur gruppen och taggen, och läses tillbaka", () => {
    expect(SAMTALSSLAG).toContain("projekt");
    const sid = samtalsnyckel({ groupId: G, slag: "projekt", tagg: "koket" });
    expect(sid).toBe("g1|projekt|koket");
    expect(delaSamtalsnyckel(sid, G)).toEqual({ groupId: G, slag: "projekt", tagg: "koket" });
    expect(byggSamtal({ groupId: G, slag: "projekt", tagg: "koket", skapadAv: "u1", skapad: 5 })).toEqual({ id: sid, groupId: G, slag: "projekt", skapad: 5, skapadAv: "u1" });
  });

  it("⛔ en tagg utan form, deltagare, ett ämne eller en tagg på ett annat slag kastar", () => {
    const fel = ["", "Koket", "-koket", "koket-", "kök", "a b", "x".repeat(25), "a|b", undefined];
    expect(fel.length).toBeGreaterThanOrEqual(8);
    for (const tagg of fel) {
      expect(() => samtalsnyckel({ groupId: G, slag: "projekt", tagg }), String(tagg)).toThrow(/tagg/);
      expect(() => byggSamtal({ groupId: G, slag: "projekt", tagg, skapadAv: "u1" }), String(tagg)).toThrow(/tagg/);
    }
    expect(() => samtalsnyckel({ groupId: G, slag: "projekt", tagg: "koket", deltagare: ["a", "b"] })).toThrow(/deltagare/);
    expect(() => byggSamtal({ groupId: G, slag: "projekt", tagg: "koket", deltagare: ["a", "b"], skapadAv: "a" })).toThrow(/deltagare/);
    expect(() => samtalsnyckel({ groupId: G, slag: "projekt", tagg: "koket", amne: "a_x" })).toThrow(/ämne/);
    expect(() => samtalsnyckel({ groupId: G, slag: "grupp", tagg: "koket" })).toThrow(/tagg/);
    expect(() => byggSamtal({ groupId: G, slag: "grupp", tagg: "koket", skapadAv: "u1" })).toThrow(/tagg/);
  });

  it("⛔ ett uid som heter projekt kan inte ta en projektchatts nyckel, och en nyckel med fel tagg är inget samtal", () => {
    expect(() => samtalsnyckel({ groupId: G, slag: "personer", deltagare: [PROJEKTSAMTAL, "zed"] })).toThrow(/projekt/);
    expect(delaSamtalsnyckel("g1|projekt|Koket", G)).toBeNull();
    expect(delaSamtalsnyckel("g1|projekt|koket|x", G)).toBeNull();
    expect(delaSamtalsnyckel("g1|projekt", G)).toBeNull();
    // Ett par och gruppchatten läses som förut.
    expect(delaSamtalsnyckel("g1|a|b", G)).toEqual({ groupId: G, deltagare: ["a", "b"] });
    expect(delaSamtalsnyckel("g1|grupp", G)).toEqual({ groupId: G, slag: "grupp" });
  });

  it("ett rum för flera: alla medlemmar, ingen motpart, och arDelatSamtal säger ja bara för grupp och projekt", () => {
    const s = byggSamtal({ groupId: G, slag: "projekt", tagg: "koket", skapadAv: "u1" });
    const medlemmar = [{ userId: "u1" }, { userId: "u2" }, { userId: "u3" }];
    expect(samtalsdeltagare(s, medlemmar)).toHaveLength(3);
    expect(motpart(s, "u1")).toBeNull();
    expect(["grupp", "projekt"].map(arDelatSamtal)).toEqual([true, true]);
    expect(["personer", "agent", undefined].map(arDelatSamtal)).toEqual([false, false, false]);
  });
});

describe("källan: projektets chatt med projekt: true", () => {
  /** @param {Record<string, any[]>} [seed] @param {Record<string, unknown>} [extra] */
  const kalla = (seed = {}, extra = { projekt: true }) => createSamtalskalla({ kalla: createMemorySource(seed), ...extra });

  it("utan projekt: ingen oppnaProjekt, och listan frågar inte efter projektens chattar", async () => {
    const k = kalla({ samtal: [{ id: "g1|projekt|koket", groupId: G, slag: "projekt", skapad: 1, skapadAv: "u1" }] }, {});
    expect(harProjekt(k)).toBe(false);
    expect(/** @type {any} */ (k).oppnaProjekt).toBeUndefined();
    expect(await k.lista({ groupId: G, uid: "u1" })).toEqual([]);
    expect(() => createSamtalskalla({ kalla: createMemorySource({}), projekt: /** @type {any} */ ("ja") })).toThrow(/projekt/);
  });

  it("oppnaProjekt skapar en gång och ger samma samtal igen; listan har det", async () => {
    const k = kalla();
    expect(harProjekt(k)).toBe(true);
    const a = await /** @type {any} */ (k).oppnaProjekt({ groupId: G, uid: "u1", tagg: "koket" });
    const b = await /** @type {any} */ (k).oppnaProjekt({ groupId: G, uid: "u2", tagg: "koket" });
    expect(a.id).toBe("g1|projekt|koket");
    expect(b).toMatchObject({ id: a.id, skapadAv: "u1" });
    expect((await k.lista({ groupId: G, uid: "u2" })).map((s) => s.id)).toEqual(["g1|projekt|koket"]);
    await expect(/** @type {any} */ (k).oppnaProjekt({ groupId: G, uid: "u1", tagg: "Koket" })).rejects.toThrow(/tagg/);
  });

  it("⛔ inkorgen visar en projektchatt först när den har ett meddelande, och en annan grupps syns aldrig", async () => {
    const k = kalla({
      samtal: [
        { id: "g1|projekt|koket", groupId: G, slag: "projekt", skapad: 1, skapadAv: "u1" },
        { id: "g1|projekt|badrum", groupId: G, slag: "projekt", skapad: 1, skapadAv: "u1" },
        { id: "g2|projekt|koket", groupId: "g2", slag: "projekt", skapad: 1, skapadAv: "u9" },
      ],
      "samtal/g1|projekt|badrum/meddelanden": [{ id: "m1", text: "Kakel", av: "u2", tid: 10 }],
      "samtal/g2|projekt|koket/meddelanden": [{ id: "m1", text: "Annan grupp", av: "u9", tid: 10 }],
    });
    const rader = await k.oversikt({ groupId: G, uid: "u1" });
    expect(rader.map((r) => [r.samtal.id, r.olasta])).toEqual([["g1|projekt|badrum", 1]]);
    await k.skicka("g1|projekt|koket", { text: "Första", av: "u1" });
    expect((await k.oversikt({ groupId: G, uid: "u1" })).map((r) => r.samtal.id).sort()).toEqual(["g1|projekt|badrum", "g1|projekt|koket"]);
  });
});

describe("notiserna: en projektchatt är ett rum för flera, som gruppchatten", () => {
  const medlemmar = [{ userId: "u1", typ: "person", status: "aktiv" }, { userId: "u2", typ: "person", status: "aktiv" }];
  const kallan = () =>
    createSamtalskalla({
      kalla: createMemorySource({
        samtal: [{ id: "g1|projekt|koket", groupId: G, slag: "projekt", skapad: 1, skapadAv: "u2" }],
        "samtal/g1|projekt|koket/meddelanden": [
          { id: "m1", text: "Hej alla", av: "u2", tid: 10 },
          { id: "m2", text: "@Ulla titta", av: "u2", tid: 11, namner: ["u1"] },
        ],
      }),
      projekt: true,
      omnamnanden: true,
    });

  it("⛔ inget meddelande blir en notis av sig självt, bara ett omnämnande, med projektets ord", async () => {
    const notiser = await samtalsnotiser({ samtal: kallan(), uid: "u1", namnFor: (u) => (u === "u2" ? "Bo" : u), medlemmar })({ groupId: G });
    expect(notiser).toEqual([{ id: "g1|projekt|koket|m2", titel: "Bo nämnde dig i projektets chatt", text: "@Ulla titta", prio: "normal" }]);
  });
  it("utan medlemmar: ingen notis alls, inte heller en per meddelande", async () => {
    expect(await samtalsnotiser({ samtal: kallan(), uid: "u1", namnFor: () => "Bo" })({ groupId: G })).toEqual([]);
  });
});

describe("reglerna: projekt: true släpper in projektets chatt, utan den är texten densamma", () => {
  it("⛔ utan projekt är texten byte för byte den förra (fixturen för 0.67.0), och projekt: true lägger till läsningen och nyckeln", () => {
    const gammal = fs.readFileSync(path.resolve(__dirname, "..", "..", "rules", "__fixturer__", "samtalsregelfragment-0.67.0.rules"), "utf8");
    expect(gammal.length).toBeGreaterThan(3000);
    expect(samtalsregelfragment()).toBe(gammal);
    expect(samtalsregelfragment()).not.toContain("projekt");
    const med = samtalsregelfragment({ projekt: true });
    expect(med).toContain("s.slag == 'grupp' || s.slag == 'projekt' || request.auth.uid in s.deltagare");
    expect(med).toContain("sid == d.groupId + '|projekt|' + sid.split('[|]')[2]");
    // Taggens form har ETT hem: regeln bär ramverkets uttryck utan ankare.
    expect(med).toContain(`.matches('${PROJEKTTAGGFORM.source.slice(1, -1)}')`);
    expect(() => samtalsregelfragment({ projekt: /** @type {any} */ ("ja") })).toThrow(/projekt/);
  });
});
