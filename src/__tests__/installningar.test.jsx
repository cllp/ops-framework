import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { OpsInstallningar } from "../components/OpsInstallningar.jsx";
import { OpsKatalogInstallning } from "../components/OpsKatalogInstallning.jsx";
import { OpsModulTyper } from "../components/OpsModulTyper.jsx";
import { validateKatalog } from "../lib/katalog.js";

/**
 * Inställningarna som lista och panel (0.69.0, #274).
 *
 * ⛔ PROVEN MÄTER NAVIGERINGEN, INTE ATT KOMPONENTEN RITAS: ett val skrivs till adressen, tillbaka skriver `null`, webbläsarens
 * tillbaka (adressen ändras utifrån) stänger panelen, fokus flyttas till rubriken och tillbaka till raden, och ett okänt id i
 * adressen ritar listan och ingen tom panel. Layouten (en eller två kolumner, 56 px, ingen överflödning) mäts i check-skalyta
 * avsnitt 43, eftersom jsdom inte kör CSS.
 */

const SEKTIONER = [
  { id: "gruppen", rubrik: "Gruppen", beskrivning: "Namn, färg och ikon", innehall: <p>Gruppens innehåll</p> },
  { id: "medlemmar", rubrik: "Medlemmar", beskrivning: "Vilka som är med", antal: 4, innehall: <p>Medlemmarnas innehåll</p> },
  { id: "kalendrar", rubrik: "Kalendrar", antal: 0, innehall: <p>Kalendrarnas innehåll</p> },
];

/** Adressen som appen äger: `?sektion=` i jsdoms `window.location`, och `popstate` för webbläsarens tillbaka. */
function MedAdress({ sektioner = SEKTIONER }) {
  const las = () => new URLSearchParams(window.location.search).get("sektion");
  const [vald, setVald] = useState(las);
  // Webbläsarens tillbaka: appen lyssnar på popstate och läser adressen igen.
  useState(() => window.addEventListener("popstate", () => setVald(las())));
  return (
    <OpsInstallningar
      sektioner={sektioner}
      vald={vald}
      onValj={(id) => {
        window.history.pushState(null, "", id ? `?sektion=${id}` : window.location.pathname);
        setVald(id);
      }}
    />
  );
}

const rad = (namn) => screen.getByRole("button", { name: new RegExp(`^${namn}`) });

