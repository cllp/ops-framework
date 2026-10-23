import { describe, it, expect, vi } from "vitest";
import { lazy, useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as tillaggApi from "../lib/tillagg.js";
import { PLATSER, PLATSYTOR, synsPa, synsPaText, tillaggFor } from "../lib/tillagg.js";
import { validateModuler } from "../lib/modul.js";
import { arBaraTillagg } from "../lib/hubb.js";
import { OpsGruppHubb } from "../components/OpsHub.jsx";
import { OpsInstallningar } from "../components/OpsInstallningar.jsx";
import { installningsSektioner } from "../components/installningsSektioner.jsx";

/**
 * Platsen `installningar.sektion` (0.140.0): en app vars enda yta är en sektion i appens inställningar går att installera.
 *
 * ⛔ Händelsen: CP 2026-10-23, "Jag har slått på bokning överallt, men kan inte se den under appar att kunna installera." Bokningens
 * manifest hade `hubb: null` och inga tillägg, så `arBaraTillagg` var falskt och erbjudandet under Appar släppte aldrig in den.
 * Proven mäter båda halvorna: att en modul med bara den platsen erbjuds och står med "Syns på: Inställningar", och att platsen
 * faktiskt ritas av hjälparen (en plats som ingen yta ritar är ett tillägg som försvinner tyst, regel 5).
 *
 * ⛔ Röda mot 0.139.1: platsen fanns inte, så `defineModule` avvisade manifestet, `installningsSektioner` fanns inte och Appar erbjöd inte modulen.
 */

/** @param {string} id @param {any[]} tillagg @param {Record<string, any>} [extra] */
const MODUL = (id, tillagg, extra = {}) => ({
  id,
  namn: { sv: id === "bokning" ? "Bokning" : id, en: id === "bokning" ? "Booking" : id },
  nav: [],
  routes: [],
  samlingar: [],
  kallor: {},
  skapar: [],
  hubb: null,
  tillagg,
  ...extra,
});

/** @param {Record<string, any>} [over] */
const SEKTION = (over = {}) => ({
  plats: "installningar.sektion",
  id: "installningar",
  etikett: { sv: "Bokning", en: "Booking" },
  komponent: () => null,
  ...over,
});

const G = (/** @type {string[]} */ ids) => ({ id: "travel", namn: { sv: "Travel" }, moduler: ids });

describe("platsen står bland ramverkets platser", () => {
  it("INSTALLNINGAR_PLATSER är exporterad, med i PLATSER och har ett ytnamn på båda språken", () => {
    expect(/** @type {any} */ (tillaggApi).INSTALLNINGAR_PLATSER).toEqual(["installningar.sektion"]);
    expect(PLATSER).toContain("installningar.sektion");
    expect(PLATSYTOR.installningar).toEqual({ sv: "Inställningar", en: "Settings" });
    // Golv: de äldre platserna är kvar, så ett tomt PLATSER inte kan ge grönt.
    expect(PLATSER.length).toBeGreaterThanOrEqual(5);
    expect(PLATSER).toContain("handelse.sektion");
    expect(PLATSER).toContain("inspelning.mal");
  });

  it("synsPa säger Inställningar för en modul som bara har platsen, och inte Egen yta", () => {
    const [m] = validateModuler([MODUL("bokning", [SEKTION()])]);
    expect(synsPa(/** @type {any} */ (m))).toEqual({ egenYta: false, ytor: ["installningar"] });
    expect(synsPaText(synsPa(/** @type {any} */ (m)), { egenYta: "Egen yta", ingenting: "inget" }, "sv")).toBe("Inställningar");
    expect(synsPaText(synsPa(/** @type {any} */ (m)), { egenYta: "Own page", ingenting: "none" }, "en")).toBe("Settings");
  });

  it("modulen är en tilläggsmodul (arBaraTillagg), och en utan plats är det inte", () => {
    const [m, utan] = validateModuler([MODUL("bokning", [SEKTION()]), MODUL("stum", [])]);
    expect(arBaraTillagg(m)).toBe(true);
    expect(arBaraTillagg(utan)).toBe(false);
  });
});

describe("manifestets plats valideras vid uppstart", () => {
  it("godtar ett tillägg på installningar.sektion och skriver ut det fryst", () => {
    const [m] = validateModuler([MODUL("bokning", [SEKTION()])]);
    const t = /** @type {any} */ (m).tillagg;
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ plats: "installningar.sektion", id: "installningar", etikett: { sv: "Bokning", en: "Booking" } });
    expect(Object.isFrozen(t)).toBe(true);
  });

  it("⛔ en okänd plats på ytan avvisas fortfarande, med platserna i felet", () => {
    expect(() => validateModuler([MODUL("bokning", [SEKTION({ plats: "installningar.rad" })])])).toThrow(/modul "bokning": tillagg\[0\]\.plats "installningar\.rad" finns inte.*installningar\.sektion/);
  });

  it("⛔ en sektion utan komponent avvisas: en tom sektion är en rad som öppnar ingenting", () => {
    expect(() => validateModuler([MODUL("bokning", [SEKTION({ komponent: undefined })])])).toThrow(/komponent för "installningar" krävs/);
  });

  it("⛔ spara, maxSekunder och skapa hör inte hemma på platsen", () => {
    expect(() => validateModuler([MODUL("bokning", [SEKTION({ spara: () => {} })])])).toThrow(/spara för "installningar".*inspelning\.mal/);
    expect(() => validateModuler([MODUL("bokning", [SEKTION({ maxSekunder: 5 })])])).toThrow(/maxSekunder för "installningar".*inspelning\.mal/);
    expect(() => validateModuler([MODUL("bokning", [SEKTION({ skapa: { fel: () => [] } })])])).toThrow(/skapa för "installningar".*handelse\.skapa/);
  });

  it("tillaggFor hittar den bara för en grupp som har modulen på", () => {
    const moduler = validateModuler([MODUL("bokning", [SEKTION()])]);
    expect(tillaggFor({ moduler, grupp: G(["bokning"]), plats: "installningar.sektion" }).map((t) => t.modulId)).toEqual(["bokning"]);
    expect(tillaggFor({ moduler, grupp: G([]), plats: "installningar.sektion" })).toEqual([]);
    expect(tillaggFor({ moduler, grupp: null, plats: "installningar.sektion" })).toEqual([]);
  });
});

