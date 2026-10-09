import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsAtgardsblad } from "../components/OpsAtgardsblad.jsx";
import { OpsDokument } from "../components/OpsDokument.jsx";
import { ANGRA_MS, OpsSvepRad } from "../components/OpsSvepRad.jsx";
import { LANGTRYCK_MS } from "../lib/apparark.js";

/**
 * Läsvy, svep och åtgärdsblad. jsdom mäter läge och anrop, inte pixlar.
 *
 * ⛔ BÅDA RIKTNINGARNA. Ett prov som bara ser den öppna menyn blir grönt
 * även när ett kort tryck också öppnar den.
 */

/**
 * @param {HTMLElement} element
 * @param {number} franX
 * @param {number} tillX
 * @param {number} [y]
 */
function peka(element, typ, clientX, clientY) {
  act(() => {
    element.dispatchEvent(new MouseEvent(typ, { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
  });
}

function svep(element, franX, tillX, franY = 24, tillY = franY) {
  peka(element, "pointerdown", franX, franY);
  peka(element, "pointermove", tillX, tillY);
  peka(element, "pointerup", tillX, tillY);
}

const poster = [
  { id: "oppna", etikett: "Öppna", onValj: () => {} },
  { id: "radera", etikett: "Radera", fara: true, onValj: () => {} },
];

describe("OpsSvepRad", () => {
  it("utan åtgärder är raden en vanlig li, och ett kort svep avslöjar ingenting", () => {
    const { unmount } = render(<ul><OpsSvepRad><span>Rad</span></OpsSvepRad></ul>);
    expect(screen.getByText("Rad")).toBeInTheDocument();
    expect(document.querySelector("[data-ops-svep]")).toBeNull();
    unmount();

    const onValj = vi.fn();
    render(
      <ul>
        <OpsSvepRad atgarder={[{ id: "radera", etikett: "Radera", fara: true, onValj }]}>
          <span>Posten</span>
        </OpsSvepRad>
      </ul>,
    );
    const rad = screen.getByRole("listitem");
    svep(rad, 240, 220);
    expect(rad).toHaveAttribute("data-ops-svep", "stangd");
    expect(screen.queryByRole("button", { name: "Radera" })).toBeNull();
    expect(onValj).not.toHaveBeenCalled();
    svep(rad, 240, 240, 24, 120);
    expect(rad).toHaveAttribute("data-ops-svep", "stangd");
  });

  it("ett långt svep avslöjar knappen, och trycket väntar på Ångra innan anropet", () => {
    vi.useFakeTimers();
    try {
      const onValj = vi.fn();
      const { unmount } = render(
        <ul>
          <OpsSvepRad atgarder={[{ id: "radera", etikett: "Radera", fara: true, angraMeddelande: "Posten tas bort.", onValj }]}>
            <button type="button">Posten</button>
          </OpsSvepRad>
        </ul>,
      );
      const rad = screen.getByRole("listitem");
      svep(rad, 240, 80);
      expect(rad).toHaveAttribute("data-ops-svep", "oppen");
      const radera = screen.getByRole("button", { name: "Radera" });
      fireEvent.click(screen.getByRole("button", { name: "Posten" }));
      expect(onValj).not.toHaveBeenCalled();
      peka(radera, "pointerdown", 8, 8);
      fireEvent.click(radera);
      expect(screen.getByText("Posten tas bort.")).toBeInTheDocument();
      expect(onValj).not.toHaveBeenCalled();
      unmount();
      act(() => { vi.advanceTimersByTime(ANGRA_MS); });
      expect(onValj).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Ångra stoppar anropet, och utan ångertext anropas åtgärden direkt", () => {
    vi.useFakeTimers();
    try {
      const onValj = vi.fn();
      const { unmount } = render(
        <ul>
          <OpsSvepRad atgarder={[{ id: "radera", etikett: "Radera", fara: true, angraMeddelande: "Posten tas bort.", onValj }]}>
            <span>Posten</span>
          </OpsSvepRad>
        </ul>,
      );
      svep(screen.getByRole("listitem"), 240, 80);
      const radera = screen.getByRole("button", { name: "Radera" });
      peka(radera, "pointerdown", 8, 8);
      fireEvent.click(radera);
      fireEvent.click(screen.getByRole("button", { name: "Ångra" }));
      act(() => { vi.advanceTimersByTime(ANGRA_MS); });
      expect(onValj).not.toHaveBeenCalled();
      unmount();

      const direkt = vi.fn();
      render(
        <ul>
          <OpsSvepRad atgarder={[{ id: "radera", etikett: "Radera", fara: true, onValj: direkt }]}>
            <span>Posten</span>
          </OpsSvepRad>
        </ul>,
      );
      svep(screen.getByRole("listitem"), 240, 80);
      const knapp = screen.getByRole("button", { name: "Radera" });
      peka(knapp, "pointerdown", 8, 8);
      fireEvent.click(knapp);
      expect(direkt).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "Ångra" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("en åtgärd utan onValj säger det, och anropar ingenting", () => {
    render(
      <ul>
        <OpsSvepRad atgarder={[{ id: "radera", etikett: "Radera", fara: true }]}>
          <span>Posten</span>
        </OpsSvepRad>
      </ul>,
    );
    svep(screen.getByRole("listitem"), 240, 80);
    const radera = screen.getByRole("button", { name: "Radera" });
    peka(radera, "pointerdown", 8, 8);
    fireEvent.click(radera);
    expect(screen.getByRole("alert")).toHaveTextContent("Åtgärden är inte kopplad. Ingenting ändrades.");
  });
});

describe("OpsAtgardsblad", () => {
  it("ett kort tryck öppnar inte menyn, ett långt tryck gör det och sväljer klicket", () => {
    vi.useFakeTimers();
    try {
      const onKlick = vi.fn();
      const { unmount } = render(
        <OpsAtgardsblad namn="Filen" poster={poster}>
          <button type="button" onClick={onKlick}>Filen</button>
        </OpsAtgardsblad>,
      );
      const rad = screen.getByRole("button", { name: "Filen" }).closest("[data-ops-atgard]");
      expect(rad).not.toBeNull();
      peka(/** @type {HTMLElement} */ (rad), "pointerdown", 10, 10);
      act(() => { vi.advanceTimersByTime(LANGTRYCK_MS - 1); });
      expect(screen.queryByRole("menu")).toBeNull();
      peka(/** @type {HTMLElement} */ (rad), "pointerup", 10, 10);
      fireEvent.click(screen.getByRole("button", { name: "Filen" }));
      expect(onKlick).toHaveBeenCalledTimes(1);
      vi.clearAllTimers();
      unmount();

      const onKlick2 = vi.fn();
      render(
        <OpsAtgardsblad namn="Filen" poster={poster}>
          <button type="button" onClick={onKlick2}>Filen</button>
        </OpsAtgardsblad>,
      );
      const rad2 = screen.getByRole("button", { name: "Filen" }).closest("[data-ops-atgard]");
      peka(/** @type {HTMLElement} */ (rad2), "pointerdown", 10, 10);
      act(() => { vi.advanceTimersByTime(LANGTRYCK_MS); });
      expect(screen.getByRole("menu", { name: "Filen" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Filen" }));
      expect(onKlick2).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("en rörelse avbryter långtrycket, högerklick och ⋮ öppnar samma poster", () => {
    vi.useFakeTimers();
    try {
      const { unmount } = render(
        <OpsAtgardsblad namn="Filen" poster={poster}>
          <button type="button">Filen</button>
        </OpsAtgardsblad>,
      );
      const rad = screen.getByRole("button", { name: "Filen" }).closest("[data-ops-atgard]");
      peka(/** @type {HTMLElement} */ (rad), "pointerdown", 10, 10);
      peka(/** @type {HTMLElement} */ (rad), "pointermove", 40, 10);
      act(() => { vi.advanceTimersByTime(LANGTRYCK_MS); });
      expect(screen.queryByRole("menu")).toBeNull();
      vi.clearAllTimers();
      unmount();
    } finally {
      vi.useRealTimers();
    }

    const onOppna = vi.fn();
    const rader = [
      { id: "oppna", etikett: "Öppna", onValj: onOppna },
      { id: "radera", etikett: "Radera", fara: true, onValj: () => {} },
    ];
    const { unmount } = render(
      <OpsAtgardsblad namn="Filen" poster={rader}>
        <button type="button">Filen</button>
      </OpsAtgardsblad>,
    );
    const yta = screen.getByRole("button", { name: "Filen" }).closest("[data-ops-atgard]");
    fireEvent.contextMenu(/** @type {HTMLElement} */ (yta));
    const meny = screen.getByRole("menu", { name: "Filen" });
    expect(withinMeny(meny, "Radera").className).toContain("text-danger");
    fireEvent.click(screen.getByRole("menuitem", { name: "Öppna" }));
    expect(onOppna).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    unmount();

    render(
      <OpsAtgardsblad namn="Filen" poster={rader}>
        <button type="button">Filen</button>
      </OpsAtgardsblad>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Filen" }));
    expect(screen.getByRole("menuitem", { name: "Öppna" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Radera" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("tom poster ritar barnen utan knapp, baraKnapp ritar inget, och namn krävs", () => {
    const { unmount } = render(<OpsAtgardsblad namn="Filen" poster={[]}><span>Barn</span></OpsAtgardsblad>);
    expect(screen.getByText("Barn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Åtgärder för Filen" })).toBeNull();
    unmount();

    const tom = render(<OpsAtgardsblad namn="Filen" poster={[]} baraKnapp />);
    expect(tom.container).toBeEmptyDOMElement();
    tom.unmount();

    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<OpsAtgardsblad namn="" poster={poster} />)).toThrow(/namn krävs/);
    } finally {
      tyst.mockRestore();
    }
  });

  it("under 768 px är ytan ett ark med Stäng, inte bara menyn", () => {
    const stad = medBredd(true);
    try {
      render(
        <OpsAtgardsblad namn="Filen" poster={poster}>
          <button type="button">Filen</button>
        </OpsAtgardsblad>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Filen" }));
      expect(screen.getByRole("button", { name: "Stäng" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Öppna" })).toBeInTheDocument();
    } finally {
      stad();
    }
  });
});

describe("OpsDokument", () => {
  it("öppning är läsning, och utan rätt att redigera finns varken penna eller Radera", () => {
    const { unmount } = render(
      <OpsDokument rubrik="Protokoll" lasning={<p>Texten</p>} redigering={<input aria-label="Text" />} kanRedigera={false} />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Protokoll");
    expect(screen.getByText("Texten")).toBeInTheDocument();
    expect(document.querySelector("[data-ops-dokument]")).toHaveAttribute("data-ops-dokument", "las");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Redigera" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Radera" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    unmount();

    const onAvbryt = vi.fn();
    render(
      <OpsDokument
        rubrik="Protokoll"
        lasning={<p>Texten</p>}
        redigering={<input aria-label="Text" defaultValue="Utkast" />}
        kanRedigera
        onAvbryt={onAvbryt}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Redigera" }));
    expect(screen.getByRole("textbox", { name: "Text" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Radera" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(onAvbryt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Texten")).toBeInTheDocument();
  });

  it("ett nytt dokument börjar i redigering, och Avbryt stänger inte läget själv", () => {
    const onAvbryt = vi.fn();
    render(
      <OpsDokument ny rubrik="Ny anteckning" lasning={<p>Tom</p>} redigering={<input aria-label="Text" />} onAvbryt={onAvbryt} />,
    );
    expect(document.querySelector("[data-ops-dokument]")).toHaveAttribute("data-ops-dokument", "redigera");
    expect(screen.queryByText("Tom")).toBeNull();
    expect(screen.queryByRole("button", { name: "Redigera" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(onAvbryt).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-ops-dokument]")).toHaveAttribute("data-ops-dokument", "redigera");
  });

  it("Spara som ger false står kvar i redigering, och ett lyckat sparande går till läsning", () => {
    const nekad = vi.fn(() => false);
    const { unmount } = render(
      <OpsDokument rubrik="Protokoll" lasning={<p>Texten</p>} redigering={<input aria-label="Text" />} kanRedigera onSpara={nekad} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Redigera" }));
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(nekad).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-ops-dokument]")).toHaveAttribute("data-ops-dokument", "redigera");
    unmount();

    const ok = vi.fn();
    render(
      <OpsDokument rubrik="Protokoll" lasning={<p>Texten</p>} redigering={<input aria-label="Text" />} kanRedigera onSpara={ok} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Redigera" }));
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(ok).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-ops-dokument]")).toHaveAttribute("data-ops-dokument", "las");
    expect(screen.getByText("Texten")).toBeInTheDocument();
  });
});

/**
 * @param {HTMLElement} meny
 * @param {string} namn
 */
function withinMeny(meny, namn) {
  const rad = [...meny.querySelectorAll("[role='menuitem']")].find((n) => n.textContent === namn);
  if (!(rad instanceof HTMLElement)) throw new Error(`menyrad saknas: ${namn}`);
  const spann = rad.querySelector("span.min-w-0");
  if (!(spann instanceof HTMLElement)) throw new Error(`etikett saknas: ${namn}`);
  return spann;
}

/**
 * @param {boolean} smal
 */
function medBredd(smal) {
  const lyssnare = new Set();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => ({
      media: "(max-width: 767px)",
      matches: smal,
      addEventListener: (_typ, fn) => lyssnare.add(fn),
      removeEventListener: (_typ, fn) => lyssnare.delete(fn),
      dispatchEvent: () => false,
    }),
  });
  return () => {
    // @ts-expect-error vi tar bort den vi själva satte
    delete window.matchMedia;
  };
}
