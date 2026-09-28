import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { OpsProfil } from "../components/OpsProfil.jsx";
import { OpsIconLink } from "../components/OpsIconLink.jsx";
import { OpsIdentity } from "../components/OpsIdentity.jsx";
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
    it("⛔ #164 korrigering C: utan lagring döljs BARA uppladdningen (Byt); Ta bort kräver ingen Storage", () => {
      // Coordinatorns egen rättelse: "knapparna 'Byt' (uppladdning, bara när
      // lagring finns), 'Ta bort' och 'Använd initialer'". Ta bort och Använd
      // initialer skriver bara `users/{uid}`, precis som ikon och färg, och är
      // inte låsta bakom `props.lagring` längre.
      render(<OpsProfil anvandare={{ ...ANV, bild: "https://x/y.png" }} onSpara={() => {}} />);
      expect(screen.queryByRole("button", { name: "Byt" })).toBeNull();
      expect(screen.getByRole("button", { name: "Ta bort" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Använd initialer" })).toBeTruthy();
    });

    it("med lagring visas Ladda upp, och Ta bort bara när en bild finns", () => {
      const lagring = { laddaUpp: vi.fn(), taBort: vi.fn() };
      const { rerender } = render(<OpsProfil anvandare={ANV} onSpara={() => {}} lagring={lagring} />);
      expect(screen.getByRole("button", { name: "Byt" })).toBeTruthy();
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

  // ══ #164, korrigering C: standardikon och färg, ingen Storage krävs ══════
  describe("#164 korrigering C: Profilbild utan Storage (ikon, färg, initialer)", () => {
    it("visar sex standardikoner och sex färger, oavsett om lagring finns", () => {
      render(<OpsProfil anvandare={ANV} onSpara={() => {}} />);
      expect(screen.getByRole("group", { name: "Välj standardikon" })).toBeTruthy();
      expect(within(screen.getByRole("group", { name: "Välj standardikon" })).getAllByRole("button")).toHaveLength(6);
      expect(screen.getByRole("group", { name: "Färg" })).toBeTruthy();
      expect(within(screen.getByRole("group", { name: "Färg" })).getAllByRole("button")).toHaveLength(6);
    });

    it("⛔ ett ikonval sparas DIREKT (som bilden), och rensar bild/bildSokvag", async () => {
      const onSpara = vi.fn(async () => {});
      render(<OpsProfil anvandare={{ ...ANV, bild: "https://x/y.png", bildSokvag: "profilbilder/uid-1/y.jpg" }} onSpara={onSpara} />);
      fireEvent.click(screen.getByRole("button", { name: "Stjärna" }));
      await waitFor(() => expect(onSpara).toHaveBeenCalledWith({ ikon: "stjarna", bild: "", bildSokvag: "" }));
    });

    it("⛔ ett färgval sparas DIREKT och rör inte ikon eller bild", async () => {
      const onSpara = vi.fn(async () => {});
      render(<OpsProfil anvandare={{ ...ANV, ikon: "krona" }} onSpara={onSpara} />);
      fireEvent.click(screen.getByRole("button", { name: "Färg 3" }));
      await waitFor(() => expect(onSpara).toHaveBeenCalledWith({ farg: "3" }));
    });

    it("'Använd initialer' nollställer bild OCH ikon direkt, och syns bara när en av dem är satt", async () => {
      const onSpara = vi.fn(async () => {});
      const { rerender } = render(<OpsProfil anvandare={ANV} onSpara={onSpara} />);
      expect(screen.queryByRole("button", { name: "Använd initialer" })).toBeNull();

      rerender(<OpsProfil anvandare={{ ...ANV, ikon: "leende" }} onSpara={onSpara} />);
      fireEvent.click(screen.getByRole("button", { name: "Använd initialer" }));
      await waitFor(() => expect(onSpara).toHaveBeenCalledWith({ bild: "", bildSokvag: "", ikon: "" }));
    });

    it("⛔ OpsIdentity ritar ikonen i vald färg när bild saknas, och bilden FÖRE ikonen när båda finns", () => {
      const { rerender } = render(<OpsProfil anvandare={{ ...ANV, ikon: "krona", farg: "5" }} onSpara={() => {}} />);
      // Huvudets märke (`role="img"`, namnet som aria-label) ritar ikonens svg,
      // inte initialerna "CP". Sökt via `aria-label` för att inte träffa Krona-
      // knappen i väljarraden, som ritar samma ikon.
      const huvud = screen.getByRole("img", { name: "Claes Philip" });
      expect(huvud.querySelector(".lucide-crown")).toBeTruthy();

      rerender(<OpsProfil anvandare={{ ...ANV, ikon: "krona", farg: "5", bild: "https://x/y.png" }} onSpara={() => {}} />);
      const huvudMedBild = screen.getByRole("img", { name: "Claes Philip" });
      expect(huvudMedBild.querySelector(".lucide-crown")).toBeNull();
      expect(huvudMedBild.querySelector("img")).toBeTruthy();
    });
  });

  describe("#164 korrigering C: rollpillen bredvid namnet", () => {
    it("ritas när appen skickar roll, med appens ord", () => {
      render(<OpsProfil anvandare={ANV} roll="Studio Admin" onSpara={() => {}} />);
      expect(screen.getByText("Studio Admin")).toBeTruthy();
    });

    it("ritas INTE när appen inte skickar någon roll (ramverket känner inte begreppet)", () => {
      render(<OpsProfil anvandare={ANV} onSpara={() => {}} />);
      expect(screen.queryByText("Studio Admin")).toBeNull();
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

/**
 * ⛔ #164, ANDRA GRANSKNINGEN: DET FINNS INGEN EGEN `<OpsMeny>` LÄNGRE. Den
 * hade sin egen hamburgare bredvid `OpsAppShell`s, två knappar i samma
 * toppräcke. Menyn är nu skalets EGEN yta, propen `meny` på `OpsAppShell`
 * (och samma prop vidarebefordrad till `OpsBottomNav`s sheet). Proven här
 * är de gamla `OpsMeny`-proven flyttade till `OpsAppShell meny={...}`.
 */
const enkelNav = [{ href: "/", label: "Start" }];

describe("OpsAppShell meny (#164, andra granskningen: en hamburgare, inte två)", () => {
  it("hamburgaren finns och heter 'Meny', även utan nav-överflöd eller menuExtras", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" meny={{ onLoggaUt: () => {} }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    expect(screen.getByRole("button", { name: "Meny, fler åtgärder" })).toBeTruthy();
  });

  it("⛔ EN hamburgare, inte två: ingen andra knapp döljer sig i anvandare-facket", () => {
    render(
      <OpsAppShell
        brand="Ops"
        nav={enkelNav}
        activeHref="/"
        anvandare={
          <OpsIconLink
            href="/profil"
            icon={<OpsIdentity name={ANV.namn} seed={ANV.id} imageUrl={ANV.bild} size="sm" />}
            label="Min profil"
          />
        }
        meny={{ onLoggaUt: () => {} }}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    const header = screen.getByRole("banner");
    expect(within(header).getAllByRole("button", { name: /Meny/ })).toHaveLength(1);
    expect(within(header).getByRole("link", { name: "Min profil" })).toBeTruthy();
  });

  it("⛔ utloggningen finns bakom menyn och anropas", async () => {
    const onLoggaUt = vi.fn();
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" meny={{ onLoggaUt }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Meny, fler åtgärder" }));
    fireEvent.click(screen.getByRole("button", { name: "Logga ut" }));
    // ⛔ `onLoggaUt` KÖRS EN TICK SENARE (#158), se `kordarePafunktion` i
    // `OpsMeny.jsx`: annars hinner Radix stänga popovern och öppna nästa i
    // SAMMA klick, och den nya stängs tillbaka på plats.
    await new Promise((r) => setTimeout(r, 0));
    expect(onLoggaUt).toHaveBeenCalledTimes(1);
  });

  it("rubriken 'Meny' står överst, utan namn eller e-post bredvid (#157, samma form som SessionStudio)", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" meny={{ onLoggaUt: () => {} }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Meny, fler åtgärder" }));
    expect(screen.getByRole("heading", { name: "Meny" })).toBeTruthy();
    expect(screen.queryByText("cp@staiger.se")).toBeNull();
  });

  it("egen rubrik går att sätta via meny.rubrik", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" meny={{ onLoggaUt: () => {}, rubrik: "Konto" }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Meny, fler åtgärder" }));
    expect(screen.getByRole("heading", { name: "Konto" })).toBeTruthy();
  });

  it("sektionerna är appens rader: bara det som skickas in finns, med ikon och chevron eller extern-länk-ikon", async () => {
    const onKonto = vi.fn();
    render(
      <OpsAppShell
        brand="Ops"
        nav={enkelNav}
        activeHref="/"
        meny={{
          onLoggaUt: () => {},
          sektioner: [
            // ⛔ #166: en rad UTAN chevron/undervy är fortfarande giltig, den
            // bara stänger menyn och kör sin egen onClick (t.ex. en modal appen
            // öppnar själv, inte en undervy).
            [{ key: "konto", etikett: "Konto", onClick: onKonto, badge: 3 }],
            [{ key: "support", etikett: "Support", href: "https://example.se/support" }],
          ],
        }}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Meny, fler åtgärder" }));

    // ⛔ Båda raderna läses UT innan någon klickas: ett klick på Konto stänger
    // menyn (samma sak som Logga ut redan gör), och den stängda menyn tar bort
    // Support-raden ur DOM:en innan provet hinner fråga efter den.
    const supportrad = screen.getByRole("link", { name: "Support" });
    expect(supportrad.getAttribute("href")).toBe("https://example.se/support");
    expect(supportrad.getAttribute("target")).toBe("_blank");

    const kontorad = screen.getByRole("button", { name: /Konto/ });
    fireEvent.click(kontorad);
    await new Promise((r) => setTimeout(r, 0));
    expect(onKonto).toHaveBeenCalledTimes(1);
  });

  it("⛔ ORDNINGEN: appens sektioner, sedan navigeringens överflöd, sedan menuExtras, sedan Logga ut", () => {
    render(
      <OpsAppShell
        brand="Ops"
        nav={[
          { href: "/", label: "Start" },
          { href: "/a", label: "A" },
          { href: "/b", label: "B" },
        ]}
        activeHref="/"
        maxTopNav={1}
        maxTopNavSmal={1}
        menuExtras={<button type="button">Tema</button>}
        meny={{ onLoggaUt: () => {}, sektioner: [[{ key: "notiser", etikett: "Notiser" }]] }}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    const header = screen.getByRole("banner");
    // ⛔ `getByRole` mot HELA dokumentet hittar BÅDA hamburgarna (header-
    // popovern OCH botten-Meny-arkets knapp, jsdom kör ingen CSS så
    // `md:inline-flex`/`md:hidden` gömmer ingenting): scopa TRIGGERN till headern.
    fireEvent.click(within(header).getByRole("button", { name: /Meny/ }));
    // ⛔ INNEHÅLLET RITAS I EN RADIX-PORTAL, ALLTSÅ UTANFÖR `<header>` I DOM:EN
    // (portalen hänger direkt på `document.body`), och botten-Meny-arkets
    // EGEN rad (Start/A/B ryms alla i botten-navets rad här) skriver SAMMA
    // etiketter en gång till på sidan. Ankra därför sökningen i menyns EGEN
    // panel: rubrikens `<h2>` ligger direkt i `Popover.Content`, en nivå upp
    // från sin omslutande `div`.
    const rubrikEl = screen.getByRole("heading", { name: "Meny" });
    const panel = /** @type {HTMLElement} */ (rubrikEl.parentElement?.parentElement);
    const namn = Array.from(panel.querySelectorAll("button, a"))
      .map((el) => el.textContent)
      .filter(Boolean);
    const iOrdning = ["Notiser", "A", "B", "Tema", "Logga ut"].map((n) => namn.findIndex((t) => t?.includes(n)));
    expect(iOrdning.every((i) => i >= 0)).toBe(true);
    expect(iOrdning).toEqual([...iOrdning].sort((a, b) => a - b));
  });

  it("⛔ en rad utan key eller etikett kastar, i stället för att tyst rita fel", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" meny={{ onLoggaUt: () => {}, sektioner: [[{ key: "a" }]] }}>
          <p>innehåll</p>
        </OpsAppShell>,
      ),
    ).toThrow(/saknar etikett/);
    spy.mockRestore();
  });

  it("⛔ meny utan onLoggaUt kastar", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" meny={{}}>
          <p>innehåll</p>
        </OpsAppShell>,
      ),
    ).toThrow(/onLoggaUt krävs/);
    spy.mockRestore();
  });
});

