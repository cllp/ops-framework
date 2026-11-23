import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OpsJobb, jobbschemaForSteg } from "../components/OpsJobb.jsx";

/**
 * `OpsJobb` (0.256.0, cllp/lifehub.app#888): raderna, läget, schemat, nästa körning, senaste utfallet och Kör nu.
 * Väljarna bygger på Radix och drivs med `userEvent`, som i `bibliotek-vy.test.jsx`.
 */

const TYPER = {
  bank: { namn: "Banksynk", steg: ["dag", "vecka", "manad"] },
  paminnelse: { namn: "Påminnelse", steg: ["timme", "dag", "vecka", "manad"] },
};

const JOBB = [
  {
    id: "bank-g1",
    typ: "bank",
    lage: "skarp",
    schema: { steg: "dag", tid: "06:15" },
    nastaKorning: new Date(2026, 10, 24, 6, 15),
    senast: { tid: new Date(2026, 10, 23, 6, 15), utfall: "ok", paborjat: 12, bekraftat: 12 },
  },
  { id: "pam-g1", typ: "paminnelse", lage: "av", schema: { steg: "timme", minut: 30 }, nastaKorning: null, senast: { tid: new Date(2026, 10, 22, 9, 30), utfall: "fel", kod: "bank-nere" } },
];

function oppetLofte() {
  /** @type {(v?: unknown) => void} */ let klar = () => {};
  const p = new Promise((a) => {
    klar = a;
  });
  return { p, klar };
}

