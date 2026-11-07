import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsDelad } from "../components/OpsDelad.jsx";
import { OpsDeladHandelse } from "../components/OpsDeladHandelse.jsx";
import { OpsDeladSida } from "../components/OpsDeladSida.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { DELAD_SPRAKNYCKEL } from "../lib/deladdatum.js";

/*
 * 0.201.0: en delad länk ger samma upplevelse som gästinbjudan (cllp/ops-framework#544).
 *
 * CP 2026-11-07: "all delning nu, om man bara delar filer eller andra delningar. Se till att allt är enhetligt med gästinbjudan så att det är samma upplevelse för användaren."
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4): med 0.200.1 finns inte `OpsDeladSida` (sviten faller vid importen); filens sida var bara på svenska och utan huvud, händelsens huvud
 * saknade ljust och mörkt, och en länk på händelsen fick bara Skicka till mejl direkt efter att den skapats.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(() => Promise.resolve()) }, configurable: true });
});
afterEach(() => {
  vi.restoreAllMocks();
});

const huvudVal = (namn) => /** @type {HTMLElement} */ (document.querySelector(`header [data-${namn}-huvud-val]`));

describe("ett huvud på alla publika sidor: märket, språket och ljust eller mörkt", () => {
  it("⛔ filens sida har samma huvud som gästens: språkväljaren och temaknappen", () => {
    render(<OpsDeladSida huvud={<span>LifeHub</span>}><OpsDelad laddar /></OpsDeladSida>);
    const val = huvudVal("delad");
    expect(val).not.toBeNull();
    expect(within(val).getByRole("group", { name: "Språk" })).toBeInTheDocument();
    expect(within(val).getByRole("button", { name: /^Utseende/ })).toBeInTheDocument();
    expect(screen.getByText("LifeHub")).toBeInTheDocument();
  });

  it("⛔ händelsens sida har också temaknappen (förut bara språket)", () => {
    render(<OpsDeladHandelse laddar />);
    const val = huvudVal("dh");
    expect(within(val).getByRole("group", { name: "Språk" })).toBeInTheDocument();
    expect(within(val).getByRole("button", { name: /^Utseende/ })).toBeInTheDocument();
  });
});

describe("språket på filens sida, i gästens ordning", () => {
  it("⛔ webbläsarens språk utan något annat: en engelsk webbläsare får engelska, också i innehållet", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-GB");
    render(<OpsDeladSida><OpsDelad orsak="stangd" /></OpsDeladSida>);
    expect(document.querySelector("[data-deladsida]")).toHaveAttribute("data-sprak", "en");
    expect(screen.getByText("The link no longer works")).toBeInTheDocument();
    expect(screen.getByText("The person who shared it has withdrawn it. Ask the person who shared it for a new link.")).toBeInTheDocument();
  });

  it("⛔ länkens språk går före webbläsarens, och besökarens eget val går före båda", () => {
    const { unmount } = render(<OpsDeladSida lankSprak="en"><OpsDelad laddar /></OpsDeladSida>);
    expect(document.querySelector("[data-deladsida]")).toHaveAttribute("data-sprak", "en");
    expect(screen.getByText("Loading")).toBeInTheDocument();
    unmount();
    window.localStorage.setItem(DELAD_SPRAKNYCKEL, "sv");
    render(<OpsDeladSida lankSprak="en"><OpsDelad laddar /></OpsDeladSida>);
    expect(document.querySelector("[data-deladsida]")).toHaveAttribute("data-sprak", "sv");
    expect(screen.getByText("Hämtar")).toBeInTheDocument();
  });

  it("⛔ händelsens sida tar också länkens språk", () => {
    render(<OpsDeladHandelse laddar lankSprak="en" />);
    expect(document.querySelector("[data-deladhandelse]")).toHaveAttribute("data-sprak", "en");
  });

  it("besökaren byter språk i huvudet, och innehållet följer", async () => {
    render(<OpsDeladSida><OpsDelad delning={{ typ: "anteckning", rubrik: "Turnéplan", text: "" }} /></OpsDeladSida>);
    expect(screen.getByText("Anteckning")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(huvudVal("delad")).getByRole("button", { name: "EN" }));
    });
    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText("The note has no text.")).toBeInTheDocument();
  });

  it("en delad länk och en lista på engelska", () => {
    render(
      <OpsDeladSida sprak="en">
        <OpsDelad delning={{ typ: "lank", rubrik: "Spellista", url: "https://example.com/a" }} />
      </OpsDeladSida>,
    );
    expect(screen.getByRole("link", { name: "Open the link Spellista" })).toBeInTheDocument();
  });
});

