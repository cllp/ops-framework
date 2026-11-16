import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsAgenter, agenterManifest } from "../components/OpsAgenter.jsx";
import { validateModuler } from "../lib/modul.js";

/**
 * ⛔ HÄNDELSEN (0.234.0, cllp/ops-framework#607). CP 2026-11-16: "När jag öppnar Modell under agentens inställningar visas
 * modellerna först som låsta med 'Koppla nyckel', också den modell vars nyckel redan finns. Efter en stund låses den upp av sig
 * själv." Tre lägen (laddar, saknas, finns) såg ut som två. Proven mäter alla tre och felet, i båda väljarna (översikten och
 * avsnittet Modell och nycklar).
 */

const GRANSER = { namn: 40, beskrivning: 200, roll: 120, instruktioner: 4000, minne: 500, skillNamn: 80, skillBeskrivning: 300, skillText: 12000 };
const AGENTER = [{ id: "ops", namn: "Ops", status: "aktiv" }];
const ADRESSER = ["/agenter?agent=ops&lage=installningar", "/agenter?agent=ops&lage=installningar&avsnitt=modell"];

/** @param {string} activeHref @param {Record<string, unknown>} [over] */
function rita(activeHref, over = {}) {
  const onSparaModell = vi.fn();
  const utils = render(
    <OpsAgenter
      modul={validateModuler([agenterManifest()])[0]}
      activeHref={activeHref}
      hubHref="/hub"
      onNavigate={(_h, e) => e?.preventDefault?.()}
      ram={{ farAndra: true }}
      agenter={AGENTER}
      granser={GRANSER}
      installning={{ namn: "Ops", roll: "Assistent", beskrivning: "Hjälper" }}
      modell={{ id: "gemini-3.5-flash-lite" }}
      modellvalAktivt
      valvHref="/konto/nycklar"
      onSparaModell={onSparaModell}
      {...over}
    />,
  );
  return { ...utils, onSparaModell };
}

const lista = () => within(screen.getByRole("list", { name: "Modeller" }));
/** Läget raden ritar, ett av fyra: laddar, saknas, finns, fel, och `utan-nyckel` för modellen som inte behöver någon. */
const lage = (/** @type {RegExp} */ namn) => lista().getByRole("radio", { name: namn }).closest("li")?.getAttribute("data-nyckellage");

describe.each(ADRESSER)("nyckelläget i modellvalet (%s)", (adress) => {
  it("⛔ laddar: 'Läser nycklar ...', inget 'Koppla nyckel', och valet går inte att välja", () => {
    const { onSparaModell } = rita(adress, { nyckellage: "laddar", kopplade: [] });
    expect(lista().queryByRole("link", { name: /Koppla nyckel/ })).toBeNull();
    expect(lista().getAllByRole("status").length).toBeGreaterThan(0);
    expect(lista().getAllByText("Läser nycklar ...").length).toBeGreaterThan(0);
    const grok = lista().getByRole("radio", { name: /Grok/ });
    expect(grok).toBeDisabled();
    expect(lage(/Grok/)).toBe("laddar");
    fireEvent.click(grok);
    expect(onSparaModell).not.toHaveBeenCalled();
  });

  it("⛔ laddar: en leverantör som redan står i kopplade går ändå inte att välja förrän läget är klart", () => {
    rita(adress, { nyckellage: "laddar", kopplade: ["xai"] });
    expect(lista().getByRole("radio", { name: /Grok/ })).toBeDisabled();
  });

  it("saknas: 'Koppla nyckel' när det är bekräftat att nyckeln saknas", () => {
    rita(adress, { nyckellage: "klar", kopplade: [] });
    expect(lista().getByRole("link", { name: "Koppla nyckel, Grok" })).toBeTruthy();
    expect(lista().queryByText("Läser nycklar ...")).toBeNull();
    expect(lage(/Grok/)).toBe("saknas");
    expect(lista().getByRole("radio", { name: /Grok/ })).toBeDisabled();
  });

  it("finns: valbar, utan 'Koppla nyckel' och utan väntan", () => {
    rita(adress, { nyckellage: "klar", kopplade: ["xai"] });
    expect(lista().getByRole("radio", { name: /Grok/ })).not.toBeDisabled();
    expect(lista().queryByRole("link", { name: "Koppla nyckel, Grok" })).toBeNull();
    expect(lista().queryByText("Läser nycklar ...")).toBeNull();
    expect(lage(/Grok/)).toBe("finns");
  });

  it("⛔ fel: ett fel, aldrig 'Koppla nyckel', och valet går inte att välja", () => {
    rita(adress, { nyckellage: "fel", nyckelfel: "Mitt konto svarade inte.", kopplade: [] });
    expect(screen.getByText("Nycklarna kunde inte läsas")).toBeTruthy();
    expect(screen.getByText("Mitt konto svarade inte.")).toBeTruthy();
    expect(lista().queryByRole("link", { name: /Koppla nyckel/ })).toBeNull();
    expect(lista().getByRole("radio", { name: /Grok/ })).toBeDisabled();
    expect(lage(/Grok/)).toBe("fel");
  });

  it("Gemini Flash Lite går att välja i alla lägen", () => {
    for (const nyckellage of ["laddar", "klar", "fel"]) {
      const { unmount } = rita(adress, { nyckellage, kopplade: [] });
      expect(lista().getByRole("radio", { name: /Gemini Flash Lite/ })).not.toBeDisabled();
      expect(lage(/Gemini Flash Lite/)).toBe("utan-nyckel");
      unmount();
    }
  });
});

describe("nyckellage som prop", () => {
  it("ett okänt läge kastar i stället för att ritas som 'saknas'", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => rita(ADRESSER[0], { nyckellage: "okant" })).toThrow(/nyckellage/);
  });
});
