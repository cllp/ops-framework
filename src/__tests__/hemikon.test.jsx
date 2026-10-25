import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsIconLink } from "../components/OpsIconLink.jsx";
import { OpsGruppvaxlare } from "../components/OpsGruppanel.jsx";

/**
 * 0.138.0, CP 2026-10-22: "det är lite svårt att navigera sig tillbaka till hemgrupp / översikt." Hemikonen i huvudet i varje grupp.
 * jsdom kör ingen CSS, så hur det SER UT och om huvudet ryms mäts i `scripts/hemikon-montage.mjs` (byggd dist, Playwright). Här är
 * strukturen: vad som ritas, vad ett tryck gör, och vilka åtgärder som är kvar i huvudet under md.
 *
 * ⛔ BÅDA RIKTNINGARNA i varje prov: med `oversikt` finns hemikonen, utan den gör den inte det; i en grupp är den inte markerad,
 * i översikten är den det; med hemikon är budgeten en åtgärd mindre, utan den som förut.
 *
 * 0.144.0, CP 2026-10-25: huset står kvar och lyser i översikten (en knapp som försvinner får en att undra vart den tog vägen, en
 * som lyser visar var man är). Före det var växlarens knapp hemikonen i översikten; nu är hemknappen det i alla lägen, och växlaren
 * visar sitt vanliga utseende, så att det aldrig finns två hus bredvid varandra.
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
/** Husikonerna (lucide `Home`/`House`) som ritas i huvudet, vilken knapp de än sitter i. */
const husIHuvud = () => huvud().querySelectorAll('svg[class*="lucide-house"], svg[class*="lucide-home"]');

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

  it("⛔ växlarens ark har INGEN rad Översikt när hemikonen finns (0.139.0): en väg till Översikten, inte två", () => {
    render(<Skal />);
    expect(hemknappar()).toHaveLength(1);
    fireEvent.click(within(huvud()).getByRole("button", { name: /^Byt grupp, nu:/ }));
    const ark = screen.getByRole("dialog");
    // Grupperna är kvar, hemgruppens egen rad också, men ingen rad Översikt ovanför dem.
    expect(within(ark).getByRole("button", { name: /Bolaget/ })).toBeTruthy();
    expect(within(ark).queryByRole("button", { name: "Översikt" })).toBeNull();
    expect(ark.querySelector("[data-oversikt]")).toBeNull();
  });

  it("⛔ hemikonen gör det raden Översikt gjorde, och den finns kvar i huvudet medan arket är öppet", () => {
    const onOversikt = vi.fn();
    render(<Skal oversikt={{ aktiv: false, onValj: onOversikt }} />);
    fireEvent.click(within(huvud()).getByRole("button", { name: /^Byt grupp, nu:/ }));
    fireEvent.click(within(huvud()).getByRole("button", { name: "Översikt" }));
    expect(onOversikt).toHaveBeenCalledTimes(1);
  });

  it("⛔ i översikten är raden Översikt kvar i arket som förut, vald, och att välja den anropar oversikt.onValj", () => {
    const onOversikt = vi.fn();
    render(<Skal oversikt={{ aktiv: true, onValj: onOversikt }} />);
    fireEvent.click(within(huvud()).getByRole("button", { name: /^Byt grupp, nu: Översikt$/ }));
    const ark = screen.getByRole("dialog");
    const rad = within(ark).getByRole("button", { name: "Översikt" });
    expect(rad.getAttribute("aria-current")).toBe("true");
    fireEvent.click(rad);
    expect(onOversikt).toHaveBeenCalledTimes(1);
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

  it("⛔ hemikonen är inte markerad i en grupp, och i översikten står den kvar, markerad som aktuell (0.144.0)", () => {
    const { unmount } = render(<Skal />);
    expect(hemknappar()).toHaveLength(1);
    expect(within(huvud()).getByRole("button", { name: "Översikt" }).getAttribute("aria-current")).toBeNull();
    unmount();
    render(<Skal oversikt={{ aktiv: true, onValj: () => {} }} />);
    // Huset STÅR KVAR i översikten (CP 2026-10-25): exakt en hemknapp, namngiven och markerad som aktuell.
    expect(hemknappar()).toHaveLength(1);
    const hem = /** @type {HTMLElement} */ (hemknappar()[0]);
    expect(hem).toBe(within(huvud()).getByRole("button", { name: "Översikt" }));
    expect(hem.getAttribute("aria-current")).toBe("page");
  });

  it("⛔ markerad hemikon lyser med ramverkets tokens (text-accent, bg-sunken), och en omarkerad gör det inte", () => {
    const { unmount } = render(<Skal />);
    const omarkerad = within(huvud()).getByRole("button", { name: "Översikt" }).className;
    expect(omarkerad).not.toContain("text-accent");
    expect(omarkerad).toContain("text-ink-secondary");
    unmount();
    render(<Skal oversikt={{ aktiv: true, onValj: () => {} }} />);
    const markerad = within(huvud()).getByRole("button", { name: "Översikt" }).className;
    expect(markerad).toContain("text-accent");
    expect(markerad).toContain("bg-sunken");
    expect(markerad).not.toContain("text-ink-secondary");
  });

  it("⛔ aldrig två husikoner i huvudet: i översikten är växlarens knapp inget hus, och ingen personikon heller", () => {
    const { unmount } = render(<Skal />);
    expect(husIHuvud()).toHaveLength(1);
    unmount();
    render(<Skal oversikt={{ aktiv: true, onValj: () => {} }} />);
    // Ett hus, och det sitter i hemknappen. Växlaren bär inget hus, inget `data-hemikon` och ingen `aria-current`.
    expect(husIHuvud()).toHaveLength(1);
    expect(hemknappar()[0].querySelector("svg")).toBe(husIHuvud()[0]);
    const vaxlare = within(huvud()).getByRole("button", { name: /^Byt grupp, nu:/ });
    expect(vaxlare.hasAttribute("data-hemikon")).toBe(false);
    expect(vaxlare.hasAttribute("aria-current")).toBe(false);
    expect(vaxlare.querySelector('svg[class*="lucide-house"], svg[class*="lucide-home"]')).toBeNull();
    // Inte heller en personikon: under md står avataren bredvid, och två personer i huvudet vore fel.
    expect(vaxlare.querySelector('svg[class*="lucide-user"]:not([class*="lucide-users"])')).toBeNull();
  });

  it("⛔ i översikten visar växlaren vad den gör (GruppIkon, Byt grupp) och inte \"Ingen grupp\" eller bakgrundsgruppen, men skärmläsaren hör \"nu: Översikt\"", () => {
    const { unmount } = render(<Skal oversikt={{ aktiv: true, onValj: () => {} }} aktiv="g2" />);
    // `aktiv` är den gruppen appen håller i bakgrunden: i översikten ska den inte stå som vald.
    const iOversikt = within(huvud()).getByRole("button", { name: /^Byt grupp, nu:/ });
    expect(iOversikt.getAttribute("aria-label")).toBe("Byt grupp, nu: Översikt");
    expect(iOversikt.textContent).toContain("Byt grupp");
    expect(iOversikt.textContent).not.toContain("Ingen grupp");
    expect(iOversikt.textContent).not.toContain("Claes Philip");
    expect(iOversikt.querySelector('svg[class*="lucide-users"]')).not.toBeNull();
    expect(husIHuvud()).toHaveLength(1);
    unmount();
    render(<Skal aktiv="g2" />);
    expect(within(huvud()).getByRole("button", { name: /^Byt grupp, nu: Claes Philip/ })).toBeTruthy();
  });

  it("personen utan grupp (0.35.0) ser fortfarande \"Ingen grupp\" med personikon, oförändrat", () => {
    render(<OpsGruppvaxlare grupper={[]} aktiv="" onValj={() => {}} />);
    const knapp = screen.getByRole("button", { name: "Byt grupp, nu: Ingen grupp" });
    expect(knapp.textContent).toContain("Ingen grupp");
    expect(knapp.querySelector('svg[class*="lucide-user"]:not([class*="lucide-users"])')).not.toBeNull();
    expect(knapp.querySelector('svg[class*="lucide-users"]')).toBeNull();
  });

  it("⛔ ett tryck på den markerade hemikonen anropar oversikt.onValj som i en grupp, och väljer ingen grupp", () => {
    const onOversikt = vi.fn();
    const onValj = vi.fn();
    render(<Skal oversikt={{ aktiv: true, onValj: onOversikt }} onValj={onValj} />);
    fireEvent.click(within(huvud()).getByRole("button", { name: "Översikt" }));
    expect(onOversikt).toHaveBeenCalledTimes(1);
    expect(onValj).not.toHaveBeenCalled();
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