describe("OpsInstallningar", () => {
  it("listan är en lista med knappar, med rubrik, beskrivning och antal, och 0 står som 0", () => {
    render(<OpsInstallningar sektioner={SEKTIONER} vald={null} onValj={() => {}} />);
    const lista = screen.getByRole("list");
    expect(lista.querySelectorAll("li > button")).toHaveLength(3);
    expect(rad("Medlemmar").textContent).toContain("Vilka som är med");
    expect(rad("Medlemmar").querySelector("[data-antal]")?.textContent).toBe("4");
    expect(rad("Kalendrar").querySelector("[data-antal]")?.textContent).toBe("0");
    expect(rad("Gruppen").querySelector("[data-antal]")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Inställningar" })).toBeTruthy();
    expect(screen.queryByText("Gruppens innehåll")).toBeNull();
  });

  it("ett val skriver id:t till adressen och öppnar panelen; tillbaka skriver null och stänger den", () => {
    window.history.replaceState(null, "", "/installningar");
    render(<MedAdress />);
    fireEvent.click(rad("Medlemmar"));
    expect(window.location.search).toBe("?sektion=medlemmar");
    expect(screen.getByRole("heading", { level: 2, name: "Medlemmar" })).toBeTruthy();
    expect(screen.getByText("Medlemmarnas innehåll")).toBeTruthy();
    expect(rad("Medlemmar").getAttribute("aria-current")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    expect(window.location.search).toBe("");
    expect(screen.queryByText("Medlemmarnas innehåll")).toBeNull();
  });

  it("adressen styr: en sida som öppnas med ?sektion= visar den sektionen, och webbläsarens tillbaka stänger den", async () => {
    window.history.replaceState(null, "", "/installningar");
    window.history.pushState(null, "", "/installningar?sektion=kalendrar");
    render(<MedAdress />);
    expect(screen.getByText("Kalendrarnas innehåll")).toBeTruthy();
    await act(async () => {
      window.history.back();
      await new Promise((r) => window.addEventListener("popstate", r, { once: true }));
    });
    expect(window.location.search).toBe("");
    expect(screen.queryByText("Kalendrarnas innehåll")).toBeNull();
  });

  it("ett okänt id i adressen ritar listan och ingen tom panel", () => {
    render(<OpsInstallningar sektioner={SEKTIONER} vald="finns-inte" onValj={() => {}} />);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tillbaka" })).toBeNull();
    for (const b of screen.getByRole("list").querySelectorAll("button")) expect(b.getAttribute("aria-current")).toBeNull();
  });

  it("tangentbordet: fokus går till panelens rubrik när den öppnas och tillbaka till raden när man går tillbaka", () => {
    window.history.replaceState(null, "", "/installningar");
    render(<MedAdress />);
    rad("Medlemmar").focus();
    fireEvent.click(rad("Medlemmar"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: "Medlemmar" }));
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    expect(document.activeElement).toBe(rad("Medlemmar"));
  });

  it("webbläsarens tillbaka lämnar också fokus på raden man kom ifrån", async () => {
    window.history.replaceState(null, "", "/installningar");
    render(<MedAdress />);
    fireEvent.click(rad("Kalendrar"));
    await act(async () => {
      window.history.back();
      await new Promise((r) => window.addEventListener("popstate", r, { once: true }));
    });
    expect(document.activeElement).toBe(rad("Kalendrar"));
  });

  it("första ritningen med en sektion ur adressen flyttar inget fokus", () => {
    const fore = document.createElement("input");
    document.body.appendChild(fore);
    fore.focus();
    render(<OpsInstallningar sektioner={SEKTIONER} vald="medlemmar" onValj={() => {}} />);
    expect(document.activeElement).toBe(fore);
    fore.remove();
  });

  it("två sektioner med samma id vägras, och onValj krävs", () => {
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsInstallningar sektioner={[SEKTIONER[0], SEKTIONER[0]]} vald={null} onValj={() => {}} />)).toThrow(/unikt/);
    expect(() => render(<OpsInstallningar sektioner={SEKTIONER} vald={null} />)).toThrow(/onValj krävs/);
    fel.mockRestore();
  });

  it("engelska ur språket", () => {
    render(<OpsInstallningar sektioner={SEKTIONER} vald="gruppen" onValj={() => {}} sprak="en" />);
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });

  describe("en rubrik, inte två", () => {
    const KAT = validateKatalog([{ id: "hog", namn: { sv: "Hög" }, farg: 1, ikon: "bell", fas: "aktiv", ordning: 0 }], { ikoner: ["bell"], grupp: false });
    const katalog = (rubrik) => (
      <OpsKatalogInstallning kategorier={KAT} ikoner={["bell"]} kanAndra onSpara={() => {}} onArkivera={() => {}} rubrik={rubrik} groupId="g" />
    );

    it("en katalog med samma rubrik som panelen ritar ingen egen rubrik, och sektionen heter som panelen", () => {
      render(<OpsInstallningar sektioner={[{ id: "prio", rubrik: "Prioriteter", innehall: katalog("Prioriteter") }]} vald="prio" onValj={() => {}} />);
      expect(screen.getAllByRole("heading", { name: "Prioriteter" })).toHaveLength(1);
      const panelrubrik = screen.getByRole("heading", { level: 2, name: "Prioriteter" });
      const katalogdel = /** @type {HTMLElement} */ (document.querySelector("[data-installningspanel] section"));
      expect(katalogdel.getAttribute("aria-labelledby")).toBe(panelrubrik.id);
    });

    it("en katalog med en annan rubrik blir nivå 3 under panelens nivå 2, och modultyperna likaså", () => {
      render(
        <OpsInstallningar
          sektioner={[
            { id: "sorter", rubrik: "Inkorgens sorter", innehall: <>{katalog("Sorter")}<OpsModulTyper bidrag={[]} yta="inkorg" rubrik="Från moduler" /></> },
          ]}
          vald="sorter"
          onValj={() => {}}
        />,
      );
      expect(screen.getByRole("heading", { level: 2, name: "Inkorgens sorter" })).toBeTruthy();
      expect(screen.getByRole("heading", { level: 3, name: "Sorter" })).toBeTruthy();
      expect(screen.getByRole("heading", { level: 3, name: "Från moduler" })).toBeTruthy();
    });

    it("utanför en panel är katalogens rubrik nivå 2 som förut", () => {
      render(katalog("Prioriteter"));
      expect(screen.getByRole("heading", { level: 2, name: "Prioriteter" })).toBeTruthy();
    });
  });
});
