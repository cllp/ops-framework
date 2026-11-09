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

  it("vägrar avslut till en status som inte är en slutstatus", () => {
    expect(modell.missingAtClose("ny", { not: "x" })).toHaveLength(1);
    expect(modell.missingAtClose("pahittat", { not: "x" })).toHaveLength(1);
  });

  /*
   * ⛔ PROVAR ORDET, INTE BARA ATT DET BLEV ETT FEL. `toHaveLength(1)` ovan var
   * grönt både före och efter bytet från "läget" till "statusen", alltså kunde
   * ordet ha bytts tillbaka utan att något blev rött. Vakten
   * `check-statusord` läser stränglitteraler och hade fångat det, men ett prov
   * som läser meddelandet som en app faktiskt får det är det andra ögat.
   */
  it("säger statusen och inte läget i meddelandet om ett omöjligt avslut", () => {
    const [meddelande] = modell.missingAtClose("ny", { not: "x" });
    expect(meddelande).toContain("Avslut kräver statusen");
    expect(meddelande).not.toMatch(/läge/i);
  });

  /*
   * ⛔ IDENTITET, INTE LIKHET. `toEqual` hade varit grönt även om aliaset var en
   * kopia, och två frysta kopior går isär första gången någon lägger till en
   * status i den ena. cllp/ops-framework#94.
   */
  it("tar en skapare, och låter e-poststrängen fungera kvar", () => {
    /*
     * ⛔ BÅDA FORMERNA SAMTIDIGT ÄR KRAVET, inte en artighet. Migreringsordningen
     * i cllp/bolag-ops#377 säger att läsaren måste tåla strängen innan skrivaren
     * byter. Togs `email` bort här hade varje konsument som inte bytt gått sönder
     * av en ramverksuppgradering, alltså tvingats byta i samma sekund.
     */
    const skapare = { uid: "abc123", namn: "CP", typ: "manniska", kalla: "InboxView" };
    expect(modell.buildEntry({ typ: "storning", rubrik: "R", text: "T" }, { skapare }).skapadAv).toEqual(skapare);
    expect(modell.buildEntry({ typ: "storning", rubrik: "R", text: "T" }, { email: "a@b.se" }).skapadAv).toBe("a@b.se");
    // Skickas båda vinner den nya formen: annars hade en halvbytt anropare
    // tyst fortsatt skriva strängen.
    expect(modell.buildEntry({ typ: "storning", rubrik: "R", text: "T" }, { skapare, email: "a@b.se" }).skapadAv).toEqual(skapare);
  });

  it("ger STATUS och det utfasade STATES som samma objekt", () => {
    expect(modell.STATUS).toBe(modell.STATES);
    expect(modell.STATUS).toEqual({ NEW: "ny", IN_PROGRESS: "pagar", PARKED: "parkerad", HANDLED: "hanterad", DISMISSED: "avskriven" });
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

/**
 * Pågår (0.181.0, CP 2026-11-03): ett fjärde, ÖPPET läge. Före: statusen fanns inte, och en post som någon börjat på kunde bara stå som "ny".
 */
describe("pagar (0.181.0)", () => {
  it("är ett öppet läge: OPEN_STATES är ny och pagar, isOpen följer, och en okänd status är inte öppen", () => {
    expect(modell.STATUS.IN_PROGRESS).toBe("pagar");
    expect([...modell.OPEN_STATES]).toEqual(["ny", "pagar"]);
    expect(modell.isOpen("ny")).toBe(true);
    expect(modell.isOpen("pagar")).toBe(true);
    for (const s of ["parkerad", "hanterad", "avskriven", "okänd", "", null, undefined]) expect(modell.isOpen(s), String(s)).toBe(false);
  });

  it("övergångarna: ny till pagar och tillbaka, öppen till slutläge, slutläge bara till ny", () => {
    const g = [["ny", "pagar"], ["pagar", "ny"], ["ny", "hanterad"], ["ny", "avskriven"], ["pagar", "hanterad"], ["pagar", "avskriven"], ["hanterad", "ny"], ["avskriven", "ny"]];
    for (const [fran, till] of g) expect(modell.canMove(fran, till), `${fran} till ${till}`).toBe(true);
    const nej = [["hanterad", "pagar"], ["avskriven", "pagar"], ["pagar", "pagar"], ["ny", "ny"], ["hanterad", "avskriven"], ["okänd", "pagar"], [null, "pagar"]];
    for (const [fran, till] of nej) expect(modell.canMove(fran, till), `${fran} till ${till}`).toBe(false);
  });

  it("buildStart: från ny eller parkerad, och skriver bara status", () => {
    expect(modell.buildStart("ny")).toEqual({ status: "pagar" });
    expect(modell.buildStart("parkerad")).toEqual({ status: "pagar" });
    for (const fran of ["pagar", "hanterad", "avskriven", undefined]) expect(() => modell.buildStart(fran), String(fran)).toThrow(/byggPagar/);
  });

  it("buildStop: bara från pagar, tillbaka till ny", () => {
    expect(modell.buildStop("pagar")).toEqual({ status: "ny" });
    for (const fran of ["ny", "parkerad", "hanterad", "avskriven", undefined]) expect(() => modell.buildStop(fran), String(fran)).toThrow(/byggAvPagar/);
  });

  it("buildReopen: ett slutläge går till ny och tömmer avslutet, ett öppet läge kan inte öppnas igen", () => {
    for (const fran of ["hanterad", "avskriven"]) expect(modell.buildReopen(fran)).toEqual({ status: "ny", resultat: null, closed: null });
    for (const fran of ["ny", "pagar", "parkerad", undefined]) expect(() => modell.buildReopen(fran), String(fran)).toThrow(/byggOppnaIgen/);
  });

  it("⛔ pagar är inget slutläge: avslut kräver fortfarande hanterad eller avskriven, och en post som pågår avslutas med samma krav på not", () => {
    expect(modell.missingAtClose("pagar", { not: "x" })).toHaveLength(1);
    expect(() => modell.buildClose("pagar", { not: "x" })).toThrow(/Avslut kräver/);
    expect(modell.missingAtClose("hanterad", {})).toHaveLength(1);
    expect(modell.missingAtClose("avskriven", { not: "   " })).toHaveLength(1);
    expect(modell.buildClose("hanterad", { not: "Gjort" }, { nu: () => "T" })).toMatchObject({ status: "hanterad", closed: "T" });
  });

  it("⛔ daysInNew är null för pagar: larmet betyder att ingen rört posten", () => {
    const skapad = "2026-09-10T00:00:00Z";
    expect(modell.daysInNew({ status: "ny", skapad }, Date.parse("2026-09-17T00:00:00Z"))).toBe(7);
    expect(modell.daysInNew({ status: "pagar", skapad }, Date.parse("2026-09-17T00:00:00Z"))).toBeNull();
  });

  it("isOpenCase är samma lista för ytor utan modell", async () => {
    const { isOpenCase } = await import("../lib/caseModel.js");
    expect(["ny", "pagar", "parkerad", "hanterad", "avskriven"].map(isOpenCase)).toEqual([true, true, false, false, false]);
  });
});

/**
 * Parkerad (lifehub.app#725): ett ärende man vill komma ihåg men inte göra just nu.
 * Det är inget öppet läge och inget avslut. Före: statusen fanns inte, och en sådan post kunde bara stå som "ny" och ta plats bland det som ska göras.
 */
describe("parkerad (lifehub.app#725)", () => {
  it("är en egen status, inte öppen och inte ett avslut", () => {
    expect(modell.STATUS.PARKED).toBe("parkerad");
    expect([...modell.OPEN_STATES]).toEqual(["ny", "pagar"]);
    expect(modell.isOpen("parkerad")).toBe(false);
    expect(modell.missingAtClose("parkerad", { not: "Senare" })).toHaveLength(1);
    expect(() => modell.buildClose("parkerad", { not: "Senare" })).toThrow(/Avslut kräver/);
    expect(() => modell.buildReopen("parkerad")).toThrow(/byggOppnaIgen/);
    expect(modell.daysInNew({ status: "parkerad", skapad: "2020-01-01T00:00:00Z" })).toBeNull();
  });

  it("parkeras från ett öppet läge och tas tillbaka till ny, eller sätts på pågår", () => {
    expect(modell.buildPark("ny")).toEqual({ status: "parkerad" });
    expect(modell.buildPark("pagar")).toEqual({ status: "parkerad" });
    for (const fran of ["parkerad", "hanterad", "avskriven", undefined]) expect(() => modell.buildPark(fran), String(fran)).toThrow(/byggParkera/);
    expect(modell.buildUnpark("parkerad")).toEqual({ status: "ny" });
    for (const fran of ["ny", "pagar", "hanterad", "avskriven", undefined]) expect(() => modell.buildUnpark(fran), String(fran)).toThrow(/byggAvParkera/);
    expect(modell.buildStart("parkerad")).toEqual({ status: "pagar" });
  });

  it("övergångarna: öppen till parkerad, parkerad till ny, pågår eller ett slutläge, aldrig från ett slutläge", () => {
    const ja = [["ny", "parkerad"], ["pagar", "parkerad"], ["parkerad", "ny"], ["parkerad", "pagar"], ["parkerad", "hanterad"], ["parkerad", "avskriven"]];
    for (const [fran, till] of ja) expect(modell.canMove(fran, till), `${fran} till ${till}`).toBe(true);
    const nej = [["hanterad", "parkerad"], ["avskriven", "parkerad"], ["parkerad", "parkerad"], [null, "parkerad"]];
    for (const [fran, till] of nej) expect(modell.canMove(fran, till), `${fran} till ${till}`).toBe(false);
  });
});
