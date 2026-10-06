import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsButton } from "../components/OpsButton.jsx";
import { OpsIconLink } from "../components/OpsIconLink.jsx";

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

  it("en rad öppnar en PANEL, med registreringens namn som rubrik", () => {
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

    // ⛔ 0.31.0: EN PANEL, INTE EN DIALOG. Regionen bär rubriken, ingen `role="dialog"` finns för formuläret, och popoverns
    // lista är stängd (borta ur DOM:en).
    expect(screen.getByRole("region", { name: "arende" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
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

  it("⛔ Ny händelse öppnar skapa.handelse i en panel med den etiketten som rubrik", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" skapa={{ handelse: <p data-testid="handelseform">Formulär</p> }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Ny händelse" }));
    expect(screen.getByRole("region", { name: "Ny händelse" })).toBeTruthy();
    expect(screen.getByTestId("handelseform")).toBeTruthy();
  });

  it("⛔ Nytt ärende öppnar skapa.arende i en panel med den etiketten som rubrik", () => {
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" skapa={{ arende: <p data-testid="arendeform">Formulär</p> }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Nytt ärende" }));
    expect(screen.getByRole("region", { name: "Nytt ärende" })).toBeTruthy();
    expect(screen.getByTestId("arendeform")).toBeTruthy();
  });

  // ══ #168, ANDRA GRANSKNINGEN: MÄTT MOT SESSIONSTUDIOS AppHeader.jsx ══════
  it("⛔ plussets knapp är en fylld accentcirkel på dator och den dämpade cirkeln i mobil (0.60.0)", () => {
    // ⛔ 0.60.0, CP 2026-10-05: "Kan man göra +et sådär framträdande som det är på mobil. Samma position men större och
    // framträdande." Före det (0.30.0, #173) var plusset en dämpad 36 px cirkel som SS `AppHeader.jsx:376`, eftersom en
    // accentfylld knapp bland likar "skrek". Provet bevisar klasserna; pixlarna och färgen mäts i `check-skalyta`
    // (jsdom ritar ingen CSS).
    render(
      <OpsAppShell brand="Ops" nav={enkelNav} activeHref="/" skapa={{ handelse: <p>x</p> }} meny={{ onLoggaUt: () => {} }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    const plus = screen.getByRole("button", { name: "Skapa" });
    const hamburgare = screen.getByRole("button", { name: /Meny, fler åtgärder/ });
    // Hamburgaren är oförändrad: dämpad 36 px cirkel, 24 px ikon under md.
    // ⛔ 0.59.1 (bolag-ops#563): `p-1.5` runt en 24 px ikon i samma 36 px cirkel, inte SS `p-2` runt 20; bara under md, CP: "563 är bara i mobil".
    // ⛔ 0.62.0 (bolag-ops#565): 44 px knapp under md, SS 36 från md.
    for (const klass of ["rounded-full", "size-11", "md:size-9", "p-2.5", "[&_svg]:size-6", "md:p-2", "md:[&_svg]:size-5", "hover:bg-raised", "after:size-11"]) {
      expect(hamburgare.className, `hamburgaren saknar ${klass}`).toContain(klass);
    }
    // Plusset: 36 px dämpad under md (ingen bottenrad här), 40 px fylld accent från md, 24 px plus, 44 px träffyta.
    for (const klass of ["rounded-full", "size-11", "md:size-10", "p-2.5", "md:p-2", "[&_svg]:size-6", "text-ink-muted", "md:bg-accent", "md:text-accent-contrast", "md:hover:bg-accent-hover", "focus-visible:outline-accent", "after:size-11"]) {
      expect(plus.className, `plusset saknar ${klass}`).toContain(klass);
    }
    expect(plus.className).not.toContain("md:[&_svg]:size-5");
  });

  it("⛔ plusset ligger FÖRST i högerklustret, före ikonlänkarna, avataren och hamburgaren (0.60.0)", () => {
    render(
      <OpsAppShell
        brand="Ops"
        nav={enkelNav}
        activeHref="/"
        skapa={{ handelse: <p>x</p> }}
        actions={<OpsIconLink href="/inkorg" label="Inkorg" icon={<i />} />}
        meny={{ onLoggaUt: () => {} }}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    const plus = screen.getByRole("button", { name: "Skapa" });
    const hamburgare = screen.getByRole("button", { name: /Meny, fler åtgärder/ });
    const kluster = plus.parentElement;
    expect(kluster).toBe(hamburgare.parentElement);
    expect(kluster?.firstElementChild).toBe(plus);
    const inkorg = screen.getByRole("link", { name: "Inkorg" });
    expect(inkorg.parentElement).toBe(kluster);
    expect(Array.from(kluster?.children ?? []).indexOf(plus)).toBeLessThan(Array.from(kluster?.children ?? []).indexOf(inkorg));
  });

  it("⛔ med bottenradens plus är huvudets plus gömt under md men syns från md, med display i EN klass (0.60.0)", () => {
    render(
      <OpsAppShell
        brand="Ops"
        activeHref="/"
        fasta={{ idag: { href: "/", label: "Idag" }, kalender: { href: "/k", label: "Kalender" }, hub: { href: "/h", label: "Hub" } }}
        skapa={{ handelse: <p>x</p> }}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    const plus = screen.getAllByRole("button", { name: "Skapa" }).find((b) => b.className.includes("md:bg-accent"));
    expect(plus).toBeTruthy();
    expect(plus?.className).toContain("hidden md:inline-flex");
    expect(plus?.className.split(/\s+/)).not.toContain("inline-flex");
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
    for (const klass of ["text-etikett", "font-medium", "px-4", "py-2.5", "gap-3", "text-accent"]) {
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
    expect(rad.className).toContain("text-etikett");
  });
});
