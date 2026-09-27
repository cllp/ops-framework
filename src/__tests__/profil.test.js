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

describe("⛔ bara språk och tema går att spara", () => {
  it("sparar de två", async () => {
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

  it("⛔ ett okänt tema avvisas FÖRE skrivningen", async () => {
    const kalla = kallaMed();
    const { anvandare } = await sakerstallAnvandare({ kalla, inloggad: INLOGGAD });
    await expect(sparaInstallningar({ kalla, anvandare, andring: { tema: "gult" } })).rejects.toThrow(/users: temat "gult"/);
    expect(await kalla.read("users", "uid-1")).toMatchObject({ tema: "system" });
  });
});

describe("⛔ andringen: beslutet vyn inte får äga", () => {
  const ANV = { id: "uid-1", namn: "CP", epost: "cp@staiger.se", bild: "", sprak: "sv", tema: /** @type {const} */ ("system") };

  it("oförändrat utkast är inte ändrat", () => {
    expect(andringen(ANV, { sprak: "sv", tema: "system" })).toEqual({ andrat: false, andring: { sprak: "sv", tema: "system" } });
  });

  it("ett tomt utkast betyder den sparade raden", () => {
    expect(andringen(ANV)).toEqual({ andrat: false, andring: { sprak: "sv", tema: "system" } });
  });

  it("ett byte av språk är ändrat, och båda fälten följer med", () => {
    expect(andringen(ANV, { sprak: "en" })).toEqual({ andrat: true, andring: { sprak: "en", tema: "system" } });
  });

  it("ett byte av tema är ändrat", () => {
    expect(andringen(ANV, { tema: "morkt" }).andrat).toBe(true);
  });

  /*
   * ⛔ BÅDA FÄLTEN SKICKAS ALLTID, ÄVEN DET OFÖRÄNDRADE. En delvis nyttolast
   * hade fungerat mot `update`, men `sparaInstallningar` validerar hela raden
   * med `byggAnvandare`, och den behöver båda för att kunna säga nej till ett
   * tema som inte finns.
   */
  it("det oförändrade fältet skickas med", () => {
    expect(andringen({ ...ANV, tema: "morkt" }, { sprak: "en" }).andring).toEqual({ sprak: "en", tema: "morkt" });
  });
});
