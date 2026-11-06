import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { GASTGRUPPATGARDER } from "../lib/gast.js";

/*
 * 0.196.0: gästen svarar med citat och startar en tråd, med samma meny som medlemmens chatt. CP 2026-11-06 (via koordinatorn): "Det enda jag undrar är chatt trådar. Finns ju i appen idag."
 *
 * Före 0.196.0 visade gästens chatt bara "N svar" när det redan fanns svar, och `citat: { pa: false }`: gästen kunde varken starta en tråd eller citera.
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4), utfallen står i PR-texten. Tjänstens sida (att `skrivChatt` tar emot `svarPa` i gruppens chatt och nekar det i en tråd) provas i `gast-grupp-tjanst.test.js`.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => {
  vi.restoreAllMocks();
});

const GRUPP = { namn: "Källan", funktioner: ["chatt"] };
const T = (m) => Date.UTC(2026, 9, 19, 9, m);

function apiMed(meddelanden) {
  /** @type {Array<[string, any]>} */
  const logg = [];
  const svar = {
    chatt: async ({ trad } = {}) =>
      trad ? { ok: true, rot: meddelanden.find((m) => m.id === trad) ?? null, meddelanden: [], fler: false } : { ok: true, meddelanden, fler: false },
    skrivChatt: async ({ text, svarPa }) => ({
      ok: true,
      meddelande: { id: `ny-${logg.length}`, av: { namn: "Anna" }, text, tid: T(30), gast: true, egen: true, ...(svarPa ? { svarPa: { id: svarPa, namn: "Agda Ägare", text: "Välkommen" } } : {}) },
    }),
  };
  const api = Object.fromEntries(
    GASTGRUPPATGARDER.map((a) => [
      a,
      vi.fn(async (args) => {
        logg.push([a, args]);
        return svar[a] ? svar[a](args ?? {}) : { ok: false, orsak: "nej" };
      }),
    ]),
  );
  return { api, logg };
}

const MEDDELANDEN = [
  { id: "m1", av: { namn: "Agda Ägare" }, text: "Välkommen", tid: T(0) },
  { id: "m2", av: { namn: "Maja Medlem" }, text: "Hej alla", tid: T(5) },
];

async function rita(meddelanden = MEDDELANDEN) {
  const m = apiMed(meddelanden);
  render(<OpsGastGrupp grupp={GRUPP} api={m.api} intervallMs={0} idag={new Date(2026, 9, 20)} />);
  const flik = screen.queryByRole("tab", { name: "Chatt" });
  if (flik) {
    await act(async () => {
      fireEvent.mouseDown(flik, { button: 0 });
    });
  }
  await screen.findByText("Välkommen", { selector: "[data-bubbla] *" });
  return m;
}

/** Menyn på ett meddelande: ⋮ på raden (som på telefon i jsdom, där bredden inte är "bred"). */
async function menyFor(/** @type {string} */ text) {
  const rad = /** @type {HTMLElement} */ (screen.getByText(text, { selector: "[data-bubbla] *" }).closest("[data-meddelande]"));
  const knapp = within(rad).getByRole("button", { name: /Svara på|Ditt meddelande|Mer|Åtgärder/ });
  await act(async () => {
    fireEvent.pointerDown(knapp, { button: 0, pointerType: "mouse" });
    fireEvent.click(knapp);
  });
  return screen.findByRole("menu");
}

