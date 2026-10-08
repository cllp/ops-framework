import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsHubModul, OpsHub, OpsHubTillbaka } from "../components/OpsHub.jsx";
import { OpsView } from "../components/OpsView.jsx";
import { OpsIconLink } from "../components/OpsIconLink.jsx";

/**
 * Sidorna under Hub (0.31.0, design-QA cllp/bolag-ops#475): tillbaka-raden som egen komponent, och infon i Hub.
 * Att raden hålls i kolumnen, att inget flödar över och att korten ser lika ut mäts i Chromium (check-skalyta avsnitt 12 och 16).
 */
describe("OpsHubTillbaka", () => {
  it("är en textlänk 'Tillbaka' med chevron, till Hub, och ritar ingen rubrik som standard", () => {
    render(<OpsHubTillbaka hubHref="/hub" etikett="Inkomster" />);
    const rad = screen.getByRole("navigation", { name: "Var du är" });
    const lank = within(rad).getByRole("link", { name: "Tillbaka till Appar" });
    expect(lank.getAttribute("href")).toBe("/hub");
    expect(lank.textContent).toBe("Tillbaka");
    expect(lank.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("leder ett steg upp: den sista mellanliggande sidan, annars Hub", () => {
    render(<OpsHubTillbaka hubHref="/hub" etikett="Inkomster" steg={[{ href: "/ekonomi", label: "Ekonomi" }]} />);
    expect(screen.getByRole("link", { name: "Tillbaka till Ekonomi" }).getAttribute("href")).toBe("/ekonomi");
  });

  it("med rubrik ritas sidans namn som h1 under länken", () => {
    render(<OpsHubTillbaka hubHref="/hub" etikett="Ekonomi" rubrik />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Ekonomi");
  });

  it("anropar onNavigate med länkens href", () => {
    const onNavigate = vi.fn();
    render(<OpsHubTillbaka hubHref="/hub" etikett="Ekonomi" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("link", { name: "Tillbaka till Appar" }));
    expect(onNavigate).toHaveBeenCalledWith("/hub", expect.anything());
  });

  it("kastar utan hubHref eller etikett", () => {
    expect(() => render(<OpsHubTillbaka etikett="x" />)).toThrow(/hubHref/);
    expect(() => render(<OpsHubTillbaka hubHref="/hub" />)).toThrow(/etikett/);
  });

  it("är inget band: ingen sticky, ingen ram, ingen bakgrund, ingen negativ marginal", () => {
    render(<OpsHubTillbaka hubHref="/hub" etikett="Ekonomi" />);
    const rad = screen.getByRole("navigation", { name: "Var du är" });
    expect(rad.className).not.toMatch(/sticky|border|bg-|(^|\s)-m[xlr]-/);
    expect(rad.parentElement?.className ?? "").not.toMatch(/sticky|border|bg-/);
  });

  it("OpsView tillbaka ritar samma rad överst, OpsHubModul använder den och ger sidan en rubrik", () => {
    const { unmount } = render(
      <OpsView tillbaka={{ hubHref: "/hub", etikett: "Inkomster", steg: [{ href: "/ekonomi", label: "Ekonomi" }] }}>
        <p>sidan</p>
      </OpsView>,
    );
    expect(screen.getByRole("link", { name: "Tillbaka till Ekonomi" })).toBeTruthy();
    unmount();
    render(<OpsHubModul modul={{ href: "/ekonomi", label: "Ekonomi", children: [{ href: "/inkomster", label: "Inkomster" }] }} hubHref="/hub" />);
    expect(screen.getByRole("link", { name: "Tillbaka till Appar" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Ekonomi");
  });
});

describe("Hub: ett kort med barn fälls ut på plats", () => {
  const moduler = [
    { href: "/a", label: "Utan barn" },
    { href: "/ekonomi", label: "Ekonomi", children: [{ href: "/inkomster", label: "Inkomster", info: "Ny faktura" }, { href: "/kostnader", label: "Kostnader" }] },
  ];
  /*
   * ⛔ ÄNDRAT I 0.83.0 (CP 2026-10-08 17:54: "Varje app/modul borde kunna expanderas med chevron"). Provet hette "knappen bär
   * aria-expanded, barnen syns efter klick, och 'Visa Ekonomi' leder till modulens sida": hela rubriken var en knapp och
   * vägen till modulen en egen rad. Nu är kortet länken och chevronen knappen, och raden "Visa Ekonomi" finns inte.
   */
  it("chevronen bär aria-expanded, barnen syns efter klick, och kortet självt leder till modulens sida", () => {
    const onNavigate = vi.fn();
    render(<OpsHub moduler={moduler} onNavigate={onNavigate} />);
    const knapp = screen.getByRole("button", { name: "Visa delarna i Ekonomi" });
    expect(knapp.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: /Inkomster/ })).toBeNull();
    fireEvent.click(knapp);
    expect(knapp.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(knapp.getAttribute("aria-controls") ?? "")).not.toBeNull();
    expect(screen.getByRole("link", { name: /Inkomster/ }).getAttribute("href")).toBe("/inkomster");
    expect(screen.queryByRole("link", { name: "Visa Ekonomi" })).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: /^Ekonomi/ }));
    expect(onNavigate).toHaveBeenCalledWith("/ekonomi", expect.anything());
    fireEvent.click(knapp);
    expect(knapp.getAttribute("aria-expanded")).toBe("false");
  });
  it("börjar utfälld när en av barnens sidor är aktiv, och en modul utan barn är en vanlig länk", () => {
    render(<OpsHub moduler={moduler} activeHref="/kostnader" />);
    expect(screen.getByRole("button", { name: /Ekonomi/ }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Utan barn" }).getAttribute("href")).toBe("/a");
  });
  it("ritas i OpsView (sidomarginal) som standard, och utan ram med ram={false}", () => {
    const { container, rerender } = render(<OpsHub moduler={moduler} />);
    expect(container.firstElementChild?.className).toContain("px-4");
    rerender(<OpsHub moduler={moduler} ram={false} />);
    expect(container.firstElementChild?.className ?? "").not.toContain("px-4");
  });
});

describe("Hubkortets info", () => {
  const moduler = [
    { href: "/a", label: "Med info", info: "Ny faktura i går" },
    { href: "/b", label: "Utan nytt", info: null },
  ];
  it("infon är i ink-secondary och 'Inget nytt' har en egen statusstil", () => {
    render(<OpsHub moduler={moduler} />);
    const info = screen.getByText("Ny faktura i går");
    expect(info.className).toContain("text-ink-secondary");
    expect(info.className).not.toContain("text-ink-muted");
    const inget = screen.getByText("Inget nytt").closest("[data-status]");
    expect(inget?.getAttribute("data-status")).toBe("inget-nytt");
    expect(inget?.className).toContain("text-ink-secondary");
    expect(info.closest("[data-status]")).toBeNull();
  });
});

describe("OpsIconLink", () => {
  it("har aria-label och en tooltip med namnet", async () => {
    render(<OpsIconLink href="/sok" icon={<span>i</span>} label="Sök" />);
    const lank = screen.getByRole("link", { name: "Sök" });
    expect(lank.getAttribute("aria-label")).toBe("Sök");
    fireEvent.focus(lank);
    expect((await screen.findAllByText("Sök")).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByRole("tooltip")).toBeTruthy();
  });
});
