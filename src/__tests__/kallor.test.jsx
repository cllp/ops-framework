import { describe, it, expect, vi } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { skapaKallregister, NOTISPRIO } from "../lib/kallor.js";
import { useKallor } from "../data/useKallor.jsx";
import { defineModule } from "../lib/modul.js";
import { OpsModulHandelser } from "../components/OpsModulHandelser.jsx";
import { OpsModulHjalp } from "../components/OpsModulHjalp.jsx";
import { OpsModulKataloger } from "../components/OpsModulKataloger.jsx";

/**
 * Fas 3: källkontraktet och registret (#129).
 *
 * ⛔ FORMEN PRÖVAS VID ANROPET, inte vid uppstart, och proven speglar det.
 * Vad en källa RETURNERAR går inte att veta förrän den anropats, och ett prov
 * som låtsades annat hade mätt ett skydd som inte finns.
 */

const GRUPP = { groupId: "bolaget" };

/** @param {Record<string, Function>} kallor @param {string} [id] */
const modul = (kallor, id = "liv") =>
  defineModule({ id, namn: { sv: "Liv" }, nav: [], routes: [], samlingar: [], kallor, skapar: [] });

describe("registret byggs bara av byggda moduler", () => {
  it("avvisar ett rått manifest, eftersom det inte gått genom valideringen", () => {
    expect(() => skapaKallregister([/** @type {any} */ ({ id: "liv", kallor: {} })])).not.toThrow();
    expect(() => skapaKallregister([/** @type {any} */ ({ namn: "Liv" })])).toThrow(/inte en byggd modul/);
  });

  it("avvisar något som inte är en lista, och säger vad en app utan moduler skickar", () => {
    expect(() => skapaKallregister(/** @type {any} */ (null))).toThrow(/tomhet är ett svar/);
  });

  it("en app utan moduler ger ett register med tomma ytor", async () => {
    const r = skapaKallregister([]);
    expect(await r.handelser(GRUPP)).toEqual([]);
    expect(r.modulerFor("handelser")).toEqual([]);
  });
});

describe("varje anrop bär exakt en grupp", () => {
  const r = () => skapaKallregister([modul({ handelser: async () => [] })]);

  it("avvisar en fråga utan groupId, i körtid och inte bara i typen", async () => {
    await expect(r().handelser(/** @type {any} */ ({}))).rejects.toThrow(/groupId krävs/);
  });

  it("skickar frågan vidare oförändrad till modulen", async () => {
    const handelser = vi.fn(async () => []);
    await skapaKallregister([modul({ handelser })]).handelser({ groupId: "bolaget", sedan: "2026-01-01" });
    expect(handelser).toHaveBeenCalledWith({ groupId: "bolaget", sedan: "2026-01-01" });
  });
});

describe("raderna granskas när de kommer, och felet namnger modulen", () => {
  /** @param {string} yta @param {any} rad */
  const svar = (yta, rad) => skapaKallregister([modul({ [yta]: async () => [rad] })])[yta](GRUPP);

  it("en händelse utan id fälls", async () => {
    await expect(svar("handelser", { title: "Utan id", daysLeft: 0 })).rejects.toThrow(/saknar id/);
  });

  it("en händelse utan daysLeft fälls, med skillnaden mot null utskriven", async () => {
    await expect(svar("handelser", { id: "a", title: "T" })).rejects.toThrow(/Skriv null för odaterat/);
  });

  it("en sökträff utan titel fälls", async () => {
    await expect(svar("sok", { id: "a" })).rejects.toThrow(/saknar titel/);
  });

  it("en hjälptext som är en sträng fälls", async () => {
    await expect(svar("hjalp", { titel: "Rubrik", text: "Text" })).rejects.toThrow(/hjalp/);
  });

  it("en notis med påhittad prio fälls, med de giltiga uppräknade", async () => {
    await expect(svar("notiser", { id: "a", titel: "T", prio: "panik" })).rejects.toThrow(/Giltiga: hog, normal, lag/);
  });

  it("en widget utan vy fälls", async () => {
    await expect(svar("widgets", { id: "a", titel: { sv: "Kort" } })).rejects.toThrow(/saknar vy/);
  });

  it("en katalog med trasiga kategorier fälls av katalogmotorn, inte av en kopia här", async () => {
    await expect(svar("kataloger", { id: "sorter", namn: { sv: "Sorter" }, kategorier: [{ id: "x" }] })).rejects.toThrow(/kategorier/);
  });

  it("felet säger vilken modul det gäller", async () => {
    const r = skapaKallregister([modul({ sok: async () => [{ id: "a" }] }, "ekonomi")]);
    await expect(r.sok(GRUPP)).rejects.toThrow(/"ekonomi"/);
  });

  it("en notis utan prio får normal, i stället för att fällas", async () => {
    const rader = await svar("notiser", { id: "a", titel: "T" });
    expect(rader[0].prio).toBe("normal");
    expect(NOTISPRIO).toContain("normal");
  });
});