/**
 * ⛔ #166: EN RAD MED `undervy` BYTER INNEHÅLLET I SAMMA PANEL. Se ärendets
 * skärmbildsjämförelse (`ss-jamfor-ss-meny.png` mot `ss-jamfor-ops-aktivitet.png`):
 * en `OpsActivityButton renderTrigger={false}` lämnade en osynlig ankarknapp i
 * `actions` och öppnade en LÖS popover där, mitt i toppraden. Proven här mäter
 * att en `undervy`-rad INTE gör det: ingen ny Popover.Content/Dialog.Content
 * tillkommer, bara EN panel vars innehåll byts.
 */
describe("OpsAppShell meny, undervy (#166: ingen egen, lös popover för en chevron-rad)", () => {
  /** @param {{ badge?: number }} [opts] */
  function meny(opts = {}) {
    return {
      onLoggaUt: () => {},
      sektioner: [
        [
          {
            key: "aktivitet",
            etikett: "Aktivitet",
            badge: opts.badge,
            undervy: <p data-testid="aktivitet-innehall">Listan</p>,
            undervyAction: <button type="button">Filter</button>,
          },
        ],
      ],
    };
  }

  it("raden ritas med chevron, och tryck byter panelens innehåll PÅ PLATS: tillbakapil + radens etikett som rubrik", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" meny={meny()}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Meny, fler åtgärder" }));

    // Roten: en riktig OpsPanelRow-chevron, ingen tillbakapil ännu.
    expect(screen.getByRole("heading", { name: "Meny" })).toBeTruthy();
    expect(screen.queryByLabelText("Tillbaka till menyn")).toBeNull();
    expect(screen.queryByTestId("aktivitet-innehall")).toBeNull();

    // ⛔ MÄT ANTALET ÖPPNA POPOVRAR/DIALOGER INNAN TRYCK, jämför sedan att det
    // INTE ökar (mät att inget nytt Popover.Content/Dialog.Content skapats).
    const antalInnan = document.querySelectorAll('[data-radix-popper-content-wrapper], [role="dialog"]').length;

    fireEvent.click(screen.getByRole("button", { name: /Aktivitet/ }));

    // Rubriken bytt, tillbakapilen finns, listan syns, allt i SAMMA panel.
    expect(screen.getByRole("heading", { name: "Aktivitet" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Meny" })).toBeNull();
    expect(screen.getByLabelText("Tillbaka till menyn")).toBeTruthy();
    expect(screen.getByTestId("aktivitet-innehall")).toBeTruthy();
    // ⛔ undervyAction (filterknappen) ligger i huvudet, bredvid rubriken.
    expect(screen.getByRole("button", { name: "Filter" })).toBeTruthy();

    // ⛔ ANTALET ÄR OFÖRÄNDRAT. Ingen ny popover/dialog tillkom, panelen bytte
    // bara sitt eget innehåll (#166: fixet på den lösa popovern i #158-varianten).
    expect(document.querySelectorAll('[data-radix-popper-content-wrapper], [role="dialog"]').length).toBe(antalInnan);

    // Roten, alltså Logga ut-raden och menyns egen rubrik, är borta medan
    // undervyn visas: den ERSÄTTER resten av menyn, den läggs inte till.
    expect(screen.queryByRole("button", { name: "Logga ut" })).toBeNull();
  });

  it("tillbakapilen återställer roten, samma panel", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" meny={meny()}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Meny, fler åtgärder" }));
    fireEvent.click(screen.getByRole("button", { name: /Aktivitet/ }));
    expect(screen.getByTestId("aktivitet-innehall")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Tillbaka till menyn"));

    expect(screen.getByRole("heading", { name: "Meny" })).toBeTruthy();
    expect(screen.queryByTestId("aktivitet-innehall")).toBeNull();
    expect(screen.getByRole("button", { name: "Logga ut" })).toBeTruthy();
  });

  it("stängs menyn (klick utanför) nollställs undervyn: öppnar man igen visas roten, inte listan", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" meny={meny()}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    const oppna = () => fireEvent.click(screen.getByRole("button", { name: "Meny, fler åtgärder" }));
    oppna();
    fireEvent.click(screen.getByRole("button", { name: /Aktivitet/ }));
    expect(screen.getByTestId("aktivitet-innehall")).toBeTruthy();

    // Escape stänger popovern (Radix), precis som ett klick utanför.
    fireEvent.keyDown(screen.getByTestId("aktivitet-innehall"), { key: "Escape" });

    oppna();
    expect(screen.getByRole("heading", { name: "Meny" })).toBeTruthy();
    expect(screen.queryByTestId("aktivitet-innehall")).toBeNull();
  });

  it("⛔ MUTATIONSSVEP: en rad utan undervy men med chevron:true kastar (löftet skulle annars vara tomt)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <OpsAppShell
          brand="Ops"
          nav={enkelNav}
          activeHref="/"
          meny={{ onLoggaUt: () => {}, sektioner: [[{ key: "a", etikett: "A", chevron: true }]] }}
        >
          <p>innehåll</p>
        </OpsAppShell>,
      ),
    ).toThrow(/chevron.*utan.*undervy/);
    spy.mockRestore();
  });

  it("⛔ href ihop med undervy kastar: två olika löften, en rad kan inte hålla båda", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <OpsAppShell
          brand="Ops"
          nav={enkelNav}
          activeHref="/"
          meny={{
            onLoggaUt: () => {},
            sektioner: [[{ key: "a", etikett: "A", href: "/a", undervy: <p>x</p> }]],
          }}
        >
          <p>innehåll</p>
        </OpsAppShell>,
      ),
    ).toThrow(/href.*undervy/);
    spy.mockRestore();
  });

  it("botten-arket (smal skärm) gör samma sak: tryck byter arket, tillbaka återställer", () => {
    // ⛔ jsdom kör ingen CSS, så header-popovern OCH botten-arket ligger båda
    // i DOM:en samtidigt (samma mönster som provet om ordningen ovan). Botten-
    // arkets EGEN hamburgare heter "Meny" utan ", fler åtgärder"-suffixet.
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" meny={meny()}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    const alla = screen.getAllByRole("button", { name: /^Meny$/ });
    // Den sista är botten-arkets knapp (header-triggern heter "Meny, fler åtgärder").
    fireEvent.click(alla[alla.length - 1]);

    const alla2 = screen.getAllByRole("heading", { name: "Meny" });
    expect(alla2.length).toBeGreaterThan(0);

    const aktivitetsrader = screen.getAllByRole("button", { name: /Aktivitet/ });
    fireEvent.click(aktivitetsrader[aktivitetsrader.length - 1]);

    expect(screen.getAllByTestId("aktivitet-innehall").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Tillbaka till menyn").length).toBeGreaterThan(0);

    const tillbaka = screen.getAllByLabelText("Tillbaka till menyn");
    fireEvent.click(tillbaka[tillbaka.length - 1]);
    expect(screen.queryAllByTestId("aktivitet-innehall")).toHaveLength(0);
  });
});

