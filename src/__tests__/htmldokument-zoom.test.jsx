import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsHtmlDokument } from "../components/OpsHtmlDokument.jsx";
import { OpsHtmlVy } from "../components/OpsHtmlVy.jsx";
import { HTML_SANDBOX } from "../lib/htmldokument.js";
import {
  HTML_FOKUSMEDDELANDE,
  HTML_MATTMEDDELANDE,
  HTML_ZOOMMEDDELANDE,
  HTML_ZOOMSKRIPT,
  HTML_ZOOMSTEGMEDDELANDE,
  ZOOM_MAX,
  ZOOM_MIN,
  anpassadSkala,
  byggSrcdoc,
  tolkaRutmeddelande,
  zoomHjul,
  zoomSteg,
} from "../lib/htmlruta.js";

/*
 * Zoomen i HTML-rutan (0.192.0, cllp/ops-framework#529). CP 2026-11-06: "HTML-sidan är ofta för stor och man behöver scrolla i vyn." Och: "Zoomen måste finnas med i förhandstitt."
 * Om hjulet: "Bara i dokumentet om dokumentet är i fokus." Om telefonen: "På telefonen gör nypzoom samma sak."
 *
 * jsdom kör ingen layout. Skriptet körs här med egna `window`, `parent` och `document`, så att avsändare, fokus och mått bestäms av provet. Hur rutan LIGGER (inget sidledes rullande vid 390 och 1280) mäts i skalytan.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

/** Kör zoomskriptet som i rutan. `fokus` är vad `document.hasFocus()` svarar. `gest` är Safari, där `"ongesturechange" in window`. */
function kor({ innehall = 1800, synlig = 358, fokus = false, gest = false } = {}) {
  /** @type {Record<string, Array<{ f: (e: any) => void, val: any }>>} */
  const lyssnare = {};
  const parent = { postMessage: vi.fn() };
  const style = { zoom: "" };
  /** Zoomen när bredden lästes: måttet ska tas vid zoom 1. */
  const lasesVid = /** @type {string[]} */ ([]);
  const rot = {
    style,
    get scrollWidth() {
      lasesVid.push(style.zoom);
      return innehall;
    },
    get clientWidth() {
      return synlig;
    },
  };
  const dok = { documentElement: rot, body: null, hasFocus: () => fokus };
  const fonster = {
    addEventListener: (/** @type {string} */ typ, /** @type {(e: any) => void} */ f, /** @type {any} */ val) => {
      (lyssnare[typ] ??= []).push({ f, val });
    },
    requestAnimationFrame: (/** @type {() => void} */ f) => {
      f();
      return 1;
    },
  };
  // Sätts före skriptet: det väljer nypningens väg när det startar.
  if (gest) fonster.ongesturechange = null;
  new Function("window", "parent", "document", HTML_ZOOMSKRIPT)(fonster, parent, dok);
  const skicka = (/** @type {string} */ typ, /** @type {any} */ e) => (lyssnare[typ] ?? []).forEach(({ f }) => f(e));
  return { parent, style, lasesVid, lyssnare, skicka, satt: (/** @type {boolean} */ v) => { fokus = v; } };
}

const hjul = (/** @type {Record<string, unknown>} */ extra) => ({ deltaY: -100, deltaMode: 0, ctrlKey: false, metaKey: false, preventDefault: vi.fn(), ...extra });

/** Två fingrar. Avståndet mellan dem är `x2 - x1` när de ligger på samma höjd. */
const tvaFingrar = (/** @type {number} */ x1, /** @type {number} */ x2, /** @type {Record<string, unknown>} */ extra = {}) => ({
  touches: [{ clientX: x1, clientY: 40 }, { clientX: x2, clientY: 40 }],
  preventDefault: vi.fn(),
  defaultPrevented: false,
  ...extra,
});

