import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsHuvudmenyProvider } from "../components/OpsHuvudmeny.jsx";
import { OpsModulSida } from "../components/OpsModulSida.jsx";
import { defineModule } from "../lib/modul.js";

/**
 * Modulramen (0.89.0). Kugghjulet, de tre avsnitten och att en hemlighet inte ritas.
 */

const I = () => <svg />;

const BAS = () => ({
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
});

const EKONOMI = defineModule({
  ...BAS(),
  installningar: [{ id: "visadolda", namn: { sv: "Visa dolda", en: "Show hidden" }, typ: "boolean", forval: false }],
  kopplingar: [
    {
      id: "enable-banking",
      namn: { sv: "Bank", en: "Bank" },
      hint: { sv: "Enable Banking", en: "Enable Banking" },
      behorigheter: [{ sv: "Läsa transaktioner", en: "Read transactions" }],
    },
  ],
});

const GRUPP = { moduler: ["ekonomi", "bibliotek"], huvudmeny: [] };

function ram(over = {}) {
  return {
    farAndra: true,
    grupp: GRUPP,
    onOrdning: vi.fn(),
    onSparaHuvudmeny: vi.fn(),
    onSpara: vi.fn(),
    kopplingar: { lage: {}, onAnslut: vi.fn(), onKopplaFran: vi.fn() },
    ...over,
  };
}

describe("modulramen", () => {
  it("kugghjulet syns för den som får ändra, och en medlem i visningsläge ser det inte", () => {
    const onNavigate = vi.fn((_h, e) => e.preventDefault());
    const { unmount } = render(
      <OpsModulSida modul={EKONOMI} activeHref="/ekonomi" hubHref="/hub" onNavigate={onNavigate} ram={ram()}>
        <p>översikten</p>
      </OpsModulSida>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Inställningar" }));
    expect(onNavigate).toHaveBeenCalledWith("/ekonomi?lage=installningar", expect.anything());
    expect(screen.getByText("översikten")).toBeTruthy();
    unmount();

    render(
      <OpsModulSida modul={EKONOMI} activeHref="/ekonomi" hubHref="/hub" ram={ram({ farAndra: false })}>
        <p>översikten</p>
      </OpsModulSida>,
    );
    expect(screen.queryByRole("link", { name: "Inställningar" })).toBeNull();
    expect(screen.getByText("översikten")).toBeTruthy();
  });

  it("inställningsläget byter rubrik, döljer vyn och en fäst modul har ingen Tillbaka", () => {
    render(
      <OpsHuvudmenyProvider moduler={["ekonomi"]}>
        <OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram({ grupp: { ...GRUPP, huvudmeny: ["ekonomi"] } })}>
          <p>översikten</p>
        </OpsModulSida>
      </OpsHuvudmenyProvider>,
    );
    expect(screen.getByRole("heading", { name: "Ekonomi · Inställningar" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Tillbaka/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Klar" }).getAttribute("href")).toBe("/ekonomi");
    expect(screen.queryByText("översikten")).toBeNull();
    expect(screen.getByText("Allmänt")).toBeTruthy();
    expect(screen.getByText("Kopplingar")).toBeTruthy();
    expect(screen.getByText("Egna inställningar")).toBeTruthy();
  });

  it("pinnen och avstängning skriver gruppens listor, och en hemlighet ritas inte", () => {
    const r = ram({
      grupp: { moduler: ["ekonomi", "bibliotek"], huvudmeny: ["ekonomi"] },
      kopplingar: {
        lage: {
          "enable-banking": { status: "fel", fel: "Banken svarade inte", senasteSynk: "2026-10-01T10:00:00.000Z", token: "super-hemlig-nyckel", apiKey: "annan-nyckel" },
        },
        onAnslut: vi.fn(),
        onKopplaFran: vi.fn(),
      },
    });
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    expect(screen.queryByText("super-hemlig-nyckel")).toBeNull();
    expect(screen.queryByText("annan-nyckel")).toBeNull();
    expect(screen.getByText("Banken svarade inte")).toBeTruthy();
    expect(screen.getByText("Fel")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Koppla från" }));
    expect(r.kopplingar.onKopplaFran).toHaveBeenCalledWith("enable-banking");

    fireEvent.click(screen.getByRole("switch", { name: /På/ }));
    expect(r.onOrdning).toHaveBeenCalledWith(["bibliotek"]);
    expect(r.onSparaHuvudmeny).toHaveBeenCalledWith([]);
  });

  it("ett eget fält sparas, och utan egna fält och utan slot står tomheten", () => {
    const r = ram();
    const { unmount } = render(
      <OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>,
    );
    fireEvent.click(screen.getByRole("switch", { name: /Visa dolda/ }));
    expect(r.onSpara).toHaveBeenCalledWith({ modulId: "ekonomi", varden: { visadolda: true } });
    unmount();

    const utan = defineModule(BAS());
    render(
      <OpsModulSida modul={utan} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram()}>
        <p />
      </OpsModulSida>,
    );
    expect(screen.getByText("Inga egna inställningar.")).toBeTruthy();
  });

  it("en slot ritas, och en medlem som öppnat läget kan lämna det", () => {
    render(
      <OpsModulSida
        modul={defineModule(BAS())}
        activeHref="/ekonomi?lage=installningar"
        hubHref="/hub"
        ram={ram({ farAndra: false, egna: <p>Egen ruta</p> })}
      >
        <p>översikten</p>
      </OpsModulSida>,
    );
    expect(screen.getByText("Egen ruta")).toBeTruthy();
    expect(screen.queryByText("Inga egna inställningar.")).toBeNull();
    expect(screen.getByRole("link", { name: "Klar" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: /Visa i huvudmenyn/ })).toBeDisabled();
    expect(screen.getByText("Bara ägare och admin ändrar de här inställningarna.")).toBeTruthy();
  });

  it("en nyckel i manifestet avvisas", () => {
    expect(() => defineModule({
      ...BAS(),
      kopplingar: [{ id: "bank", namn: { sv: "Bank", en: "Bank" }, behorigheter: [], token: "super-hemlig-nyckel" }],
    })).toThrow(/token/);
  });
});
