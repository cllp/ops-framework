import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { OpsKalenderAr } from "../components/OpsKalenderAr.jsx";

/*
 * cllp/lifehub.app#874 skiva 1: "Visa året". En liten knapp i kalenderns verktygsrad fäller ut året i helskärm, som kartan och PDF-vyn.
 * ⛔ RÖTT UTAN ÄNDRINGEN: ingen knapp "Visa året" finns, och OpsKalenderAr finns inte.
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
  it("knappen finns bara när appen slår på årsvyn", () => {
    const { rerender } = render(<OpsCalendar ariaLabel="Kalender" today={IDAG} entries={POSTER} kalendrar={KALENDRAR} />);
    expect(screen.queryByRole("button", { name: "Visa året" })).toBeNull();
    rerender(<OpsCalendar ariaLabel="Kalender" today={IDAG} entries={POSTER} kalendrar={KALENDRAR} arsvy />);
    expect(screen.getByRole("button", { name: "Visa året" })).toBeTruthy();
  });

  it("öppnar året i ett lager över hela skärmen, och Stäng och Escape lägger tillbaka kalendern", () => {
    render(<OpsCalendar ariaLabel="Kalender" today={IDAG} entries={POSTER} kalendrar={KALENDRAR} arsvy />);
    expect(document.querySelector("[data-ops-arsvy]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Visa året" }));
    const yta = /** @type {HTMLElement} */ (document.querySelector("[data-kalender-arsvy-yta]"));
    expect(yta.getAttribute("data-kalender-arsvy-yta")).toBe("fonster");
    expect(yta.className).toContain("fixed inset-0");
    expect(screen.getByRole("heading", { name: "Året 2027" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stäng helskärm" }));
    expect(document.querySelector("[data-ops-arsvy]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Visa året" }));
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(document.querySelector("[data-ops-arsvy]")).toBeNull();
  });

  it("ett tryck på en dag stänger året och väljer dagen i kalendern", () => {
    render(<OpsCalendar ariaLabel="Kalender" today={IDAG} entries={POSTER} kalendrar={KALENDRAR} arsvy />);
    fireEvent.click(screen.getByRole("button", { name: "Visa året" }));
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector('[data-arsvy-dag="2027-07-06"]')));
    expect(document.querySelector("[data-ops-arsvy]")).toBeNull();
    expect(document.querySelectorAll("[data-datumpiller]")).toHaveLength(1);
  });

  it("en dold kalender försvinner ur året, och visas igen med ett tryck på den i listan", () => {
    render(<OpsCalendar ariaLabel="Kalender" today={IDAG} entries={POSTER} kalendrar={KALENDRAR} arsvy />);
    fireEvent.click(screen.getByRole("button", { name: "Visa året" }));
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
    expect(document.querySelector('[data-arsvy-dag="2027-07-05"]')?.querySelectorAll("span[aria-hidden]")).toHaveLength(1);
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
});
