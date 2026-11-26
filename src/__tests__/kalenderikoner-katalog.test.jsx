import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { KALENDERIKONER, KALENDERIKONER_ARV, byggGruppkalender, byggMinKalender } from "../lib/kalendrar.js";
import { ARV_KALENDERIKON, kalenderIkonKomponent, kalenderikonINamn } from "../lib/kalenderikoner.js";
import { KATALOGNAMN } from "../lib/markeformer.js";
import { KalenderIkon } from "../components/icons.jsx";

/*
 * 0.265.0, CP 2026-11-26: "Vi har alldeles för få ikoner att välja mellan här. Skall det inte vara samma som mitt konto?" Kalendrarna får hela gruppikonernas
 * katalog, och de åtta äldre id:na läses och ritas som förut.
 * ⛔ RÖTT UTAN ÄNDRINGEN: KALENDERIKONER var de åtta, byggGruppkalender nekade `music`, och `kalenderIkonKomponent("music")` gav reserven.
 */
describe("⛔ kalendrarnas ikoner är Mitt kontos katalog (0.265.0)", () => {
  it("listan är de äldre id:na först och sedan hela katalogen, utan dubbletter", () => {
    expect(KALENDERIKONER.slice(0, KALENDERIKONER_ARV.length)).toEqual([...KALENDERIKONER_ARV]);
    expect(KALENDERIKONER[0]).toBe("kalender");
    for (const n of KATALOGNAMN) expect(KALENDERIKONER).toContain(n);
    expect(new Set(KALENDERIKONER).size).toBe(KALENDERIKONER.length);
    expect(KALENDERIKONER.length).toBeGreaterThan(100);
  });

  it("en gruppkalender och en av mina kalendrar sparas med ett katalognamn, och ett okänt namn nekas fortfarande i gruppens katalog", () => {
    expect(byggGruppkalender({ id: "resor", namn: { sv: "Resor" }, farg: 4, ikon: "plane", groupId: "cps-ab" }).ikon).toBe("plane");
    expect(byggMinKalender({ id: "musik", namn: "Musik", farg: "kulor:200", ikon: "music", ordning: 0, forvald: false, iFlodet: false, arkiverad: false }).ikon).toBe("music");
    expect(() => byggGruppkalender({ id: "x", namn: { sv: "X" }, farg: 4, ikon: "finns-inte-alls", groupId: "cps-ab" })).toThrow(/tillåtelselistan/);
    // De äldre id:na går som förut.
    expect(byggGruppkalender({ id: "hem", namn: { sv: "Hem" }, farg: 4, ikon: "hus", groupId: "cps-ab" }).ikon).toBe("hus");
  });

  it("ett katalognamn ritas med katalogens ikon, ett äldre id med sin gamla, och ett okänt namn med reserven", () => {
    const Musik = kalenderIkonKomponent("music");
    expect(Musik).not.toBe(KalenderIkon);
    const { container } = render(<Musik size={18} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(kalenderIkonKomponent("kalender")).toBe(KalenderIkon);
    expect(kalenderIkonKomponent("finns-inte-alls")).toBe(KalenderIkon);
    expect(kalenderIkonKomponent(undefined)).toBe(KalenderIkon);
  });

  it("varje äldre id pekar på ett namn i katalogen, så väljaren kan visa det som valt", () => {
    for (const id of KALENDERIKONER_ARV) {
      expect(KATALOGNAMN.has(kalenderikonINamn(id)), id).toBe(true);
    }
    expect(Object.keys(ARV_KALENDERIKON).sort()).toEqual([...KALENDERIKONER_ARV].sort());
    expect(kalenderikonINamn("plane")).toBe("plane");
    expect(kalenderikonINamn("")).toBe("");
  });
});
