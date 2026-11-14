import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { OpsField, OpsInput, OpsTextarea, OpsTranskriberingProvider } from "../components/OpsField.jsx";

/*
 * ⛔ TEXTFÄLTENS MIKROFON MED SAMMA TALIGENKÄNNING SOM TALK (0.227.0). CP 2026-11-14: "Kör steg 1 först." I mobilappens webbvy finns ingen
 * `webkitSpeechRecognition`, så fälten spelade in och servern skrev ut efteråt, medan TALK fick telefonens egen igenkänning från appen.
 * Nu ger appen samma `igenkanning` till `OpsTranskriberingProvider`, och fälten med förvalt tal får den.
 *
 * Igenkänningen fejkas som appens: ett `Igenkanning`-objekt som på iOS bara lyssnar när ingen inspelare har mikrofonen (`kanLyssna`,
 * samma regel som lifehub.app:s `skaletsIgenkanning`). Webbvyn är WebKit (en iPhone). Mikrofonen fejkas på `navigator.mediaDevices`, så
 * att provet ser om en inspelning startade (getUserMedia anropas), och nekar, så att ingen riktig ström behövs.
 */

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

/** Appens igenkänning, som telefonens på iOS. */
function appensIgenkanning() {
  /** @type {{ onText: ((t: string) => void) | null, text: string }} */
  const s = { onText: null, text: "" };
  const g = {
    kanLyssna: vi.fn((/** @type {{ baraIgenkanning: boolean }} */ { baraIgenkanning }) => baraIgenkanning),
    starta: vi.fn((/** @type {any} */ val) => {
      s.onText = val.onText;
      s.text = "";
    }),
    stoppa: vi.fn(async () => s.text),
    kasta: vi.fn(),
  };
  /** @param {string} t */
  const sag = (t) =>
    act(() => {
      s.text = t;
      s.onText?.(t);
    });
  return { g, sag };
}

/** @type {PropertyDescriptor | undefined} */
let ua;
/** @type {PropertyDescriptor | undefined} */
let media;
function iPhone() {
  ua = Object.getOwnPropertyDescriptor(window.navigator, "userAgent");
  media = Object.getOwnPropertyDescriptor(window.navigator, "mediaDevices");
  Object.defineProperty(window.navigator, "userAgent", { value: IPHONE, configurable: true });
  const getUserMedia = vi.fn(async () => {
    throw new Error("ingen mikrofon i provet");
  });
  Object.defineProperty(window.navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  // jsdom har ingen MediaRecorder. Utan den hade inspelaren gett upp före getUserMedia, och provet hade inte sett om en inspelning började.
  vi.stubGlobal("MediaRecorder", class {});
  return getUserMedia;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (ua) Object.defineProperty(window.navigator, "userAgent", ua);
  else delete (/** @type {any} */ (window.navigator)).userAgent;
  if (media) Object.defineProperty(window.navigator, "mediaDevices", media);
  else delete (/** @type {any} */ (window.navigator)).mediaDevices;
  ua = undefined;
  media = undefined;
});

/** @param {{ mangrad?: boolean, tal?: any }} p */
function Falt({ mangrad = false, tal }) {
  const [v, setV] = useState("");
  return (
    <OpsField label="Fält">
      {mangrad ? <OpsTextarea value={v} onChange={setV} tal={tal} /> : <OpsInput value={v} onChange={setV} tal={tal} />}
    </OpsField>
  );
}

const mikrofon = () => screen.queryByRole("button", { name: "Prata in" });
const yta = () => /** @type {HTMLElement | null} */ (document.querySelector("[data-rostyta]"));

