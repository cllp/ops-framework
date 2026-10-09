import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsModulInstallningar } from "../components/OpsModulInstallningar.jsx";
import { defineModule } from "../lib/modul.js";

/**
 * Panelen är gemensam. Pinnen anropar huvudmenyn, inte samlingen.
 * En saknad återkoppling visas. jsdom mäter anropet, inte hur brytaren ser ut.
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
    { id: "anteckning", namn: { sv: "Anteckning", en: "Note" }, typ: "text", forval: "" },
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

  it("pinnen skriver nästa huvudmeny, och ett saknat anrop säger att ikonen inte ändrades", () => {
    const onSparaHuvudmeny = vi.fn();
    const { unmount } = render(
      <OpsModulInstallningar moduler={[EKONOMI]} grupp={GRUPP} agare onSparaHuvudmeny={onSparaHuvudmeny} />,
    );
    fireEvent.click(screen.getByRole("switch", { name: /Visa i huvudmenyn/ }));
    expect(onSparaHuvudmeny).toHaveBeenCalledWith(["ekonomi"]);
    unmount();

    render(<OpsModulInstallningar moduler={[EKONOMI]} grupp={GRUPP} agare />);
    fireEvent.click(screen.getByRole("switch", { name: /Visa i huvudmenyn/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Huvudmenyn är inte kopplad. Ikonen ändrades inte.");
  });

  it("en som inte är ägare ser avstängda brytare", () => {
    render(<OpsModulInstallningar moduler={[EKONOMI]} grupp={{ ...GRUPP, huvudmeny: ["ekonomi"] }} agare={false} />);
    expect(screen.getByRole("switch", { name: /Visa i huvudmenyn/ })).toBeDisabled();
    expect(screen.getByText("Bara gruppens ägare ändrar de här inställningarna.")).toBeInTheDocument();
  });

  it("ett eget fält sparas utan pinnen, och en tom grupp säger det", () => {
    const onSpara = vi.fn();
    const { unmount } = render(
      <OpsModulInstallningar moduler={[EKONOMI]} grupp={GRUPP} agare onSpara={onSpara} onSparaHuvudmeny={() => {}} />,
    );
    fireEvent.click(screen.getByRole("switch", { name: /Visa dolda/ }));
    expect(onSpara).toHaveBeenCalledWith({ modulId: "ekonomi", varden: { visadolda: true, anteckning: "" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Anteckning" }), { target: { value: "Hej" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    // Brytaren är styrd av det sparade. Föräldern uppdaterade inte `sparade`, så boolen är förvalet igen. Texten är utkastet.
    expect(onSpara).toHaveBeenLastCalledWith({ modulId: "ekonomi", varden: { visadolda: false, anteckning: "Hej" } });
    unmount();

    render(<OpsModulInstallningar moduler={[EKONOMI]} grupp={{ moduler: [], huvudmeny: [] }} agare />);
    expect(screen.getByText("Gruppen har inga appar installerade.")).toBeInTheDocument();
  });
});
