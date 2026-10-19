import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { OpsHandelsefiler } from "../components/OpsHandelsefiler.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";
import { handelseBibliotek } from "../lib/bibliotek.js";

/**
 * En händelses filer i vyn (0.121.0, cllp/lifehub.app#366): sektionen "Filer" i händelsepanelen, och att platsen aldrig syns i platsväljaren.
 * jsdom mäter att rätt sak finns och att rätt sak saknas; hur det ser ut mäts inte här (regel 12: ärendet citerar ingen SS-skärmbild).
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

const GRUPP = "cps-ab";
const PLATS = handelseBibliotek(GRUPP, "h1");
const KIM = { uid: "uid-kim", roll: "medlem", groupId: GRUPP, status: "aktiv" };
const tid = 1_700_000_000_000;
const skapare = (uid = KIM.uid) => ({ uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" });

function post(id, rubrik, extra = {}) {
  return {
    id,
    groupId: PLATS,
    typ: "fil",
    rubrik,
    fil: { sokvag: `grupper/${PLATS}/bibliotek/${id}/${id}.pdf`, namn: `${id}.pdf`, mime: "application/pdf", byte: 2048, klar: true },
    skapadAv: skapare(),
    skapad: tid,
    andrad: tid,
    ...extra,
  };
}

function bygg({ poster = [], groupId = PLATS } = {}) {
  const source = createMemorySource({ bibliotek: poster });
  const laddaUpp = vi.fn(async () => {});
  const kalla = createBibliotekskalla({
    source,
    collection: "bibliotek",
    groupId,
    skapare: () => skapare(),
    jag: () => KIM,
    anteckna: () => {},
    lagring: { laddaUpp },
    sokvag: ({ groupId: g, postId, namn }) => `grupper/${g}/bibliotek/${postId}/${namn}`,
  });
  return { source, kalla, laddaUpp };
}

describe("OpsHandelsefiler", () => {
  it("ritar rubriken Filer och filerna på händelsens plats, och ingenting av vyramen eller sökraden", async () => {
    const { kalla } = bygg({ poster: [post("a", "Biljett Selma"), post("b", "Biljett Kim"), post("c", "Annan händelse", { groupId: handelseBibliotek(GRUPP, "h2") })] });
    const { container } = render(<OpsHandelsefiler kalla={kalla} jag={KIM} kanLaggaTill />);
    expect(screen.getByRole("heading", { name: "Filer" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Biljett Selma")).toBeInTheDocument());
    expect(screen.getByText("Biljett Kim")).toBeInTheDocument();
    // En annan händelses fil hör inte hit.
    expect(screen.queryByText("Annan händelse")).toBeNull();
    // Inbäddat: ingen sökruta, inga flikar, ingen tillbaka-rad till hubben.
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("button", { name: /Taggar|Ny post/ })).toBeNull();
    expect(container.querySelector("[data-bibliotek-inbaddad]")).not.toBeNull();
    expect(container.querySelectorAll("[data-bibliotek-lista] > *").length).toBeGreaterThanOrEqual(2);
  });

  it("skriver ut att det är tomt i stället för att lämna en tom yta", async () => {
    const { kalla } = bygg();
    render(<OpsHandelsefiler kalla={kalla} jag={KIM} kanLaggaTill />);
    await waitFor(() => expect(screen.getByText("Inga filer än.")).toBeInTheDocument());
    expect(screen.getByText(/hör bara till händelsen/)).toBeInTheDocument();
  });

  it("Ladda upp finns för den som får lägga till, och inte för en läsare eller en icke-medlem", async () => {
    const { kalla } = bygg({ poster: [post("a", "Biljett")] });
    const { unmount } = render(<OpsHandelsefiler kalla={kalla} jag={KIM} kanLaggaTill />);
    expect(screen.getByRole("button", { name: "Ladda upp" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Biljett")).toBeInTheDocument());
    unmount();

    const lasare = render(<OpsHandelsefiler kalla={kalla} jag={KIM} kanLaggaTill={false} />);
    await waitFor(() => expect(screen.getByText("Biljett")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Ladda upp" })).toBeNull();
    lasare.unmount();

    render(<OpsHandelsefiler kalla={kalla} jag={null} kanLaggaTill />);
    await waitFor(() => expect(screen.getByText("Biljett")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Ladda upp" })).toBeNull();
  });

  it("laddar upp en fil: formuläret heter Ny fil, tillbaka heter Filer, och filen hamnar på händelsens plats", async () => {
    const { kalla, laddaUpp, source } = bygg();
    render(<OpsHandelsefiler kalla={kalla} jag={KIM} kanLaggaTill />);
    fireEvent.click(screen.getByRole("button", { name: "Ladda upp" }));
    expect(screen.getByRole("heading", { name: "Ny fil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filer" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Fil"), { target: { files: [new File(["x"], "biljett.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(laddaUpp).toHaveBeenCalledTimes(1));
    expect(laddaUpp.mock.calls[0][0].sokvag).toMatch(new RegExp(`^grupper/${PLATS}/bibliotek/[^/]+/biljett\\.pdf$`));
    // Tillbaka i listan, där filen syns.
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Ny fil" })).toBeNull());
    const rader = await source.list("bibliotek", {});
    expect(rader).toHaveLength(1);
    expect(rader[0].groupId).toBe(PLATS);
    await waitFor(() => expect(screen.getByRole("button", { name: "Ladda upp" })).toBeInTheDocument());
  });

  it("en fil öppnas med sin tillbaka till Filer", async () => {
    const { kalla } = bygg({ poster: [post("a", "Biljett Selma")] });
    render(<OpsHandelsefiler kalla={kalla} jag={KIM} kanLaggaTill />);
    await waitFor(() => expect(screen.getByText("Biljett Selma")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Biljett Selma" }));
    expect(await screen.findByRole("button", { name: "Filer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ladda upp" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Filer" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ladda upp" })).toBeInTheDocument());
  });

  it("kastar för en källa som inte är en händelses, så gruppens bibliotek aldrig ritas under en händelse", () => {
    const { kalla } = bygg({ groupId: GRUPP });
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsHandelsefiler kalla={kalla} jag={KIM} kanLaggaTill />)).toThrow(/händelses plats/);
    tyst.mockRestore();
  });

  it("kastar utan jag och utan kanLaggaTill, så en glömd prop märks", () => {
    const { kalla } = bygg();
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsHandelsefiler kalla={kalla} kanLaggaTill />)).toThrow(/jag krävs/);
    expect(() => render(<OpsHandelsefiler kalla={kalla} jag={KIM} />)).toThrow(/kanLaggaTill krävs/);
    tyst.mockRestore();
  });
});

describe("Platsen finns inte i platsväljaren", () => {
  const trivial = { poster: [], jag: KIM, vald: null, skapar: null, onOppna: () => {}, onStang: () => {}, onSkapa: () => {}, onSpara: () => {}, hubHref: "/hubb" };

  it("OpsBibliotek kastar om en händelseplats ges som plats eller som mål för Flytta, men ritar gruppens platser som förut", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    const platser = [{ id: GRUPP, namn: "CPS" }, { id: PLATS, namn: "Bio med Selma" }];
    expect(() => render(<OpsBibliotek {...trivial} platser={platser} plats={GRUPP} onPlats={() => {}} />)).toThrow(/händelses bibliotek/);
    expect(() => render(<OpsBibliotek {...trivial} grupper={[{ id: PLATS, namn: "Bio med Selma" }]} onDela={() => {}} />)).toThrow(/händelses bibliotek/);
    tyst.mockRestore();

    render(<OpsBibliotek {...trivial} platser={[{ id: GRUPP, namn: "CPS" }, { id: "mitt~uid-kim", namn: "Mitt bibliotek" }]} plats={GRUPP} onPlats={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /CPS/ }));
    expect(screen.getByRole("menuitemradio", { name: /Mitt bibliotek/ })).toBeInTheDocument();
    expect(screen.queryByText(/Bio med Selma/)).toBeNull();
  });

  it("inbäddad tål inte en plats att växla till", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsBibliotek {...trivial} inbaddad platser={[{ id: GRUPP, namn: "CPS" }, { id: "mitt~uid-kim", namn: "Mitt" }]} plats={GRUPP} onPlats={() => {}} />)).toThrow(/enda plats|en enda plats/);
    tyst.mockRestore();
  });

  it("det fristående biblioteket kräver fortfarande hubHref, den inbäddade inte", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    const { hubHref: _h, ...utan } = trivial;
    expect(() => render(<OpsBibliotek {...utan} />)).toThrow(/hubHref krävs/);
    tyst.mockRestore();
    render(<OpsBibliotek {...utan} inbaddad />);
    expect(screen.getByText("Inga filer än.")).toBeInTheDocument();
  });
});

describe("Händelsepanelens slot filer", () => {
  const handelse = { id: "h1", titel: "Bio med Selma", datum: "2026-10-24", kravSvar: true };

  it("ritar filerna efter bilagan och före svaren, och ingenting när appen inte skickar dem", () => {
    const bilaga = { dataUrl: "data:text/plain;base64,QQ==", namn: "gammal.txt", typ: "text/plain", tecken: 12 };
    const { container, rerender } = render(
      <OpsHandelsePanel handelse={{ ...handelse, bilaga }} onTillbaka={() => {}} svar={<p>SVAREN</p>} filer={<section aria-label="Filer-sektionen">FILERNA</section>} />,
    );
    const html = container.innerHTML;
    expect(html.indexOf("gammal.txt")).toBeGreaterThan(-1);
    expect(html.indexOf("FILERNA")).toBeGreaterThan(html.indexOf("gammal.txt"));
    expect(html.indexOf("SVAREN")).toBeGreaterThan(html.indexOf("FILERNA"));
    expect(container.querySelector("[data-handelsefiler-slot]")).not.toBeNull();

    rerender(<OpsHandelsePanel handelse={{ ...handelse, bilaga }} onTillbaka={() => {}} svar={<p>SVAREN</p>} />);
    expect(container.querySelector("[data-handelsefiler-slot]")).toBeNull();
  });

  it("OpsHandelsefiler i panelen ger en enda rubrik Filer", async () => {
    const { kalla } = bygg({ poster: [post("a", "Biljett Selma")] });
    render(<OpsHandelsePanel handelse={{ id: "h1", titel: "Bio med Selma", datum: "2026-10-24" }} onTillbaka={() => {}} filer={<OpsHandelsefiler kalla={kalla} jag={KIM} kanLaggaTill />} />);
    await waitFor(() => expect(screen.getByText("Biljett Selma")).toBeInTheDocument());
    expect(screen.getAllByRole("heading", { name: "Filer" })).toHaveLength(1);
    const sektion = screen.getByRole("heading", { name: "Filer" }).closest("section");
    expect(within(/** @type {HTMLElement} */ (sektion)).getByText("Biljett Selma")).toBeInTheDocument();
  });
});
