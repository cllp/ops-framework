import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpsSidoyta } from "../components/OpsSidoyta.jsx";
import { OpsVyValjare } from "../components/OpsVyValjare.jsx";
import { OpsView } from "../components/OpsView.jsx";

const POSTER = [
  { id: "hubbar", etikett: "Hubbar", href: "/" },
  { id: "profil", etikett: "Profil", href: "/profile" },
  { id: "anslutningar", etikett: "Anslutningar", href: "/settings/anslutningar" },
  { id: "konto", etikett: "Betalningar och konto", href: "/settings/konto" },
  { id: "ai", etikett: "AI-nycklar", href: "/settings/ai" },
  { id: "logout", etikett: "Logga ut", onClick: () => {}, destructive: true },
];

describe("OpsSidoyta (lifehub.app#150)", () => {
  it("märker ytan så shell och React delar samma breddklass", () => {
    const { container } = render(
      <OpsSidoyta>
        <p>Innehåll</p>
      </OpsSidoyta>,
    );
    const yta = container.querySelector("[data-ops-sidoyta]");
    expect(yta).toBeTruthy();
    expect(yta.className.split(/\s+/)).toContain("ops-sidoyta");
    expect(yta.textContent).toContain("Innehåll");
  });

  it("OpsView normal använder samma innehålstoken som sidoytan", () => {
    const { container } = render(
      <OpsView width="normal">
        <p>Vy</p>
      </OpsView>,
    );
    const klasser = container.firstElementChild.className.split(/\s+/);
    expect(klasser).toContain("max-w-innehall");
    expect(klasser).not.toContain("max-w-5xl");
  });
});

describe("OpsVyValjare (lifehub.app#150)", () => {
  it("visar vyns namn och öppnar menyn med posterna", async () => {
    render(<OpsVyValjare rubrik="Hubbar" vald="hubbar" poster={POSTER} />);
    const knapp = screen.getByRole("button", { name: "Hubbar, byt vy" });
    expect(knapp.textContent).toContain("Hubbar");
    fireEvent.click(knapp);
    expect(await screen.findByRole("menu", { name: "Vy" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Profil" }).getAttribute("href")).toBe("/profile");
    expect(screen.getByRole("menuitem", { name: "Betalningar och konto" }).getAttribute("href")).toBe("/settings/konto");
    expect(screen.getByRole("menuitem", { name: "Logga ut" }).tagName).toBe("BUTTON");
    expect(screen.getByRole("menuitem", { name: "Hubbar" }).getAttribute("aria-current")).toBe("page");
  });

  it("anropar onNavigate för länkar och onClick för knappar", async () => {
    const onNavigate = vi.fn();
    const onLogout = vi.fn();
    const poster = POSTER.map((p) => (p.id === "logout" ? { ...p, onClick: onLogout } : p));
    render(<OpsVyValjare rubrik="Profil" vald="profil" poster={poster} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Profil, byt vy" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Anslutningar" }));
    expect(onNavigate).toHaveBeenCalledWith("/settings/anslutningar", expect.any(Object));
    fireEvent.click(screen.getByRole("button", { name: "Profil, byt vy" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Logga ut" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("vägrar tom rubrik och poster utan mål", () => {
    expect(() => render(<OpsVyValjare rubrik="" vald="x" poster={POSTER} />)).toThrow(/rubrik/);
    expect(() => render(<OpsVyValjare rubrik="X" vald="x" poster={[{ id: "x", etikett: "X" }]} />)).toThrow(/href och onClick/);
  });
});
