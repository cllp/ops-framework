import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsPdfVy } from "../components/OpsPdfVy.jsx";
import { byggPost } from "../lib/bibliotek.js";
import { arPdfDokument, pdfVyAdress } from "../lib/pdfvisning.js";
import { bytSida, klickSteg, skarmSkala, svepSteg, tangentIPresentation } from "../lib/pdfpresentation.js";
import { PDF_DOKUMENTVAL } from "../lib/pdfjs.js";

/*
 * PDF i appens egen vy, med Presentera i helskärm sida för sida (0.193.0, cllp/ops-framework#530).
 *
 * pdf.js är ersatt med en atrapp: jsdom har ingen canvas att rita på, och det som prövas här är vyn runt den (sidbytet, gränserna, spärren, felen, adressen). Att pdf.js och workern faktiskt laddas i en app som
 * bundlar ramverket med Vite mäts i `check:delbarhet`, och att den aldrig hamnar i startfilen likaså.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4), utfallen står i PR-texten: med `bytSida` utan gränser går presentationen förbi sista sidan; utan `laddaNed={farLaddaNed}` i Biblioteket syns Ladda ned för gästen med spärren;
 * utan felraden i vyn står "Hämtar dokumentet." kvar när filen inte går att hämta.
 */

const pdfjs = vi.hoisted(() => {
  /** @type {{ antal: number, fel: unknown, getDocument: any, renderade: number[], GlobalWorkerOptions: { workerSrc: string } }} */
  const s = {
    antal: 3,
    fel: null,
    renderade: [],
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: null,
  };
  s.getDocument = vi.fn((/** @type {any} */ _val) => {
    const dokument = {
      numPages: s.antal,
      getPage: async (/** @type {number} */ nr) => ({
        getViewport: ({ scale }) => ({ width: 612 * scale, height: 792 * scale }),
        render: () => {
          s.renderade.push(nr);
          return { promise: Promise.resolve(), cancel() {} };
        },
      }),
    };
    return { promise: s.fel ? Promise.reject(s.fel) : Promise.resolve(dokument), destroy: vi.fn() };
  });
  return s;
});

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: (/** @type {any} */ v) => pdfjs.getDocument(v),
  GlobalWorkerOptions: pdfjs.GlobalWorkerOptions,
}));

