import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OpsScrollArea } from "../components/OpsScrollArea.jsx";
import { FULL_HEIGHT_CLASSES } from "../lib/fullHeight.js";

/**
 * Rullytan: en yta som rullar i sig själv i stället för att rulla sidan.
 *
 * ⛔ CP 2026-09-22: "Filterraden är fast i kalendervyn men den scrollar i
 * listvyn. Låt listvyn fungera precis som kalendervyn."
 *
 * ⛔ PROVEN MÄTER MÄTNINGEN, inte att en klass står kvar. Höjden är hela
 * poängen, och den räknas ur ett tal som komponenten tar fram själv. Ett prov
 * som bara letade efter `overflow-y-auto` hade varit grönt även med talet
 * fastlåst på noll, alltså med en yta som slutar vid sidans topp.
 */

const orgRect = Element.prototype.getBoundingClientRect;

/**
 * Låtsas att ytan börjar `top` px ner i FÖNSTRET. En bottenrad (`nav[data-ops-bottenrad]`)
 * får `radTopp` som överkant och 90 px höjd om talet ges, annars ingen yta alls (som `md:hidden`).
 */
function laggYtanVid(top, radTopp = null) {
  Element.prototype.getBoundingClientRect = function () {
    if (radTopp !== null && this.matches?.("nav[data-ops-bottenrad]")) {
      return /** @type {DOMRect} */ ({ top: radTopp, bottom: radTopp + 90, left: 0, right: 390, width: 390, height: 90, x: 0, y: radTopp, toJSON() {} });
    }
    return /** @type {DOMRect} */ ({
      ...orgRect.call(this).toJSON?.(),
      top: top,
      bottom: top,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: top,
    });
  };
}

afterEach(() => {
  Element.prototype.getBoundingClientRect = orgRect;
  window.scrollY = 0;
});

function ytan() {
  const theChild = screen.getByText("innehåll");
  const el = theChild.parentElement;
  if (!el) throw new Error("Hittar ingen rullyta kring innehållet");
  return el;
}

