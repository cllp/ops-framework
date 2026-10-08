import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost } from "../lib/bibliotek.js";

/**
 * Listan och detaljen. jsdom mäter att texten finns och att ett tryck byter vy.
 * Hur det ser ut mäts i montaget, med Playwright.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };

const poster = [
  { ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade om bokslutet.", skapadAv: skapare, skapad: tid, andrad: tid }), id: "a" },
  { ...byggPost({ groupId: "cps-ab", typ: "lank", rubrik: "Bolagsverket", url: "https://bolagsverket.se", skapadAv: skapare, skapad: tid, andrad: tid + 1 }), id: "b" },
];

const FORFATTARE = { uid: "uid-1", roll: "medlem" };

function Harness({ start = poster, lasfel = null, jag = FORFATTARE, trasiga = [], onNavigate = undefined, onRadera = undefined, onLaddaUpp = undefined, filUrl = undefined }) {
  const [vald, setVald] = useState(/** @type {(typeof poster)[number] | null} */ (null));
  const [skapar, setSkapar] = useState(/** @type {"anteckning" | "lank" | null} */ (null));
  const [sparat, setSparat] = useState(/** @type {unknown} */ (null));
  return (
    <>
      <OpsBibliotek
        poster={start}
        fel={lasfel}
        jag={jag}
        trasiga={trasiga}
        vald={vald}
        skapar={skapar}
        onOppna={(p) => { setSkapar(null); setVald(/** @type {any} */ (p)); }}
        onStang={() => { setVald(null); setSkapar(null); }}
        onSkapa={(typ) => { setVald(null); setSkapar(typ); }}
        onSpara={(inmatning) => setSparat(inmatning)}
        onRadera={onRadera}
        onLaddaUpp={onLaddaUpp}
        filUrl={filUrl}
        hubHref="/hub"
        onNavigate={onNavigate}
      />
      <output data-sparat="">{sparat ? JSON.stringify(sparat) : ""}</output>
    </>
  );
}

