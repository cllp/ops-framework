import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { APPRAD_SYNLIGA, OpsCalendar } from "../components/OpsCalendar.jsx";
import { EGNA_APPEN, appForTyp, apparFor, appfilterNyckel, filtreraPoster, lasDoldaAppar } from "../lib/calendar.js";

/*
 * 0.54.0, cllp/ops-framework#244 beslut B och C (CP 2026-10-04: "Om man har många appar i en grupp. Hur skall det då
 * funka?"). App är en filternivå ovanför typ, härledd ur typens prefix, och valet är personens och minns per grupp.
 */

describe("appen härleds ur typen, aldrig ur ett eget fält", () => {
  it("ett bidrag ger modulen, en egen kategori och en post utan typ ger gruppens egna", () => {
    expect(appForTyp("ekonomi:kvitto")).toBe("ekonomi");
    expect(appForTyp("mote")).toBe(EGNA_APPEN);
    expect(appForTyp(undefined)).toBe(EGNA_APPEN);
  });

  it("⛔ apparna kommer ur både typerna och posterna, så en avslagen moduls rader har en knapp", () => {
    const appar = apparFor(
      [{ id: "mote" }, { id: "ekonomi:kvitto", modulNamn: "Ekonomi" }, { id: "ekonomi:moms", modulNamn: "Ekonomi" }],
      [{ typ: "skola:lektion" }, { typ: "mote" }],
    );
    expect(appar).toEqual([
      { id: EGNA_APPEN, namn: "Gruppens egna" },
      { id: "ekonomi", namn: "Ekonomi" },
      { id: "skola", namn: "skola" },
    ]);
  });

  it("filtret döljer en apps poster och bara dem", () => {
    const poster = [
      { id: "a", date: "2026-10-12", title: "Möte", typ: "mote" },
      { id: "b", date: "2026-10-12", title: "Kvitto", typ: "ekonomi:kvitto" },
      { id: "c", date: "2026-10-12", title: "Utan typ" },
    ];
    const bas = { valdaKalendrar: null, forvaldId: "" };
    expect(filtreraPoster(poster, { ...bas, doldaAppar: ["ekonomi"] }).map((p) => p.id)).toEqual(["a", "c"]);
    expect(filtreraPoster(poster, { ...bas, doldaAppar: [EGNA_APPEN] }).map((p) => p.id)).toEqual(["b"]);
    expect(filtreraPoster(poster, bas).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("⛔ ett trasigt sparat värde ger allt synligt, aldrig ett fel", () => {
    expect(lasDoldaAppar(null)).toEqual([]);
    expect(lasDoldaAppar("{inte json")).toEqual([]);
    expect(lasDoldaAppar('{"a":1}')).toEqual([]);
    expect(lasDoldaAppar('["ekonomi", 3, ""]')).toEqual(["ekonomi"]);
  });
});

const IDAG = new Date(2026, 9, 5, 12);
const TYPER = [
  { id: "mote", namn: "Möte" },
  { id: "ekonomi:kvitto", namn: "Kvitto", modulNamn: "Ekonomi" },
  { id: "skola:lektion", namn: "Lektion", modulNamn: "Skola" },
];
const POSTER = [
  { id: "mote", date: "2026-10-12", title: "Styrelsemöte", typ: "mote" },
  { id: "kvitto", date: "2026-10-12", title: "Kvitto Clas Ohlson", typ: "ekonomi:kvitto" },
  { id: "lektion", date: "2026-10-12", title: "Matte", typ: "skola:lektion" },
];

/** Ett minne per prov, som localStorage. */
function minne() {
  /** @type {Map<string, string>} */
  const m = new Map();
  return { getItem: (/** @type {string} */ n) => m.get(n) ?? null, setItem: (/** @type {string} */ n, /** @type {string} */ v) => void m.set(n, v), m };
}

/** @param {Record<string, any>} [extra] */
function kal(extra = {}) {
  return render(<OpsCalendar ariaLabel="Kalender" entries={POSTER} today={IDAG} monthsBack={0} monthsForward={0} typer={TYPER} lagring={minne()} {...extra} />);
}

describe("appraden i OpsCalendar", () => {
  it("visar en knapp per app, allt synligt från början", () => {
    kal();
    const rad = screen.getByRole("group", { name: "Appar i kalendern" });
    expect([...rad.querySelectorAll("[data-app]")].map((b) => [b.textContent, b.getAttribute("aria-pressed")])).toEqual([
      ["Gruppens egna", "true"],
      ["Ekonomi", "true"],
      ["Skola", "true"],
    ]);
    expect(screen.getByRole("button", { name: "12, 3 poster" })).toBeInTheDocument();
  });

  it("⛔ ett tryck döljer appens poster, ett till visar dem, och Visa alla finns bara när något är dolt", () => {
    kal();
    expect(screen.queryByRole("button", { name: "Visa alla" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ekonomi" }));
    expect(screen.getByRole("button", { name: "Ekonomi" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "12, 2 poster" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Visa alla" }));
    expect(screen.getByRole("button", { name: "12, 3 poster" })).toBeInTheDocument();
  });

  it("⛔ valet minns per grupp: samma minne, annan grupp, ingenting dolt", () => {
    const lager = minne();
    const { unmount } = kal({ lagring: lager, filterMinne: "familjen" });
    fireEvent.click(screen.getByRole("button", { name: "Skola" }));
    expect(lager.m.get(appfilterNyckel("familjen"))).toBe('["skola"]');
    unmount();
    const andra = kal({ lagring: lager, filterMinne: "familjen" });
    expect(screen.getByRole("button", { name: "Skola" })).toHaveAttribute("aria-pressed", "false");
    andra.unmount();
    kal({ lagring: lager, filterMinne: "foretaget" });
    expect(screen.getByRole("button", { name: "Skola" })).toHaveAttribute("aria-pressed", "true");
  });

  it("⛔ typlistan visar bara synliga appars typer, och en vald typ vars app döljs släpps", async () => {
    kal();
    fireEvent.click(screen.getByRole("button", { name: "Typ och status" }));
    fireEvent.click(await screen.findByRole("button", { name: "Kvitto" }));
    expect(screen.getByRole("button", { name: "12, 1 post" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ekonomi" }));
    // Typen släpptes till "alla": kvar syns mötet och lektionen, inte noll poster.
    expect(screen.getByRole("button", { name: "12, 2 poster" })).toBeInTheDocument();
    // Menyn står kvar öppen i jsdom (inget klick utanför registreras), så listan läses direkt.
    const meny = screen.getByRole("dialog", { name: "Typ och status" });
    expect(within(meny).queryByRole("button", { name: "Kvitto" })).toBeNull();
    expect(within(meny).getByRole("button", { name: "Lektion" })).toBeInTheDocument();
  });

  it("⛔ ingen rad med bara en app: det finns inget att välja mellan", () => {
    kal({ typer: [{ id: "mote", namn: "Möte" }], entries: [POSTER[0]] });
    expect(screen.queryByRole("group", { name: "Appar i kalendern" })).toBeNull();
  });

  it("efter fyra fälls resten ihop under Fler, som säger hur många dolda den bär", async () => {
    const fler = ["a", "b", "c", "d", "e"].map((m) => ({ id: `${m}:x`, namn: "X", modulNamn: m.toUpperCase() }));
    kal({ typer: [...TYPER.slice(0, 1), ...fler], entries: [POSTER[0]] });
    const rad = screen.getByRole("group", { name: "Appar i kalendern" });
    expect(rad.querySelectorAll("[data-app]")).toHaveLength(APPRAD_SYNLIGA);
    fireEvent.click(screen.getByRole("button", { name: "Fler appar" }));
    fireEvent.click(await screen.findByRole("button", { name: "E" }));
    expect(screen.getByRole("button", { name: "Fler appar, 1 dolda" })).toBeInTheDocument();
  });
});

describe("hur många appar som ryms", () => {
  it("⛔ tar så många som får plats med Fler inräknat, högst fyra och minst en", async () => {
    const { appradRyms } = await import("../components/OpsCalendar.jsx");
    // Sex appar på 358 px (390 minus marginalerna): två plus Fler är 327 px, tre plus Fler 408.
    expect(appradRyms({ bredd: 358, appar: [130, 90, 75, 105, 80, 70], fler: 95, visaAlla: 0 })).toBe(2);
    expect(appradRyms({ bredd: 900, appar: [130, 90, 75, 105, 80, 70], fler: 95, visaAlla: 0 })).toBe(4);
    // Utan rest behövs ingen Fler.
    expect(appradRyms({ bredd: 300, appar: [130, 90], fler: 95, visaAlla: 0 })).toBe(2);
    // Visa alla tar plats när något är dolt.
    expect(appradRyms({ bredd: 330, appar: [130, 90], fler: 95, visaAlla: 80 })).toBe(2);
    expect(appradRyms({ bredd: 300, appar: [130, 90], fler: 95, visaAlla: 80 })).toBe(1);
    expect(appradRyms({ bredd: 50, appar: [130, 90], fler: 95, visaAlla: 0 })).toBe(1);
  });
});
