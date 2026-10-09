import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { defineModule } from "../lib/modul.js";
import { arkRader, flyttaFore, flyttaId, medInstallningslage, ordningMedSynliga, utanInstallningslage } from "../lib/apparark.js";
import { huvudmenyPoster } from "../lib/hubb.js";

/**
 * App-arket (0.89.0).
 *
 * ⛔ jsdom mäter inte pixlar. Proven mäter att Appar inte navigerar, att den
 * tidigare fliken kommer tillbaka, att ordningen skrivs på hela listan och att
 * ett långt tryck öppnar inställningsläget. Layouten mäts separat.
 */

const I = () => <svg />;

function modul(id, namn, rutt) {
  return defineModule({
    id,
    namn: { sv: namn, en: namn },
    nav: [],
    routes: [],
    samlingar: [],
    kallor: {},
    skapar: [],
    hubb: rutt
      ? { ikon: <I />, rutt, startsida: "start", delar: [{ id: "start", namn: { sv: "Start", en: "Start" }, ikon: <I />, rutt: `${rutt}/start` }] }
      : null,
  });
}

const EKONOMI = modul("ekonomi", "Ekonomi", "/ekonomi");
const RESOR = modul("resor", "Resor", "/resor");
const INKORG = modul("inkorg", "Inkorg", null);

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };

describe("adressen till inställningsläget", () => {
  it("sätter och tar bort läget utan att röra övriga parametrar eller ankaret", () => {
    expect(medInstallningslage("/ekonomi?ar=2026#kort")).toBe("/ekonomi?ar=2026&lage=installningar#kort");
    expect(utanInstallningslage("/ekonomi?ar=2026&lage=installningar#kort")).toBe("/ekonomi?ar=2026#kort");
    expect(utanInstallningslage("/ekonomi?lage=installningar")).toBe("/ekonomi");
  });

  it("ordningen skriver bara om de synliga, och en pil förbi kanten kopierar listan", () => {
    expect(ordningMedSynliga(["inkorg", "ekonomi", "resor"], ["ekonomi", "resor"], ["resor", "ekonomi"])).toEqual(["inkorg", "resor", "ekonomi"]);
    expect(flyttaId(["ekonomi"], "ekonomi", 1)).toEqual(["ekonomi"]);
    expect(() => ordningMedSynliga(["ekonomi"], ["ekonomi"], ["resor"])).toThrow(/samma moduler/);
  });

  it("ett drag hamnar på målets plats, och listan är densamma som huvudmenyn läser", () => {
    expect(flyttaFore(["ekonomi", "resor"], "ekonomi", "resor")).toEqual(["resor", "ekonomi"]);
    expect(flyttaFore(["ekonomi"], "ekonomi", "ekonomi")).toEqual(["ekonomi"]);
    const sparad = ordningMedSynliga(["inkorg", "ekonomi", "resor"], ["ekonomi", "resor"], flyttaFore(["ekonomi", "resor"], "ekonomi", "resor"));
    expect(sparad).toEqual(["inkorg", "resor", "ekonomi"]);
    expect(flyttaId(sparad, "resor", -1)).toEqual(["resor", "inkorg", "ekonomi"]);
    expect(huvudmenyPoster({ grupp: { moduler: sparad, huvudmeny: ["ekonomi", "resor"] }, moduler: [EKONOMI, RESOR] }).map((p) => p.id)).toEqual(["resor", "ekonomi"]);
  });

  it("arket tar med en fäst modul och hoppar över en utan kort", () => {
    const rader = arkRader({ moduler: ["inkorg", "resor", "ekonomi"], huvudmeny: ["ekonomi"] }, [EKONOMI, RESOR, INKORG]);
    expect(rader.map((r) => r.id)).toEqual(["resor", "ekonomi"]);
    expect(rader[1].fast).toBe(true);
  });
});