describe("en utebliven retur är ett fel, inte tomhet", () => {
  it("undefined fälls med skillnaden utskriven", async () => {
    const r = skapaKallregister([modul({ handelser: async () => undefined })]);
    await expect(r.handelser(GRUPP)).rejects.toThrow(/Noll rader skrivs som \[\]/);
  });

  it("en tom lista är ett giltigt svar", async () => {
    const r = skapaKallregister([modul({ handelser: async () => [] })]);
    expect(await r.handelser(GRUPP)).toEqual([]);
  });
});

describe("registret stämplar modulen på raden", () => {
  it("sätter modulId, och tar det inte från raden", async () => {
    const r = skapaKallregister([modul({ sok: async () => [{ id: "a", titel: "T", modulId: "nagon-annan" }] }, "ekonomi")]);
    expect((await r.sok(GRUPP))[0].modulId).toBe("ekonomi");
  });

  it("frågar modulerna i registreringsordning", async () => {
    const r = skapaKallregister([
      modul({ sok: async () => [{ id: "1", titel: "Ett" }] }, "ekonomi"),
      modul({ sok: async () => [{ id: "2", titel: "Tva" }] }, "liv"),
    ]);
    expect((await r.sok(GRUPP)).map((x) => x.modulId)).toEqual(["ekonomi", "liv"]);
  });

  it("hoppar över moduler som inte fyller ytan, utan att fälla dem", async () => {
    const r = skapaKallregister([modul({}, "tyst"), modul({ sok: async () => [{ id: "1", titel: "Ett" }] }, "ekonomi")]);
    expect(r.modulerFor("sok")).toEqual(["ekonomi"]);
    expect((await r.sok(GRUPP)).length).toBe(1);
  });
});

describe("useKallor skiljer på de tre tillstånden", () => {
  /*
   * ⛔ DET HÄR PROVET SAKNADES, OCH SVEPET VISADE DET. `tomt` utan sin
   * laddar-kontroll överlevde, eftersom komponenterna ritar spinnern på
   * `laddar` och aldrig hinner läsa `tomt` under tiden. En app som läser
   * `tomt` utan att först läsa `laddar` hade skrivit "allt är gjort" medan
   * hämtningen pågick, och det är exakt det fältet finns för att förhindra.
   */
  it("tomt är falskt medan hämtningen pågår, inte sant för att listan är tom", async () => {
    const r = skapaKallregister([modul({ handelser: async () => [] })]);
    const { result } = renderHook(() => useKallor(r, "handelser", GRUPP));
    expect(result.current.laddar).toBe(true);
    expect(result.current.tomt).toBe(false);
    await waitFor(() => expect(result.current.laddar).toBe(false));
    expect(result.current.tomt).toBe(true);
  });

  it("tomt är falskt när källan felade, eftersom ett fel inte är tomhet", async () => {
    const r = skapaKallregister([modul({ handelser: async () => [{ title: "Utan id", daysLeft: 0 }] })]);
    const { result } = renderHook(() => useKallor(r, "handelser", GRUPP));
    await waitFor(() => expect(result.current.fel).toBeTruthy());
    expect(result.current.tomt).toBe(false);
  });

  it("utan register laddar den, i stället för att påstå tomhet", () => {
    const { result } = renderHook(() => useKallor(null, "handelser", GRUPP));
    expect(result.current.laddar).toBe(true);
    expect(result.current.tomt).toBe(false);
    expect(result.current.fyller).toEqual([]);
  });
});

