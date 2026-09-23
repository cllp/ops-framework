import { describe, expect, it } from "vitest";
import { createCaseModel } from "../lib/caseModel.js";

/**
 * ⛔ PROVEN ANVÄNDER EN PÅHITTAD TAXONOMI, inte bolag-ops egen.
 *
 * Det är avsiktligt och det är själva provet: skulle modellen råka bero på
 * "kvitto" eller "ekonomi" hade den fungerat i proven och gått sönder i nästa
 * app. En taxonomi som inte liknar den riktiga är det enda sättet att se att
 * ramverket inte har lärt sig den.
 */

const KONFIG = {
  baseLabel: "drift",
  kinds: [
    { value: "storning", label: "Störning", externalLabel: "storning" },
    {
      value: "leverans",
      label: "Leverans",
      externalLabel: "leverans",
      requirements: (u) => {
        const error = [];
        if (!u.kolli) error.push("Ange antal kolli.");
        return error;
      },
      extraFields: (u) => ({ frakt: { kolli: Number(u.kolli) } }),
    },
  ],
  priorities: [
    { value: "nu", label: "Nu", externalLabel: "prio:nu" },
    { value: "sen", label: "Sen", externalLabel: "prio:sen" },
  ],
};

const modell = createCaseModel(KONFIG);

describe("konfigurationen kontrolleras vid uppstart", () => {
  it("vägrar en modell utan sorter", () => {
    // ⛔ Sorterna är appens taxonomi. En modell utan dem är en modell som inte
    // vet vad den beskriver.
    expect(() => createCaseModel({ priorities: KONFIG.priorities, baseLabel: "x" })).toThrow(/minst en sort/);
  });

  it("vägrar en modell utan baseLabel", () => {
    // ⛔ Felet den fångar är dyrt och osynligt: ärendet skapas, det hamnar bara
    // aldrig där någon letar, och det ser ut som att det aldrig skapades.
    expect(() => createCaseModel({ kinds: KONFIG.kinds, priorities: KONFIG.priorities })).toThrow(/baseLabel/);
  });

  it("vägrar en sort som saknar sin etikett", () => {
    expect(() =>
      createCaseModel({ ...KONFIG, kinds: [{ value: "a", label: "A" }] }),
    ).toThrow(/kinds saknar "externalLabel"/);
  });
});

describe("etiketterna", () => {
  it("är basen, sorten och prion, i den ordningen", () => {
    expect(modell.labelsFor({ typ: "storning", prio: "nu" })).toEqual(["drift", "storning", "prio:nu"]);
  });

  it("utelämnar det som inte går att slå upp i stället för att gissa", () => {
    expect(modell.labelsFor({ typ: "finns-inte", prio: "nu" })).toEqual(["drift", "prio:nu"]);
    expect(modell.labelsFor({})).toEqual(["drift"]);
  });
});

describe("missing", () => {
  it("svarar med skälen, inte med ett nej", () => {
    // ⛔ Ett formulär som bara säger "kan inte sparas" tvingar användaren att
    // gissa vilket fält som är fel, och det är den gissningen som gör att folk
    // slutar rapportera saker.
    const error = modell.missing({});
    expect(error).toContain("Välj vad det gäller.");
    expect(error).toContain("Skriv en rubrik.");
    expect(error).toContain("Välj hur bråttom det är.");
  });

  it("släpper igenom en komplett post", () => {
    expect(modell.missing({ typ: "storning", prio: "nu", rubrik: "Strömmen borta" })).toEqual([]);
  });

  it("läser sortens egna krav ur sorten", () => {
    // ⛔ Villkoret står i APPENS register, inte som en gren i ramverket. En ny
    // sort med egna krav blir en rad hos appen, inte en ändring någon måste be om.
    expect(modell.missing({ typ: "leverans", prio: "nu", rubrik: "Pall från Ahlsell" })).toEqual([
      "Ange antal kolli.",
    ]);
    expect(modell.missing({ typ: "leverans", prio: "nu", rubrik: "Pall", kolli: 2 })).toEqual([]);
  });

  it("kräver inte sortens extra villkor av en annan sort", () => {
    expect(modell.missing({ typ: "storning", prio: "nu", rubrik: "Strömmen borta" })).toEqual([]);
  });

  it("stoppar en rubrik som inte ryms i en lista", () => {
    const lang = "x".repeat(121);
    expect(modell.missing({ typ: "storning", prio: "nu", rubrik: lang })).toEqual([
      "Rubriken får vara högst 120 tecken.",
    ]);
  });
});

