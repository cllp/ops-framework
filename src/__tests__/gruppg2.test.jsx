import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsGruppFormular } from "../components/OpsGruppFormular.jsx";
import { OpsGruppSida } from "../components/OpsGruppSida.jsx";
import { OpsGruppanel } from "../components/OpsGruppanel.jsx";
import { medlemsinfo } from "../lib/gruppmedlemmar.js";

/**
 * Gruppkortet, detaljsidan och redigeringsläget (0.32.0, #180 G2). Ritningen mot SS mäts i Chromium (`check-skalyta` avsnitt 23).
 */

afterEach(() => window.history.replaceState(null, "", "/"));

const RAD = (userId, roll, extra = {}) => ({ userId, groupId: "g1", roll, status: "aktiv", namn: userId, bild: "", ...extra });

describe("⛔ medlemsinfo härleder, den lagrar inget", () => {
  it("räknar aktiva, ordnar ägare före admin före medlem, sedan namn", () => {
    const info = medlemsinfo([RAD("Cecilia", "medlem"), RAD("Bo", "admin"), RAD("Ann", "medlem"), RAD("Dan", "agare")]);
    expect(info.medlemsantal).toBe(4);
    expect(info.medlemmar.map((m) => `${m.id}:${m.roll}`)).toEqual(["Dan:agare", "Bo:admin", "Ann:medlem", "Cecilia:medlem"]);
    expect(info.avatarer.map((a) => a.id)).toEqual(["Dan", "Bo", "Ann", "Cecilia"]);
  });

  it("⛔ ett avslutat medlemskap är inte en medlem", () => {
    expect(medlemsinfo([RAD("a", "agare"), RAD("b", "medlem", { status: "avslutad" })]).medlemsantal).toBe(1);
  });

  it("⛔ groupId väljer, och en annan grupps rader räknas inte", () => {
    const rader = [RAD("a", "agare"), RAD("b", "medlem", { groupId: "g2" })];
    expect(medlemsinfo(rader, "g1").medlemsantal).toBe(1);
    expect(medlemsinfo(rader, "g2").medlemsantal).toBe(1);
    expect(medlemsinfo(rader, "g3").medlemsantal).toBe(0);
  });

  it("tomhet är ett svar: noll och tomma listor, aldrig utelämnat", () => {
    expect(medlemsinfo([])).toMatchObject({ medlemsantal: 0, avatarer: [], medlemmar: [] });
  });

  it("samma person två gånger är en medlem, och en icke-lista kastar", () => {
    expect(medlemsinfo([RAD("a", "agare"), RAD("a", "agare")]).medlemsantal).toBe(1);
    expect(() => medlemsinfo(/** @type {any} */ ("x"))).toThrow(/måste vara en lista/);
  });
});

describe("⛔ kortet i gruppanelen", () => {
  const GRUPPER = [
    { id: "g1", namn: { sv: "Alfa AB" }, roll: /** @type {const} */ ("agare"), farg: "3", medlemsantal: 6, avatarer: ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, namn: id })) },
    { id: "g2", namn: { sv: "Beta AB" }, roll: /** @type {const} */ ("medlem"), medlemsantal: 1 },
    { id: "g3", namn: { sv: "Gamma AB" }, roll: /** @type {const} */ ("admin") },
    { id: "g4", namn: { sv: "Delta AB" } },
  ];
  const kort = (namn) => screen.getAllByRole("button", { name: namn })[0].closest("li");

  it("(i) finns för alla med onInfo och öppnar gruppens sida, utan att också välja kortet", async () => {
    const onInfo = vi.fn();
    const onValj = vi.fn();
    render(<OpsGruppanel grupper={GRUPPER} aktiv="g1" onValj={onValj} onInfo={onInfo} onRedigera={() => {}} />);
    for (const n of ["Alfa AB", "Beta AB", "Gamma AB", "Delta AB"]) expect(within(kort(n)).getByRole("button", { name: "Visa grupp" })).toBeInTheDocument();
    await userEvent.setup().click(within(kort("Beta AB")).getByRole("button", { name: "Visa grupp" }));
    expect(onInfo).toHaveBeenCalledWith("g2");
    expect(onValj).not.toHaveBeenCalled();
  });

  it("⛔ pennan ritas bara för ägare och admin, aldrig för medlem eller en roll som saknas", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv="g1" onValj={() => {}} onInfo={() => {}} onRedigera={() => {}} />);
    expect(within(kort("Alfa AB")).queryByRole("button", { name: "Redigera grupp" })).toBeInTheDocument();
    expect(within(kort("Gamma AB")).queryByRole("button", { name: "Redigera grupp" })).toBeInTheDocument();
    expect(within(kort("Beta AB")).queryByRole("button", { name: "Redigera grupp" })).toBeNull();
    expect(within(kort("Delta AB")).queryByRole("button", { name: "Redigera grupp" })).toBeNull();
  });

  it("utan onInfo och onRedigera ritas inga av knapparna", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv="g1" onValj={() => {}} />);
    expect(screen.queryByRole("button", { name: "Visa grupp" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Redigera grupp" })).toBeNull();
  });

  it("⛔ det valda kortet har gruppens färg som kant och ljus bakgrund, ett ovalt inte", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv="g1" onValj={() => {}} />);
    expect(kort("Alfa AB")).toHaveClass("border-identity-3", "bg-identity-3/6");
    expect(kort("Beta AB")).not.toHaveClass("border-identity-3");
  });

  it("en vald grupp utan färg behåller accenten", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv="g4" onValj={() => {}} />);
    expect(kort("Delta AB")).toHaveClass("border-accent");
  });

  it("medlemsantal och fyra avatarer plus +N", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv="g1" onValj={() => {}} />);
    expect(within(kort("Alfa AB")).getByText("6")).toBeInTheDocument();
    expect(within(kort("Alfa AB")).getByText("+2")).toBeInTheDocument();
  });
});

