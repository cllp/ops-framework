import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { ANGRA_MS } from "../components/OpsSvepRad.jsx";
import { LANGTRYCK_MS } from "../lib/apparark.js";
import { byggPost, kodaToppar } from "../lib/bibliotek.js";

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

/** En bild, ett dokument och ett ljud: de tre sorterna fil som flikarna delar upp. */
function filposter() {
  /** @param {string} id @param {string} rubrik @param {{ namn: string, mime: string }} fil @param {number} steg */
  const fil = (id, rubrik, { namn, mime }, steg) => ({
    ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik, fil: { sokvag: `grupper/cps-ab/bibliotek/${id}/${namn}`, namn, mime, byte: 2048 }, skapadAv: skapare, skapad: tid, andrad: tid + steg }),
    id,
  });
  return [
    fil("bild", "Kvitto", { namn: "kvitto.jpg", mime: "image/jpeg" }, 2),
    fil("pdf", "Avtal", { namn: "avtal.pdf", mime: "application/pdf" }, 3),
    fil("ljud", "Idé", { namn: "ide.webm", mime: "audio/webm" }, 4),
  ];
}

function Harness({ start = poster, lasfel = null, jag = FORFATTARE, trasiga = [], onNavigate = undefined, onRadera = undefined, onLaddaUpp = undefined, onSpelaIn = undefined, inspelare = undefined, filUrl = undefined, hamtaAdress = undefined, grupper = [], onDela = undefined, onSkrivUt = undefined, onGorForslag = undefined, onFyllLjud = undefined, onSparaOverride = undefined }) {
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
        onSpara={onSparaOverride ?? ((inmatning) => setSparat(inmatning))}
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
        onFyllLjud={onFyllLjud}
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
    expect(screen.queryByRole("button", { name: "Redigera" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Redigera" }));
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

  it("öppning är läsning, och Redigera ligger i ⋯ för författaren och admin (samma som ljud)", () => {
    const { unmount } = render(<Harness jag={{ uid: "uid-annan", roll: "medlem" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.getByText("Vi beslutade om bokslutet.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Redigera" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Åtgärder för Protokoll" })).toBeNull();
    expect(screen.getByRole("button", { name: "Tillbaka" }).querySelector("svg")).not.toBeNull();
    unmount();

    const admin = render(<Harness jag={{ uid: "uid-annan", roll: "admin" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Redigera" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Redigera" }));
    expect(screen.getByRole("textbox", { name: "Text" })).toHaveValue("Vi beslutade om bokslutet.");
    admin.unmount();

    render(<Harness jag={null} />);
    expect(screen.queryByRole("button", { name: "Ny post" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Redigera" })).toBeNull();
  });

  it("detaljhuvudet har Tillbaka, ikon och ⋯ på en rad, rubrik på egen rad med rollen rubrik", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    const huvud = document.querySelector("[data-bibliotek-detaljhuvud]");
    expect(huvud).not.toBeNull();
    const rad = huvud?.firstElementChild;
    expect(rad?.contains(screen.getByRole("button", { name: "Tillbaka" }))).toBe(true);
    expect(rad?.querySelector("[data-bibliotek-ikon]")).not.toBeNull();
    expect(rad?.contains(screen.getByRole("button", { name: "Åtgärder för Protokoll" }))).toBe(true);
    const rubrik = screen.getByRole("heading", { level: 1, name: "Protokoll" });
    expect(rubrik.className).toContain("text-rubrik");
    expect(rubrik.className).not.toContain("text-sida");
    expect(rad?.contains(rubrik)).toBe(false);
    expect(huvud?.contains(rubrik)).toBe(true);
    expect(document.querySelector("[data-bibliotek-meta]")?.textContent).toContain("Skriven av Kim");
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    expect(screen.getByRole("menuitem", { name: "Radera" })).toBeInTheDocument();
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

  it("delning frågar innan den flyttar, och rutan stängs först när det gick", async () => {
    const onDela = vi.fn(() => Promise.resolve());
    render(<Harness grupper={[{ id: "miranda-ab", namn: "Miranda" }]} onDela={onDela} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Flytta eller kopiera" }));
    expect(onDela).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Kopiera" }));
    await waitFor(() => expect(onDela).toHaveBeenCalledWith({ id: "a", groupId: "miranda-ab", satt: "kopiera" }));
    expect(await screen.findByText("Kopierad till Miranda.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kopiera" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Flytta eller kopiera" }));
    fireEvent.click(screen.getByRole("button", { name: "Flytta" }));
    await waitFor(() => expect(onDela).toHaveBeenCalledWith({ id: "a", groupId: "miranda-ab", satt: "flytta" }));
  });

  it("ett fel i delningen står kvar i rutan med skälet", async () => {
    const onDela = vi.fn(() => Promise.reject(new Error("Posten kopierades, men kunde inte tas bort där den låg (nej). Den finns nu på båda ställena.")));
    render(<Harness grupper={[{ id: "miranda-ab", namn: "Miranda" }]} onDela={onDela} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Flytta eller kopiera" }));
    fireEvent.click(screen.getByRole("button", { name: "Flytta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Den finns nu på båda ställena.");
    expect(screen.getByRole("button", { name: "Flytta" })).toBeInTheDocument();
  });

  // ⛔ 0.95.0: gruppvalet är OpsSelect och inte webbläsarens `<select>` (CP 2026-10-13). Provet väljer den ANDRA
  // gruppen, för med en enda grupp hade ett val som aldrig når `onDela` varit grönt.
  // ⛔ 0.101.0: postens egen grupp står inte i listan. Att "flytta" dit hade varit en kopia på samma ställe.
  it("delning väljer grupp i ramverkets väljare, aldrig i webbläsarens, och inte postens egen grupp", async () => {
    const onDela = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    render(<Harness grupper={[{ id: "miranda-ab", namn: "Miranda" }, { id: "kor-ab", namn: "Kören" }, { id: "cps-ab", namn: "CPS" }]} onDela={onDela} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Flytta eller kopiera" }));
    expect(document.querySelector("select")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Flytta eller kopiera" })).toBeInTheDocument();
    const valjare = screen.getByRole("combobox", { name: "Flytta eller kopiera till" });
    expect(valjare).toHaveTextContent("Miranda");
    await user.click(valjare);
    expect(screen.queryByRole("option", { name: "CPS" })).toBeNull();
    await user.click(screen.getByRole("option", { name: "Kören" }));
    await user.click(screen.getByRole("button", { name: "Kopiera" }));
    expect(onDela).toHaveBeenCalledWith({ id: "a", groupId: "kor-ab", satt: "kopiera" });
  });

  it("filfältet är dolt bakom ramverkets knapp och den valda filen skrivs ut", () => {
    render(<Harness onLaddaUpp={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Fil" }));
    expect(screen.getByLabelText("Fil")).toHaveClass("hidden");
    expect(screen.getByText("Ingen fil vald.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Fil"), { target: { files: [new File(["x"], "kvitto.pdf", { type: "application/pdf" })] } });
    expect(screen.getByText("kvitto.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Byt fil" })).toBeInTheDocument();
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

  it("ett ljud är ett kort som de andra: liten spelknapp där ikonen står, rubrik, typetikett och längd, inga hopp", () => {
    const ljud = {
      ...byggPost({
        groupId: "cps-ab",
        typ: "fil",
        rubrik: "Idé 2026-10-08 21:05",
        fil: { sokvag: "grupper/my/bibliotek/p/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 4000 },
        durationMs: 4000,
        peaks: kodaToppar(Array.from({ length: 48 }, (_, i) => (i % 4 === 0 ? 1 : 0.25))),
        skapadAv: skapare,
        skapad: tid,
        andrad: tid,
      }),
      id: "ljud",
    };
    render(<Harness start={[ljud]} filUrl={() => "https://exempel.se/ide.webm"} />);
    const lista = screen.getByRole("list", { name: "Biblioteket" });
    const kort = /** @type {HTMLElement} */ (lista.querySelector("[data-bibliotek-kort]"));
    expect(kort.getAttribute("data-bibliotek-kort")).toBe("ljud");
    // Spelknappen står där ikonen står på de andra korten, och den är spelarens lilla läge.
    const ikon = /** @type {HTMLElement} */ (kort.querySelector("[data-bibliotek-ikon]"));
    expect(ikon.querySelector("[data-ljudspelare='liten']")).not.toBeNull();
    expect(within(ikon).getByRole("button", { name: "Spela Idé 2026-10-08 21:05" })).toBeInTheDocument();
    expect(within(kort).getByRole("button", { name: "Idé 2026-10-08 21:05" })).toBeInTheDocument();
    expect(kort.querySelector("[data-bibliotek-typ]")?.textContent).toBe("Ljud · webm");
    expect(document.querySelector("[data-ljud-langd]")?.textContent).toBe("0:04");
    expect(screen.queryByRole("button", { name: "10 sekunder bakåt" })).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByRole("link", { name: /Ladda ned/ })).toBeNull();
    expect(document.querySelector("[data-bibliotek-ljudrad]")).toBeNull();
  });

  it("⛔ menyn för ett ljud är kort: Byt namn, Kopiera länk och Radera, och ingen spelarstyrning, Taggar eller Öppna (0.102.0)", () => {
    // CP 2026-10-14, med en skärmbild av en meny med tio rader: "Vad är detta med hastighet mm och spolning när en låt/ljud inte
    // ens har startat?"
    const ljud = {
      ...byggPost({
        groupId: "cps-ab",
        typ: "fil",
        rubrik: "Idé 2026-10-08 21:05",
        fil: { sokvag: "grupper/my/bibliotek/p/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 4000 },
        durationMs: 4000,
        skapadAv: skapare,
        skapad: tid,
        andrad: tid,
      }),
      id: "ljud",
    };
    render(<Harness start={[ljud]} filUrl={() => "https://exempel.se/ide.webm"} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Idé 2026-10-08 21:05" }));
    const meny = screen.getByRole("menu", { name: "Idé 2026-10-08 21:05" });
    expect(within(meny).getAllByRole("menuitem").map((r) => r.textContent)).toEqual(["Byt namn", "Kopiera länk", "Radera"]);
    for (const borta of ["Hastighet", "10 sekunder bakåt", "10 sekunder framåt", "Taggar", "Öppna", "Ladda ned", "Redigera"]) {
      expect(within(meny).queryByRole("menuitem", { name: borta }), borta).toBeNull();
    }
    // Namnet står överst i rutan, så det syns vilken post menyn gäller.
    expect(document.querySelector("[data-ops-atgard-namn]")?.textContent).toBe("Idé 2026-10-08 21:05");
  });

  it("⛔ längden skrivs på posten bara av den som får ändra den, men visas för alla", async () => {
    // Reglerna släpper bara författaren och en admin till en uppdatering. Alla andra medlemmar skickade en skrivning
    // som nekades, i bakgrunden, för varje ljudrad de tittade på.
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    try {
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
      const laddaLangd = () => {
        const el = /** @type {HTMLAudioElement} */ (document.querySelector("audio"));
        Object.defineProperty(el, "duration", { configurable: true, get: () => 4 });
        act(() => { el.dispatchEvent(new Event("loadedmetadata")); });
      };

      const forfattare = vi.fn();
      const a = render(<Harness start={[ljud]} jag={FORFATTARE} filUrl={() => "https://exempel.se/ide.webm"} onFyllLjud={forfattare} />);
      laddaLangd();
      await waitFor(() => expect(forfattare).toHaveBeenCalledTimes(1));
      expect(forfattare).toHaveBeenCalledWith(expect.objectContaining({ id: "ljud", durationMs: 4000 }));
      a.unmount();

      const admin = vi.fn();
      const b = render(<Harness start={[ljud]} jag={{ uid: "uid-admin", roll: "admin" }} filUrl={() => "https://exempel.se/ide.webm"} onFyllLjud={admin} />);
      laddaLangd();
      await waitFor(() => expect(admin).toHaveBeenCalledTimes(1));
      b.unmount();

      const annan = vi.fn();
      const c = render(<Harness start={[ljud]} jag={{ uid: "uid-annan", roll: "medlem" }} filUrl={() => "https://exempel.se/ide.webm"} onFyllLjud={annan} />);
      laddaLangd();
      await waitFor(() => expect(document.querySelector("[data-ljud-langd]")?.textContent).toMatch(/0:04/));
      expect(annan).not.toHaveBeenCalled();
      c.unmount();

      const last = vi.fn();
      render(<Harness start={[ljud]} jag={null} filUrl={() => "https://exempel.se/ide.webm"} onFyllLjud={last} />);
      laddaLangd();
      await waitFor(() => expect(document.querySelector("[data-ljud-langd]")?.textContent).toMatch(/0:04/));
      expect(last).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ längden och vågen skickas som två anrop, i ordning: avvisas vågen sparas längden ändå, och felet loggas med postens id", async () => {
    // https://github.com/cllp/ops-framework/issues/349: en app som ännu inte deployat de nya reglerna nekar vågen, och längden ska gå igenom ändå.
    const tidigareAudio = globalThis.AudioContext;
    globalThis.AudioContext = class {
      async decodeAudioData() {
        return { duration: 4, getChannelData: () => new Float32Array(48 * 2).fill(0.5) };
      }
      async close() {}
    };
    vi.stubGlobal("fetch", async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
    const logg = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const ljud = {
        ...byggPost({
          groupId: "cps-ab",
          typ: "fil",
          rubrik: "Idé två",
          fil: { sokvag: "grupper/my/bibliotek/p/ide2.webm", namn: "ide2.webm", mime: "audio/webm", byte: 4000 },
          skapadAv: skapare,
          skapad: tid,
          andrad: tid,
        }),
        id: "ljud-vag",
      };
      /** @type {Array<Record<string, unknown>>} */
      const anrop = [];
      const onFyllLjud = vi.fn(async (inmatning) => {
        anrop.push(inmatning);
        if (inmatning.peaks) throw new Error("maximum of 1000 expressions");
      });
      render(<Harness start={[ljud]} jag={FORFATTARE} filUrl={() => "https://exempel.se/ide2.webm"} onFyllLjud={onFyllLjud} />);
      const el = /** @type {HTMLAudioElement} */ (document.querySelector("audio"));
      Object.defineProperty(el, "duration", { configurable: true, get: () => 4 });
      act(() => { el.dispatchEvent(new Event("loadedmetadata")); });
      await waitFor(() => expect(onFyllLjud).toHaveBeenCalledTimes(2));
      expect(Object.keys(anrop[0]).sort()).toEqual(["durationMs", "id"]);
      expect(Object.keys(anrop[1]).sort()).toEqual(["id", "peaks"]);
      // Vågen går ut som den sparas, en sträng (#349), inte som 48 tal.
      expect(anrop[1].peaks).toMatch(/^[A-Za-z0-9_-]{48}$/);
      await waitFor(() => expect(logg).toHaveBeenCalled());
      const rad = logg.mock.calls.find((a) => String(a[0]).includes("vågen"));
      expect(rad?.[0]).toContain("ljud-vag");
      expect(rad?.[1]).toBeInstanceOf(Error);
      // Längden gick igenom och loggades inte som ett fel.
      expect(logg.mock.calls.some((a) => String(a[0]).includes("längden"))).toBe(false);
    } finally {
      logg.mockRestore();
      vi.unstubAllGlobals();
      if (tidigareAudio) globalThis.AudioContext = tidigareAudio;
      else delete globalThis.AudioContext;
    }
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
    // Detaljen har den fulla spelaren. Hopp och hastighet kommer först när ljudet startats (provat i ljudspelare.test.jsx), och
    // Ladda ned står där hela tiden.
    expect(document.querySelector("[data-ljudspelare]")?.getAttribute("data-ljudspelare")).toBe("full");
    expect(screen.getByRole("button", { name: /^Spela Röstinspelning / })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ladda ned/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "10 sekunder bakåt" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Uppspelningshastighet/ })).toBeNull();
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

  it("flikarna är SessionStudios med ikon, namn och antal, en tom flik döljs men Allt och Ljud syns alltid, och en flik byter urvalet", () => {
    const { unmount } = render(<Harness start={[poster[0]]} />);
    const rad = screen.getByRole("tablist", { name: "Typ i biblioteket" });
    const flikar = within(rad).getAllByRole("tab");
    expect(flikar.map((f) => f.textContent)).toEqual(["Allt1", "Ljud0", "Anteckningar1"]);
    expect(flikar.every((f) => f.querySelector("svg"))).toBe(true);
    expect(flikar[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.mouseDown(within(rad).getByRole("tab", { name: /^Ljud/ }), { button: 0 });
    expect(within(rad).getByRole("tab", { name: /^Ljud/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("button", { name: "Protokoll" })).toBeNull();
    expect(screen.getByText("Inget här ännu.")).toBeInTheDocument();
    unmount();

    // Med varje typ finns alla sex, i SessionStudios ordning.
    render(<Harness start={[...poster, ...filposter()]} />);
    const alla = screen.getByRole("tablist", { name: "Typ i biblioteket" });
    expect(within(alla).getAllByRole("tab").map((f) => f.textContent)).toEqual(["Allt5", "Ljud1", "Anteckningar1", "Bilder1", "Dokument1", "Länkar1"]);
  });

  it("⛔ Bilder och Dokument delar upp filerna, och ljudet står under Ljud och inte under någon av dem (0.102.0)", () => {
    render(<Harness start={[...poster, ...filposter()]} />);
    const rad = screen.getByRole("tablist", { name: "Typ i biblioteket" });
    /** @param {RegExp} namn */
    const under = (namn) => {
      fireEvent.mouseDown(within(rad).getByRole("tab", { name: namn }), { button: 0 });
      expect(within(rad).getByRole("tab", { name: namn })).toHaveAttribute("aria-selected", "true");
      return [...screen.getByRole("list", { name: "Biblioteket" }).querySelectorAll("[data-bibliotek-kort]")].map((k) => k.getAttribute("data-bibliotek-kort"));
    };
    expect(under(/^Bilder/)).toEqual(["bild"]);
    expect(screen.getByRole("button", { name: "Kvitto" })).toBeInTheDocument();
    expect(under(/^Dokument/)).toEqual(["dokument"]);
    expect(screen.getByRole("button", { name: "Avtal" })).toBeInTheDocument();
    expect(under(/^Ljud/)).toEqual(["ljud"]);
    expect(under(/^Länkar/)).toEqual(["lank"]);
    expect(under(/^Allt/)).toHaveLength(5);
  });

  it("en flik som töms medan den är vald faller tillbaka till Allt och försvinner", () => {
    const { rerender } = render(<OpsBibliotek poster={[...poster, ...filposter()]} jag={FORFATTARE} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Bilder/ }), { button: 0 });
    expect(screen.getByRole("tab", { name: /^Bilder/ })).toHaveAttribute("aria-selected", "true");
    rerender(<OpsBibliotek poster={poster} jag={FORFATTARE} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" />);
    expect(screen.queryByRole("tab", { name: /^Bilder/ })).toBeNull();
    expect(screen.getByRole("tab", { name: /^Allt/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Protokoll" })).toBeInTheDocument();
  });

  it("⛔ flikarna är samma flikrad på smal och bred skärm, aldrig en väljare, med samma tomma flikar dolda (0.102.0)", () => {
    // Under 768 px var flikarna först en OpsSelect. SessionStudios app har samma rad som på webben, som man rullar i sidled.
    const tidigare = window.matchMedia;
    try {
      for (const smal of [true, false]) {
        Object.defineProperty(window, "matchMedia", {
          configurable: true,
          writable: true,
          value: (/** @type {string} */ q) => ({ media: q, matches: smal && q === "(max-width: 767px)", addEventListener() {}, removeEventListener() {} }),
        });
        const { unmount } = render(<Harness start={[poster[0]]} />);
        expect(screen.queryByRole("combobox", { name: "Typ i biblioteket" })).toBeNull();
        const rad = screen.getByRole("tablist", { name: "Typ i biblioteket" });
        expect(within(rad).getAllByRole("tab").map((f) => f.textContent)).toEqual(["Allt1", "Ljud0", "Anteckningar1"]);
        fireEvent.mouseDown(within(rad).getByRole("tab", { name: /^Ljud/ }), { button: 0 });
        expect(within(rad).getByRole("tab", { name: /^Ljud/ })).toHaveAttribute("aria-selected", "true");
        expect(screen.queryByRole("button", { name: "Protokoll" })).toBeNull();
        unmount();
      }
    } finally {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: tidigare });
    }
  });

  it("⛔ flikarna går med piltangenterna, Home och End, och fliken styr panelen (granskningen av PR 366, MÅSTE 3)", async () => {
    render(<Harness />);
    const allt = screen.getByRole("tab", { name: /^Allt/ });
    act(() => allt.focus());
    fireEvent.keyDown(allt, { key: "ArrowRight" });
    await waitFor(() => expect(document.activeElement?.getAttribute("role")).toBe("tab"));
    const andra = /** @type {HTMLElement} */ (document.activeElement);
    expect(andra).not.toBe(allt);
    await waitFor(() => expect(andra).toHaveAttribute("aria-selected", "true"));
    fireEvent.keyDown(andra, { key: "Home" });
    await waitFor(() => expect(document.activeElement).toBe(allt));
    await waitFor(() => expect(allt).toHaveAttribute("aria-selected", "true"));
    const panel = document.getElementById(/** @type {string} */ (allt.getAttribute("aria-controls")));
    expect(panel?.getAttribute("role")).toBe("tabpanel");
    expect(within(/** @type {HTMLElement} */ (panel)).getByRole("button", { name: "Protokoll" })).toBeTruthy();
  });

  it("sökordet står kvar när fliken byts", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Sök i biblioteket" }), { target: { value: "bokslut" } });
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Anteckningar/ }), { button: 0 });
    // Golv: fliken bytte verkligen, annars hade Protokoll stått kvar under Allt och provet varit grönt utan att mäta något.
    expect(screen.getByRole("tab", { name: /^Anteckningar/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("searchbox", { name: "Sök i biblioteket" })).toHaveValue("bokslut");
    expect(screen.getByRole("button", { name: "Protokoll" })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Länkar/ }), { button: 0 });
    expect(screen.getByRole("searchbox", { name: "Sök i biblioteket" })).toHaveValue("bokslut");
    expect(screen.getByText("Inga träffar.")).toBeInTheDocument();
  });

  it("+ Ny under Alla ger ett val, och under en typ skapar den typen direkt", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
    const meny = screen.getByRole("menu", { name: "Ny post" });
    expect(within(meny).getAllByRole("menuitem").map((r) => r.textContent)).toEqual(["Anteckning", "Länk", "Fil", "Röstinspelning"]);
    fireEvent.click(within(meny).getByRole("menuitem", { name: "Anteckning" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ny anteckning");
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Länkar/ }), { button: 0 });
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
      // ⛔ 0.102.0: ingen Öppna i menyn, ett tryck på kortet öppnar redan.
      expect(screen.queryByRole("menuitem", { name: "Öppna" })).toBeNull();
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
    const meny = screen.getByRole("menu", { name: "Protokoll" });
    // Högerklick ger samma korta meny som ⋮ och långtrycket. Redigera finns i detaljen, inte i listan.
    expect(within(meny).getAllByRole("menuitem").map((r) => r.textContent)).toEqual(["Byt namn", "Radera"]);
    unmount();

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    expect(within(screen.getByRole("menu", { name: "Protokoll" })).getAllByRole("menuitem").map((r) => r.textContent)).toEqual(["Byt namn", "Radera"]);
    fireEvent.keyDown(screen.getByRole("menu", { name: "Protokoll" }), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Protokoll");
    expect(screen.queryByRole("textbox")).toBeNull();
    // I detaljen står Redigera först i menyn.
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    expect(screen.getAllByRole("menuitem").map((r) => r.textContent)).toEqual(["Redigera", "Byt namn", "Radera"]);
  });

  it("⛔ ett sparande som avvisas syns i formuläret och står kvar i redigering, och två tryck sparar en gång", async () => {
    /** @type {(v?: unknown) => void} */
    let los = () => {};
    /** @type {(e: Error) => void} */
    let avvisa = () => {};
    const onSpara = vi.fn(() => new Promise((resolve, reject) => {
      los = resolve;
      avvisa = reject;
    }));
    const { unmount } = render(<Harness onSparaOverride={onSpara} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Redigera" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Text" }), { target: { value: "Ändrad text." } });
    const spara = screen.getByRole("button", { name: "Spara" });
    fireEvent.click(spara);
    fireEvent.click(spara);
    expect(onSpara).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Spara" })).toHaveAttribute("aria-busy", "true");
    await act(async () => { avvisa(new Error("Nätverket föll.")); });
    expect(await screen.findByRole("alert")).toHaveTextContent("Nätverket föll.");
    expect(screen.getByRole("textbox", { name: "Text" })).toHaveValue("Ändrad text.");
    expect(document.querySelector("[data-ops-dokument]")).toHaveAttribute("data-ops-dokument", "redigera");
    expect(screen.getByRole("button", { name: "Spara" })).not.toHaveAttribute("aria-busy");

    // Ett nytt försök som går igenom lämnar redigeringen.
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(onSpara).toHaveBeenCalledTimes(2);
    await act(async () => { los(); });
    await waitFor(() => expect(document.querySelector("[data-ops-dokument]")).toHaveAttribute("data-ops-dokument", "las"));
    expect(screen.queryByRole("alert")).toBeNull();
    unmount();

    // Ett kast direkt i onSpara är samma sak.
    const kastar = vi.fn(() => { throw new Error("Nekades av reglerna."); });
    render(<Harness onSparaOverride={kastar} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Redigera" }));
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Nekades av reglerna.");
    expect(document.querySelector("[data-ops-dokument]")).toHaveAttribute("data-ops-dokument", "redigera");
  });

  it("⛔ byt namn stänger dialogen först när sparandet gått igenom, och visar felet om det avvisas", async () => {
    /** @type {(v?: unknown) => void} */
    let los = () => {};
    /** @type {(e: Error) => void} */
    let avvisa = () => {};
    const onSpara = vi.fn(() => new Promise((resolve, reject) => {
      los = resolve;
      avvisa = reject;
    }));
    render(<Harness onSparaOverride={onSpara} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Byt namn" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nytt namn" }), { target: { value: "Årsprotokoll" } });
    const spara = screen.getByRole("button", { name: "Spara" });
    fireEvent.click(spara);
    fireEvent.click(spara);
    expect(onSpara).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => { avvisa(new Error("Nätverket föll.")); });
    expect(await screen.findByText("Nätverket föll.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nytt namn" })).toHaveValue("Årsprotokoll");

    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(onSpara).toHaveBeenCalledTimes(2);
    await act(async () => { los(); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("⛔ ett sparande som svarar false säger det, i formuläret och i Byt namn (0.93.0)", async () => {
    const { unmount } = render(<Harness onSparaOverride={() => false} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Byt namn" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nytt namn" }), { target: { value: "Årsprotokoll" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(screen.getByText("Namnet kunde inte sparas.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    unmount();

    const asynk = render(<Harness onSparaOverride={async () => false} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Byt namn" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nytt namn" }), { target: { value: "Årsprotokoll" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(await screen.findByText("Namnet kunde inte sparas.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    asynk.unmount();

    render(<Harness onSparaOverride={() => false} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Redigera" }));
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Posten kunde inte sparas.");
    expect(document.querySelector("[data-ops-dokument]")).toHaveAttribute("data-ops-dokument", "redigera");
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
