import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsIconLink } from "../components/OpsIconLink.jsx";

/**
 * ⛔ HUSET GÅR TILL GRUPPENS START (0.227.0). CP 2026-11-14: "Kör på hemknappen. Jag tänker att gruppens Hem är viktig att ha också,
 * det är där översikten för gruppen är. Så hemikonen makes sense där." Med `grupper.hem` går husikonen till den aktuella gruppens
 * start, och vägen till Översikten och den egna gruppen går genom växlaren. Utan `hem` är allt som förut (`hemikon.test.jsx`).
 */

const fasta = { idag: { href: "/idag" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const lista = [
  { id: "g1", namn: "Bolaget", roll: "agare" },
  { id: "g2", namn: "Travel", roll: "medlem" },
];
const meny = { sektioner: [], onLoggaUt: () => {} };

/** @param {{ hem?: any, oversikt?: any, onValj?: (id: string) => void, sprak?: string }} p */
function Skal({ hem, oversikt, onValj = () => {}, sprak }) {
  return (
    <OpsAppShell
      brand="Ops"
      fasta={fasta}
      activeHref="/idag"
      anvandare={<OpsIconLink href="/profil" label="Min profil" icon={<i />} />}
      meny={meny}
      grupper={{ lista, aktiv: "g2", onValj, ...(sprak ? { sprak } : {}), ...(oversikt ? { oversikt } : {}), ...(hem !== undefined ? { hem } : {}) }}
    >
      <p>innehåll</p>
    </OpsAppShell>
  );
}

const huvud = () => screen.getByRole("banner");
const hemknapp = () => /** @type {HTMLElement} */ (document.querySelector("[data-hemikon]"));
const oppnaVaxlaren = () => {
  fireEvent.click(within(huvud()).getByRole("button", { name: /^Byt grupp, nu:/ }));
  return screen.getByRole("dialog");
};

afterEach(cleanup);

describe("hemikonen med grupper.hem (0.227.0)", () => {
  it("⛔ ett tryck på huset anropar hem.onValj och inte oversikt.onValj, och huset heter Gruppens start", () => {
    const onHem = vi.fn();
    const onOversikt = vi.fn();
    const onValj = vi.fn();
    render(<Skal hem={{ onValj: onHem }} oversikt={{ aktiv: false, onValj: onOversikt }} onValj={onValj} />);
    expect(document.querySelectorAll("[data-hemikon]")).toHaveLength(1);
    const hus = within(huvud()).getByRole("button", { name: "Gruppens start" });
    expect(hus).toBe(hemknapp());
    expect(hus.hasAttribute("aria-current")).toBe(false);
    fireEvent.click(hus);
    expect(onHem).toHaveBeenCalledTimes(1);
    expect(onOversikt).not.toHaveBeenCalled();
    expect(onValj).not.toHaveBeenCalled();
  });

  it("⛔ raden Översikt står i växlaren när hem är given, och ett tryck på den går till Översikten", () => {
    const onOversikt = vi.fn();
    render(<Skal hem={{ onValj: () => {} }} oversikt={{ aktiv: false, onValj: onOversikt }} />);
    const ark = oppnaVaxlaren();
    fireEvent.click(within(ark).getByRole("button", { name: "Översikt" }));
    expect(onOversikt).toHaveBeenCalledTimes(1);
  });

  it("appens eget namn, och engelska", () => {
    render(<Skal hem={{ onValj: () => {}, etikett: "Travels start" }} oversikt={{ aktiv: false, onValj: () => {} }} />);
    expect(hemknapp().getAttribute("aria-label")).toBe("Travels start");
    cleanup();
    render(<Skal hem={{ onValj: () => {} }} oversikt={{ aktiv: false, onValj: () => {} }} sprak="en" />);
    expect(hemknapp().getAttribute("aria-label")).toBe("Group home");
  });

  it("⛔ utan hem är det som förut: huset är Översikten och växlaren har ingen rad Översikt", () => {
    const onOversikt = vi.fn();
    render(<Skal oversikt={{ aktiv: false, onValj: onOversikt }} />);
    const hus = within(huvud()).getByRole("button", { name: "Översikt" });
    expect(hus).toBe(hemknapp());
    fireEvent.click(hus);
    expect(onOversikt).toHaveBeenCalledTimes(1);
    const ark = oppnaVaxlaren();
    expect(within(ark).getByRole("button", { name: /Bolaget/ })).toBeTruthy();
    expect(within(ark).queryByRole("button", { name: "Översikt" })).toBeNull();
  });

  it("i översikten är huset Översikten och markerat, också när appen ger hem", () => {
    const onHem = vi.fn();
    const onOversikt = vi.fn();
    render(<Skal hem={{ onValj: onHem }} oversikt={{ aktiv: true, onValj: onOversikt }} />);
    const hus = hemknapp();
    expect(hus.getAttribute("aria-label")).toBe("Översikt");
    expect(hus.getAttribute("aria-current")).toBe("page");
    fireEvent.click(hus);
    expect(onOversikt).toHaveBeenCalledTimes(1);
    expect(onHem).not.toHaveBeenCalled();
  });

  it("fel form på hem kastar med ett svenskt fel", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [hem, monster] of /** @type {const} */ ([
      [null, /grupper\.hem ska vara \{ onValj, etikett\? \}/],
      [{}, /grupper\.hem ska vara \{ onValj, etikett\? \}/],
      [{ onValj: "ja" }, /grupper\.hem ska vara/],
      [{ onValj: () => {}, etikett: "" }, /grupper\.hem\.etikett ska vara en sträng med text/],
      [{ onValj: () => {}, href: "/start" }, /okända nycklar: href/],
    ])) {
      expect(() => render(<Skal hem={hem} oversikt={{ aktiv: false, onValj: () => {} }} />)).toThrow(monster);
      cleanup();
    }
    vi.restoreAllMocks();
  });
});
