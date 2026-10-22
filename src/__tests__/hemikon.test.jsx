import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsIconLink } from "../components/OpsIconLink.jsx";

/**
 * 0.138.0, CP 2026-10-22: "det är lite svårt att navigera sig tillbaka till hemgrupp / översikt." Hemikonen i huvudet i varje grupp.
 * jsdom kör ingen CSS, så hur det SER UT och om huvudet ryms mäts i `scripts/hemikon-montage.mjs` (byggd dist, Playwright). Här är
 * strukturen: vad som ritas, vad ett tryck gör, och vilka åtgärder som är kvar i huvudet under md.
 *
 * ⛔ BÅDA RIKTNINGARNA i varje prov: med `oversikt` finns hemikonen, utan den gör den inte det; i en grupp är den inte markerad,
 * i översikten är den det; med hemikon är budgeten en åtgärd mindre, utan den som förut.
 */

const fasta = { idag: { href: "/idag" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const lista = [
  { id: "g1", namn: "Bolaget", roll: "agare" },
  { id: "g2", namn: "Claes Philip Staiger Konsulting Aktiebolag", roll: "medlem" },
];
const meny = { sektioner: [], onLoggaUt: () => {} };
const NAMN = ["Tema", "Inkorg", "Sök", "Fråga", "Bibliotek", "Meddelanden"];
const sex = (
  <>
    {NAMN.map((n) => (
      <OpsIconLink key={n} href={`/${n.toLowerCase()}`} label={n} icon={<i />} />
    ))}
  </>
);

/**
 * @param {{ oversikt?: object | null, onValj?: (id: string) => void, actions?: import("react").ReactNode, aktiv?: string }} [o]
 */
function Skal({ oversikt = { aktiv: false, onValj: () => {} }, onValj = () => {}, actions = sex, aktiv = "g2" } = {}) {
  return (
    <OpsAppShell
      brand="Ops"
      fasta={fasta}
      activeHref="/idag"
      actions={actions}
      anvandare={<OpsIconLink href="/profil" label="Min profil" icon={<i />} />}
      meny={meny}
      grupper={{ lista, aktiv, onValj, ...(oversikt ? { oversikt } : {}) }}
    >
      <p>innehåll</p>
    </OpsAppShell>
  );
}

const hemknappar = () => document.querySelectorAll("[data-hemikon]");
const huvud = () => screen.getByRole("banner");

describe("Hemikonen i en grupp (0.138.0)", () => {
  it("⛔ med oversikt finns en hemknapp i huvudet i gruppläget, före gruppväxlaren, utan den finns ingen", () => {
    const { unmount } = render(<Skal />);
    const hem = within(huvud()).getByRole("button", { name: "Översikt" });
    expect(hemknappar()).toHaveLength(1);
    expect(hem.hasAttribute("data-hemikon")).toBe(true);
    const vaxlare = within(huvud()).getByRole("button", { name: /^Byt grupp, nu:/ });
    // Före växlaren i läsordningen: hem är första kontrollen i huvudet efter märket (som göms under lg).
    expect(hem.compareDocumentPosition(vaxlare) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();
    render(<Skal oversikt={null} />);
    expect(hemknappar()).toHaveLength(0);
    expect(within(huvud()).queryByRole("button", { name: "Översikt" })).toBeNull();
  });

  it("⛔ ett tryck anropar oversikt.onValj, en gång, och väljer ingen grupp", () => {
    const onOversikt = vi.fn();
    const onValj = vi.fn();
    render(<Skal oversikt={{ aktiv: false, onValj: onOversikt }} onValj={onValj} />);
    fireEvent.click(within(huvud()).getByRole("button", { name: "Översikt" }));
    expect(onOversikt).toHaveBeenCalledTimes(1);
    expect(onValj).not.toHaveBeenCalled();
  });

  it("gör samma sak som raden Översikt i växlaren", () => {
    const onOversikt = vi.fn();
    render(<Skal oversikt={{ aktiv: false, onValj: onOversikt }} />);
    fireEvent.click(within(huvud()).getByRole("button", { name: /^Byt grupp, nu:/ }));
    const ark = screen.getByRole("dialog");
    fireEvent.click(within(ark).getByRole("button", { name: "Översikt" }));
    expect(onOversikt).toHaveBeenCalledTimes(1);
    fireEvent.click(within(huvud()).getByRole("button", { name: "Översikt" }));
    expect(onOversikt).toHaveBeenCalledTimes(2);
  });

  it("namnet är oversikt.etikett när appen anger den, annars skalets ord (på engelska Overview)", () => {
    const { unmount } = render(<Skal oversikt={{ aktiv: false, onValj: () => {}, etikett: "Hem" }} />);
    expect(within(huvud()).getByRole("button", { name: "Hem" })).toBeTruthy();
    expect(within(huvud()).queryByRole("button", { name: "Översikt" })).toBeNull();
    unmount();
    render(
      <OpsAppShell brand="Ops" fasta={fasta} activeHref="/idag" meny={meny} grupper={{ lista, aktiv: "g1", onValj: () => {}, sprak: "en", oversikt: { aktiv: false, onValj: () => {} } }}>
        <p>x</p>
      </OpsAppShell>,
    );
    expect(within(huvud()).getByRole("button", { name: "Overview" })).toBeTruthy();
  });

  it("⛔ hemikonen är inte markerad i en grupp, och i översikten är den enda hemikonen markerad som aktuell", () => {
    const { unmount } = render(<Skal />);
    expect(within(huvud()).getByRole("button", { name: "Översikt" }).getAttribute("aria-current")).toBeNull();
    unmount();
    render(<Skal oversikt={{ aktiv: true, onValj: () => {} }} />);
    // Exakt EN hemikon: växlarens knapp, som är hemikonen i översikten. Ingen andra bredvid.
    expect(hemknappar()).toHaveLength(1);
    const hem = /** @type {HTMLElement} */ (hemknappar()[0]);
    expect(hem.getAttribute("aria-current")).toBe("page");
    expect(hem.getAttribute("aria-label")).toBe("Byt grupp, nu: Översikt");
  });

  it("hemikonen är 44 px stor (size-11) så att den träffas med en tumme", () => {
    render(<Skal />);
    const klass = within(huvud()).getByRole("button", { name: "Översikt" }).className;
    expect(klass).toContain("size-11");
  });
});

describe("Huvudet blir inte fullt: budgeten med hemikon (0.138.0)", () => {
  /** Syns åtgärden i huvudet på telefon (under md)? Klasserna är `hidden lg:contents` (göms) eller `max-md:contents md:hidden lg:contents` (telefon + lg). */
  const paTelefon = (/** @type {HTMLElement} */ el) => {
    const k = el.parentElement?.className ?? "";
    return !/(^|\s)hidden(\s|$)/.test(k) || /max-md:contents/.test(k);
  };
  const iHuvud = () => NAMN.filter((n) => paTelefon(within(huvud()).getByRole("link", { name: n, hidden: true })));

  /** Namnen på åtgärder som finns som rader i bottenradens Meny. */
  const iMenyn = () => {
    fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Meny" }));
    const ark = screen.getByRole("dialog");
    return NAMN.filter((n) => within(ark).queryByRole("link", { name: n }));
  };

  it("⛔ med hemikon och sex åtgärder stannar högst två i huvudet under md, och resten är rader i Menyn", () => {
    render(<Skal />);
    expect(iHuvud()).toEqual(["Tema", "Inkorg"]);
    // Ingen åtgärd försvinner tyst: varje åtgärd utanför huvudet är en rad i Menyn, och de i huvudet är det inte.
    expect(iMenyn()).toEqual(["Sök", "Fråga", "Bibliotek", "Meddelanden"]);
  });

  it("⛔ utan hemikon är budgeten tre som förut, och bara resten ligger i Menyn", () => {
    render(<Skal oversikt={null} />);
    expect(iHuvud()).toEqual(["Tema", "Inkorg", "Sök"]);
    expect(iMenyn()).toEqual(["Fråga", "Bibliotek", "Meddelanden"]);
  });

  it("i översikten ritas inga åtgärder alls, och budgeten rör dem inte", () => {
    render(<Skal oversikt={{ aktiv: true, onValj: () => {} }} />);
    expect(within(huvud()).queryByRole("link", { name: "Inkorg", hidden: true })).toBeNull();
  });

  it("med färre åtgärder än budgeten flyttas ingenting till Menyn", () => {
    render(
      <Skal
        actions={
          <>
            <OpsIconLink href="/tema" label="Tema" icon={<i />} />
            <OpsIconLink href="/inkorg" label="Inkorg" icon={<i />} />
          </>
        }
      />,
    );
    fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Meny" }));
    const ark = screen.getByRole("dialog");
    expect(within(ark).queryByRole("link", { name: "Tema" })).toBeNull();
    expect(within(ark).queryByRole("link", { name: "Inkorg" })).toBeNull();
  });
});
