import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsButton } from "../components/OpsButton.jsx";

/**
 * Plusset i skalets topprad (#168).
 *
 * ══ ⛔ MÄTT MOT SESSIONSTUDIO (CP:s skärminspelning, ss-skapa-meny.png) ═════
 *
 * Plusset öppnar en POPOVER under knappen, en platt lista med en rad per
 * sak. Ett tryck på en rad öppnar en RIKTIG modal, aldrig en andra vy inuti
 * popovern. Idag/kalendern och Inkorgen är RAMVERKETS egna vyer, inte
 * moduler (CP:s rättelse 23:35), och deras rader ("Ny händelse", "Nytt
 * ärende") ritas därför FÖRST, före modulernas registreringar.
 */

const REG = (/** @type {string} */ id, /** @type {string | null} */ katalog = null) => ({
  id,
  namn: { sv: id, en: id },
  ikon: "gem",
  katalog,
  form: (/** @type {any} */ props) => <p>{`form ${id}, groupId=${props.groupId}, typ=${props.typ}`}</p>,
});

const enkelNav = [{ href: "/", label: "Start" }];

describe("OpsAppShell skapa (#168)", () => {
  it("⛔ utan skapa-prop ritas inget plus", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/">
        <p>innehåll</p>
      </OpsAppShell>,
    );
    expect(screen.queryByRole("button", { name: "Skapa" })).toBeNull();
  });

  it("⛔ utan handelse/arende OCH utan registreringar (modulerna redo) ritas inget plus", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" skapa={{ registreringar: [], lage: "bolaget" }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    expect(screen.queryByRole("button", { name: "Skapa" })).toBeNull();
  });

  it("⛔ utan registreringar men MED en ramverksrad ritas plusset ändå", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" skapa={{ handelse: <p>formulär</p> }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    expect(screen.getByRole("button", { name: "Skapa" })).toBeTruthy();
  });

  it("en rad öppnar en RIKTIG modal, med registreringens namn som rubrik", () => {
    render(
      <OpsAppShell
        brand="Ops"
        nav={enkelNav}
        activeHref="/"
        skapa={{ registreringar: [{ ...REG("arende", "sorter"), modulId: "inkorg" }], lage: "bolaget" }}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "arende" }));

    // ⛔ EN RIKTIG DIALOG, INTE EN ANDRA VY I POPOVERN: `role="dialog"` med
    // rubriken som `Dialog.Title`, och popoverns lista är stängd (borta ur DOM:en).
    expect(screen.getByRole("dialog", { name: "arende" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "arende" })).toBeNull();
  });

  it("⛔ formuläret får groupId ur skapalaget och typ ur katalogen, som förut", () => {
    render(
      <OpsAppShell
        brand="Ops"
        nav={enkelNav}
        activeHref="/"
        skapa={{
          registreringar: [{ ...REG("arende", "sorter"), modulId: "inkorg" }],
          lage: "bolaget",
          kataloger: [{ id: "sorter", kategorier: [{ id: "rakning", namn: { sv: "Räkning" }, ordning: 1 }] }],
        }}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "arende" }));
    expect(screen.getByText("form arende, groupId=bolaget, typ=rakning")).toBeTruthy();
  });

  it("⛔ onKlar anropas och modalen stängs", () => {
    const onKlar = vi.fn();
    const Form = (/** @type {any} */ props) => (
      <button type="button" onClick={props.onKlar}>
        spara
      </button>
    );
    render(
      <OpsAppShell
        brand="Ops"
        nav={enkelNav}
        activeHref="/"
        skapa={{ registreringar: [{ ...REG("kvitto"), form: Form, modulId: "kvitton" }], lage: "bolaget", onKlar }}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "kvitto" }));
    fireEvent.click(screen.getByRole("button", { name: "spara" }));
    expect(onKlar).toHaveBeenCalledWith({ registrering: "kvitto", typ: null });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("⛔ två moduler ger två grupper av rader med en avdelare emellan", () => {
    render(
      <OpsAppShell
        brand="Ops"
        nav={enkelNav}
        activeHref="/"
        skapa={{
          registreringar: [
            { ...REG("arende"), modulId: "inkorg" },
            { ...REG("kvitto"), modulId: "kvitton" },
          ],
          lage: "bolaget",
        }}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });

  it("⛔ RAMVERKETS RADER FÖRST, MODULERNAS SEDAN, med en avdelare emellan", () => {
    render(
      <OpsAppShell
        brand="Ops"
        nav={enkelNav}
        activeHref="/"
        skapa={{
          handelse: <p>händelseformulär</p>,
          arende: <p>ärendeformulär</p>,
          registreringar: [{ ...REG("kvitto"), modulId: "kvitton" }],
          lage: "bolaget",
        }}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    const namn = Array.from(document.querySelectorAll('[role="dialog"], button'))
      .map((el) => el.textContent)
      .filter(Boolean);
    const iOrdning = ["Ny händelse", "Nytt ärende", "kvitto"].map((n) => namn.findIndex((t) => t?.includes(n)));
    expect(iOrdning.every((i) => i >= 0)).toBe(true);
    expect(iOrdning).toEqual([...iOrdning].sort((a, b) => a - b));
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });

  it("⛔ Ny händelse öppnar skapa.handelse i en modal med den etiketten som rubrik", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" skapa={{ handelse: <p data-testid="handelseform">Formulär</p> }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Ny händelse" }));
    expect(screen.getByRole("dialog", { name: "Ny händelse" })).toBeTruthy();
    expect(screen.getByTestId("handelseform")).toBeTruthy();
  });

  it("⛔ Nytt ärende öppnar skapa.arende i en modal med den etiketten som rubrik", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" skapa={{ arende: <p data-testid="arendeform">Formulär</p> }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Nytt ärende" }));
    expect(screen.getByRole("dialog", { name: "Nytt ärende" })).toBeTruthy();
    expect(screen.getByTestId("arendeform")).toBeTruthy();
  });

  // ══ #168, ANDRA GRANSKNINGEN: MÄTT MOT SESSIONSTUDIOS AppHeader.jsx ══════
  it("⛔ plussets EGEN knapp bär SAMMA klasser som OpsButton variant=\"primary\" round iconOnly", () => {
    // ⛔ INTE `asChild` (se OpsAppShell.jsx filhuvud vid triggern): en
    // funktionskomponent utan forwardRef kan inte vara Radix asChild-barn
    // utan att förlora sin ref. Provet bevisar i stället att formen är
    // IDENTISK, inte att komponenten återanvänds rakt av.
    render(<OpsButton variant="primary" round iconOnly ariaLabel="Jamforelse" onClick={() => {}}>x</OpsButton>);
    const jamforelse = screen.getByRole("button", { name: "Jamforelse" });

    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" skapa={{ handelse: <p>x</p> }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    const plus = screen.getByRole("button", { name: "Skapa" });

    for (const klass of ["rounded-full", "bg-accent", "text-accent-contrast", "size-8", "p-0"]) {
      expect(jamforelse.className).toContain(klass);
      expect(plus.className).toContain(klass);
    }
  });

  it("⛔ popovern mäter w-56 (14rem, 224 px, mätt ur SessionStudios create-meny)", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" skapa={{ handelse: <p>x</p> }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    expect(screen.getByRole("button", { name: "Ny händelse" }).closest('[class*="w-56"]')).toBeTruthy();
  });

  it("⛔ ramverkets rad har en ikon i accentfärg, samma mått som SessionStudios create-rad", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" skapa={{ handelse: <p>x</p> }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    const rad = screen.getByRole("button", { name: "Ny händelse" });
    // Ikonen finns i raden (aria-hidden, hittas via querySelector eftersom
    // den är dekorativ).
    expect(rad.querySelector("svg")).toBeTruthy();
    for (const klass of ["text-sm", "font-medium", "px-4", "py-2.5", "gap-3", "text-accent"]) {
      expect(rad.className).toContain(klass);
    }
  });

  it("⛔ en modulrad i plusset är LIKA accentfärgad som ramverkets egna rader", () => {
    render(
      <OpsAppShell
        brand="Ops"
        nav={enkelNav}
        activeHref="/"
        skapa={{ registreringar: [{ ...REG("kvitto"), modulId: "kvitton" }], lage: "bolaget" }}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    const rad = screen.getByRole("button", { name: "kvitto" });
    expect(rad.className).toContain("text-accent");
    expect(rad.className).toContain("text-sm");
  });
});