describe("OpsGruppHubb: Bokning erbjuds under Appar som kan läggas till", () => {
  const alla = () => validateModuler([MODUL("bokning", [SEKTION()]), MODUL("stum", [])]);

  it("⛔ erbjuds med Installera och 'Syns på: Inställningar', och knappen installerar just den", () => {
    const klick = vi.fn();
    render(<OpsGruppHubb grupp={G([])} moduler={alla()} installera={{ onInstallera: klick }} />);
    const lista = screen.getByRole("list", { name: "Appar som kan läggas till" });
    expect(within(lista).getByText("Bokning")).toBeTruthy();
    expect(within(lista).getByText("Bokning · Syns på: Inställningar")).toBeTruthy();
    // Kontroll åt andra hållet: en modul utan kort och utan tillägg erbjuds fortfarande inte.
    expect(within(lista).queryByText("stum")).toBeNull();
    fireEvent.click(within(lista).getByRole("button", { name: "Installera Bokning" }));
    expect(klick).toHaveBeenCalledWith("bokning");
  });

  it("på engelska med engelska ord", () => {
    render(<OpsGruppHubb grupp={G([])} moduler={alla()} installera={{ onInstallera: () => {} }} sprak="en" />);
    const lista = screen.getByRole("list", { name: "Apps that can be added" });
    expect(within(lista).getByText("Booking · Visible in: Settings")).toBeTruthy();
  });

  it("installerad: står under Tillägg i gruppen och erbjuds inte igen", () => {
    render(<OpsGruppHubb grupp={G(["bokning"])} moduler={alla()} installera={{ onInstallera: () => {} }} />);
    const sektion = screen.getByRole("region", { name: "Tillägg i gruppen" });
    expect(within(sektion).getByText("Bokning · Syns på: Inställningar")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Installera Bokning/ })).toBeNull();
  });
});

describe("installningsSektioner: platsen ritas av appens inställningsvy", () => {
  const BokningPanel = vi.fn(({ grupp, kanAndra }) => (
    <p data-panel="bokning">
      grupp {grupp.id} {kanAndra ? "kan ändra" : "läser"}
    </p>
  ));
  const moduler = () => validateModuler([MODUL("bokning", [SEKTION({ komponent: BokningPanel })]), MODUL("ekonomi", [])]);

  it("ger en sektion per påslagen modul, med id <modul>.<tillägg> och rubriken på rätt språk", () => {
    const sv = installningsSektioner({ moduler: moduler(), grupp: G(["bokning"]) });
    expect(sv.map((s) => s.id)).toEqual(["bokning.installningar"]);
    expect(sv[0].rubrik).toBe("Bokning");
    const en = installningsSektioner({ moduler: moduler(), grupp: G(["bokning"]), sprak: "en" });
    expect(en[0].rubrik).toBe("Booking");
  });

  it("⛔ en avslagen modul ger ingen sektion och dess komponent anropas inte", () => {
    BokningPanel.mockClear();
    const sektioner = installningsSektioner({ moduler: moduler(), grupp: G(["ekonomi"]) });
    expect(sektioner).toEqual([]);
    expect(installningsSektioner({ moduler: moduler(), grupp: null })).toEqual([]);
    expect(BokningPanel).not.toHaveBeenCalled();
  });

  it("⛔ ritad i OpsInstallningar: raden finns, panelen visar komponenten med grupp och extra, och extra kan inte skriva över grupp", () => {
    function Vy() {
      const [vald, setVald] = useState(/** @type {string | null} */ (null));
      const sektioner = installningsSektioner({ moduler: moduler(), grupp: G(["bokning"]), extra: { kanAndra: true, grupp: { id: "fel" } } });
      return <OpsInstallningar sektioner={sektioner} vald={vald} onValj={setVald} />;
    }
    render(<Vy />);
    const rad = screen.getByRole("button", { name: /Bokning/ });
    fireEvent.click(rad);
    expect(document.querySelector('[data-panel="bokning"]')?.textContent).toBe("grupp travel kan ändra");
  });

  it("⛔ en lat komponent ritas i en Suspense och visar sitt innehåll när den har laddats", async () => {
    const Lat = lazy(() => Promise.resolve({ default: () => <p data-lat="">laddad</p> }));
    const m = validateModuler([MODUL("bokning", [SEKTION({ komponent: Lat })])]);
    const [s] = installningsSektioner({ moduler: m, grupp: G(["bokning"]) });
    render(<OpsInstallningar sektioner={[s]} vald="bokning.installningar" onValj={() => {}} />);
    await waitFor(() => expect(document.querySelector("[data-lat]")?.textContent).toBe("laddad"));
  });
});
