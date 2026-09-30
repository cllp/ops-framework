import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsGruppFormular } from "../components/OpsGruppFormular.jsx";
import { OpsGruppanel } from "../components/OpsGruppanel.jsx";
import { gruppmarkeProps } from "../lib/gruppikoner.js";
import { GRUPPIKONER } from "../lib/grupp.js";

/**
 * "Ny grupp" (0.32.0, #180): formuläret, dess väg in i skapa-panelen och märket det ritar.
 *
 * ⛔ VAD SOM MÄTS HÄR OCH VAD SOM MÄTS I CHROMIUM. Här: ordningen på fälten, vad som skickas till `onSkapa`, att en inbjudan som
 * faller visas, att panelen stängs FÖRE `onSkapad`, och att tre ingångar öppnar samma panel. Hur det SER UT (panel och inte dialog
 * vid 390 och 1280 px, fältens ordning i en riktig layout) mäter `check-skalyta` avsnitt 22, eftersom jsdom inte kör någon CSS.
 */

const svar = (extra = {}) => ({ groupId: "ny-grupp-abc", tillagda: [], inbjudna: [], fel: [], ...extra });

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

/** @param {Partial<import("react").ComponentProps<typeof OpsGruppFormular>>} [p] */
const rita = (p = {}) => {
  const onSkapa = vi.fn(async () => svar());
  const onSkapad = vi.fn();
  const onKlar = vi.fn();
  const ut = render(<OpsGruppFormular formId="f" onSkapa={onSkapa} onSkapad={onSkapad} onKlar={onKlar} {...p} />);
  return { onSkapa, onSkapad, onKlar, ...ut };
};

const skicka = () => fireEvent.submit(document.querySelector("form#f"));