describe("Skicka till mejl på varje länk på händelsen, som gästens Skicka igen", () => {
  it("⛔ varje länk i listan har sitt eget fält, och det skickar just den länken", async () => {
    const onMejlaLank = vi.fn(async () => true);
    const lank = (id) => ({ id, url: `https://my.test/g/travel/event/resa-${id}`, rattighet: "las", harKod: false, giltigTill: Date.UTC(2026, 11, 1) });
    const { container } = render(
      <OpsHandelsePanel handelse={{ id: "h1", titel: "Resa", datum: "2026-12-26", grupp: "Travel" }} onTillbaka={() => {}} delningar={[lank("a1"), lank("b2")]} onDela={vi.fn()} onAterkalla={vi.fn(async () => {})} onMejlaLank={onMejlaLank} />,
    );
    const rader = [...container.querySelectorAll("[data-lankrad]")];
    expect(rader).toHaveLength(2);
    for (const rad of rader) expect(within(/** @type {HTMLElement} */ (rad)).getByRole("button", { name: "Skicka" })).toBeInTheDocument();
    const andra = /** @type {HTMLElement} */ (rader[1]);
    fireEvent.change(within(andra).getByRole("textbox"), { target: { value: "kusin@exempel.se" } });
    await act(async () => {
      fireEvent.click(within(andra).getByRole("button", { name: "Skicka" }));
    });
    expect(onMejlaLank).toHaveBeenCalledWith(expect.objectContaining({ id: "b2", url: "https://my.test/g/travel/event/resa-b2", till: "kusin@exempel.se" }));
  });
});

describe("den delade händelsen säger hur man svarar (0.202.0, lifehub.app#687 punkt 18)", () => {
  it("raden står på svenska och på engelska", async () => {
    const { OpsDeladHandelse } = await import("../components/OpsDeladHandelse.jsx");
    const delning = { titel: "Fest", datum: "2026-12-24", filer: [], ejVisade: 0 };
    for (const [sprak, text] of /** @type {const} */ ([["sv", "Vill du svara? Be den som delade länken att bjuda in dig."], ["en", "Want to answer? Ask the person who shared the link to invite you."]])) {
      const { container, unmount } = render(<OpsDeladHandelse delning={/** @type {any} */ (delning)} sprak={sprak} onSprak={() => {}} />);
      expect(container.querySelector("[data-dh-hur-svara]")?.textContent).toBe(text);
      unmount();
    }
  });
});

describe("sista raden om appen på de delade sidorna (0.202.0, lifehub.app#687 punkt 16)", () => {
  const omAppen = { href: "https://life-hub.app", namn: "LifeHub" };
  it("står på den delade händelsen och posten, utan gruppens namn, och länken öppnas i en ny flik", () => {
    const delning = { titel: "Fest", datum: "2026-12-24", filer: [], ejVisade: 0 };
    const { container, unmount } = render(<OpsDeladHandelse delning={/** @type {any} */ (delning)} sprak="sv" onSprak={() => {}} omAppen={omAppen} />);
    const rad = container.querySelector("[data-delad-om-appen]");
    expect(rad?.textContent).toBe("Delat från LifeHub, där grupper samlar chatt, kalender och filer. Läs mer");
    expect(rad?.querySelector("a")?.getAttribute("target")).toBe("_blank");
    unmount();
    const { container: c2 } = render(<OpsDeladSida sprak="en" onSprak={() => {}} omAppen={omAppen}>innehåll</OpsDeladSida>);
    expect(c2.querySelector("[data-delad-om-appen]")?.textContent).toBe("Shared from LifeHub, where groups keep chat, calendar and files together. Read more");
  });
  it("en adress som inte är https kastar", () => {
    expect(() => render(<OpsDeladSida sprak="sv" onSprak={() => {}} omAppen={{ href: "javascript:alert(1)", namn: "X" }}>x</OpsDeladSida>)).toThrow(/https/);
  });
});
