import { describe, it, expect } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { andringen, sakerstallAnvandare, sparaInstallningar } from "../lib/profil.js";

/**
 * Fas 2.5 i epiken #92: profilraden (#138).
 *
 * ⛔ PROVEN HANDLAR OM VAD SOM INTE SKRIVS ÖVER. Klarkriteriet är uttryckligen
 * att en ANDRA inloggning inte får röra språk eller tema, och det är det enda
 * felet i den här filen som inte ser ut som ett fel: appen minns bara inte.
 */

const INLOGGAD = { uid: "uid-1", namn: "CP", epost: "CP@Staiger.se", bild: "https://x/y.png" };

/** Minneskällan tar LISTOR per samling, inte en karta. */
const kallaMed = (/** @type {any[]} */ rader = []) => createMemorySource({ users: rader });

describe("första inloggningen skapar raden", () => {
  it("skapar och svarar att den skapades", async () => {
    const kalla = kallaMed();
    const { anvandare, skapad } = await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    expect(skapad).toBe(true);
    expect(anvandare).toMatchObject({ id: "uid-1", namn: "CP", epost: "cp@staiger.se", sprak: "sv", tema: "system" });
  });

  it("raden ligger kvar i källan efteråt", async () => {
    const kalla = kallaMed();
    await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    expect(await kalla.read("users", "uid-1")).toMatchObject({ epost: "cp@staiger.se" });
  });

  it("uid krävs", async () => {
    await expect(sakerstallAnvandare({ kalla: kallaMed(), inloggad: /** @type {any} */ ({}) })).rejects.toThrow(
      /sakerstallAnvandare: den inloggades uid krävs/,
    );
  });

  it("en källa utan read och create avvisas", async () => {
    await expect(sakerstallAnvandare({ kalla: /** @type {any} */ ({}), inloggad: INLOGGAD })).rejects.toThrow(
      /sakerstallAnvandare: en datakälla med read och create krävs/,
    );
  });
});

describe("⛔ en andra inloggning rör inte språk eller tema", () => {
  it("skriver inte över valen", async () => {
    const kalla = kallaMed();
    await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    await sparaInstallningar({
      kalla,
      anvandare: (await sakerstallAnvandare({ kalla, inloggad: INLOGGAD })).anvandare,
      andring: { sprak: "en", tema: "morkt" },
    });

    const { anvandare, skapad } = await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    expect(skapad).toBe(false);
    expect([anvandare.sprak, anvandare.tema]).toEqual(["en", "morkt"]);
  });

  it("⛔ rör inte heller namnet, även om inloggningen bytt det", async () => {
    const kalla = kallaMed();
    await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    const { anvandare } = await sakerstallAnvandare({ kalla, inloggad: { ...INLOGGAD, namn: "Nytt namn" } });
    expect(anvandare.namn).toBe("CP");
  });

  it("en trasig rad i databasen syns här och inte som en tom rullgardin", async () => {
    const kalla = kallaMed([{ id: "uid-1", namn: "CP", epost: "cp@staiger.se", bild: "", sprak: "no", tema: "system" }]);
    await expect(sakerstallAnvandare({ kalla, inloggad: INLOGGAD })).rejects.toThrow(/users: språket "no" för "uid-1" finns inte/);
  });
});

describe("⛔ personens egna fält går att spara (#156 utökade utöver språk och tema)", () => {
  it("sparar språk och tema", async () => {
    const kalla = kallaMed();
    const { anvandare } = await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    const nasta = await sparaInstallningar({ kalla, anvandare, andring: { tema: "ljust" } });
    expect(nasta.tema).toBe("ljust");
    expect(await kalla.read("users", "uid-1")).toMatchObject({ tema: "ljust" });
  });

  it("⛔ e-posten går inte att spara här, den är identiteten", async () => {
    const kalla = kallaMed();
    const { anvandare } = await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    await expect(sparaInstallningar({ kalla, anvandare, andring: /** @type {any} */ ({ epost: "annan@x.se" }) })).rejects.toThrow(
      /sparaInstallningar: fälten epost går inte att spara här/,
    );
  });

  it("⛔ id går inte att spara här heller, det är nyckeln", async () => {
    const kalla = kallaMed();
    const { anvandare } = await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    await expect(sparaInstallningar({ kalla, anvandare, andring: /** @type {any} */ ({ id: "annat-uid" }) })).rejects.toThrow(
      /sparaInstallningar: fälten id går inte att spara här/,
    );
  });

  it("⛔ ett okänt tema avvisas FÖRE skrivningen", async () => {
    const kalla = kallaMed();
    const { anvandare } = await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    await expect(sparaInstallningar({ kalla, anvandare, andring: { tema: "gult" } })).rejects.toThrow(/users: temat "gult"/);
    expect(await kalla.read("users", "uid-1")).toMatchObject({ tema: "system" });
  });

  it("#156: sparar namn och bild, sedan personen själv redigerar dem", async () => {
    const kalla = kallaMed();
    const { anvandare } = await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    const nasta = await sparaInstallningar({ kalla, anvandare, andring: { namn: "Claes Philip", bild: "https://minlagring/1.jpg" } });
    expect(nasta.namn).toBe("Claes Philip");
    expect(nasta.bild).toBe("https://minlagring/1.jpg");
    expect(await kalla.read("users", "uid-1")).toMatchObject({ namn: "Claes Philip", bild: "https://minlagring/1.jpg" });
  });

  it("#156: sparar telefon, stad, presentation, lankar och bildSokvag", async () => {
    const kalla = kallaMed();
    const { anvandare } = await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    const nasta = await sparaInstallningar({
      kalla,
      anvandare,
      andring: {
        telefon: "+46701234567",
        stad: "Visby",
        presentation: "Grundare av Claes Philip Staiger AB.",
        lankar: [{ plattform: "webbplats", url: "https://staiger.se" }],
        bildSokvag: "profilbilder/uid-1/1.jpg",
      },
      tillatnaPlattformar: ["webbplats"],
    });
    expect(nasta).toMatchObject({
      telefon: "+46701234567",
      stad: "Visby",
      presentation: "Grundare av Claes Philip Staiger AB.",
      lankar: [{ plattform: "webbplats", url: "https://staiger.se" }],
      bildSokvag: "profilbilder/uid-1/1.jpg",
    });
    expect(await kalla.read("users", "uid-1")).toMatchObject({ telefon: "+46701234567", stad: "Visby" });
  });

  it("#156: ett ogiltigt telefonnummer avvisas FÖRE skrivningen", async () => {
    const kalla = kallaMed();
    const { anvandare } = await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    await expect(sparaInstallningar({ kalla, anvandare, andring: { telefon: "0701234567" } })).rejects.toThrow(/inte E\.164/);
    expect(await kalla.read("users", "uid-1")).toMatchObject({ telefon: "" });
  });

  it("#156: en plattform utanför appens lista avvisas FÖRE skrivningen", async () => {
    const kalla = kallaMed();
    const { anvandare } = await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    await expect(
      sparaInstallningar({ kalla, anvandare, andring: { lankar: [{ plattform: "myspace", url: "https://myspace.com/cp" }] }, tillatnaPlattformar: ["webbplats"] }),
    ).rejects.toThrow(/plattformen "myspace" som inte finns/);
  });
});

