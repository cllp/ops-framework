import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Meddelanderader, texterPa } from "../components/OpsMeddelanden.jsx";
import { OpsGastChatt } from "../components/OpsGastChatt.jsx";

/**
 * Kopiera och Kopiera länk i chattens meddelandemeny på dator (cllp/lifehub.app#712). QA 2026-11-09: som medlem visade hovringen bara Fäst, Reagera och Svara i tråd,
 * och som gäst fanns ingen meny alls. Kopiera fanns bara i telefonens meny. "Kopiera länk" ritas bara när appen skickar in `meddelandeHref`, eftersom ramverket aldrig känner appens rutter.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4), utfallen står i commit-meddelandet.
 */

const T = Date.UTC(2026, 10, 9, 9, 0);
const RADER = [
  { id: "m1", av: "bo", text: "Hej gruppen", tid: T },
  { id: "m2", av: "anna", text: "Mitt eget", tid: T + 60000 },
];
const namnFor = (/** @type {string} */ id) => (id === "bo" ? "Bo Lind" : "Anna Ek");

/** Dator med mus: bredden är känd och bred, pekaren är inte ett finger. */
function stubDator() {
  vi.stubGlobal("matchMedia", (/** @type {string} */ q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
}

const ursprung = Object.getOwnPropertyDescriptor(navigator, "clipboard");
beforeEach(() => {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
  stubDator();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (ursprung) Object.defineProperty(navigator, "clipboard", ursprung);
  else delete (/** @type {any} */ (navigator)).clipboard;
});

/** @param {Record<string, any>} [extra] */
const rita = (extra = {}) => render(<Meddelanderader meddelanden={/** @type {any} */ (RADER)} uid="anna" namnFor={namnFor} medlemmar={[]} locale="sv-SE" visaNamn sid="s1" {...extra} />);

async function oppnaMeny(/** @type {string} */ text) {
  const rad = /** @type {HTMLElement} */ (screen.getByText(text, { selector: "[data-bubbla] *" }).closest("[data-meddelande]"));
  // ⛔ På dator ritas ⋮ bara på meddelandet pekaren står på (taket på element per meddelande, regel 13).
  fireEvent.mouseEnter(rad);
  fireEvent.click(within(rad).getByRole("button", { name: /Åtgärder för/ }));
  return screen.findByRole("menu");
}
const poster = (/** @type {HTMLElement} */ meny) => within(meny).getAllByRole("menuitem").map((e) => (e.textContent ?? "").trim());

describe("Kopiera i menyn på dator", () => {
  it("⛔ ett meddelande har en ⋮ med bara Kopiera: det som redan är knappar vid hovring dubbleras inte", async () => {
    rita();
    const meny = await oppnaMeny("Hej gruppen");
    expect(poster(meny)).toEqual(["Kopiera"]);
    expect(document.querySelector("[data-mer-reaktioner]")).toBeNull();
  });

  it("⛔ Kopiera skriver texten till urklipp inne i klicket och säger det", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    rita();
    await oppnaMeny("Hej gruppen");
    fireEvent.click(screen.getByRole("menuitem", { name: "Kopiera" }));
    expect(writeText).toHaveBeenCalledWith("Hej gruppen");
    await waitFor(() => expect(document.querySelector("[data-kopierat='ok']")?.textContent).toBe("Kopierat"));
  });

  it("⛔ ett nekat urklipp, och ett som saknas, sägs: aldrig tyst", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("nekad")) } });
    const { unmount } = rita();
    await oppnaMeny("Hej gruppen");
    fireEvent.click(screen.getByRole("menuitem", { name: "Kopiera" }));
    await waitFor(() => expect(document.querySelector("[data-kopierat='fel']")?.textContent).toBe("Texten kunde inte kopieras."));
    unmount();
    delete (/** @type {any} */ (navigator)).clipboard;
    rita();
    await oppnaMeny("Hej gruppen");
    fireEvent.click(screen.getByRole("menuitem", { name: "Kopiera" }));
    await waitFor(() => expect(document.querySelector("[data-kopierat='fel']")).not.toBeNull());
  });
});

