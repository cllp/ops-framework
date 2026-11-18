import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsHtmlDokument } from "../components/OpsHtmlDokument.jsx";

/*
 * Helskärm för ett HTML-dokument i Biblioteket (0.241.0). CP 2026-11-18 21.43, med en skärmbild av statussidan på 22 % i telefonen: "HTM har
 * fortfarande ingen full screen." PDF-vyn, kartan och årsvyn hade den, HTML-dokumentet inte. Samma `useHelskarm` som de andra.
 *
 * jsdom har ingen `requestFullscreen`, så det här är iPhones väg: ett fast lager över hela skärmen. Webbläsarens egen helskärm mäts med
 * en `requestFullscreen` på elementet. Hur lagret LIGGER (ingen rand, ingen sidledes rullning) mäts i skalytan, inte här.
 */

afterEach(() => {
  vi.restoreAllMocks();
  delete (/** @type {any} */ (document)).fullscreenEnabled;
});

const rendera = () => render(<OpsHtmlDokument html="<p>Läget</p>" namn="STATUS.html" skapadAv={{ namn: "Kim" }} />);

describe("helskärm för HTML-dokumentet", () => {
  it("⛔ raden har Helskärm, och ett tryck lägger dokumentet och raden i ett lager över hela skärmen", () => {
    rendera();
    const knapp = screen.getByRole("button", { name: "Helskärm" });
    const ruta = document.querySelector("[data-html-dokument-ruta]");
    expect(ruta?.className).toContain("h-[70vh]");
    fireEvent.click(knapp);
    const lager = document.querySelector("[data-html-dokument-helskarm]");
    expect(lager?.getAttribute("data-html-dokument-helskarm")).toBe("fonster");
    expect(lager?.className).toContain("fixed");
    expect(lager?.className).toContain("inset-0");
    // Rutan tar resten av höjden, och raden (zoom, Spara som PDF, vägen ut) följer med in.
    expect(lager?.contains(ruta ?? null)).toBe(true);
    expect(ruta?.className).toContain("flex-1");
    expect(ruta?.className).not.toContain("h-[70vh]");
    expect(lager?.querySelector("[data-html-dokument-pdf-knapp]")).not.toBeNull();
  });

  it("⛔ Stäng helskärm tar tillbaka dokumentet till sin plats, och Escape gör det också", () => {
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    fireEvent.click(screen.getByRole("button", { name: "Stäng helskärm" }));
    expect(document.querySelector("[data-html-dokument-helskarm]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector("[data-html-dokument-helskarm]")).toBeNull();
    expect(screen.getByRole("button", { name: "Helskärm" })).toBeTruthy();
  });

  it("där webbläsaren ger helskärm begärs den för dokumentets yta, i trycket", () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const begar = vi.fn(() => Promise.resolve());
    HTMLElement.prototype.requestFullscreen = begar;
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "Helskärm" }));
    expect(begar).toHaveBeenCalledTimes(1);
    const yta = /** @type {HTMLElement} */ (begar.mock.contexts[0]);
    expect(yta.querySelector("[data-html-dokument-ruta]")).not.toBeNull();
    expect(yta.getAttribute("data-html-dokument-helskarm")).toBe("helskarm");
    // @ts-ignore jsdom har ingen
    delete HTMLElement.prototype.requestFullscreen;
  });
});
