import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsPdfVy } from "../components/OpsPdfVy.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import {
  PDF_ZOOM_MAX,
  PDF_ZOOM_MIN,
  PIXELTAK,
  RITA_OM_MS,
  arDubbeltryck,
  dubbeltryckZoom,
  forankradRullning,
  hjulZoom,
  klampZoom,
  nypZoom,
  ritmatt,
  stegaZoom,
  svepTillats,
} from "../lib/pdfzoom.js";

/*
 * Zoomen i PDF-vyn (0.235.0). CP 2026-11-16: "Det går inte att zooma i pdf:er i biblioteket. Det vore bra om det funkade." och "Ja kör zoom på pdf".
 *
 * pdf.js är ersatt med en atrapp, som i `pdfvisning.test.jsx`, men den här minns varje ritning: skalan, canvasens storlek, om den avbröts och om den hann lägga sig innan nästa började.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4), utfallen står i PR-texten: före 0.235.0 hade raden − och + med HTML-rutans gränser (10 till 200 procent av tryckt storlek), inget dubbeltryck, ingen nypning, inget Ctrl+hjul,
 * svepet bytte sida också inzoomat (det fanns ingen zoom i helskärmen), omritningen startade vid varje ändring utan att vänta, och canvasen hade inget tak.
 */

const pdfjs = vi.hoisted(() => {
  /** @type {{ antal: number, hang: boolean, avbrottMs: number, ritningar: Array<{ nr: number, skala: number, bredd: number, hojd: number, transform: unknown, avbruten: boolean, lagd: boolean, pagaendeVidStart: number }>, getDocument: any, GlobalWorkerOptions: { workerSrc: string } }} */
  const s = { antal: 1, hang: false, avbrottMs: 0, ritningar: [], getDocument: null, GlobalWorkerOptions: { workerSrc: "" } };
  s.getDocument = (/** @type {any} */ _val) => {
    const dokument = {
      numPages: s.antal,
      getPage: async (/** @type {number} */ nr) => ({
        getViewport: ({ scale }) => ({ scale, width: 612 * scale, height: 792 * scale }),
        render: (/** @type {any} */ { canvas, viewport, transform }) => {
          const pagaendeVidStart = s.ritningar.filter((r) => r.nr === nr && !r.lagd).length;
          const post = { nr, skala: viewport.scale, bredd: canvas.width, hojd: canvas.height, transform, avbruten: false, lagd: false, pagaendeVidStart };
          s.ritningar.push(post);
          /** @type {(e: unknown) => void} */
          let avvisa = () => {};
          const promise = new Promise((resolve, reject) => {
            avvisa = reject;
            if (!s.hang) {
              post.lagd = true;
              resolve(undefined);
            }
          });
          return {
            promise,
            cancel() {
              if (post.lagd) return;
              post.avbruten = true;
              // pdf.js lägger sig inte i samma ögonblick som den avbryts: den avvisar löftet en stund senare.
              setTimeout(() => {
                post.lagd = true;
                avvisa(Object.assign(new Error("avbruten"), { name: "RenderingCancelledException" }));
              }, s.avbrottMs);
            },
          };
        },
      }),
    };
    return { promise: Promise.resolve(dokument), destroy() {} };
  };
  return s;
});

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: (/** @type {any} */ v) => pdfjs.getDocument(v),
  GlobalWorkerOptions: pdfjs.GlobalWorkerOptions,
}));

const ursprungligDpr = window.devicePixelRatio;
beforeEach(() => {
  pdfjs.antal = 1;
  pdfjs.hang = false;
  pdfjs.avbrottMs = 0;
  pdfjs.ritningar = [];
});
afterEach(() => {
  Object.defineProperty(window, "devicePixelRatio", { value: ursprungligDpr, configurable: true, writable: true });
  vi.restoreAllMocks();
});

const pdfBlob = () => new Blob(["%PDF-1.7 atrapp"], { type: "application/pdf" });
const vanta = (/** @type {number} */ ms) => act(() => new Promise((r) => setTimeout(r, ms)));

async function visaVyn() {
  render(<OpsPdfVy hamta={async () => pdfBlob()} sokvag="grupper/g/bibliotek/p/kvartal.pdf" namn="kvartal.pdf" />);
  await waitFor(() => expect(pdfjs.ritningar.length).toBeGreaterThanOrEqual(1));
  return /** @type {HTMLElement} */ (document.querySelector("[data-pdf-sidor]"));
}
const zoomen = (/** @type {Element | null} */ el) => Number(el?.getAttribute("data-pdf-zoom"));
const rad = () => /** @type {HTMLElement} */ (document.querySelector("[data-pdf-rad]"));
const tryck = (/** @type {Element} */ el, x = 100, y = 100) => {
  fireEvent.touchStart(el, { touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] });
  fireEvent.touchEnd(el, { touches: [], changedTouches: [{ clientX: x, clientY: y }] });
};