describe("⛔ andringen: beslutet vyn inte får äga", () => {
  const ANV = {
    id: "uid-1",
    namn: "CP",
    epost: "cp@staiger.se",
    bild: "",
    sprak: "sv",
    tema: /** @type {const} */ ("system"),
    telefon: "",
    stad: "",
    presentation: "",
    lankar: /** @type {{ plattform: string, url: string }[]} */ ([]),
    bildSokvag: "",
  };

  /** Fältens fulla svar när inget alls ändrats, dvs en spegling av ANV utan id/epost. */
  const OFORANDRAT = { sprak: "sv", tema: "system", namn: "CP", telefon: "", stad: "", presentation: "", lankar: [], bild: "", bildSokvag: "" };

  it("oförändrat utkast är inte ändrat", () => {
    expect(andringen(ANV, { sprak: "sv", tema: "system" })).toEqual({ andrat: false, andring: OFORANDRAT });
  });

  it("ett tomt utkast betyder den sparade raden", () => {
    expect(andringen(ANV)).toEqual({ andrat: false, andring: OFORANDRAT });
  });

  it("ett byte av språk är ändrat, och alla fält följer med", () => {
    expect(andringen(ANV, { sprak: "en" })).toEqual({ andrat: true, andring: { ...OFORANDRAT, sprak: "en" } });
  });

  it("ett byte av tema är ändrat", () => {
    expect(andringen(ANV, { tema: "morkt" }).andrat).toBe(true);
  });

  it("⛔ #156: ett byte av namn, telefon, stad, presentation, bild eller lankar räknas också som ändrat", () => {
    expect(andringen(ANV, { namn: "Ny" }).andrat).toBe(true);
    expect(andringen(ANV, { telefon: "+46701234567" }).andrat).toBe(true);
    expect(andringen(ANV, { stad: "Visby" }).andrat).toBe(true);
    expect(andringen(ANV, { presentation: "Ny text." }).andrat).toBe(true);
    expect(andringen(ANV, { bild: "https://x/y.png" }).andrat).toBe(true);
    expect(andringen(ANV, { lankar: [{ plattform: "webbplats", url: "https://staiger.se" }] }).andrat).toBe(true);
  });

  it("⛔ lankar jämförs som VÄRDE, inte som referens: samma innehåll i en ny array är inte ändrat", () => {
    expect(andringen(ANV, { lankar: [] }).andrat).toBe(false);
    const medLank = { ...ANV, lankar: [{ plattform: "webbplats", url: "https://staiger.se" }] };
    expect(andringen(medLank, { lankar: [{ plattform: "webbplats", url: "https://staiger.se" }] }).andrat).toBe(false);
  });

  /*
   * ⛔ VARJE FÄLT SKICKAS ALLTID, ÄVEN DE OFÖRÄNDRADE. En delvis nyttolast
   * hade fungerat mot `update`, men `sparaInstallningar` validerar hela raden
   * med `byggAnvandare`, och den behöver alla för att kunna säga nej till ett
   * tema som inte finns.
   */
  it("de oförändrade fälten skickas med", () => {
    expect(andringen({ ...ANV, tema: "morkt" }, { sprak: "en" }).andring).toEqual({ ...OFORANDRAT, sprak: "en", tema: "morkt" });
  });
});
