import { createElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BilagaVisning } from "../components/BilagaVisning.jsx";
import { OpsLjudspelare } from "../components/OpsLjudspelare.jsx";
import {
  STOLPAR,
  andel,
  baraEnSpelar,
  formateraTid,
  hastighetText,
  hoppa,
  langdArKand,
  lasLangdMedSok,
  metaUrBytes,
  nastaHastighet,
  nollstallSpelare,
  registreraSpelare,
  sokTill,
  stolparUrKanal,
  tidUrAndel,
} from "../lib/ljudspelare.js";
import { isAudio } from "../lib/file.js";

describe("ljudspelarens räkning", () => {
  it("tiden, hastigheten och spolningen håller sig inom ljudet", () => {
    expect(formateraTid(0)).toBe("0:00");
    expect(formateraTid(-3)).toBe("0:00");
    expect(formateraTid(Number.NaN)).toBe("0:00");
    expect(formateraTid(65.9)).toBe("1:05");
    expect(hastighetText(1)).toBe("1×");
    expect(hastighetText(1.25)).toBe("1,25×");
    expect(hastighetText(1.5)).toBe("1,5×");
    expect(nastaHastighet(1)).toBe(1.25);
    expect(nastaHastighet(2)).toBe(1);
    expect(nastaHastighet(9)).toBe(1);
    expect(sokTill(-4, 10)).toBe(0);
    expect(sokTill(12, 10)).toBe(10);
    expect(sokTill(3, 0)).toBe(3);
    expect(sokTill(Number.NaN, 10)).toBe(0);
    expect(hoppa(8, 10, 10)).toBe(10);
    expect(hoppa(2, 10, -10)).toBe(0);
    expect(andel(5, 10)).toBe(0.5);
    expect(andel(0, 0)).toBe(0);
    expect(andel(20, 10)).toBe(1);
    expect(tidUrAndel(0.5, 10)).toBe(5);
    expect(tidUrAndel(2, 10)).toBe(10);
  });

  it("stolparna normaliseras mot toppen, och tystnad förblir tyst", () => {
    const tyst = stolparUrKanal(new Float32Array(40), 4);
    expect(tyst).toEqual([0, 0, 0, 0]);
    const data = new Float32Array(8);
    data[1] = 0.5;
    data[6] = -0.25;
    expect(stolparUrKanal(data, 4)).toEqual([1, 0, 0, 0.5]);
    expect(stolparUrKanal(new Float32Array(0), 4)).toEqual([]);
  });

  it("Infinity är inte en längd, och ett sök till ett stort värde läser den", async () => {
    expect(langdArKand(Infinity)).toBe(false);
    expect(langdArKand(0)).toBe(false);
    expect(langdArKand(4)).toBe(true);
    let duration = Infinity;
    /** @type {HTMLAudioElement} */
    const el = /** @type {HTMLAudioElement} */ (document.createElement("audio"));
    Object.defineProperty(el, "duration", { configurable: true, get: () => duration });
    Object.defineProperty(el, "currentTime", {
      configurable: true,
      get() { return /** @type {any} */ (this)._t || 0; },
      set(v) {
        /** @type {any} */ (this)._t = v;
        if (v > 1e10) {
          duration = 4.2;
          this.dispatchEvent(new Event("timeupdate"));
        }
      },
    });
    await expect(lasLangdMedSok(el)).resolves.toBe(4.2);
  });

  it("AudioContext ger både längd och toppar när elementets duration är oändlig", async () => {
    const kanal = new Float32Array(STOLPAR * 2);
    kanal[2] = 0.8;
    kanal[10] = -0.2;
    const tidigare = globalThis.AudioContext;
    globalThis.AudioContext = class {
      async decodeAudioData() {
        return { duration: 4, getChannelData: () => kanal };
      }
      async close() {}
    };
    try {
      const meta = await metaUrBytes(new ArrayBuffer(8));
      expect(meta?.durationMs).toBe(4000);
      expect(meta?.peaks).toHaveLength(STOLPAR);
      expect(Math.max(...(meta?.peaks ?? []))).toBe(1);
    } finally {
      if (tidigare) globalThis.AudioContext = tidigare;
      else delete globalThis.AudioContext;
    }
  });

  it("spärren pausar de andra, och en tömd spärr pausar ingen", () => {
    const a = { pausa: vi.fn() };
    const b = { pausa: vi.fn() };
    registreraSpelare(a);
    registreraSpelare(b);
    baraEnSpelar(a);
    expect(a.pausa).not.toHaveBeenCalled();
    expect(b.pausa).toHaveBeenCalledTimes(1);
    nollstallSpelare();
    baraEnSpelar(a);
    expect(b.pausa).toHaveBeenCalledTimes(1);
  });
});

