import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastSida } from "../components/OpsGastSida.jsx";
import { OpsGruppanel, OpsGruppvaxlare } from "../components/OpsGruppanel.jsx";
import { sparaGastSession } from "../index.js";

/**
 * Gästgrupperna i hubben (0.188.0, cllp/lifehub.app#658 punkt 0): märket Gäst i grupplistan, och sessionen som hubben sparar så att `/gast` öppnar gruppen utan länk.
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => vi.restoreAllMocks());

const ID = "b".repeat(64);
const ANNAT_ID = "c".repeat(64);
const SESSION = "T".repeat(43);

const GRUPPER = [
  { id: "egen", namn: { sv: "Egen" }, medlemsantal: 2, roll: "agare" },
  { id: "gast:1", namn: { sv: "Källan" }, roll: "gast" },
];

describe("märket Gäst i grupplistan", () => {
  it("panelen: pillen säger Gäst, och en gästgrupp har varken (i) eller penna medan en egen grupp har dem", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv="egen" onValj={() => {}} onInfo={() => {}} onRedigera={() => {}} />);
    const gast = screen.getByText("Källan").closest("li");
    expect(within(gast).getByText("Gäst")).toBeInTheDocument();
    expect(within(gast).queryByRole("button", { name: "Visa grupp" })).not.toBeInTheDocument();
    expect(within(gast).queryByRole("button", { name: "Redigera grupp" })).not.toBeInTheDocument();
    const egen = screen.getByText("Egen").closest("li");
    expect(within(egen).getByRole("button", { name: "Visa grupp" })).toBeInTheDocument();
    expect(within(egen).getByText("Ägare")).toBeInTheDocument();
  });

  it("panelen på engelska: Guest", () => {
    render(<OpsGruppanel grupper={GRUPPER} aktiv="egen" onValj={() => {}} sprak="en" />);
    expect(within(screen.getByText("Källan").closest("li")).getByText("Guest")).toBeInTheDocument();
  });

  it("ett tryck på gästgruppen anropar onValj med dess id, som en annan grupp", () => {
    const onValj = vi.fn();
    render(<OpsGruppanel grupper={GRUPPER} aktiv="egen" onValj={onValj} />);
    fireEvent.click(screen.getByRole("button", { name: "Källan" }));
    expect(onValj).toHaveBeenCalledWith("gast:1");
  });

  it("växlaren (arket på telefon): samma märke", () => {
    render(<OpsGruppvaxlare grupper={GRUPPER} aktiv="egen" onValj={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Byt grupp/ }));
    const rad = screen.getAllByRole("button", { name: "Källan" })[0].closest("li");
    expect(within(rad).getByText("Gäst")).toBeInTheDocument();
  });
});

describe("sparaGastSession", () => {
  const lagringMed = (start = {}) => {
    const d = { ...start };
    return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; }, d };
  };

  it("skriver samma tre nycklar som en inlösen: sessionen, senaste och indexet (nyast först)", () => {
    const lagring = lagringMed({ "ops-gast:alla": JSON.stringify([ANNAT_ID]), [`ops-gast:${ANNAT_ID}`]: "U".repeat(43) });
    expect(sparaGastSession({ id: ID, sessionsnyckel: SESSION, lagring })).toBe(true);
    expect(lagring.d[`ops-gast:${ID}`]).toBe(SESSION);
    expect(lagring.d["ops-gast:senaste"]).toBe(ID);
    expect(JSON.parse(lagring.d["ops-gast:alla"])).toEqual([ID, ANNAT_ID]);
  });

  it("kastar för ett id eller en nyckel av fel form och skriver ingenting", () => {
    const lagring = lagringMed();
    expect(() => sparaGastSession({ id: "kort", sessionsnyckel: SESSION, lagring })).toThrow(/sparaGastSession/);
    expect(() => sparaGastSession({ id: ID, sessionsnyckel: "kort", lagring })).toThrow(/sparaGastSession/);
    expect(lagring.d).toEqual({});
  });

  it("säger falskt när enhetens minne inte tar emot skrivningen (privat läge), i stället för att låtsas", () => {
    const blockerad = { getItem: () => null, setItem: () => { throw new Error("blockerad"); }, removeItem: () => {} };
    expect(sparaGastSession({ id: ID, sessionsnyckel: SESSION, lagring: blockerad })).toBe(false);
  });

  it("⛔ SIDAN ÖPPNAR DEN SPARADE SESSIONEN UTAN LÄNK: /gast hämtar gruppen med nyckeln hubben sparade", async () => {
    sparaGastSession({ id: ID, sessionsnyckel: SESSION });
    const onHamta = vi.fn(async () => ({ ok: true, namn: "", funktion: "grupp", grupp: { namn: "Källan", funktioner: ["chatt"] } }));
    render(
      <OpsGastSida lank={null} onLos={vi.fn()} onHamta={onHamta} onNyLank={vi.fn()} renderGrupp={({ grupp }) => <div data-grupp="">{grupp.namn}</div>} intervallMs={0} />,
    );
    await waitFor(() => expect(document.querySelector("[data-grupp]")).not.toBeNull());
    expect(onHamta).toHaveBeenCalledWith({ sessionsnyckel: SESSION });
    expect(document.querySelector("[data-grupp]").textContent).toBe("Källan");
  });
});
