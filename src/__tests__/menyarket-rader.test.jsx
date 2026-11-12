import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsBottomNav } from "../components/OpsBottomNav.jsx";
import { OpsPanelRow } from "../components/OpsPanel.jsx";
import { radKlass } from "../lib/radKlass.js";

/**
 * Menyarket på telefonen har större rader, och huvudets meny är som förut (0.218.0).
 *
 * ⛔ HÄNDELSERNA: CP 2026-11-11, med en skärmbild ur TestFlight av arket bottenradens Meny öppnar: "Är inte texten lite väl liten i
 * denna menyn?" Raderna var 12 px med 16 px ikoner. Och CP 2026-09-29 om huvudets meny: "Stor text", som `check-skalyta` avsnitt 18
 * vaktar. Första versionen av 0.218.0 gjorde båda större och föll i CI (release-PR 577). Två beslut, två ytor.
 *
 * ⛔ jsdom kör ingen CSS, så provet läser klasserna. Storleken som ritas mäts i Chromium av `check-skalyta` (arket 16 px vid 390,
 * huvudets meny 12 px vid 1280) och i appens skärmbilder.
 */

/** Textrollen och ikonstorleken i en klasssträng, utan varianter: det som gäller där raden ritas. @param {string} k */
const roll = (k) => k.split(/\s+/).filter((c) => /^text-(brod|meta|etikett)$/.test(c));
/** @param {string} k */
const ikon = (k) => k.split(/\s+/).filter((c) => /^\[&_svg\]:size-\d$/.test(c));

const NAV = ["Översikt", "Inkomster", "Kostnader", "Tillgångar", "Pension", "Schema", "Kontakter"].map((label, i) => ({
  href: `/${i}`,
  label,
  icon: <svg aria-hidden="true" />,
}));

afterEach(cleanup);

describe("menyarket på telefonen: 16 px text och 20 px ikoner", () => {
  it("navigeringens överlopp, appens sektion och utloggningen i arket", async () => {
    const meny = { sektioner: [[{ key: "hjalp", etikett: "Hjälp", ikon: <svg aria-hidden="true" />, onClick: () => {} }]], onLoggaUt: () => {} };
    render(<OpsBottomNav nav={NAV} activeHref="/0" meny={meny} />);
    await userEvent.click(within(screen.getByRole("navigation", { name: /./ })).getByRole("button", { name: "Meny" }));
    const rader = [screen.getByRole("link", { name: "Kontakter" }), screen.getByRole("button", { name: "Hjälp" }), screen.getByRole("button", { name: "Logga ut" })];
    // ⛔ GOLV: tre sorters rader. Färre lästa rader är inget svar.
    expect(rader).toHaveLength(3);
    for (const r of rader) {
      expect(roll(r.className), r.textContent ?? "").toEqual(["text-brod"]);
      // ⛔ Inget pekarvillkor: arket finns bara under `md`, så den roll som står är den som ritas (rollskalan i `check-skalyta` läser den så).
      expect(r.className).not.toMatch(/pointer-fine/);
      const svg = r.querySelector("svg");
      expect(ikon(/** @type {HTMLElement} */ (svg?.parentElement).className), r.textContent ?? "").toEqual(["[&_svg]:size-5"]);
    }
  });
});

describe("⛔ huvudets meny och andra rader är oförändrade", () => {
  it("huvudets meny (Meny, fler åtgärder): 12 px och 16 px ikoner, som SS", () => {
    const meny = { sektioner: [[{ key: "hjalp", etikett: "Hjälp", ikon: <svg aria-hidden="true" />, onClick: () => {} }]], onLoggaUt: () => {} };
    render(
      <OpsAppShell brand="Ops" nav={NAV} activeHref="/0" meny={meny}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /^Meny, fler/ })[0]);
    const dialog = screen.getByRole("dialog");
    const rader = [within(dialog).getByRole("button", { name: "Hjälp" }), within(dialog).getByRole("button", { name: "Logga ut" })];
    expect(rader).toHaveLength(2);
    for (const r of rader) {
      expect(roll(r.className), r.textContent ?? "").toEqual(["text-meta"]);
      expect(r.className).not.toMatch(/text-brod/);
      const svg = r.querySelector("svg");
      expect(ikon(/** @type {HTMLElement} */ (svg?.parentElement).className), r.textContent ?? "").toEqual(["[&_svg]:size-4"]);
    }
  });

  it("panelens rad, filtrets rad, en stor rad och plusset", () => {
    render(<OpsPanelRow icon={<svg data-testid="p" />} label="En notis" onClick={() => {}} />);
    expect(roll(screen.getByRole("button", { name: "En notis" }).className)).toEqual(["text-meta"]);
    expect(ikon(/** @type {HTMLElement} */ (screen.getByTestId("p").parentElement).className)).toEqual(["[&_svg]:size-4"]);
    expect(roll(radKlass())).toEqual(["text-meta"]);
    expect(roll(radKlass({ py: 1.5, vald: false }))).toEqual(["text-meta"]);
    expect(roll(radKlass({ stor: true }))).toEqual(["text-etikett"]);
    expect(roll(radKlass({ accent: true }))).toEqual(["text-etikett"]);
  });
});
