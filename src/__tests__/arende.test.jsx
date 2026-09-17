import { describe, expect, it } from "vitest";
import { skapaArendemodell } from "../lib/arende.js";

/**
 * ⛔ PROVEN ANVÄNDER EN PÅHITTAD TAXONOMI, inte bolag-ops egen.
 *
 * Det är avsiktligt och det är själva provet: skulle modellen råka bero på
 * "kvitto" eller "ekonomi" hade den fungerat i proven och gått sönder i nästa
 * app. En taxonomi som inte liknar den riktiga är det enda sättet att se att
 * ramverket inte har lärt sig den.
 */

const KONFIG = {
  basetikett: "drift",
  sorter: [
    { value: "storning", label: "Störning", etikett: "storning" },
    {
      value: "leverans",
      label: "Leverans",
      etikett: "leverans",
      krav: (u) => {
        const fel = [];
        if (!u.kolli) fel.push("Ange antal kolli.");
        return fel;
      },
      extraFalt: (u) => ({ frakt: { kolli: Number(u.kolli) } }),
    },
  ],
  prioer: [
    { value: "nu", label: "Nu", etikett: "prio:nu" },
    { value: "sen", label: "Sen", etikett: "prio:sen" },
  ],
};

const modell = skapaArendemodell(KONFIG);

describe("konfigurationen kontrolleras vid uppstart", () => {
  it("vägrar en modell utan sorter", () => {
    // ⛔ Sorterna är appens taxonomi. En modell utan dem är en modell som inte
    // vet vad den beskriver.
    expect(() => skapaArendemodell({ prioer: KONFIG.prioer, basetikett: "x" })).toThrow(/minst en sort/);
  });

  it("vägrar en modell utan basetikett", () => {
    // ⛔ Felet den fångar är dyrt och osynligt: ärendet skapas, det hamnar bara
    // aldrig där någon letar, och det ser ut som att det aldrig skapades.
    expect(() => skapaArendemodell({ sorter: KONFIG.sorter, prioer: KONFIG.prioer })).toThrow(/basetikett/);
  });

  it("vägrar en sort som saknar sin etikett", () => {
    expect(() =>
      skapaArendemodell({ ...KONFIG, sorter: [{ value: "a", label: "A" }] }),
    ).toThrow(/sorter saknar "etikett"/);
  });
});

describe("etiketterna", () => {
  it("är basen, sorten och prion, i den ordningen", () => {
    expect(modell.etiketter({ typ: "storning", prio: "nu" })).toEqual(["drift", "storning", "prio:nu"]);
  });

  it("utelämnar det som inte går att slå upp i stället för att gissa", () => {
    expect(modell.etiketter({ typ: "finns-inte", prio: "nu" })).toEqual(["drift", "prio:nu"]);
    expect(modell.etiketter({})).toEqual(["drift"]);
  });
});

describe("saknas", () => {
  it("svarar med skälen, inte med ett nej", () => {
    // ⛔ Ett formulär som bara säger "kan inte sparas" tvingar användaren att
    // gissa vilket fält som är fel, och det är den gissningen som gör att folk
    // slutar rapportera saker.
    const fel = modell.saknas({});
    expect(fel).toContain("Välj vad det gäller.");
    expect(fel).toContain("Skriv en rubrik.");
    expect(fel).toContain("Välj hur bråttom det är.");
  });

  it("släpper igenom en komplett post", () => {
    expect(modell.saknas({ typ: "storning", prio: "nu", rubrik: "Strömmen borta" })).toEqual([]);
  });

  it("läser sortens egna krav ur sorten", () => {
    // ⛔ Villkoret står i APPENS register, inte som en gren i ramverket. En ny
    // sort med egna krav blir en rad hos appen, inte en ändring någon måste be om.
    expect(modell.saknas({ typ: "leverans", prio: "nu", rubrik: "Pall från Ahlsell" })).toEqual([
      "Ange antal kolli.",
    ]);
    expect(modell.saknas({ typ: "leverans", prio: "nu", rubrik: "Pall", kolli: 2 })).toEqual([]);
  });

  it("kräver inte sortens extra villkor av en annan sort", () => {
    expect(modell.saknas({ typ: "storning", prio: "nu", rubrik: "Strömmen borta" })).toEqual([]);
  });

  it("stoppar en rubrik som inte ryms i en lista", () => {
    const lang = "x".repeat(121);
    expect(modell.saknas({ typ: "storning", prio: "nu", rubrik: lang })).toEqual([
      "Rubriken får vara högst 120 tecken.",
    ]);
  });
});

describe("byggPost", () => {
  const nu = () => "2026-09-17T12:00:00.000Z";

  it("sätter status till ny och resultat till null, en gång", () => {
    // ⛔ Därefter är båda serverns fält. Skrev båda sidor samma fält vore det två
    // sanningar om samma sak, och den som förlorar är den som skrev sist.
    const p = modell.byggPost({ typ: "storning", prio: "nu", rubrik: "Strömmen borta" }, { epost: "a@b.se", nu });
    expect(p.status).toBe("ny");
    expect(p.resultat).toBeNull();
    expect(p.skapadAv).toBe("a@b.se");
    expect(p.skapad).toBe("2026-09-17T12:00:00.000Z");
  });

  it("plockar bilagans fält ett och ett", () => {
    // ⛔ Sprids posten in med `...` hamnar vad som helst en filväljare råkar
    // returnera i databasen, utan att någon bestämt att det hör hemma där.
    const p = modell.byggPost(
      {
        typ: "storning",
        prio: "nu",
        rubrik: "Foto",
        bilaga: { dataUrl: "d", namn: "n", typ: "image/png", tecken: 10, smuts: "ska inte med" },
      },
      { nu },
    );
    expect(p.bilaga).toEqual({ dataUrl: "d", namn: "n", typ: "image/png", tecken: 10, bredd: null, hojd: null });
    expect("smuts" in p.bilaga).toBe(false);
  });

  it("tar med appens extra fält, men bara för den sort som har dem", () => {
    const leverans = modell.byggPost({ typ: "leverans", prio: "nu", rubrik: "Pall", kolli: "3" }, { nu });
    expect(leverans.frakt).toEqual({ kolli: 3 });

    // ⛔ Ett tomt fältblock på en sort som inte handlar om det ser ut som något
    // någon glömt fylla i.
    const storning = modell.byggPost({ typ: "storning", prio: "nu", rubrik: "Strömmen borta" }, { nu });
    expect("frakt" in storning).toBe(false);
  });

  it("trimmar rubrik och text", () => {
    const p = modell.byggPost({ typ: "storning", prio: "nu", rubrik: "  A  ", text: "  B  " }, { nu });
    expect(p.rubrik).toBe("A");
    expect(p.text).toBe("B");
  });
});

describe("ramverket kan inte appens ord", () => {
  it("har ingen inbyggd sort eller prio", () => {
    // ⛔ Det här provet är gränsen, skriven som en körning. Skulle någon lägga
    // in "kvitto" eller "ekonomi" som en default här, går det rött.
    const minimal = skapaArendemodell({
      basetikett: "b",
      sorter: [{ value: "enda", label: "Enda", etikett: "e" }],
      prioer: [{ value: "p", label: "P", etikett: "prio:p" }],
    });
    expect(minimal.sorter).toHaveLength(1);
    expect(minimal.prioer).toHaveLength(1);
    expect(minimal.sortnamn("kvitto")).toBe("");
    expect(minimal.prionamn("hog")).toBe("");
  });
});
