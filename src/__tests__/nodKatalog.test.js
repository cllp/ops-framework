import { describe, it, expect } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { bakfyllKatalogGrupp, seedaKataloger } from "../node/katalog.js";
import { createCatalogSource } from "../data/katalogkalla.js";

/**
 * `seedaKataloger` (#161, #162): seedningen vid `skapaGrupp`.
 *
 * ⛔ SIGNATUREN ÄR DEN SOM `skapaGrupp` (annan agent, #161) ANROPAR MED, SÅ
 * DEN ÄR HELIG HÄR: `seedaKataloger({ kalla, groupId, standardvarden })`.
 * Ändras den utan att båda sidor ändras samtidigt, kraschar sammanslagningen
 * med ett meddelande som pekar hit.
 */

const IKONER = ["check", "bell"];
const HANDELSETYPER = [
  { id: "rep", namn: { sv: "Repetition", en: "Rehearsal" }, farg: 1, ikon: "check", fas: "aktiv", ordning: 0 },
  { id: "spelning", namn: { sv: "Spelning", en: "Show" }, farg: 2, ikon: "bell", fas: "aktiv", ordning: 1 },
];
const SORTER = [{ id: "arende", namn: { sv: "Ärende" }, ikon: "check" }];

describe("seedaKataloger, kraven på anropet", () => {
  it("kräver en datakälla", async () => {
    await expect(seedaKataloger(/** @type {any} */ (undefined))).rejects.toThrow(/seedaKataloger: en datakälla/);
    await expect(seedaKataloger({ groupId: "cps-ab", standardvarden: { x: HANDELSETYPER } })).rejects.toThrow(/en datakälla/);
  });

  it("kräver groupId", async () => {
    const kalla = createMemorySource({});
    await expect(seedaKataloger({ kalla, standardvarden: { handelsetyper: HANDELSETYPER } })).rejects.toThrow(/groupId krävs/);
    await expect(seedaKataloger({ kalla, groupId: "  ", standardvarden: { handelsetyper: HANDELSETYPER } })).rejects.toThrow(/groupId krävs/);
  });

  it("kräver standardvarden, som ett objekt och inte en lista", async () => {
    const kalla = createMemorySource({});
    await expect(seedaKataloger({ kalla, groupId: "cps-ab" })).rejects.toThrow(/standardvarden krävs/);
    await expect(seedaKataloger({ kalla, groupId: "cps-ab", standardvarden: [] })).rejects.toThrow(/standardvarden krävs/);
  });

  it("⛔ ett tomt standardvarden-objekt är rött, inte tyst ingenting", () => {
    // En app utan kataloger anropar inte funktionen alls. Ett tomt objekt ser
    // annars ut som ett medvetet val i stället för ett missat register.
    const kalla = createMemorySource({});
    return expect(seedaKataloger({ kalla, groupId: "cps-ab", standardvarden: {} })).rejects.toThrow(/standardvarden är tomt/);
  });
});

describe("seedaKataloger, seedningen själv", () => {
  it("seedar en katalog med bara en lista rader (kortformen)", async () => {
    const kalla = createMemorySource({});
    const svar = await seedaKataloger({ kalla, groupId: "cps-ab", standardvarden: { handelsetyper: HANDELSETYPER } });
    expect(svar).toEqual({ handelsetyper: { seedade: true, antal: 2 } });
  });

  it("seedar en katalog med sin fulla konfiguration (ikoner, faser av)", async () => {
    const kalla = createMemorySource({});
    const svar = await seedaKataloger({
      kalla,
      groupId: "cps-ab",
      standardvarden: { sorter: { standard: SORTER, ikoner: IKONER, faser: false, farger: false } },
    });
    expect(svar).toEqual({ sorter: { seedade: true, antal: 1 } });
  });

  it("seedar FLERA kataloger i samma anrop, en rad per katalog i svaret", async () => {
    const kalla = createMemorySource({});
    const svar = await seedaKataloger({
      kalla,
      groupId: "cps-ab",
      standardvarden: {
        handelsetyper: HANDELSETYPER,
        sorter: { standard: SORTER, ikoner: IKONER, faser: false, farger: false },
      },
    });
    expect(svar).toEqual({
      handelsetyper: { seedade: true, antal: 2 },
      sorter: { seedade: true, antal: 1 },
    });
  });

  it("⛔ rör aldrig en katalog som redan har värden FÖR DEN HÄR GRUPPEN, precis som createCatalogSource.seeda()", async () => {
    const kalla = createMemorySource({ handelsetyper: [{ ...HANDELSETYPER[0], groupId: "cps-ab", arkiverad: true }] });
    const svar = await seedaKataloger({ kalla, groupId: "cps-ab", standardvarden: { handelsetyper: HANDELSETYPER } });
    expect(svar.handelsetyper).toEqual({ seedade: false, antal: 1, orsak: "samlingen har redan värden för den här gruppen" });
  });

  it("⛔ en katalog utan standardvärden säger det, i stället för att låtsas ha seedat", async () => {
    const kalla = createMemorySource({});
    const svar = await seedaKataloger({ kalla, groupId: "cps-ab", standardvarden: { handelsetyper: [] } });
    expect(svar.handelsetyper).toEqual({ seedade: false, antal: 0, orsak: "inga standardvärden att skriva" });
  });
});