describe("Kopiera länk: bara när appen bygger länken", () => {
  it("⛔ utan meddelandeHref finns ingen Kopiera länk, och en funktion som ger null tar bort raden", async () => {
    const { unmount } = rita();
    expect(poster(await oppnaMeny("Hej gruppen"))).toEqual(["Kopiera"]);
    unmount();
    rita({ meddelandeHref: () => null });
    expect(poster(await oppnaMeny("Hej gruppen"))).toEqual(["Kopiera"]);
  });

  it("⛔ med meddelandeHref: appen får meddelandets id och samtalets, och adressen kopieras absolut med kvittot Länken är kopierad", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const href = vi.fn((/** @type {any} */ a) => `/chatt/${a.samtalId}?m=${a.meddelandeId}`);
    rita({ meddelandeHref: href });
    expect(poster(await oppnaMeny("Hej gruppen"))).toEqual(["Kopiera", "Kopiera länk"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Kopiera länk" }));
    expect(href).toHaveBeenCalledWith({ meddelandeId: "m1", samtalId: "s1" });
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/chatt/s1?m=m1`);
    await waitFor(() => expect(document.querySelector("[data-kopierat='lank']")?.textContent).toBe("Länken är kopierad"));
  });

  it("⛔ en länk som inte går att kopiera sägs som ett fel, och en tråd ger tradId", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("nekad")) } });
    const href = vi.fn(() => "https://app.example/m/1");
    rita({ meddelandeHref: href, trad: "t9" });
    await oppnaMeny("Mitt eget");
    fireEvent.click(screen.getByRole("menuitem", { name: "Kopiera länk" }));
    expect(href).toHaveBeenCalledWith({ meddelandeId: "m2", samtalId: "s1", tradId: "t9" });
    await waitFor(() => expect(document.querySelector("[data-kopierat='lankfel']")?.textContent).toBe("Länken kunde inte kopieras."));
  });

  it("⛔ engelska: Copy och Copy link", async () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-GB");
    rita({ texter: texterPa("en", {}), meddelandeHref: () => "/x", locale: "en-GB" });
    expect(poster(await oppnaMeny("Hej gruppen"))).toEqual(["Copy", "Copy link"]);
  });
});

describe("gästens chatt", () => {
  const MEDD = [{ id: "g1", av: { namn: "Agda Ägare" }, text: "Välkommen", tid: T }];
  it("⛔ gästen har en meny med Kopiera på dator, och Kopiera länk när appen skickar in meddelandeHref (utan samtalId)", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const href = vi.fn((/** @type {any} */ a) => `/gast/chatt?m=${a.meddelandeId}`);
    render(<OpsGastChatt meddelanden={MEDD} meddelandeHref={href} />);
    const meny = await oppnaMeny("Välkommen");
    expect(poster(meny)).toEqual(["Kopiera", "Kopiera länk"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Kopiera" }));
    expect(writeText).toHaveBeenCalledWith("Välkommen");
    expect(href).toHaveBeenCalledWith({ meddelandeId: "g1" });
    await waitFor(() => expect(document.querySelector("[data-kopierat='ok']")).not.toBeNull());
  });

  it("⛔ utan meddelandeHref har gästen bara Kopiera", async () => {
    render(<OpsGastChatt meddelanden={MEDD} />);
    expect(poster(await oppnaMeny("Välkommen"))).toEqual(["Kopiera"]);
  });
});

describe("⋮ bara på meddelandet pekaren eller fokuset står på (regel 13, taket på element per meddelande)", () => {
  it("⛔ utan pekare finns ingen ⋮ i DOM:en, med pekaren på ett meddelande finns den bara där, och fokus ger den också", async () => {
    rita();
    expect(document.querySelectorAll("[data-mer-kopior]").length).toBe(0);
    const rader = /** @type {HTMLElement[]} */ ([...document.querySelectorAll("[data-meddelande]")]);
    expect(rader.length).toBe(2);
    fireEvent.mouseEnter(rader[0]);
    expect(rader[0].querySelectorAll("[data-mer-kopior]").length).toBe(1);
    expect(rader[1].querySelectorAll("[data-mer-kopior]").length).toBe(0);
    fireEvent.mouseLeave(rader[0]);
    expect(document.querySelectorAll("[data-mer-kopior]").length).toBe(0);
    // Fokus bubblar upp från meddelandets knappar (Reagera, Svara i tråd); här finns inga, så fokus går till raden själv.
    fireEvent.focus(rader[1]);
    expect(rader[1].querySelectorAll("[data-mer-kopior]").length).toBe(1);
  });
});
