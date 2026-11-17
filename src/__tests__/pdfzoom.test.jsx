import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsPdfVy } from "../components/OpsPdfVy.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import {
  PDF_ZOOM_MAX,
  PDF_ZOOM_MIN,
  PIXELBUDGET,
  PIXELTAK,
  RITA_OM_MS,
  RITA_TIDSGRANS_MS,
  arDubbeltryck,
  dubbeltryckZoom,
  forankradRullning,
  hjulZoom,
  klampZoom,
  nypZoom,
  ritmatt,
  skapaCanvasbudget,
  skapaRitko,
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
  /** @type {{ antal: number, hang: boolean, avbrottMs: number, ritMs: number, samtidigt: number, flestSamtidigt: number, sidmatt: { b: number, h: number }, viewportFelOver: number, viewportFelSida: number, vidRitning: null | ((nr: number) => void), ritningar: Array<{ nr: number, skala: number, bredd: number, hojd: number, transform: unknown, avbruten: boolean, lagd: boolean, pagaendeVidStart: number }>, getDocument: any, GlobalWorkerOptions: { workerSrc: string } }} */
  const s = { antal: 1, hang: false, avbrottMs: 0, ritMs: 0, samtidigt: 0, flestSamtidigt: 0, sidmatt: { b: 612, h: 792 }, viewportFelOver: Infinity, viewportFelSida: 0, vidRitning: null, ritningar: [], getDocument: null, GlobalWorkerOptions: { workerSrc: "" } };
  s.getDocument = (/** @type {any} */ _val) => {
    // Måtten läses när dokumentet öppnas, så att två dokument i samma prov kan skilja sig.
    const { b, h } = s.sidmatt;
    const dokument = {
      numPages: s.antal,
      getPage: async (/** @type {number} */ nr) => ({
        getViewport: ({ scale }) => {
          if (scale > s.viewportFelOver || nr === s.viewportFelSida) throw new Error("trasig sida");
          return { scale, width: b * scale, height: h * scale };
        },
        render: (/** @type {any} */ { canvas, viewport, transform }) => {
          s.vidRitning?.(nr);
          const pagaendeVidStart = s.ritningar.filter((r) => r.nr === nr && !r.lagd).length;
          const post = { nr, skala: viewport.scale, bredd: canvas.width, hojd: canvas.height, transform, avbruten: false, lagd: false, pagaendeVidStart };
          s.ritningar.push(post);
          s.samtidigt += 1;
          s.flestSamtidigt = Math.max(s.flestSamtidigt, s.samtidigt);
          /** @type {(e: unknown) => void} */
          let avvisa = () => {};
          const promise = new Promise((resolve, reject) => {
            avvisa = reject;
            if (!s.hang) {
              const klar = () => {
                if (post.lagd) return;
                post.lagd = true;
                resolve(undefined);
              };
              if (s.ritMs > 0) setTimeout(klar, s.ritMs);
              else klar();
            }
          });
          promise.then(
            () => (s.samtidigt -= 1),
            () => (s.samtidigt -= 1),
          );
          return {
            promise,
            cancel() {
              if (post.lagd) return;
              post.avbruten = true;
              // pdf.js lägger sig inte i samma ögonblick som den avbryts: den avvisar löftet en stund senare.
              setTimeout(() => {
                if (post.lagd) return;
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
  pdfjs.ritMs = 0;
  pdfjs.sidmatt = { b: 612, h: 792 };
  pdfjs.viewportFelOver = Infinity;
  pdfjs.viewportFelSida = 0;
  pdfjs.vidRitning = null;
  pdfjs.samtidigt = 0;
  pdfjs.flestSamtidigt = 0;
  pdfjs.ritningar = [];
});
afterEach(() => {
  Object.defineProperty(window, "devicePixelRatio", { value: ursprungligDpr, configurable: true, writable: true });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

/*
 * ══ Granskningen av 0.235.0 ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4), mot commit 6a436cd (den första versionen av zoomen): en sida som en gång visats behöll sin canvas och ritades om efter
 * zoomen, alla samtidigt; ankaret räknade som om innehållet skalade från rutans övre vänstra hörn; Safaris `gesturechange` stoppades men räknades inte; zoomen
 * i den rullande vyn stod kvar efter helskärmen; fokus föll till <body> när + eller − stängdes av vid gränsen.
 */

/** En `IntersectionObserver` där provet säger vilka sidor som är nära vyn. Den andra observatören (mitten, `-50%`) får inget. */
class FalskIO {
  /** @type {FalskIO[]} */
  static alla = [];
  /** @param {(p: Array<{ isIntersecting: boolean, target: Element }>) => void} cb @param {{ rootMargin?: string }} [val] */
  constructor(cb, val) {
    this.cb = cb;
    this.val = val ?? {};
    /** @type {Set<Element>} */
    this.mal = new Set();
    FalskIO.alla.push(this);
  }
  /** @param {Element} el */
  observe(el) {
    this.mal.add(el);
  }
  unobserve(/** @type {Element} */ el) {
    this.mal.delete(el);
  }
  disconnect() {
    this.mal.clear();
    FalskIO.alla = FalskIO.alla.filter((o) => o !== this);
  }
}
/** Sidorna `nr` är nära vyn, alla andra inte. @param {number[]} nr */
function naraSidor(nr) {
  act(() => {
    for (const o of [...FalskIO.alla]) {
      // Den första observatören (nära vyn) har en positiv marginal, mittens är negativ.
      if (!o.val.rootMargin || o.val.rootMargin.startsWith("-")) continue;
      for (const el of [...o.mal]) o.cb([{ isIntersecting: nr.includes(Number(el.getAttribute("data-pdf-sidram"))), target: el }]);
    }
  });
}

describe("⛔ minnet: bara sidor nära vyn har en canvas, och ritningarna köas", () => {
  it("20 sidor: rulla genom alla och zooma till 4x. Bara sidorna nära vyn har en canvas, den summerade ytan håller sig under taket, och en sida som lämnat vyn har släppt sin", async () => {
    FalskIO.alla = [];
    vi.stubGlobal("IntersectionObserver", FalskIO);
    pdfjs.antal = 20;
    /** @type {HTMLCanvasElement[]} */
    const skapade = [];
    const skapa = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((/** @type {string} */ namn, /** @type {any} */ val) => {
      const el = skapa(namn, val);
      if (namn === "canvas") skapade.push(/** @type {HTMLCanvasElement} */ (el));
      return el;
    });
    render(<OpsPdfVy hamta={async () => pdfBlob()} sokvag="s" namn="kvartal.pdf" />);
    await waitFor(() => expect(document.querySelectorAll("[data-pdf-sidram]")).toHaveLength(20));
    // Golv: ingen sida är ritad innan observatören sagt något.
    expect(document.querySelectorAll("[data-pdf-sida-canvas]")).toHaveLength(0);
    for (let n = 1; n <= 20; n++) {
      naraSidor([n - 1, n, n + 1]);
      await waitFor(() => expect(document.querySelectorAll(`[data-pdf-canvas="${n}"]`)).toHaveLength(1));
    }
    // Golv: varje sida har ritats en gång.
    expect(new Set(pdfjs.ritningar.map((r) => r.nr)).size).toBe(20);
    const r = within(rad());
    for (let i = 0; i < 12; i++) fireEvent.click(r.getByRole("button", { name: "Zooma in" }));
    const fyra = (96 / 72) * 4;
    await waitFor(() => expect(pdfjs.ritningar.filter((x) => Math.abs(x.skala - fyra) < 1e-6).map((x) => x.nr).sort()).toEqual([19, 20]));
    await vanta(50);
    const levande = skapade.filter((c) => c.width * c.height > 1);
    const zoomade = levande.filter((c) => c.width >= 3000);
    expect(zoomade.length).toBeLessThanOrEqual(3);
    expect(levande.length).toBeLessThanOrEqual(3);
    expect(levande.reduce((sum, c) => sum + c.width * c.height, 0)).toBeLessThanOrEqual(3 * PIXELTAK);
    // Sidan 1 lämnade vyn för länge sedan: platshållare i sin storlek, ingen canvas.
    const forsta = /** @type {HTMLElement} */ (document.querySelector('[data-pdf-sidram="1"]'));
    expect(forsta.querySelector("canvas")).toBeNull();
    expect(parseFloat(forsta.style.height)).toBe(Math.floor(792 * (96 / 72) * 4));
  });
  it("⛔ omritningarna efter en zoom körs en i taget, aldrig samtidigt", async () => {
    pdfjs.antal = 4;
    pdfjs.ritMs = 15;
    await visaVyn();
    await waitFor(() => expect(pdfjs.ritningar.filter((x) => x.lagd)).toHaveLength(4));
    fireEvent.click(within(rad()).getByRole("button", { name: "Zooma in" }));
    await waitFor(() => expect(pdfjs.ritningar.filter((x) => x.lagd)).toHaveLength(8), { timeout: 2000 });
    expect(pdfjs.flestSamtidigt).toBe(1);
  });
});

/**
 * Rutornas lägen som i webbläsaren, för ankaret (jsdom har ingen layout). Modellen följer klasserna i `OpsPdfVisning`: i den rullande vyn står sidorna i en kolumn
 * med `kant` runt och 12 px mellan, centrerade i den bredaste sidans bredd. I helskärmen är sidan centrerad i båda led så länge den ryms. Storleken läses ur sidans `style`.
 * @param {number} W @param {number} H
 */
function layoutmodell(W, H) {
  const px = (/** @type {string} */ v) => parseFloat(v) || 0;
  const storlek = (/** @type {HTMLElement} */ el) => {
    if (el.style.width) return { w: px(el.style.width), h: px(el.style.height) };
    const b = /** @type {HTMLElement | null} */ (el.querySelector("[role=img]"));
    return b ? { w: px(b.style.width), h: px(b.style.height) } : { w: 0, h: 0 };
  };
  const rekt = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ h) => /** @type {DOMRect} */ ({ left: x, top: y, x, y, width: w, height: h, right: x + w, bottom: y + h, toJSON() {} });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function () {
    const el = /** @type {HTMLElement} */ (this);
    if (el.matches("[data-pdf-sidor], [data-pdf-presentationsyta], [data-pdf-presentation]")) return rekt(0, 0, W, H);
    const sidor = /** @type {HTMLElement | null} */ (el.closest("[data-pdf-sidor]"));
    if (sidor && el.matches("[data-pdf-sidram]")) {
      const kant = px(sidor.style.padding);
      const alla = /** @type {HTMLElement[]} */ ([...sidor.querySelectorAll("[data-pdf-sidram]")]);
      const inre = Math.max(W - 2 * kant, ...alla.map((e) => storlek(e).w));
      let y = kant;
      for (const e of alla) {
        const s = storlek(e);
        if (e === el) return rekt(kant + (inre - s.w) / 2 - sidor.scrollLeft, y - sidor.scrollTop, s.w, s.h);
        y += s.h + 12;
      }
    }
    const pres = /** @type {HTMLElement | null} */ (el.closest("[data-pdf-presentationsyta]"));
    if (pres && el.matches("[data-pdf-presentationssida]")) {
      const s = storlek(el);
      return rekt(Math.max(0, (W - s.w) / 2) - pres.scrollLeft, Math.max(0, (H - s.h) / 2) - pres.scrollTop, s.w, s.h);
    }
    return rekt(0, 0, 0, 0);
  });
  const mattet = (/** @type {"clientWidth" | "clientHeight"} */ namn, /** @type {number} */ v) =>
    vi.spyOn(HTMLElement.prototype, namn, "get").mockImplementation(function () {
      return /** @type {HTMLElement} */ (this).matches("[data-pdf-sidor], [data-pdf-presentationsyta], [data-pdf-presentation]") ? v : 0;
    });
  mattet("clientWidth", W);
  mattet("clientHeight", H);
}

/** Var andelen av sidan ligger nu. @param {Element} sida @param {{ fx: number, fy: number }} a */
const lage = (sida, a) => {
  const r = sida.getBoundingClientRect();
  return { x: r.left + a.fx * r.width, y: r.top + a.fy * r.height };
};
/** @param {Element} sida @param {{ x: number, y: number }} p */
const andel = (sida, p) => {
  const r = sida.getBoundingClientRect();
  return { fx: (p.x - r.left) / r.width, fy: (p.y - r.top) / r.height };
};

describe("⛔ ankaret: punkten under fingret står kvar, mätt i sidan", () => {
  it("den rullande vyn: en punkt på sida 5 ligger kvar under pekaren efter Ctrl+hjul, och efter en nypning", async () => {
    layoutmodell(390, 700);
    pdfjs.antal = 8;
    await visaVyn();
    const sidor = /** @type {HTMLElement} */ (document.querySelector("[data-pdf-sidor]"));
    const sida5 = /** @type {HTMLElement} */ (document.querySelector('[data-pdf-sidram="5"]'));
    // Golv: modellen ger sidan en storlek, och sida 5 står under punkten.
    await waitFor(() => expect(sida5.getBoundingClientRect().height).toBeGreaterThan(400));
    sidor.scrollTop = sida5.getBoundingClientRect().top + sidor.scrollTop - 150;
    const punkt = { x: 200, y: 300 };
    const r0 = sida5.getBoundingClientRect();
    expect(r0.top <= punkt.y && punkt.y <= r0.bottom).toBe(true);
    const a = andel(sida5, punkt);
    act(() => void sidor.dispatchEvent(new WheelEvent("wheel", { deltaY: -300, ctrlKey: true, clientX: punkt.x, clientY: punkt.y, bubbles: true, cancelable: true })));
    expect(zoomen(sidor)).toBeCloseTo(1.331, 3);
    const efter = lage(sida5, a);
    expect(Math.abs(efter.x - punkt.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(efter.y - punkt.y)).toBeLessThanOrEqual(2);
    // Nypningen: mitten mellan fingrarna står kvar.
    const b = andel(sida5, { x: 150, y: 250 });
    fireEvent.touchStart(sidor, { touches: [{ clientX: 100, clientY: 250 }, { clientX: 200, clientY: 250 }] });
    fireEvent.touchMove(sidor, { touches: [{ clientX: 50, clientY: 250 }, { clientX: 250, clientY: 250 }] });
    fireEvent.touchEnd(sidor, { touches: [], changedTouches: [{ clientX: 250, clientY: 250 }] });
    expect(zoomen(sidor)).toBeCloseTo(2.662, 3);
    const efterNyp = lage(sida5, b);
    expect(Math.abs(efterNyp.x - 150)).toBeLessThanOrEqual(2);
    expect(Math.abs(efterNyp.y - 250)).toBeLessThanOrEqual(2);
  });
  it("helskärmen: en punkt på den centrerade sidan ligger kvar under pekaren efter Ctrl+hjul", async () => {
    layoutmodell(1024, 768);
    pdfjs.antal = 3;
    await visaVyn();
    fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    const yta = /** @type {HTMLElement} */ (document.querySelector("[data-pdf-presentationsyta]"));
    const sida = /** @type {HTMLElement} */ (document.querySelector("[data-pdf-presentationssida]"));
    await waitFor(() => expect(sida.getBoundingClientRect().width).toBeGreaterThan(500));
    // Golv: sidan är centrerad, alltså inte i rutans hörn.
    expect(sida.getBoundingClientRect().left).toBeGreaterThan(100);
    const punkt = { x: 400, y: 300 };
    const a = andel(sida, punkt);
    // Så långt in att sidan blir bredare och högre än skärmen: medan den är smalare står den centrerad, och då finns ingen rullning att lägga punkten med.
    act(() => void yta.dispatchEvent(new WheelEvent("wheel", { deltaY: -1000, ctrlKey: true, clientX: punkt.x, clientY: punkt.y, bubbles: true, cancelable: true })));
    expect(zoomen(yta)).toBeCloseTo(Math.pow(1.1, 10), 3);
    expect(sida.getBoundingClientRect().width).toBeGreaterThan(1024);
    const efter = lage(sida, a);
    expect(Math.abs(efter.x - punkt.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(efter.y - punkt.y)).toBeLessThanOrEqual(2);
  });
});

describe("⛔ Safari: nypningen med styrplattan på en Mac kommer som gesture-händelser", () => {
  const gest = (/** @type {Element} */ el, /** @type {string} */ typ, /** @type {Record<string, number>} */ extra = {}) => {
    const e = new Event(typ, { bubbles: true, cancelable: true });
    Object.assign(e, extra);
    act(() => void el.dispatchEvent(e));
    return e;
  };
  it("gesturechange zoomar ur scale, från zoomen när gesten började, och stoppar Safaris egen zoom", async () => {
    const sidor = await visaVyn();
    gest(sidor, "gesturestart", { scale: 1, clientX: 100, clientY: 100 });
    const andra = gest(sidor, "gesturechange", { scale: 1.5, clientX: 100, clientY: 100 });
    expect(andra.defaultPrevented).toBe(true);
    expect(zoomen(sidor)).toBe(1.5);
    gest(sidor, "gesturechange", { scale: 2.5, clientX: 100, clientY: 100 });
    expect(zoomen(sidor)).toBe(2.5);
    gest(sidor, "gesturechange", { scale: 9, clientX: 100, clientY: 100 });
    expect(zoomen(sidor)).toBe(4);
    gest(sidor, "gestureend", { scale: 9 });
    gest(sidor, "gesturestart", { scale: 1 });
    gest(sidor, "gesturechange", { scale: 0.5 });
    expect(zoomen(sidor)).toBe(2);
  });
  it("på en iPhone räknas nypningen ur fingrarna, och samma gest som gesture-händelse räknas inte en gång till", async () => {
    const sidor = await visaVyn();
    fireEvent.touchStart(sidor, { touches: [{ clientX: 100, clientY: 100 }, { clientX: 200, clientY: 100 }] });
    gest(sidor, "gesturestart", { scale: 1 });
    gest(sidor, "gesturechange", { scale: 3 });
    expect(zoomen(sidor)).toBe(1);
    fireEvent.touchMove(sidor, { touches: [{ clientX: 50, clientY: 100 }, { clientX: 250, clientY: 100 }] });
    expect(zoomen(sidor)).toBe(2);
    fireEvent.touchEnd(sidor, { touches: [], changedTouches: [{ clientX: 250, clientY: 100 }] });
  });
});

describe("helskärmen och fokus", () => {
  it("⛔ när helskärmen stängs börjar den rullande vyn på hel bredd", async () => {
    pdfjs.antal = 3;
    const sidor = await visaVyn();
    fireEvent.click(within(rad()).getByRole("button", { name: "Zooma in" }));
    expect(zoomen(sidor)).toBe(1.25);
    fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    fireEvent.click(screen.getByRole("button", { name: "Stäng helskärm" }));
    await waitFor(() => expect(document.querySelector("[data-pdf-sidor]")).toBeTruthy());
    expect(zoomen(document.querySelector("[data-pdf-sidor]"))).toBe(1);
  });
  it("⛔ när + blir avstängd vid gränsen får − fokus, och tvärtom, i stället för att fokus faller till sidan", async () => {
    await visaVyn();
    const r = within(rad());
    const inKnapp = r.getByRole("button", { name: "Zooma in" });
    const utKnapp = r.getByRole("button", { name: "Zooma ut" });
    inKnapp.focus();
    for (let i = 0; i < 12; i++) fireEvent.click(inKnapp);
    expect(inKnapp.hasAttribute("disabled")).toBe(true);
    expect(document.activeElement).toBe(utKnapp);
    for (let i = 0; i < 12; i++) fireEvent.click(utKnapp);
    expect(utKnapp.hasAttribute("disabled")).toBe(true);
    expect(document.activeElement).toBe(inKnapp);
  });
});

/*
 * ══ Den andra granskningen av 0.235.0 ══════════════════════════════════════════════════════════════════════════════════════
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4), mot b08b94c: den gamla canvasen stod kvar medan den nya ritades, utan en gemensam budget; området nära vyn var en skärmhöjd oavsett zoom;
 * kön väntade för evigt på en ritning som aldrig svarade; ett fel i måtten före ritningen blev ett ohanterat avvisat löfte och ingen felrad; platshållarna behöll det förra dokumentets storlek.
 */

describe("⛔ minnesbudgeten gäller också medan en sida ritas om", () => {
  it("20 sidor i skärmens upplösning 3: under varje ritning, också omritningen vid 4x, är summan av levande canvasar inom budgeten", async () => {
    FalskIO.alla = [];
    vi.stubGlobal("IntersectionObserver", FalskIO);
    Object.defineProperty(window, "devicePixelRatio", { value: 3, configurable: true, writable: true });
    pdfjs.antal = 20;
    /** @type {HTMLCanvasElement[]} */
    const skapade = [];
    const skapa = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((/** @type {string} */ namn, /** @type {any} */ val) => {
      const el = skapa(namn, val);
      if (namn === "canvas") skapade.push(/** @type {HTMLCanvasElement} */ (el));
      return el;
    });
    const levandeYta = () => skapade.reduce((sum, c) => sum + (c.width * c.height > 1 ? c.width * c.height : 0), 0);
    /** @type {number[]} */
    const underRitning = [];
    pdfjs.vidRitning = () => underRitning.push(levandeYta());
    render(<OpsPdfVy hamta={async () => pdfBlob()} sokvag="s" namn="kvartal.pdf" />);
    await waitFor(() => expect(document.querySelectorAll("[data-pdf-sidram]")).toHaveLength(20));
    naraSidor([9, 10, 11]);
    await waitFor(() => expect(document.querySelectorAll("[data-pdf-canvas]")).toHaveLength(3));
    const r = within(rad());
    for (let i = 0; i < 12; i++) fireEvent.click(r.getByRole("button", { name: "Zooma in" }));
    const fyra = (96 / 72) * 4;
    await waitFor(() => expect(pdfjs.ritningar.filter((x) => Math.abs(x.skala - fyra) < 1e-6).map((x) => x.nr).sort((a, b) => a - b)).toEqual([9, 10, 11]));
    await waitFor(() => expect(document.querySelectorAll("[data-pdf-canvas]")).toHaveLength(3));
    // Golv: mätningen gjordes under minst sex ritningar, och omritningarna vid 4x hade fyllt budgeten utan den.
    expect(underRitning.length).toBeGreaterThanOrEqual(6);
    expect(Math.max(...underRitning)).toBeLessThanOrEqual(PIXELBUDGET);
    expect(levandeYta()).toBeLessThanOrEqual(PIXELBUDGET);
    expect(Math.max(...pdfjs.ritningar.filter((x) => Math.abs(x.skala - fyra) < 1e-6).map((x) => x.bredd * x.hojd))).toBeGreaterThan(PIXELBUDGET / 5);
  });
  it("budgeten i sig: taket delas med sidorna plus en, och en släppt canvas räknas bort", () => {
    const b = skapaCanvasbudget({ budget: 1000 });
    expect(b.tak()).toBe(500);
    const av = [b.registrera(), b.registrera(), b.registrera()];
    expect(b.tak()).toBe(250);
    const c = document.createElement("canvas");
    c.width = 20;
    c.height = 10;
    b.lagg(c);
    expect(b.ledigt()).toBe(800);
    b.slapp(c);
    expect([c.width, c.height, b.ledigt()]).toEqual([0, 0, 1000]);
    av.forEach((f) => f());
    av[0]();
    expect(b.sidor).toBe(0);
  });
});

describe("⛔ området nära vyn följer zoomen, och sidan under pekaren ritas först", () => {
  it("tre skärmhöjder vid hel bredd, en vid 2x", async () => {
    FalskIO.alla = [];
    vi.stubGlobal("IntersectionObserver", FalskIO);
    pdfjs.antal = 3;
    render(<OpsPdfVy hamta={async () => pdfBlob()} sokvag="s" namn="kvartal.pdf" />);
    await waitFor(() => expect(document.querySelectorAll("[data-pdf-sidram]")).toHaveLength(3));
    const marginaler = () => [...new Set(FalskIO.alla.map((o) => o.val.rootMargin).filter((m) => m && !m.startsWith("-")))];
    expect(marginaler()).toEqual(["300% 0px"]);
    for (let i = 0; i < 4; i++) fireEvent.click(within(rad()).getByRole("button", { name: "Zooma in" }));
    expect(marginaler()).toEqual(["100% 0px"]);
  });
  it("efter en zoom ritas sidan under pekaren först", async () => {
    layoutmodell(390, 700);
    pdfjs.antal = 5;
    await visaVyn();
    const sidor = /** @type {HTMLElement} */ (document.querySelector("[data-pdf-sidor]"));
    const sida4 = /** @type {HTMLElement} */ (document.querySelector('[data-pdf-sidram="4"]'));
    // Vänta tills alla fem är ritade i rutans bredd: måttet av rutan kan komma efter den första ritningen och ge en omritning till, beroende på hur fort maskinen är.
    const hel = (96 / 72) * ((390 - 24) / 816);
    await waitFor(() => {
      for (let nr = 1; nr <= 5; nr++) expect(pdfjs.ritningar.some((x) => x.nr === nr && x.lagd && Math.abs(x.skala - hel) < 1e-6)).toBe(true);
    });
    await vanta(50);
    sidor.scrollTop = sida4.getBoundingClientRect().top + sidor.scrollTop - 100;
    const fore = pdfjs.ritningar.length;
    act(() => void sidor.dispatchEvent(new WheelEvent("wheel", { deltaY: -300, ctrlKey: true, clientX: 200, clientY: 300, bubbles: true, cancelable: true })));
    await waitFor(() => expect(pdfjs.ritningar.length).toBeGreaterThanOrEqual(fore + 5));
    // Golv: den första omritningen är i den nya skalan, och den gäller sidan under pekaren.
    expect(pdfjs.ritningar[fore].skala / hel).toBeCloseTo(1.331, 3);
    expect(pdfjs.ritningar[fore].nr).toBe(4);
  });
});

describe("⛔ kön har en tidsgräns", () => {
  it("en ritning som aldrig svarar avbryts efter tidsgränsen, och nästa ritning körs", async () => {
    vi.useFakeTimers();
    try {
      const ko = skapaRitko();
      const avbruten = vi.fn();
      const andra = vi.fn(async () => {});
      ko.lagg(() => new Promise(() => {}), { onTidsgrans: avbruten });
      ko.lagg(andra);
      await vi.advanceTimersByTimeAsync(RITA_TIDSGRANS_MS - 1);
      expect([avbruten.mock.calls.length, andra.mock.calls.length]).toEqual([0, 0]);
      await vi.advanceTimersByTimeAsync(2);
      expect([avbruten.mock.calls.length, andra.mock.calls.length]).toEqual([1, 1]);
      expect(ko.antal).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it("i vyn: en sida vars ritning aldrig svarar får sin felrad efter tidsgränsen", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      pdfjs.hang = true;
      render(<OpsPdfVy hamta={async () => pdfBlob()} sokvag="s" namn="kvartal.pdf" />);
      await waitFor(() => expect(pdfjs.ritningar).toHaveLength(1));
      expect(document.querySelector("[data-pdf-sidfel]")).toBeNull();
      await act(() => vi.advanceTimersByTimeAsync(RITA_TIDSGRANS_MS + 10));
      expect(document.querySelector('[data-pdf-sidfel="1"]')?.getAttribute("role")).toBe("alert");
      expect(pdfjs.ritningar[0].avbruten).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("⛔ fel i måtten före ritningen syns (regel 5)", () => {
  it("getViewport kastar vid omritningen i 2x: sidan får sin felrad", async () => {
    pdfjs.viewportFelOver = 2;
    const sidor = await visaVyn();
    for (let i = 0; i < 4; i++) fireEvent.click(within(rad()).getByRole("button", { name: "Zooma in" }));
    expect(zoomen(sidor)).toBe(2);
    await waitFor(() => expect(document.querySelector('[data-pdf-sidfel="1"]')?.getAttribute("role")).toBe("alert"));
  });
  it("getViewport kastar redan för sidans storlek: felraden, inte en tom sida, och sidan före ritas", async () => {
    pdfjs.antal = 2;
    pdfjs.viewportFelSida = 2;
    render(<OpsPdfVy hamta={async () => pdfBlob()} sokvag="s" namn="kvartal.pdf" />);
    await waitFor(() => expect(document.querySelector('[data-pdf-sidfel="2"]')?.getAttribute("role")).toBe("alert"));
    await waitFor(() => expect(document.querySelector('[data-pdf-canvas="1"]')).not.toBeNull());
  });
});

describe("⛔ platshållarna följer dokumentet", () => {
  it("en annan PDF i samma vy: platshållaren har den nya sidans storlek, inte den förras", async () => {
    FalskIO.alla = [];
    vi.stubGlobal("IntersectionObserver", FalskIO);
    pdfjs.antal = 2;
    const { rerender } = render(<OpsPdfVy hamta={async () => pdfBlob()} sokvag="a.pdf" namn="a.pdf" />);
    await waitFor(() => expect(document.querySelectorAll("[data-pdf-sidram]")).toHaveLength(2));
    naraSidor([1]);
    await waitFor(() => expect(document.querySelector('[data-pdf-canvas="1"]')).not.toBeNull());
    naraSidor([]);
    const hojd = () => parseFloat(/** @type {HTMLElement} */ (document.querySelector('[data-pdf-sidram="1"]')).style.height);
    expect(hojd()).toBe(Math.floor(792 * (96 / 72)));
    pdfjs.sidmatt = { b: 400, h: 300 };
    rerender(<OpsPdfVy hamta={async () => pdfBlob()} sokvag="b.pdf" namn="b.pdf" />);
    await waitFor(() => expect(hojd()).toBe(Math.floor(300 * (96 / 72))));
  });
});