describe("OpsRullyta", () => {
  it("rullar i sig själv och håller kvar rullningen", () => {
    /*
     * ⛔ `overscroll-contain` HÖR IHOP MED `overflow-y-auto` OCH PROVAS MED DEN.
     * Utan den fortsätter rullningen ut i sidan så fort ytans botten är nådd,
     * alltså exakt felet CP pekade på, en halv sekund senare.
     */
    render(<OpsScrollArea><span>innehåll</span></OpsScrollArea>);
    expect(ytan().className).toContain("overflow-y-auto");
    expect(ytan().className).toContain("overscroll-contain");
  });

  it("mäter avståndet till sidans topp och lägger det i variabeln", () => {
    /*
     * ⛔ TALET ÄR HELA KOMPONENTEN. Höjden räknas i CSS ur `--fullhojd-top`, så
     * en yta som inte mäter blir antingen en skärmhöjd för hög (talet noll) och
     * sticker ut under skärmen, eller för låg.
     */
    laggYtanVid(212);
    render(<OpsScrollArea><span>innehåll</span></OpsScrollArea>);
    expect(ytan().style.getPropertyValue("--fullhojd-topp")).toBe("212px");
  });

  it("räknar från DOKUMENTETS topp och inte fönstrets", () => {
    /*
     * ⛔ `getBoundingClientRect().top` ensamt är avståndet till fönstrets
     * överkant PRECIS NU. Monteras ytan medan sidan redan är rullad blir talet
     * för litet, och ytan sticker då ut under skärmen med lika många pixlar som
     * sidan råkade vara rullad. Med `scrollY` adderat är talet detsamma oavsett
     * när mätningen sker.
     */
    window.scrollY = 300;
    laggYtanVid(12);
    render(<OpsScrollArea><span>innehåll</span></OpsScrollArea>);
    expect(ytan().style.getPropertyValue("--fullhojd-topp")).toBe("312px");
  });

  it("mäter om när fönstret ändrar storlek", async () => {
    /*
     * ⛔ RESIZE ÄR OCKSÅ EN VRIDEN TELEFON. Utan ommätningen bär ytan kvar
     * stående lägets tal i liggande, och då slutar den på fel ställe ända tills
     * någon laddar om.
     */
    laggYtanVid(212);
    render(<OpsScrollArea><span>innehåll</span></OpsScrollArea>);
    expect(ytan().style.getPropertyValue("--fullhojd-topp")).toBe("212px");

    laggYtanVid(96);
    // 0.32.1: ommätningen sker i nästa bildruta (`requestAnimationFrame`), se hooken.
    await act(async () => {
      fireEvent(window, new Event("resize"));
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    });
    expect(ytan().style.getPropertyValue("--fullhojd-topp")).toBe("96px");
  });

  it("aldrig ett negativt tal", () => {
    /*
     * ⛔ En yta ovanför fönstrets överkant ger ett negativt `top`, och ett
     * negativt tal i `calc` gör ytan HÖGRE än skärmen i stället för lägre.
     */
    laggYtanVid(-400);
    render(<OpsScrollArea><span>innehåll</span></OpsScrollArea>);
    expect(ytan().style.getPropertyValue("--fullhojd-topp")).toBe("0px");
  });

  it("slutar vid bottenradens övre kant när raden syns (0.32.1)", () => {
    /*
     * ⛔ CP 2026-09-30: "Kalender och idag går inte ända ner utan huggs av i
     * botten." Höjden räknades ur `100svh`, men raden är `fixed bottom-0` och
     * följer den verkliga kanten. Nu mäts radens kant direkt och läggs i
     * `--fullhojd-botten`, och klassen drar bara bort toppen och `OpsView`s
     * `pb-6` (1,5 rem). 0.33.1: inte ens det: ytan når raden.
     */
    laggYtanVid(212, 700);
    render(
      <>
        <nav data-ops-bottenrad="" />
        <OpsScrollArea><span>innehåll</span></OpsScrollArea>
      </>,
    );
    expect(ytan().style.getPropertyValue("--fullhojd-botten")).toBe("700px");
    // 0.33.1: ytan når raden (0 px), och OpsView:s `pb-6` tas tillbaka med `-mb-6`. Beteendet mäts i check-skalyta avsnitt 24.
    expect(FULL_HEIGHT_CLASSES).toContain("h-[calc(var(--fullhojd-botten)_-_var(--fullhojd-topp))]");
    expect(FULL_HEIGHT_CLASSES).toContain("-mb-6");
    // ⛔ Ingen viewport-enhet får komma tillbaka i höjden: det var den som följde fel kant.
    expect(FULL_HEIGHT_CLASSES).not.toMatch(/\d+(s|l|d)?vh/);
    // ⛔ Golv, för den dag ytan hamnar långt ner på en kort sida: utan det kan
    // uttrycket bli noll och innehållet försvinna helt.
    expect(FULL_HEIGHT_CLASSES).toContain("min-h-60");
  });

  it("utan synlig bottenrad (dator, `md:hidden`) slutar den vid fönstrets kant", () => {
    /*
     * ⛔ `OpsBottomNav` ÄR `md:hidden`. Räknades radens höjd bort även där skulle
     * ytan sluta en radhöjd för tidigt på en dator. En rad utan yta är ingen rad.
     */
    laggYtanVid(212);
    render(
      <>
        <nav data-ops-bottenrad="" />
        <OpsScrollArea><span>innehåll</span></OpsScrollArea>
      </>,
    );
    expect(ytan().style.getPropertyValue("--fullhojd-botten")).toBe(`${window.innerHeight}px`);
  });

  it("mäter om när något ovanför ytan ändrar storlek, utan resize (0.32.1)", async () => {
    /*
     * ⛔ Försvinner en banner ovanför ytan flyttar ytan upp utan att fönstret
     * ändras. Utan observatören låg toppen kvar 170 px för högt, och ytan slutade
     * lika mycket för tidigt (diagnosen mätte 209 px tomt mot raden).
     */
    /** @type {(() => void)[]} */
    const svar = [];
    const org = globalThis.ResizeObserver;
    globalThis.ResizeObserver = /** @type {any} */ (class {
      /** @param {() => void} cb */
      constructor(cb) { svar.push(cb); }
      observe() {}
      disconnect() {}
    });
    try {
      laggYtanVid(382, 700);
      render(
        <>
          <nav data-ops-bottenrad="" />
          <OpsScrollArea><span>innehåll</span></OpsScrollArea>
        </>,
      );
      expect(ytan().style.getPropertyValue("--fullhojd-topp")).toBe("382px");
      laggYtanVid(212, 700);
      await act(async () => {
        for (const cb of svar) cb();
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      });
      expect(svar.length).toBeGreaterThan(0);
      expect(ytan().style.getPropertyValue("--fullhojd-topp")).toBe("212px");
    } finally {
      globalThis.ResizeObserver = org;
    }
  });

  it("är ingen låda: ingen ram, ingen rundning, ingen egen bakgrund", () => {
    /*
     * ⛔ En yta som når skärmens underkant OCH har en ram läses som en ruta som
     * blivit avhuggen. Innehållet ska se ut som sidan.
     */
    render(<OpsScrollArea><span>innehåll</span></OpsScrollArea>);
    const klasser = ytan().className;
    expect(klasser).not.toMatch(/\bborder\b|\bborder-/);
    expect(klasser).not.toMatch(/\brounded/);
    expect(klasser).not.toMatch(/\bbg-/);
  });
});
