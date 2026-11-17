import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsProfil } from "../components/OpsProfil.jsx";
import { createMemorySource } from "../data/adapters.js";
import { FALT_BORT } from "../data/contract.js";
import { byggMedlemskap, medlemskapAvslutas } from "../lib/grupp.js";
import { bakfyllMedlemsnamn, uppdateraProfil } from "../node/profil.js";

/**
 * Granskningen av cllp/ops-framework#608 (0.234.0, cllp/lifehub.app#861). Medlemskapet bär sedan 0.234.0 personens adress,
 * och tre följder mäts här: ett avslutat medlemskap bär ingen adress, en rad med adress går igenom profilens och bakfyllnadens
 * skrivvägar utan att kasta, och ett tomt namn stoppas i formuläret i stället för att tyst lämnas orört av servern.
 */

const UID = "Xq9TmP4aLw2RbVn7Kc1HdYe3Zs6F";
const ADRESS = "collan@exempel.se";
const rad = (/** @type {Record<string, unknown>} */ extra = {}) =>
  byggMedlemskap({ userId: UID, groupId: "g", roll: "medlem", typ: "person", status: "aktiv", namn: "Collan", bild: "", epost: ADRESS, ...extra });

describe("⛔ ett avslutat medlemskap bär ingen adress", () => {
  it("medlemskapAvslutas tar bort adressen och sätter avslutad", async () => {
    const m = rad();
    const kalla = createMemorySource({ memberships: [m] });
    await kalla.update("memberships", m.id, medlemskapAvslutas(FALT_BORT));
    const efter = await kalla.read("memberships", m.id);
    expect(efter?.status).toBe("avslutad");
    expect(efter && "epost" in efter).toBe(false);
    expect(efter?.namn).toBe("Collan");
  });

  it("medlemskapAvslutas kräver värdet som tar bort ett fält", () => {
    expect(() => medlemskapAvslutas(undefined)).toThrow(/taBort krävs/);
  });

  it("byggMedlemskap ger ingen adress åt en avslutad rad", () => {
    expect("epost" in rad({ status: "avslutad" })).toBe(false);
    expect(rad().epost).toBe(ADRESS);
  });
});

describe("⛔ en rad med adress får inte profilens eller bakfyllnadens skrivväg att kasta", () => {
  it("uppdateraProfil skriver namnet och lämnar adressen", async () => {
    const m = rad({ namn: "" });
    const kalla = createMemorySource({ users: [{ id: UID, namn: "", epost: ADRESS }], memberships: [m] });
    const svar = await uppdateraProfil({ kalla, uid: UID, andring: { namn: "Collan" } });
    expect(svar.medlemskapUppdaterade).toBe(1);
    expect(await kalla.read("memberships", m.id)).toMatchObject({ namn: "Collan", epost: ADRESS });
  });

  it("bakfyllnaden fyller raden utan fel", async () => {
    const m = rad({ namn: "" });
    const kalla = createMemorySource({ users: [{ id: UID, namn: "Collan", epost: ADRESS }], memberships: [m] });
    const svar = await bakfyllMedlemsnamn({ kalla, skarpt: true });
    expect(svar).toMatchObject({ fyllda: 1, fel: [] });
    expect(await kalla.read("memberships", m.id)).toMatchObject({ namn: "Collan", epost: ADRESS });
  });
});

describe("⛔ uppdateraProfil: ett namn som inte är en sträng kastar", () => {
  for (const namn of [null, 5, { sv: "Collan" }]) {
    it(`namn ${JSON.stringify(namn)}`, async () => {
      const kalla = createMemorySource({ users: [{ id: UID, namn: "Collan", epost: ADRESS }], memberships: [rad()] });
      await expect(uppdateraProfil({ kalla, uid: UID, andring: /** @type {any} */ ({ namn }) })).rejects.toThrow(/namn ska vara en sträng/);
      expect((await kalla.read("users", UID))?.namn).toBe("Collan");
    });
  }

  it("en tom sträng kastar inte, och lämnar namnet orört", async () => {
    const kalla = createMemorySource({ users: [{ id: UID, namn: "Collan", epost: ADRESS }], memberships: [rad()] });
    await uppdateraProfil({ kalla, uid: UID, andring: { namn: "" } });
    expect((await kalla.read("users", UID))?.namn).toBe("Collan");
  });
});

describe("⛔ OpsProfil: ett tömt namn stoppas med ett synligt fel", () => {
  const ANV = { id: UID, namn: "Collan", epost: ADRESS, bild: "", sprak: "sv", tema: "system", telefon: "", stad: "", presentation: "", lankar: [] };

  it("felet syns vid fältet, Spara går inte att trycka och onSpara anropas aldrig", () => {
    const onSpara = vi.fn();
    render(<OpsProfil anvandare={ANV} onSpara={onSpara} />);
    fireEvent.change(screen.getByLabelText("Namn"), { target: { value: "  " } });
    expect(screen.getByText("Skriv ditt namn. Ett tomt namn sparas inte.")).toBeTruthy();
    const spara = screen.getByRole("button", { name: "Spara" });
    expect(spara.hasAttribute("disabled")).toBe(true);
    fireEvent.click(spara);
    expect(onSpara).not.toHaveBeenCalled();
  });

  it("med ett namn i fältet försvinner felet och Spara går att trycka", () => {
    render(<OpsProfil anvandare={ANV} onSpara={() => {}} />);
    const falt = screen.getByLabelText("Namn");
    fireEvent.change(falt, { target: { value: "" } });
    fireEvent.change(falt, { target: { value: "Collan Svensson" } });
    expect(screen.queryByText("Skriv ditt namn. Ett tomt namn sparas inte.")).toBeNull();
    expect(screen.getByRole("button", { name: "Spara" }).hasAttribute("disabled")).toBe(false);
  });
});