describe("rutans zoomskript", () => {
  it("srcdoc bär skriptet efter de två andra", () => {
    expect(byggSrcdoc("<p>x</p>")).toContain(HTML_ZOOMSKRIPT);
  });

  it("skickar dokumentets bredd och den synliga bredden, mätta vid zoom 1, och lämnar zoomen som den var", () => {
    const { parent, style, lasesVid } = kor();
    expect(parent.postMessage).toHaveBeenCalledWith({ typ: HTML_MATTMEDDELANDE, innehall: 1800, synlig: 358 }, "*");
    style.zoom = "0.2";
    const k = kor();
    k.style.zoom = "0.5";
    k.skicka("resize", {});
    expect(k.lasesVid.at(-1)).toBe("1");
    expect(k.style.zoom).toBe("0.5");
    expect(lasesVid[0]).toBe("1");
  });

  it("⛔ zoomen sätts bara för ett meddelande från parent, med känd typ och en skala inom gränserna", () => {
    const { parent, style, skicka } = kor();
    skicka("message", { source: parent, data: { typ: HTML_ZOOMMEDDELANDE, skala: 0.2 } });
    expect(style.zoom).toBe("0.2");
    for (const [kalla, data] of /** @type {const} */ ([
      [{}, { typ: HTML_ZOOMMEDDELANDE, skala: 0.5 }],
      [null, { typ: HTML_ZOOMMEDDELANDE, skala: 0.5 }],
      [parent, { typ: "annat", skala: 0.5 }],
      [parent, { typ: HTML_ZOOMMEDDELANDE, skala: ZOOM_MAX + 1 }],
      [parent, { typ: HTML_ZOOMMEDDELANDE, skala: ZOOM_MIN / 2 }],
      [parent, { typ: HTML_ZOOMMEDDELANDE, skala: Number.NaN }],
      [parent, { typ: HTML_ZOOMMEDDELANDE, skala: "0.5" }],
    ])) {
      skicka("message", { source: kalla, data });
      expect(style.zoom, JSON.stringify(data)).toBe("0.2");
    }
  });

  it("⛔ Ctrl- och Cmd+hjul UTAN fokus: inget meddelande och ingen preventDefault, så att hjulet gör som i dag", () => {
    const { parent, skicka, lyssnare } = kor({ fokus: false });
    parent.postMessage.mockClear();
    expect(lyssnare.wheel[0].val).toEqual({ passive: false });
    for (const tangent of ["ctrlKey", "metaKey"]) {
      const e = hjul({ [tangent]: true });
      skicka("wheel", e);
      expect(e.preventDefault, tangent).not.toHaveBeenCalled();
    }
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it("⛔ Ctrl- och Cmd+hjul MED fokus: steget går till appen och sidans zoom stoppas. Ett hjul utan tangent rullar som förut", () => {
    const { parent, skicka } = kor({ fokus: true });
    parent.postMessage.mockClear();
    for (const tangent of ["ctrlKey", "metaKey"]) {
      const e = hjul({ [tangent]: true });
      skicka("wheel", e);
      expect(e.preventDefault, tangent).toHaveBeenCalledTimes(1);
    }
    expect(parent.postMessage).toHaveBeenCalledTimes(2);
    expect(parent.postMessage).toHaveBeenCalledWith({ typ: HTML_ZOOMSTEGMEDDELANDE, delta: -100 }, "*");
    const vanligt = hjul({});
    skicka("wheel", vanligt);
    expect(vanligt.preventDefault).not.toHaveBeenCalled();
    expect(parent.postMessage).toHaveBeenCalledTimes(2);
    // En nypning på en styrplatta kommer som Ctrl+hjul med små steg.
    const nyp = hjul({ ctrlKey: true, deltaY: 4.5 });
    skicka("wheel", nyp);
    expect(nyp.preventDefault).toHaveBeenCalled();
    expect(parent.postMessage).toHaveBeenLastCalledWith({ typ: HTML_ZOOMSTEGMEDDELANDE, delta: 4.5 }, "*");
  });

  it("⛔ två fingrar UTAN fokus zoomar dokumentet och stoppar sidans nypning. Ett finger rullar som förut, och ett dokument som redan tagit gesten behåller den", () => {
    const { parent, skicka, lyssnare } = kor({ fokus: false });
    parent.postMessage.mockClear();
    expect(lyssnare.touchmove[0].val).toEqual({ passive: false });
    expect(lyssnare.gesturechange).toBeUndefined();
    const ett = { touches: [{ clientX: 20, clientY: 40 }], preventDefault: vi.fn(), defaultPrevented: false };
    skicka("touchmove", ett);
    expect(ett.preventDefault).not.toHaveBeenCalled();
    skicka("touchstart", tvaFingrar(20, 120));
    const taget = tvaFingrar(20, 140, { defaultPrevented: true });
    skicka("touchmove", taget);
    expect(taget.preventDefault).not.toHaveBeenCalled();
    expect(parent.postMessage).not.toHaveBeenCalled();
    // Från avståndet gesten redan nått (120) till 132: faktorn 1,1, samma steg som ett hack på hjulet uppåt. Tillbaka är samma steg nedåt.
    const nyp = tvaFingrar(20, 152);
    skicka("touchmove", nyp);
    expect(nyp.preventDefault).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).toHaveBeenCalledWith({ typ: HTML_ZOOMSTEGMEDDELANDE, delta: -100 }, "*");
    const ihop = tvaFingrar(20, 140);
    skicka("touchmove", ihop);
    expect(ihop.preventDefault).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).toHaveBeenLastCalledWith({ typ: HTML_ZOOMSTEGMEDDELANDE, delta: 100 }, "*");
  });

  it("⛔ Safari zoomar med gesture-händelser, inte med touch, så samma nypning inte räknas två gånger", () => {
    const { parent, skicka, lyssnare } = kor({ gest: true, fokus: false });
    parent.postMessage.mockClear();
    expect(lyssnare.touchmove).toBeUndefined();
    expect(lyssnare.gesturechange[0].val).toEqual({ passive: false });
    const start = { scale: 1, preventDefault: vi.fn(), defaultPrevented: false };
    skicka("gesturestart", start);
    expect(start.preventDefault).toHaveBeenCalledTimes(1);
    const andring = { scale: 1.1, preventDefault: vi.fn(), defaultPrevented: false };
    skicka("gesturechange", andring);
    expect(andring.preventDefault).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).toHaveBeenCalledWith({ typ: HTML_ZOOMSTEGMEDDELANDE, delta: -100 }, "*");
    const taget = { scale: 1.3, preventDefault: vi.fn(), defaultPrevented: true };
    skicka("gesturechange", taget);
    expect(taget.preventDefault).not.toHaveBeenCalled();
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
  });

  it("säger till när dokumentet får och tappar fokus", () => {
    const { parent, skicka } = kor();
    skicka("focus", {});
    expect(parent.postMessage).toHaveBeenLastCalledWith({ typ: HTML_FOKUSMEDDELANDE, fokus: true }, "*");
    skicka("blur", {});
    expect(parent.postMessage).toHaveBeenLastCalledWith({ typ: HTML_FOKUSMEDDELANDE, fokus: false }, "*");
  });
});

