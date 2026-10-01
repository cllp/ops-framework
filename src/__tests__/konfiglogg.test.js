import { describe, it, expect, vi } from "vitest";
import { KONFIGHANDELSER, KONFIGLOGGFALT, beskrivKonfigandring, byggKonfigandring, createConfigLog } from "../lib/konfiglogg.js";

/**
 * Ändringsloggen för konfiguration (#113).
 *
 * ⛔ TVÅ EGENSKAPER BÄR HELA MODULEN, och båda är lätta att tappa utan att
 * något ser trasigt ut: att `fore` finns, och att skrivaren aldrig kan sänka
 * det den loggar. En logg utan `fore` ser fortfarande ut som en logg.
 */

const FORE = { id: "uppgift", namn: { sv: "Uppgifter", en: "Tasks" } };
const EFTER = { id: "uppgift", namn: { sv: "Ärenden", en: "Cases" } };
const NU = () => "2026-09-26T08:00:00.000Z";
const GRUPP = "cps-ab";

describe("loggraden", () => {
  it("bär fore, efter, när och av", () => {
    const rad = byggKonfigandring({ handelse: "andrad", groupId: GRUPP, id: "uppgift", fore: FORE, efter: EFTER, av: { uid: "u1", namn: "CP" }, nu: NU });
    expect(rad).toEqual({
      handelse: "andrad",
      kategori: "uppgift",
      fore: FORE,
      efter: EFTER,
      nar: "2026-09-26T08:00:00.000Z",
      av: { uid: "u1", namn: "CP" },
      groupId: GRUPP,
    });
  });

  it("⛔ kastar utan fore, eftersom en rad utan det är en notis och inte ett spår", () => {
    expect(() => byggKonfigandring({ handelse: "andrad", groupId: GRUPP, id: "uppgift", efter: EFTER })).toThrow(/vad som stod förut/);
    expect(() => byggKonfigandring({ handelse: "arkiverad", groupId: GRUPP, id: "uppgift" })).toThrow(/fore krävs/);
  });

  it("⛔ en nytillagd har inget före, och då står det null och inte tomt", () => {
    // De två betyder olika saker: null är "fanns inte", tom sträng är "hette
    // ingenting". Den skillnaden syns i loggen.
    const rad = byggKonfigandring({ handelse: "tillagd", groupId: GRUPP, id: "resa", efter: { id: "resa", namn: { sv: "Resor" } }, nu: NU });
    expect(rad.fore).toBeNull();
  });

  it("kastar på en okänd händelse i stället för att skriva den vidare", () => {
    expect(() => byggKonfigandring({ handelse: "raderad", groupId: GRUPP, id: "x", fore: FORE })).toThrow(/okänd handelse/);
    expect([...KONFIGHANDELSER]).toEqual(["tillagd", "andrad", "arkiverad", "framtagen"]);
  });

  it("kastar utan id, eftersom raden annars inte går att söka i", () => {
    expect(() => byggKonfigandring({ handelse: "tillagd", groupId: GRUPP })).toThrow(/id krävs/);
  });

  it("⛔ kastar utan groupId, och ett tomt eller blankt groupId räknas som saknat (#188)", () => {
    // Händelsen: en admin i en annan grupp sparade en kategori och loggraden nekades, eftersom raden inte bar någon
    // grupp som regeln kunde slå upp. Ett tyst förval hade varit samma hål: raden skriven, men åt fel grupp.
    expect(() => byggKonfigandring({ handelse: "tillagd", id: "resa", efter: {} })).toThrow(/groupId krävs/);
    expect(() => byggKonfigandring({ handelse: "tillagd", id: "resa", groupId: "", efter: {} })).toThrow(/groupId krävs/);
    expect(() => byggKonfigandring({ handelse: "tillagd", id: "resa", groupId: "   ", efter: {} })).toThrow(/groupId krävs/);
    expect(() => byggKonfigandring({ handelse: "tillagd", id: "resa", groupId: 7, efter: {} })).toThrow(/groupId krävs/);
  });

  it("⛔ raden bär kategorin som `kategori` och INGET `id`, annars blir dokument-id:t kategori-id:t (#188)", () => {
    // Datakällan tar fältet `id` som dokumentets nyckel. Med kategori-id som `id` blir andra ändringen av samma kategori
    // en uppdatering av första, och loggen är stängd för uppdateringar. Mätt mot emulatorn i rules/__tests__/konfiglogg.test.mjs.
    const rad = byggKonfigandring({ handelse: "andrad", groupId: GRUPP, id: "uppgift", fore: FORE, efter: EFTER, nu: NU });
    expect(rad.kategori).toBe("uppgift");
    expect("id" in rad).toBe(false);
  });

  it("⛔ en GAMMAL rad (dokument-id = kategori-id, inget kategori-fält) beskrivs som förut", () => {
    // Raderna som skrevs före 0.39.0 har inget `kategori`: `id` är dokument-id:t, och det ÄR kategori-id:t.
    const gammal = { id: "uppgift", handelse: "arkiverad", fore: null, efter: null, nar: "2026-09-26T08:00:00.000Z", av: null };
    // @ts-expect-error: en rad utan kategori och groupId är just vad en gammal rad är
    expect(beskrivKonfigandring(gammal)).toBe("uppgift arkiverades");
  });

  it("⛔ raden bär exakt KONFIGLOGGFALT, och det är den listan regelns hasOnly härleds ur (#188)", () => {
    // Mäter RADEN mot listan och inte listan mot sig själv: ett fält som läggs till i raden men inte i listan
    // gör provet rött, och då hade regelns hasOnly nekat varje loggrad.
    const rad = byggKonfigandring({ handelse: "andrad", groupId: GRUPP, id: "uppgift", fore: FORE, efter: EFTER, av: { uid: "u1" }, nu: NU });
    expect(Object.keys(rad).sort()).toEqual([...KONFIGLOGGFALT].sort());
    expect(KONFIGLOGGFALT.length).toBeGreaterThanOrEqual(7);
  });
});