describe("⛔ fälten i SS ordning", () => {
  it("Visuell identitet, Gruppnamn, Beskrivning, Ort, Medlemmar, Mer inställningar, i den ordningen", () => {
    rita();
    const ordning = [
      screen.getByRole("button", { name: /Färg och ikon/ }),
      screen.getByLabelText(/Gruppnamn/),
      screen.getByLabelText("Beskrivning"),
      screen.getByLabelText("Ort"),
      screen.getByRole("region", { name: "Medlemmar" }),
      screen.getByRole("button", { name: "Mer inställningar" }),
    ];
    for (let i = 1; i < ordning.length; i += 1) {
      expect(ordning[i - 1].compareDocumentPosition(ordning[i]) & Node.DOCUMENT_POSITION_FOLLOWING, `${i}`).toBeTruthy();
    }
  });

  it("⛔ formuläret har en egen sparaknapp INTE: Spara är skalets (type submit form)", () => {
    rita();
    expect(screen.queryByRole("button", { name: /^Spara$/ })).toBeNull();
    expect(document.querySelector("form#f")).toBeTruthy();
  });

  it("identiteten och mer inställningar är hopfällda från början", () => {
    rita();
    expect(screen.getByRole("button", { name: /Färg och ikon/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Mer inställningar" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Färg" })).toBeNull();
    // Ett dolt element har inget tillgängligt namn (accname 2A), så regionen hämtas via knappens aria-controls.
    const mer = document.getElementById(screen.getByRole("button", { name: "Mer inställningar" }).getAttribute("aria-controls") ?? "");
    expect(mer).toHaveAttribute("hidden");
    expect(within(mer).getByText("E-postspråk")).toBeInTheDocument();
  });

  it("⛔ namnet är obligatoriskt: tomt namn ger ett fel vid fältet och onSkapa anropas inte", async () => {
    const { onSkapa } = rita();
    skicka();
    expect(await screen.findByText("Gruppen behöver ett namn.")).toBeInTheDocument();
    expect(onSkapa).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Gruppnamn/)).toBeRequired();
  });

  it("bilden får en förklaring i stället för en uppladdning som inte kan fungera", async () => {
    rita();
    await userEvent.setup().click(screen.getByRole("button", { name: /Färg och ikon/ }));
    expect(screen.getByText("En bild går att lägga till när gruppen har skapats.")).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

describe("⛔ visuell identitet: förhandsvisning, färg, ikon, initialer", () => {
  const marke = () => document.querySelector("[data-gruppidentitet] [role=img]");

  it("märket i raden ändrar färg när en färg väljs", async () => {
    rita();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Färg och ikon/ }));
    await user.click(screen.getByRole("button", { name: "Färg 4" }));
    expect(marke()).toHaveClass("bg-identity-4");
    expect(screen.getByRole("button", { name: "Färg 4" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Färg 2" }));
    expect(marke()).toHaveClass("bg-identity-2");
  });

  it("en ikon väljs, och alla GRUPPIKONER går att välja", async () => {
    rita();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Färg och ikon/ }));
    for (const id of GRUPPIKONER) expect(screen.getByRole("button", { name: id })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "byggnad" }));
    expect(screen.getByRole("button", { name: "byggnad" })).toHaveAttribute("aria-pressed", "true");
    expect(marke()?.querySelector("svg")).toBeTruthy();
  });

  it("⛔ egna initialer (1 till 3 tecken, versaler) ritas i märket och skickas som initialer:XY", async () => {
    const { onSkapa } = rita();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Gruppnamn/), "Åkeriet");
    await user.click(screen.getByRole("button", { name: /Färg och ikon/ }));
    await user.type(screen.getByLabelText("Egna initialer"), "abcd!");
    expect(screen.getByLabelText("Egna initialer")).toHaveValue("ABC");
    expect(marke()).toHaveTextContent("ABC");
    skicka();
    await waitFor(() => expect(onSkapa).toHaveBeenCalled());
    expect(onSkapa.mock.calls[0][0].grupp.ikon).toBe("initialer:ABC");
  });

  it("utan val ritas initialer ur namnet, och ikonen skickas som tom sträng", async () => {
    const { onSkapa } = rita();
    await userEvent.setup().type(screen.getByLabelText(/Gruppnamn/), "Mitt bolag");
    expect(marke()).toHaveTextContent("MB");
    skicka();
    await waitFor(() => expect(onSkapa).toHaveBeenCalled());
    expect(onSkapa.mock.calls[0][0].grupp).toMatchObject({ farg: "", ikon: "" });
  });

  it("gruppmarkeProps: tom rad ger ett tomt objekt, ett okänt id kastar inte", () => {
    expect(gruppmarkeProps({ farg: "", ikon: "" })).toEqual({});
    expect(gruppmarkeProps({ farg: "9", ikon: "gitarr" })).toEqual({});
    expect(gruppmarkeProps({ farg: "3", ikon: "initialer:ab" })).toEqual({ tone: 3, initialer: "AB" });
    expect(gruppmarkeProps({ ikon: "hus" }).icon).toBeTypeOf("function");
  });
});

