import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsModulSida } from "../components/OpsModulSida.jsx";
import { huvudmenyPoster } from "../lib/hubb.js";
import { defineModule } from "../lib/modul.js";

/**
 * "Visa i huvudmenyn" säger vad som syns i huvudet, inte bara vad som är sparat (Ej utgivet, cllp/lifehub.app#776).
 *
 * ⛔ HÄNDELSEN: CP 2026-11-11, gruppen TAM: "Ikonen för bibliotek syns inte i gruppen TAM trots att den står som visas i huvudmeny. Den finns ingenstans."
 * Ikonen ritas ur `moduler` ∩ `huvudmeny` (`huvudmenyPoster`), och i LifeHub ur `moduler` utan de appar hubbadmin gjort otillgängliga för gruppen. Reglaget läste bara
 * `huvudmeny`. Varje prov läser BÅDA sidorna: läsvägen (`huvudmenyPoster`) och reglaget, och kräver att de säger samma sak.
 */

const I = () => <svg />;

const BIBLIOTEK = defineModule({
  id: "bibliotek",
  namn: { sv: "Bibliotek", en: "Library" },
  nav: [],
  routes: [],
  samlingar: [],
  kallor: {},
  skapar: [],
  hubb: { ikon: <I />, rutt: "/bibliotek", startsida: "lista", delar: [{ id: "lista", namn: { sv: "Bibliotek", en: "Library" }, ikon: <I />, rutt: "/bibliotek/lista" }] },
});

const DOLD = { sv: "Hubben har gjort appen otillgänglig för gruppen.", en: "The hub has made the app unavailable to the group." };

/** @param {{ moduler: string[], huvudmeny: string[] }} grupp @param {object} [over] */
function rita(grupp, over = {}) {
  render(
    <OpsModulSida
      modul={BIBLIOTEK}
      activeHref="/bibliotek?lage=installningar"
      hubHref="/hub"
      ram={{ farAndra: true, grupp, onOrdning: vi.fn(), onSparaHuvudmeny: vi.fn(), ...over }}
    >
      <p>listan</p>
    </OpsModulSida>,
  );
  return /** @type {HTMLInputElement} */ (screen.getByRole("switch", { name: /Visa i huvudmenyn/ }));
}

const iHuvudet = (/** @type {{ moduler: string[], huvudmeny: string[] }} */ grupp) => huvudmenyPoster({ grupp, moduler: [BIBLIOTEK] }).map((p) => p.id);

afterEach(() => cleanup());

describe("⛔ Visa i huvudmenyn och huvudet säger samma sak (lifehub.app#776)", () => {
  it("golv: på och fäst står ikonen i huvudet, och reglaget är på och går att slå av", () => {
    const grupp = { moduler: ["bibliotek"], huvudmeny: ["bibliotek"] };
    expect(iHuvudet(grupp)).toEqual(["bibliotek"]);
    const reglage = rita(grupp);
    expect(reglage.checked).toBe(true);
    expect(reglage.disabled).toBe(false);
  });

  it("en pinne för en app som inte är på ritar ingen ikon, och reglaget säger inte på", () => {
    const grupp = { moduler: [], huvudmeny: ["bibliotek"] };
    expect(iHuvudet(grupp)).toEqual([]);
    const reglage = rita(grupp);
    expect(screen.getByRole("switch", { name: /^På/ })).toHaveProperty("checked", false);
    expect(reglage.checked).toBe(false);
  });

  it("dold för gruppen (`ram.dold`): reglaget är av och låst, och skälet står med ord", () => {
    // Läsvägen får det dolda bortfiltrerat ur `moduler`, ramen får den sparade raden.
    expect(iHuvudet({ moduler: [], huvudmeny: ["bibliotek"] })).toEqual([]);
    const reglage = rita({ moduler: ["bibliotek"], huvudmeny: ["bibliotek"] }, { dold: DOLD });
    expect(reglage.checked).toBe(false);
    expect(reglage.disabled).toBe(true);
    expect(document.querySelector("[data-modul-dold]")?.textContent).toBe(DOLD.sv);
    // Appen är fortfarande installerad, och På säger det.
    expect(screen.getByRole("switch", { name: /^På/ })).toHaveProperty("checked", true);
  });

  it("`ram.dold` utan ord kastar med skälet", () => {
    expect(() => rita({ moduler: ["bibliotek"], huvudmeny: ["bibliotek"] }, { dold: { sv: "" } })).toThrow(/ram\.dold/);
    expect(() => rita({ moduler: ["bibliotek"], huvudmeny: ["bibliotek"] }, { dold: true })).toThrow(/ram\.dold/);
  });
});
