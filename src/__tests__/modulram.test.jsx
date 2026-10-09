import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsHuvudmenyProvider } from "../components/OpsHuvudmeny.jsx";
import { OpsModulSida } from "../components/OpsModulSida.jsx";
import { OpsSwitch } from "../components/OpsToggle.jsx";
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
    const sidrubrik = screen.getByRole("heading", { name: "Ekonomi · Inställningar" });
    expect(sidrubrik.className).toContain("font-semibold");
    expect(sidrubrik.className).not.toContain("font-bold");
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
    const bankfel = screen.getByRole("alert");
    expect(bankfel.textContent).toBe("Banken svarade inte");
    expect(bankfel.className).toContain("bg-danger-bg");
    expect(bankfel.className).toContain("border");
    expect(screen.getByText("Fel")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Koppla från" }));
    expect(r.kopplingar.onKopplaFran).toHaveBeenCalledWith("enable-banking");

    fireEvent.click(screen.getByRole("switch", { name: /På/ }));
    expect(r.onOrdning).toHaveBeenCalledWith(["bibliotek"]);
    expect(r.onSparaHuvudmeny).toHaveBeenCalledWith([]);
  });

  it("ett eget fält sparas, och utan egna fält och utan slot ritas inte avsnittet", () => {
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
    expect(screen.queryByText("Inga egna inställningar.")).toBeNull();
    expect(screen.queryByText("Inga kopplingar.")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Egna inställningar" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Kopplingar" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Allmänt" })).toBeTruthy();
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

  it("ram.kropp ersätter de tre avsnitten, och utan kropp står På kvar", () => {
    const { unmount } = render(
      <OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram({ kropp: <p>Agentens egna</p> })}>
        <p>översikten</p>
      </OpsModulSida>,
    );
    expect(screen.getByText("Agentens egna")).toBeTruthy();
    expect(screen.queryByText("översikten")).toBeNull();
    expect(screen.queryByRole("switch", { name: /På/ })).toBeNull();
    expect(screen.queryByText("Kopplingar")).toBeNull();
    unmount();

    render(
      <OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram()}>
        <p>översikten</p>
      </OpsModulSida>,
    );
    expect(screen.queryByText("Agentens egna")).toBeNull();
    expect(screen.getByRole("switch", { name: /På/ })).toBeTruthy();
    expect(screen.getByText("Kopplingar")).toBeTruthy();
  });

  it("tummen slår om innan sparningen svarar, och ett avslag ställer tillbaka den", async () => {
    /** @type {() => void} */
    let avsla = () => {};
    const r = ram({
      onOrdning: vi.fn(() => new Promise((_, nej) => { avsla = () => nej(new Error("Nätet svarade inte")); })),
    });
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    expect(screen.getByRole("switch", { name: "På" })).toBeChecked();
    fireEvent.click(screen.getByRole("switch", { name: "På" }));
    expect(screen.getByRole("switch", { name: "På" })).not.toBeChecked();
    expect(r.onOrdning).toHaveBeenCalledWith(["bibliotek"]);
    expect(document.querySelector("[data-installning-fel]")).toBeNull();
    avsla();
    await waitFor(() => expect(screen.getByRole("switch", { name: "På" })).toBeChecked());
    const fel = document.querySelector("[data-installning-fel]");
    expect(fel?.textContent).toBe("Nätet svarade inte");
    expect(fel?.getAttribute("role")).toBe("alert");
  });

  it("ett eget fält slår om innan sparningen svarar, och ett avslag ställer tillbaka det", async () => {
    /** @type {() => void} */
    let avsla = () => {};
    const r = ram({
      onSpara: vi.fn(() => new Promise((_, nej) => { avsla = () => nej(new Error("Nätet svarade inte")); })),
    });
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    fireEvent.click(screen.getByRole("switch", { name: "Visa dolda" }));
    expect(screen.getByRole("switch", { name: "Visa dolda" })).toBeChecked();
    expect(r.onSpara).toHaveBeenCalledWith({ modulId: "ekonomi", varden: { visadolda: true } });
    avsla();
    await waitFor(() => expect(screen.getByRole("switch", { name: "Visa dolda" })).not.toBeChecked());
    expect(document.querySelector("[data-installning-fel]")?.textContent).toBe("Nätet svarade inte");
  });

  it("ett tryck på hjälptexten slår om På, och raden håller höjdgolvet från md", () => {
    const r = ram();
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    const etikett = screen.getByText("På").closest("label");
    expect(etikett?.className).toContain("min-h-11");
    expect(etikett?.className).toContain("w-full");
    expect(etikett?.className).not.toContain("md:min-h-0");
    fireEvent.click(screen.getByText("Appen är installerad i gruppen."));
    expect(r.onOrdning).toHaveBeenCalledWith(["bibliotek"]);
    expect(screen.getByRole("switch", { name: "På" })).not.toBeChecked();
  });

  it("ordningen är pilar med platsen mellan, och den flyttar innan sparningen svarar", async () => {
    /** @type {() => void} */
    let avsla = () => {};
    const r = ram({
      onOrdning: vi.fn(() => new Promise((_, nej) => { avsla = () => nej(new Error("Nätet svarade inte")); })),
    });
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    expect(screen.queryByText("Flytta upp")).toBeNull();
    expect(screen.queryByText("Flytta ned")).toBeNull();
    expect(screen.queryByText(/Plats \d/)).toBeNull();
    expect(screen.queryByText("Synlighet")).toBeNull();
    expect(document.querySelector("[data-ordning-plats]")?.textContent).toBe("1/2");
    expect(screen.getByRole("button", { name: "Flytta upp" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Flytta ned" }));
    expect(document.querySelector("[data-ordning-plats]")?.textContent).toBe("2/2");
    expect(r.onOrdning).toHaveBeenCalledWith(["bibliotek", "ekonomi"]);
    avsla();
    await waitFor(() => expect(document.querySelector("[data-ordning-plats]")?.textContent).toBe("1/2"));
  });

  it("ikonraden öppnar ikonen och sparar den inte", () => {
    const r = ram();
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    const knapp = screen.getByRole("button", { name: /Ikon/ });
    expect(knapp.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector("[data-ikon-opp]")).toBeNull();
    fireEvent.click(knapp);
    expect(knapp.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("[data-ikon-opp]")).toBeTruthy();
    expect(r.onSpara).not.toHaveBeenCalled();
    expect(r.onOrdning).not.toHaveBeenCalled();
  });

  it("kugghjulet och Klar sitter i huvudets bakre plats", () => {
    const { unmount } = render(
      <OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram()}>
        <p />
      </OpsModulSida>,
    );
    const slot = document.querySelector("[data-modul-huvud-atgard]");
    expect(slot?.className).toContain("ml-auto");
    expect(slot?.querySelector("[data-modul-lage-knapp='klar']")).toBeTruthy();
    expect(slot?.parentElement?.querySelector("h1")).toBeNull();
    expect(screen.getByRole("heading", { name: "Ekonomi · Inställningar" })).toBeTruthy();
    unmount();

    render(
      <OpsHuvudmenyProvider moduler={["ekonomi"]}>
        <OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram({ grupp: { ...GRUPP, huvudmeny: ["ekonomi"] } })}>
          <p />
        </OpsModulSida>
      </OpsHuvudmenyProvider>,
    );
    const fastSlot = document.querySelector("[data-modul-huvud-atgard]");
    const rad = fastSlot?.parentElement;
    expect(rad?.querySelector("h1")?.textContent).toBe("Ekonomi · Inställningar");
    expect(rad?.querySelector("[data-modul-lage-knapp='klar']")).toBeTruthy();
  });

  it("en okänd placering på strömbrytaren avvisas", () => {
    expect(() => render(<OpsSwitch label="På" checked={false} onChange={() => {}} placering="mitt" />)).toThrow(/okänd placering/);
  });

  it("en nyckel i manifestet avvisas", () => {
    expect(() => defineModule({
      ...BAS(),
      kopplingar: [{ id: "bank", namn: { sv: "Bank", en: "Bank" }, behorigheter: [], token: "super-hemlig-nyckel" }],
    })).toThrow(/token/);
  });
});