beforeEach(() => {
  pdfjs.antal = 3;
  pdfjs.fel = null;
  pdfjs.renderade = [];
  pdfjs.getDocument.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const pdfBlob = () => new Blob(["%PDF-1.7 atrapp"], { type: "application/pdf" });
const LAGRING = "https://firebasestorage.googleapis.com/v0/b/x/o/grupper%2Fg%2Fbibliotek%2Fp%2Fkvartal.pdf?alt=media&token=hemlig";

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const pdfPost = () => ({
  ...byggPost({ groupId: "g", typ: "fil", rubrik: "Kvartal", fil: { sokvag: "grupper/g/bibliotek/p/kvartal.pdf", namn: "kvartal.pdf", mime: "application/pdf", byte: 2048 }, skapadAv: skapare, skapad: tid, andrad: tid }),
  id: "p",
});

/** Vyn i helt fönster, med pdf.js-atrappen. */
async function visaVyn(props = {}) {
  const hamta = vi.fn(async () => pdfBlob());
  render(<OpsPdfVy hamta={hamta} sokvag="grupper/g/bibliotek/p/kvartal.pdf" namn="kvartal.pdf" {...props} />);
  await screen.findByText("Sida 1 av 3");
  return hamta;
}

const presentation = () => document.querySelector("[data-pdf-presentation]");
const visadSida = () => document.querySelector("[data-pdf-presentationssida]")?.getAttribute("data-pdf-presentationssida");
const tangent = (/** @type {string} */ key, extra = {}) => act(() => void fireEvent.keyDown(document, { key, ...extra }));

describe("reglerna för sidbytet", () => {
  it("⛔ ett steg förbi första eller sista sidan stannar där", () => {
    expect(bytSida(1, 3, 1)).toBe(2);
    expect(bytSida(3, 3, 1)).toBe(3);
    expect(bytSida(1, 3, -1)).toBe(1);
    expect(bytSida(2, 3, 10)).toBe(3);
    expect(bytSida(1, 0, 1)).toBe(1);
  });
  it("tangenterna: framåt, bakåt, första, sista och Esc. Med Ctrl, Cmd eller Alt ingenting", () => {
    for (const key of ["ArrowRight", "ArrowDown", "PageDown", "Enter", " "]) expect(tangentIPresentation({ key }), key).toBe(1);
    for (const key of ["ArrowLeft", "ArrowUp", "PageUp"]) expect(tangentIPresentation({ key }), key).toBe(-1);
    expect(tangentIPresentation({ key: " ", shiftKey: true })).toBe(-1);
    expect(tangentIPresentation({ key: "Home" })).toBe("forsta");
    expect(tangentIPresentation({ key: "End" })).toBe("sista");
    expect(tangentIPresentation({ key: "Escape" })).toBe("avsluta");
    expect(tangentIPresentation({ key: "ArrowRight", ctrlKey: true })).toBe(null);
    expect(tangentIPresentation({ key: "a" })).toBe(null);
  });
  it("svep åt vänster är nästa sida, åt höger föregående, och ett kort eller lodrätt svep ingenting", () => {
    expect(svepSteg(-120, 10)).toBe(1);
    expect(svepSteg(120, 10)).toBe(-1);
    expect(svepSteg(-30, 0)).toBe(0);
    expect(svepSteg(-80, 200)).toBe(0);
  });
  it("klick i vänstra tredjedelen är föregående sida, annars nästa", () => {
    expect(klickSteg(10, 900)).toBe(-1);
    expect(klickSteg(500, 900)).toBe(1);
  });
  it("skalan i presentationen fyller skärmen och ryms i båda led", () => {
    expect(skarmSkala({ bredd: 816, hojd: 1056 }, { bredd: 1920, hojd: 1080 })).toBeCloseTo(1080 / 1056);
    expect(skarmSkala({ bredd: 1000, hojd: 500 }, { bredd: 500, hojd: 1000 })).toBeCloseTo(0.5);
  });
});

describe("adressen till PDF:ens eget fönster och pdf.js-valen", () => {
  it("bara en PDF med en fil får en adress, och en blob- eller data-adress kastar", () => {
    const oppna = vi.fn(() => "/bibliotek/visa/p?plats=g");
    expect(pdfVyAdress(oppna, pdfPost())).toBe("/bibliotek/visa/p?plats=g");
    expect(pdfVyAdress(oppna, { typ: "fil", fil: { mime: "text/html", sokvag: "x" } })).toBe("");
    expect(oppna).toHaveBeenCalledTimes(1);
    expect(() => pdfVyAdress(() => "blob:https://app/1", pdfPost())).toThrow(/oppnaPdf/);
    expect(() => pdfVyAdress(() => LAGRING.replace("https:", "data:"), pdfPost())).toThrow();
    expect(arPdfDokument(pdfPost())).toBe(true);
  });
  it("⛔ pdf.js får aldrig bygga kod ur filen, och inga XFA-formulär", async () => {
    expect(PDF_DOKUMENTVAL).toMatchObject({ isEvalSupported: false, enableXfa: false });
    await visaVyn();
    expect(pdfjs.getDocument.mock.calls[0][0]).toMatchObject({ isEvalSupported: false, enableXfa: false });
    expect(pdfjs.getDocument.mock.calls[0][0].data).toBeInstanceOf(Uint8Array);
  });
});

describe("vyn: raden, sidorna och zoomen", () => {
  it("helfönstret: filnamnet som rubrik utanför raden, och i raden zoomen anpassad till bredd, 1/3, Helskärm, Ladda ned och Stäng. Alla sidor ritas när ingen observatör finns", async () => {
    await visaVyn({ onStang: () => {} });
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-pdf-rad]"));
    const rubrik = screen.getByRole("heading", { name: "kvartal.pdf" });
    expect(rad.contains(rubrik)).toBe(false);
    expect(rad.querySelector("[data-html-zoom-anpassad]")).toBeTruthy();
    expect(rad.querySelector("[data-dokumentrad-sida]")?.textContent).toBe("1/3Sida 1 av 3");
    expect(within(rad).getByRole("button", { name: "Helskärm" })).toBeTruthy();
    expect(within(rad).getByRole("button", { name: "Ladda ned" })).toBeTruthy();
    expect(within(rad).getByRole("button", { name: "Stäng" })).toBeTruthy();
    await waitFor(() => expect(document.querySelectorAll("[data-pdf-sida-canvas]")).toHaveLength(3));
  });
  it("⛔ laddaNed={false} döljer Ladda ned, och Helskärm finns kvar", async () => {
    await visaVyn({ laddaNed: false });
    expect(screen.queryByRole("button", { name: "Ladda ned" })).toBeNull();
    expect(screen.getByRole("button", { name: "Helskärm" })).toBeTruthy();
  });
  it("en PDF med en sida visar ingen sidräkning i raden", async () => {
    pdfjs.antal = 1;
    render(<OpsPdfVy hamta={async () => pdfBlob()} sokvag="s" namn="kvartal.pdf" />);
    await waitFor(() => expect(document.querySelectorAll("[data-pdf-sida-canvas]")).toHaveLength(1));
    expect(document.querySelector("[data-dokumentrad-sida]")).toBeNull();
    expect(screen.queryByText(/Sida 1 av 1/)).toBeNull();
  });
});

describe("⛔ verktygsraden i detaljen (0.196.0): en rad, utan filnamn, utan ram och bakgrund", () => {
  /*
   * CP 2026-11-06, med en skärmbild från telefonen: "Det här ser jättekonstigt ut, kolla hur ful titeln ligger skarv.pdf. Det här håller inte. Presentera är ett konstigt ord i sammanhanget."
   * Rött med 0.195.0 (raden i 0.193.0): filnamnet stod i raden, knappen hette Presentera, raden bröts (`flex-wrap`), och vyn hade `bg-surface` och sidorna en ruta med `rounded-lg border bg-sunken`.
   */
  const RAM = /(^|\s)(border|rounded|bg-|shadow|ring-)/;
  async function detaljen(/** @type {Record<string, any>} */ extra = {}) {
    const post = pdfPost();
    render(<OpsBibliotek poster={[post]} jag={JAG} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => LAGRING} hamtaFil={async () => pdfBlob()} oppnaPdf={() => "/bibliotek/visa/p?plats=g"} {...extra} />);
    await screen.findByText("Sida 1 av 3");
    return /** @type {HTMLElement} */ (document.querySelector("[data-bibliotek-pdf]"));
  }

  it("inget filnamn i PDF-vyn: detaljen har redan rubriken", async () => {
    const pdf = await detaljen();
    expect(pdf.textContent).not.toContain("kvartal.pdf");
    expect(pdf.querySelector("[data-pdf-namn]")).toBeNull();
    expect(within(pdf).queryByRole("heading")).toBeNull();
  });

  it("etiketten är Helskärm, med samma namn som title, och Presentera finns inte", async () => {
    const pdf = await detaljen();
    const knapp = within(pdf).getByRole("button", { name: "Helskärm" });
    expect(knapp.getAttribute("title")).toBe("Helskärm");
    expect(within(pdf).queryByText(/Presentera/)).toBeNull();
    expect(within(pdf).getByRole("button", { name: "Ladda ned" }).getAttribute("title")).toBe("Ladda ned");
    expect(within(pdf).getByRole("link", { name: "Öppna i eget fönster" }).getAttribute("title")).toBe("Öppna i eget fönster");
  });

  it("en enda rad: ett element bär zoomen, sidan och alla knappar, och det bryts inte", async () => {
    const pdf = await detaljen();
    const rader = pdf.querySelectorAll("[data-pdf-rad]");
    expect(rader).toHaveLength(1);
    const rad = /** @type {HTMLElement} */ (rader[0]);
    expect(rad.className).toMatch(/(^|\s)flex-nowrap(\s|$)/);
    expect(rad.className).not.toMatch(/(^|\s)flex-wrap(\s|$)/);
    expect(rad.querySelector("[data-html-zoom]")).toBeTruthy();
    expect(rad.querySelector("[data-dokumentrad-sida]")).toBeTruthy();
    for (const namn of ["Helskärm", "Ladda ned"]) expect(within(rad).getByRole("button", { name: namn })).toBeTruthy();
    expect(within(rad).getByRole("link", { name: "Öppna i eget fönster" })).toBeTruthy();
    // Alla knappar och länkar i PDF-vyn står i raden (golv: fem, zoomens tre och två till).
    const kontroller = [...pdf.querySelectorAll("button, a")];
    expect(kontroller.length).toBeGreaterThanOrEqual(5);
    expect(kontroller.every((k) => rad.contains(k))).toBe(true);
  });

  it("ingen ram eller bakgrund runt raden eller runt sidorna, och ingen skugga runt sidan", async () => {
    const pdf = await detaljen();
    const rad = /** @type {HTMLElement} */ (pdf.querySelector("[data-pdf-rad]"));
    /** @type {HTMLElement | null} */
    let el = rad;
    const lasta = [];
    while (el && el !== pdf.parentElement) {
      lasta.push(el);
      expect(el.className, el.outerHTML.slice(0, 120)).not.toMatch(RAM);
      el = el.parentElement;
    }
    expect(lasta.length).toBeGreaterThanOrEqual(3);
    const sidor = /** @type {HTMLElement} */ (pdf.querySelector("[data-pdf-sidor]"));
    expect(sidor.className).not.toMatch(RAM);
    const sidramar = [...pdf.querySelectorAll("[data-pdf-sidram]")];
    expect(sidramar.length).toBe(3);
    for (const s of sidramar) expect(/** @type {HTMLElement} */ (s).className).not.toMatch(RAM);
  });
});

