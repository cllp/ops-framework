import { describe, it, expect } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { seedaKataloger } from "../node/katalog.js";
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
