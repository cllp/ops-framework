import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsDatePicker } from "../components/OpsDatePicker.jsx";
import { OpsSvepRad } from "../components/OpsSvepRad.jsx";
import { arSvep, useSidsvep } from "../components/useSidsvep.js";

/**
 * Det vågräta svepet (`useSidsvep`) och datumväljarens bruk av det.
 *
 * ⛔ BÅDA RIKTNINGARNA. Varje "räknas inte"-prov har ett "räknas"-syskon med samma rörelse men ett steg längre / rakare / på ett
 * annat element, så att ett prov som aldrig kan utlösa något inte står grönt (arbetsregler 4, tautologi).
 * jsdom saknar PointerEvent: händelserna är MouseEvent med pekarnamn, och `pointerType` sätts för hand.
 */

/**
 * @param {Element} el @param {string} typ @param {number} x @param {number} y
 * @param {{ pointerType?: string, pointerId?: number }} [extra]
 */
function peka(el, typ, x, y, extra = {}) {
  const ev = new MouseEvent(typ, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(ev, "pointerType", { value: extra.pointerType ?? "touch" });
  Object.defineProperty(ev, "pointerId", { value: extra.pointerId ?? 1 });
  act(() => {
    el.dispatchEvent(ev);
  });
}

/** Ett svep med ett finger: ned, flytta, upp. @param {Element} el @param {number} fran @param {number} till @param {number} [y] @param {number} [tillY] */
function svep(el, fran, till, y = 100, tillY = y) {
  peka(el, "pointerdown", fran, y);
  peka(el, "pointermove", (fran + till) / 2, (y + tillY) / 2);
  peka(el, "pointerup", till, tillY);
}

/** @param {Partial<Parameters<typeof useSidsvep>[0]>} [val] */
function Yta(val = {}) {
  const svepProps = useSidsvep({ onForra: val.onForra, onNasta: val.onNasta, ...(val.minX ? { minX: val.minX } : {}), ...(val.inaktiv ? { inaktiv: true } : {}) });
  return (
    <div data-testid="yta" {...svepProps}>
      <button data-testid="rad" onClick={val.onKlick}>Rad</button>
      <input data-testid="falt" aria-label="Fält" />
      <div data-ingen-sidsvep="" data-testid="undantag"><span data-testid="inne">inne</span></div>
      <ul><OpsSvepRad atgarder={[{ id: "a", etikett: "Radera", fara: true, onValj: () => {} }]}><span data-testid="svepbar">Svepbar</span></OpsSvepRad></ul>
    </div>
  );
}

describe("arSvep: vad som räknas som vågrätt", () => {
  it("kräver minst 48 px i sidled OCH mer än dubbelt så mycket som i höjdled", () => {
    expect(arSvep(-60, 5)).toBe(true);
    expect(arSvep(60, -5)).toBe(true);
    expect(arSvep(-47, 0)).toBe(false);
    expect(arSvep(-48, 0)).toBe(true);
    expect(arSvep(-60, 31)).toBe(false);
    expect(arSvep(-60, 30)).toBe(false);
    expect(arSvep(-60, 29)).toBe(true);
    expect(arSvep(0, 120)).toBe(false);
  });
});

describe("useSidsvep", () => {
  it("fingret åt vänster anropar onNasta, åt höger onForra, och inte tvärtom", () => {
    const onForra = vi.fn();
    const onNasta = vi.fn();
    render(<Yta onForra={onForra} onNasta={onNasta} />);
    svep(screen.getByTestId("yta"), 200, 100);
    expect(onNasta).toHaveBeenCalledTimes(1);
    expect(onForra).not.toHaveBeenCalled();
    svep(screen.getByTestId("yta"), 100, 200);
    expect(onForra).toHaveBeenCalledTimes(1);
    expect(onNasta).toHaveBeenCalledTimes(1);
  });

  it("en rörelse i höjdled utlöser ingenting (lodrät rullning), men samma sträcka i sidled gör det", () => {
    const onForra = vi.fn();
    const onNasta = vi.fn();
    render(<Yta onForra={onForra} onNasta={onNasta} />);
    svep(screen.getByTestId("yta"), 100, 105, 100, 260);
    expect(onForra).not.toHaveBeenCalled();
    expect(onNasta).not.toHaveBeenCalled();
    // En snedrörelse som är mer vågrät än lodrät men inte dubbelt så mycket räknas inte heller.
    svep(screen.getByTestId("yta"), 200, 120, 100, 160);
    expect(onNasta).not.toHaveBeenCalled();
    svep(screen.getByTestId("yta"), 200, 100, 100, 110);
    expect(onNasta).toHaveBeenCalledTimes(1);
  });

  it("en kort rörelse utlöser ingenting, och `minX` flyttar gränsen", () => {
    const onNasta = vi.fn();
    const { rerender } = render(<Yta onNasta={onNasta} />);
    svep(screen.getByTestId("yta"), 100, 60);
    expect(onNasta).not.toHaveBeenCalled();
    rerender(<Yta onNasta={onNasta} minX={30} />);
    svep(screen.getByTestId("yta"), 100, 60);
    expect(onNasta).toHaveBeenCalledTimes(1);
  });

  it("saknas mottagaren för en riktning händer ingenting åt det hållet", () => {
    const onNasta = vi.fn();
    render(<Yta onNasta={onNasta} />);
    expect(() => svep(screen.getByTestId("yta"), 100, 200)).not.toThrow();
    expect(onNasta).not.toHaveBeenCalled();
  });

  it("ett svep som börjar i ett undantaget element räknas inte, ett som börjar bredvid gör det", () => {
    const onNasta = vi.fn();
    render(<Yta onNasta={onNasta} />);
    for (const id of ["falt", "undantag", "inne", "svepbar"]) {
      svep(screen.getByTestId(id), 200, 100);
    }
    expect(onNasta).not.toHaveBeenCalled();
    svep(screen.getByTestId("rad"), 200, 100);
    expect(onNasta).toHaveBeenCalledTimes(1);
  });

  it("ett element som själv rullar i sidled äger gesten", () => {
    const onNasta = vi.fn();
    render(<Yta onNasta={onNasta} />);
    const rad = screen.getByTestId("rad");
    // jsdom mäter ingen layout: rullbarheten läggs på för hand.
    Object.defineProperty(rad, "scrollWidth", { value: 500, configurable: true });
    Object.defineProperty(rad, "clientWidth", { value: 100, configurable: true });
    rad.style.overflowX = "auto";
    svep(rad, 200, 100);
    expect(onNasta).not.toHaveBeenCalled();
    rad.style.overflowX = "visible";
    svep(rad, 200, 100);
    expect(onNasta).toHaveBeenCalledTimes(1);
  });

  it("en mus räknas inte, ett finger och en penna gör det", () => {
    const onNasta = vi.fn();
    render(<Yta onNasta={onNasta} />);
    const yta = screen.getByTestId("yta");
    for (const typ of ["pointerdown", "pointerup"]) peka(yta, typ, typ === "pointerdown" ? 200 : 100, 100, { pointerType: "mouse" });
    expect(onNasta).not.toHaveBeenCalled();
    for (const typ of ["pointerdown", "pointerup"]) peka(yta, typ, typ === "pointerdown" ? 200 : 100, 100, { pointerType: "pen" });
    expect(onNasta).toHaveBeenCalledTimes(1);
  });

  it("ett andra finger avbryter gesten, och pointercancel också", () => {
    const onNasta = vi.fn();
    render(<Yta onNasta={onNasta} />);
    const yta = screen.getByTestId("yta");
    peka(yta, "pointerdown", 200, 100, { pointerId: 1 });
    peka(yta, "pointerdown", 220, 100, { pointerId: 2 });
    peka(yta, "pointerup", 100, 100, { pointerId: 1 });
    expect(onNasta).not.toHaveBeenCalled();
    peka(yta, "pointerdown", 200, 100);
    peka(yta, "pointercancel", 150, 100);
    peka(yta, "pointerup", 100, 100);
    expect(onNasta).not.toHaveBeenCalled();
    svep(yta, 200, 100);
    expect(onNasta).toHaveBeenCalledTimes(1);
  });

  it("ett svep på en klickbar rad blir aldrig ett klick, men ett vanligt klick går fram", () => {
    const onKlick = vi.fn();
    const onNasta = vi.fn();
    render(<Yta onNasta={onNasta} onKlick={onKlick} />);
    const rad = screen.getByTestId("rad");
    svep(rad, 200, 100);
    fireEvent.click(rad);
    expect(onNasta).toHaveBeenCalledTimes(1);
    expect(onKlick).not.toHaveBeenCalled();
    // Ett tryck utan svep: klicket går fram. (Samma rad, direkt efteråt: spärren gällde bara svepets klick.)
    peka(rad, "pointerdown", 100, 100);
    peka(rad, "pointerup", 101, 100);
    fireEvent.click(rad);
    expect(onKlick).toHaveBeenCalledTimes(1);
  });

  it("ett klick långt efter ett svep är ett nytt tryck", () => {
    vi.useFakeTimers();
    try {
      const onKlick = vi.fn();
      render(<Yta onNasta={() => {}} onKlick={onKlick} />);
      const rad = screen.getByTestId("rad");
      svep(rad, 200, 100);
      vi.advanceTimersByTime(2000);
      fireEvent.click(rad);
      expect(onKlick).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ytan bär touch-action som släpper lodrät rullning, och inaktiv tar bort både svep och touch-action", () => {
    const onNasta = vi.fn();
    const { rerender } = render(<Yta onNasta={onNasta} />);
    expect(screen.getByTestId("yta").style.touchAction).toBe("pan-y pinch-zoom");
    rerender(<Yta onNasta={onNasta} inaktiv />);
    expect(screen.getByTestId("yta").style.touchAction).toBe("");
    svep(screen.getByTestId("yta"), 200, 100);
    expect(onNasta).not.toHaveBeenCalled();
  });
});

describe("OpsDatePicker: svep byter månad", () => {
  /** @param {import("react").ComponentProps<typeof OpsDatePicker>} [extra] */
  function oppna(extra = {}) {
    const ut = render(<OpsDatePicker value="2026-10-12" onChange={() => {}} ariaLabel="Datum" {...extra} />);
    fireEvent.click(screen.getByRole("button", { name: "Datum" }));
    return ut;
  }
  const kalender = () => /** @type {HTMLElement} */ (document.body.querySelector("[data-sidsvep]"));
  const rubrik = () => document.body.querySelector('[role="grid"]')?.getAttribute("aria-label") ?? "";

  it("åt vänster visas nästa månad, åt höger föregående, och onManadVisas får månadens första dag", () => {
    const onManadVisas = vi.fn();
    oppna({ onManadVisas });
    expect(onManadVisas).toHaveBeenLastCalledWith("2026-10-01");
    expect(rubrik()).toMatch(/(oktober|october) 2026/i);
    svep(kalender(), 250, 100);
    expect(rubrik()).toMatch(/(november|november) 2026/i);
    expect(onManadVisas).toHaveBeenLastCalledWith("2026-11-01");
    svep(kalender(), 100, 250);
    svep(kalender(), 100, 250);
    expect(rubrik()).toMatch(/(september|september) 2026/i);
    expect(onManadVisas).toHaveBeenLastCalledWith("2026-09-01");
    expect(onManadVisas).toHaveBeenCalledTimes(4);
  });

  it("prickarna följer med: appen räknar fram dagarna för den nya månaden", () => {
    const Wrapper = () => {
      const [dagar, setDagar] = require_state();
      return <OpsDatePicker value="2026-10-12" onChange={() => {}} ariaLabel="Datum" markeradeDagar={dagar} onManadVisas={(d) => setDagar(d.startsWith("2026-11") ? new Set(["2026-11-03"]) : new Set())} />;
    };
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: "Datum" }));
    expect(document.body.querySelector("[data-prick]")).toBeNull();
    svep(kalender(), 250, 100);
    expect(document.body.querySelector('[data-day="2026-11-03"] [data-prick]')).not.toBeNull();
  });

  it("ett svep väljer ingen dag, och nästa tryck på en dag gör det", () => {
    const onChange = vi.fn();
    oppna({ onChange });
    const dag = /** @type {HTMLElement} */ (document.body.querySelector('[data-day="2026-10-14"] button'));
    svep(dag, 250, 100);
    fireEvent.click(dag);
    expect(onChange).not.toHaveBeenCalled();
    const dag2 = /** @type {HTMLElement} */ (document.body.querySelector('[data-day="2026-11-04"] button'));
    // Ett riktigt tryck: ned, upp, klick. (Svepet bytte månad, så dag 14 oktober är borta ur trädet och dess klick nådde aldrig fram.)
    peka(dag2, "pointerdown", 100, 100);
    peka(dag2, "pointerup", 101, 100);
    fireEvent.click(dag2);
    expect(onChange).toHaveBeenCalledWith("2026-11-04");
  });

  it("pilarna går fortfarande, med ett valt datum, och går samma väg som svepet", () => {
    const onManadVisas = vi.fn();
    oppna({ onManadVisas });
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    expect(rubrik()).toMatch(/(november|november) 2026/i);
    expect(onManadVisas).toHaveBeenLastCalledWith("2026-11-01");
    svep(kalender(), 100, 250);
    expect(rubrik()).toMatch(/(oktober|october) 2026/i);
  });

  it("öppnas den igen startar den på det valda datumet, inte på månaden man svepte till", () => {
    oppna();
    svep(kalender(), 250, 100);
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Datum" }));
    expect(rubrik()).toMatch(/(oktober|october) 2026/i);
  });
});

/** En liten useState-ersättare så att provet ovan inte behöver importera den överst. */
import { useState } from "react";
function require_state() {
  return useState(/** @type {ReadonlySet<string>} */ (new Set()));
}
