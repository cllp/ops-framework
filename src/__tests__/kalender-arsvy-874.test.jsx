import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { ARV_TON_KULOR } from "../lib/gruppfarg.js";
import { OpsKalenderAr } from "../components/OpsKalenderAr.jsx";

/*
 * cllp/lifehub.app#874 skiva 1: "Visa året". En liten knapp i kalenderns verktygsrad fäller ut året i helskärm, som kartan och PDF-vyn.
 * ⛔ RÖTT UTAN ÄNDRINGEN: ingen knapp "Visa året" finns, och OpsKalenderAr finns inte.
 */

/*
 * ⛔ TRE MÅNADER, INTE 25 (granskningen av CI på PR 615). Kalendern renderar som förval tolv månader bakåt och tolv framåt, och under CI:s last nådde det
 * första provet vitests gräns på 5 s, eftersom årsvyn dessutom hämtas lat. Juni till augusti 2027 räcker för allt proven trycker på, som de andra kalenderproven.
 * Väntan gäller årsvyn med namn, inte vilken dialog som helst.
 */
const IDAG = new Date(2027, 6, 1);
const KALENDRAR = [
  { id: "barn", namn: "Barnen hos CP", farg: 2 },
  { id: "lov", namn: "Skollov", farg: 4 },
];
const POSTER = [
  { id: "v1", date: "2027-07-05", endDate: "2027-07-07", title: "Barnvecka", kalender: KALENDRAR[0] },
  { id: "h1", date: "2027-07-06", allDay: true, title: "Lovdag", kalender: KALENDRAR[1] },
  { id: "m1", date: "2027-07-06", time: "14:00", title: "Möte", kalender: KALENDRAR[0] },
];

