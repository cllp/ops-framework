import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { GASTGRUPPATGARDER } from "../lib/gast.js";

/**
 * ⛔ ETT FEL I EN GÄSTFLIK FÖLJER SPRÅKET OCH GÅR ATT FÖRSÖKA IGEN (0.192.0, cllp/lifehub.app#675). Mätt på live (v1.0.1125, ramverket 0.191.0):
 * kalendern stod på "Hämtar" länge, visade sedan "That did not work right now. Try again." fast svenska var valt, hade ingen knapp att försöka
 * igen med, och felet stod kvar efter ett flikbyte tills sidan laddades om.
 *
 * Tre orsaker, alla i OpsGastGrupp: felets TEXT sparades i tillståndet av `ladda`, vars `t` var den första renderingens (useCallback med `[kor]`),
 * så språket följde inte med när appen satte det efter starten. Felet rensades bara av en lyckad hämtning, och vyn visade felet före väntan,
 * så en ny hämtning syntes inte. Och ingen knapp fanns.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => {
  vi.restoreAllMocks();
});

const GRUPP = { namn: "Källan", funktioner: ["chatt", "kalender", "bibliotek", "arenden"] };
const valjFlik = async (namn) => {
  await act(async () => {
    fireEvent.mouseDown(screen.getByRole("tab", { name: namn }), { button: 0 });
  });
};

/** Ett api där varje åtgärd kan bytas. Förval: tomma svar. */
function apiMed(extra = {}) {
  const svar = {
    chatt: async () => ({ ok: true, meddelanden: [], fler: false }),
    kalender: async () => ({ ok: true, handelser: [], kalendrar: [], avkortad: false, ejVisade: 0 }),
    bibliotek: async () => ({ ok: true, poster: [], avkortad: false }),
    arenden: async () => ({ ok: true, poster: [], avkortad: false }),
    ...extra,
  };
  return Object.fromEntries(GASTGRUPPATGARDER.map((a) => [a, vi.fn(async (args) => (svar[a] ? svar[a](args ?? {}) : { ok: false, orsak: "nej" }))]));
}

/** Ett anrop som faller som nätet gör: ett avvisat löfte, alltså `kundeInte`. */
const nat = () => Promise.reject(new Error("Failed to fetch"));

describe("#675: felet i en gästflik", () => {
  it("står på det språk som gäller när det visas, också när appen bytt språk efter starten", async () => {
    const api = apiMed({ kalender: nat });
    const { rerender } = render(<OpsGastGrupp grupp={GRUPP} api={api} intervallMs={0} sprak="en" />);
    rerender(<OpsGastGrupp grupp={GRUPP} api={api} intervallMs={0} sprak="sv" />);
    await valjFlik("Kalender");
    expect(await screen.findByText("Det gick inte just nu. Försök igen.")).toBeInTheDocument();
    expect(screen.queryByText("That did not work right now. Try again.")).toBeNull();
    // Och åt andra hållet: ett fel som redan står följer med när språket byts.
    rerender(<OpsGastGrupp grupp={GRUPP} api={api} intervallMs={0} sprak="en" />);
    expect(await screen.findByText("That did not work right now. Try again.")).toBeInTheDocument();
  });

  it("har en Försök igen som hämtar fliken på nytt och visar den när det går", async () => {
    let gang = 0;
    const api = apiMed({ kalender: async () => (++gang === 1 ? nat() : { ok: true, handelser: [], kalendrar: [], avkortad: false, ejVisade: 0 }) });
    render(<OpsGastGrupp grupp={GRUPP} api={api} intervallMs={0} sprak="sv" />);
    await valjFlik("Kalender");
    await screen.findByText("Det gick inte just nu. Försök igen.");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Försök igen" }));
    });
    expect(api.kalender).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Inget på gång i gruppen.")).toBeInTheDocument();
    expect(screen.queryByText("Det gick inte just nu. Försök igen.")).toBeNull();
  });

  it("en ny hämtning efter ett flikbyte visar väntan, inte det gamla felet", async () => {
    let los = () => {};
    let gang = 0;
    const api = apiMed({
      kalender: () => (++gang === 1 ? nat() : new Promise((r) => { los = () => r({ ok: true, handelser: [], kalendrar: [], avkortad: false, ejVisade: 0 }); })),
    });
    render(<OpsGastGrupp grupp={GRUPP} api={api} intervallMs={0} sprak="sv" />);
    await valjFlik("Kalender");
    await screen.findByText("Det gick inte just nu. Försök igen.");
    await valjFlik("Chatt");
    await valjFlik("Kalender");
    await waitFor(() => expect(api.kalender).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Det gick inte just nu. Försök igen.")).toBeNull();
    expect(document.querySelector("[data-gast-kalender] [aria-busy='true'], [aria-busy='true']")).not.toBeNull();
    await act(async () => los());
    expect(await screen.findByText("Inget på gång i gruppen.")).toBeInTheDocument();
  });

  it("biblioteket, chatten och ärendena har samma Försök igen", async () => {
    // Ärendefliken syns bara med ärenden eller ett fel, och ärendena hämtas direkt (se gast-grupp-vy).
    for (const [flik, atgard] of [["Bibliotek", "bibliotek"], ["Chatt", "chatt"], ["Ärenden", "arenden"]]) {
      let gang = 0;
      // Ärendena hämtas direkt och en gång till när fliken väljs (den har ingen data än), så båda faller innan knappen trycks.
      const fall = atgard === "arenden" ? 2 : 1;
      const ok = atgard === "chatt" ? { ok: true, meddelanden: [], fler: false } : { ok: true, poster: [], avkortad: false };
      const api = apiMed({ [atgard]: async () => (++gang <= fall ? nat() : ok) });
      const { unmount } = render(<OpsGastGrupp grupp={GRUPP} api={api} intervallMs={0} sprak="sv" />);
      if (atgard === "arenden") await waitFor(() => expect(screen.getByRole("tab", { name: flik })).toBeInTheDocument());
      await valjFlik(flik);
      const knapp = await screen.findByRole("button", { name: "Försök igen" }).catch(() => { throw new Error(`ingen Försök igen i ${flik}`); });
      await act(async () => {
        fireEvent.click(knapp);
      });
      expect(api[atgard], flik).toHaveBeenCalledTimes(fall + 1);
      await waitFor(() => expect(screen.queryByRole("button", { name: "Försök igen" }), flik).toBeNull());
      unmount();
    }
  });

  it("ärendefliken står kvar medan Försök igen hämtar, i stället för att försvinna under gästen", async () => {
    let gang = 0;
    let los = () => {};
    const api = apiMed({
      arenden: () => (++gang <= 2 ? nat() : new Promise((r) => { los = () => r({ ok: true, poster: [], avkortad: false }); })),
    });
    render(<OpsGastGrupp grupp={GRUPP} api={api} intervallMs={0} sprak="sv" />);
    await waitFor(() => expect(screen.getByRole("tab", { name: "Ärenden" })).toBeInTheDocument());
    await valjFlik("Ärenden");
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Försök igen" }));
    });
    expect(api.arenden).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("tab", { name: "Ärenden" })).toBeInTheDocument();
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
    // Svaret är tomt: då har gästen inga ärenden, och fliken går.
    await act(async () => los());
    await waitFor(() => expect(screen.queryByRole("tab", { name: "Ärenden" })).toBeNull());
  });
});
