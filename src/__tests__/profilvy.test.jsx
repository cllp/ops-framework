import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpsProfil } from "../components/OpsProfil.jsx";
import { OpsAnvandarmeny } from "../components/OpsAnvandarmeny.jsx";
import { OpsAppShell } from "../components/OpsAppShell.jsx";

/**
 * Fas 2.5: profilvyn och användarmenyn (#138).
 *
 * ⛔ PROVEN MÄTER VAD SOM SYNS OCH VAD SOM GÅR ATT GÖRA, inte att en
 * komponent renderar utan att kasta. Ett prov som bara monterar är grönt genom
 * varje fel som inte är ett undantag.
 */

const ANV = {
  id: "uid-1",
  namn: "Claes Philip",
  epost: "cp@staiger.se",
  bild: "",
  sprak: "sv",
  tema: /** @type {const} */ ("system"),
};

describe("OpsProfil", () => {
  it("visar namn och e-post", () => {
    render(<OpsProfil anvandare={ANV} onSpara={() => {}} />);
    expect(screen.getByText("Claes Philip")).toBeTruthy();
    expect(screen.getByText("cp@staiger.se")).toBeTruthy();
  });

  it("⛔ visar e-posten när namnet saknas, aldrig en tom rad", () => {
    render(<OpsProfil anvandare={{ ...ANV, namn: "" }} onSpara={() => {}} />);
    expect(screen.getAllByText("cp@staiger.se").length).toBeGreaterThan(0);
  });

  it("⛔ Spara är avstängd tills något ändrats", () => {
    render(<OpsProfil anvandare={ANV} onSpara={() => {}} />);
    expect(screen.getByRole("button", { name: "Spara" }).hasAttribute("disabled")).toBe(true);
  });

  /*
   * ⛔ VÄLJARNA DRIVS INTE HÄR, OCH DET ÄR ETT MÄTT BESLUT. `OpsSelect` är en
   * Radix Select, alltså ingen `<select>`: `fireEvent.change` gör ingenting,
   * och provet jag först skrev var grönt på `not.toHaveBeenCalled` medan det
   * röda på `toHaveBeenCalledWith` avslöjade att inget hänt alls.
   *
   * Ett prov som inte kan driva sitt eget scenario mäter ingenting. Beslutet
   * ligger därför i `andringen()` i profil.js och provas i profil.test.js, och
   * här mäts bara det som faktiskt går att se: att väljarna finns med rätt
   * etikett, och att Spara är avstängd tills något ändrats.
   */
  it("båda väljarna finns med sina etiketter", () => {
    render(<OpsProfil anvandare={ANV} onSpara={() => {}} />);
    expect(screen.getByLabelText("Språk")).toBeTruthy();
    expect(screen.getByLabelText("Utseende")).toBeTruthy();
  });

  it("Spara är på när utkastet skiljer sig från den sparade raden", () => {
    render(<OpsProfil anvandare={{ ...ANV, tema: "morkt" }} onSpara={() => {}} />);
    expect(screen.getByRole("button", { name: "Spara" }).hasAttribute("disabled")).toBe(true);
  });

  it("⛔ tomhet är ett svar: utan grupper står en mening, inte en tom lista", () => {
    render(<OpsProfil anvandare={ANV} onSpara={() => {}} />);
    expect(screen.getByText("Du är inte med i någon grupp än.")).toBeTruthy();
  });

  it("grupperna visas med roll", () => {
    const grupper = [
      { grupp: { id: "bolaget", namn: { sv: "Bolaget" } }, roll: "agare" },
      { grupp: { id: "annat", namn: { sv: "Annat" } }, roll: "medlem" },
    ];
    render(<OpsProfil anvandare={ANV} grupper={grupper} onSpara={() => {}} />);
    expect(screen.getByText("Bolaget")).toBeTruthy();
    expect(screen.getByText("Ägare")).toBeTruthy();
    expect(screen.getByText("Medlem")).toBeTruthy();
  });

  it("etiketterna går att översätta", () => {
    render(<OpsProfil anvandare={ANV} onSpara={() => {}} rubrik="Profile" sprakEtikett="Language" sparaEtikett="Save" />);
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getByLabelText("Language")).toBeTruthy();
  });
});

describe("OpsAnvandarmeny", () => {
  it("knappen bär personens namn, inte bara ordet knapp", () => {
    render(<OpsAnvandarmeny anvandare={ANV} onLoggaUt={() => {}} />);
    expect(screen.getByRole("button", { name: "Konto, Claes Philip" })).toBeTruthy();
  });

  it("⛔ utloggningen finns bakom menyn och anropas", () => {
    const onLoggaUt = vi.fn();
    render(<OpsAnvandarmeny anvandare={ANV} onLoggaUt={onLoggaUt} />);
    fireEvent.click(screen.getByRole("button", { name: "Konto, Claes Philip" }));
    fireEvent.click(screen.getByRole("button", { name: "Logga ut" }));
    expect(onLoggaUt).toHaveBeenCalledTimes(1);
  });

  it("profilraden finns bara när appen skickar in onProfil", () => {
    const { unmount } = render(<OpsAnvandarmeny anvandare={ANV} onLoggaUt={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Konto, Claes Philip" }));
    expect(screen.queryByRole("button", { name: "Profil" })).toBeNull();
    unmount();

    render(<OpsAnvandarmeny anvandare={ANV} onLoggaUt={() => {}} onProfil={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Konto, Claes Philip" }));
    expect(screen.getByRole("button", { name: "Profil" })).toBeTruthy();
  });

  it("menyn visar vem man är inloggad som", () => {
    render(<OpsAnvandarmeny anvandare={ANV} onLoggaUt={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Konto, Claes Philip" }));
    expect(screen.getByText("cp@staiger.se")).toBeTruthy();
  });
});

describe("⛔ skalets användarfack", () => {
  it("renderar det som skickas in", () => {
    render(
      <OpsAppShell
        brand="Ops"
        nav={[{ href: "/", label: "Start" }]}
        activeHref="/"
        anvandare={<OpsAnvandarmeny anvandare={ANV} onLoggaUt={() => {}} />}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    expect(screen.getByRole("button", { name: "Konto, Claes Philip" })).toBeTruthy();
  });

  it("skalet fungerar utan facket", () => {
    render(
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/">
        <p>innehåll</p>
      </OpsAppShell>,
    );
    expect(screen.queryByRole("button", { name: /Konto/ })).toBeNull();
  });
});
