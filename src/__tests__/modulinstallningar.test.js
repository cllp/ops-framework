import { describe, expect, it } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createModulinstallningskalla } from "../data/modulinstallningskalla.js";
import { defineModule } from "../lib/modul.js";
import {
  byggInstallningsvarden,
  huvudmenyInom,
  installningarFor,
  installningsVarden,
  lasInstallningsvarden,
  modulinstallningsId,
  sattHuvudmeny,
  VISA_I_HUVUDMENYN,
} from "../lib/modulinstallningar.js";
import { modulinstallningsregelfragment } from "../lib/regler.js";

/**
 * Inställningar per modul och grupp (0.88.0).
 *
 * Pinnen är inte en rad i samlingen. En modul som deklarerar samma id, eller en
 * karta som försöker skriva den dit, faller. Mot koden före fältet är
 * `defineModule` med `installningar` röd: fältet var okänt och kastades.
 */

const BAS = () => ({
  id: "liv",
  namn: { sv: "Liv", en: "Life" },
  nav: [],
  routes: [],
  samlingar: [],
  kallor: {},
  skapar: [],
  hubb: null,
});

const FALT = {
  id: "visaklara",
  namn: { sv: "Visa klara", en: "Show done" },
  typ: "boolean",
  forval: false,
};

describe("manifestets installningar", () => {
  it("ett utelämnat fält är en tom lista", () => {
    expect(defineModule(BAS()).installningar).toEqual([]);
  });

  it("pinnens id är reserverat", () => {
    expect(() => defineModule({ ...BAS(), installningar: [{ ...FALT, id: VISA_I_HUVUDMENYN }] })).toThrow(/visaIHuvudmenyn/);
  });

  it("fel typ och ett okänt fält faller med fältets namn", () => {
    expect(() => defineModule({ ...BAS(), installningar: [{ ...FALT, typ: "tal" }] })).toThrow(/boolean eller text/);
    expect(() => defineModule({ ...BAS(), installningar: [{ ...FALT, farg: "rod" }] })).toThrow(/farg/);
  });
});

describe("pinnen och värdena", () => {
  const medKort = { id: "bibliotek", hubb: { rutt: "/bibliotek" }, installningar: [{ ...FALT, hem: "samling", hint: null }] };
  const utanKort = { id: "inkorg", hubb: null, installningar: [] };

  it("bara en modul med kort får pinnen, och den skrivs inte i samlingen", () => {
    expect(installningarFor(medKort).map((f) => f.id)).toEqual([VISA_I_HUVUDMENYN, "visaklara"]);
    expect(installningarFor(utanKort)).toEqual([]);
    expect(installningarFor(medKort)[0].hem).toBe("huvudmeny");
  });

  it("sattHuvudmeny rör inte de andra, och huvudmenyInom släpper en avinstallerad", () => {
    expect(sattHuvudmeny(["ekonomi"], "bibliotek", true)).toEqual(["ekonomi", "bibliotek"]);
    expect(sattHuvudmeny(["ekonomi", "bibliotek"], "bibliotek", true)).toEqual(["ekonomi", "bibliotek"]);
    expect(sattHuvudmeny(["ekonomi", "bibliotek"], "bibliotek", false)).toEqual(["ekonomi"]);
    expect(huvudmenyInom(["borta", "ekonomi"], ["ekonomi"])).toEqual(["ekonomi"]);
  });

  it("pinnen läses ur gruppen, och ett osparat fält får sitt förval", () => {
    const varden = installningsVarden({ modul: medKort, grupp: { huvudmeny: ["bibliotek"] }, sparade: null });
    expect(varden.visaIHuvudmenyn).toBe(true);
    expect(varden.visaklara).toBe(false);
  });

  it("samlingen tar inte emot pinnen, och en trasig lista säger varför", () => {
    expect(() => byggInstallningsvarden(medKort, { visaIHuvudmenyn: true })).toThrow(/groups\.huvudmeny/);
    expect(byggInstallningsvarden(medKort, { visaklara: true })).toEqual([{ id: "visaklara", typ: "boolean", bool: true, text: "" }]);
    expect(lasInstallningsvarden([{ id: "visaklara", typ: "boolean", bool: true, text: "" }])).toEqual({ varden: { visaklara: true } });
    expect(lasInstallningsvarden([{ id: VISA_I_HUVUDMENYN, typ: "boolean", bool: true, text: "" }])).toEqual({ fel: expect.stringContaining(VISA_I_HUVUDMENYN) });
    expect("fel" in lasInstallningsvarden([{ id: "a", typ: "boolean", bool: true, text: "" }, { id: "a", typ: "boolean", bool: false, text: "" }])).toBe(true);
  });
});

describe("källan", () => {
  const modul = { id: "bibliotek", installningar: [{ ...FALT, hem: "samling", hint: null }] };
  const person = () => ({ uid: "u1", namn: "Kim", typ: "manniska", kalla: "test" });

  it("utan konfiguration nämner fabriken sitt namn", () => {
    expect(() => createModulinstallningskalla()).toThrow(/createModulinstallningskalla/);
  });

  it("sparar och läser, och en andra sparning skriver över samma rad", async () => {
    const source = createMemorySource({});
    const kalla = createModulinstallningskalla({ source, collection: "modulinstallningar", groupId: "cps-ab", skapare: person });
    const id = modulinstallningsId("cps-ab", "bibliotek");
    expect(id).toBe("6~cps-ab~bibliotek");
    await kalla.spara(modul, { visaklara: true });
    await kalla.spara(modul, { visaklara: false });
    const las = await kalla.las();
    expect(las.fel).toBeNull();
    expect(las.trasiga).toEqual([]);
    expect(las.poster).toEqual([{ id, modulId: "bibliotek", varden: { visaklara: false } }]);
  });

  it("agenten skriver inte, och en trasig rad släcker inte de andra", async () => {
    const source = createMemorySource({});
    const kalla = createModulinstallningskalla({
      source,
      collection: "modulinstallningar",
      groupId: "cps-ab",
      skapare: () => ({ uid: "agenten", namn: "Agent", typ: "agent", kalla: "test" }),
    });
    await expect(kalla.spara(modul, { visaklara: true })).rejects.toThrow(/person/);
    await source.create("modulinstallningar", { id: "trasig", groupId: "cps-ab", modulId: "ekonomi", varden: "nej", uppdateradAv: {}, uppdaterad: 1 });
    const personKalla = createModulinstallningskalla({ source, collection: "modulinstallningar", groupId: "cps-ab", skapare: person });
    await personKalla.spara(modul, { visaklara: true });
    const las = await personKalla.las();
    expect(las.poster.map((p) => p.modulId)).toEqual(["bibliotek"]);
    expect(las.trasiga.length).toBe(1);
  });
});

describe("regelfragmentet", () => {
  const text = modulinstallningsregelfragment("modulinstallningar");

  it("nekar radering, rullar ut åtta poster och nämner pinnen", () => {
    expect(text).toContain("match /modulinstallningar/{id}");
    expect(text).toContain("allow delete: if false");
    expect(text).toContain("opsArAgare");
    expect(text).toContain('p.id != "visaIHuvudmenyn"');
    expect(text.match(/opsModulinstallningPost\(d\.varden\[/g)).toHaveLength(8);
  });

  it("ett samlingsnamn med snedstreck är en sökväg och kastas", () => {
    expect(() => modulinstallningsregelfragment("a/b")).toThrow(/snedstreck/);
  });
});