describe("textfältens mikrofon med appens igenkänning (0.227.0)", () => {
  it("⛔ 1. under en provider med appens igenkänning skriver fältet in det sagda, utan inspelning och utan servern", async () => {
    const getUserMedia = iPhone();
    for (const mangrad of [false, true]) {
      const { g, sag } = appensIgenkanning();
      const utskrift = vi.fn(async () => "från servern");
      render(
        <OpsTranskriberingProvider onTranscribe={utskrift} igenkanning={g}>
          <Falt mangrad={mangrad} />
        </OpsTranskriberingProvider>,
      );
      fireEvent.click(/** @type {HTMLElement} */ (mikrofon()));
      await waitFor(() => expect(g.starta).toHaveBeenCalledTimes(1));
      // Omgången kör bara igenkänningen, som TALK på iPhone.
      expect(g.kanLyssna).toHaveBeenCalledWith({ baraIgenkanning: true });
      sag("boka rep på torsdag");
      expect(yta()?.querySelector("[data-talk-text]")?.textContent).toBe("boka rep på torsdag");
      fireEvent.click(within(/** @type {HTMLElement} */ (yta())).getByRole("button", { name: "Klar, skriv in det du sagt" }));
      await waitFor(() => expect(yta()).toBeNull());
      expect(/** @type {HTMLInputElement} */ (screen.getByRole("textbox", { name: "Fält" })).value).toBe("boka rep på torsdag");
      expect(utskrift).not.toHaveBeenCalled();
      expect(getUserMedia).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("⛔ 1b. hördes inget står felet med Spela in i stället, och det spelar in", async () => {
    const getUserMedia = iPhone();
    const { g } = appensIgenkanning();
    render(
      <OpsTranskriberingProvider onTranscribe={vi.fn(async () => "x")} igenkanning={g}>
        <Falt />
      </OpsTranskriberingProvider>,
    );
    fireEvent.click(/** @type {HTMLElement} */ (mikrofon()));
    await waitFor(() => expect(g.starta).toHaveBeenCalledTimes(1));
    fireEvent.click(within(/** @type {HTMLElement} */ (yta())).getByRole("button", { name: "Klar, skriv in det du sagt" }));
    const reserv = await waitFor(() => /** @type {HTMLElement} */ (yta()?.querySelector("[data-talk-reserv]")));
    expect(yta()?.getAttribute("data-rostlage")).toBe("fel");
    fireEvent.click(reserv);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
  });

  it("⛔ 2. utan igenkanning i providern är allt som förut: på iPhone spelar fältet in och servern skriver ut", async () => {
    const getUserMedia = iPhone();
    const utskrift = vi.fn(async () => "x");
    render(
      <OpsTranskriberingProvider onTranscribe={utskrift}>
        <Falt />
      </OpsTranskriberingProvider>,
    );
    fireEvent.click(/** @type {HTMLElement} */ (mikrofon()));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
  });

  it("⛔ 3. uttryckligt tal={false} ger fortfarande inget, och ett uttryckligt tal läser inte providern", async () => {
    iPhone();
    const { g } = appensIgenkanning();
    render(
      <OpsTranskriberingProvider onTranscribe={vi.fn(async () => "x")} igenkanning={g}>
        <Falt tal={false} />
        <Falt mangrad tal={false} />
      </OpsTranskriberingProvider>,
    );
    expect(mikrofon()).toBeNull();
    expect(document.querySelector("[data-textfalt-tal]")).toBeNull();
  });

  it("providern säger ifrån på svenska om igenkanning har fel form, och kräver en av de två", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [fel, monster] of /** @type {const} */ ([
      [{ igenkanning: "ja" }, /igenkanning ska vara true, false eller en igenkänning.*fick string/],
      [{ igenkanning: { starta() {} } }, /utan stoppa, kasta/],
      [{ igenkanning: false }, /onTranscribe eller igenkanning krävs/],
      [{}, /onTranscribe eller igenkanning krävs/],
    ])) {
      expect(() => render(<OpsTranskriberingProvider {...(/** @type {any} */ (fel))}><Falt /></OpsTranskriberingProvider>)).toThrow(monster);
      cleanup();
    }
  });
});
