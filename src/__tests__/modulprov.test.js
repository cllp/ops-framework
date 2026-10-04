import { describe, expect, it } from "vitest";
import { paminnelser } from "../../examples/paminnelser/index.js";
import { KALLTYPER } from "../lib/modul.js";
import { TYPYTOR } from "../lib/modultyper.js";
import { GRUPPDATAYTOR, PROV_FRAMMANDE_GRUPP, provaModul, provrapport } from "../lib/modulprov.js";

/*
 * Modulens provsats (0.56.0, #244). Det en agent kör för att bevisa att en ny modul passar, och det granskaren kör för att
 * se samma sak. Proven mäter att den fäller det den ska fälla och släpper igenom en riktig modul.
 */

/** @param {Record<string, any>} [over] */
const manifest = (over = {}) => ({
  id: "prov",
  namn: { sv: "Prov", en: "Test" },
  nav: [],
  routes: [],
  samlingar: [],
  kallor: {},
  skapar: [],
  hubb: null,
  ...over,
});

describe("provaModul", () => {
  it("⛔ exempelmodulen går igenom, och varje steg står med (golv: ett per yta och källa)", async () => {
    const svar = await provaModul(paminnelser, { groupId: "bolaget" });
    expect(svar.ok).toBe(true);
    expect(svar.steg.length).toBe(1 + 2 * KALLTYPER.length + TYPYTOR.length);
    // Hjälpen frågas för modulens egen route, och exemplet svarar där.
    expect(svar.steg.find((s) => s.namn === "källan hjalp")?.text).toMatch(/^1 rad /);
  });

  it("⛔ en källa som inte filtrerar på gruppen faller", async () => {
    const lackande = manifest({ kallor: { handelser: async () => [{ id: "a", title: "Någon annans", daysLeft: 1 }] } });
    const svar = await provaModul(lackande, { groupId: "g1" });
    expect(svar.ok).toBe(false);
    expect(svar.steg.find((s) => s.namn === "källan handelser, en annan grupp")).toMatchObject({ ok: false, text: expect.stringContaining(PROV_FRAMMANDE_GRUPP) });
  });

  it("⛔ en rad registret avvisar faller, med registrets eget besked", async () => {
    const trasig = manifest({ kallor: { handelser: async ({ groupId }) => (groupId === "g1" ? [{ title: "Utan id" }] : []) } });
    const svar = await provaModul(trasig, { groupId: "g1" });
    expect(svar.ok).toBe(false);
    expect(svar.steg.find((s) => s.namn === "källan handelser")?.ok).toBe(false);
  });

  it("⛔ ett manifest som inte håller stoppar provet vid första steget", async () => {
    const svar = await provaModul(manifest({ namn: "Bara en sträng" }), { groupId: "g1" });
    expect(svar).toMatchObject({ ok: false, steg: [{ namn: "manifestet", ok: false }] });
  });

  it("tomt är ett svar: en källa med noll rader går igenom och säger 0 rader", async () => {
    const tom = manifest({ kallor: { handelser: async () => [] } });
    const svar = await provaModul(tom, { groupId: "g1" });
    expect(svar.ok).toBe(true);
    expect(svar.steg.find((s) => s.namn === "källan handelser")?.text).toMatch(/^0 rader/);
    expect(svar.steg.find((s) => s.namn === "källan sok")?.text).toBe("fyller inte ytan");
  });

  it("gruppkravet gäller bara ytorna som bär gruppens data", () => {
    expect([...GRUPPDATAYTOR]).toEqual(["handelser", "sok", "notiser"]);
    expect(GRUPPDATAYTOR.every((y) => KALLTYPER.includes(y))).toBe(true);
  });

  it("rapporten skriver ut varje steg och säger hur många som föll", async () => {
    const svar = await provaModul(manifest({ kallor: { handelser: async () => [{ id: "a", title: "x", daysLeft: 1 }] } }), { groupId: "g1" });
    const text = provrapport(svar);
    expect(text.split("\n")).toHaveLength(svar.steg.length + 1);
    expect(text).toMatch(/1 av \d+ steg föll/);
  });

  it("groupId krävs", async () => {
    await expect(provaModul(manifest(), /** @type {any} */ ({}))).rejects.toThrow(/groupId krävs/);
  });
});
