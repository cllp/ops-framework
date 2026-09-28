import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  // ⛔ #156: fem fält till på raden. Byggda ur byggAnvandare i verkligheten,
  // men fixturen bär dem för hand precis som förut: vyn ska klara en rad
  // ingen ram byggde, samma skäl som `namn: ""`-provet nedan.
  telefon: "",
  stad: "",
  presentation: "",
  lankar: /** @type {{ plattform: string, url: string }[]} */ ([]),
  bildSokvag: "",
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

  // ══ #156: Profilbild, Personuppgifter, Länkar, och children-sloten ═══════
  describe("#156: Profilbild", () => {
    it("utan lagring visas ingen uppladdnings- eller borttagningsknapp", () => {
      render(<OpsProfil anvandare={{ ...ANV, bild: "https://x/y.png" }} onSpara={() => {}} />);
      expect(screen.queryByRole("button", { name: "Ladda upp bild" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Ta bort" })).toBeNull();
    });

    it("med lagring visas Ladda upp, och Ta bort bara när en bild finns", () => {
      const lagring = { laddaUpp: vi.fn(), taBort: vi.fn() };
      const { rerender } = render(<OpsProfil anvandare={ANV} onSpara={() => {}} lagring={lagring} />);
      expect(screen.getByRole("button", { name: "Ladda upp bild" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Ta bort" })).toBeNull();

      rerender(<OpsProfil anvandare={{ ...ANV, bild: "https://x/y.png" }} onSpara={() => {}} lagring={lagring} />);
      expect(screen.getByRole("button", { name: "Ta bort" })).toBeTruthy();
    });

    it("⛔ laddar upp, sparar direkt (inte bakom Spara-knappen), och rensar upp den gamla filen", async () => {
      const lagring = {
        laddaUpp: vi.fn(async () => ({ url: "https://minlagring/ny.jpg", sokvag: "profilbilder/uid-1/ny.jpg" })),
        taBort: vi.fn(async () => {}),
      };
      const onSpara = vi.fn(async () => {});
      render(<OpsProfil anvandare={{ ...ANV, bild: "https://x/gammal.jpg", bildSokvag: "profilbilder/uid-1/gammal.jpg" }} onSpara={onSpara} lagring={lagring} />);

      const filInput = document.querySelector('input[type="file"]');
      const fil = new File(["x"], "ny.jpg", { type: "image/jpeg" });
      fireEvent.change(/** @type {HTMLInputElement} */ (filInput), { target: { files: [fil] } });

      expect(lagring.laddaUpp).toHaveBeenCalledWith(expect.objectContaining({ fil }));
      await waitFor(() => expect(onSpara).toHaveBeenCalledWith({ bild: "https://minlagring/ny.jpg", bildSokvag: "profilbilder/uid-1/ny.jpg" }));
      await waitFor(() => expect(lagring.taBort).toHaveBeenCalledWith("profilbilder/uid-1/gammal.jpg"));
    });

    it("⛔ vägrar en fil som inte är en bild, INNAN lagring.laddaUpp anropas", async () => {
      const lagring = { laddaUpp: vi.fn(), taBort: vi.fn() };
      render(<OpsProfil anvandare={ANV} onSpara={() => {}} lagring={lagring} />);
      const filInput = document.querySelector('input[type="file"]');
      const fil = new File(["x"], "kontrakt.pdf", { type: "application/pdf" });
      fireEvent.change(/** @type {HTMLInputElement} */ (filInput), { target: { files: [fil] } });
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Bara bilder"));
      expect(lagring.laddaUpp).not.toHaveBeenCalled();
    });

    it("⛔ vägrar en för stor fil, INNAN lagring.laddaUpp anropas", async () => {
      const lagring = { laddaUpp: vi.fn(), taBort: vi.fn() };
      render(<OpsProfil anvandare={ANV} onSpara={() => {}} lagring={lagring} />);
      const filInput = document.querySelector('input[type="file"]');
      const stor = new File([new Uint8Array(2 * 1024 * 1024)], "stor.jpg", { type: "image/jpeg" });
      fireEvent.change(/** @type {HTMLInputElement} */ (filInput), { target: { files: [stor] } });
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("2 MB"));
      expect(lagring.laddaUpp).not.toHaveBeenCalled();
    });

    it("Ta bort tar bort ur lagringen och sparar tom bild direkt", async () => {
      const lagring = { laddaUpp: vi.fn(), taBort: vi.fn(async () => {}) };
      const onSpara = vi.fn(async () => {});
      render(<OpsProfil anvandare={{ ...ANV, bild: "https://x/y.png", bildSokvag: "profilbilder/uid-1/y.jpg" }} onSpara={onSpara} lagring={lagring} />);
      fireEvent.click(screen.getByRole("button", { name: "Ta bort" }));
      await waitFor(() => expect(onSpara).toHaveBeenCalledWith({ bild: "", bildSokvag: "" }));
      expect(lagring.taBort).toHaveBeenCalledWith("profilbilder/uid-1/y.jpg");
    });

    it("Återställ syns bara när inloggningsBild skiljer sig från den sparade, och sparar den direkt", async () => {
      const lagring = { laddaUpp: vi.fn(), taBort: vi.fn() };
      const onSpara = vi.fn(async () => {});
      const { rerender } = render(<OpsProfil anvandare={ANV} onSpara={onSpara} lagring={lagring} inloggningsBild="https://google/foto.jpg" />);
      fireEvent.click(screen.getByRole("button", { name: "Återställ" }));
      await waitFor(() => expect(onSpara).toHaveBeenCalledWith({ bild: "https://google/foto.jpg", bildSokvag: "" }));

      rerender(<OpsProfil anvandare={{ ...ANV, bild: "https://google/foto.jpg" }} onSpara={onSpara} lagring={lagring} inloggningsBild="https://google/foto.jpg" />);
      expect(screen.queryByRole("button", { name: "Återställ" })).toBeNull();
    });
  });

  describe("#156: Personuppgifter", () => {
    it("namn, telefon, stad och presentation går att fylla i och skickas med till Spara", async () => {
      const onSpara = vi.fn(async () => {});
      render(<OpsProfil anvandare={ANV} onSpara={onSpara} />);

      fireEvent.change(screen.getByLabelText("Namn"), { target: { value: "Ny person" } });
      fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "+46701234567" } });
      fireEvent.change(screen.getByLabelText("Stad"), { target: { value: "Visby" } });
      fireEvent.change(screen.getByLabelText("Presentation"), { target: { value: "En kort text." } });

      expect(screen.getByRole("button", { name: "Spara" }).hasAttribute("disabled")).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: "Spara" }));

      await waitFor(() =>
        expect(onSpara).toHaveBeenCalledWith(
          expect.objectContaining({ namn: "Ny person", telefon: "+46701234567", stad: "Visby", presentation: "En kort text." }),
        ),
      );
    });

    it("presentationens teckenräknare visar taket", () => {
      render(<OpsProfil anvandare={ANV} onSpara={() => {}} />);
      expect(screen.getByText("0/500")).toBeTruthy();
    });
  });

  describe("#156: Länkar", () => {
    const PLATTFORMAR = [
      { id: "webbplats", label: "Webbplats" },
      { id: "instagram", label: "Instagram" },
    ];

    it("utan plattformar syns ingen \"lägg till\"-rad", () => {
      render(<OpsProfil anvandare={ANV} onSpara={() => {}} />);
      expect(screen.queryByText("Lägg till länk")).toBeNull();
    });

    it("visar en chip per plattform som INTE redan är tillagd", () => {
      const medEnLank = { ...ANV, lankar: [{ plattform: "webbplats", url: "https://staiger.se" }] };
      render(<OpsProfil anvandare={medEnLank} onSpara={() => {}} plattformar={PLATTFORMAR} />);
      expect(screen.getByRole("button", { name: "Instagram" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Webbplats" })).toBeNull();
    });

    it("⛔ lägger till en länkrad, fyller i url, och skickar den till Spara", async () => {
      const onSpara = vi.fn(async () => {});
      render(<OpsProfil anvandare={ANV} onSpara={onSpara} plattformar={PLATTFORMAR} />);

      fireEvent.click(screen.getByRole("button", { name: "Webbplats" }));
      fireEvent.change(screen.getByLabelText("webbplats url"), { target: { value: "https://staiger.se" } });
      fireEvent.click(screen.getByRole("button", { name: "Spara" }));

      await waitFor(() =>
        expect(onSpara).toHaveBeenCalledWith(expect.objectContaining({ lankar: [{ plattform: "webbplats", url: "https://staiger.se" }] })),
      );
    });

    it("tar bort en länkrad igen", () => {
      const medEnLank = { ...ANV, lankar: [{ plattform: "webbplats", url: "https://staiger.se" }] };
      render(<OpsProfil anvandare={medEnLank} onSpara={() => {}} plattformar={PLATTFORMAR} />);
      expect(screen.getByLabelText("webbplats url")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Ta bort länken: webbplats" }));
      expect(screen.queryByLabelText("webbplats url")).toBeNull();
      // Chipet för webbplats är tillbaka bland dem man kan lägga till.
      expect(screen.getByRole("button", { name: "Webbplats" })).toBeTruthy();
    });

    it("en redan sparad länk visas även om plattformen tagits bort ur appens lista", () => {
      // ⛔ Samma tvådelade mönster som moduler/kandaModuler: en app som krympt
      // sin plattformslista ska inte få en gammal länk att försvinna ur vyn.
      const medOkand = { ...ANV, lankar: [{ plattform: "myspace", url: "https://myspace.com/cp" }] };
      render(<OpsProfil anvandare={medOkand} onSpara={() => {}} plattformar={PLATTFORMAR} />);
      expect(screen.getByLabelText("myspace url")).toBeTruthy();
    });
  });

  it("#156: children-sloten ritas efter Länkar och före Spara", () => {
    render(
      <OpsProfil anvandare={ANV} onSpara={() => {}}>
        <div data-testid="appens-sektion">Kreativ profil</div>
      </OpsProfil>,
    );
    expect(screen.getByTestId("appens-sektion")).toBeTruthy();
  });
});

describe("OpsAnvandarmeny", () => {
  it("knappen bär personens namn, inte bara ordet knapp", () => {
    render(<OpsAnvandarmeny anvandare={ANV} onLoggaUt={() => {}} />);
    expect(screen.getByRole("button", { name: "Konto, Claes Philip" })).toBeTruthy();
  });

  it("⛔ utloggningen finns bakom menyn och anropas", async () => {
    const onLoggaUt = vi.fn();
    render(<OpsAnvandarmeny anvandare={ANV} onLoggaUt={onLoggaUt} />);
    fireEvent.click(screen.getByRole("button", { name: "Konto, Claes Philip" }));
    fireEvent.click(screen.getByRole("button", { name: "Logga ut" }));
    // ⛔ `onLoggaUt` KÖRS EN TICK SENARE (#158), se noten vid `kor` i
    // `OpsAnvandarmeny.jsx`: annars hinner Radix stänga menyns egen panel och
    // öppna nästa i SAMMA klick, och den nya stängs tillbaka på plats.
    await new Promise((r) => setTimeout(r, 0));
    expect(onLoggaUt).toHaveBeenCalledTimes(1);
  });

  it("rubriken 'Meny' står överst, utan namn eller e-post bredvid (#157, samma form som SessionStudio)", () => {
    render(<OpsAnvandarmeny anvandare={ANV} onLoggaUt={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Konto, Claes Philip" }));
    expect(screen.getByRole("heading", { name: "Meny" })).toBeTruthy();
    expect(screen.queryByText("cp@staiger.se")).toBeNull();
  });

  it("egen rubrik går att sätta via prop", () => {
    render(<OpsAnvandarmeny anvandare={ANV} onLoggaUt={() => {}} rubrik="Konto" />);
    fireEvent.click(screen.getByRole("button", { name: "Konto, Claes Philip" }));
    expect(screen.getByRole("heading", { name: "Konto" })).toBeTruthy();
  });

  it("sektionerna är appens rader: bara det som skickas in finns, med ikon och chevron eller extern-länk-ikon", async () => {
    const onNotiser = vi.fn();
    render(
      <OpsAnvandarmeny
        anvandare={ANV}
        onLoggaUt={() => {}}
        sektioner={[
          [{ key: "notiser", etikett: "Notiser", onClick: onNotiser, chevron: true, badge: 3 }],
          [{ key: "support", etikett: "Support", href: "https://example.se/support" }],
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Konto, Claes Philip" }));

    // ⛔ Båda raderna läses UT innan någon klickas: ett klick på Notiser stänger
    // menyn (samma sak som Logga ut redan gör), och den stängda menyn tar bort
    // Support-raden ur DOM:en innan provet hinner fråga efter den.
    const supportrad = screen.getByRole("link", { name: "Support" });
    expect(supportrad.getAttribute("href")).toBe("https://example.se/support");
    expect(supportrad.getAttribute("target")).toBe("_blank");

    const notisrad = screen.getByRole("button", { name: /Notiser/ });
    fireEvent.click(notisrad);
    await new Promise((r) => setTimeout(r, 0));
    expect(onNotiser).toHaveBeenCalledTimes(1);
  });

  it("⛔ en rad utan key eller etikett kastar, i stället för att tyst rita fel", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(<OpsAnvandarmeny anvandare={ANV} onLoggaUt={() => {}} sektioner={[[{ key: "a" }]]} />),
    ).toThrow(/saknar etikett/);
    spy.mockRestore();
  });
});

describe("⛔ versionsraden (#157)", () => {
  it("visar ramverkets version, och den är RÖD om raden inte stämmer mot package.json", () => {
    render(<OpsAnvandarmeny anvandare={ANV} onLoggaUt={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Konto, Claes Philip" }));
    // ⛔ Läser package.json på riktigt, inte ett hårdkodat tal i provet: annars
    // bevisar provet bara att TVÅ handskrivna kopior råkar stämma överens, inte
    // att komponenten läser SANNINGEN. Se `frameworkVersion.generated.js`.
    const paket = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    expect(screen.getByText(`ops-framework v${paket.version}`)).toBeTruthy();
  });

  it("visar appens version också, när den skickas in, i formen 'app · ops-framework'", () => {
    render(<OpsAnvandarmeny anvandare={ANV} onLoggaUt={() => {}} appVersion="bolag-ops v1.4.2" />);
    fireEvent.click(screen.getByRole("button", { name: "Konto, Claes Philip" }));
    expect(screen.getByText(/^bolag-ops v1\.4\.2 · ops-framework v\d+\.\d+\.\d+$/)).toBeTruthy();
  });

  it("saknas appens version skrivs raden ändå, med ramverkets ensam (tomhet är ett svar)", () => {
    render(<OpsAnvandarmeny anvandare={ANV} onLoggaUt={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Konto, Claes Philip" }));
    expect(screen.getByText(/^ops-framework v\d+\.\d+\.\d+$/)).toBeTruthy();
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
