import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsBottomNav } from "../components/OpsBottomNav.jsx";
import { OpsPanelRow } from "../components/OpsPanel.jsx";
import { radKlass } from "../lib/radKlass.js";

/**
 * Menyns rader på en pekskärm (0.218.0).
 *
 * ⛔ HÄNDELSEN: CP 2026-11-11, med en skärmbild ur TestFlight av menyarket: "Är inte texten lite väl liten i denna menyn?"
 * Raderna var 12 px (`text-meta`) med 16 px ikoner på telefonen, samma tal som SessionStudios dropdown för musen.
 *
 * ⛔ VARFÖR KLASSERNA LÖSES HÄR OCH INTE MÄTS: jsdom kör ingen CSS och känner inte `pointer: fine`. Provet löser i stället
 * Tailwinds villkor för tre lägen (telefon, iPad med finger, dator med mus) ur radens egna klasser, på samma sätt som
 * webbläsaren väljer: ett villkor som inte gäller räknas inte, och av de som gäller vinner det mest specifika. Att det SER
 * ut så i en webbläsare mäts i skärmbilderna i PR:en (Chromium med pekskärm, 390 px).
 */

/** Lägena och de varianter som gäller i vart och ett, från minst till mest specifik. */
const LAGEN = {
  telefon: [""],
  ipadFinger: ["", "md:"],
  datorMus: ["", "md:", "pointer-fine:", "md:pointer-fine:"],
};

/**
 * Vilken klass av en sort som gäller i ett läge.
 * @param {string} klasser @param {RegExp} sort Klassens namn utan variant, t.ex. `/^text-(brod|meta|etikett)$/`. @param {keyof typeof LAGEN} lage
 */
function galler(klasser, sort, lage) {
  const prefix = LAGEN[lage];
  let vinnare = null;
  let rang = -1;
  for (const k of klasser.split(/\s+/)) {
    for (let i = 0; i < prefix.length; i += 1) {
      const p = prefix[i];
      if (!k.startsWith(p)) continue;
      const rest = k.slice(p.length);
      if (sort.test(rest) && i >= rang) {
        vinnare = rest;
        rang = i;
      }
    }
  }
  return vinnare;
}

const TEXT = /^text-(brod|meta|etikett)$/;
const IKON = /^\[&_svg\]:size-(4|5)$/;

describe("menyns rad: 16 px på pekskärm, oförändrad med mus", () => {
  it("radKlass({ meny: true }) ger text-brod på telefon och iPad, text-meta på dator", () => {
    const k = radKlass({ meny: true });
    expect(galler(k, TEXT, "telefon")).toBe("text-brod");
    expect(galler(k, TEXT, "ipadFinger")).toBe("text-brod");
    expect(galler(k, TEXT, "datorMus")).toBe("text-meta");
  });

  it("menyns rad (OpsPanelRow meny) har 20 px ikon på pekskärm och 16 px med mus", () => {
    render(<OpsPanelRow meny icon={<svg data-testid="i" />} label="Rapportera fel eller önskemål" onClick={() => {}} />);
    const knapp = screen.getByRole("button", { name: "Rapportera fel eller önskemål" });
    expect(galler(knapp.className, TEXT, "telefon")).toBe("text-brod");
    expect(galler(knapp.className, TEXT, "datorMus")).toBe("text-meta");
    const omslag = /** @type {HTMLElement} */ (screen.getByTestId("i").parentElement);
    expect(galler(omslag.className, IKON, "telefon")).toBe("[&_svg]:size-5");
    expect(galler(omslag.className, IKON, "datorMus")).toBe("[&_svg]:size-4");
  });

  it("arkets rader på telefonen (Meny) är menyns rader", async () => {
    const nav = ["Översikt", "Inkomster", "Kostnader", "Tillgångar", "Pension", "Schema", "Kontakter"].map((label, i) => ({
      href: `/${i}`,
      label,
      icon: <svg aria-hidden="true" />,
    }));
    const meny = { sektioner: [[{ key: "hjalp", etikett: "Hjälp", ikon: <svg aria-hidden="true" />, onClick: () => {} }]], onLoggaUt: () => {} };
    render(<OpsBottomNav nav={nav} activeHref="/0" meny={meny} />);
    await userEvent.click(within(screen.getByRole("navigation", { name: /./ })).getByRole("button", { name: "Meny" }));
    const rader = [screen.getByRole("link", { name: "Kontakter" }), screen.getByRole("button", { name: "Hjälp" }), screen.getByRole("button", { name: "Logga ut" })];
    // ⛔ GOLV: tre sorters rader (navigeringens överlopp, appens sektion, utloggningen). Färre lästa rader är inget svar.
    expect(rader).toHaveLength(3);
    for (const r of rader) {
      expect(galler(r.className, TEXT, "telefon"), r.textContent ?? "").toBe("text-brod");
      expect(galler(r.className, TEXT, "datorMus"), r.textContent ?? "").toBe("text-meta");
    }
  });

  it("⛔ andra rader ur samma funktion rörs inte: panelens rad, filtrets rad och plusset", () => {
    render(<OpsPanelRow icon={<svg data-testid="p" />} label="En notis" onClick={() => {}} />);
    const notis = screen.getByRole("button", { name: "En notis" });
    expect(galler(notis.className, TEXT, "telefon")).toBe("text-meta");
    expect(galler(/** @type {HTMLElement} */ (screen.getByTestId("p").parentElement).className, IKON, "telefon")).toBe("[&_svg]:size-4");
    expect(galler(radKlass({ py: 1.5, vald: false }), TEXT, "telefon")).toBe("text-meta");
    expect(galler(radKlass({ stor: true }), TEXT, "telefon")).toBe("text-etikett");
    expect(galler(radKlass({ accent: true }), TEXT, "telefon")).toBe("text-etikett");
  });
});
