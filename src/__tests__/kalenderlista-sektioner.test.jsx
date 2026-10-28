import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { OpsKalenderLista } from "../components/OpsKalenderLista.jsx";
import { useKalenderSynlighet } from "../lib/useKalenderSynlighet.js";

/**
 * Sektionerna på båda språken med appens deklaration (0.151.0, granskningen av PR 458, fynd 4).
 *
 * Appen (lifehub.app `kalenderlista.js`) deklarerar sina sektioner på svenska. Raderna utan `sektion` ska hamna i dem på varje språk; bara rubriken översätts.
 */

const KAL = [
  { id: "g", namn: "Styrelsen", farg: 4, grupp: true, forvald: true },
  { id: "m", namn: "Privat", farg: 5 },
  { id: "a", namn: "Apple", farg: 2, sektion: "Från Mitt konto" },
];
/** Appens deklaration, som den står i lifehub.app. */
const APPENS = [{ namn: "Gruppens kalendrar" }, { namn: "Mina kalendrar", tomText: "Du har inga egna kalendrar ännu." }, { namn: "Från Mitt konto", tomText: "Inget här ännu." }];

/** @param {{ kalendrar?: any[], sektioner?: any, sprak: string }} p */
function Lista({ kalendrar = KAL, sektioner, sprak }) {
  const syn = useKalenderSynlighet({ kalendrar });
  return <OpsKalenderLista kalendrar={kalendrar} syn={syn} sektioner={sektioner} sprak={sprak} />;
}
/** @param {Record<string, any>} p */
function sektioner(p) {
  const { container } = render(<Lista {.../** @type {any} */ (p)} />);
  return [...container.querySelectorAll("[data-kalendersektion]")].map((s) => ({
    rubrik: s.getAttribute("data-kalendersektion"),
    rader: [...s.querySelectorAll("[data-kalenderrad]")].map((r) => r.getAttribute("data-kalenderrad")),
    tom: s.querySelector("[data-kalendersektion-tom]")?.textContent ?? null,
  }));
}

describe("appens deklaration på svenska och engelska", () => {
  it("svenska: som förut", () => {
    expect(sektioner({ sprak: "sv", sektioner: APPENS })).toEqual([
      { rubrik: "Gruppens kalendrar", rader: ["g"], tom: null },
      { rubrik: "Mina kalendrar", rader: ["m"], tom: null },
      { rubrik: "Från Mitt konto", rader: ["a"], tom: null },
    ]);
  });

  it("⛔ engelska: raderna står i appens sektioner, inga nya sektioner uppstår, och bara rubriken översätts", () => {
    const s = sektioner({ sprak: "en", sektioner: APPENS });
    expect(s).toEqual([
      { rubrik: "Group calendars", rader: ["g"], tom: null },
      { rubrik: "My calendars", rader: ["m"], tom: null },
      { rubrik: "Från Mitt konto", rader: ["a"], tom: null },
    ]);
  });

  it("⛔ appens tomText är appens ord och översätts inte; en sektion utan rader visar den, också på engelska", () => {
    const s = sektioner({ sprak: "en", sektioner: APPENS, kalendrar: [KAL[0]] });
    expect(s).toEqual([
      { rubrik: "Group calendars", rader: ["g"], tom: null },
      { rubrik: "My calendars", rader: [], tom: "Du har inga egna kalendrar ännu." },
      { rubrik: "Från Mitt konto", rader: [], tom: "Inget här ännu." },
    ]);
  });

  it("en rad som själv bär standardnamnet som sektion, på något språk, binds till samma sektion", () => {
    const kal = [{ ...KAL[0], sektion: "Gruppens kalendrar" }, { ...KAL[1], sektion: "My calendars" }];
    expect(sektioner({ sprak: "en", sektioner: APPENS, kalendrar: kal }).slice(0, 2)).toEqual([
      { rubrik: "Group calendars", rader: ["g"], tom: null },
      { rubrik: "My calendars", rader: ["m"], tom: null },
    ]);
  });

  it("utan deklaration: listans förval på listans språk, med tomraden", () => {
    expect(sektioner({ sprak: "en", kalendrar: [KAL[0]] })).toEqual([
      { rubrik: "Group calendars", rader: ["g"], tom: null },
      { rubrik: "My calendars", rader: [], tom: "You have no calendars of your own yet." },
    ]);
  });

  it("appens egna sektionsnamn ritas som de är på varje språk", () => {
    const s = sektioner({ sprak: "en", sektioner: [{ namn: "Ärenden" }], kalendrar: [{ id: "x", namn: "X", farg: 1, sektion: "Ärenden" }] });
    expect(s).toEqual([{ rubrik: "Ärenden", rader: ["x"], tom: null }]);
  });
});

describe("⛔ en egen sektion kan heta vad som helst, också något som ser ut som en intern nyckel (kontrollgranskningen av PR 458, fynd 4)", () => {
  const KAL2 = [
    { id: "g", namn: "Styrelsen", farg: 4, grupp: true, forvald: true },
    { id: "m", namn: "Privat", farg: 5 },
    { id: "e1", namn: "Ett", farg: 1, sektion: "mina" },
    { id: "e2", namn: "Två", farg: 2, sektion: "grupp" },
    { id: "e3", namn: "Tre", farg: 3, sektion: "standard:grupp" },
    { id: "e4", namn: "Fyra", farg: 6, sektion: "standard:mina" },
  ];
  it.each(["sv", "en"])("%s: varje egen sektion är sin egen, och standardsektionerna behåller sina rader", (sprak) => {
    const s = sektioner({ sprak, kalendrar: KAL2 });
    const standard = sprak === "sv" ? ["Gruppens kalendrar", "Mina kalendrar"] : ["Group calendars", "My calendars"];
    expect(s).toEqual([
      { rubrik: standard[0], rader: ["g"], tom: null },
      { rubrik: standard[1], rader: ["m"], tom: null },
      { rubrik: "mina", rader: ["e1"], tom: null },
      { rubrik: "grupp", rader: ["e2"], tom: null },
      { rubrik: "standard:grupp", rader: ["e3"], tom: null },
      { rubrik: "standard:mina", rader: ["e4"], tom: null },
    ]);
  });

  it("en deklarerad egen sektion som heter 'mina' är inte Mina kalendrar", () => {
    const s = sektioner({ sprak: "sv", kalendrar: KAL2.slice(0, 3), sektioner: [{ namn: "Gruppens kalendrar" }, { namn: "Mina kalendrar", tomText: "Tomt." }, { namn: "mina", tomText: "Egen tom." }] });
    expect(s.map((x) => [x.rubrik, x.rader])).toEqual([
      ["Gruppens kalendrar", ["g"]],
      ["Mina kalendrar", ["m"]],
      ["mina", ["e1"]],
    ]);
  });
});

