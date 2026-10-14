import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsGruppFormular } from "../components/OpsGruppFormular.jsx";
import { OpsGruppHubb } from "../components/OpsHub.jsx";
import { OpsModulInstallningar } from "../components/OpsModulInstallningar.jsx";
import { OpsModulSida } from "../components/OpsModulSida.jsx";
import { hjalpSektioner } from "../hjalp/sok.js";
import { arkRader } from "../lib/apparark.js";
import { navForGrupp } from "../lib/grupplage.js";
import { hubbForGrupp, huvudmenyPoster, valbaraModuler } from "../lib/hubb.js";
import { arKarna, karnmoduler, medKarna } from "../lib/karna.js";
import { defineModule } from "../lib/modul.js";
import { tillaggFor } from "../lib/tillagg.js";

/**
 * Chatten är kärna (0.106.0, #386 skiva 1). CP 2026-10-14: "Den måste ju alltid följa med ramverket, blir inget man måste
 * installera."
 *
 * ⛔ PROVEN ÄR GRUPPER SOM SPARATS UTAN MEDDELANDEN, alltså läget i varje grupp där ägaren avinstallerade den före 0.106.0. Utan
 * `karna` (eller utan `medKarna` på läsvägen) försvinner chatten ur hubben, arket och huvudmenyn, och den står som en app att
 * installera. Varje prov är rött utan sin rad i ramverket.
 */

const I = () => <svg />;

/** @param {string} id @param {string} namn @param {Record<string, any>} [extra] */
function modul(id, namn, extra = {}) {
  return defineModule({
    id,
    namn: { sv: namn, en: namn },
    nav: [],
    routes: [],
    samlingar: [],
    kallor: {},
    skapar: [],
    hubb: { ikon: <I />, rutt: `/${id}`, startsida: "start", delar: [{ id: "start", namn: { sv: "Start", en: "Start" }, ikon: <I />, rutt: `/${id}/start` }] },
    ...extra,
  });
}

const Rostning = () => <p>röstning</p>;
const MEDDELANDEN = modul("meddelanden", "Meddelanden", {
  karna: true,
  hjalp: { rubrik: "Meddelanden", avsnitt: [{ id: "skriv", fraga: "Hur skriver jag?", svar: "I fältet.", sokord: [] }] },
  tillagg: [{ plats: "handelse.sektion", id: "rostning", etikett: { sv: "Röstning", en: "Vote" }, komponent: Rostning }],
  nav: [{ href: "/meddelanden", label: "Meddelanden" }],
});
const EKONOMI = modul("ekonomi", "Ekonomi");
const RESOR = modul("resor", "Resor");
const ALLA = [EKONOMI, MEDDELANDEN, RESOR];
// Sparad utan Meddelanden: en äldre grupp, eller en ägare som avinstallerade den före 0.106.0.
const UTAN = { id: "g1", namn: { sv: "Alfa", en: "Alfa" }, moduler: ["ekonomi"], huvudmeny: ["meddelanden", "ekonomi"] };

describe("manifestet", () => {
  it("⛔ karna är true eller false, alltid utskriven, och en sträng avvisas", () => {
    expect(MEDDELANDEN.karna).toBe(true);
    expect(EKONOMI.karna).toBe(false);
    expect(() => modul("x", "X", { karna: "ja" })).toThrow(/karna.*true, false eller utelämnat/);
    expect(karnmoduler(ALLA)).toEqual(["meddelanden"]);
    expect(arKarna(MEDDELANDEN)).toBe(true);
  });
  it("⛔ medKarna lägger en saknad kärnmodul sist och lämnar en som finns där ägaren ställt den", () => {
    expect(medKarna(["ekonomi"], ALLA)).toEqual(["ekonomi", "meddelanden"]);
    expect(medKarna(["meddelanden", "ekonomi"], ALLA)).toEqual(["meddelanden", "ekonomi"]);
    expect(medKarna(null, ALLA)).toEqual(["meddelanden"]);
    expect(medKarna(["ekonomi"], [EKONOMI])).toEqual(["ekonomi"]);
  });
});

describe("två kärnmoduler (CP: Inkorgen är också inbyggd)", () => {
  const INKORG = modul("inkorg", "Inkorg", { karna: true });
  const TVA = [EKONOMI, MEDDELANDEN, INKORG, RESOR];
  const UTAN_BADA = { ...UTAN, moduler: ["resor"], huvudmeny: [] };
  it("⛔ båda läggs tillbaka i registrets ordning, och ingen av dem går att installera eller välja", async () => {
    expect(karnmoduler(TVA)).toEqual(["meddelanden", "inkorg"]);
    expect(medKarna(["resor"], TVA)).toEqual(["resor", "meddelanden", "inkorg"]);
    expect(medKarna(["inkorg", "resor"], TVA)).toEqual(["inkorg", "resor", "meddelanden"]);
    expect(hubbForGrupp({ grupp: UTAN_BADA, moduler: TVA }).kort.map((m) => m.id)).toEqual(["resor", "meddelanden", "inkorg"]);
    render(<OpsGruppHubb grupp={UTAN_BADA} moduler={TVA} installera={{ href: "/installera" }} />);
    expect([...document.querySelectorAll("[data-hubb-valbar]")].map((el) => el.getAttribute("data-hubb-valbar"))).toEqual(["ekonomi"]);
  });
  it("⛔ Redigera grupp ritar ingen av dem och sparar båda", async () => {
    const onSpara = vi.fn(async () => {});
    render(<OpsGruppFormular formId="f" grupp={UTAN_BADA} onSpara={onSpara} moduler={{ valbara: valbaraModuler(TVA), agare: true }} />);
    const val = /** @type {HTMLElement} */ (document.querySelector("[data-gruppmoduler]"));
    expect([...val.querySelectorAll("[data-modul]")].map((el) => el.getAttribute("data-modul"))).toEqual(["ekonomi", "resor"]);
    fireEvent.submit(/** @type {HTMLFormElement} */ (document.querySelector("form#f")));
    await waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(/** @type {any} */ (onSpara.mock.calls[0])[0].grupp.moduler).toEqual(["resor", "meddelanden", "inkorg"]);
  });
});

