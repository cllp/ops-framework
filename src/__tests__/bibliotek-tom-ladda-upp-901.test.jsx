import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost } from "../lib/bibliotek.js";

/*
 * 0.245.0, cllp/lifehub.app#901. CP 2026-11-19: "När biblioteket är tomt, skulle behöva en större Ladda upp, att man drar släpper är bra, men
 * kanske en tydligare ladda upp." På telefonen finns inget att dra från, så där är knappen den enda vägen från det tomma biblioteket.
 *
 * Tomläget är en rad och en knapp (`OpsEmpty`, interaktionsdesign avsnitt 2). Knappen öppnar filväljaren, och de valda filerna går samma väg
 * som ett släpp på listan: prövas, laddas upp en i taget, och beskeden står ovanför.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };

/** @param {{ poster?: any[], onLaddaUpp?: (p: { rubrik: string, fil: File }) => Promise<unknown>, jag?: any }} p */
function Bibliotek({ poster = [], onLaddaUpp, jag = { uid: "uid-1", roll: "medlem" } }) {
  return (
    <OpsBibliotek
      poster={poster}
      fel={null}
      jag={jag}
      vald={null}
      skapar={null}
      onOppna={() => {}}
      onStang={() => {}}
      onSkapa={() => {}}
      onSpara={() => {}}
      onLaddaUpp={onLaddaUpp}
      hubHref="/hub"
    />
  );
}

const tomlage = () => {
  const yta = screen.getByText("Biblioteket är tomt.").closest("[role='status']");
  if (!(yta instanceof HTMLElement)) throw new Error("Tomläget ritades inte.");
  return yta;
};

afterEach(() => vi.restoreAllMocks());

describe("Biblioteket tomt: knappen Ladda upp (#901)", () => {
  it("⛔ tomläget har knappen Ladda upp, den öppnar filväljaren, och valda filer laddas upp", async () => {
    const onLaddaUpp = vi.fn(async () => {});
    render(<Bibliotek onLaddaUpp={onLaddaUpp} />);
    const knapp = within(tomlage()).getByRole("button", { name: "Ladda upp" });
    const falt = /** @type {HTMLInputElement} */ (document.querySelector("input[type='file'][data-bibliotek-ladda-upp]"));
    expect(falt).not.toBeNull();
    expect(falt.multiple).toBe(true);
    const oppnar = vi.spyOn(falt, "click").mockImplementation(() => {});
    fireEvent.click(knapp);
    expect(oppnar).toHaveBeenCalledTimes(1);

    const pdf = new File(["%PDF"], "Avtal.pdf", { type: "application/pdf" });
    const bild = new File(["x"], "kvitto.jpg", { type: "image/jpeg" });
    fireEvent.change(falt, { target: { files: [pdf, bild] } });
    await waitFor(() => expect(document.querySelector("[data-bibliotek-slapp-klar]")?.textContent).toMatch(/2 filer/));
    expect(onLaddaUpp.mock.calls.map(([p]) => /** @type {any} */ (p).rubrik)).toEqual(["Avtal", "kvitto"]);
    expect(onLaddaUpp.mock.calls.map(([p]) => /** @type {any} */ (p).fil)).toEqual([pdf, bild]);
  });

  it("⛔ ingen knapp utan inloggning eller utan uppladdning kopplad: tomläget lovar inget som inte går", () => {
    const { unmount } = render(<Bibliotek jag={null} onLaddaUpp={async () => {}} />);
    expect(within(tomlage()).queryByRole("button", { name: "Ladda upp" })).toBeNull();
    unmount();
    render(<Bibliotek />);
    expect(within(tomlage()).queryByRole("button", { name: "Ladda upp" })).toBeNull();
  });

  it("en sökning utan träffar har ingen knapp: biblioteket är inte tomt, bara sökningen", () => {
    const post = { ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade.", skapadAv: skapare, skapad: tid, andrad: tid }), id: "a" };
    render(<Bibliotek poster={[post]} onLaddaUpp={async () => {}} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "finns inte" } });
    const tom = screen.getByText("Inga träffar.").closest("[role='status']");
    expect(tom).not.toBeNull();
    expect(within(/** @type {HTMLElement} */ (tom)).queryByRole("button", { name: "Ladda upp" })).toBeNull();
  });
});