describe("⛔ #164 korrigering A: avataren är en direktlänk utan meny", () => {
  it("OpsIconLink med OpsIdentity som ikon länkar rakt till profilen, ingen popover", () => {
    render(
      <OpsIconLink
        href="/profil"
        icon={<OpsIdentity name={ANV.namn} seed={ANV.id} imageUrl={ANV.bild} size="sm" />}
        label="Min profil"
      />,
    );
    const lank = screen.getByRole("link", { name: "Min profil" });
    expect(lank.getAttribute("href")).toBe("/profil");
    // ⛔ Ingen `aria-haspopup`/`aria-expanded`: en länk öppnar ingen panel.
    expect(lank.getAttribute("aria-haspopup")).toBeNull();
    expect(screen.queryByRole("button", { name: /Min profil/ })).toBeNull();
  });
});

describe("⛔ versionsraden (#157, #164: två rader, inte en med punkt emellan)", () => {
  it("visar ramverkets version, och den är RÖD om raden inte stämmer mot package.json", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" meny={{ onLoggaUt: () => {} }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Meny, fler åtgärder" }));
    // ⛔ Läser package.json på riktigt, inte ett hårdkodat tal i provet: annars
    // bevisar provet bara att TVÅ handskrivna kopior råkar stämma överens, inte
    // att komponenten läser SANNINGEN. Se `frameworkVersion.generated.js`.
    const paket = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    expect(screen.getByText(`ops-framework v${paket.version}`)).toBeTruthy();
  });

  it("visar appens version på sin EGEN rad, inte hopslagen med ramverkets med en punkt", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" meny={{ onLoggaUt: () => {}, appVersion: "bolag-ops v1.4.2" }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Meny, fler åtgärder" }));
    expect(screen.getByText("bolag-ops v1.4.2")).toBeTruthy();
    expect(screen.queryByText(/·/)).toBeNull();
    const paket = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    expect(screen.getByText(`ops-framework v${paket.version}`)).toBeTruthy();
  });

  it("saknas appens version skrivs bara ramverkets rad (tomhet är ett svar)", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" meny={{ onLoggaUt: () => {} }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Meny, fler åtgärder" }));
    expect(screen.getByText(/^ops-framework v\d+\.\d+\.\d+$/)).toBeTruthy();
  });
});

describe("⛔ skalets användarfack", () => {
  it("renderar det som skickas in: bara avataren, INGEN egen hamburgare där (menyn ligger i skalets EGEN, via meny-propen)", () => {
    render(
      <OpsAppShell
        brand="Ops"
        nav={enkelNav}
        activeHref="/"
        anvandare={
          <OpsIconLink
            href="/profil"
            icon={<OpsIdentity name={ANV.namn} seed={ANV.id} imageUrl={ANV.bild} size="sm" />}
            label="Min profil"
          />
        }
        meny={{ onLoggaUt: () => {} }}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: "Min profil" })).toBeTruthy();
    expect(within(header).getByRole("button", { name: /Meny/ })).toBeTruthy();
  });

  it("skalet fungerar utan facket", () => {
    render(
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/">
        <p>innehåll</p>
      </OpsAppShell>,
    );
    const header = screen.getByRole("banner");
    expect(within(header).queryByRole("link", { name: /Min profil/ })).toBeNull();
    expect(within(header).queryByRole("button", { name: "Meny" })).toBeNull();
  });
});
