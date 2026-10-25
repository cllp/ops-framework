import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsIconLink } from "../components/OpsIconLink.jsx";
import { OpsGruppvaxlare, ORD_OPSOVERSIKT } from "../components/OpsGruppanel.jsx";

/**
 * 0.112.0, cllp/lifehub.app#319: översikten är läget `ingenGrupp`, valt. jsdom kör ingen CSS, så hur det SER UT visas med
 * Playwright i PR:en. Här är strukturen: vad som ritas och inte ritas, och vad raden Översikt gör.
 */

const fasta = { idag: { href: "/idag" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const lista = [
  { id: "g1", namn: "Bolaget", roll: "agare" },
  { id: "g2", namn: "Familjen", roll: "medlem" },
];
const profil = <OpsIconLink href="/profil" label="Min profil" icon={<i />} />;
const atgarder = <OpsIconLink href="/inkorg" label="Inkorg" icon={<i />} />;

/** @param {{ aktiv?: boolean, onOversikt?: () => void, onValj?: (id: string) => void }} [o] */
const Skal = ({ aktiv = false, onOversikt = () => {}, onValj = () => {} } = {}) => (
  <OpsAppShell
    brand="Ops"
    fasta={fasta}
    activeHref="/"
    actions={atgarder}
    anvandare={profil}
    meny={{ sektioner: [], onLoggaUt: () => {} }}
    grupper={{ lista, aktiv: "g1", onValj, oversikt: { aktiv, onValj: onOversikt } }}
  >
    <p>innehåll</p>
  </OpsAppShell>
);

describe("Översiktsläget i skalet (0.112.0)", () => {
  it("i en grupp: bottenraden, flikarna och actions finns (kontrollen)", () => {
    render(<Skal />);
    expect(screen.queryByRole("navigation", { name: "Snabbnavigering" })).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Inkorg" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Byt grupp, nu: Bolaget" })).toBeTruthy();
  });

  it("⛔ i översikten: ingen bottenrad, inga actions, ingen gruppanel, men profilen och växlaren med Översikt", () => {
    render(<Skal aktiv />);
    expect(screen.queryByRole("navigation", { name: "Snabbnavigering" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Inkorg" })).toBeNull();
    // Gruppanelens lista (dator) ritas inte: den enda grupplistan är växlarens, och den är stängd.
    expect(screen.queryByRole("list", { name: "Mina grupper" })).toBeNull();
    expect(screen.getByRole("link", { name: "Min profil" })).toBeTruthy();
    // 0.144.0: huset står kvar och lyser (hemknappen, markerad), och växlaren visar vad den gör (Byt grupp), med skärmläsarnamnet "nu: Översikt".
    expect(screen.getByRole("button", { name: "Översikt" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Byt grupp, nu: Översikt" })).toBeTruthy();
    expect(screen.getByText("innehåll")).toBeTruthy();
  });
});

describe("Raden Översikt i gruppväxlaren (0.112.0)", () => {
  it("⛔ står överst, är vald i översikten, och att välja den anropar oversikt.onValj och inte onValj", async () => {
    const onValj = vi.fn();
    const onOversikt = vi.fn();
    render(<OpsGruppvaxlare grupper={lista} aktiv="g1" onValj={onValj} oversikt={{ aktiv: true, onValj: onOversikt }} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Byt grupp, nu: Översikt" }));
    const knappar = screen.getAllByRole("button").filter((b) => ["Översikt", "Bolaget", "Familjen"].includes(b.getAttribute("aria-label") ?? ""));
    expect(knappar.map((b) => b.getAttribute("aria-label"))).toEqual(["Översikt", "Bolaget", "Familjen"]);
    expect(knappar[0].getAttribute("aria-current")).toBe("true");
    // I översikten är ingen grupp vald, fast appen har g1 i bakgrunden.
    expect(knappar[1].getAttribute("aria-current")).toBeNull();
    await user.click(knappar[0]);
    expect(onOversikt).toHaveBeenCalledTimes(1);
    expect(onValj).not.toHaveBeenCalled();
  });

  it("i en grupp är gruppen vald och Översikt inte, och att välja en grupp går till onValj", async () => {
    const onValj = vi.fn();
    render(<OpsGruppvaxlare grupper={lista} aktiv="g1" onValj={onValj} oversikt={{ aktiv: false, onValj: () => {} }} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Byt grupp, nu: Bolaget" }));
    expect(screen.getByRole("button", { name: "Översikt" }).getAttribute("aria-current")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Familjen" }));
    expect(onValj).toHaveBeenCalledWith("g2");
  });

  it("ordtabellen: engelska ger Overview, och utan oversikt finns ingen rad", async () => {
    expect(ORD_OPSOVERSIKT.etikett).toEqual({ sv: "Översikt", en: "Overview" });
    const { unmount } = render(<OpsGruppvaxlare grupper={lista} aktiv="g1" onValj={() => {}} sprak="en" oversikt={{ aktiv: true, onValj: () => {} }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /^Byt grupp/ }));
    expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
    unmount();
    render(<OpsGruppvaxlare grupper={lista} aktiv="g1" onValj={() => {}} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Byt grupp, nu: Bolaget" }));
    expect(screen.queryByRole("button", { name: "Översikt" })).toBeNull();
    expect(within(document.body).getByRole("button", { name: "Familjen" })).toBeTruthy();
  });
});

describe("Hemgruppens bottenrad i översikten (0.113.0)", () => {
  /** @param {{ aktiv?: string, hemgrupp?: string, onValj?: (id: string) => void, onNavigate?: (href: string, e: any) => void }} o */
  const MedHem = ({ aktiv = "g2", hemgrupp, onValj = () => {}, onNavigate = (_h, e) => e.preventDefault() }) => (
    <OpsAppShell
      brand="Ops"
      fasta={fasta}
      activeHref="/"
      onNavigate={onNavigate}
      anvandare={profil}
      meny={{ sektioner: [], onLoggaUt: () => {} }}
      grupper={{ lista, aktiv, onValj, oversikt: { aktiv: true, onValj: () => {}, hemgrupp } }}
    >
      <p>innehåll</p>
    </OpsAppShell>
  );

  it("⛔ med hemgrupp har översikten bottenraden, och ett tryck väljer hemgruppen innan det navigerar", async () => {
    /** @type {string[]} */
    const hande = [];
    render(<MedHem hemgrupp="g1" onValj={(id) => hande.push(`valj:${id}`)} onNavigate={(h, e) => { e.preventDefault(); hande.push(`ga:${h}`); }} />);
    const botten = screen.getByRole("navigation", { name: "Snabbnavigering" });
    await userEvent.setup().click(within(botten).getByRole("link", { name: /Idag/ }));
    expect(hande).toEqual(["valj:g1", "ga:/idag"]);
  });

  it("är hemgruppen redan aktiv väljs den inte igen, bara navigeringen sker", async () => {
    /** @type {string[]} */
    const hande = [];
    render(<MedHem aktiv="g1" hemgrupp="g1" onValj={(id) => hande.push(`valj:${id}`)} onNavigate={(h, e) => { e.preventDefault(); hande.push(`ga:${h}`); }} />);
    await userEvent.setup().click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("link", { name: /Kalender/ }));
    expect(hande).toEqual(["ga:/kalender"]);
  });

  it("utan hemgrupp, eller med ett id som inte finns, är översikten utan bottenrad (som 0.112.0)", () => {
    const { unmount } = render(<MedHem />);
    expect(screen.queryByRole("navigation", { name: "Snabbnavigering" })).toBeNull();
    unmount();
    render(<MedHem hemgrupp="finns-inte" />);
    expect(screen.queryByRole("navigation", { name: "Snabbnavigering" })).toBeNull();
  });
});
