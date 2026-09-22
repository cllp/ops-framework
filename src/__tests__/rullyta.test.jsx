import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OpsRullyta } from "../components/OpsRullyta.jsx";
import { FULLHOJD_KLASSER } from "../lib/fullhojd.js";

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

/** Låtsas att ytan börjar `topp` px ner i FÖNSTRET. */
function laggYtanVid(topp) {
  Element.prototype.getBoundingClientRect = function () {
    return /** @type {DOMRect} */ ({
      ...orgRect.call(this).toJSON?.(),
      top: topp,
      bottom: topp,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: topp,
    });
  };
}

afterEach(() => {
  Element.prototype.getBoundingClientRect = orgRect;
  window.scrollY = 0;
});

function ytan() {
  const barnet = screen.getByText("innehåll");
  const el = barnet.parentElement;
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
    render(<OpsRullyta><span>innehåll</span></OpsRullyta>);
    expect(ytan().className).toContain("overflow-y-auto");
    expect(ytan().className).toContain("overscroll-contain");
  });

  it("mäter avståndet till sidans topp och lägger det i variabeln", () => {
    /*
     * ⛔ TALET ÄR HELA KOMPONENTEN. Höjden räknas i CSS ur `--fullhojd-topp`, så
     * en yta som inte mäter blir antingen en skärmhöjd för hög (talet noll) och
     * sticker ut under skärmen, eller för låg.
     */
    laggYtanVid(212);
    render(<OpsRullyta><span>innehåll</span></OpsRullyta>);
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
    render(<OpsRullyta><span>innehåll</span></OpsRullyta>);
    expect(ytan().style.getPropertyValue("--fullhojd-topp")).toBe("312px");
  });

  it("mäter om när fönstret ändrar storlek", () => {
    /*
     * ⛔ RESIZE ÄR OCKSÅ EN VRIDEN TELEFON. Utan ommätningen bär ytan kvar
     * stående lägets tal i liggande, och då slutar den på fel ställe ända tills
     * någon laddar om.
     */
    laggYtanVid(212);
    render(<OpsRullyta><span>innehåll</span></OpsRullyta>);
    expect(ytan().style.getPropertyValue("--fullhojd-topp")).toBe("212px");

    laggYtanVid(96);
    fireEvent(window, new Event("resize"));
    expect(ytan().style.getPropertyValue("--fullhojd-topp")).toBe("96px");
  });

  it("aldrig ett negativt tal", () => {
    /*
     * ⛔ En yta ovanför fönstrets överkant ger ett negativt `top`, och ett
     * negativt tal i `calc` gör ytan HÖGRE än skärmen i stället för lägre.
     */
    laggYtanVid(-400);
    render(<OpsRullyta><span>innehåll</span></OpsRullyta>);
    expect(ytan().style.getPropertyValue("--fullhojd-topp")).toBe("0px");
  });

  it("drar bort bottenraden bara under 768 px", () => {
    /*
     * ⛔ `OpsBottomNav` ÄR `md:hidden`. Drogs `--bottom-nav-h` bort på båda
     * brytpunkterna skulle ytan sluta en bottenradshöjd för tidigt på en dator,
     * alltså en remsa tomhet som ingen kan förklara.
     */
    expect(FULLHOJD_KLASSER).toContain(
      "h-[calc(100svh_-_var(--fullhojd-topp)_-_var(--bottom-nav-h)_-_var(--safe-bottom))]",
    );
    expect(FULLHOJD_KLASSER).toContain(
      "md:h-[calc(100svh_-_var(--fullhojd-topp)_-_var(--safe-bottom))]",
    );
    // ⛔ Golv, för den dag ytan hamnar långt ner på en kort sida: utan det kan
    // uttrycket bli noll och innehållet försvinna helt.
    expect(FULLHOJD_KLASSER).toContain("min-h-60");
  });

  it("är ingen låda: ingen ram, ingen rundning, ingen egen bakgrund", () => {
    /*
     * ⛔ En yta som når skärmens underkant OCH har en ram läses som en ruta som
     * blivit avhuggen. Innehållet ska se ut som sidan.
     */
    render(<OpsRullyta><span>innehåll</span></OpsRullyta>);
    const klasser = ytan().className;
    expect(klasser).not.toMatch(/\bborder\b|\bborder-/);
    expect(klasser).not.toMatch(/\brounded/);
    expect(klasser).not.toMatch(/\bbg-/);
  });
});