describe("reglerna för zoomen (lib/pdfzoom.js)", () => {
  it("⛔ gränserna 1x och 4x håller: knapparnas steg, nypningen, hjulet och ett tal som inte är ett tal", () => {
    expect(klampZoom(0.2)).toBe(PDF_ZOOM_MIN);
    expect(klampZoom(9)).toBe(PDF_ZOOM_MAX);
    expect(klampZoom(Number.NaN)).toBe(PDF_ZOOM_MIN);
    expect(stegaZoom(1, -1)).toBe(1);
    expect(stegaZoom(1, 1)).toBe(1.25);
    expect(stegaZoom(1.3, 1)).toBe(1.5);
    expect(stegaZoom(1.3, -1)).toBe(1.25);
    expect(stegaZoom(4, 1)).toBe(4);
    expect(nypZoom(1, 100, 250)).toBe(2.5);
    expect(nypZoom(2, 100, 1000)).toBe(4);
    expect(nypZoom(2, 100, 10)).toBe(1);
    expect(nypZoom(2, 0, 10)).toBe(2);
  });
  it("hjulet zoomar bara med Ctrl eller Cmd, uppåt förstorar", () => {
    expect(hjulZoom(1, { deltaY: -100 })).toBeNull();
    expect(hjulZoom(1, { deltaY: -100, ctrlKey: true })).toBeCloseTo(1.1);
    expect(hjulZoom(2, { deltaY: 100, metaKey: true })).toBeCloseTo(2 / 1.1);
    expect(hjulZoom(1, { deltaY: 100, ctrlKey: true })).toBe(1);
  });
  it("dubbeltrycket växlar mellan hel bredd och 2x, och två tryck är ett dubbeltryck bara nära varandra i tid och rum", () => {
    expect(dubbeltryckZoom(1)).toBe(2);
    expect(dubbeltryckZoom(2)).toBe(1);
    expect(dubbeltryckZoom(3.5)).toBe(1);
    expect(arDubbeltryck(null, { t: 0, x: 0, y: 0 })).toBe(false);
    expect(arDubbeltryck({ t: 0, x: 0, y: 0 }, { t: 200, x: 10, y: 10 })).toBe(true);
    expect(arDubbeltryck({ t: 0, x: 0, y: 0 }, { t: 400, x: 0, y: 0 })).toBe(false);
    expect(arDubbeltryck({ t: 0, x: 0, y: 0 }, { t: 100, x: 80, y: 0 })).toBe(false);
  });
  it("svepet tillåts bara vid hel bredd, och punkten under fingrarna står kvar", () => {
    expect(svepTillats(1)).toBe(true);
    expect(svepTillats(1.25)).toBe(false);
    // Punkten 100 px in med rullningen 0: vid dubbel zoom ligger den 200 px in, så rullningen blir 100.
    expect(forankradRullning(0, 100, 1, 2)).toBe(100);
    expect(forankradRullning(100, 100, 2, 1)).toBe(0);
  });
  it("⛔ taket för pixlar: 4x på en A4 i skärmens upplösning 3 blir inte större än taket, och under taket ritas i skärmens upplösning", () => {
    const stor = ritmatt(816 * 4, 1056 * 4, 3);
    expect(stor.bredd * stor.hojd).toBeLessThanOrEqual(PIXELTAK);
    expect(stor.bredd * stor.hojd).toBeGreaterThan(PIXELTAK * 0.99);
    expect(stor.k).toBeLessThan(3);
    const liten = ritmatt(816, 1056, 2);
    expect(liten).toEqual({ bredd: 1632, hojd: 2112, k: 2 });
  });
});