describe("⛔ medlemmar: inbjudningarna samlas före spara", () => {
  const laggTill = async (user, epost, roll) => {
    await user.type(screen.getByLabelText("E-postadress"), epost);
    if (roll) {
      await user.click(screen.getByRole("combobox", { name: /Roll/ }));
      await user.click(screen.getByRole("option", { name: roll }));
    }
    await user.click(screen.getByRole("button", { name: "Lägg till" }));
  };

  it("en adress läggs till i listan, fältet töms och räknaren följer med", async () => {
    rita();
    const user = userEvent.setup();
    await laggTill(user, "Kollega@Exempel.se");
    expect(screen.getByText("kollega@exempel.se")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Medlemmar (1)" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-postadress")).toHaveValue("");
  });

  it("⛔ en adress som inte är en adress ger ett fel och läggs inte till", async () => {
    rita();
    await laggTill(userEvent.setup(), "inte-en-adress");
    expect(screen.getByText("Det där ser inte ut som en e-postadress.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Medlemmar (0)" })).toBeInTheDocument();
  });

  it("⛔ samma adress två gånger ger ett fel", async () => {
    rita();
    const user = userEvent.setup();
    await laggTill(user, "a@exempel.se");
    await laggTill(user, "A@exempel.se");
    expect(screen.getByText("Den adressen är redan tillagd.")).toBeInTheDocument();
    expect(screen.getAllByText("a@exempel.se")).toHaveLength(1);
  });

  it("en rad går att ta bort", async () => {
    rita();
    const user = userEvent.setup();
    await laggTill(user, "a@exempel.se");
    await user.click(screen.getByRole("button", { name: "Ta bort a@exempel.se" }));
    expect(screen.queryByText("a@exempel.se")).toBeNull();
  });

  it("rollen är Medlem som förval och kan bli Admin, aldrig Ägare", async () => {
    const { onSkapa } = rita();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Gruppnamn/), "G");
    await laggTill(user, "a@exempel.se");
    await laggTill(user, "b@exempel.se", "Admin");
    await user.click(screen.getByRole("combobox", { name: /Roll/ }));
    expect(screen.queryByRole("option", { name: /Ägare/ })).toBeNull();
    await user.keyboard("{Escape}");
    skicka();
    await waitFor(() => expect(onSkapa).toHaveBeenCalled());
    expect(onSkapa.mock.calls[0][0].inbjudningar).toEqual([
      { epost: "a@exempel.se", roll: "medlem" },
      { epost: "b@exempel.se", roll: "admin" },
    ]);
  });

  it("⛔ en adress som står kvar i fältet vid Spara är en adress man menade, och följer med", async () => {
    const { onSkapa } = rita();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Gruppnamn/), "G");
    await user.type(screen.getByLabelText("E-postadress"), "kvar@exempel.se");
    skicka();
    await waitFor(() => expect(onSkapa).toHaveBeenCalled());
    expect(onSkapa.mock.calls[0][0].inbjudningar).toEqual([{ epost: "kvar@exempel.se", roll: "medlem" }]);
  });

  it("⛔ en halvskriven adress vid Spara stoppar sparandet med felet", async () => {
    const { onSkapa } = rita();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Gruppnamn/), "G");
    await user.type(screen.getByLabelText("E-postadress"), "halv@");
    skicka();
    expect(await screen.findByText("Det där ser inte ut som en e-postadress.")).toBeInTheDocument();
    expect(onSkapa).not.toHaveBeenCalled();
  });
});

describe("⛔ mer inställningar: e-postspråket", () => {
  it("fälls ut med knappen, och förvalet följer sprak", async () => {
    rita({ sprak: "en" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "More settings" }));
    const region = screen.getByRole("region", { name: "More settings" });
    expect(region).not.toHaveAttribute("hidden");
    expect(within(region).getByRole("combobox", { name: /Email language/ })).toHaveTextContent("English");
  });

  it("⛔ språket som väljs skickas med som epostsprak", async () => {
    const { onSkapa } = rita();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Gruppnamn/), "G");
    await user.click(screen.getByRole("button", { name: "Mer inställningar" }));
    await user.click(screen.getByRole("combobox", { name: /E-postspråk/ }));
    await user.click(screen.getByRole("option", { name: "English" }));
    skicka();
    await waitFor(() => expect(onSkapa).toHaveBeenCalled());
    expect(onSkapa.mock.calls[0][0].grupp.epostsprak).toBe("en");
  });
});

