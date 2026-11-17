import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsModal } from "../components/OpsModal.jsx";
import { usePanelOppen } from "../lib/panellager.js";

/*
 * Bladets knappar skyms (0.235.0). CP 2026-11-16, skärmbild från appen: i bladet Nytt projekt (`OpsModal` med `footer`) var Avbryt och Skapa projekt
 * avklippta längst ned. Bladet stod på `bottom-0`, på samma plats som bottenraden, med bara den säkra ytan som luft.
 *
 * jsdom kör ingen CSS (regel 12), så här prövas att klasserna räknar med bottenraden (`--panel-botten`, samma tal som `PanelDialog` och `OpsSkapaPanel`).
 * Att knappraden faktiskt står ovanför bottenraden vid 390 px är mätt med Playwright, i PR-texten.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4): före 0.235.0 var klasserna `bottom-0` och `pb-(--safe-bottom)`, knappraden kunde krympa, och bladet var ingen panel.
 */

function Panelvakt() {
  return <span data-panel-oppen={usePanelOppen() ? "ja" : "nej"} />;
}

function oppnaBlad() {
  render(
    <>
      <Panelvakt />
      <OpsModal open onOpenChange={() => {}} title="Nytt projekt" footer={<button type="button">Skapa projekt</button>}>
        <p>Formuläret</p>
      </OpsModal>
    </>,
  );
  const blad = screen.getByRole("dialog", { name: "Nytt projekt" });
  return { blad, fot: /** @type {HTMLElement} */ (blad.querySelector("[data-ops-modal-fot]")) };
}

describe("⛔ bladet slutar ovanför bottenraden på telefonen", () => {
  it("bladet står på bottenradens överkant, och höjden räknar med den", () => {
    const { blad } = oppnaBlad();
    const klasser = blad.className.split(/\s+/);
    expect(klasser).toContain("bottom-(--panel-botten)");
    expect(klasser).not.toContain("bottom-0");
    expect(klasser).toContain("max-h-[calc(100dvh-var(--safe-top)-var(--panel-botten))]");
    // På datorn är det den centrerade rutan som förut.
    expect(klasser).toContain("md:bottom-auto");
  });
  it("den säkra ytan läggs bara på när bottenraden inte redan bär den", () => {
    const { blad } = oppnaBlad();
    const klasser = blad.className.split(/\s+/);
    expect(klasser).toContain("pb-[max(0px,calc(var(--safe-bottom)-var(--panel-botten)))]");
    expect(klasser).not.toContain("pb-(--safe-bottom)");
  });
  it("knappraden krymper aldrig: det är innehållet som rullar", () => {
    const { fot } = oppnaBlad();
    expect(fot).toBeTruthy();
    expect(fot.textContent).toBe("Skapa projekt");
    expect(fot.className.split(/\s+/)).toContain("shrink-0");
  });
  it("slöjan slutar också ovanför bottenraden, så att raden och TALK syns", () => {
    oppnaBlad();
    const sloja = /** @type {HTMLElement} */ (document.querySelector("[data-ops-modal-sloja]"));
    expect(sloja.className.split(/\s+/)).toEqual(expect.arrayContaining(["bottom-(--panel-botten)", "md:bottom-0"]));
  });
  it("bladet är en panel medan det är öppet: bottenraden dämpar sina flikar", () => {
    oppnaBlad();
    expect(document.querySelector("[data-panel-oppen]")?.getAttribute("data-panel-oppen")).toBe("ja");
  });
});

/** Radix lägger sina lyssnare på dokumentet ett varv senare. */
const varv = () => act(() => new Promise((r) => setTimeout(r, 30)));

describe("⛔ bladet som panel (granskningen av 0.235.0)", () => {
  it("registreringen släpps när bladet stängs och när det avmonteras, och märket för kanten likaså", () => {
    const blad = (/** @type {boolean} */ open) => (
      <>
        <Panelvakt />
        <OpsModal open={open} onOpenChange={() => {}} title="Nytt projekt">
          <p>Formuläret</p>
        </OpsModal>
      </>
    );
    const oppen = () => document.querySelector("[data-panel-oppen]")?.getAttribute("data-panel-oppen");
    const marke = () => document.documentElement.hasAttribute("data-ops-blad-oppet");
    const { rerender, unmount } = render(blad(true));
    expect([oppen(), marke()]).toEqual(["ja", true]);
    rerender(blad(false));
    expect([oppen(), marke()]).toEqual(["nej", false]);
    rerender(blad(true));
    expect([oppen(), marke()]).toEqual(["ja", true]);
    unmount();
    render(<Panelvakt />);
    expect([oppen(), marke()]).toEqual(["nej", false]);
  });

  it("ett tryck i bottenraden stänger inte bladet, ett tryck utanför gör det", async () => {
    function Skal() {
      const [open, setOpen] = useState(true);
      return (
        <OpsAppShell fasta={{ idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } }} moduler={[{ id: "projekt", href: "/projekt", label: "Projekt" }]} activeHref="/">
          <OpsModal open={open} onOpenChange={setOpen} title="Nytt projekt" footer={<button type="button">Skapa projekt</button>}>
            <p>Formuläret</p>
          </OpsModal>
        </OpsAppShell>
      );
    }
    render(<Skal />);
    await varv();
    const nav = /** @type {HTMLElement} */ (document.querySelector("nav[data-ops-bottenrad]"));
    // Golv: raden finns och bär attributet som säger att den står ovanför en panel.
    expect(nav.hasAttribute("data-ops-ovanfor-panel")).toBe(true);
    fireEvent.pointerDown(nav);
    fireEvent.click(nav);
    await varv();
    expect(screen.queryByRole("dialog", { name: "Nytt projekt" })).not.toBeNull();
    fireEvent.pointerDown(document.body);
    await varv();
    expect(screen.queryByRole("dialog", { name: "Nytt projekt" })).toBeNull();
  });
});

describe("⛔ märket för kanten med flera blad (den andra granskningen av 0.235.0)", () => {
  const marke = () => document.documentElement.hasAttribute("data-ops-blad-oppet");
  /** @param {{ a: boolean, b: boolean, visaB?: boolean }} p */
  const tva = ({ a, b, visaB = true }) => (
    <>
      <OpsModal open={a} onOpenChange={() => {}} title="Blad A">
        <p>A</p>
      </OpsModal>
      {visaB ? (
        <OpsModal open={b} onOpenChange={() => {}} title="Blad B">
          <p>B</p>
        </OpsModal>
      ) : null}
    </>
  );
  it("två blad efter varandra: märket står medan något av dem är öppet, och är borta när båda stängts", () => {
    const { rerender } = render(tva({ a: true, b: false }));
    expect(marke()).toBe(true);
    rerender(tva({ a: false, b: false }));
    expect(marke()).toBe(false);
    rerender(tva({ a: false, b: true }));
    expect(marke()).toBe(true);
    rerender(tva({ a: false, b: false }));
    expect(marke()).toBe(false);
  });
  it("ett blad som monteras av medan ett annat är öppet tar inte bort märket för det andra", () => {
    const { rerender, unmount } = render(tva({ a: true, b: true }));
    expect(marke()).toBe(true);
    rerender(tva({ a: true, b: true, visaB: false }));
    expect(marke()).toBe(true);
    rerender(tva({ a: false, b: false, visaB: false }));
    expect(marke()).toBe(false);
    unmount();
    expect(marke()).toBe(false);
  });
});