describe("gästens meny på ett meddelande: Svara och Svara i tråd, och inget annat", () => {
  it("menyn har Svara med citat och Svara i tråd, men inga reaktioner, ingen nål, ingen redigering och ingen radering", async () => {
    await rita();
    const meny = await menyFor("Hej alla");
    const val = within(meny).getAllByRole("menuitem").map((e) => (e.textContent ?? "").trim());
    expect(val).toContain("Svara med citat");
    expect(val).toContain("Svara i tråd");
    for (const nej of [/Reagera/, /Fäst/, /Ändra|Redigera/, /Radera|Ta bort/]) expect(val.some((v) => nej.test(v)), String(nej)).toBe(false);
    expect(document.querySelector("[data-mer-reaktioner]")).toBeNull();
  });

  it("⛔ Svara i tråd på ett meddelande utan svar öppnar tråden, och gästens svar skickar skrivChatt({ trad })", async () => {
    const { logg } = await rita();
    expect(screen.queryByRole("button", { name: /\d+ svar/ })).toBeNull();
    const meny = await menyFor("Hej alla");
    await act(async () => {
      fireEvent.click(within(meny).getByRole("menuitem", { name: "Svara i tråd" }));
    });
    const trad = await waitFor(() => {
      const el = document.querySelector('[data-gast-chatt-trad="m2"]');
      expect(el).not.toBeNull();
      return /** @type {HTMLElement} */ (el);
    });
    expect(logg).toContainEqual(["chatt", { trad: "m2" }]);
    const falt = await within(trad).findByRole("textbox");
    fireEvent.change(falt, { target: { value: "Första svaret" } });
    await act(async () => {
      fireEvent.click(within(trad).getByRole("button", { name: "Skicka" }));
    });
    await waitFor(() => expect(logg).toContainEqual(["skrivChatt", { trad: "m2", text: "Första svaret" }]));
  });

  it("⛔ Svara med citat visar Svarar på, och skrivChatt får svarPa med det citerade meddelandets id; citatet ritas på svaret", async () => {
    const { logg } = await rita();
    const meny = await menyFor("Välkommen");
    await act(async () => {
      fireEvent.click(within(meny).getByRole("menuitem", { name: "Svara med citat" }));
    });
    const rad = await waitFor(() => {
      const el = document.querySelector('[data-svarar-pa="m1"]');
      expect(el).not.toBeNull();
      return /** @type {HTMLElement} */ (el);
    });
    expect(rad.textContent).toContain("Svarar på");
    expect(rad.textContent).toContain("Agda Ägare");
    const falt = screen.getByRole("textbox", { name: /Skriv|Meddelande/ });
    fireEvent.change(falt, { target: { value: "Tack!" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    });
    await waitFor(() => expect(logg).toContainEqual(["skrivChatt", { text: "Tack!", svarPa: "m1" }]));
    await waitFor(() => expect(document.querySelector("[data-svarar-pa]")).toBeNull());
    const svar = /** @type {HTMLElement} */ (screen.getByText("Tack!", { selector: "[data-bubbla] *" }).closest("[data-meddelande]"));
    const citat = /** @type {HTMLElement} */ (svar.querySelector('[data-citat="m1"]'));
    expect(citat).not.toBeNull();
    expect(citat.textContent).toBe("Agda Ägare: Välkommen");
  });

  it("⛔ ett citerat meddelande som inte finns bland de hämtade står med tjänstens eget citat, som före 0.196.0", async () => {
    await rita([...MEDDELANDEN, { id: "m3", av: { namn: "Bo" }, text: "Svar på något gammalt", tid: T(9), svarPa: { id: "gammalt", namn: "Agda Ägare", text: "Det gamla" } }]);
    const citat = /** @type {HTMLElement} */ (document.querySelector('[data-citat="gammalt"]'));
    expect(citat).not.toBeNull();
    expect(citat.querySelector("[data-citat-saknas]")).toBeNull();
    expect(citat.textContent).toBe("Agda Ägare: Det gamla");
  });

  it("⛔ ett citat utan text, varken bland de hämtade eller från tjänsten, står med appens ord för det, Meddelandet går inte att läsa", async () => {
    await rita([...MEDDELANDEN, { id: "m3", av: { namn: "Bo" }, text: "Svar på något gammalt", tid: T(9), svarPa: /** @type {any} */ ({ id: "gammalt" }) }]);
    const citat = /** @type {HTMLElement} */ (document.querySelector('[data-citat="gammalt"]'));
    expect(citat).not.toBeNull();
    expect(citat.querySelector("[data-citat-saknas]")).not.toBeNull();
    expect(citat.textContent).toBe("Meddelandet går inte att läsa.");
  });
});