describe("⛔ OpsGruppSida", () => {
  const MEDLEMMAR = medlemsinfo([RAD("Dan", "agare"), RAD("Bo", "admin"), RAD("Ann", "medlem")]).medlemmar;
  const G = { id: "g1", namn: { sv: "Alfa AB" }, beskrivning: "Vi gör saker", ort: "Visby", roll: /** @type {const} */ ("agare") };

  it("ritar namn, beskrivning, ort och medlemmar med räknare", () => {
    render(<OpsGruppSida grupp={G} medlemmar={MEDLEMMAR} />);
    expect(screen.getByRole("heading", { level: 1, name: "Alfa AB" })).toBeInTheDocument();
    expect(screen.getByText("Vi gör saker")).toBeInTheDocument();
    expect(screen.getByText("Visby")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Medlemmar (3)" })).toBeInTheDocument();
  });

  it("⛔ Ägare- och Admin-etikett vid de som förvaltar, ingen vid vanliga medlemmar", () => {
    render(<OpsGruppSida grupp={G} medlemmar={MEDLEMMAR} />);
    const rader = screen.getAllByRole("listitem");
    expect(within(rader[0]).getByText("Ägare")).toBeInTheDocument();
    expect(within(rader[1]).getByText("Admin")).toBeInTheDocument();
    expect(within(rader[2]).queryByText(/Ägare|Admin/)).toBeNull();
  });

  it("⛔ Redigera bara för ägare och admin OCH bara med onRedigera", () => {
    const { rerender } = render(<OpsGruppSida grupp={G} onRedigera={() => {}} />);
    expect(screen.getByRole("button", { name: "Redigera grupp" })).toBeInTheDocument();
    rerender(<OpsGruppSida grupp={{ ...G, roll: "admin" }} onRedigera={() => {}} />);
    expect(screen.getByRole("button", { name: "Redigera grupp" })).toBeInTheDocument();
    rerender(<OpsGruppSida grupp={{ ...G, roll: "medlem" }} onRedigera={() => {}} />);
    expect(screen.queryByRole("button", { name: "Redigera grupp" })).toBeNull();
    const { roll: _r, ...utanRoll } = G;
    rerender(<OpsGruppSida grupp={utanRoll} onRedigera={() => {}} />);
    expect(screen.queryByRole("button", { name: "Redigera grupp" })).toBeNull();
    rerender(<OpsGruppSida grupp={G} />);
    expect(screen.queryByRole("button", { name: "Redigera grupp" })).toBeNull();
  });

  it("appens snabbval ritas och anropas, och utan dem ritas ingen rad", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<OpsGruppSida grupp={G} snabbval={[{ icon: <i />, label: "Kalender", onClick }]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Kalender" }));
    expect(onClick).toHaveBeenCalled();
    rerender(<OpsGruppSida grupp={G} />);
    expect(document.querySelector("[data-gruppsida-snabbval]")).toBeNull();
  });

  it("tillbaka, en tom medlemslista säger det, och grupp krävs", async () => {
    const onTillbaka = vi.fn();
    render(<OpsGruppSida grupp={G} onTillbaka={onTillbaka} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Tillbaka" }));
    expect(onTillbaka).toHaveBeenCalled();
    expect(screen.getByText("Inga medlemmar")).toBeInTheDocument();
    expect(() => render(<OpsGruppSida grupp={/** @type {any} */ (null)} />)).toThrow(/grupp krävs/);
  });
});

describe("⛔ OpsGruppFormular i redigeringsläge", () => {
  const G = { id: "g1", namn: { sv: "Alfa AB", en: "Alpha Ltd" }, farg: "2", ikon: "hus", bild: "grupper/g1/logga.png", beskrivning: "Text", ort: "Visby", epostsprak: /** @type {const} */ ("en") };
  const rita = (p = {}) => {
    const onSpara = vi.fn(async () => {});
    const onKlar = vi.fn();
    const onSkapad = vi.fn();
    const ut = render(<OpsGruppFormular formId="f" grupp={G} onSpara={onSpara} onKlar={onKlar} onSkapad={onSkapad} {...p} />);
    return { onSpara, onKlar, onSkapad, ...ut };
  };
  const skicka = () => fireEvent.submit(document.querySelector("form#f"));

  it("fälten är förifyllda och medlemssektionen finns inte", () => {
    rita();
    expect(screen.getByLabelText(/Gruppnamn/)).toHaveValue("Alfa AB");
    expect(screen.getByLabelText("Beskrivning")).toHaveValue("Text");
    expect(screen.getByLabelText("Ort")).toHaveValue("Visby");
    expect(document.querySelector("[data-gruppmedlemmar]")).toBeNull();
  });

  it("⛔ oförändrat namn skickas tillbaka som det Namn det var, den engelska översättningen tappas inte", async () => {
    const { onSpara } = rita();
    skicka();
    await waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(onSpara.mock.calls[0][0].grupp).toEqual({ namn: G.namn, farg: "2", ikon: "hus", bild: "grupper/g1/logga.png", beskrivning: "Text", ort: "Visby", epostsprak: "en" });
  });

  it("⛔ oförändrat namn utan engelska får inte en engelska påhittad", async () => {
    const { onSpara } = rita({ grupp: { ...G, namn: { sv: "Alfa AB" } } });
    skicka();
    await waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(onSpara.mock.calls[0][0].grupp.namn).toEqual({ sv: "Alfa AB" });
  });

  it("ett ändrat namn med olika språk ändrar bara visningsspråket", async () => {
    const { onSpara } = rita();
    const f = screen.getByLabelText(/Gruppnamn/);
    await userEvent.setup().clear(f);
    await userEvent.setup().type(f, "Beta AB");
    skicka();
    await waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(onSpara.mock.calls[0][0].grupp.namn).toEqual({ sv: "Beta AB", en: "Alpha Ltd" });
  });

  it("⛔ stänger panelen FÖRE onSkapad, med gruppens id", async () => {
    const ordning = [];
    const { onSkapad } = rita({ onKlar: () => ordning.push("klar"), onSkapad: vi.fn((id) => ordning.push(`skapad ${id}`)) });
    skicka();
    await waitFor(() => expect(ordning).toEqual(["klar", "skapad g1"]));
    expect(onSkapad).not.toHaveBeenCalled();
  });

  it("faller onSpara visas felet och panelen står kvar", async () => {
    const { onKlar } = rita({ onSpara: vi.fn(async () => { throw new Error("nekad av reglerna"); }) });
    skicka();
    expect(await screen.findByText("Ändringarna kunde inte sparas")).toBeInTheDocument();
    expect(screen.getByText("nekad av reglerna")).toBeInTheDocument();
    expect(onKlar).not.toHaveBeenCalled();
  });

  it("⛔ bilden laddas upp via appens callback och sökvägen följer med när man sparar", async () => {
    const onLaddaUppBild = vi.fn(async () => ({ sokvag: "grupper/g1/ny.png", url: "https://x/ny.png" }));
    const { onSpara } = rita({ onLaddaUppBild });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Färg och ikon/ }));
    const fil = new File(["x"], "ny.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Ladda upp bild"), fil);
    await waitFor(() => expect(onLaddaUppBild).toHaveBeenCalledWith(fil));
    skicka();
    await waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(onSpara.mock.calls[0][0].grupp.bild).toBe("grupper/g1/ny.png");
  });

  it("⛔ en bild över 2 MB avvisas före uppladdningen, och en uppladdning som faller säger det", async () => {
    const onLaddaUppBild = vi.fn(async () => { throw new Error("nej"); });
    rita({ onLaddaUppBild });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Färg och ikon/ }));
    const stor = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "stor.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Ladda upp bild"), stor);
    expect(await screen.findByText("Bilden är för stor. Högst 2 MB.")).toBeInTheDocument();
    expect(onLaddaUppBild).not.toHaveBeenCalled();
    await user.upload(screen.getByLabelText("Ladda upp bild"), new File(["x"], "a.png", { type: "image/png" }));
    expect(await screen.findByText("Bilden kunde inte laddas upp.")).toBeInTheDocument();
  });

  it("Ta bort bilden anropar appen och rensar sökvägen", async () => {
    const onTaBortBild = vi.fn(async () => {});
    const { onSpara } = rita({ bildUrl: "https://x/a.png", onLaddaUppBild: async () => ({ sokvag: "", url: "" }), onTaBortBild });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Färg och ikon/ }));
    await user.click(screen.getByRole("button", { name: "Ta bort bilden" }));
    await waitFor(() => expect(onTaBortBild).toHaveBeenCalled());
    skicka();
    await waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(onSpara.mock.calls[0][0].grupp.bild).toBe("");
  });

  it("utan onSpara kastar redigeringsläget, och utan onLaddaUppBild finns ingen bildväljare", async () => {
    expect(() => render(<OpsGruppFormular grupp={G} />)).toThrow(/onSpara krävs/);
    rita();
    await userEvent.setup().click(screen.getByRole("button", { name: /Färg och ikon/ }));
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

describe("⛔ pennan öppnar samma panel i redigeringsläge (skapa.redigeraGrupp)", () => {
  const GRUPPER = [
    { id: "g1", namn: { sv: "Alfa AB" }, roll: /** @type {const} */ ("agare") },
    { id: "g2", namn: { sv: "Beta AB" }, roll: /** @type {const} */ ("medlem") },
  ];
  const skal = (extra = {}, grupper = {}) =>
    render(
      <OpsAppShell
        brand="Ops"
        nav={[{ href: "/", label: "Start" }]}
        activeHref="/"
        grupper={{ lista: GRUPPER, aktiv: "g1", onValj: () => {}, ...grupper }}
        skapa={{
          sparaEtikett: "Spara",
          redigeraGrupp: ({ formId, groupId, onKlar }) => <OpsGruppFormular formId={formId} onKlar={onKlar} grupp={{ id: groupId, namn: { sv: "Alfa AB" } }} onSpara={async () => {}} />,
          ...extra,
        }}
      >
        <p>appens vy</p>
      </OpsAppShell>,
    );

  it("pennan på ett kort öppnar panelen Redigera grupp med gruppens id i adressen", async () => {
    skal();
    const nav = screen.getAllByRole("navigation", { name: "Mina grupper" })[0];
    await userEvent.setup().click(within(nav).getByRole("button", { name: "Redigera grupp" }));
    expect(screen.getByRole("region", { name: "Redigera grupp" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    const u = new URL(window.location.href);
    expect(u.searchParams.get("skapa")).toBe("redigera-grupp");
    expect(u.searchParams.get("grupp")).toBe("g1");
    expect(screen.getByLabelText(/Gruppnamn/)).toHaveValue("Alfa AB");
  });

  it("⛔ medlemmens kort har ingen penna, och Spara stänger utan history.back och rensar båda parametrarna", async () => {
    const back = vi.spyOn(window.history, "back");
    skal();
    const nav = screen.getAllByRole("navigation", { name: "Mina grupper" })[0];
    expect(within(nav).getAllByRole("button", { name: "Redigera grupp" })).toHaveLength(1);
    const user = userEvent.setup();
    await user.click(within(nav).getByRole("button", { name: "Redigera grupp" }));
    await user.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Redigera grupp" })).toBeNull());
    expect(back).not.toHaveBeenCalled();
    expect(new URL(window.location.href).search).toBe("");
    back.mockRestore();
  });

  it("utan skapa.redigeraGrupp anropas grupper.onRedigera", async () => {
    const onRedigera = vi.fn();
    skal({ redigeraGrupp: undefined }, { onRedigera });
    const nav = screen.getAllByRole("navigation", { name: "Mina grupper" })[0];
    await userEvent.setup().click(within(nav).getByRole("button", { name: "Redigera grupp" }));
    expect(onRedigera).toHaveBeenCalledWith("g1");
  });
});