describe("⛔ att spara", () => {
  it("skickar alla uppgifter, trimmade, med e-postspråket ur sprak", async () => {
    const { onSkapa } = rita({ sprak: "en" });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Group name/), "  Mitt bolag ");
    await user.type(screen.getByLabelText("Description"), " Vi jobbar ");
    await user.type(screen.getByLabelText("City"), " Visby ");
    skicka();
    await waitFor(() => expect(onSkapa).toHaveBeenCalled());
    expect(onSkapa.mock.calls[0][0]).toEqual({
      grupp: { namn: "Mitt bolag", farg: "", ikon: "", beskrivning: "Vi jobbar", ort: "Visby", epostsprak: "en" },
      inbjudningar: [],
    });
  });

  it("⛔ panelen stängs FÖRE onSkapad, så appens navigering inte ångras av panelens väg tillbaka", async () => {
    const ordning = [];
    const onKlar = vi.fn(() => ordning.push("klar"));
    const onSkapad = vi.fn(() => ordning.push("skapad"));
    rita({ onKlar, onSkapad });
    await userEvent.setup().type(screen.getByLabelText(/Gruppnamn/), "G");
    skicka();
    await waitFor(() => expect(onSkapad).toHaveBeenCalledWith("ny-grupp-abc", expect.objectContaining({ groupId: "ny-grupp-abc" })));
    expect(ordning).toEqual(["klar", "skapad"]);
  });

  it("⛔ ett dubbeltryck skapar EN grupp", async () => {
    let klar;
    const onSkapa = vi.fn(() => new Promise((r) => { klar = r; }));
    rita({ onSkapa });
    await userEvent.setup().type(screen.getByLabelText(/Gruppnamn/), "G");
    skicka();
    skicka();
    expect(onSkapa).toHaveBeenCalledTimes(1);
    klar(svar());
  });

  it("⛔ faller onSkapa visas felet, formuläret står kvar ifyllt, och varken onKlar eller onSkapad anropas", async () => {
    const { onKlar, onSkapad } = rita({ onSkapa: vi.fn(async () => { throw new Error("står inte på vitlistan"); }) });
    await userEvent.setup().type(screen.getByLabelText(/Gruppnamn/), "Mitt bolag");
    skicka();
    expect(await screen.findByText("Gruppen kunde inte skapas")).toBeInTheDocument();
    expect(screen.getByText("står inte på vitlistan")).toBeInTheDocument();
    expect(screen.getByLabelText(/Gruppnamn/)).toHaveValue("Mitt bolag");
    expect(onKlar).not.toHaveBeenCalled();
    expect(onSkapad).not.toHaveBeenCalled();
  });

  it("⛔ en inbjudan som föll SYNS: panelen stängs inte, adressen och skälet visas, och onSkapad väntar tills man går vidare", async () => {
    const onSkapa = vi.fn(async () => svar({ fel: [{ epost: "trasig@exempel.se", fel: "nätverket föll" }] }));
    const { onKlar, onSkapad } = rita({ onSkapa });
    await userEvent.setup().type(screen.getByLabelText(/Gruppnamn/), "G");
    skicka();
    expect(await screen.findByText("Gruppen är skapad, men alla inbjudningar gick inte iväg")).toBeInTheDocument();
    expect(screen.getByText("trasig@exempel.se")).toBeInTheDocument();
    expect(screen.getByText(/nätverket föll/)).toBeInTheDocument();
    expect(onKlar).not.toHaveBeenCalled();
    expect(onSkapad).not.toHaveBeenCalled();

    // Skalets Spara (submit på samma form) betyder "gå vidare" här, aldrig "skapa en till".
    skicka();
    expect(onSkapa).toHaveBeenCalledTimes(1);
    expect(onKlar).toHaveBeenCalledTimes(1);
    expect(onSkapad).toHaveBeenCalledWith("ny-grupp-abc", expect.anything());
  });

  it("onSkapa krävs", () => {
    expect(() => render(<OpsGruppFormular />)).toThrow(/onSkapa krävs/);
  });
});

