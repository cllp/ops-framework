import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsDeladHandelse } from "../components/OpsDeladHandelse.jsx";
import { OpsDeladSida } from "../components/OpsDeladSida.jsx";
import { OpsGastSida } from "../components/OpsGastSida.jsx";

/**
 * Märket i huvudet är detsamma på gästens sida och på de två delade sidorna (0.204.0, CP 2026-11-08: "Alla delningar. Kolla loggans storlek och kolla så att det ser samma ut med alla
 * delningar och gästvy. VI måste ha enhetlighet.").
 *
 * ⛔ JÄMFÖRELSEN ÄR MOT GÄSTENS SIDA SOM DEN RITAS, inte mot en lista klasser som provet skriver av. En avskriven lista hade varit en tredje kopia att hålla i takt (regel 2) och hade varit
 * grön också om gästens märke ändrats. Storleken som den SYNS mäts i `check:skalyta`: jsdom kör ingen CSS.
 *
 * Röda mot 0.203.0: de delade sidorna tog ingen `marke` och ritade inget märke.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const MARKE = { ljus: "/marke-ljus.png", mork: "/marke-mork.png", namn: "LifeHub" };
const OM = { href: "https://life-hub.app", namn: "LifeHub" };

/** Märkets ruta på en sida, med det som ska vara lika: taggen, klasserna, bildernas klasser, källor och alternativtexter, och länkens mål. */
/** @param {string} sida */
function form(sida) {
  const ruta = /** @type {HTMLElement | null} */ (document.querySelector(`header [data-${sida}-huvud] [data-${sida}-marke]`));
  if (!ruta) return null;
  return {
    tagg: ruta.tagName,
    klass: ruta.className,
    bilder: [...ruta.querySelectorAll("img")].map((b) => ({ klass: b.className, src: b.getAttribute("src"), alt: b.getAttribute("alt"), dold: b.getAttribute("aria-hidden") })),
    href: ruta.getAttribute("href"),
    target: ruta.getAttribute("target"),
    rel: ruta.getAttribute("rel"),
    etikett: ruta.getAttribute("aria-label"),
  };
}

const ritaGast = (extra = {}) => render(<OpsGastSida lank={null} onLos={vi.fn()} onHamta={vi.fn()} onNyLank={vi.fn()} marke={MARKE} {...extra} />);
const ritaDelad = (extra = {}) => render(<OpsDeladSida marke={MARKE} {...extra}>innehåll</OpsDeladSida>);
const ritaHandelse = (extra = {}) => render(<OpsDeladHandelse laddar marke={MARKE} {...extra} />);

/** Gästens märke, ritat på riktigt, som de andra jämförs mot. */
function gastensForm(extra = {}) {
  ritaGast(extra);
  const f = form("gast");
  cleanup();
  return f;
}

describe("PublikMarke: ett märke på gästens sida och i delningarna (0.204.0)", () => {
  it("⛔ med marke ritar OpsDeladSida och OpsDeladHandelse samma märke med samma klasser som gästens sida", () => {
    const gast = gastensForm();
    expect(gast, "golv: gästens sida ritade ett märke").not.toBeNull();
    expect(gast?.tagg).toBe("SPAN");
    expect(gast?.bilder).toHaveLength(2);
    ritaDelad();
    expect(form("delad"), "OpsDeladSida").toEqual(gast);
    cleanup();
    ritaHandelse();
    expect(form("dh"), "OpsDeladHandelse").toEqual(gast);
  });

  it("⛔ med omAppen är märket en länk i ny flik på alla tre sidorna, med samma namn och samma klasser", () => {
    const gast = gastensForm({ omAppen: OM });
    expect(gast).toMatchObject({ tagg: "A", href: "https://life-hub.app", target: "_blank", rel: "noopener noreferrer", etikett: "Om LifeHub, öppnas i en ny flik" });
    ritaDelad({ omAppen: OM });
    expect(form("delad")).toEqual(gast);
    expect(screen.getByRole("link", { name: "Om LifeHub, öppnas i en ny flik" })).toHaveAttribute("data-delad-marke-lank");
    cleanup();
    ritaHandelse({ omAppen: OM });
    expect(form("dh")).toEqual(gast);
    expect(screen.getByRole("link", { name: "Om LifeHub, öppnas i en ny flik" })).toHaveAttribute("data-dh-marke-lank");
    cleanup();
    ritaDelad({ omAppen: OM, sprak: "en" });
    expect(screen.getByRole("link", { name: "About LifeHub, opens in a new tab" })).toBeInTheDocument();
  });

  it("huvud står kvar efter märket, och utan marke är de delade sidorna som förut", () => {
    ritaDelad({ huvud: <a href="/tillbaka">Tillbaka</a> });
    const huvud = /** @type {HTMLElement} */ (document.querySelector("[data-delad-huvud]"));
    expect(huvud.firstElementChild?.hasAttribute("data-delad-marke")).toBe(true);
    expect(within(huvud).getByRole("link", { name: "Tillbaka" })).toBeInTheDocument();
    cleanup();
    render(<OpsDeladHandelse laddar huvud={<span data-eget="">Eget</span>} />);
    expect(document.querySelector("[data-publik-marke]")).toBeNull();
    expect(document.querySelector("[data-dh-huvud] [data-eget]")).not.toBeNull();
  });

  it("ett trasigt marke kastar med sidans namn, och en omAppen som inte är https kastar", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => ritaDelad({ marke: { ljus: "a" } })).toThrow(/OpsDeladSida: marke är/);
    expect(() => ritaHandelse({ marke: { ljus: "a", mork: "b", namn: " " } })).toThrow(/OpsDeladHandelse: marke är/);
    expect(() => ritaDelad({ omAppen: { href: "javascript:alert(1)", namn: "X" } })).toThrow(/https/);
  });
});