describe("Händelseytan läser ur registret", () => {
  it("ritar modulens rader", async () => {
    const r = skapaKallregister([modul({ handelser: async () => [{ id: "a", title: "Deklaration", daysLeft: 3 }] })]);
    render(<OpsModulHandelser register={r} fraga={GRUPP} />);
    await waitFor(() => expect(screen.getByText("Deklaration")).toBeTruthy());
  });

  /*
   * ⛔ TVÅ TOMHETER, TVÅ TEXTER. Det är hela skälet att `fyller` finns.
   */
  it("säger att ingen modul fyller ytan när ingen gör det", async () => {
    render(<OpsModulHandelser register={skapaKallregister([])} fraga={GRUPP} />);
    await waitFor(() => expect(screen.getByText(/Ingen modul lämnar händelser/)).toBeTruthy());
  });

  it("säger att det är tomt när modulen svarade utan rader", async () => {
    const r = skapaKallregister([modul({ handelser: async () => [] })]);
    render(<OpsModulHandelser register={r} fraga={GRUPP} />);
    await waitFor(() => expect(screen.getByText("Inget inplanerat.")).toBeTruthy());
  });

  it("ritar felet i stället för att svälja det till en tom lista", async () => {
    const r = skapaKallregister([modul({ handelser: async () => [{ title: "Utan id", daysLeft: 0 }] })]);
    render(<OpsModulHandelser register={r} fraga={GRUPP} />);
    await waitFor(() => expect(screen.getByText(/saknar id/)).toBeTruthy());
  });
});

describe("Hjälpytan läser ur registret", () => {
  it("ritar modulens hjälptext för routen", async () => {
    const hjalp = vi.fn(async () => [{ titel: { sv: "Om Liv" }, text: { sv: "Så funkar det." } }]);
    render(<OpsModulHjalp register={skapaKallregister([modul({ hjalp })])} fraga={{ groupId: "bolaget", route: "/liv" }} />);
    await waitFor(() => expect(screen.getByText("Om Liv")).toBeTruthy());
    expect(hjalp).toHaveBeenCalledWith({ groupId: "bolaget", route: "/liv" });
  });

  it("ritar ingenting alls när ingen modul har hjälp, inte en tom ruta", async () => {
    const { container } = render(<OpsModulHjalp register={skapaKallregister([])} fraga={{ groupId: "bolaget", route: "/liv" }} />);
    await waitFor(() => expect(container.textContent).toBe(""));
  });
});

describe("Katalogerna i inställningsvyn läser ur registret", () => {
  const katalog = {
    id: "sorter",
    namn: { sv: "Modulens sorter" },
    kategorier: [{ id: "uppgift", namn: { sv: "Uppgift" }, ikon: "gem", farg: 1, fas: "aktiv" }],
  };

  /*
   * ⛔ RUBRIKEN MÄTS PÅ SITT NAMN OCH INTE SOM SYNLIG TEXT. `OpsKatalogInstallning`
   * använder `rubrik` som listans skärmläsarnamn, inte som en rad på skärmen,
   * och ett prov som letat efter texten hade mätt något vyn aldrig lovat.
   */
  it("ritar en inställningsvy per katalog, med katalogens namn på listan", async () => {
    const r = skapaKallregister([modul({ kataloger: async () => [katalog] })]);
    render(<OpsModulKataloger register={r} fraga={GRUPP} ikoner={["gem"]} onSpara={() => {}} onArkivera={() => {}} />);
    await waitFor(() => expect(screen.getByRole("list", { name: "Modulens sorter" })).toBeTruthy());
    expect(screen.getByText("Uppgift")).toBeTruthy();
  });

  it("ritar två vyer när modulen har två kataloger, inte en sammanslagen lista", async () => {
    const annan = { ...katalog, id: "platser", namn: { sv: "Platser" }, kategorier: [{ id: "hemma", namn: { sv: "Hemma" }, ikon: "gem", farg: 2, fas: "aktiv" }] };
    const r = skapaKallregister([modul({ kataloger: async () => [katalog, annan] })]);
    render(<OpsModulKataloger register={r} fraga={GRUPP} ikoner={["gem"]} onSpara={() => {}} onArkivera={() => {}} />);
    await waitFor(() => expect(screen.getByRole("list", { name: "Platser" })).toBeTruthy());
    expect(screen.getByRole("list", { name: "Modulens sorter" })).toBeTruthy();
  });

  it("säger ifrån när ingen modul har kataloger", async () => {
    render(<OpsModulKataloger register={skapaKallregister([])} fraga={GRUPP} ikoner={["gem"]} onSpara={() => {}} onArkivera={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Ingen modul i den här gruppen/)).toBeTruthy());
  });
});
