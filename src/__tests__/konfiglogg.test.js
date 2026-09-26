import { describe, it, expect, vi } from "vitest";
import { KONFIGHANDELSER, beskrivKonfigandring, byggKonfigandring, createConfigLog } from "../lib/konfiglogg.js";

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

describe("loggraden", () => {
  it("bär fore, efter, när och av", () => {
    const rad = byggKonfigandring({ handelse: "andrad", id: "uppgift", fore: FORE, efter: EFTER, av: { uid: "u1", namn: "CP" }, nu: NU });
    expect(rad).toEqual({
      handelse: "andrad",
      id: "uppgift",
      fore: FORE,
      efter: EFTER,
      nar: "2026-09-26T08:00:00.000Z",
      av: { uid: "u1", namn: "CP" },
    });
  });

  it("⛔ kastar utan fore, eftersom en rad utan det är en notis och inte ett spår", () => {
    expect(() => byggKonfigandring({ handelse: "andrad", id: "uppgift", efter: EFTER })).toThrow(/vad som stod förut/);
    expect(() => byggKonfigandring({ handelse: "arkiverad", id: "uppgift" })).toThrow(/fore krävs/);
  });

  it("⛔ en nytillagd har inget före, och då står det null och inte tomt", () => {
    // De två betyder olika saker: null är "fanns inte", tom sträng är "hette
    // ingenting". Den skillnaden syns i loggen.
    const rad = byggKonfigandring({ handelse: "tillagd", id: "resa", efter: { id: "resa", namn: { sv: "Resor" } }, nu: NU });
    expect(rad.fore).toBeNull();
  });

  it("kastar på en okänd händelse i stället för att skriva den vidare", () => {
    expect(() => byggKonfigandring({ handelse: "raderad", id: "x", fore: FORE })).toThrow(/okänd handelse/);
    expect([...KONFIGHANDELSER]).toEqual(["tillagd", "andrad", "arkiverad", "framtagen"]);
  });

  it("kastar utan id, eftersom raden annars inte går att söka i", () => {
    expect(() => byggKonfigandring({ handelse: "tillagd" })).toThrow(/id krävs/);
  });
});

describe("meningen om vad som hände", () => {
  it("säger vad som döptes om till vad", () => {
    const rad = byggKonfigandring({ handelse: "andrad", id: "uppgift", fore: FORE, efter: EFTER, nu: NU });
    expect(beskrivKonfigandring(rad)).toBe("Uppgifter döptes om till Ärenden");
    expect(beskrivKonfigandring(rad, "en")).toBe("Tasks döptes om till Cases");
  });

  it("⛔ bygger meningen ur RADEN och inte ur dagens katalog", () => {
    /*
     * Kategorin kan vara omdöpt igen sedan dess. En mening som slog upp dagens
     * namn hade skrivit om historien: "Ärenden döptes om till Ärenden".
     */
    const rad = byggKonfigandring({ handelse: "andrad", id: "uppgift", fore: FORE, efter: EFTER, nu: NU });
    expect(beskrivKonfigandring(rad)).toContain("Uppgifter");
  });

  it("säger arkiverad och framtagen med olika ord", () => {
    const arkiverad = byggKonfigandring({ handelse: "arkiverad", id: "uppgift", fore: FORE, nu: NU });
    const framtagen = byggKonfigandring({ handelse: "framtagen", id: "uppgift", fore: FORE, nu: NU });
    expect(beskrivKonfigandring(arkiverad)).toBe("Uppgifter arkiverades");
    expect(beskrivKonfigandring(framtagen)).toBe("Uppgifter togs fram ur arkivet");
  });

  it("faller tillbaka på id när namnet saknas, i stället för en tom mening", () => {
    const rad = byggKonfigandring({ handelse: "andrad", id: "uppgift", fore: null, efter: null, nu: NU });
    expect(beskrivKonfigandring(rad)).toBe("uppgift ändrades");
  });
});

describe("skrivaren", () => {
  it("skriver raden genom append", async () => {
    const append = vi.fn(async () => {});
    const logg = createConfigLog({ append, nu: NU });

    const svar = await logg.skriv({ handelse: "tillagd", id: "resa", efter: { id: "resa", namn: { sv: "Resor" } } });
    expect(svar.ok).toBe(true);
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ handelse: "tillagd", id: "resa" }));
  });

  it("⛔ kastar ALDRIG när skrivningen faller, den svarar", async () => {
    // En logg som kan sänka det den loggar är värre än ingen logg. Att spara
    // en kategori ska inte misslyckas för att loggraden inte gick att skriva.
    const logg = createConfigLog({ append: async () => { throw new Error("Missing or insufficient permissions."); }, nu: NU });
    const svar = await logg.skriv({ handelse: "arkiverad", id: "uppgift", fore: FORE });
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
    const svar = await logg.skriv({ handelse: "andrad", id: "uppgift" });
    expect(svar.ok).toBe(false);
    expect(svar.orsak).toBe("utkast");
    // Och ingenting skrevs: ett trasigt utkast ska inte lämna en halv rad.
    expect(append).not.toHaveBeenCalled();
  });

  it("kräver append och säger varför", () => {
    expect(() => createConfigLog({})).toThrow(/append krävs/);
    expect(() => createConfigLog()).toThrow(/append krävs/);
  });
});
