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

  it("rubrikniva={undefined} ger förvalet 2", () => {
    render(<OpsInstallningar rubrikniva={undefined} sektioner={SEKTIONER} vald="gruppen" onValj={() => {}} />);
    expect(screen.getByRole("heading", { level: 2, name: "Inställningar" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Gruppen" })).toBeTruthy();
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

    describe("katalogens delrubriker följer rubrikniva (0.71.1, granskningen av PR 278)", () => {
      // ⛔ Underlaget ritar ALLA fyra delrubriker: en arkiverad kategori ("Arkiverade"), en ifylld logg ("Senaste ändringarna"), och
      // med formuläret öppet en textnyckel ("Texter, ...") och förhandsvisningen ("Så här kommer den att se ut"). Före 0.71.1 var de
      // h3 eller h4 efter en regel som bara stämde vid nivå 2, och granskningen visade att en hårdkodad h3 i tre av dem inte fälldes
      // av något prov. Varje delrubrik mäts därför för sig, i varje läge.
      const MED_ARKIV = validateKatalog(
        [
          { id: "hog", namn: { sv: "Hög" }, farg: 1, ikon: "bell", fas: "aktiv", ordning: 0 },
          { id: "gammal", namn: { sv: "Gammal" }, farg: 2, ikon: "bell", fas: "aktiv", ordning: 1, arkiverad: true },
        ],
        { ikoner: ["bell"], grupp: false },
      );
      const LOGG = [{ id: "hog", kategori: "hog", handelse: "tillagd", nar: "2026-10-06T20:00:00Z", efter: { namn: { sv: "Hög" } } }];
      const TEXTNYCKLAR = [{ nyckel: "tom", etikett: "Tomt läge" }];
      const katalogen = (katalogrubrik) => (
        <OpsKatalogInstallning
          kategorier={MED_ARKIV}
          ikoner={["bell"]}
          kanAndra
          onSpara={() => {}}
          onArkivera={() => {}}
          rubrik={katalogrubrik}
          groupId="g"
          logg={LOGG}
          textnycklar={TEXTNYCKLAR}
        />
      );
      /** @param {number | null} niva `null`: katalogen ensam, utan panel. @param {string} katalogrubrik */
      const rita = (niva, katalogrubrik) => {
        render(
          niva === null ? (
            katalogen(katalogrubrik)
          ) : (
            <OpsInstallningar rubrikniva={niva} sektioner={[{ id: "prio", rubrik: "Prioriteter", innehall: katalogen(katalogrubrik) }]} vald="prio" onValj={() => {}} />
          ),
        );
        // Redigeringsläget: formulärets två rubriker finns bara när en kategori läggs till eller ändras.
        fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));
      };
      const niva = (el) => Number(el.getAttribute("aria-level") || el.tagName.slice(1));

      const DELRUBRIKER = ["Arkiverade", "Senaste ändringarna", "Texter, alltså det som gör formuläret begripligt", "Så här kommer den att se ut"];
      // [läge, rubrikniva (null utan panel), katalogens rubrik, katalogens förväntade nivå (null: ritas inte), delrubrikernas nivå]
      const LAGEN = [
        ["utan panel", null, "Prioriteter", 2, 3],
        ["nivå 2, samma rubrik som panelen", 2, "Prioriteter", null, 3],
        ["nivå 2, annan rubrik", 2, "Lägen", 3, 4],
        ["nivå 3, samma rubrik som panelen", 3, "Prioriteter", null, 4],
        ["nivå 3, annan rubrik", 3, "Lägen", 4, 5],
        ["nivå 5, annan rubrik (aria-level 7 på en h6)", 5, "Lägen", 6, 7],
      ];

      it("golv: underlaget har en arkiverad kategori, en loggrad och en textnyckel, och alla fyra delrubriker ritas", () => {
        expect(MED_ARKIV.filter((k) => k.arkiverad)).toHaveLength(1);
        expect(LOGG).toHaveLength(1);
        rita(null, "Prioriteter");
        for (const namn of DELRUBRIKER) expect(screen.getByRole("heading", { name: namn })).toBeTruthy();
      });

      for (const [lage, panelniva, katalogrubrik, katalogniva, underniva] of LAGEN) {
        it(`${lage}: katalogens rubrik ${katalogniva === null ? "ritas inte" : `är nivå ${katalogniva}`}`, () => {
          rita(panelniva, katalogrubrik);
          if (katalogniva === null) {
            expect(screen.getAllByRole("heading", { name: katalogrubrik })).toHaveLength(1);
          } else {
            expect(niva(screen.getByRole("heading", { name: katalogrubrik }))).toBe(katalogniva);
          }
        });
        for (const namn of DELRUBRIKER) {
          it(`${lage}: "${namn}" är nivå ${underniva}`, () => {
            rita(panelniva, katalogrubrik);
            const el = screen.getByRole("heading", { name: namn });
            expect(niva(el)).toBe(underniva);
            expect(el.tagName).toBe(`H${Math.min(underniva, 6)}`);
          });
        }
      }
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