describe("buildEntry", () => {
  const nu = () => "2026-09-17T12:00:00.000Z";

  it("sätter status till ny och resultat till null, en gång", () => {
    // ⛔ Därefter är båda serverns fält. Skrev båda sidor samma fält vore det två
    // sanningar om samma sak, och den som förlorar är den som skrev sist.
    const p = modell.buildEntry({ typ: "storning", prio: "nu", rubrik: "Strömmen borta" }, { email: "a@b.se", nu });
    expect(p.status).toBe("ny");
    expect(p.resultat).toBeNull();
    expect(p.skapadAv).toBe("a@b.se");
    expect(p.skapad).toBe("2026-09-17T12:00:00.000Z");
  });

  it("plockar bilagans fält ett och ett", () => {
    // ⛔ Sprids posten in med `...` hamnar vad som helst en filväljare råkar
    // returnera i databasen, utan att någon bestämt att det hör hemma där.
    const p = modell.buildEntry(
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
    const leverans = modell.buildEntry({ typ: "leverans", prio: "nu", rubrik: "Pall", kolli: "3" }, { nu });
    expect(leverans.frakt).toEqual({ kolli: 3 });

    // ⛔ Ett tomt fältblock på en sort som inte handlar om det ser ut som något
    // någon glömt fylla i.
    const storning = modell.buildEntry({ typ: "storning", prio: "nu", rubrik: "Strömmen borta" }, { nu });
    expect("frakt" in storning).toBe(false);
  });

  it("trimmar rubrik och text", () => {
    const p = modell.buildEntry({ typ: "storning", prio: "nu", rubrik: "  A  ", text: "  B  " }, { nu });
    expect(p.rubrik).toBe("A");
    expect(p.text).toBe("B");
  });
});

describe("ramverket kan inte appens ord", () => {
  it("har ingen inbyggd sort eller prio", () => {
    // ⛔ Det här provet är gränsen, skriven som en körning. Skulle någon lägga
    // in "kvitto" eller "ekonomi" som en default här, går det rött.
    const minimal = createCaseModel({
      baseLabel: "b",
      kinds: [{ value: "enda", label: "Enda", externalLabel: "e" }],
      priorities: [{ value: "p", label: "P", externalLabel: "prio:p" }],
    });
    expect(minimal.kinds).toHaveLength(1);
    expect(minimal.priorities).toHaveLength(1);
    expect(minimal.kindName("kvitto")).toBe("");
    expect(minimal.priorityName("hog")).toBe("");
  });
});

/**
 * ⛔ AVSLUTET ÄR DÄR DEN MÄTTA BRISTEN SATT (#166).
 *
 * En post stod som "hanterad" med tomt resultat. Vyn visade en grön bricka och
 * inte ett ord om vad som gjorts, så den som skickat in såg inte om något hänt.
 * Modellen ska göra det tillståndet omöjligt, inte lita på att den som avslutar
 * kommer ihåg.
 */
describe("avslut", () => {
  it("vägrar hanterad utan en text om vad som gjordes", () => {
    expect(modell.missingAtClose("hanterad", {})).toHaveLength(1);
    expect(modell.missingAtClose("hanterad", { url: "https://x" })).toHaveLength(1);
    expect(modell.missingAtClose("hanterad", { not: "   " })).toHaveLength(1);
  });

  it("vägrar avskriven utan skäl, och säger att skälet är poängen", () => {
    const error = modell.missingAtClose("avskriven", null);
    expect(error).toHaveLength(1);
    expect(error[0]).toMatch(/varför/i);
  });

  it("kräver text men inte länk, eftersom allt som görs inte lämnar en länk", () => {
    expect(modell.missingAtClose("hanterad", { not: "Siffran är införd i registret." })).toEqual([]);
    expect(modell.buildClose("hanterad", { not: "Siffran är införd i registret." }).resultat.url).toBeNull();
  });

  it("vägrar avslut till ett läge som inte är ett slutläge", () => {
    expect(modell.missingAtClose("ny", { not: "x" })).toHaveLength(1);
    expect(modell.missingAtClose("pahittat", { not: "x" })).toHaveLength(1);
  });

  it("kastar i stället för att skriva något halvt", () => {
    expect(() => modell.buildClose("hanterad", {})).toThrow(/Skriv vad som gjordes/);
    expect(() => modell.buildClose("avskriven", { not: "" })).toThrow(/varför/i);
  });

  /**
   * ⛔ DESTRUKTURERING ÄR NORMALT, OCH DET HÄR PROVET FINNS FÖR ATT FÖRSTA
   * VERSIONEN GICK SÖNDER AV DET. `buildClose` nådde sin validering via `this`,
   * vilket fungerar så länge någon skriver `modell.buildClose(...)` och slutar
   * fungera i samma sekund någon skriver `const { buildClose } = modell`.
   */
  it("fungerar destrukturerad, utan att hänga på this", () => {
    const { buildClose, missingAtClose } = modell;
    expect(missingAtClose("hanterad", { not: "gjort" })).toEqual([]);
    expect(buildClose("hanterad", { not: "gjort" }, { nu: () => "T" }).status).toBe("hanterad");
  });

  it("trimmar texten och stämplar avslutet", () => {
    const a = modell.buildClose("hanterad", { not: "  Blev #141  ", url: "https://x" }, { nu: () => "2026-09-17T21:00:00Z" });
    expect(a).toEqual({
      status: "hanterad",
      resultat: { url: "https://x", not: "Blev #141" },
      closed: "2026-09-17T21:00:00Z",
    });
  });
});

/**
 * ⛔ EN GAMMAL "NY" ÄR ETT LARM, INTE ETT TILLSTÅND. Ligger inskick orörda
 * betyder det att kedjan är trasig någonstans, och det felet ser likadant ut
 * som en lugn vecka.
 */
describe("daysInNew", () => {
  it("räknar hela dygn för en post som fortfarande är ny", () => {
    const skapad = new Date(Date.UTC(2026, 8, 10)).toISOString();
    const nu = new Date(Date.UTC(2026, 8, 17));
    expect(modell.daysInNew({ status: "ny", skapad }, nu)).toBe(7);
  });

  it("svarar null för en post som inte är ny, oavsett ålder", () => {
    expect(modell.daysInNew({ status: "hanterad", skapad: "2020-01-01T00:00:00Z" })).toBeNull();
    expect(modell.daysInNew({ status: "avskriven", skapad: "2020-01-01T00:00:00Z" })).toBeNull();
  });

  it("svarar null i stället för att hitta på ett tal när datumet inte går att läsa", () => {
    expect(modell.daysInNew({ status: "ny", skapad: "inte ett datum" })).toBeNull();
    expect(modell.daysInNew({ status: "ny" })).toBeNull();
    expect(modell.daysInNew(null)).toBeNull();
  });
});
