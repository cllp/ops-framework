import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { OpsField, OpsInput, OpsTextarea } from "../components/OpsField.jsx";

/*
 * Tal i alla textfält (0.106.0, #386 skiva 8). CP: tal som förval i `OpsTextarea` och i fält på en rad, när webbläsaren har
 * taligenkänning, med `tal={false}` per fält, och aldrig i lösenord, e-post, nummer, datum eller sök.
 *
 * Webbläsarens taligenkänning fejkas som i textfalt-tal.test.jsx (`webkitSpeechRecognition`). Att ljudvågen inte täcker texten och
 * har 44 px träffyta mäts i en riktig webbläsare, check-skalyta 47 (8).
 */

function fejkadIgenkanning() {
  /** @type {any[]} */
  const instanser = [];
  class SR {
    constructor() {
      /** @type {any} */ this.onresult = null;
      /** @type {any} */ this.onerror = null;
      /** @type {any} */ this.onend = null;
      this.startad = false;
      instanser.push(this);
    }
    start() {
      this.startad = true;
    }
    stop() {
      queueMicrotask(() => this.onend?.());
    }
    abort() {}
  }
  return { SR, instanser };
}

afterEach(() => vi.unstubAllGlobals());

/** @param {{ typ?: any, tal?: any, mangrad?: boolean, readOnly?: boolean, utanOnChange?: boolean }} p */
function Falt({ typ, tal, mangrad = false, readOnly, utanOnChange }) {
  const [v, setV] = useState("");
  const onChange = utanOnChange ? undefined : setV;
  return (
    <OpsField label="Fält">
      {mangrad ? <OpsTextarea value={v} onChange={onChange} tal={tal} /> : <OpsInput value={v} onChange={onChange} type={typ} tal={tal} readOnly={readOnly} />}
    </OpsField>
  );
}

const mikrofon = () => screen.queryByRole("button", { name: "Prata in" });

describe("tal i alla textfält", () => {
  it("⛔ med taligenkänning i webbläsaren har ett fält på en rad och ett på flera rader ljudvågen utan att appen bett om den", () => {
    vi.stubGlobal("webkitSpeechRecognition", fejkadIgenkanning().SR);
    const { unmount } = render(<Falt />);
    expect(mikrofon()).toBeTruthy();
    expect(mikrofon()?.querySelector("svg")).toBeTruthy();
    unmount();
    render(<Falt mangrad />);
    expect(mikrofon()).toBeTruthy();
  });

  it("⛔ utan taligenkänning är fältet som förut: ingen knapp, och samma DOM", () => {
    const { container } = render(<Falt />);
    expect(mikrofon()).toBeNull();
    expect(container.querySelector("[data-textfalt-tal]")).toBeNull();
    expect(container.querySelector("input")?.className.split(/\s+/)).not.toContain("pe-12");
  });

  it("⛔ tal={false} stänger av, per fält, och ett fält utan onChange eller skrivskyddat får ingen", () => {
    vi.stubGlobal("webkitSpeechRecognition", fejkadIgenkanning().SR);
    for (const props of [{ tal: false }, { tal: false, mangrad: true }, { readOnly: true }, { utanOnChange: true }, { utanOnChange: true, mangrad: true }]) {
      const { unmount } = render(<Falt {...props} />);
      expect([JSON.stringify(props), mikrofon()]).toEqual([JSON.stringify(props), null]);
      unmount();
    }
  });

  it("⛔ aldrig i lösenord, e-post, nummer, sök, telefon och adress, och ett uttryckligt tal på dem kastar", () => {
    vi.stubGlobal("webkitSpeechRecognition", fejkadIgenkanning().SR);
    const typer = ["password", "email", "number", "search", "tel", "url"];
    for (const typ of typer) {
      const { unmount } = render(<Falt typ={typ} />);
      expect([typ, mikrofon()]).toEqual([typ, null]);
      unmount();
    }
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const typ of typer) expect(() => render(<Falt typ={typ} tal />)).toThrow(`OpsInput: tal finns inte för type="${typ}".`);
    } finally {
      fel.mockRestore();
    }
  });

  it("⛔ ingenting startar förrän ljudvågen trycks, och det sagda skrivs in på en rad", async () => {
    const f = fejkadIgenkanning();
    vi.stubGlobal("webkitSpeechRecognition", f.SR);
    const blob = new Blob(["ljud"], { type: "audio/webm" });
    const inspelare = { starta: vi.fn(async () => {}), stoppa: vi.fn(async () => ({ blob, mimeType: "audio/webm", sekunder: 2 })), kasta: vi.fn(), niva: () => 0.5 };
    render(<Falt tal={{ igenkanning: true, inspelare }} />);
    expect(f.instanser.length).toBe(0);
    expect(inspelare.starta).not.toHaveBeenCalled();
    fireEvent.click(/** @type {HTMLElement} */ (mikrofon()));
    await waitFor(() => expect(f.instanser[0]?.startad).toBe(true));
    act(() => f.instanser[0].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "Möte med banken\nfredag" }], { isFinal: true })] }));
    const yta = /** @type {HTMLElement} */ (document.querySelector("[data-rostyta]"));
    fireEvent.click(within(yta).getByRole("button", { name: "Klar, skriv in det du sagt" }));
    await waitFor(() => expect(/** @type {HTMLInputElement} */ (screen.getByRole("textbox", { name: "Fält" })).value).toBe("Möte med banken fredag"));
  });
});