describe("⛔ #162: skrivet ur seedaKataloger går att läsa via createCatalogSource för SAMMA grupp, inte för en annan", () => {
  it("gruppen som seedades ser sina egna standardvärden innan första vyn ritas", async () => {
    // ⛔ Det här är själva klarkriteriet i #162: "En nyskapad grupp har appens
    // standardvärden på plats innan första vyn ritas". Provat mot MINNESKÄLLAN
    // (emulatorprovet i rules/__tests__ är den andra halvan).
    const kalla = createMemorySource({});
    await seedaKataloger({ kalla, groupId: "cps-ab", standardvarden: { handelsetyper: HANDELSETYPER } });

    const cpsAb = createCatalogSource({ source: kalla, collection: "handelsetyper", groupId: "cps-ab", standard: HANDELSETYPER, ikoner: IKONER });
    const svar = await cpsAb.las();
    expect(svar.kalla).toBe("databas");
    expect(svar.kategorier.map((k) => k.id)).toEqual(["rep", "spelning"]);
    expect(svar.kategorier.every((k) => k.groupId === "cps-ab")).toBe(true);
  });

  it("⛔ en ANNAN grupp ser inte den seedade gruppens rader", async () => {
    const kalla = createMemorySource({});
    await seedaKataloger({ kalla, groupId: "cps-ab", standardvarden: { handelsetyper: HANDELSETYPER } });

    const mirandaAb = createCatalogSource({ source: kalla, collection: "handelsetyper", groupId: "miranda-ab", standard: HANDELSETYPER, ikoner: IKONER });
    const svar = await mirandaAb.las();
    // ⛔ Tom, inte reserv: samlingen svarar, den har bara inget FÖR DEN HÄR
    // gruppen. miranda ab måste seedas för sig, precis som cps ab gjorde.
    expect(svar.kalla).toBe("databas");
    expect(svar.kategorier).toEqual([]);
  });
});

/*
 * ══ ⛔ BAKFYLLNADEN (0.33.0, #162) ═══════════════════════════════════════
 *
 * Mot en attrapp av bolag-ops läge 2026-09-30: katalograder UTAN groupId, skrivna
 * innan katalogerna blev gruppernas, med kategorins id som dokumentnyckel. Plus
 * en privat grupp skapad med 0.32.x, som saknar kataloger helt.
 */
