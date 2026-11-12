import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { OpsFargval } from "../components/OpsFargval.jsx";
import { OpsField } from "../components/OpsField.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { STANDARDPALETT } from "../lib/palett.js";
import { hallbarLjushet, hexTillHsl, hslTillHex } from "../lib/palettomfang.js";

/**
 * Färgväljaren (0.219.0, cllp/lifehub.app#798). Se filhuvudet i `OpsFargval.jsx`.
 *
 * ⛔ jsdom ritar ingen CSS: att skalan SYNS mäts i montaget med Playwright, inte här. Här mäts att reglagen finns och styr färgen,
 * att skalans delar kommer ur `hallbarLjushet`, att beskedet och knappen säger det skalan räknat, och tangentbordet.
 */

const CP = { ljus: { ...STANDARDPALETT.ljus, accent: "#94a37e" }, mork: { ...STANDARDPALETT.mork } };

afterEach(cleanup);

/** Styrd, som appens panel: utkastet är ett tillstånd och väljaren får det tillbaka. @param {{ start: string, palett?: any, onChange?: (v: string) => void, sprak?: "sv" | "en" }} props */
function Styrd({ start, palett, onChange, sprak = "sv" }) {
  const [v, setV] = useState(start);
  return (
    <OpsSprakProvider sprak={sprak}>
      <OpsField label="Accent">
        <OpsFargval
          value={v}
          onChange={(x) => {
            setV(x);
            onChange?.(x);
          }}
          palett={palett ? { ...palett, ljus: { ...palett.ljus, accent: v } } : undefined}
          lage="ljus"
          nyckel="accent"
        />
      </OpsField>
    </OpsSprakProvider>
  );
}

const oppna = () => fireEvent.click(screen.getByRole("button", { name: "Accent" }));
const reglage = (/** @type {string} */ namn) => /** @type {HTMLInputElement} */ (screen.getByRole("slider", { name: namn }));

