import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { defineModule, validateModuler } from "../lib/modul.js";
import { typenForRad, typerForGrupp, typmarke } from "../lib/modultyper.js";
import { OpsActivityList } from "../components/OpsActivity.jsx";

/*
 * 0.55.0, cllp/ops-framework#244 beslut A (CP 2026-10-04): körningar hamnar i aktivitetsflödet, märkta med appen. En modul
 * bidrar med aktivitetsslag (`ekonomi:synk`) på samma sätt som med typer, och raden bär «från Ekonomi».
 */

const EKONOMI = defineModule({
  id: "ekonomi",
  namn: { sv: "Ekonomi", en: "Economy" },
  nav: [],
  routes: [],
  samlingar: [],
  kallor: {},
  skapar: [],
  hubb: null,
  typer: { aktivitet: [{ id: "synk", namn: { sv: "Banksynk" } }] },
});
const MODULER = validateModuler([EKONOMI]);
const BAS = [{ id: "import", namn: { sv: "Import" }, farg: 1, ikon: "kalender", ordning: 0, arkiverad: false, fas: null, texter: {} }];
const ctx = (/** @type {string[]} */ pa) => ({ bas: BAS, moduler: MODULER, modulerPa: pa, avvikelser: [] });

describe("aktivitetsslag från moduler", () => {
  it("⛔ en påslagen modul bidrar med sitt slag, med modulens värde", () => {
    expect(typerForGrupp("aktivitet", ctx(["ekonomi"])).map((t) => t.id)).toEqual(["import", "ekonomi:synk"]);
    expect(typerForGrupp("aktivitet", ctx([])).map((t) => t.id)).toEqual(["import"]);
  });

  it("⛔ märket härleds: «från Ekonomi» för modulens slag, inget för gruppens, «arkiverad modul» när modulen är av", () => {
    expect(typmarke(/** @type {any} */ (typenForRad("ekonomi:synk", "aktivitet", ctx(["ekonomi"]))))).toBe("från Ekonomi");
    expect(typmarke(/** @type {any} */ (typenForRad("import", "aktivitet", ctx(["ekonomi"]))))).toBeNull();
    expect(typmarke(/** @type {any} */ (typenForRad("ekonomi:synk", "aktivitet", ctx([]))))).toBe("arkiverad modul");
  });
});

describe("OpsActivityList med märket", () => {
  const nar = "2026-10-04T08:00:00.000Z";
  const rader = [
    { id: "a", nar, slag: "ekonomi:synk", rubrik: "Banken synkad", detalj: "34 transaktioner", resultat: "ok" },
    { id: "b", nar, slag: "import", rubrik: "Underlaget importerat", resultat: "ok" },
  ];
  const c = ctx(["ekonomi"]);
  /** @param {string} slag */
  const kindLabel = (slag) => {
    const t = typenForRad(slag, "aktivitet", c);
    return t ? (typeof t.namn === "string" ? t.namn : t.namn.sv || "") : slag;
  };
  /** @param {string} slag */
  const kindMarke = (slag) => typmarke(/** @type {any} */ (typenForRad(slag, "aktivitet", c)));

  it("⛔ modulens rad bär märket på raden och i detaljen, gruppens rad inget märke", () => {
    const { container } = render(<OpsActivityList entries={rader} kindLabel={kindLabel} kindMarke={kindMarke} now={new Date(nar)} />);
    expect([...container.querySelectorAll("[data-aktivitet-marke]")].map((n) => n.textContent)).toEqual(["från Ekonomi"]);
    fireEvent.click(screen.getByRole("button", { name: /Banken synkad/ }));
    expect(screen.getByText("Banksynk, från Ekonomi")).toBeInTheDocument();
  });

  it("utan kindMarke ritas inget märke, som före 0.55.0", () => {
    const { container } = render(<OpsActivityList entries={rader} kindLabel={kindLabel} now={new Date(nar)} />);
    expect(container.querySelectorAll("[data-aktivitet-marke]")).toHaveLength(0);
  });
});
