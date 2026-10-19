import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsHandelsefiler } from "../components/OpsHandelsefiler.jsx";
import { OpsPlatsfiler } from "../components/OpsPlatsfiler.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";
import { arendeBibliotek, handelseBibliotek } from "../lib/bibliotek.js";

/**
 * Ett ärendes filer i vyn (0.122.0, cllp/lifehub.app#366 punkt 3): sektionen "Filer" som `OpsPlatsfiler` för ett ärende, spärren mellan slagen, och att
 * ärendets plats aldrig syns i platsväljaren. jsdom mäter att rätt sak finns och att rätt sak saknas; hur det ser ut mäts inte här (regel 12: ärendet citerar
 * ingen SS-skärmbild).
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

const GRUPP = "cps-ab";
const PLATS = arendeBibliotek(GRUPP, "a1");
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

describe("OpsPlatsfiler för ett ärende", () => {
  it("ritar rubriken Filer och filerna på ärendets plats, och inget annat ärendes, ingen händelses och ingenting av vyramen", async () => {
    const { kalla } = bygg({
      poster: [
        post("a", "Biljett Selma"),
        post("b", "Biljett Kim"),
        post("c", "Annat ärende", { groupId: arendeBibliotek(GRUPP, "a2") }),
        post("d", "En händelse", { groupId: handelseBibliotek(GRUPP, "a1") }),
      ],
    });
    const { container } = render(<OpsPlatsfiler kalla={kalla} jag={KIM} kanLaggaTill />);
    expect(screen.getByRole("heading", { name: "Filer" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Biljett Selma")).toBeInTheDocument());
    expect(screen.getByText("Biljett Kim")).toBeInTheDocument();
    expect(screen.queryByText("Annat ärende")).toBeNull();
    expect(screen.queryByText("En händelse")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(container.querySelector("[data-bibliotek-inbaddad]")).not.toBeNull();
    expect(container.querySelectorAll("[data-bibliotek-lista] > *").length).toBeGreaterThanOrEqual(2);
  });

  it("sektionen bär attributet för sitt slag: data-arendefiler för ett ärende och data-handelsefiler för en händelse", async () => {
    const { kalla } = bygg();
    const { container, unmount } = render(<OpsPlatsfiler kalla={kalla} jag={KIM} kanLaggaTill />);
    expect(container.querySelector("section[data-arendefiler]")).not.toBeNull();
    expect(container.querySelector("[data-handelsefiler]")).toBeNull();
    await waitFor(() => expect(screen.getByText("Inga filer än.")).toBeInTheDocument());
    unmount();
    const h = bygg({ groupId: handelseBibliotek(GRUPP, "h1") });
    const ritad = render(<OpsPlatsfiler kalla={h.kalla} jag={KIM} kanLaggaTill />);
    expect(ritad.container.querySelector("section[data-handelsefiler]")).not.toBeNull();
    expect(ritad.container.querySelector("[data-arendefiler]")).toBeNull();
    await waitFor(() => expect(screen.getByText("Inga filer än.")).toBeInTheDocument());
  });

  it("skriver ut att det är tomt, och meningen under säger ärendet och inte händelsen", async () => {
    const { kalla } = bygg();
    render(<OpsPlatsfiler kalla={kalla} jag={KIM} kanLaggaTill />);
    await waitFor(() => expect(screen.getByText("Inga filer än.")).toBeInTheDocument());
    expect(screen.getByText(/hör bara till ärendet/)).toBeInTheDocument();
    expect(screen.queryByText(/hör bara till händelsen/)).toBeNull();
  });

  it("rubriken följer språket, och rubrik och Ladda upp kan bytas", async () => {
    const { kalla } = bygg({ poster: [post("a", "Biljett")] });
    const { unmount } = render(<OpsPlatsfiler kalla={kalla} jag={KIM} kanLaggaTill sprak="en" />);
    expect(screen.getByRole("heading", { name: "Files" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Biljett")).toBeInTheDocument());
    unmount();
    render(<OpsPlatsfiler kalla={kalla} jag={KIM} kanLaggaTill rubrik="Bilagor" laddaUppEtikett="Lägg till" />);
    expect(screen.getByRole("heading", { name: "Bilagor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lägg till" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Biljett")).toBeInTheDocument());
  });

  it("Ladda upp finns för den som får lägga till, och inte för en läsare eller en icke-medlem", async () => {
    const { kalla } = bygg({ poster: [post("a", "Biljett")] });
    const { unmount } = render(<OpsPlatsfiler kalla={kalla} jag={KIM} kanLaggaTill />);
    expect(screen.getByRole("button", { name: "Ladda upp" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Biljett")).toBeInTheDocument());
    unmount();

    const lasare = render(<OpsPlatsfiler kalla={kalla} jag={KIM} kanLaggaTill={false} />);
    await waitFor(() => expect(screen.getByText("Biljett")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Ladda upp" })).toBeNull();
    lasare.unmount();

    render(<OpsPlatsfiler kalla={kalla} jag={null} kanLaggaTill />);
    await waitFor(() => expect(screen.getByText("Biljett")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Ladda upp" })).toBeNull();
  });

  it("laddar upp en fil: formuläret heter Ny fil, tillbaka heter Filer, och filen hamnar på ärendets plats", async () => {
    const { kalla, laddaUpp, source } = bygg();
    render(<OpsPlatsfiler kalla={kalla} jag={KIM} kanLaggaTill />);
    fireEvent.click(screen.getByRole("button", { name: "Ladda upp" }));
    expect(screen.getByRole("heading", { name: "Ny fil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filer" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Fil"), { target: { files: [new File(["x"], "biljett.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(laddaUpp).toHaveBeenCalledTimes(1));
    expect(laddaUpp.mock.calls[0][0].sokvag).toMatch(new RegExp(`^grupper/${PLATS}/bibliotek/[^/]+/biljett\\.pdf$`));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Ny fil" })).toBeNull());
    const rader = await source.list("bibliotek", {});
    expect(rader).toHaveLength(1);
    expect(rader[0].groupId).toBe(PLATS);
    expect(rader[0].typ).toBe("fil");
  });

  it("en fil öppnas med sin tillbaka till Filer, och kan tas bort av författaren", async () => {
    const { kalla, source } = bygg({ poster: [post("a", "Biljett Selma")] });
    render(<OpsPlatsfiler kalla={kalla} jag={KIM} kanLaggaTill />);
    await waitFor(() => expect(screen.getByText("Biljett Selma")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Biljett Selma" }));
    expect(await screen.findByRole("button", { name: "Filer" })).toBeInTheDocument();
    expect(source.list).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Filer" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ladda upp" })).toBeInTheDocument());
  });
});

describe("Spärren mellan slagen", () => {
  const tyst = () => vi.spyOn(console, "error").mockImplementation(() => {});

  it("kastar för en källa som inte är ett objekts, och felet säger vilka platser som gäller", () => {
    const { kalla } = bygg({ groupId: GRUPP });
    const spy = tyst();
    expect(() => render(<OpsPlatsfiler kalla={kalla} jag={KIM} kanLaggaTill />)).toThrow(/en händelses plats eller ett ärendes plats/);
    expect(() => render(<OpsPlatsfiler kalla={undefined} jag={KIM} kanLaggaTill />)).toThrow(/OpsPlatsfiler: kalla ska vara/);
    spy.mockRestore();
  });

  it("slag='arende' godtar bara ett ärendes källa, och slag='handelse' bara en händelses", async () => {
    const arende = bygg().kalla;
    const handelse = bygg({ groupId: handelseBibliotek(GRUPP, "h1") }).kalla;
    const spy = tyst();
    expect(() => render(<OpsPlatsfiler slag="arende" kalla={handelse} jag={KIM} kanLaggaTill />)).toThrow(/ett ärendes plats/);
    expect(() => render(<OpsPlatsfiler slag="handelse" kalla={arende} jag={KIM} kanLaggaTill />)).toThrow(/en händelses plats/);
    spy.mockRestore();
    render(<OpsPlatsfiler slag="arende" kalla={arende} jag={KIM} kanLaggaTill />);
    expect(screen.getByRole("heading", { name: "Filer" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Inga filer än.")).toBeInTheDocument());
  });

  it("ett slag som inte finns kastar, så att ett stavfel inte gör spärren till en tyst nedsläppsväg", () => {
    const { kalla } = bygg();
    const spy = tyst();
    expect(() => render(<OpsPlatsfiler slag="arrende" kalla={kalla} jag={KIM} kanLaggaTill />)).toThrow(/slag är "handelse" eller "arende"/);
    spy.mockRestore();
  });

  it("OpsHandelsefiler är kvar för händelser och kastar för ett ärendes källa, hur den än anropas", async () => {
    const arende = bygg().kalla;
    const handelse = bygg({ groupId: handelseBibliotek(GRUPP, "h1") }).kalla;
    const spy = tyst();
    expect(() => render(<OpsHandelsefiler kalla={arende} jag={KIM} kanLaggaTill />)).toThrow(/en händelses plats/);
    // Ett slag som appen försöker skicka in vinner inte över namnet.
    expect(() => render(<OpsHandelsefiler slag="arende" kalla={arende} jag={KIM} kanLaggaTill />)).toThrow(/en händelses plats/);
    spy.mockRestore();
    render(<OpsHandelsefiler kalla={handelse} jag={KIM} kanLaggaTill />);
    expect(screen.getByRole("heading", { name: "Filer" })).toBeInTheDocument();
    expect(await screen.findByText(/hör bara till händelsen/)).toBeInTheDocument();
  });

  it("kastar utan jag och utan kanLaggaTill, så en glömd prop märks", () => {
    const { kalla } = bygg();
    const spy = tyst();
    expect(() => render(<OpsPlatsfiler kalla={kalla} kanLaggaTill />)).toThrow(/jag krävs/);
    expect(() => render(<OpsPlatsfiler kalla={kalla} jag={KIM} />)).toThrow(/kanLaggaTill krävs/);
    spy.mockRestore();
  });
});

describe("Ärendets plats finns inte i platsväljaren", () => {
  const trivial = { poster: [], jag: KIM, vald: null, skapar: null, onOppna: () => {}, onStang: () => {}, onSkapa: () => {}, onSpara: () => {}, hubHref: "/hubb" };

  it("OpsBibliotek kastar om ett ärendes plats ges som plats eller som mål för Flytta, med ett skäl som nämner ärendet, men ritar gruppens platser som förut", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const platser = [{ id: GRUPP, namn: "CPS" }, { id: PLATS, namn: "Köpa biljetter" }];
    expect(() => render(<OpsBibliotek {...trivial} platser={platser} plats={GRUPP} onPlats={() => {}} />)).toThrow(/ett ärendes bibliotek/);
    expect(() => render(<OpsBibliotek {...trivial} grupper={[{ id: PLATS, namn: "Köpa biljetter" }]} onDela={() => {}} />)).toThrow(/ett ärendes bibliotek/);
    // En händelses plats har kvar sin text.
    expect(() => render(<OpsBibliotek {...trivial} grupper={[{ id: handelseBibliotek(GRUPP, "h1"), namn: "Bio" }]} onDela={() => {}} />)).toThrow(/en händelses bibliotek/);
    spy.mockRestore();

    render(<OpsBibliotek {...trivial} platser={[{ id: GRUPP, namn: "CPS" }, { id: "mitt~uid-kim", namn: "Mitt bibliotek" }]} plats={GRUPP} onPlats={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /CPS/ }));
    expect(screen.getByRole("menuitemradio", { name: /Mitt bibliotek/ })).toBeInTheDocument();
    expect(screen.queryByText(/Köpa biljetter/)).toBeNull();
  });

  it("tomText byts bara för den inbäddade listan, och förvalet är händelsens mening", () => {
    const { unmount } = render(<OpsBibliotek {...trivial} inbaddad />);
    expect(screen.getByText("Filer som läggs till här hör bara till händelsen.")).toBeInTheDocument();
    unmount();
    render(<OpsBibliotek {...trivial} inbaddad tomText="Egen mening." />);
    expect(screen.getByText("Egen mening.")).toBeInTheDocument();
  });
});