describe("OpsFargval", () => {
  it("fältet bär färgkoden och rutan, och etiketten ur OpsField är knappens namn", () => {
    render(<Styrd start="#94a37e" />);
    const knapp = screen.getByRole("button", { name: "Accent" });
    expect(knapp.textContent).toContain("#94a37e");
    expect(/** @type {HTMLElement} */ (knapp.querySelector("[data-fargval-ruta]")).style.backgroundColor).toBe("rgb(148, 163, 126)");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ett tryck öppnar tre reglage med etiketter och värden i ord, och färgkoden att skriva i", () => {
    render(<Styrd start="#94a37e" />);
    oppna();
    const kulor = reglage("Kulör");
    expect(kulor.type).toBe("range");
    expect(kulor.getAttribute("aria-valuetext")).toBe("84 grader");
    expect(reglage("Mättnad").getAttribute("aria-valuetext")).toBe("17 procent");
    expect(reglage("Ljushet").getAttribute("aria-valuetext")).toBe("57 procent");
    expect(/** @type {HTMLInputElement} */ (screen.getByLabelText("Färgkod")).value).toBe("#94a37e");
    // Fokus på kulören när rutan öppnas.
    expect(document.activeElement).toBe(kulor);
  });

  it("reglagen ger #rrggbb, och kulören står kvar när ljusheten dras till svart", () => {
    const fick = vi.fn();
    render(<Styrd start="#94a37e" onChange={fick} />);
    oppna();
    fireEvent.change(reglage("Ljushet"), { target: { value: "30" } });
    expect(fick).toHaveBeenLastCalledWith(hslTillHex(Number(reglage("Kulör").value), Number(reglage("Mättnad").value), 30));
    fireEvent.change(reglage("Ljushet"), { target: { value: "0" } });
    expect(fick).toHaveBeenLastCalledWith("#000000");
    expect(Math.round(Number(reglage("Kulör").value))).toBe(84);
    // Tillbaka från svart: samma kulör och mättnad som före, inte grått.
    fireEvent.change(reglage("Ljushet"), { target: { value: "50" } });
    const { kulor, mattnad } = hexTillHsl("#94a37e");
    expect(fick).toHaveBeenLastCalledWith(hslTillHex(kulor, mattnad, 50));
  });

  it("⛔ CP:s skärmbild: skalan visar var det håller, säger gör den mörkare, och knappen ger närmaste som håller", () => {
    const fick = vi.fn();
    render(<Styrd start="#94a37e" palett={CP} onChange={fick} />);
    oppna();
    const o = hallbarLjushet(CP, "ljus", "accent", "#94a37e");
    const panel = /** @type {HTMLElement} */ (document.querySelector("[data-fargval-panel]"));
    const haller = [...panel.querySelectorAll("[data-skala-haller]")];
    expect(haller.length).toBe(o.intervall.length);
    expect(haller.length).toBeGreaterThanOrEqual(1);
    expect(/** @type {HTMLElement} */ (haller[0]).style.left).toBe("0%");
    expect(panel.querySelectorAll("[data-skala-haller-inte]").length).toBeGreaterThanOrEqual(1);
    const status = /** @type {HTMLElement} */ (panel.querySelector("[data-fargval-status]"));
    expect(status.getAttribute("data-fargval-status")).toBe("morkare");
    expect(status.textContent).toContain("För ljus. Gör den mörkare.");
    expect(status.textContent).toContain("Håller mellan 0 och 35 %");
    expect(status.textContent).toContain("Du står på 57 %.");
    // Reglaget beskrivs av raden, så att den som lyssnar hör samma sak.
    expect(reglage("Ljushet").getAttribute("aria-describedby")).toBe(status.id);
    fireEvent.click(screen.getByRole("button", { name: "Använd närmaste som fungerar" }));
    expect(fick).toHaveBeenLastCalledWith(o.narmaste);
    expect(/** @type {HTMLElement} */ (panel.querySelector("[data-fargval-status]")).getAttribute("data-fargval-status")).toBe("haller");
    expect(screen.queryByRole("button", { name: "Använd närmaste som fungerar" })).toBeNull();
  });

  it("på engelska", () => {
    render(<Styrd start="#94a37e" palett={CP} sprak="en" />);
    oppna();
    expect(screen.getByRole("slider", { name: "Lightness" })).toBeTruthy();
    expect(document.querySelector("[data-fargval-status]")?.textContent).toContain("Too light. Make it darker.");
    expect(screen.getByRole("button", { name: "Use the nearest that works" })).toBeTruthy();
  });

  it("utan palett: reglagen utan skala, och inget besked", () => {
    render(<Styrd start="#94a37e" />);
    oppna();
    expect(document.querySelectorAll("[data-skala-haller], [data-skala-haller-inte]").length).toBe(0);
    expect(document.querySelector("[data-fargval-status]")).toBeNull();
    expect(reglage("Ljushet").getAttribute("aria-describedby")).toBeNull();
  });

  it("färgkoden går att skriva: det som skrivs går vidare som det står, och en halv kod säger formen", () => {
    const fick = vi.fn();
    render(<Styrd start="#94a37e" onChange={fick} />);
    oppna();
    const falt = /** @type {HTMLInputElement} */ (screen.getByLabelText("Färgkod"));
    fireEvent.change(falt, { target: { value: "#12" } });
    expect(fick).toHaveBeenLastCalledWith("#12");
    expect(screen.getByText("Skriv sex tecken efter #, till exempel #8e7a4e.")).toBeTruthy();
    // ⛔ En hel kod går vidare i palettens form (granskningen av PR 581): versaler och mellanslag hade annars gjort paletten ogiltig utan fel.
    fireEvent.change(falt, { target: { value: "#1F1F25" } });
    expect(fick).toHaveBeenLastCalledWith("#1f1f25");
    fireEvent.change(falt, { target: { value: " 1f1f25 " } });
    expect(fick).toHaveBeenLastCalledWith("#1f1f25");
    // Reglagen följer en kod som skrivits.
    expect(reglage("Ljushet").getAttribute("aria-valuetext")).toBe("13 procent");
  });

  it("⛔ en kort kod som #abc går vidare som den står och säger formen, så att den går att skriva klart", () => {
    const fick = vi.fn();
    render(<Styrd start="#94a37e" onChange={fick} />);
    oppna();
    fireEvent.change(screen.getByLabelText("Färgkod"), { target: { value: "#abc" } });
    expect(fick).toHaveBeenLastCalledWith("#abc");
    expect(screen.getByText("Skriv sex tecken efter #, till exempel #8e7a4e.")).toBeTruthy();
  });

  it("⛔ en skriven svart kod tar inte kulören: reglaget står kvar, och tillbaka från svart blir samma kulör", () => {
    const fick = vi.fn();
    render(<Styrd start="#94a37e" onChange={fick} />);
    oppna();
    fireEvent.change(screen.getByLabelText("Färgkod"), { target: { value: "#000000" } });
    expect(Math.round(Number(reglage("Kulör").value))).toBe(84);
    expect(Math.round(Number(reglage("Mättnad").value))).toBe(17);
    fireEvent.change(reglage("Ljushet"), { target: { value: "50" } });
    const { kulor, mattnad } = hexTillHsl("#94a37e");
    expect(fick).toHaveBeenLastCalledWith(hslTillHex(kulor, mattnad, 50));
  });

  it("Escape stänger, och fokus går tillbaka till fältet", async () => {
    render(<Styrd start="#94a37e" />);
    oppna();
    expect(document.activeElement).toBe(reglage("Kulör"));
    fireEvent.keyDown(reglage("Kulör"), { key: "Escape" });
    expect(screen.queryByRole("slider", { name: "Kulör" })).toBeNull();
    // Radix lämnar tillbaka fokus i nästa uppgift efter att rutan tagits bort.
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Accent" })));
  });

  it("träffytorna är 44 px (min-h-11 och h-11)", () => {
    render(<Styrd start="#94a37e" palett={CP} />);
    expect(screen.getByRole("button", { name: "Accent" }).className).toMatch(/\bmin-h-11\b/);
    oppna();
    for (const namn of ["Kulör", "Mättnad", "Ljushet"]) expect(reglage(namn).className).toMatch(/\bh-11\b/);
    expect(screen.getByRole("button", { name: "Använd närmaste som fungerar" }).className).toMatch(/\bmin-h-11\b/);
  });
});