describe("zoomens räkning", () => {
  it("Anpassa till bredd är den synliga bredden delad med dokumentets, högst 1 och lägst ZOOM_MIN", () => {
    expect(anpassadSkala({ innehall: 1800, synlig: 358 })).toBeCloseTo(358 / 1800, 10);
    expect(anpassadSkala({ innehall: 1800, synlig: 1200 })).toBeCloseTo(1200 / 1800, 10);
    expect(anpassadSkala({ innehall: 600, synlig: 1200 })).toBe(1);
    expect(anpassadSkala({ innehall: 100_000, synlig: 300 })).toBe(ZOOM_MIN);
  });

  it("− och + går till närmaste hela tiotal och stannar vid gränserna", () => {
    expect(zoomSteg(0.22, 1)).toBe(0.3);
    expect(zoomSteg(0.22, -1)).toBe(0.2);
    // 19,9 procent visas som 20: + ger 30, inte 20 igen.
    expect(zoomSteg(358 / 1800, 1)).toBe(0.3);
    expect(zoomSteg(1, 1)).toBe(1.1);
    expect(zoomSteg(1, -1)).toBe(0.9);
    expect(zoomSteg(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
    expect(zoomSteg(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(zoomHjul(1, -100)).toBe(1.1);
    expect(zoomHjul(1, 100)).toBeCloseTo(1 / 1.1, 4);
    expect(zoomHjul(ZOOM_MAX, -10_000)).toBe(ZOOM_MAX);
    expect(zoomHjul(ZOOM_MIN, 10_000)).toBe(ZOOM_MIN);
  });

  it("⛔ små nypsteg samlas, så en långsam nypning inte fastnar på samma procent", () => {
    let s = 0.5;
    for (let i = 0; i < 20; i += 1) s = zoomHjul(s, -5);
    // Tjugo steg på 5 är ett helt hjulsteg: 50 procent gånger 1,1.
    expect(s).toBeCloseTo(0.55, 4);
  });

  it("⛔ ett meddelande från rutan tas bara emot i känd form", () => {
    expect(tolkaRutmeddelande({ typ: HTML_MATTMEDDELANDE, innehall: 1800, synlig: 358 })).toEqual({ typ: "matt", innehall: 1800, synlig: 358 });
    expect(tolkaRutmeddelande({ typ: HTML_ZOOMSTEGMEDDELANDE, delta: -3 })).toEqual({ typ: "steg", delta: -3 });
    expect(tolkaRutmeddelande({ typ: HTML_FOKUSMEDDELANDE, fokus: true })).toEqual({ typ: "fokus", fokus: true });
    for (const d of [null, "x", {}, { typ: "annat" }, { typ: HTML_MATTMEDDELANDE, innehall: 0, synlig: 1 }, { typ: HTML_MATTMEDDELANDE, innehall: "1800", synlig: 358 }, { typ: HTML_MATTMEDDELANDE, innehall: Infinity, synlig: 1 }, { typ: HTML_MATTMEDDELANDE, innehall: 2e6, synlig: 1 }, { typ: HTML_ZOOMSTEGMEDDELANDE, delta: Number.NaN }, { typ: HTML_ZOOMSTEGMEDDELANDE, delta: 1e9 }, { typ: HTML_FOKUSMEDDELANDE, fokus: "ja" }]) {
      expect(tolkaRutmeddelande(d), JSON.stringify(d)).toBeNull();
    }
  });
});

describe("zoomen vid rutan", () => {
  /** Rutan, med en spion på det som skickas in i den. */
  async function rita(/** @type {"detalj" | "vy"} */ var_ = "detalj") {
    if (var_ === "detalj") render(<OpsHtmlDokument html="<p>bred</p>" namn="rapport.html" />);
    else render(<OpsHtmlVy hamta={async () => new Blob(["<p>bred</p>"], { type: "text/html" })} sokvag="s" namn="rapport.html" />);
    await waitFor(() => expect(document.querySelector("iframe")).not.toBeNull());
    // Rutan laddar sitt srcdoc och får då sitt fönster. Det är det fönstret som är avsändaren.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const ram = /** @type {HTMLIFrameElement} */ (document.querySelector("iframe"));
    const fonster = /** @type {Window} */ (ram.contentWindow);
    const skickat = vi.spyOn(fonster, "postMessage").mockImplementation(() => {});
    const fran = async (/** @type {any} */ kalla, /** @type {any} */ data) => {
      await act(async () => {
        window.dispatchEvent(new MessageEvent("message", { source: kalla, data }));
      });
    };
    const procent = () => (document.querySelector("[data-html-zoom-procent]")?.textContent ?? "").replace(/\s/g, " ");
    const zoomTill = () => skickat.mock.calls.filter(([d]) => /** @type {any} */ (d)?.typ === HTML_ZOOMMEDDELANDE).map(([d]) => /** @type {any} */ (d).skala);
    return { ram, fonster, skickat, fran, procent, zoomTill };
  }

  for (const var_ of /** @type {const} */ (["detalj", "vy"])) {
    it(`${var_}: Anpassa till bredd är förvalet, och skalan skickas till rutan`, async () => {
      const { fonster, fran, procent, zoomTill } = await rita(var_);
      expect(document.querySelector("iframe")?.getAttribute("sandbox")).toBe(HTML_SANDBOX);
      expect(procent()).toBe("100 %");
      await fran(fonster, { typ: HTML_MATTMEDDELANDE, innehall: 1800, synlig: 358 });
      expect(procent()).toBe("20 %");
      expect(zoomTill().at(-1)).toBeCloseTo(358 / 1800, 10);
      expect(document.querySelector("[data-html-zoom-anpassad]")).not.toBeNull();
    });
  }

  it("− och + stegar från anpassningen och stannar vid gränserna, och procenten går tillbaka till Anpassa till bredd", async () => {
    const { fonster, fran, procent, zoomTill } = await rita();
    await fran(fonster, { typ: HTML_MATTMEDDELANDE, innehall: 1800, synlig: 358 });
    fireEvent.click(screen.getByRole("button", { name: "Zooma in" }));
    expect(procent()).toBe("30 %");
    expect(document.querySelector("[data-html-zoom-anpassad]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Zooma ut" }));
    fireEvent.click(screen.getByRole("button", { name: "Zooma ut" }));
    fireEvent.click(screen.getByRole("button", { name: "Zooma ut" }));
    expect(procent()).toBe("10 %");
    expect(screen.getByRole("button", { name: "Zooma ut" })).toBeDisabled();
    for (let i = 0; i < 30; i += 1) {
      const knapp = screen.getByRole("button", { name: "Zooma in" });
      if (knapp.hasAttribute("disabled")) break;
      fireEvent.click(knapp);
    }
    expect(procent()).toBe("200 %");
    expect(screen.getByRole("button", { name: "Zooma in" })).toBeDisabled();
    expect(zoomTill().at(-1)).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: /Anpassa till bredd/ }));
    expect(procent()).toBe("20 %");
    expect(document.querySelector("[data-html-zoom-anpassad]")).not.toBeNull();
    expect(screen.getByRole("button", { name: /anpassad till bredd/ })).toBeInTheDocument();
  });

  it("⛔ en långsam nypning, många små steg från rutan, flyttar procenten från Anpassa till bredd", async () => {
    const { fonster, fran, procent } = await rita();
    await fran(fonster, { typ: HTML_MATTMEDDELANDE, innehall: 1000, synlig: 500 });
    expect(procent()).toBe("50 %");
    expect(document.querySelector("iframe")?.getAttribute("sandbox")).toBe(HTML_SANDBOX);
    for (let i = 0; i < 20; i += 1) await fran(fonster, { typ: HTML_ZOOMSTEGMEDDELANDE, delta: -5 });
    expect(procent()).toBe("55 %");
    expect(document.querySelector("[data-html-zoom-anpassad]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Anpassa till bredd/ }));
    expect(procent()).toBe("50 %");
    expect(document.querySelector("[data-html-zoom-anpassad]")).not.toBeNull();
  });

  it("ett Ctrl+hjul från rutan ändrar zoomen, och ett nytt mått skickar skalan igen (ett omladdat dokument börjar på 1)", async () => {
    const { fonster, fran, procent, zoomTill } = await rita();
    await fran(fonster, { typ: HTML_MATTMEDDELANDE, innehall: 1000, synlig: 500 });
    expect(procent()).toBe("50 %");
    await fran(fonster, { typ: HTML_ZOOMSTEGMEDDELANDE, delta: -100 });
    expect(procent()).toBe("55 %");
    const fore = zoomTill().length;
    await fran(fonster, { typ: HTML_MATTMEDDELANDE, innehall: 1000, synlig: 500 });
    expect(zoomTill().length).toBe(fore + 1);
    expect(zoomTill().at(-1)).toBe(0.55);
  });

  it("⛔ ett meddelande från en annan källa ignoreras, och ett i fel form också", async () => {
    const { fonster, fran, procent, ram } = await rita();
    await fran(window, { typ: HTML_MATTMEDDELANDE, innehall: 1800, synlig: 358 });
    await fran(window, { typ: HTML_ZOOMSTEGMEDDELANDE, delta: -100 });
    await fran(window, { typ: HTML_FOKUSMEDDELANDE, fokus: true });
    expect(procent()).toBe("100 %");
    expect(ram.hasAttribute("data-html-fokus")).toBe(false);
    await fran(fonster, { typ: HTML_MATTMEDDELANDE, innehall: "1800", synlig: 358 });
    expect(procent()).toBe("100 %");
  });

  it("⛔ ramen följer dokumentets fokus", async () => {
    const { fonster, fran, ram } = await rita();
    expect(ram.hasAttribute("data-html-fokus")).toBe(false);
    await fran(fonster, { typ: HTML_FOKUSMEDDELANDE, fokus: true });
    expect(ram.hasAttribute("data-html-fokus")).toBe(true);
    expect(ram.className).toMatch(/outline-accent/);
    await fran(fonster, { typ: HTML_FOKUSMEDDELANDE, fokus: false });
    expect(ram.hasAttribute("data-html-fokus")).toBe(false);
    expect(ram.className).not.toMatch(/outline-accent/);
  });
});