describe("zoomen i vyn: knapparna", () => {
  it("⛔ −, + och Anpassa till bredd ändrar zoomen, procenten visas, och gränserna 100 och 400 procent håller", async () => {
    const sidor = await visaVyn();
    const r = within(rad());
    expect(zoomen(sidor)).toBe(1);
    expect(r.getByRole("button", { name: "Zooma ut" }).hasAttribute("disabled")).toBe(true);
    expect(r.getByRole("button", { name: /^100\s%, anpassad till bredd$/ })).toBeTruthy();
    fireEvent.click(r.getByRole("button", { name: "Zooma in" }));
    expect(zoomen(sidor)).toBe(1.25);
    expect(rad().querySelector("[data-html-zoom-procent]")?.textContent?.replace(/\s/g, " ")).toBe("125 %");
    for (let i = 0; i < 20; i++) fireEvent.click(r.getByRole("button", { name: "Zooma in" }));
    expect(zoomen(sidor)).toBe(4);
    expect(r.getByRole("button", { name: "Zooma in" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(r.getByRole("button", { name: /Anpassa till bredd/ }));
    expect(zoomen(sidor)).toBe(1);
  });
  it("knapparna har namn på engelska också", async () => {
    render(
      <OpsSprakProvider sprak="en">
        <OpsPdfVy hamta={async () => pdfBlob()} sokvag="s" namn="kvartal.pdf" />
      </OpsSprakProvider>,
    );
    await waitFor(() => expect(pdfjs.ritningar.length).toBeGreaterThanOrEqual(1));
    const r = within(rad());
    expect(r.getByRole("button", { name: "Zoom out" })).toBeTruthy();
    expect(r.getByRole("button", { name: "Zoom in" })).toBeTruthy();
    expect(r.getByRole("button", { name: /^100\s?%, fitted to width$/ })).toBeTruthy();
  });
});

describe("zoomen i vyn: telefonen och hjulet", () => {
  it("⛔ dubbeltrycket växlar mellan hel bredd och 2x", async () => {
    const sidor = await visaVyn();
    tryck(sidor);
    tryck(sidor);
    expect(zoomen(sidor)).toBe(2);
    tryck(sidor);
    tryck(sidor);
    expect(zoomen(sidor)).toBe(1);
  });
  it("ett tryck, ett drag eller två tryck för långt isär är inget dubbeltryck", async () => {
    const sidor = await visaVyn();
    tryck(sidor, 100, 100);
    tryck(sidor, 300, 100);
    expect(zoomen(sidor)).toBe(1);
    fireEvent.touchStart(sidor, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(sidor, { touches: [{ clientX: 100, clientY: 160 }] });
    fireEvent.touchEnd(sidor, { touches: [], changedTouches: [{ clientX: 100, clientY: 160 }] });
    tryck(sidor, 100, 160);
    expect(zoomen(sidor)).toBe(1);
  });
  it("⛔ nypningen följer fingrarna inom 1x och 4x, och stoppar telefonens egen zoom av appen", async () => {
    const sidor = await visaVyn();
    fireEvent.touchStart(sidor, { touches: [{ clientX: 100, clientY: 100 }, { clientX: 200, clientY: 100 }] });
    const flytt = new Event("touchmove", { bubbles: true, cancelable: true });
    Object.assign(flytt, { touches: [{ clientX: 50, clientY: 100 }, { clientX: 300, clientY: 100 }] });
    act(() => void sidor.dispatchEvent(flytt));
    expect(flytt.defaultPrevented).toBe(true);
    expect(zoomen(sidor)).toBe(2.5);
    fireEvent.touchMove(sidor, { touches: [{ clientX: 0, clientY: 100 }, { clientX: 2000, clientY: 100 }] });
    expect(zoomen(sidor)).toBe(4);
    fireEvent.touchMove(sidor, { touches: [{ clientX: 140, clientY: 100 }, { clientX: 150, clientY: 100 }] });
    expect(zoomen(sidor)).toBe(1);
    fireEvent.touchEnd(sidor, { touches: [], changedTouches: [{ clientX: 150, clientY: 100 }] });
    expect(sidor.style.touchAction).toBe("pan-x pan-y");
  });
  it("⛔ Ctrl+hjul zoomar, hjul utan Ctrl rullar som förut", async () => {
    const sidor = await visaVyn();
    const utan = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
    act(() => void sidor.dispatchEvent(utan));
    expect(utan.defaultPrevented).toBe(false);
    expect(zoomen(sidor)).toBe(1);
    const med = new WheelEvent("wheel", { deltaY: -300, ctrlKey: true, bubbles: true, cancelable: true });
    act(() => void sidor.dispatchEvent(med));
    expect(med.defaultPrevented).toBe(true);
    expect(zoomen(sidor)).toBeCloseTo(1.331, 3);
    fireEvent.wheel(sidor, { deltaY: 300, metaKey: true });
    expect(zoomen(sidor)).toBeCloseTo(1, 6);
  });
});

describe("omritningen och taket", () => {
  it("⛔ under zoomen ritas inget om. När zoomen stått still ritas sidan i den nya skalan, den pågående ritningen avbryts, och nästa börjar först när den avbrutna lagt sig", async () => {
    pdfjs.hang = true;
    pdfjs.avbrottMs = 40;
    const sidor = await visaVyn();
    const forsta = pdfjs.ritningar[0];
    const r = within(rad());
    fireEvent.click(r.getByRole("button", { name: "Zooma in" }));
    fireEvent.click(r.getByRole("button", { name: "Zooma in" }));
    expect(zoomen(sidor)).toBe(1.5);
    await vanta(RITA_OM_MS / 2);
    expect(pdfjs.ritningar).toHaveLength(1);
    await waitFor(() => expect(pdfjs.ritningar).toHaveLength(2));
    const andra = pdfjs.ritningar[1];
    expect(forsta.avbruten).toBe(true);
    expect(andra.pagaendeVidStart).toBe(0);
    expect(andra.skala / forsta.skala).toBeCloseTo(1.5);
    // Ramen har redan zoomens storlek: den ritade bilden sträcks tills omritningen är klar.
    const ram = /** @type {HTMLElement} */ (document.querySelector("[data-pdf-sida-canvas]"));
    expect(parseFloat(ram.style.width)).toBe(Math.floor(612 * (96 / 72) * 1.5));
  });
  it("⛔ 4x i skärmens upplösning 3 ger ingen canvas över taket", async () => {
    Object.defineProperty(window, "devicePixelRatio", { value: 3, configurable: true, writable: true });
    await visaVyn();
    const r = within(rad());
    for (let i = 0; i < 12; i++) fireEvent.click(r.getByRole("button", { name: "Zooma in" }));
    await waitFor(() => expect(pdfjs.ritningar.at(-1)?.skala).toBeCloseTo((96 / 72) * 4));
    const sista = /** @type {any} */ (pdfjs.ritningar.at(-1));
    expect(sista.bredd * sista.hojd).toBeLessThanOrEqual(PIXELTAK);
    expect(sista.bredd * sista.hojd).toBeGreaterThan(PIXELTAK * 0.99);
  });
});

describe("helskärmen: svepet och zoomen", () => {
  async function helskarm() {
    pdfjs.antal = 3;
    await visaVyn();
    fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    return /** @type {HTMLElement} */ (document.querySelector("[data-pdf-presentationsyta]"));
  }
  const visadSida = () => document.querySelector("[data-pdf-presentationssida]")?.getAttribute("data-pdf-presentationssida");
  const svep = (/** @type {Element} */ el, fran = 500, till = 300) => {
    fireEvent.touchStart(el, { touches: [{ clientX: fran, clientY: 300 }] });
    fireEvent.touchMove(el, { touches: [{ clientX: till, clientY: 305 }] });
    fireEvent.touchEnd(el, { touches: [], changedTouches: [{ clientX: till, clientY: 305 }] });
  };

  it("⛔ svepet byter sida vid hel sida, men inte när sidan är inzoomad. Dubbeltrycket går tillbaka, och då byter svepet sida igen", async () => {
    const yta = await helskarm();
    svep(yta);
    expect(visadSida()).toBe("2");
    tryck(yta);
    tryck(yta);
    expect(zoomen(yta)).toBe(2);
    svep(yta);
    expect(visadSida()).toBe("2");
    tryck(yta);
    tryck(yta);
    expect(zoomen(yta)).toBe(1);
    svep(yta);
    expect(visadSida()).toBe("3");
  });
  it("ett ensamt tryck byter sida först när inget andra tryck kom, och dubbeltrycket byter aldrig sida", async () => {
    const yta = await helskarm();
    tryck(yta, 600, 300);
    // Webbläsarens klick efter trycket räknas inte en gång till.
    fireEvent.click(yta, { clientX: 600, clientY: 300 });
    expect(visadSida()).toBe("1");
    await waitFor(() => expect(visadSida()).toBe("2"));
    tryck(yta, 600, 300);
    tryck(yta, 600, 300);
    await vanta(400);
    expect(visadSida()).toBe("2");
    expect(zoomen(yta)).toBe(2);
  });
  it("en ny sida börjar anpassad till skärmen", async () => {
    const yta = await helskarm();
    fireEvent.wheel(yta, { deltaY: -500, ctrlKey: true });
    expect(zoomen(yta)).toBeGreaterThan(1);
    act(() => void fireEvent.keyDown(document, { key: "ArrowRight" }));
    expect(visadSida()).toBe("2");
    expect(zoomen(/** @type {Element} */ (document.querySelector("[data-pdf-presentationsyta]")))).toBe(1);
  });
});