describe("⛔ bakfyllKatalogGrupp", () => {
  const SAMLINGAR = { handelsetyper: { standard: HANDELSETYPER, ikoner: IKONER }, sorter: { standard: SORTER, faser: false, farger: false } };
  const attrapp = () =>
    createMemorySource({
      groups: [{ id: "cps-ab" }, { id: "privat-x1" }],
      handelsetyper: [
        // CP har döpt om "rep" i inställningsvyn: bakfyllnaden får inte ersätta den med standardvärdet.
        { id: "rep", namn: { sv: "Repetition (CP:s namn)" }, farg: 1, ikon: "check", fas: "aktiv", ordning: 0, arkiverad: false, texter: {} },
        { id: "spelning", namn: { sv: "Spelning" }, farg: 2, ikon: "bell", fas: "aktiv", ordning: 1, arkiverad: false, texter: {} },
      ],
      sorter: [{ id: "arende", namn: { sv: "Ärende" }, ikon: "check", ordning: 0, arkiverad: false, texter: {} }],
    });

  it("⛔ TORRKÖRNING ÄR FÖRVAL: svaret är planen, och ingenting skrivs", async () => {
    const kalla = attrapp();
    const fore = JSON.stringify(await kalla.list("handelsetyper"));
    const svar = await bakfyllKatalogGrupp({ kalla, samlingar: SAMLINGAR, groupId: "cps-ab" });
    expect(svar.torr).toBe(true);
    expect(svar.flyttade).toEqual({ handelsetyper: 2, sorter: 1 });
    expect(svar.seedade).toEqual({ handelsetyper: { "privat-x1": 2 }, sorter: { "privat-x1": 1 } });
    expect(svar.kvarUtanGrupp).toEqual({ handelsetyper: 2, sorter: 1 });
    expect(svar.fel).toEqual([]);
    expect(svar.skrivningar).toBe(2 * 3 + 3);
    expect(JSON.stringify(await kalla.list("handelsetyper"))).toBe(fore);
  });

  it("skarp körning: raderna får groupId och nyckeln groupId|id, de gamla tas bort, CP:s ändringar står kvar", async () => {
    const kalla = attrapp();
    const svar = await bakfyllKatalogGrupp({ kalla, samlingar: SAMLINGAR, groupId: "cps-ab", torr: false });
    expect(svar.fel).toEqual([]);
    expect(svar.kvarUtanGrupp).toEqual({ handelsetyper: 0, sorter: 0 });
    const cps = await createCatalogSource({ source: kalla, collection: "handelsetyper", groupId: "cps-ab", standard: HANDELSETYPER, ikoner: IKONER }).las();
    expect(cps.kalla).toBe("databas");
    expect(cps.utanGrupp).toBe(0);
    expect(cps.kategorier.find((k) => k.id === "rep")?.namn.sv).toBe("Repetition (CP:s namn)");
    const nycklar = (await kalla.list("handelsetyper")).map((r) => r.id).sort();
    expect(nycklar).toEqual(["cps-ab|rep", "cps-ab|spelning", "privat-x1|rep", "privat-x1|spelning"]);
  });

  it("⛔ en grupp som saknade kataloger (skapad med 0.32.x) får standardvärdena, och bara de", async () => {
    const kalla = attrapp();
    await bakfyllKatalogGrupp({ kalla, samlingar: SAMLINGAR, groupId: "cps-ab", torr: false });
    const privat = await createCatalogSource({ source: kalla, collection: "handelsetyper", groupId: "privat-x1", standard: HANDELSETYPER, ikoner: IKONER }).las();
    expect(privat.kategorier.map((k) => k.namn.sv)).toEqual(["Repetition", "Spelning"]);
  });

  it("⛔ OMKÖRBAR: en andra skarp körning hittar ingenting och svarar med nollor", async () => {
    const kalla = attrapp();
    await bakfyllKatalogGrupp({ kalla, samlingar: SAMLINGAR, groupId: "cps-ab", torr: false });
    const andra = await bakfyllKatalogGrupp({ kalla, samlingar: SAMLINGAR, groupId: "cps-ab", torr: false });
    expect(andra.flyttade).toEqual({ handelsetyper: 0, sorter: 0 });
    expect(andra.seedade).toEqual({ handelsetyper: {}, sorter: {} });
    expect(andra.skrivningar).toBe(0);
    expect(andra.fel).toEqual([]);
  });

  it("⛔ en rad som inte går att bygga stoppar ALLT, också det som gick att flytta", async () => {
    const kalla = attrapp();
    await kalla.create("handelsetyper", { id: "trasig", namn: { sv: "Trasig" }, farg: 99, ikon: "check", fas: "aktiv" });
    const svar = await bakfyllKatalogGrupp({ kalla, samlingar: SAMLINGAR, groupId: "cps-ab", torr: false });
    expect(svar.fel.join(" ")).toMatch(/handelsetyper\/trasig.*palettplats/);
    expect(svar.kvarUtanGrupp.handelsetyper).toBe(3);
    expect((await kalla.list("handelsetyper")).every((r) => !r.groupId)).toBe(true);
  });

  it("⛔ en konflikt skrivs aldrig över: finns groupId|id redan, står det i fel och ingenting skrivs", async () => {
    const kalla = attrapp();
    await kalla.create("handelsetyper", { id: "cps-ab|rep", groupId: "cps-ab", namn: { sv: "Redan sparad" }, farg: 1, ikon: "check", fas: "aktiv", ordning: 0, arkiverad: false, texter: {} });
    const svar = await bakfyllKatalogGrupp({ kalla, samlingar: SAMLINGAR, groupId: "cps-ab", torr: false });
    expect(svar.fel.join(" ")).toMatch(/cps-ab\|rep finns redan/);
    expect((await kalla.read("handelsetyper", "cps-ab|rep"))?.namn.sv).toBe("Redan sparad");
    expect(await kalla.read("handelsetyper", "rep")).toBeTruthy();
  });

  it("kräver batch, ett groupId med id-form och minst en samling", async () => {
    const kalla = attrapp();
    await expect(bakfyllKatalogGrupp({ kalla: /** @type {any} */ ({ ...kalla, batch: undefined }), samlingar: SAMLINGAR, groupId: "cps-ab" })).rejects.toThrow(/batch/);
    await expect(bakfyllKatalogGrupp({ kalla, samlingar: SAMLINGAR, groupId: "" })).rejects.toThrow(/groupId krävs/);
    await expect(bakfyllKatalogGrupp({ kalla, samlingar: {}, groupId: "cps-ab" })).rejects.toThrow(/samlingar krävs/);
  });
});