describe("OpsJobb", () => {
  it("ritar en rad per jobb: namn, nästa körning och senaste utfallet på en rad", () => {
    render(<OpsJobb jobb={JOBB} typer={TYPER} onSpara={vi.fn()} onKorNu={vi.fn()} kanAndra />);
    const bank = /** @type {HTMLElement} */ (document.querySelector("[data-jobb='bank-g1']"));
    expect(within(bank).getByText("Banksynk")).toBeInTheDocument();
    expect(within(bank).getByText("Nästa körning: 24 nov 06:15")).toBeInTheDocument();
    expect(within(bank).getByText("Senast 23 nov 06:15: 12 påbörjade, 12 bekräftade")).toBeInTheDocument();
    const pam = /** @type {HTMLElement} */ (document.querySelector("[data-jobb='pam-g1']"));
    expect(within(pam).getByText("Nästa körning: inte, jobbet är av")).toBeInTheDocument();
    expect(within(pam).getByText("Senast 22 nov 09:30: fel (bank-nere)")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Läge för Banksynk" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Hur ofta Banksynk körs" })).toHaveTextContent("Varje dag");
    expect(screen.getByRole("combobox", { name: "Tid för Banksynk" })).toHaveTextContent("06:15");
    expect(screen.getByRole("combobox", { name: "Minut för Påminnelse" })).toHaveTextContent(":30");
  });

  it("ett jobb som aldrig körts säger det, och tom lista är ett tomt läge", () => {
    const { unmount } = render(<OpsJobb jobb={[{ id: "a", typ: "bank", lage: "prov", schema: { steg: "dag", tid: "06:00" } }]} typer={TYPER} onSpara={vi.fn()} onKorNu={vi.fn()} kanAndra />);
    expect(screen.getByText("Senast: har inte körts")).toBeInTheDocument();
    expect(screen.getByText("Nästa körning: inte planerad")).toBeInTheDocument();
    unmount();
    render(<OpsJobb jobb={[]} typer={TYPER} onSpara={vi.fn()} onKorNu={vi.fn()} kanAndra />);
    expect(screen.getByRole("status")).toHaveTextContent("Inga jobb ännu");
  });

  it("utan kanAndra är raden text: inga väljare, inget läge att byta och ingen Kör nu", () => {
    render(<OpsJobb jobb={JOBB} typer={TYPER} onSpara={vi.fn()} onKorNu={vi.fn()} kanAndra={false} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("button", { name: /Kör/ })).toBeNull();
    expect(screen.getByText("Skarpt. Varje dag 06:15")).toBeInTheDocument();
    expect(screen.getByText("Av. Varje timme kl :30")).toBeInTheDocument();
  });

  it("Kör nu anropar onKorNu, väntar med Kör… och är av för ett avslaget jobb", async () => {
    const l = oppetLofte();
    const onKorNu = vi.fn(() => l.p);
    render(<OpsJobb jobb={JOBB} typer={TYPER} onSpara={vi.fn()} onKorNu={onKorNu} kanAndra />);
    const knapp = screen.getByRole("button", { name: "Kör Banksynk nu" });
    fireEvent.click(knapp);
    expect(onKorNu).toHaveBeenCalledWith("bank-g1");
    expect(knapp.getAttribute("aria-busy")).toBe("true");
    expect(knapp).toHaveTextContent("Kör…");
    await act(async () => {
      l.klar();
      await l.p;
    });
    expect(knapp.getAttribute("aria-busy")).toBeNull();
    expect(screen.getByRole("button", { name: "Kör Påminnelse nu" })).toBeDisabled();
  });

  it("ett fel från Kör nu står vid raden", async () => {
    render(<OpsJobb jobb={JOBB} typer={TYPER} onSpara={vi.fn()} onKorNu={() => Promise.reject(new Error("nej"))} kanAndra />);
    fireEvent.click(screen.getByRole("button", { name: "Kör Banksynk nu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Jobbet kunde inte startas.");
  });

  it("läget sparas när det väljs, med Sparar… medan servern svarar", async () => {
    const l = oppetLofte();
    const onSpara = vi.fn(() => l.p);
    render(<OpsJobb jobb={JOBB} typer={TYPER} onSpara={onSpara} onKorNu={vi.fn()} kanAndra />);
    fireEvent.click(within(screen.getByRole("tablist", { name: "Läge för Banksynk" })).getByRole("tab", { name: "Prov" }));
    expect(onSpara).toHaveBeenCalledWith({ id: "bank-g1", typ: "bank", lage: "prov", schema: { steg: "dag", tid: "06:15" } });
    expect(screen.getByText("Sparar…")).toBeInTheDocument();
    await act(async () => {
      l.klar();
      await l.p;
    });
    expect(screen.queryByText("Sparar…")).toBeNull();
  });

  it("stegväljaren visar bara typens steg, och ett byte sparar ett helt schema", async () => {
    const user = userEvent.setup();
    const onSpara = vi.fn(() => Promise.resolve());
    render(<OpsJobb jobb={JOBB} typer={TYPER} onSpara={onSpara} onKorNu={vi.fn()} kanAndra />);
    await user.click(screen.getByRole("combobox", { name: "Hur ofta Banksynk körs" }));
    expect(screen.queryByRole("option", { name: "Varje timme" })).toBeNull();
    await user.click(screen.getByRole("option", { name: "Varje vecka" }));
    expect(onSpara).toHaveBeenCalledWith({ id: "bank-g1", typ: "bank", lage: "skarp", schema: { steg: "vecka", tid: "06:15", veckodag: 1 } });
  });

  it("ett fel från onSpara står vid raden", async () => {
    render(<OpsJobb jobb={JOBB} typer={TYPER} onSpara={() => Promise.reject(new Error("nej"))} onKorNu={vi.fn()} kanAndra />);
    fireEvent.click(within(screen.getByRole("tablist", { name: "Läge för Banksynk" })).getByRole("tab", { name: "Av" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ändringen kunde inte sparas.");
  });

  it("jobbschemaForSteg behåller tiden och ger stegets förval", () => {
    const s = { steg: /** @type {const} */ ("dag"), tid: "07:45" };
    expect(jobbschemaForSteg("timme", s)).toEqual({ steg: "timme", minut: 45 });
    expect(jobbschemaForSteg("manad", s)).toEqual({ steg: "manad", tid: "07:45", dag: 1 });
    expect(jobbschemaForSteg("dag", { steg: "vecka", tid: "07:45", veckodag: 3 })).toEqual({ steg: "dag", tid: "07:45" });
  });
});
