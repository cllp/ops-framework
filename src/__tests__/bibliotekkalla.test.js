import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";
import { kodaToppar } from "../lib/bibliotek.js";

const skapare = () => ({ uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" });

describe("createBibliotekskalla", () => {
  it("kräver samling, grupp och skapare", () => {
    const source = createMemorySource();
    expect(() => createBibliotekskalla({ source, collection: "", groupId: "cps-ab", skapare })).toThrow(/collection/);
    expect(() => createBibliotekskalla({ source, collection: "bibliotek", groupId: "", skapare })).toThrow(/groupId/);
  });

  it("läser bara den här gruppens rader och skriver författaren själv", async () => {
    const source = createMemorySource({
      bibliotek: [
        { id: "annan", groupId: "miranda-ab", typ: "anteckning", rubrik: "Deras", text: "Hemlig.", skapadAv: { uid: "u2", namn: "M", typ: "manniska", kalla: "b" }, skapad: 1, andrad: 1 },
      ],
    });
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const tom = await kalla.las();
    expect(tom.kalla).toBe("databas");
    expect(tom.poster).toEqual([]);
    expect(tom.fel).toBeNull();
    const sparad = await kalla.spara({ typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade." });
    expect(sparad.skapadAv.uid).toBe("uid-1");
    expect(sparad.groupId).toBe("cps-ab");
    const efter = await kalla.las();
    expect(efter.poster.map((p) => p.rubrik)).toEqual(["Protokoll"]);
  });

  it("en trasig rad märks och släcker inte de andra", async () => {
    const hel = { groupId: "cps-ab", typ: "anteckning", rubrik: "Hel", text: "Läsbar.", skapadAv: skapare(), skapad: 1, andrad: 1 };
    const source = createMemorySource({
      bibliotek: [
        { id: "x", groupId: "cps-ab", typ: "anteckning", rubrik: "Halv" },
        { id: "mellanslag", ...hel, text: "   " },
        { id: "ok", ...hel },
      ],
    });
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const svar = await kalla.las();
    expect(svar.kalla).toBe("databas");
    expect(svar.fel).toBeNull();
    expect(svar.poster.map((p) => p.id)).toEqual(["ok"]);
    expect(svar.trasiga.map((t) => t.id).sort()).toEqual(["mellanslag", "x"]);
    expect(svar.trasiga.find((t) => t.id === "x")?.fel).toMatch(/saknar text/);
  });

  it("en rad från en annan grupp märks, även om källan släpper igenom den", async () => {
    const rad = { id: "fel-grupp", groupId: "miranda-ab", typ: "anteckning", rubrik: "Deras", text: "Hemlig.", skapadAv: skapare(), skapad: 1, andrad: 1 };
    const source = { list: async () => [rad], read: async () => null, create: async () => ({ id: "n" }), update: async () => {} };
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const svar = await kalla.las();
    expect(svar.poster).toEqual([]);
    expect(svar.trasiga).toEqual([{
      id: "fel-grupp",
      fel: expect.stringMatching(/miranda-ab/),
      groupId: "miranda-ab",
      skapadAv: rad.skapadAv,
    }]);
  });

  it("radera kräver jag och anteckna, och tar bara bort när båda släpper igenom", async () => {
    const hel = { groupId: "cps-ab", typ: "anteckning", rubrik: "Hel", text: "Läsbar.", skapadAv: skapare(), skapad: 1, andrad: 1 };
    const source = createMemorySource({
      bibliotek: [
        { id: "min", ...hel },
        { id: "annans", ...hel, skapadAv: { uid: "uid-2", namn: "Alex", typ: "manniska", kalla: "bibliotek" } },
        { id: "trasig", groupId: "cps-ab", typ: "anteckning", rubrik: "Halv", skapadAv: skapare() },
      ],
    });
    const utan = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    await expect(utan.radera("min")).rejects.toThrow(/jag krävs/);

    const anteckningar = [];
    const kalla = createBibliotekskalla({
      source,
      collection: "bibliotek",
      groupId: "cps-ab",
      skapare,
      jag: () => ({ uid: "uid-1", roll: "medlem", groupId: "cps-ab" }),
      anteckna: async (rad) => { anteckningar.push(rad); },
    });
    await expect(kalla.radera("annans")).rejects.toThrow(/författaren eller en admin/);
    expect(anteckningar).toEqual([]);
    expect((await source.read("bibliotek", "annans"))?.rubrik).toBe("Hel");

    await kalla.radera("min");
    expect(anteckningar).toHaveLength(1);
    expect(anteckningar[0].av.uid).toBe("uid-1");
    expect(anteckningar[0].id).toBe("min");
    expect(await source.read("bibliotek", "min")).toBeNull();

    await kalla.radera("trasig");
    expect(await source.read("bibliotek", "trasig")).toBeNull();
  });

  it("en anteckning som faller lämnar posten kvar", async () => {
    const hel = { id: "min", groupId: "cps-ab", typ: "anteckning", rubrik: "Hel", text: "Läsbar.", skapadAv: skapare(), skapad: 1, andrad: 1 };
    const source = createMemorySource({ bibliotek: [hel] });
    const kalla = createBibliotekskalla({
      source,
      collection: "bibliotek",
      groupId: "cps-ab",
      skapare,
      jag: () => ({ uid: "uid-1", roll: "medlem" }),
      anteckna: async () => { throw new Error("loggen svarade inte"); },
    });
    await expect(kalla.radera("min")).rejects.toThrow(/loggen svarade inte/);
    expect((await source.read("bibliotek", "min"))?.rubrik).toBe("Hel");
  });

  it("admin i gruppen raderar någon annans rad, och en admin med annan grupp gör det inte", async () => {
    const hel = { groupId: "cps-ab", typ: "anteckning", rubrik: "Hel", text: "Läsbar.", skapadAv: { uid: "uid-2", namn: "Alex", typ: "manniska", kalla: "bibliotek" }, skapad: 1, andrad: 1 };
    const source = createMemorySource({
      bibliotek: [
        { id: "a", ...hel },
        { id: "b", ...hel },
      ],
    });
    const admin = createBibliotekskalla({
      source,
      collection: "bibliotek",
      groupId: "cps-ab",
      skapare,
      jag: () => ({ uid: "uid-9", roll: "admin", groupId: "cps-ab" }),
      anteckna: async () => {},
    });
    await admin.radera("a");
    expect(await source.read("bibliotek", "a")).toBeNull();

    const felGrupp = createBibliotekskalla({
      source,
      collection: "bibliotek",
      groupId: "cps-ab",
      skapare,
      jag: () => ({ uid: "uid-9", roll: "admin", groupId: "miranda-ab" }),
      anteckna: async () => {},
    });
    await expect(felGrupp.radera("b")).rejects.toThrow(/författaren eller en admin/);
    expect((await source.read("bibliotek", "b"))?.rubrik).toBe("Hel");
  });

  it("laddar upp en bild på appens sökväg, och en nekad uppladdning lämnar ingen post", async () => {
    const source = createMemorySource();
    /** @type {{ sokvag: string, contentType?: string }[]} */
    const uppladdat = [];
    const lagring = {
      laddaUpp: async (/** @type {{ sokvag: string, contentType?: string }} */ inmatning) => {
        uppladdat.push(inmatning);
        return { url: "minne://x", sokvag: inmatning.sokvag };
      },
      taBort: async () => {},
    };
    const kalla = createBibliotekskalla({
      source,
      collection: "bibliotek",
      groupId: "cps-ab",
      skapare,
      lagring,
      sokvag: ({ groupId, postId, namn }) => `grupper/${groupId}/bibliotek/${postId}/${namn}`,
    });
    await expect(kalla.laddaUppFil({ rubrik: "Zip", fil: { name: "a.zip", type: "application/zip", size: 10 } })).rejects.toThrow(/application\/zip/);
    const sparad = await kalla.laddaUppFil({
      rubrik: "Idé",
      fil: { name: "ide.webm", type: "audio/webm;codecs=opus", size: 100 },
    });
    expect(sparad.fil.mime).toBe("audio/webm");
    expect(sparad.fil.sokvag).toBe(`grupper/cps-ab/bibliotek/${sparad.id}/ide.webm`);
    expect(Object.hasOwn(sparad, "durationMs")).toBe(false);
    expect(uppladdat[0].contentType).toBe("audio/webm");
    await expect(kalla.laddaUppFil({ rubrik: "Stor", fil: { name: "stor.jpg", type: "image/jpeg", size: 25 * 1024 * 1024 + 1 } })).rejects.toThrow(/Taket/);

    const nekad = createBibliotekskalla({
      source,
      collection: "bibliotek",
      groupId: "cps-ab",
      skapare,
      lagring: { laddaUpp: async () => { throw new Error("nekad"); }, taBort: async () => {} },
      sokvag: ({ groupId, postId, namn }) => `grupper/${groupId}/bibliotek/${postId}/${namn}`,
    });
    const inspelad = await kalla.laddaUppFil({
      rubrik: "Röst",
      fil: { name: "rost.mp4", type: "audio/mp4", size: 80 },
      sekunder: 4.2,
    });
    expect(inspelad.durationMs).toBe(4200);
    expect(Object.hasOwn(inspelad, "peaks")).toBe(false);
    const toppar = kodaToppar(Array.from({ length: 48 }, (_, i) => (i === 0 ? 1 : 0.5)));
    const medVag = await kalla.laddaUppFil({
      rubrik: "Våg",
      fil: { name: "vag.webm", type: "audio/webm", size: 80 },
      durationMs: 9000,
      peaks: toppar,
    });
    expect(medVag.durationMs).toBe(9000);
    // ⛔ Vågen skrivs som en sträng (#349): en lista av 48 tal nekades av reglerna, så ingen post får bära den.
    expect(typeof medVag.peaks).toBe("string");
    expect(medVag.peaks).toBe(toppar);
    expect(medVag.peaks[0]).toBe("_");
    await expect(nekad.laddaUppFil({ rubrik: "Nekad", fil: { name: "a.jpg", type: "image/jpeg", size: 10 } })).rejects.toThrow(/nekad/);
    const efter = await nekad.las();
    expect(efter.poster.map((p) => p.rubrik)).not.toContain("Nekad");
  });

  it("⛔ en röstinspelning sparas med vågen som en sträng, inte som 48 tal (#349)", async () => {
    // CP 2026-10-13: en inspelning med våg nekades av reglerna ("Missing or insufficient permissions."). Provet kör vägen
    // som inspelningen går: filen avkodas, topparna räknas, och det som skrivs till källan är en sträng.
    const tidigareAudio = globalThis.AudioContext;
    globalThis.AudioContext = class {
      async decodeAudioData() {
        const kanal = new Float32Array(48 * 4);
        kanal.fill(0.25);
        for (let i = 0; i < 4; i++) kanal[i] = 1;
        return { duration: 4, getChannelData: () => kanal };
      }
      async close() {}
    };
    try {
      const source = createMemorySource();
      const kalla = createBibliotekskalla({
        source,
        collection: "bibliotek",
        groupId: "cps-ab",
        skapare,
        lagring: { laddaUpp: async (/** @type {{ sokvag: string }} */ i) => ({ url: "minne://x", sokvag: i.sokvag }) },
        sokvag: ({ groupId, postId, namn }) => `grupper/${groupId}/bibliotek/${postId}/${namn}`,
      });
      const sparad = await kalla.laddaUppFil({
        rubrik: "Idé",
        fil: { name: "ide.webm", type: "audio/webm", size: 100 },
        blob: { arrayBuffer: async () => new ArrayBuffer(8) },
      });
      const lagrad = await source.read("bibliotek", sparad.id);
      expect(typeof lagrad?.peaks).toBe("string");
      expect(lagrad?.peaks).toMatch(/^[A-Za-z0-9_-]{48}$/);
      // Första stolpen är den högsta (1), och de andra är en fjärdedel av den: A är 0 och _ är 1.
      expect(String(lagrad?.peaks)[0]).toBe("_");
      expect(String(lagrad?.peaks)[1]).toBe(kodaToppar(Array(48).fill(0.25))[0]);
      expect(lagrad?.durationMs).toBe(4000);
      // Och posten går att läsa tillbaka genom källans egen validering.
      const las = await kalla.las();
      expect(las.trasiga).toEqual([]);
      expect(las.poster[0].peaks).toBe(lagrad?.peaks);
    } finally {
      if (tidigareAudio) globalThis.AudioContext = tidigareAudio;
      else delete globalThis.AudioContext;
    }
  });

  it("en lista av tal från anroparen räknas inte som en våg: vågen räknas ur filen i stället", async () => {
    const source = createMemorySource();
    const kalla = createBibliotekskalla({
      source,
      collection: "bibliotek",
      groupId: "cps-ab",
      skapare,
      lagring: { laddaUpp: async (/** @type {{ sokvag: string }} */ i) => ({ url: "minne://x", sokvag: i.sokvag }) },
      sokvag: ({ groupId, postId, namn }) => `grupper/${groupId}/bibliotek/${postId}/${namn}`,
    });
    const sparad = await kalla.laddaUppFil({
      rubrik: "Idé",
      fil: { name: "ide.webm", type: "audio/webm", size: 100 },
      durationMs: 3000,
      peaks: /** @type {any} */ (Array.from({ length: 48 }, () => 0.5)),
    });
    expect(Object.hasOwn(sparad, "peaks")).toBe(false);
    expect(sparad.durationMs).toBe(3000);
  });

  it("sparar utskriften på ljudet och behåller den när rubriken ändras", async () => {
    const source = createMemorySource();
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const fil = { sokvag: "grupper/cps-ab/bibliotek/p/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 100 };
    const skapad = await kalla.spara({ typ: "fil", rubrik: "Idé", fil });
    expect(Object.hasOwn(skapad, "utskrift")).toBe(false);
    const tom = await kalla.spara({ id: skapad.id, rubrik: "Idé", fil, utskrift: "" });
    expect(tom.utskrift).toBe("");
    const med = await kalla.spara({ id: skapad.id, rubrik: "Idé", fil, utskrift: "Hej" });
    expect(med.utskrift).toBe("Hej");
    const omdopt = await kalla.spara({ id: skapad.id, rubrik: "Omdöpt", fil });
    expect(omdopt.rubrik).toBe("Omdöpt");
    expect(omdopt.utskrift).toBe("Hej");
    const tal = (/** @type {number} */ ett) => Array.from({ length: 48 }, (_, i) => (i === ett ? 1 : 0.2));
    const toppar = kodaToppar(tal(1));
    const medLangd = await kalla.spara({ id: skapad.id, rubrik: "Omdöpt", fil, durationMs: 4000, peaks: toppar });
    expect(medLangd.durationMs).toBe(4000);
    expect(medLangd.peaks).toBe(toppar);
    const kvar = await kalla.spara({ id: skapad.id, rubrik: "Kvar", fil });
    expect(kvar.durationMs).toBe(4000);
    expect(kvar.peaks).toBe(toppar);
    // onFyllLjud skickar bara id + meta: rubrik och fil ska stå kvar.
    const fylld = await kalla.spara({ id: skapad.id, durationMs: 5500, peaks: kodaToppar(tal(2)) });
    expect(fylld.rubrik).toBe("Kvar");
    expect(fylld.fil).toEqual(fil);
    expect(fylld.durationMs).toBe(5500);
    expect(fylld.peaks).toBe(kodaToppar(tal(2)));
    const bild = { ...fil, mime: "image/jpeg", namn: "k.jpg", sokvag: "grupper/cps-ab/bibliotek/p/k.jpg" };
    await expect(kalla.spara({ id: skapad.id, rubrik: "Bild", fil: bild, utskrift: "Hej" })).rejects.toThrow(/Bara ett ljud/);
  });

  it("⛔ ett anrop som bara fyller i längd och våg flyttar inte andrad, men en riktig ändring gör det", async () => {
    vi.useFakeTimers();
    try {
      const source = createMemorySource();
      const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
      const fil = { sokvag: "grupper/cps-ab/bibliotek/p/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 100 };
      const toppar = kodaToppar(Array.from({ length: 48 }, (_, i) => (i === 1 ? 1 : 0.2)));

      vi.setSystemTime(1_700_000_000_000);
      const skapad = await kalla.spara({ typ: "fil", rubrik: "Idé", fil });
      expect(skapad.andrad).toBe(1_700_000_000_000);

      vi.setSystemTime(1_700_000_100_000);
      const omdopt = await kalla.spara({ id: skapad.id, rubrik: "Omdöpt", fil });
      expect(omdopt.andrad).toBe(1_700_000_100_000);

      // Någon lyssnar på ljudet en timme senare och spelaren räknar fram längden: posten har inte ändrats av någon.
      vi.setSystemTime(1_700_003_700_000);
      const fylld = await kalla.spara({ id: skapad.id, durationMs: 4000, peaks: toppar });
      expect(fylld.durationMs).toBe(4000);
      expect(fylld.peaks).toBe(toppar);
      expect(fylld.andrad).toBe(1_700_000_100_000);
      expect(fylld.skapad).toBe(1_700_000_000_000);
      const lasta = (await kalla.las()).poster.find((p) => p.id === skapad.id);
      expect(lasta?.andrad).toBe(1_700_000_100_000);

      // Bara längden, utan våg, är samma sak.
      vi.setSystemTime(1_700_007_300_000);
      const baraLangd = await kalla.spara({ id: skapad.id, durationMs: 4100 });
      expect(baraLangd.andrad).toBe(1_700_000_100_000);

      // En ändring av något en person skrev flyttar den, också när längden följer med.
      vi.setSystemTime(1_700_010_900_000);
      const rubrikOchLangd = await kalla.spara({ id: skapad.id, rubrik: "Ny rubrik", durationMs: 4200 });
      expect(rubrikOchLangd.andrad).toBe(1_700_010_900_000);

      // Och ett anrop utan nytt innehåll alls är en ändring som förut: det är en spara, inte en fyll.
      vi.setSystemTime(1_700_014_500_000);
      const bara = await kalla.spara({ id: skapad.id });
      expect(bara.andrad).toBe(1_700_014_500_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("en läsning som föll är kalla fel, inte ett tomt bibliotek", async () => {
    const source = { list: async () => { throw new Error("nere"); }, read: async () => null, create: async () => ({ id: "n" }), update: async () => {} };
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare });
    const svar = await kalla.las();
    expect(svar.kalla).toBe("fel");
    expect(svar.fel?.message).toBe("nere");
  });
});
