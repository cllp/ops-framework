import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpsGruppSida } from "../components/OpsGruppSida.jsx";
import { OpsMedlemmar } from "../components/OpsMedlemmar.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { NAMN_LADDAS, NAMN_SAKNAS, glomVarnade, personnamn } from "../lib/personnamn.js";

/*
 * ⛔ "NAMN SAKNAS SKALL ALDRIG FINNAS INTE ENS UNDER PROGRESS" (0.240.0).
 *
 * CP 2026-11-18, med en skärmbild av gruppens Medlemmar: medan adresserna hämtades (appens `useMedlemsadresser`, ett eget anrop
 * efter att listan ritats) stod "Namn saknas" för den som saknar namn i medlemskapet. Två ändringar provas här: vyn som vet att
 * namnen hämtas skickar `namnLaddas` och raden säger "Hämtar namn …", och den sista reserven är "Okänd person", aldrig "Namn saknas".
 */

const GAMMAL = "Namn saknas";
const G = { id: "g", namn: "Alfa" };
const UTAN = { id: "u-utan", namn: "", roll: "admin", epost: "", bild: "" };
const MED = { id: "u-med", namn: "Anna Berg", roll: "agare", epost: "", bild: "" };

afterEach(() => {
  glomVarnade();
  vi.restoreAllMocks();
});

describe("personnamn medan namnen hämtas", () => {
  it("ger Hämtar namn … med laddar, och aldrig den gamla texten", () => {
    expect(personnamn("", { id: "x", laddar: true })).toEqual({ text: NAMN_LADDAS, saknas: true, laddar: true });
    expect(NAMN_LADDAS).toBe("Hämtar namn …");
  });

  it("ett namn eller en adress vinner över laddningen", () => {
    expect(personnamn("Bo", { id: "x", laddar: true }).text).toBe("Bo");
    expect(personnamn("", { id: "x", epost: "bo@exempel.se", laddar: true }).text).toBe("bo@exempel.se");
  });

  it("⛔ den sista reserven är Okänd person, aldrig Namn saknas", () => {
    expect(NAMN_SAKNAS).toBe("Okänd person");
    expect(personnamn("", { id: "x" }).text).not.toBe(GAMMAL);
  });
});

describe("OpsGruppSida med namnLaddas", () => {
  it("raden utan namn säger Hämtar namn … medan appen hämtar, och ingen varning skrivs", () => {
    const varn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<OpsGruppSida grupp={G} medlemmar={[MED, UTAN]} namnLaddas />);
    expect(container.textContent).toContain("Hämtar namn …");
    expect(container.textContent).not.toContain(GAMMAL);
    expect(container.textContent).toContain("Anna Berg");
    expect(container.querySelector('[data-medlemsrad="u-utan"] [data-namn-laddas]')).not.toBeNull();
    expect(container.querySelector("[data-namn-saknas]")).toBeNull();
    expect(varn).not.toHaveBeenCalled();
  });

  it("när adressen kommit står adressen, och laddningstexten är borta", () => {
    const { container, rerender } = render(<OpsGruppSida grupp={G} medlemmar={[MED, UTAN]} namnLaddas />);
    rerender(<OpsGruppSida grupp={G} medlemmar={[MED, { ...UTAN, epost: "ss@exempel.se" }]} namnLaddas={false} />);
    expect(container.textContent).toContain("ss@exempel.se");
    expect(container.textContent).not.toContain("Hämtar namn");
    expect(container.querySelector("[data-namn-laddas]")).toBeNull();
  });

  it("utan namnLaddas och utan adress: Okänd person, märkt för mätning", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<OpsGruppSida grupp={G} medlemmar={[UTAN]} />);
    expect(container.querySelector("[data-namn-saknas]")?.textContent).toBe("Okänd person");
    expect(container.textContent).not.toContain(GAMMAL);
  });

  it("på engelska: Loading name … och Unknown person", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const laddar = render(
      <OpsSprakProvider sprak="en">
        <OpsGruppSida grupp={G} medlemmar={[UTAN]} namnLaddas />
      </OpsSprakProvider>,
    );
    expect(laddar.container.textContent).toContain("Loading name …");
    laddar.unmount();
    const klar = render(
      <OpsSprakProvider sprak="en">
        <OpsGruppSida grupp={G} medlemmar={[UTAN]} />
      </OpsSprakProvider>,
    );
    expect(klar.container.textContent).toContain("Unknown person");
  });
});

describe("OpsMedlemmar med namnLaddas", () => {
  it("raden utan namn säger Hämtar namn …, aldrig Namn saknas", () => {
    const rad = { medlemskap: { id: "g_u", groupId: "g", userId: "u-utan", roll: "medlem", namn: "", bild: "" } };
    const { container } = render(<OpsMedlemmar medlemmar={[/** @type {any} */ (rad)]} migUid="mig" namnLaddas />);
    expect(screen.getByText("Hämtar namn …")).toBeTruthy();
    expect(container.textContent).not.toContain(GAMMAL);
    expect(container.querySelector("[data-namn-saknas]")).toBeNull();
  });
});