describe("⛔ Visa året i kalendern (#874)", () => {
  it("⛔ knappen finns från början (CP 2026-11-17), och arsvy={false} tar bort den", () => {
    const { rerender } = render(<OpsCalendar ariaLabel="Kalender" today={IDAG} monthsBack={1} monthsForward={1} entries={POSTER} kalendrar={KALENDRAR} />);
    expect(screen.getByRole("button", { name: "Visa året" })).toBeTruthy();
    rerender(<OpsCalendar ariaLabel="Kalender" today={IDAG} monthsBack={1} monthsForward={1} entries={POSTER} kalendrar={KALENDRAR} arsvy={false} />);
    expect(screen.queryByRole("button", { name: "Visa året" })).toBeNull();
  });

  it("öppnar året i ett lager över hela skärmen, och Stäng och Escape lägger tillbaka kalendern", async () => {
    render(<OpsCalendar ariaLabel="Kalender" today={IDAG} monthsBack={1} monthsForward={1} entries={POSTER} kalendrar={KALENDRAR} arsvy />);
    expect(document.querySelector("[data-ops-arsvy]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Visa året" }));
    await screen.findByRole("dialog", { name: "Året 2027" }, { timeout: 5000 });
    const yta = /** @type {HTMLElement} */ (document.querySelector("[data-kalender-arsvy-yta]"));
    expect(yta.getAttribute("data-kalender-arsvy-yta")).toBe("fonster");
    expect(yta.className).toContain("fixed inset-0");
    expect(screen.getByRole("heading", { name: "Året 2027" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stäng helskärm" }));
    expect(document.querySelector("[data-ops-arsvy]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Visa året" }));
    await screen.findByRole("dialog", { name: "Året 2027" }, { timeout: 5000 });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(document.querySelector("[data-ops-arsvy]")).toBeNull();
  });

  it("ett tryck på en dag stänger året och väljer dagen i kalendern", async () => {
    render(<OpsCalendar ariaLabel="Kalender" today={IDAG} monthsBack={1} monthsForward={1} entries={POSTER} kalendrar={KALENDRAR} arsvy />);
    fireEvent.click(screen.getByRole("button", { name: "Visa året" }));
    await screen.findByRole("dialog", { name: "Året 2027" }, { timeout: 5000 });
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector('[data-arsvy-dag="2027-07-06"]')));
    expect(document.querySelector("[data-ops-arsvy]")).toBeNull();
    const piller = document.querySelectorAll("[data-datumpiller]");
    expect(piller).toHaveLength(1);
    expect(piller[0].textContent).toMatch(/6/);
    expect(piller[0].textContent?.toLowerCase()).toMatch(/jul/);
  });

  it("en dold kalender försvinner ur året, och visas igen med ett tryck på den i listan", async () => {
    render(<OpsCalendar ariaLabel="Kalender" today={IDAG} monthsBack={1} monthsForward={1} entries={POSTER} kalendrar={KALENDRAR} arsvy />);
    fireEvent.click(screen.getByRole("button", { name: "Visa året" }));
    await screen.findByRole("dialog", { name: "Året 2027" }, { timeout: 5000 });
    const dag = () => /** @type {HTMLElement} */ (document.querySelector('[data-arsvy-dag="2027-07-06"]'));
    expect(dag().getAttribute("aria-label")).toBe("6 juli: Barnen hos CP, Skollov");
    const lista = screen.getByRole("list", { name: "Kalendrar" });
    fireEvent.click(within(lista).getByRole("button", { name: "Visa Skollov" }));
    expect(dag().getAttribute("aria-label")).toBe("6 juli: Barnen hos CP");
    expect(within(lista).getByRole("button", { name: "Visa Skollov" }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("⛔ OpsKalenderAr (#874)", () => {
  const bas = { poster: POSTER, kalendrar: KALENDRAR, forvaldId: "barn", arSynlig: () => true, today: IDAG, onAr: vi.fn(), onValjDag: vi.fn(), onValjManad: vi.fn(), onStang: vi.fn() };

  it("ritar tolv månader, band bara för heldag och flera dagar, och idag markerad", () => {
    render(<OpsKalenderAr ar={2027} {...bas} />);
    expect(document.querySelectorAll("[data-arsvy-manad]")).toHaveLength(12);
    const motesdag = /** @type {HTMLElement} */ (document.querySelector('[data-arsvy-dag="2027-07-08"]'));
    expect(motesdag.getAttribute("aria-label")).toBe("8 juli, inget hela dagar");
    expect(document.querySelector('[data-arsvy-dag="2027-07-05"]')?.querySelectorAll("[data-arsvy-band]")).toHaveLength(1);
    expect(document.querySelector('[data-arsvy-dag="2027-07-01"]')?.className).toContain("ring-accent");
  });

  it("bläddrar år och öppnar en månad", () => {
    const onAr = vi.fn();
    const onValjManad = vi.fn();
    render(<OpsKalenderAr ar={2027} {...bas} onAr={onAr} onValjManad={onValjManad} />);
    fireEvent.click(screen.getByRole("button", { name: "Föregående år" }));
    fireEvent.click(screen.getByRole("button", { name: "Nästa år" }));
    expect(onAr.mock.calls).toEqual([[2026], [2028]]);
    fireEvent.click(screen.getByRole("button", { name: "Öppna mars 2027" }));
    expect(onValjManad).toHaveBeenCalledWith(2027, 2);
  });

  it("⛔ högst tre band ritas, resten står som +N, och knappnamnet räknar upp alla", () => {
    const fem = [1, 2, 3, 4, 5].map((n) => ({ id: `k${n}`, namn: `K${n}`, farg: n }));
    const poster = fem.map((k) => ({ id: `p${k.id}`, date: "2027-07-09", allDay: true, title: k.namn, kalender: k }));
    render(<OpsKalenderAr ar={2027} {...bas} poster={poster} kalendrar={fem} forvaldId="k1" />);
    const dag = /** @type {HTMLElement} */ (document.querySelector('[data-arsvy-dag="2027-07-09"]'));
    expect([...dag.querySelectorAll("[data-arsvy-band]")].map((b) => b.getAttribute("data-arsvy-band"))).toEqual(["k1", "k2", "k3"]);
    expect(dag.querySelector("[data-arsvy-fler]")?.textContent).toBe("+2");
    expect(dag.getAttribute("aria-label")).toBe("9 juli: K1, K2, K3, K4, K5");
  });

  it("⛔ med högst tre synliga kalendrar har varje kalender en fast rad: Skollov står på rad två också när Barnen saknas", () => {
    render(<OpsKalenderAr ar={2027} {...bas} poster={[{ id: "l", date: "2027-07-20", allDay: true, title: "Lov", kalender: KALENDRAR[1] }]} />);
    const rader = /** @type {HTMLElement} */ (document.querySelector('[data-arsvy-dag="2027-07-20"]')).querySelectorAll("span[aria-hidden]");
    expect(rader).toHaveLength(2);
    expect(rader[0].getAttribute("data-arsvy-band")).toBeNull();
    expect(rader[1].getAttribute("data-arsvy-band")).toBe("lov");
  });

  it("⛔ förklaringen och banden har samma färg också när farg saknas, är en äldre ton som sträng eller en kulör", () => {
    const kal = [{ id: "a", namn: "A", farg: "3" }, { id: "b", namn: "B" }, { id: "c", namn: "C", farg: "kulor:210" }];
    const poster = kal.map((k) => ({ id: k.id, date: "2027-07-09", allDay: true, title: k.namn, kalender: k }));
    render(<OpsKalenderAr ar={2027} {...bas} poster={poster} kalendrar={kal} forvaldId="a" />);
    /** @type {string[]} */
    const kulorer = [];
    for (const k of kal) {
      const band = /** @type {HTMLElement} */ (document.querySelector(`[data-arsvy-dag="2027-07-09"] [data-arsvy-band="${k.id}"]`));
      const knapp = /** @type {HTMLElement} */ (screen.getByRole("button", { name: `Visa ${k.namn}` }).querySelector("span"));
      // Samma klass och samma kulör (0.238.0: kalendrarna ritas med sin kulör, `--grupp-kulor`).
      expect(band.className).toContain("ops-kulor-prick");
      expect(knapp.className).toContain("ops-kulor-prick");
      expect(band.style.getPropertyValue("--grupp-kulor")).toBe(knapp.style.getPropertyValue("--grupp-kulor"));
      kulorer.push(band.style.getPropertyValue("--grupp-kulor"));
    }
    expect(kulorer[0]).toBe(String(ARV_TON_KULOR[3]));
    expect(kulorer[2]).toBe("210");
  });

  it("⛔ en månad som inte är inläst säger det, och året bläddrar inte till ett år utan inlästa månader", () => {
    const inlasta = new Set(["2027-05", "2027-06", "2027-07"]);
    render(<OpsKalenderAr ar={2027} {...bas} inlasta={inlasta} />);
    expect(document.querySelector('[data-arsvy-manad="2027-03"]')?.hasAttribute("data-arsvy-ej-inlast")).toBe(true);
    expect(document.querySelector('[data-arsvy-dag="2027-03-10"]')).toBeNull();
    expect(screen.getAllByText("Inte inläst").length).toBe(9);
    expect(screen.getByRole("button", { name: "Föregående år" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Nästa år" }).hasAttribute("disabled")).toBe(true);
  });

  it("⛔ är en dialog som tar fokus, och förklaringen heter Calendars på engelska", () => {
    render(<OpsKalenderAr ar={2027} {...bas} locale="en-GB" />);
    const dialog = screen.getByRole("dialog", { name: "The year 2027" });
    expect(document.activeElement).toBe(dialog);
    expect(screen.getByRole("list", { name: "Calendars" })).toBeTruthy();
  });
});

describe("⛔ fokus tillbaka på Visa året (granskningen av 0.237.0)", () => {
  it("när året stängs med krysset eller Escape står fokus på knappen igen", async () => {
    render(<OpsCalendar ariaLabel="Kalender" today={IDAG} monthsBack={1} monthsForward={1} entries={POSTER} kalendrar={KALENDRAR} arsvy />);
    const knapp = screen.getByRole("button", { name: "Visa året" });
    fireEvent.click(knapp);
    await screen.findByRole("dialog", { name: "Året 2027" }, { timeout: 5000 });
    expect(document.activeElement?.getAttribute("role")).toBe("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Stäng helskärm" }));
    expect(document.activeElement).toBe(knapp);
    fireEvent.click(knapp);
    await screen.findByRole("dialog", { name: "Året 2027" }, { timeout: 5000 });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(document.activeElement).toBe(knapp);
  });
});