/**
 * @param {HTMLAudioElement} el
 * @param {number} sekunder
 */
function sattLangd(el, sekunder) {
  Object.defineProperty(el, "duration", { configurable: true, get: () => sekunder });
  el.dispatchEvent(new Event("loadedmetadata"));
}

describe("OpsLjudspelare", () => {
  beforeEach(() => {
    nollstallSpelare();
    HTMLMediaElement.prototype.play = function play() {
      this.dispatchEvent(new Event("play"));
      this.dispatchEvent(new Event("playing"));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {
      this.dispatchEvent(new Event("pause"));
    };
  });

  it("visar våg, skena, tid och spela, och en andra spelare tystar den första", async () => {
    render(
      <>
        <OpsLjudspelare src="https://exempel.se/a.webm" namn="Första" />
        <OpsLjudspelare src="https://exempel.se/b.webm" namn="Andra" />
      </>,
    );
    expect(document.querySelectorAll("[data-ljud-stolpe]").length).toBeGreaterThanOrEqual(STOLPAR);
    expect(document.querySelectorAll("[data-ljud-skena]").length).toBe(2);
    expect(document.querySelectorAll("[data-ljud-tid]").length).toBe(2);
    expect(document.querySelectorAll("[data-ljud-tid]")[0].textContent).toMatch(/0:00/);
    fireEvent.click(screen.getByRole("button", { name: "Spela Första" }));
    expect(await screen.findByRole("button", { name: "Pausa Första" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Spela Andra" }));
    expect(await screen.findByRole("button", { name: "Pausa Andra" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spela Första" })).toBeInTheDocument();
  });

  it("spolar med reglaget, byter hastighet och säger ifrån när uppspelningen nekas", async () => {
    const { unmount } = render(<OpsLjudspelare src="https://exempel.se/a.webm" namn="Idé" />);
    const el = /** @type {HTMLAudioElement} */ (document.querySelector("audio"));
    expect(el.getAttribute("playsinline")).not.toBeNull();
    act(() => sattLangd(el, 100));
    await waitFor(() => expect(document.querySelector("[data-ljud-tid]")?.textContent).toMatch(/1:40/));
    const reglage = screen.getByRole("slider", { name: "Spola i Idé" });
    fireEvent.change(reglage, { target: { value: "500" } });
    expect(el.currentTime).toBe(50);
    expect(document.querySelector("[data-ljud-framsteg]")).toHaveStyle({ width: "50%" });
    const spelade = document.querySelectorAll('[data-ljud-stolpe="spelad"]').length;
    const kvar = document.querySelectorAll('[data-ljud-stolpe="kvar"]').length;
    expect(spelade).toBeGreaterThan(0);
    expect(kvar).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "10 sekunder framåt" }));
    expect(el.currentTime).toBe(60);
    fireEvent.click(screen.getByRole("button", { name: "Uppspelningshastighet 1×" }));
    expect(screen.getByRole("button", { name: "Uppspelningshastighet 1,25×" })).toBeInTheDocument();
    expect(el.playbackRate).toBe(1.25);
    unmount();

    HTMLMediaElement.prototype.play = function nekad() {
      return Promise.reject(new DOMException("nej", "NotAllowedError"));
    };
    render(<OpsLjudspelare src="https://exempel.se/a.webm" />);
    fireEvent.click(screen.getByRole("button", { name: "Spela" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Webbläsaren tillät inte uppspelningen/);
  });

  it("hämtar adressen innan spelaren ritas, och en färdig src anropar inte hamtaAdress", async () => {
    let los = /** @type {(url: string) => void} */ (() => {});
    const hamtaAdress = vi.fn((sokvag) => new Promise((resolve) => {
      los = () => resolve(`https://exempel.se/${sokvag}`);
    }));
    const { unmount } = render(<OpsLjudspelare sokvag="grupper/my/a.webm" hamtaAdress={hamtaAdress} namn="Idé" />);
    expect(screen.getByText("Hämtar ljudet.")).toBeInTheDocument();
    expect(document.querySelector("audio")).toBeNull();
    expect(hamtaAdress).toHaveBeenCalledWith("grupper/my/a.webm");
    los("https://exempel.se/grupper/my/a.webm");
    expect(await screen.findByRole("button", { name: "Spela Idé" })).toBeInTheDocument();
    expect(document.querySelector("audio")).toHaveAttribute("src", "https://exempel.se/grupper/my/a.webm");
    unmount();

    const om = vi.fn(async () => "https://exempel.se/fel.webm");
    render(<OpsLjudspelare src="https://exempel.se/ratt.webm" sokvag="x" hamtaAdress={om} />);
    expect(om).not.toHaveBeenCalled();
    expect(document.querySelector("audio")).toHaveAttribute("src", "https://exempel.se/ratt.webm");
  });

  it("säger att adressen saknas, och en okänd prop kastas", async () => {
    const tom = render(<OpsLjudspelare sokvag="" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Filen har ingen adress.");
    tom.unmount();
    const nekad = vi.fn(async () => {
      throw new Error("Behörighet saknas.");
    });
    const fel = render(<OpsLjudspelare sokvag="grupper/my/a.webm" hamtaAdress={nekad} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Behörighet saknas.");
    fel.unmount();
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(createElement(OpsLjudspelare, { src: "https://exempel.se/a.webm", className: "x" }))).toThrow(/okända props className/);
    } finally {
      tyst.mockRestore();
    }
  });

  it("en ljudbilaga spelas, en pdf laddas ned", () => {
    expect(isAudio("audio/mpeg")).toBe(true);
    expect(isAudio("image/png")).toBe(false);
    const url = "data:audio/mpeg;base64,AAA";
    const { unmount } = render(
      <BilagaVisning bilaga={{ dataUrl: url, namn: "rost.mp3", typ: "audio/mpeg", tecken: url.length }} alt="röst" />,
    );
    expect(document.querySelector("[data-kommentar-bilaga-visad]")).toHaveAttribute("data-kommentar-bilaga-visad", "ljud");
    expect(screen.getByRole("button", { name: "Spela rost.mp3" })).toBeInTheDocument();
    expect(document.querySelector("audio")).toHaveAttribute("src", url);
    unmount();

    const pdf = "data:application/pdf;base64,JVBERi0=";
    render(<BilagaVisning bilaga={{ dataUrl: pdf, namn: "utdrag.pdf", typ: "application/pdf", tecken: pdf.length }} alt="pdf" />);
    expect(screen.getByRole("link", { name: /utdrag\.pdf/ })).toHaveAttribute("data-kommentar-bilaga-visad", "fil");
    expect(document.querySelector("audio")).toBeNull();
  });

  it("kompakt rad visar rubrik och våg, och gömmer hopp, hastighet och nedladdning", () => {
    const peaks = Array.from({ length: STOLPAR }, (_, i) => (i % 5 === 0 ? 1 : 0.2));
    render(
      <OpsLjudspelare
        kompakt
        src="https://exempel.se/a.webm"
        namn="Hyllan"
        meta="8 okt. 2026 · 0:04"
        durationMs={4000}
        peaks={peaks}
        onOppna={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Hyllan" })).toBeInTheDocument();
    expect(document.querySelector("[data-ljud-langd]")?.textContent).toBe("8 okt. 2026 · 0:04");
    expect(document.querySelector("[data-ljudspelare]")?.getAttribute("data-ljudspelare")).toBe("kompakt");
    expect(screen.queryByRole("button", { name: "10 sekunder bakåt" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Uppspelningshastighet/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ladda ned/ })).toBeNull();
    const hojder = [...document.querySelectorAll("[data-ljud-hojd]")].map((el) => el.getAttribute("data-ljud-hojd"));
    expect(new Set(hojder).size).toBeGreaterThan(1);
    expect(document.querySelector("[data-ljud-vag]")?.getAttribute("data-ljud-vag")).toBe("toppar");
    const reglage = screen.getByRole("slider", { name: "Spola i Hyllan" });
    expect(reglage).not.toBeDisabled();
  });

  it("väntan syns tills ljudet börjar", async () => {
    /** @type {() => void} */
    let slapp = () => {};
    HTMLMediaElement.prototype.play = function vantande() {
      this.dispatchEvent(new Event("waiting"));
      return new Promise((resolve) => {
        slapp = () => {
          this.dispatchEvent(new Event("playing"));
          resolve(undefined);
        };
      });
    };
    render(<OpsLjudspelare src="https://exempel.se/a.webm" namn="Idé" />);
    fireEvent.click(screen.getByRole("button", { name: "Spela Idé" }));
    expect(screen.getByRole("button", { name: "Hämtar ljudet Idé" })).toHaveAttribute("aria-busy", "true");
    act(() => slapp());
    await waitFor(() => expect(screen.getByRole("button", { name: "Pausa Idé" })).toBeInTheDocument());
  });
});
