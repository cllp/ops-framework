import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
