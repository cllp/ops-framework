import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsModulInstallningar } from "../components/OpsModulInstallningar.jsx";
import { defineModule } from "../lib/modul.js";

/**
 * Listan pekar in i modulramen (0.89.0). Den ritar inte pinnen och inte de egna fälten.
 * Ett anrop som fortfarande skickar sparningen kastas, så den inte ser ut att finnas kvar.
 */

const I = () => <svg />;

const EKONOMI = defineModule({
  id: "ekonomi",
  namn: { sv: "Ekonomi", en: "Finance" },
  nav: [],
  routes: [],
  samlingar: [],
  kallor: {},
  skapar: [],
  hubb: {
    ikon: <I />,
    rutt: "/ekonomi",
    startsida: "oversikt",
    delar: [{ id: "oversikt", namn: { sv: "Översikt", en: "Overview" }, ikon: <I />, rutt: "/ekonomi/oversikt" }],
  },
  installningar: [
    { id: "visadolda", namn: { sv: "Visa dolda", en: "Show hidden" }, typ: "boolean", forval: false },
  ],
});

const GRUPP = { moduler: ["ekonomi"], huvudmeny: [] };

describe("OpsModulInstallningar", () => {
  it("agare krävs som true eller false", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<OpsModulInstallningar moduler={[EKONOMI]} grupp={GRUPP} />)).toThrow(/agare krävs/);
    } finally {
      tyst.mockRestore();
    }
  });

  it("de gamla sparpropparna kastas, de ritas inte", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(
        <OpsModulInstallningar moduler={[EKONOMI]} grupp={GRUPP} agare onSparaHuvudmeny={() => {}} />,
      )).toThrow(/ritas inte här/);
      expect(() => render(
        <OpsModulInstallningar moduler={[EKONOMI]} grupp={GRUPP} agare onSpara={() => {}} />,
      )).toThrow(/ritas inte här/);
    } finally {
      tyst.mockRestore();
    }
  });

  it("ingen pinne, en länk när adressen finns, och en tom grupp säger det", () => {
    const onNavigate = vi.fn((_h, e) => e.preventDefault());
    const { unmount } = render(
      <OpsModulInstallningar
        moduler={[EKONOMI]}
        grupp={GRUPP}
        agare
        hrefFor={() => "/ekonomi?lage=installningar"}
        onNavigate={onNavigate}
      />,
    );
    expect(screen.queryByRole("switch")).toBeNull();
    const lank = screen.getByRole("link", { name: "Inställningar" });
    expect(lank.getAttribute("href")).toBe("/ekonomi?lage=installningar");
    fireEvent.click(lank);
    expect(onNavigate).toHaveBeenCalledWith("/ekonomi?lage=installningar", expect.anything());
    unmount();

    render(<OpsModulInstallningar moduler={[EKONOMI]} grupp={GRUPP} agare={false} />);
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getByText("Inställningarna öppnas i appen.")).toBeTruthy();

    render(<OpsModulInstallningar moduler={[EKONOMI]} grupp={{ moduler: [], huvudmeny: [] }} agare />);
    expect(screen.getByText("Gruppen har inga appar installerade.")).toBeInTheDocument();
  });
});
