import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { ANGRA_MS } from "../components/OpsSvepRad.jsx";
import { LANGTRYCK_MS } from "../lib/apparark.js";
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

function Harness({ start = poster, lasfel = null, jag = FORFATTARE, trasiga = [], onNavigate = undefined, onRadera = undefined, onLaddaUpp = undefined, onSpelaIn = undefined, inspelare = undefined, filUrl = undefined, hamtaAdress = undefined, grupper = [], onDela = undefined, onSkrivUt = undefined, onGorForslag = undefined }) {
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
        onSpelaIn={onSpelaIn}
        inspelare={inspelare}
        filUrl={filUrl}
        hamtaAdress={hamtaAdress}
        grupper={grupper}
        onDela={onDela}
        onSkrivUt={onSkrivUt}
        onGorForslag={onGorForslag}
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
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Protokoll");
    expect(screen.getByText("Vi beslutade om bokslutet.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Radera" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Redigera" }));
    expect(screen.getByDisplayValue("Vi beslutade om bokslutet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(screen.queryByRole("textbox")).toBeNull();
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

  it("öppning är läsning, och Redigera visas för författaren och admin", () => {
    const { unmount } = render(<Harness jag={{ uid: "uid-annan", roll: "medlem" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.getByText("Vi beslutade om bokslutet.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Redigera" })).toBeNull();
    expect(screen.getByRole("button", { name: "Tillbaka" }).querySelector("svg")).not.toBeNull();
    unmount();

    const admin = render(<Harness jag={{ uid: "uid-annan", roll: "admin" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Redigera" }));
    expect(screen.getByRole("textbox", { name: "Text" })).toHaveValue("Vi beslutade om bokslutet.");
    admin.unmount();

    render(<Harness jag={null} />);
    expect(screen.queryByRole("button", { name: "Ny post" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Redigera" })).toBeNull();
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

  it("radera ligger i menyn för författaren och admin, kräver bekräftelse, och syns inte för andra", () => {
    const onRadera = vi.fn();
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.queryByRole("button", { name: "Radera" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Radera" }));
    expect(screen.getByText("Radera posten? Den går inte att ångra.")).toBeInTheDocument();
    expect(onRadera).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(screen.queryByText("Radera posten? Den går inte att ångra.")).toBeNull();
    unmount();

    const med = render(<Harness onRadera={onRadera} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Radera" }));
    fireEvent.click(screen.getByRole("button", { name: "Radera posten" }));
    expect(onRadera).toHaveBeenCalledWith("a");
    med.unmount();

    const annan = render(<Harness jag={{ uid: "uid-annan", roll: "medlem" }} onRadera={onRadera} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.queryByRole("button", { name: "Åtgärder för Protokoll" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Radera" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Redigera" })).toBeNull();
    annan.unmount();

    render(<Harness jag={{ uid: "uid-annan", roll: "admin" }} onRadera={onRadera} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    expect(screen.getByRole("menuitem", { name: "Radera" })).toBeInTheDocument();
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

  it("listan har ingen inspelare, Ny-menyn har Röstinspelning, och onSpelaIn kastas", () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByRole("button", { name: "Spela in" })).toBeNull();
    expect(document.querySelector("[data-bibliotek-inspelning]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Röstinspelning" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/OpsAppShell/);
    unmount();
    expect(() => render(<Harness onSpelaIn={() => {}} />)).toThrow(/inspelning\.mal/);
  });

  it("delning frågar innan den flyttar", () => {
    const onDela = vi.fn();
    render(<Harness grupper={[{ id: "miranda-ab", namn: "Miranda" }]} onDela={onDela} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Dela" }));
    fireEvent.click(screen.getByRole("button", { name: "Kopiera" }));
    expect(onDela).toHaveBeenCalledWith({ id: "a", groupId: "miranda-ab", satt: "kopiera" });
    fireEvent.click(screen.getByRole("button", { name: "Flytta" }));
    expect(onDela).toHaveBeenCalledWith({ id: "a", groupId: "miranda-ab", satt: "flytta" });
  });

  it("skriv ut visar texten, och ingenting skapas förrän personen väljer", async () => {
    const ljud = {
      ...byggPost({
        groupId: "cps-ab",
        typ: "fil",
        rubrik: "Idé 2026-10-08 21:05",
        fil: { sokvag: "grupper/my/bibliotek/p/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 4000 },
        skapadAv: skapare,
        skapad: tid,
        andrad: tid,
      }),
      id: "ljud",
    };
    const onSkrivUt = vi.fn(async () => ({ text: "Hej", forslag: "arende" }));
    const onGorForslag = vi.fn();
    const { unmount } = render(<Harness start={[ljud]} filUrl={() => "https://exempel.se/ide.webm"} onSkrivUt={onSkrivUt} onGorForslag={onGorForslag} />);
    fireEvent.click(screen.getByRole("button", { name: "Idé 2026-10-08 21:05" }));
    expect(screen.queryByRole("button", { name: /Skapa ärende/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Skriv ut" }));
    expect(await screen.findByText("Hej")).toBeInTheDocument();
    expect(onSkrivUt).toHaveBeenCalledTimes(1);
    expect(onGorForslag).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Spara som anteckning" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skapa ärende, förslag" }));
    expect(onGorForslag).toHaveBeenCalledTimes(1);
    expect(onGorForslag).toHaveBeenCalledWith({ id: "ljud", satt: "arende" });
    unmount();

    const tak = vi.fn(async () => { throw new Error("Dygnstaket är nått."); });
    render(<Harness start={[ljud]} filUrl={() => "https://exempel.se/ide.webm"} onSkrivUt={tak} />);
    fireEvent.click(screen.getByRole("button", { name: "Idé 2026-10-08 21:05" }));
    fireEvent.click(screen.getByRole("button", { name: "Skriv ut" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Dygnstaket är nått.");
    expect(screen.queryByRole("button", { name: /Skapa ärende/ })).toBeNull();
  });

  it("en läsare ser utskriften och ingen knapp, och en saknad koppling syns", () => {
    const ljud = {
      ...byggPost({
        groupId: "cps-ab",
        typ: "fil",
        rubrik: "Idé 2026-10-08 21:05",
        fil: { sokvag: "grupper/my/bibliotek/p/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 4000 },
        utskrift: "Redan skriven",
        skapadAv: skapare,
        skapad: tid,
        andrad: tid,
      }),
      id: "ljud",
    };
    const { unmount } = render(<Harness start={[ljud]} jag={{ uid: "uid-annan", roll: "medlem" }} filUrl={() => "https://exempel.se/ide.webm"} />);
    fireEvent.click(screen.getByRole("button", { name: "Idé 2026-10-08 21:05" }));
    expect(screen.getByText("Redan skriven")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skriv ut" })).toBeNull();
    unmount();

    const tom = { ...ljud, utskrift: "" };
    const andra = render(<Harness start={[tom]} filUrl={() => "https://exempel.se/ide.webm"} />);
    fireEvent.click(screen.getByRole("button", { name: "Idé 2026-10-08 21:05" }));
    expect(screen.getByText("Utskriften är tom.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skriv ut" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Utskriften är inte kopplad. Inget skickades.");
    andra.unmount();
  });

  it("hamtaAdress spelar ljudet i listan och i detaljen, och säger inte att adressen saknas medan den hämtas", async () => {
    const ljud = {
      ...byggPost({
        groupId: "cps-ab",
        typ: "fil",
        rubrik: "Idé 2026-10-08 21:05",
        fil: { sokvag: "grupper/my/bibliotek/p/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 4000 },
        skapadAv: skapare,
        skapad: tid,
        andrad: tid,
      }),
      id: "ljud",
    };
    let los;
    const hamtaAdress = vi.fn((sokvag) => new Promise((resolve) => {
      los = () => resolve(`https://exempel.se/${sokvag}`);
    }));
    const { unmount } = render(<Harness start={[ljud]} hamtaAdress={hamtaAdress} />);
    expect(screen.queryByText("Filen har ingen adress.")).toBeNull();
    expect(screen.getByText("Hämtar ljudet.")).toBeInTheDocument();
    await waitFor(() => expect(hamtaAdress).toHaveBeenCalledWith("grupper/my/bibliotek/p/ide.webm"));
    const anrop = hamtaAdress.mock.calls.length;
    los();
    expect(await screen.findByRole("button", { name: /^Spela / })).toBeInTheDocument();
    expect(document.querySelector("audio")).toHaveAttribute("src", "https://exempel.se/grupper/my/bibliotek/p/ide.webm");
    fireEvent.click(screen.getByRole("button", { name: "Idé 2026-10-08 21:05" }));
    expect(hamtaAdress).toHaveBeenCalledTimes(anrop);
    expect(document.querySelector("audio")).toHaveAttribute("src", "https://exempel.se/grupper/my/bibliotek/p/ide.webm");
    unmount();

    const nekad = vi.fn(async () => { throw new Error("Behörighet saknas."); });
    render(<Harness start={[ljud]} hamtaAdress={nekad} />);
    expect(screen.queryByText("Filen har ingen adress.")).toBeNull();
    expect(await screen.findByRole("alert")).toHaveTextContent("Behörighet saknas.");
  });

  it("ett ljud har rubrik, längd och en spelknapp, inte ikon och hopp i samma rad", () => {
    const ljud = {
      ...byggPost({
        groupId: "cps-ab",
        typ: "fil",
        rubrik: "Idé 2026-10-08 21:05",
        fil: { sokvag: "grupper/my/bibliotek/p/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 4000 },
        durationMs: 4000,
        peaks: Array.from({ length: 48 }, (_, i) => (i % 4 === 0 ? 1 : 0.25)),
        skapadAv: skapare,
        skapad: tid,
        andrad: tid,
      }),
      id: "ljud",
    };
    render(<Harness start={[ljud]} filUrl={() => "https://exempel.se/ide.webm"} />);
    const rad = document.querySelector("[data-bibliotek-ljudrad]");
    expect(rad).not.toBeNull();
    expect(rad?.querySelector("[data-bibliotek-ikon]")).toBeNull();
    expect(screen.getByRole("button", { name: "Idé 2026-10-08 21:05" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spela Idé 2026-10-08 21:05" })).toBeInTheDocument();
    expect(document.querySelector("[data-ljud-langd]")?.textContent).toMatch(/0:04/);
    expect(screen.queryByRole("button", { name: "10 sekunder bakåt" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ladda ned/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Idé 2026-10-08 21:05" }));
    expect(screen.getByRole("menuitem", { name: "Ladda ned" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "10 sekunder bakåt" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Hastighet" })).toBeInTheDocument();
  });

  it("ett ljud utan rubrik heter Röstinspelning plus datum, i listan och i detaljen", () => {
    const ljud = {
      ...byggPost({
        groupId: "cps-ab",
        typ: "fil",
        rubrik: "Tillfälligt",
        fil: { sokvag: "grupper/my/bibliotek/p/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 4000 },
        skapadAv: skapare,
        skapad: tid,
        andrad: tid,
      }),
      id: "ljud",
      rubrik: "",
    };
    render(<Harness start={[ljud]} filUrl={() => "https://exempel.se/ide.webm"} />);
    const rubrik = screen.getByRole("button", { name: /^Röstinspelning / });
    expect(rubrik).toBeInTheDocument();
    fireEvent.click(rubrik);
    expect(screen.getByRole("heading", { level: 1, name: /^Röstinspelning / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10 sekunder bakåt" })).toBeInTheDocument();
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

  it("i detaljen finns bara detaljens Tillbaka, inte en andra till hubben, och den är panelens knapp med chevron", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.queryByRole("link", { name: "Tillbaka till Appar" })).toBeNull();
    const tillbaka = screen.getByRole("button", { name: "Tillbaka" });
    // Spökknappen (`OpsButton`) har ingen chevron och centreras i vyns kolumn. Panelen har chevron 20 px, vänsterställd.
    expect(tillbaka.querySelector("svg")).not.toBeNull();
    expect(tillbaka.className).toContain("self-start");
    expect(tillbaka.className).not.toContain("justify-center");
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
    expect(flikar.map((f) => f.textContent)).toEqual(["Alla 1", "Anteckningar 1", "Länkar 0", "Ljud 0", "Filer 0"]);
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
    expect(within(meny).getAllByRole("menuitem").map((r) => r.textContent)).toEqual(["Anteckning", "Länk", "Fil", "Röstinspelning"]);
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

  it("en anteckning läses som markdown, och fälten kommer först vid Redigera", () => {
    const md = {
      ...byggPost({
        groupId: "cps-ab",
        typ: "anteckning",
        rubrik: "Beslut",
        text: "Vi **beslutade** om [boken](https://example.com/bok).",
        skapadAv: skapare,
        skapad: tid,
        andrad: tid,
      }),
      id: "md",
    };
    render(<Harness start={[md]} />);
    fireEvent.click(screen.getByRole("button", { name: "Beslut" }));
    expect(screen.getByText("beslutade").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "boken" })).toHaveAttribute("href", "https://example.com/bok");
    expect(document.querySelector("[data-ops-markdown='dokument']")?.className).toContain("text-brod");
    expect(document.body.textContent).not.toContain("**");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("svep avslöjar Radera för den som får, och Ångra hindrar anropet", () => {
    vi.useFakeTimers();
    try {
      const onRadera = vi.fn();
      const { unmount } = render(<Harness onRadera={onRadera} />);
      const rad = screen.getByRole("button", { name: "Protokoll" }).closest("li");
      expect(rad).not.toBeNull();
      svep(/** @type {HTMLElement} */ (rad));
      const radera = screen.getByRole("button", { name: "Radera" });
      peka(radera, "pointerdown", 10, 10);
      fireEvent.click(radera);
      expect(screen.getByText("Protokoll tas bort.")).toBeInTheDocument();
      expect(onRadera).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Ångra" }));
      act(() => { vi.advanceTimersByTime(ANGRA_MS); });
      expect(onRadera).not.toHaveBeenCalled();
      unmount();

      const igen = render(<Harness onRadera={onRadera} />);
      const rad2 = screen.getByRole("button", { name: "Protokoll" }).closest("li");
      svep(/** @type {HTMLElement} */ (rad2));
      const knapp = screen.getByRole("button", { name: "Radera" });
      peka(knapp, "pointerdown", 10, 10);
      fireEvent.click(knapp);
      act(() => { vi.advanceTimersByTime(ANGRA_MS); });
      expect(onRadera).toHaveBeenCalledWith("a");
      igen.unmount();

      render(<Harness jag={{ uid: "uid-annan", roll: "medlem" }} onRadera={onRadera} />);
      expect(document.querySelector("[data-ops-svep]")).toBeNull();
      expect(screen.queryByRole("button", { name: "Radera" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("långtryck och högerklick öppnar samma meny som ⋮, och ett kort tryck öppnar posten", () => {
    vi.useFakeTimers();
    try {
      const { unmount } = render(<Harness />);
      const rad = screen.getByRole("button", { name: "Protokoll" }).closest("[data-ops-atgard]");
      expect(rad).not.toBeNull();
      peka(/** @type {HTMLElement} */ (rad), "pointerdown", 20, 20);
      act(() => { vi.advanceTimersByTime(LANGTRYCK_MS - 1); });
      expect(screen.queryByRole("menu")).toBeNull();
      peka(/** @type {HTMLElement} */ (rad), "pointerup", 20, 20);
      fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Protokoll");
      vi.clearAllTimers();
      unmount();

      const langt = render(<Harness />);
      const rad2 = screen.getByRole("button", { name: "Protokoll" }).closest("[data-ops-atgard]");
      peka(/** @type {HTMLElement} */ (rad2), "pointerdown", 20, 20);
      act(() => { vi.advanceTimersByTime(LANGTRYCK_MS); });
      expect(screen.getByRole("menuitem", { name: "Öppna" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Byt namn" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Radera" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
      expect(screen.queryByRole("heading", { name: "Protokoll" })).toBeNull();
      langt.unmount();
    } finally {
      vi.useRealTimers();
    }

    const { unmount } = render(<Harness />);
    const yta = screen.getByRole("button", { name: "Protokoll" }).closest("[data-ops-atgard]");
    fireEvent.contextMenu(/** @type {HTMLElement} */ (yta));
    expect(screen.getByRole("menuitem", { name: "Redigera" })).toBeInTheDocument();
    unmount();

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Öppna" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Protokoll");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("byt namn sparar rubriken och lämnar texten, och kopiera länk skriver adressen", async () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Byt namn" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nytt namn" }), { target: { value: "Årsprotokoll" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    const sparat = document.querySelector("[data-sparat]")?.textContent ?? "";
    expect(sparat).toContain("Årsprotokoll");
    expect(sparat).toContain("Vi beslutade om bokslutet.");
    unmount();

    const writeText = vi.fn().mockResolvedValue(undefined);
    const tidigare = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      render(<Harness />);
      fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Bolagsverket" }));
      expect(screen.queryByRole("menuitem", { name: "Kopiera länk" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("menuitem", { name: "Kopiera länk" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://bolagsverket.se/"));
      expect(await screen.findByText("Länken är kopierad.")).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: tidigare });
    }
  });
});

/**
 * @param {HTMLElement} element
 * @param {number} [tillX]
 */
function peka(element, typ, clientX, clientY) {
  act(() => {
    element.dispatchEvent(new MouseEvent(typ, { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
  });
}

function svep(element, tillX = 80) {
  peka(element, "pointerdown", 240, 24);
  peka(element, "pointermove", tillX, 24);
  peka(element, "pointerup", tillX, 24);
}
