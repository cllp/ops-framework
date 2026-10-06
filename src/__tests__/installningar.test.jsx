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
    // ⛔ Nivå 2, inte 1: appskalet har redan sidans h1, och två h1 gör sidans rubrikträd tvetydigt för en skärmläsare.
    expect(screen.getByRole("heading", { level: 2, name: "Inställningar" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
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
    const varn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<OpsInstallningar sektioner={SEKTIONER} vald="finns-inte" onValj={() => {}} />);
    expect(document.querySelector("[data-installningspanel]")).toBeNull();
    // ⛔ I utvecklingsläge säger komponenten varför listan ritades: en felstavad sektion i en länk syns annars aldrig.
    expect(varn).toHaveBeenCalledWith(expect.stringContaining('"finns-inte"'));
    varn.mockRestore();
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

  it("en sektion utan id, utan rubrik eller utan innehåll vägras", () => {
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    const { innehall: _i, ...utanInnehall } = SEKTIONER[0];
    expect(() => render(<OpsInstallningar sektioner={[{ ...SEKTIONER[0], id: "" }]} vald={null} onValj={() => {}} />)).toThrow(/ett id och en rubrik/);
    expect(() => render(<OpsInstallningar sektioner={[{ ...SEKTIONER[0], rubrik: "" }]} vald={null} onValj={() => {}} />)).toThrow(/ett id och en rubrik/);
    expect(() => render(<OpsInstallningar sektioner={[{ ...SEKTIONER[0], id: 7 }]} vald={null} onValj={() => {}} />)).toThrow(/ett id och en rubrik/);
    expect(() => render(<OpsInstallningar sektioner={[utanInnehall]} vald={null} onValj={() => {}} />)).toThrow(/"gruppen" saknar innehall/);
    fel.mockRestore();
  });

  it("rubriknivån styrs av appen: sidan och panelen på samma nivå, delarna en nivå under", () => {
    render(
      <OpsInstallningar
        rubrikniva={3}
        sektioner={[{ id: "sorter", rubrik: "Inkorgens sorter", innehall: <OpsModulTyper bidrag={[]} yta="inkorg" rubrik="Från moduler" /> }]}
        vald="sorter"
        onValj={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Inställningar" })).toBeTruthy();
    // ⛔ Under 1024 px är listan dold och panelen ensam. Panelens rubrik står då direkt under appskalets rubrik och ska inte hoppa en nivå.
    expect(screen.getByRole("heading", { level: 3, name: "Inkorgens sorter" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 4, name: "Från moduler" })).toBeTruthy();
  });

  it("rubrikniva som inte är ett heltal från 1 till 5 vägras med en läsbar text", () => {
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const dalig of [NaN, 0, 6, 9, 2.5, "3", null]) {
      expect(() => render(<OpsInstallningar rubrikniva={dalig} sektioner={SEKTIONER} vald={null} onValj={() => {}} />), String(dalig)).toThrow(
        /rubrikniva måste vara ett heltal från 1 till 5/,
      );
    }
    for (const bra of [1, 5]) {
      const { unmount } = render(<OpsInstallningar rubrikniva={bra} sektioner={SEKTIONER} vald={null} onValj={() => {}} />);
      expect(screen.getByRole("heading", { level: bra, name: "Inställningar" })).toBeTruthy();
      unmount();
    }
    fel.mockRestore();
  });

  it("engelska ur språket", () => {
    render(<OpsInstallningar sektioner={SEKTIONER} vald="gruppen" onValj={() => {}} sprak="en" />);
    expect(screen.getByRole("heading", { level: 2, name: "Settings" })).toBeTruthy();
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

    describe("katalogens delrubriker följer rubrikniva (0.70.1, granskningen av PR 278)", () => {
      // ⛔ En arkiverad kategori, så att "Arkiverade" ritas. Före 0.70.1 var den h3 eller h4 efter en regel som bara stämde vid nivå 2.
      const MED_ARKIV = validateKatalog(
        [
          { id: "hog", namn: { sv: "Hög" }, farg: 1, ikon: "bell", fas: "aktiv", ordning: 0 },
          { id: "gammal", namn: { sv: "Gammal" }, farg: 2, ikon: "bell", fas: "aktiv", ordning: 1, arkiverad: true },
        ],
        { ikoner: ["bell"], grupp: false },
      );
      const panel = (niva, katalogrubrik) => (
        <OpsInstallningar
          rubrikniva={niva}
          sektioner={[
            {
              id: "prio",
              rubrik: "Prioriteter",
              innehall: (
                <OpsKatalogInstallning kategorier={MED_ARKIV} ikoner={["bell"]} kanAndra onSpara={() => {}} onArkivera={() => {}} rubrik={katalogrubrik} groupId="g" />
              ),
            },
          ]}
          vald="prio"
          onValj={() => {}}
        />
      );
      const arkiverade = () => screen.getByRole("heading", { name: "Arkiverade" });
      const niva = (el) => Number(el.getAttribute("aria-level") || el.tagName.slice(1));

      it("golv: provets katalog har en arkiverad kategori, annars mäter provet ingenting", () => {
        expect(MED_ARKIV.filter((k) => k.arkiverad)).toHaveLength(1);
      });

      it("nivå 2, samma rubrik som panelen: Arkiverade är h3", () => {
        render(panel(2, "Prioriteter"));
        expect(niva(arkiverade())).toBe(3);
      });

      it("nivå 2, annan rubrik: katalogen är h3 och Arkiverade h4", () => {
        render(panel(2, "Lägen"));
        expect(screen.getByRole("heading", { level: 3, name: "Lägen" })).toBeTruthy();
        expect(niva(arkiverade())).toBe(4);
      });

      it("nivå 3, samma rubrik som panelen: Arkiverade är h4, under panelens h3", () => {
        render(panel(3, "Prioriteter"));
        expect(screen.getByRole("heading", { level: 3, name: "Prioriteter" })).toBeTruthy();
        expect(niva(arkiverade())).toBe(4);
      });

      it("nivå 3, annan rubrik: katalogen är h4 och Arkiverade h5", () => {
        render(panel(3, "Lägen"));
        expect(screen.getByRole("heading", { level: 4, name: "Lägen" })).toBeTruthy();
        expect(arkiverade().tagName).toBe("H5");
      });

      it("nivå 5, annan rubrik: Arkiverade är nivå 7 för skärmläsaren, ritad som h6 eftersom HTML slutar där", () => {
        render(panel(5, "Lägen"));
        expect(screen.getByRole("heading", { level: 6, name: "Lägen" })).toBeTruthy();
        expect(arkiverade().tagName).toBe("H6");
        expect(arkiverade().getAttribute("aria-level")).toBe("7");
      });
    });

    it("utan ikonRitare ritas ingen ikonnyckel som text", () => {
      render(katalog("Prioriteter"));
      // ⛔ "bell" är ett namn i appens ikonuppsättning, inte ett ord för den som läser. Det stod som text i varje rad (granskningen av PR 278).
      expect(screen.queryByText("bell")).toBeNull();
    });

    it("utanför en panel är katalogens rubrik nivå 2 som förut", () => {
      render(katalog("Prioriteter"));
      expect(screen.getByRole("heading", { level: 2, name: "Prioriteter" })).toBeTruthy();
    });
  });
});
