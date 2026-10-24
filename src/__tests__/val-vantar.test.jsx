import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsCheckbox, OpsSwitch } from "../components/OpsToggle.jsx";
import { useLofteVantan } from "../lib/useLofteVantan.js";

/**
 * 0.142.0 (#440): OpsSwitch, OpsCheckbox och OpsSelect väntar när onChange ger ett löfte. OpsSelect bygger på Radix, som jsdom inte öppnar
 * pålitligt, så dess del provas genom kroken den delar med de andra (samma `anropa`, samma spärr) och genom vakten check:vantar.
 */

function oppetLofte() {
  /** @type {(v?: unknown) => void} */ let klar = () => {};
  /** @type {(e: unknown) => void} */ let fel = () => {};
  const p = new Promise((a, b) => {
    klar = a;
    fel = b;
  });
  return { p, klar, fel };
}

describe.each([
  ["OpsSwitch", OpsSwitch, "switch"],
  ["OpsCheckbox", OpsCheckbox, "checkbox"],
])("%s: väntläge", (_namn, Komp, roll) => {
  it("ett löfte ger snurra och aria-busy, och ett andra val når inte appen förrän löftet är klart", async () => {
    const l = oppetLofte();
    const onChange = vi.fn(() => l.p);
    render(<Komp label="Använd minne" checked={false} onChange={onChange} />);
    const ruta = screen.getByRole(roll, { name: "Använd minne" });
    fireEvent.click(ruta);
    expect(ruta.getAttribute("aria-busy")).toBe("true");
    expect(document.body.querySelector("svg[aria-hidden='true'].animate-spin, [class*='animate-spin']")).not.toBeNull();
    fireEvent.click(ruta);
    expect(onChange).toHaveBeenCalledTimes(1);
    await act(async () => {
      l.klar();
      await l.p;
    });
    expect(ruta.getAttribute("aria-busy")).toBeNull();
    fireEvent.click(ruta);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("ett avvisat löfte släpper spärren", async () => {
    const l = oppetLofte();
    render(<Komp label="Minne" checked={false} onChange={() => l.p.catch(() => {}).then(() => Promise.reject(new Error("nej"))).catch(() => {})} />);
    const ruta = screen.getByRole(roll, { name: "Minne" });
    fireEvent.click(ruta);
    expect(ruta.getAttribute("aria-busy")).toBe("true");
    await act(async () => {
      l.fel(new Error("nekad"));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(ruta.getAttribute("aria-busy")).toBeNull();
  });

  it("utan löfte är allt som förut: ingen väntan, varje val når appen", () => {
    const onChange = vi.fn();
    render(<Komp label="Synk" checked={false} onChange={onChange} />);
    const ruta = screen.getByRole(roll, { name: "Synk" });
    fireEvent.click(ruta);
    fireEvent.click(ruta);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(ruta.getAttribute("aria-busy")).toBeNull();
  });
});

describe("useLofteVantan (OpsSelects väntan)", () => {
  it("avvisat löfte släpper spärren och felet når appen", async () => {
    /** @type {any} */ let api;
    function Prov() {
      api = useLofteVantan(() => Promise.reject(new Error("nej")));
      return null;
    }
    render(<Prov />);
    let fangat = null;
    await act(async () => {
      try {
        await api.anropa("a");
      } catch (e) {
        fangat = e;
      }
    });
    expect(String(fangat)).toMatch(/nej/);
    expect(api.upptagen).toBe(false);
  });
});
