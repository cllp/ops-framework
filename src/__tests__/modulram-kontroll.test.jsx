import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsModulSida } from "../components/OpsModulSida.jsx";
import { defineModule } from "../lib/modul.js";

/**
 * `ram.kopplingar.kontroll` (Ej utgivet, cllp/lifehub.app#337). CP 2026-10-17 om Bank och Bokio: nyckeln kopplas i Mitt konto, och i gruppens
 * modul väljer man bara vilken koppling och vilka konton gruppen använder, som när man väljer repo för GitHub. Ingen Anslut-knapp i modulen.
 *
 * Rött utan ändringen: utan `kontroll` ritar ramen Anslut på varje rad för den som får ändra, och appens val syns inte.
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
  hubb: { ikon: <I />, rutt: "/ekonomi", startsida: "oversikt", delar: [{ id: "oversikt", namn: { sv: "Översikt", en: "Overview" }, ikon: <I />, rutt: "/ekonomi/oversikt" }] },
  kopplingar: [
    { id: "enable-banking", namn: { sv: "Bank", en: "Bank" }, behorigheter: [{ sv: "Läsa transaktioner", en: "Read transactions" }] },
    { id: "bokio", namn: { sv: "Bokio", en: "Bokio" }, behorigheter: [{ sv: "Läsa bokföringen", en: "Read the books" }] },
  ],
});
const ram = (/** @type {any} */ kopplingar, farAndra = true) => ({ farAndra, grupp: { moduler: ["ekonomi"], huvudmeny: [] }, onOrdning: vi.fn(), onSparaHuvudmeny: vi.fn(), kopplingar });

describe("⛔ kopplingens kontroll är appens (#337)", () => {
  it("med kontroll[id] står appens nod där Anslut stod, och en rad utan nyckel är som förut", () => {
    const onAnslut = vi.fn();
    render(
      <OpsModulSida
        modul={EKONOMI}
        activeHref="/ekonomi?lage=installningar"
        hubHref="/hub"
        ram={ram({ lage: { bokio: { status: "ansluten" } }, onAnslut, kontroll: { "enable-banking": <label>Gruppens bank<select aria-label="Gruppens bank"><option>Ingen</option></select></label> } })}
      >
        <p />
      </OpsModulSida>,
    );
    const bank = /** @type {HTMLElement} */ (document.querySelector('[data-koppling="enable-banking"]'));
    expect(within(bank).getByRole("combobox", { name: "Gruppens bank" })).toBeTruthy();
    expect(within(bank).queryByRole("button", { name: "Anslut" })).toBeNull();
    expect(within(bank).queryByRole("button", { name: "Koppla från" })).toBeNull();
    // Bokio har ingen nyckel i `kontroll`: raden är som förut.
    const bokio = /** @type {HTMLElement} */ (document.querySelector('[data-koppling="bokio"]'));
    expect(within(bokio).getByRole("button", { name: "Koppla från" })).toBeTruthy();
  });

  it("kontrollen ritas också för den som inte får ändra: appen avgör vad den visar", () => {
    render(
      <OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram({ kontroll: { bokio: <p>Gruppen använder Anns Bokio.</p> } }, false)}>
        <p />
      </OpsModulSida>,
    );
    expect(screen.getByText("Gruppen använder Anns Bokio.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Anslut" })).toBeNull();
  });
});
