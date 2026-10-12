import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("ett svep som börjar på ett reglage (ljudvågen) drar inte upp raden, men samma svep på resten av raden gör det", () => {
    const rendera = () => render(
      <ul>
        <OpsSvepRad atgarder={[{ id: "radera", etikett: "Radera", fara: true, onValj: () => {} }]}>
          <div>
            <input type="range" aria-label="Spola" min={0} max={100} defaultValue={10} />
            <span>Titel</span>
          </div>
        </OpsSvepRad>
      </ul>,
    );
    const { unmount } = rendera();
    svep(screen.getByRole("slider", { name: "Spola" }), 240, 80);
    expect(screen.getByRole("listitem")).toHaveAttribute("data-ops-svep", "stangd");
    unmount();

    rendera();
    svep(screen.getByText("Titel"), 240, 80);
    expect(screen.getByRole("listitem")).toHaveAttribute("data-ops-svep", "oppen");
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
      expect(onValj).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("avmonteras raden under Ångra-fönstret går raderingen igenom, en gång, och efter Ångra gör den det inte", () => {
    vi.useFakeTimers();
    try {
      const onValj = vi.fn();
      const atgard = { id: "radera", etikett: "Radera", fara: true, angraMeddelande: "Posten tas bort.", onValj };
      const bygg = () => render(
        <ul>
          <OpsSvepRad atgarder={[atgard]}><span>Posten</span></OpsSvepRad>
        </ul>,
      );
      const starta = () => {
        svep(screen.getByRole("listitem"), 240, 80);
        const radera = screen.getByRole("button", { name: "Radera" });
        peka(radera, "pointerdown", 8, 8);
        fireEvent.click(radera);
      };

      const forst = bygg();
      starta();
      expect(onValj).not.toHaveBeenCalled();
      forst.unmount();
      expect(onValj).toHaveBeenCalledTimes(1);
      act(() => { vi.advanceTimersByTime(ANGRA_MS * 2); });
      expect(onValj).toHaveBeenCalledTimes(1);

      onValj.mockClear();
      const andra = bygg();
      starta();
      fireEvent.click(screen.getByRole("button", { name: "Ångra" }));
      andra.unmount();
      act(() => { vi.advanceTimersByTime(ANGRA_MS * 2); });
      expect(onValj).not.toHaveBeenCalled();

      // En rad som aldrig fick ett Radera-tryck anropar inget när den avmonteras.
      const tredje = bygg();
      tredje.unmount();
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
    const rubrik = screen.getByRole("heading", { level: 1 });
    expect(rubrik).toHaveTextContent("Protokoll");
    expect(rubrik.className).toContain("text-rubrik");
    expect(rubrik.className).not.toContain("text-sida");
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
    const verktyg = document.querySelector("[data-ops-dokument-verktyg]");
    expect(verktyg).not.toBeNull();
    expect(verktyg?.contains(screen.getByRole("button", { name: "Redigera" }))).toBe(true);
    expect(verktyg?.contains(screen.getByRole("heading", { level: 1 }))).toBe(false);
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

describe("OpsDokument: ett sparande som faller (0.93.0)", () => {
  const rendera = (/** @type {() => any} */ onSpara) => render(
    <OpsDokument rubrik="Protokoll" lasning={<p>Texten</p>} redigering={<input aria-label="Text" />} kanRedigera onSpara={onSpara} />,
  );

  it("ett avvisat löfte visas och läget står kvar, ett kast likaså, och inget sväljs", async () => {
    const avvisat = vi.fn(() => Promise.reject(new Error("Sparandet nekades.")));
    const { unmount } = rendera(avvisat);
    fireEvent.click(screen.getByRole("button", { name: "Redigera" }));
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sparandet nekades.");
    expect(document.querySelector("[data-ops-dokument]")).toHaveAttribute("data-ops-dokument", "redigera");
    unmount();

    const kastar = vi.fn(() => { throw new Error("Kastade direkt."); });
    rendera(kastar);
    fireEvent.click(screen.getByRole("button", { name: "Redigera" }));
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Kastade direkt.");
    expect(document.querySelector("[data-ops-dokument]")).toHaveAttribute("data-ops-dokument", "redigera");
  });

  it("ett andra tryck medan det första pågår sparar inte igen, och felet försvinner vid nästa försök", async () => {
    /** @type {Array<{ ok: () => void, nej: (e: Error) => void }>} */
    const anrop = [];
    const onSpara = vi.fn(() => new Promise((resolve, reject) => { anrop.push({ ok: () => resolve(undefined), nej: reject }); }));
    rendera(onSpara);
    fireEvent.click(screen.getByRole("button", { name: "Redigera" }));
    const spara = screen.getByRole("button", { name: "Spara" });
    fireEvent.click(spara);
    fireEvent.click(spara);
    expect(onSpara).toHaveBeenCalledTimes(1);
    expect(spara).toHaveAttribute("aria-busy", "true");
    await act(async () => { anrop[0].nej(new Error("Föll.")); });
    expect(screen.getByRole("alert")).toHaveTextContent("Föll.");
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(onSpara).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => { anrop[1].ok(); });
    await waitFor(() => expect(document.querySelector("[data-ops-dokument]")).toHaveAttribute("data-ops-dokument", "las"));
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
