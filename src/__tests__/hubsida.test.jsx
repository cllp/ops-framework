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
  it("ritar Hub, mellansteg och nuvarande sida, med aria-current på den sista", () => {
    render(<OpsHubTillbaka hubHref="/hub" etikett="Inkomster" steg={[{ href: "/ekonomi", label: "Ekonomi" }]} />);
    const rad = screen.getByRole("navigation", { name: "Var du är" });
    expect(within(rad).getByRole("link", { name: "Hub" }).getAttribute("href")).toBe("/hub");
    expect(within(rad).getByRole("link", { name: "Ekonomi" }).getAttribute("href")).toBe("/ekonomi");
    expect(rad.querySelector('[aria-current="page"]')?.textContent).toBe("Inkomster");
  });

  it("anropar onNavigate med länkens href", () => {
    const onNavigate = vi.fn();
    render(<OpsHubTillbaka hubHref="/hub" etikett="Ekonomi" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("link", { name: "Hub" }));
    expect(onNavigate).toHaveBeenCalledWith("/hub", expect.anything());
  });

  it("kastar utan hubHref eller etikett", () => {
    expect(() => render(<OpsHubTillbaka etikett="x" />)).toThrow(/hubHref/);
    expect(() => render(<OpsHubTillbaka hubHref="/hub" />)).toThrow(/etikett/);
  });

  it("har ingen negativ marginal: den hålls i innehållskolumnen", () => {
    render(<OpsHubTillbaka hubHref="/hub" etikett="Ekonomi" />);
    const rad = screen.getByRole("navigation", { name: "Var du är" });
    expect(rad.className).not.toMatch(/(^|\s)-m[xlr]-/);
  });

  it("OpsView tillbaka ritar samma rad överst, OpsHubModul använder den", () => {
    const { unmount } = render(
      <OpsView tillbaka={{ hubHref: "/hub", etikett: "Inkomster", steg: [{ href: "/ekonomi", label: "Ekonomi" }] }}>
        <p>sidan</p>
      </OpsView>,
    );
    expect(screen.getByRole("navigation", { name: "Var du är" }).textContent).toContain("Inkomster");
    unmount();
    render(<OpsHubModul modul={{ href: "/ekonomi", label: "Ekonomi", children: [{ href: "/inkomster", label: "Inkomster" }] }} hubHref="/hub" />);
    expect(screen.getByRole("navigation", { name: "Var du är" }).textContent).toContain("Ekonomi");
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