describe("OpsBibliotek", () => {
  it("säger att biblioteket är tomt, och ett läsfel är inte tomhet", () => {
    const { unmount } = render(<Harness start={[]} />);
    expect(screen.getByText("Biblioteket är tomt.")).toBeInTheDocument();
    unmount();
    render(<Harness start={[]} lasfel="Databasen svarade inte." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Databasen svarade inte.");
    expect(screen.queryByText("Biblioteket är tomt.")).toBeNull();
  });

  it("öppnar anteckningen och sparar en ny länk bara med adress", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.getByDisplayValue("Vi beslutade om bokslutet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    // 0.83.0: "+ Ny" bredvid sökfältet, med ett val under Alla (förut två knappar, "Ny anteckning" och "Ny länk").
    fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Länk" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Rubrik" }), { target: { value: "Skatteverket" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Adress" }), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/http eller https/);
    expect(document.querySelector("[data-sparat]")?.textContent).toBe("");
    fireEvent.change(screen.getByRole("textbox", { name: "Adress" }), { target: { value: "https://skatteverket.se" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(document.querySelector("[data-sparat]")?.textContent).toContain("https://skatteverket.se");
    expect(document.querySelector("[data-sparat]")?.textContent).not.toContain("text");
  });

  it("en länk går att öppna, i ny flik och bara på http eller https", () => {
    const ond = { ...poster[1], id: "ond", rubrik: "Ond", url: "javascript:alert(1)" };
    render(<Harness start={[poster[1], ond]} jag={{ uid: "uid-annan", roll: "medlem" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Bolagsverket" }));
    const lank = screen.getByRole("link", { name: "https://bolagsverket.se/" });
    expect(lank).toHaveAttribute("href", "https://bolagsverket.se/");
    expect(lank).toHaveAttribute("target", "_blank");
    expect(lank).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    fireEvent.click(screen.getByRole("button", { name: "Ond" }));
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
  });

  it("formuläret visas för författaren och admin, och andra ser läsläge", () => {
    const { unmount } = render(<Harness jag={{ uid: "uid-annan", roll: "medlem" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.getByText("Vi beslutade om bokslutet.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    unmount();

    const admin = render(<Harness jag={{ uid: "uid-annan", roll: "admin" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.getByRole("textbox", { name: "Text" })).toHaveValue("Vi beslutade om bokslutet.");
    admin.unmount();

    render(<Harness jag={null} />);
    expect(screen.queryByRole("button", { name: "Ny post" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
  });

  it("jag krävs: utan propen kastar vyn, och null är en icke-medlem (granskningen av #304)", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    const utan = { poster, onOppna() {}, onStang() {}, onSkapa() {}, onSpara() {}, hubHref: "/hub" };
    try {
      expect(() => render(<OpsBibliotek {...utan} />)).toThrow(/OpsBibliotek: jag krävs/);
    } finally {
      tyst.mockRestore();
    }
    render(<OpsBibliotek {...utan} jag={null} />);
    expect(screen.getByRole("button", { name: "Protokoll" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ny post" })).toBeNull();
  });

  it("radera syns för författaren och admin, kräver bekräftelse, och syns inte för andra", () => {
    const onRadera = vi.fn();
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    fireEvent.click(screen.getByRole("button", { name: "Radera" }));
    expect(screen.getByText("Radera posten? Den går inte att ångra.")).toBeInTheDocument();
    expect(onRadera).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(screen.queryByText("Radera posten? Den går inte att ångra.")).toBeNull();
    unmount();

    const med = render(<Harness onRadera={onRadera} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    fireEvent.click(screen.getByRole("button", { name: "Radera" }));
    fireEvent.click(screen.getByRole("button", { name: "Radera posten" }));
    expect(onRadera).toHaveBeenCalledWith("a");
    med.unmount();

    const annan = render(<Harness jag={{ uid: "uid-annan", roll: "medlem" }} onRadera={onRadera} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.queryByRole("button", { name: "Radera" })).toBeNull();
    annan.unmount();

    render(<Harness jag={{ uid: "uid-annan", roll: "admin" }} onRadera={onRadera} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.getByRole("button", { name: "Radera" })).toBeInTheDocument();
  });

  it("en trasig rad raderas av den som får, med bekräftelse, och inte av en annan medlem", () => {
    const onRadera = vi.fn();
    const trasiga = [{ id: "x", fel: "Anteckningen saknar text.", groupId: "cps-ab", skapadAv: { uid: "uid-1" } }];
    const { unmount } = render(<Harness trasiga={trasiga} onRadera={onRadera} />);
    fireEvent.click(screen.getByRole("button", { name: "Radera x" }));
    expect(onRadera).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Radera posten" }));
    expect(onRadera).toHaveBeenCalledWith("x");
    unmount();

    render(<Harness trasiga={trasiga} jag={{ uid: "uid-annan", roll: "medlem" }} onRadera={onRadera} />);
    expect(screen.queryByRole("button", { name: "Radera x" })).toBeNull();
  });

  it("fel format och för stor fil visas, och en bild öppnas i förhandsvisning", () => {
    const onLaddaUpp = vi.fn();
    const { unmount } = render(<Harness onLaddaUpp={onLaddaUpp} />);
    fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Fil" }));
    const stor = new File(["x"], "stor.jpg", { type: "image/jpeg" });
    Object.defineProperty(stor, "size", { value: 26 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("Fil"), { target: { files: [stor] } });
    expect(screen.getAllByRole("alert").some((n) => /Taket/.test(n.textContent ?? ""))).toBe(true);
    expect(onLaddaUpp).not.toHaveBeenCalled();
    const zip = new File(["x"], "a.zip", { type: "application/zip" });
    fireEvent.change(screen.getByLabelText("Fil"), { target: { files: [zip] } });
    expect(screen.getAllByRole("alert").some((n) => /application\/zip/.test(n.textContent ?? ""))).toBe(true);
    unmount();

    const bild = {
      ...byggPost({
        groupId: "cps-ab",
        typ: "fil",
        rubrik: "Kvitto",
        fil: { sokvag: "grupper/cps-ab/bibliotek/p/kvitto.jpg", namn: "kvitto.jpg", mime: "image/jpeg", byte: 2048 },
        skapadAv: skapare,
        skapad: tid,
        andrad: tid,
      }),
      id: "bild",
    };
    const pdf = {
      ...byggPost({
        groupId: "cps-ab",
        typ: "fil",
        rubrik: "Avtal",
        fil: { sokvag: "grupper/cps-ab/bibliotek/p/avtal.pdf", namn: "avtal.pdf", mime: "application/pdf", byte: 4096 },
        skapadAv: skapare,
        skapad: tid,
        andrad: tid + 2,
      }),
      id: "pdf",
    };
    render(<Harness start={[bild, pdf]} jag={{ uid: "uid-annan", roll: "medlem" }} filUrl={(p) => `https://exempel.se/${p.fil.sokvag}`} />);
    fireEvent.click(screen.getByRole("button", { name: "Kvitto" }));
    fireEvent.click(screen.getByRole("button", { name: "Förhandsvisa Kvitto" }));
    expect(screen.getByRole("dialog", { name: "Förhandsvisning" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stäng" }));
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    fireEvent.click(screen.getByRole("button", { name: "Avtal" }));
    const lank = screen.getByRole("link", { name: /avtal\.pdf/ });
    expect(lank).toHaveAttribute("target", "_blank");
    expect(lank).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("trasiga rader visas som ett antal med skäl, inte tyst", () => {
    render(<Harness trasiga={[{ id: "x", fel: "Anteckningen saknar text." }]} />);
    const ruta = document.querySelector("[data-bibliotek-trasiga]");
    expect(ruta).toHaveAttribute("role", "status");
    expect(ruta).toHaveTextContent("1 post kunde inte läsas och visas inte.");
    expect(ruta).toHaveTextContent("x: Anteckningen saknar text.");
    expect(screen.getByRole("button", { name: "Protokoll" })).toBeInTheDocument();
  });

  /*
   * ⛔ 0.83.0: CP 2026-10-08 17:52, "Bibliotek behöver en tillbaka knapp också precis som ekonomi. Sedan navigeringen på
   * liknande sätt." Proven nedan är röda mot 0.82.0: där fanns ingen länk till hubben, typerna var en segmentväljare
   * (`radiogroup`/knappar, ingen `tablist`) och skapandet två knappar under den.
   */
  it("Tillbaka leder till hubben som i Ekonomi, och rubriken är modulens namn", () => {
    const onNavigate = vi.fn((_href, e) => e.preventDefault());
    render(<Harness onNavigate={onNavigate} />);
    const tillbaka = screen.getByRole("link", { name: "Tillbaka till Appar" });
    expect(tillbaka).toHaveAttribute("href", "/hub");
    expect(tillbaka).toHaveTextContent("Tillbaka");
    fireEvent.click(tillbaka);
    expect(onNavigate).toHaveBeenCalledWith("/hub", expect.anything());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bibliotek");
  });

  it("i detaljen finns bara detaljens Tillbaka, inte en andra till hubben", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.queryByRole("link", { name: "Tillbaka till Appar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Tillbaka" })).toBeInTheDocument();
  });

  it("hubHref krävs, som i OpsModulSida", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<OpsBibliotek poster={poster} jag={null} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} />)).toThrow(/OpsBibliotek: hubHref krävs/);
    } finally {
      tyst.mockRestore();
    }
  });

  it("typerna är en flikrad med ikon, namn och antal, också 0, och en flik byter urvalet", () => {
    render(<Harness start={[poster[0]]} />);
    const rad = screen.getByRole("tablist", { name: "Typ i biblioteket" });
    const flikar = within(rad).getAllByRole("tab");
    expect(flikar.map((f) => f.textContent)).toEqual(["Alla 1", "Anteckningar 1", "Länkar 0", "Filer 0"]);
    expect(flikar.every((f) => f.querySelector("svg"))).toBe(true);
    expect(flikar[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.mouseDown(flikar[2], { button: 0, ctrlKey: false });
    expect(within(rad).getByRole("tab", { name: "Länkar 0" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("button", { name: "Protokoll" })).toBeNull();
    expect(screen.getByText("Inga länkar ännu.")).toBeInTheDocument();
  });

  it("sökordet står kvar när fliken byts", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Sök i biblioteket" }), { target: { value: "bokslut" } });
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Anteckningar/ }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("searchbox", { name: "Sök i biblioteket" })).toHaveValue("bokslut");
    expect(screen.getByRole("button", { name: "Protokoll" })).toBeInTheDocument();
  });

  it("+ Ny under Alla ger ett val, och under en typ skapar den typen direkt", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
    const meny = screen.getByRole("menu", { name: "Ny post" });
    expect(within(meny).getAllByRole("menuitem").map((r) => r.textContent)).toEqual(["Anteckning", "Länk", "Fil"]);
    fireEvent.click(within(meny).getByRole("menuitem", { name: "Anteckning" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ny anteckning");
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Länkar/ }), { button: 0, ctrlKey: false });
    expect(screen.queryByRole("button", { name: "Ny post" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ny länk" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ny länk");
  });

  it("sök och + Ny står på samma rad, och sidan har vyns rytm (luften mäts i Playwright, här bara klassen)", () => {
    render(<Harness />);
    const sok = screen.getByRole("searchbox", { name: "Sök i biblioteket" });
    const ny = screen.getByRole("button", { name: "Ny post" });
    const rad = sok.closest(".flex.items-center");
    expect(rad).not.toBeNull();
    expect(rad?.contains(ny)).toBe(true);
    expect(document.querySelector("[data-bibliotek]")?.className).toContain("gap-4");
  });
});