describe("OpsAppShell apparArk", () => {
  function skal(extra) {
    const onNavigate = vi.fn((_h, e) => e?.preventDefault?.());
    const onOrdning = vi.fn();
    const utils = render(
      <OpsAppShell
        fasta={fasta}
        moduler={[]}
        activeHref="/"
        onNavigate={onNavigate}
        apparArk={{
          moduler: [EKONOMI, RESOR, INKORG],
          grupp: { moduler: ["inkorg", "ekonomi", "resor"], huvudmeny: ["ekonomi"] },
          farAndra: true,
          onOrdning,
          ...extra?.ark,
        }}
      >
        <p>sidan</p>
      </OpsAppShell>,
    );
    return { ...utils, onNavigate, onOrdning };
  }

  it("Appar öppnar arket och navigerar inte, och stängning ger tillbaka den flik man stod på", () => {
    const { onNavigate } = skal();
    const rad = screen.getByRole("navigation", { name: "Snabbnavigering" });
    const idag = within(rad).getByRole("link", { name: "Idag" });
    expect(idag.getAttribute("aria-current")).toBe("page");
    const appar = within(rad).getByRole("button", { name: "Appar" });
    fireEvent.click(appar);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(appar.getAttribute("aria-expanded")).toBe("true");
    expect(appar.getAttribute("aria-current")).toBe("page");
    expect(idag.getAttribute("aria-current")).toBeNull();
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: "Ekonomi" })).toBeTruthy();
    expect(within(screen.getByRole("dialog")).queryByRole("link", { name: "Inkorg" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(rad).getByRole("link", { name: "Idag" }).getAttribute("aria-current")).toBe("page");
    expect(within(rad).getByRole("button", { name: "Appar" }).getAttribute("aria-current")).toBeNull();
  });

  it("Alla appar öppnar hubbsidan", () => {
    const { onNavigate, onOrdning } = skal();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Appar" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("link", { name: "Alla appar" }));
    expect(onNavigate).toHaveBeenCalledWith("/hub", expect.anything());
  });

  function oppnaOrdning() {
    fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Appar" }));
    fireEvent.click(screen.getByRole("button", { name: "Byt ordning" }));
    return screen.getByRole("dialog");
  }

  function idOrdning(dialog) {
    return [...dialog.querySelectorAll("[data-ark-id]")].map((el) => el.getAttribute("data-ark-id"));
  }

  it("Byt ordning visar grepp och vickning, och ikonerna står stilla tills någon flyttar dem", () => {
    skal();
    const dialog = oppnaOrdning();
    expect(dialog.querySelectorAll("[data-ark-grepp]").length).toBe(2);
    expect(dialog.querySelector("[data-ark-id='ekonomi'] .animate-vicka")).toBeTruthy();
    expect(idOrdning(dialog)).toEqual(["ekonomi", "resor"]);
  });

  it("en pil byter plats direkt, och Klar sparar hela modulistan och lämnar läget", () => {
    const { onOrdning } = skal();
    const dialog = oppnaOrdning();
    fireEvent.keyDown(within(dialog).getByRole("option", { name: "Ekonomi" }), { key: "ArrowRight" });
    expect(onOrdning).not.toHaveBeenCalled();
    expect(idOrdning(dialog)).toEqual(["resor", "ekonomi"]);
    fireEvent.click(screen.getByRole("button", { name: "Klar" }));
    expect(onOrdning).toHaveBeenCalledTimes(1);
    expect(onOrdning).toHaveBeenCalledWith(["inkorg", "resor", "ekonomi"]);
    expect(screen.getByRole("button", { name: "Byt ordning" })).toBeTruthy();
    expect(within(screen.getByRole("dialog")).queryByRole("option", { name: "Ekonomi" })).toBeNull();
    expect(idOrdning(screen.getByRole("dialog"))).toEqual(["resor", "ekonomi"]);
  });

  it("pilknapparna flyttar, och knappen vid kanten är avstängd", () => {
    const { onOrdning } = skal();
    const dialog = oppnaOrdning();
    expect(within(dialog).getByRole("button", { name: "Flytta vänster, Ekonomi" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Flytta höger, Resor" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Flytta höger, Ekonomi" }));
    expect(onOrdning).not.toHaveBeenCalled();
    expect(idOrdning(dialog)).toEqual(["resor", "ekonomi"]);
  });

  it("ett pekardrag byter plats, och stängning utan Klar sparar inte", () => {
    const { onOrdning } = skal();
    const dialog = oppnaOrdning();
    const ekonomi = within(dialog).getByRole("option", { name: "Ekonomi" });
    const resor = within(dialog).getByRole("option", { name: "Resor" });
    fireEvent.pointerDown(ekonomi, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(resor, { pointerId: 1, clientX: 80, clientY: 10 });
    fireEvent.pointerUp(resor, { pointerId: 1, clientX: 80, clientY: 10 });
    expect(idOrdning(dialog)).toEqual(["resor", "ekonomi"]);
    expect(onOrdning).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onOrdning).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Appar" }));
    expect(idOrdning(screen.getByRole("dialog"))).toEqual(["ekonomi", "resor"]);
  });

  it("ett långt tryck öppnar inställningsläget", () => {
    vi.useFakeTimers();
    try {
      const { onNavigate } = skal();
      fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Appar" }));
      const ekonomi = within(screen.getByRole("dialog")).getByRole("link", { name: "Ekonomi" });
      fireEvent.pointerDown(ekonomi);
      act(() => { vi.advanceTimersByTime(500); });
      expect(onNavigate).toHaveBeenCalledWith("/ekonomi?lage=installningar", null);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skift-enter öppnar inställningsläget", () => {
    const { onNavigate } = skal();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Appar" }));
    fireEvent.keyDown(within(screen.getByRole("dialog")).getByRole("link", { name: "Ekonomi" }), { key: "Enter", shiftKey: true });
    expect(onNavigate).toHaveBeenCalledWith("/ekonomi?lage=installningar", expect.anything());
  });

  it("utan farAndra finns ingen Byt ordning, och utan farAndra alls kastas det", () => {
    const { unmount } = render(
      <OpsAppShell
        fasta={fasta}
        moduler={[]}
        activeHref="/"
        apparArk={{ moduler: [EKONOMI], grupp: { moduler: ["ekonomi"] }, farAndra: false }}
      >
        <p>sidan</p>
      </OpsAppShell>,
    );
    fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Appar" }));
    expect(screen.queryByRole("button", { name: "Byt ordning" })).toBeNull();
    unmount();
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(
        <OpsAppShell fasta={fasta} moduler={[]} activeHref="/" apparArk={{ moduler: [], grupp: { moduler: [] } }}>
          <p />
        </OpsAppShell>,
      )).toThrow(/farAndra krävs/);
    } finally {
      tyst.mockRestore();
    }
  });
});