describe("⛔ tre ingångar öppnar SAMMA panel (skapa.grupp i skalet)", () => {
  const GRUPPER = [
    { id: "g1", namn: { sv: "Alfa AB" }, medlemsantal: 2, roll: "agare" },
    { id: "g2", namn: { sv: "Beta AB" }, medlemsantal: 1, farg: "4", ikon: "initialer:BE" },
  ];

  /** @param {{ onSkapad?: Function, medOnSkapa?: boolean }} [o] */
  function Skal({ onSkapad = () => {}, medOnSkapa = false } = {}) {
    const [aktiv, setAktiv] = useState("g1");
    return (
      <OpsAppShell
        brand="Ops"
        nav={[{ href: "/", label: "Start" }]}
        activeHref="/"
        grupper={{ lista: GRUPPER, aktiv, onValj: setAktiv, ...(medOnSkapa ? { onSkapa: () => { throw new Error("appens egen onSkapa ska inte anropas när skapa.grupp finns"); } } : {}) }}
        skapa={{
          sparaEtikett: "Spara",
          grupp: ({ formId, onKlar }) => <OpsGruppFormular formId={formId} onKlar={onKlar} onSkapa={async () => svar()} onSkapad={onSkapad} />,
        }}
      >
        <p>appens vy</p>
      </OpsAppShell>
    );
  }

  it("⛔ plusset: raden Ny grupp öppnar panelen, som är en region och inte en dialog", async () => {
    render(<Skal />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Skapa" }));
    await user.click(screen.getByRole("button", { name: "Ny grupp" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const panel = screen.getByRole("region", { name: "Ny grupp" });
    expect(within(panel).getByLabelText(/Gruppnamn/)).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("skapa")).toBe("grupp");
  });

  it("⛔ gruppanelen: Skapa grupp öppnar samma panel, och appens egen onSkapa anropas inte", async () => {
    render(<Skal medOnSkapa />);
    const nav = screen.getAllByRole("navigation", { name: "Mina grupper" })[0];
    await userEvent.setup().click(within(nav).getByRole("button", { name: "Skapa grupp" }));
    expect(screen.getByRole("region", { name: "Ny grupp" })).toBeInTheDocument();
  });

  // ⛔ 0.37.0: VÄXLARENS ARK HAR INGEN "SKAPA GRUPP" (CP 2026-09-30: "Ta bort skapa grupp från gruppväljaren. Vill att det
  // skall vara rent där", och "Nej bara i mobil vy"). Provet som visade att arkets knapp öppnade panelen är ersatt av det här.
  it("⛔ växlarens ark (smal skärm) har ingen Skapa grupp; plussets Ny grupp är vägen", async () => {
    render(<Skal />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Byt grupp, nu: Alfa AB/ }));
    const ark = screen.getByRole("dialog");
    expect(within(ark).queryByRole("button", { name: "Skapa grupp" })).toBeNull();
    expect(within(ark).getByRole("button", { name: /Alfa AB/ })).toBeInTheDocument();
  });

  it("⛔ växlarens ark utan grupper säger det och pekar på plusset", async () => {
    render(<OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" grupper={{ lista: [], aktiv: "", onValj: () => {} }}><p>vy</p></OpsAppShell>);
    await userEvent.setup().click(screen.getByRole("button", { name: /Byt grupp, nu: Ingen grupp/ }));
    expect(within(screen.getByRole("dialog")).getByText("Du är inte medlem i någon grupp än. Skapa en med plusset.")).toBeInTheDocument();
  });

  it("⛔ Spara i skalets knapprad skickar formuläret, och efter en lyckad skapelse är panelen borta OCH sidan gick inte bakåt", async () => {
    const back = vi.spyOn(window.history, "back");
    const onSkapad = vi.fn();
    render(<Skal onSkapad={onSkapad} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Skapa" }));
    await user.click(screen.getByRole("button", { name: "Ny grupp" }));
    await user.type(screen.getByLabelText(/Gruppnamn/), "Nya bolaget");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(onSkapad).toHaveBeenCalledWith("ny-grupp-abc", expect.anything()));
    expect(screen.queryByRole("region", { name: "Ny grupp" })).toBeNull();
    expect(screen.getByText("appens vy")).toBeVisible();
    // ⛔ history.back() är asynkron. Anropades den skulle den landa efter appens egen navigering och ångra den.
    expect(back).not.toHaveBeenCalled();
    expect(new URL(window.location.href).searchParams.has("skapa")).toBe(false);
    back.mockRestore();
  });

  it("utan skapa.grupp finns ingen Ny grupp-rad, och grupper.onSkapa gäller som förut", async () => {
    const onSkapa = vi.fn();
    render(
      <OpsAppShell
        brand="Ops"
        nav={[{ href: "/", label: "Start" }]}
        activeHref="/"
        grupper={{ lista: GRUPPER, aktiv: "g1", onValj: () => {}, onSkapa }}
        skapa={{ handelse: <p>Formulär</p> }}
      >
        <p>appens vy</p>
      </OpsAppShell>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Skapa" }));
    expect(screen.queryByRole("button", { name: "Ny grupp" })).toBeNull();
    await user.keyboard("{Escape}");
    const nav = screen.getAllByRole("navigation", { name: "Mina grupper" })[0];
    await user.click(within(nav).getByRole("button", { name: "Skapa grupp" }));
    expect(onSkapa).toHaveBeenCalledTimes(1);
  });

  it("⛔ färg och ikon på en grupp ritas i gruppanelen", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv="g1" onValj={() => {}} />);
    const beta = screen.getByRole("button", { name: "Beta AB" });
    const marke = within(beta).getByRole("img", { name: "Beta AB" });
    expect(marke).toHaveClass("bg-identity-4");
    expect(marke).toHaveTextContent("BE");
  });
});