describe("meningen om vad som hände", () => {
  it("säger vad som döptes om till vad", () => {
    const rad = byggKonfigandring({ handelse: "andrad", groupId: GRUPP, id: "uppgift", fore: FORE, efter: EFTER, nu: NU });
    expect(beskrivKonfigandring(rad)).toBe("Uppgifter döptes om till Ärenden");
    expect(beskrivKonfigandring(rad, "en")).toBe("Tasks döptes om till Cases");
  });

  it("⛔ bygger meningen ur RADEN och inte ur dagens katalog", () => {
    /*
     * Kategorin kan vara omdöpt igen sedan dess. En mening som slog upp dagens
     * namn hade skrivit om historien: "Ärenden döptes om till Ärenden".
     */
    const rad = byggKonfigandring({ handelse: "andrad", groupId: GRUPP, id: "uppgift", fore: FORE, efter: EFTER, nu: NU });
    expect(beskrivKonfigandring(rad)).toContain("Uppgifter");
  });

  it("säger arkiverad och framtagen med olika ord", () => {
    const arkiverad = byggKonfigandring({ handelse: "arkiverad", groupId: GRUPP, id: "uppgift", fore: FORE, nu: NU });
    const framtagen = byggKonfigandring({ handelse: "framtagen", groupId: GRUPP, id: "uppgift", fore: FORE, nu: NU });
    expect(beskrivKonfigandring(arkiverad)).toBe("Uppgifter arkiverades");
    expect(beskrivKonfigandring(framtagen)).toBe("Uppgifter togs fram ur arkivet");
  });

  it("faller tillbaka på id när namnet saknas, i stället för en tom mening", () => {
    const rad = byggKonfigandring({ handelse: "andrad", groupId: GRUPP, id: "uppgift", fore: null, efter: null, nu: NU });
    expect(beskrivKonfigandring(rad)).toBe("uppgift ändrades");
  });
});

describe("skrivaren", () => {
  it("skriver raden genom append", async () => {
    const append = vi.fn(async () => {});
    const logg = createConfigLog({ append, nu: NU });

    const svar = await logg.skriv({ handelse: "tillagd", groupId: GRUPP, id: "resa", efter: { id: "resa", namn: { sv: "Resor" } } });
    expect(svar.ok).toBe(true);
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ handelse: "tillagd", groupId: GRUPP, kategori: "resa" }));
  });

  it("⛔ kastar ALDRIG när skrivningen faller, den svarar", async () => {
    // En logg som kan sänka det den loggar är värre än ingen logg. Att spara
    // en kategori ska inte misslyckas för att loggraden inte gick att skriva.
    const logg = createConfigLog({ append: async () => { throw new Error("Missing or insufficient permissions."); }, nu: NU });
    const svar = await logg.skriv({ handelse: "arkiverad", groupId: GRUPP, id: "uppgift", fore: FORE });
    expect(svar.ok).toBe(false);
    expect(svar.orsak).toBe("skrivning");
    expect(svar.fel?.message).toMatch(/permissions/);
  });

  it("⛔ skiljer ett trasigt utkast från en trasig skrivning", async () => {
    /*
     * Utan skillnaden felsöker nästa person en databas när felet är ett saknat
     * fält. Samma uppdelning som aktivitetsloggens orsak.
     */
    const append = vi.fn(async () => {});
    const logg = createConfigLog({ append, nu: NU });
    const svar = await logg.skriv({ handelse: "andrad", groupId: GRUPP, id: "uppgift" });
    expect(svar.ok).toBe(false);
    expect(svar.orsak).toBe("utkast");
    // Och ingenting skrevs: ett trasigt utkast ska inte lämna en halv rad.
    expect(append).not.toHaveBeenCalled();
  });

  it("⛔ ett utkast utan groupId är ett utkastfel, inte en rad åt ingen grupp (#188)", async () => {
    const append = vi.fn(async () => {});
    const logg = createConfigLog({ append, nu: NU });
    const svar = await logg.skriv({ handelse: "tillagd", id: "resa", efter: { id: "resa" } });
    expect(svar.ok).toBe(false);
    expect(svar.orsak).toBe("utkast");
    expect(String(svar.fel?.message)).toMatch(/groupId krävs/);
    expect(append).not.toHaveBeenCalled();
  });

  it("raden som skrivs bär gruppen som skickades in", async () => {
    const append = vi.fn(async () => {});
    const logg = createConfigLog({ append, nu: NU });
    await logg.skriv({ handelse: "arkiverad", groupId: "miranda-ab", id: "uppgift", fore: FORE });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ groupId: "miranda-ab" }));
  });

  it("kräver append och säger varför", () => {
    expect(() => createConfigLog({})).toThrow(/append krävs/);
    expect(() => createConfigLog()).toThrow(/append krävs/);
  });
});