describe("Helskärm: en sida i taget, utan rad", () => {
  it("⛔ pilar, mellanslag, PageUp och PageDown byter sida inom gränserna, Home och End går till ändarna, och Esc avslutar", async () => {
    await visaVyn();
    fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    // jsdom har inget Fullscreen API: presentationen fyller fönstret i stället, som på en iPhone.
    expect(presentation()?.getAttribute("data-pdf-presentation")).toBe("fonster");
    expect(document.querySelector("[data-pdf-rad]")).toBeNull();
    expect(visadSida()).toBe("1");
    tangent("ArrowLeft");
    expect(visadSida()).toBe("1");
    tangent("ArrowRight");
    expect(visadSida()).toBe("2");
    tangent(" ");
    expect(visadSida()).toBe("3");
    tangent("PageDown");
    tangent("ArrowDown");
    expect(visadSida()).toBe("3");
    tangent("PageUp");
    expect(visadSida()).toBe("2");
    tangent("Home");
    expect(visadSida()).toBe("1");
    tangent("End");
    expect(visadSida()).toBe("3");
    expect(document.querySelectorAll("[data-pdf-presentationssida]")).toHaveLength(1);
    tangent("Escape");
    expect(presentation()).toBeNull();
    expect(document.querySelector("[data-pdf-rad]")).toBeTruthy();
  });

  it("sidnumret syns vid sidbyte och försvinner efter en stund", async () => {
    await visaVyn();
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
      tangent("ArrowRight");
      const nummer = /** @type {HTMLElement} */ (document.querySelector('[role="status"][aria-live="polite"]'));
      expect(nummer.textContent).toBe("2 / 3");
      expect(nummer.hasAttribute("data-pdf-sidnummer")).toBe(true);
      act(() => void vi.advanceTimersByTime(2000));
      expect(nummer.hasAttribute("data-pdf-sidnummer")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("klick byter sida (vänstra tredjedelen bakåt), svep byter sida, och knappen avslutar utan tangentbord", async () => {
    await visaVyn();
    fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    const yta = /** @type {HTMLElement} */ (presentation());
    vi.spyOn(yta, "getBoundingClientRect").mockReturnValue(/** @type {any} */ ({ left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600 }));
    fireEvent.click(yta, { clientX: 600, clientY: 300 });
    expect(visadSida()).toBe("2");
    fireEvent.click(yta, { clientX: 50, clientY: 300 });
    expect(visadSida()).toBe("1");
    fireEvent.touchStart(yta, { touches: [{ clientX: 500, clientY: 300 }] });
    fireEvent.touchEnd(yta, { changedTouches: [{ clientX: 300, clientY: 310 }] });
    expect(visadSida()).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Stäng helskärm" }));
    expect(presentation()).toBeNull();
  });

  it("med Fullscreen API går vyns eget element till helskärm, och när webbläsaren lämnar helskärmen är presentationen slut", async () => {
    await visaVyn();
    const fore = Object.getOwnPropertyDescriptor(document, "fullscreenEnabled");
    /** @type {Element | null} */
    let iHelskarm = null;
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => iHelskarm });
    const begar = vi.fn(function () {
      return Promise.resolve();
    });
    // @ts-ignore: jsdom har ingen requestFullscreen.
    HTMLElement.prototype.requestFullscreen = begar;
    try {
      const vy = /** @type {HTMLElement} */ (document.querySelector("[data-pdf-vy]"));
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
      expect(begar).toHaveBeenCalledTimes(1);
      expect(begar.mock.contexts[0]).toBe(vy);
      expect(presentation()?.getAttribute("data-pdf-presentation")).toBe("helskarm");
      iHelskarm = vy;
      act(() => void document.dispatchEvent(new Event("fullscreenchange")));
      expect(presentation()).toBeTruthy();
      iHelskarm = null;
      act(() => void document.dispatchEvent(new Event("fullscreenchange")));
      expect(presentation()).toBeNull();
    } finally {
      // @ts-ignore
      delete HTMLElement.prototype.requestFullscreen;
      delete (/** @type {any} */ (document)).fullscreenElement;
      if (fore) Object.defineProperty(document, "fullscreenEnabled", fore);
      else delete (/** @type {any} */ (document)).fullscreenEnabled;
    }
  });

  it("avslår webbläsaren helskärm fyller presentationen fönstret i stället, den faller inte", async () => {
    await visaVyn();
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    // @ts-ignore
    HTMLElement.prototype.requestFullscreen = () => Promise.reject(new TypeError("Permissions check failed"));
    try {
      fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
      await waitFor(() => expect(presentation()?.getAttribute("data-pdf-presentation")).toBe("fonster"));
      expect(visadSida()).toBe("1");
    } finally {
      // @ts-ignore
      delete HTMLElement.prototype.requestFullscreen;
      delete (/** @type {any} */ (document)).fullscreenEnabled;
    }
  });
});

describe("⛔ fel syns, med Försök igen (regel 5)", () => {
  it("en fil som inte går att hämta ger en rad med skälet och Försök igen, som hämtar på nytt", async () => {
    let gang = 0;
    const hamta = vi.fn(async () => {
      gang += 1;
      if (gang === 1) throw new Error("Nätet föll.");
      return pdfBlob();
    });
    render(<OpsPdfVy hamta={hamta} sokvag="s" namn="kvartal.pdf" />);
    const fel = await screen.findByRole("alert");
    expect(fel.textContent).toBe("Dokumentet gick inte att hämta. Nätet föll.");
    expect(screen.getByRole("button", { name: "Helskärm" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Försök igen" }));
    await screen.findByText("Sida 1 av 3");
    expect(hamta).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("en PDF med lösenord och en fil som inte är en PDF säger det", async () => {
    pdfjs.fel = Object.assign(new Error("No password given"), { name: "PasswordException" });
    const { unmount } = render(<OpsPdfVy hamta={async () => pdfBlob()} sokvag="s" namn="a.pdf" />);
    expect((await screen.findByRole("alert")).textContent).toBe("PDF:en är skyddad med lösenord och kan inte visas här.");
    unmount();
    pdfjs.fel = Object.assign(new Error("Invalid PDF structure."), { name: "InvalidPDFException" });
    render(<OpsPdfVy hamta={async () => pdfBlob()} sokvag="s" namn="a.pdf" />);
    expect((await screen.findByRole("alert")).textContent).toBe("Filen är ingen läsbar PDF.");
    expect(screen.getByRole("button", { name: "Försök igen" })).toBeTruthy();
  });
});

describe("Biblioteket: PDF:en i detaljen, aldrig lagringens adress", () => {
  /** @param {Record<string, any>} extra */
  function visaBiblioteket(extra = {}) {
    const post = pdfPost();
    return render(<OpsBibliotek poster={[post]} jag={JAG} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => LAGRING} {...extra} />);
  }

  it("⛔ detaljen ritar PDF-vyn ur byten, och ingen länk eller källa pekar på lagringen", async () => {
    const hamtaFil = vi.fn(async () => pdfBlob());
    visaBiblioteket({ hamtaFil });
    await screen.findByText("Sida 1 av 3");
    expect(hamtaFil).toHaveBeenCalledWith("grupper/g/bibliotek/p/kvartal.pdf");
    for (const el of document.querySelectorAll("[href], [src]")) {
      expect(`${el.getAttribute("href") ?? ""}${el.getAttribute("src") ?? ""}`).not.toContain("firebasestorage");
    }
    expect(screen.getByRole("button", { name: "Ladda ned" })).toBeTruthy();
  });

  it("⛔ gästens spärr (utanNedladdning) döljer Ladda ned, och Helskärm finns kvar", async () => {
    visaBiblioteket({ hamtaFil: async () => pdfBlob(), utanNedladdning: true });
    await screen.findByText("Sida 1 av 3");
    expect(screen.queryByRole("button", { name: "Ladda ned" })).toBeNull();
    expect(screen.queryByText("Ladda ned")).toBeNull();
    expect(screen.getByRole("button", { name: "Helskärm" })).toBeTruthy();
  });

  it("utan hamtaFil (gästens bibliotek) hämtas byten ur den adress Biblioteket redan har, och adressen ritas inte", async () => {
    const hamta = vi.spyOn(globalThis, "fetch").mockResolvedValue(/** @type {any} */ ({ ok: true, status: 200, blob: async () => pdfBlob() }));
    const post = pdfPost();
    render(<OpsBibliotek poster={[post]} jag={null} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={async () => false} hamtaAdress={async () => LAGRING} adresserPaBegaran utanHubb utanNedladdning />);
    await screen.findByText("Sida 1 av 3");
    expect(hamta).toHaveBeenCalledWith(LAGRING);
    expect(document.body.innerHTML).not.toContain("firebasestorage");
    expect(screen.getByRole("button", { name: "Helskärm" })).toBeTruthy();
  });

  it("med oppnaPdf står Öppna i eget fönster i raden, och kortet i listan är en länk till appens sida", async () => {
    const post = pdfPost();
    render(<OpsBibliotek poster={[post]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => LAGRING} hamtaFil={async () => pdfBlob()} oppnaPdf={() => "/bibliotek/visa/p?plats=g"} />);
    const kort = /** @type {HTMLAnchorElement} */ (document.querySelector("[data-bibliotek-oppna-pdf]"));
    expect(kort.getAttribute("href")).toBe("/bibliotek/visa/p?plats=g");
  });

  it("med oppnaPdf i detaljen pekar Öppna i eget fönster på appens sida", async () => {
    visaBiblioteket({ hamtaFil: async () => pdfBlob(), oppnaPdf: () => "/bibliotek/visa/p?plats=g" });
    await screen.findByText("Sida 1 av 3");
    const lank = /** @type {HTMLElement} */ (document.querySelector("[data-pdf-fonster] a"));
    expect(lank.getAttribute("href")).toBe("/bibliotek/visa/p?plats=g");
    expect(lank.getAttribute("target")).toBe("_blank");
  });
});