describe("läsvägen ger tillbaka kärnan", () => {
  it("⛔ hubben, arket och huvudmenyn ritar Meddelanden fast den sparade listan saknar den", () => {
    expect(hubbForGrupp({ grupp: UTAN, moduler: ALLA }).kort.map((m) => m.id)).toEqual(["ekonomi", "meddelanden"]);
    expect(arkRader(UTAN, ALLA).map((r) => r.id)).toEqual(["ekonomi", "meddelanden"]);
    expect(huvudmenyPoster({ grupp: UTAN, moduler: ALLA }).map((p) => p.id)).toEqual(["ekonomi", "meddelanden"]);
  });
  it("⛔ tilläggen, navigationen och hjälpen räknar kärnan som påslagen", () => {
    expect(tillaggFor({ moduler: ALLA, grupp: UTAN, plats: "handelse.sektion" }).map((t) => t.id)).toEqual(["rostning"]);
    expect(navForGrupp({ groupId: "g1", ramnav: [], moduler: ALLA, mina: /** @type {any} */ ([UTAN]) }).nav.map((n) => n.href)).toEqual(["/meddelanden"]);
    expect(hjalpSektioner({ moduler: ALLA, grupp: UTAN }).map((s) => s.id)).toContain("meddelanden");
  });
});

describe("ingen väg att installera eller ta bort den", () => {
  it("⛔ hubben erbjuder den inte som en app att installera", () => {
    render(<OpsGruppHubb grupp={UTAN} moduler={ALLA} installera={{ href: "/installera" }} />);
    // Golv: listan över appar att installera finns och bär Resor, annars mäter provet ingenting.
    const valbara = [...document.querySelectorAll("[data-hubb-valbar]")].map((el) => el.getAttribute("data-hubb-valbar"));
    expect(valbara).toEqual(["resor"]);
    expect(document.querySelector('[data-hubb-valbar="meddelanden"]')).toBeNull();
  });
  it("⛔ Redigera grupp ritar den inte bland valen, och sparningen skriver tillbaka den", async () => {
    const onSpara = vi.fn(async () => {});
    render(<OpsGruppFormular formId="f" grupp={UTAN} onSpara={onSpara} moduler={{ valbara: valbaraModuler(ALLA), agare: true }} />);
    const val = /** @type {HTMLElement} */ (document.querySelector("[data-gruppmoduler]"));
    expect(within(val).queryByRole("button", { name: "Meddelanden" })).toBeNull();
    expect(within(val).getByRole("button", { name: "Ekonomi" })).toBeTruthy();
    expect(val.querySelector("[data-modul-okand]")).toBeNull();
    fireEvent.submit(/** @type {HTMLFormElement} */ (document.querySelector("form#f")));
    await waitFor(() => expect(onSpara).toHaveBeenCalled());
    expect(/** @type {any} */ (onSpara.mock.calls[0])[0].grupp.moduler).toEqual(["ekonomi", "meddelanden"]);
  });
  it("⛔ appens inställningar: På är på och avstängd, och säger varför", () => {
    const ram = { farAndra: true, grupp: UTAN, onOrdning: vi.fn(), onSparaHuvudmeny: vi.fn(), onSpara: vi.fn() };
    render(
      <OpsModulSida modul={MEDDELANDEN} activeHref="/meddelanden?lage=installningar" hubHref="/hub" ram={ram}>
        <p>chatten</p>
      </OpsModulSida>,
    );
    const pa = screen.getByRole("switch", { name: /^På/ });
    expect(/** @type {HTMLInputElement} */ (pa).checked).toBe(true);
    expect(pa).toBeDisabled();
    expect(screen.getByText(/hör till ramverket och finns alltid i gruppen/)).toBeTruthy();
    expect(ram.onOrdning).not.toHaveBeenCalled();
  });
  it("⛔ listan över installerade appar visar den", () => {
    render(<OpsModulInstallningar moduler={ALLA} grupp={UTAN} agare hrefFor={(m) => `/${m.id}?lage=installningar`} />);
    expect(screen.getByText("Meddelanden")).toBeTruthy();
  });
  it("⛔ arkets ordning sparas med kärnan, och tappar den inte", () => {
    const onOrdning = vi.fn();
    render(
      <OpsAppShell fasta={{ idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } }} moduler={[]} activeHref="/" onNavigate={(_h, e) => e?.preventDefault?.()} apparArk={{ moduler: ALLA, grupp: UTAN, farAndra: true, onOrdning }}>
        <p>sidan</p>
      </OpsAppShell>,
    );
    fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Appar" }));
    fireEvent.click(screen.getByRole("button", { name: "Byt ordning" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(within(dialog).getByRole("option", { name: "Ekonomi" }), { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Klar" }));
    expect(onOrdning).toHaveBeenCalledWith(["meddelanden", "ekonomi"]);
  });
});
