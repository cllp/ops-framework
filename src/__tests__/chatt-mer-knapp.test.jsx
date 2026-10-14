import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { levandeKalla } from "./levandeKalla.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/**
 * En Mer-knapp per meddelande på telefon (0.106.0, #386 skiva 6). Under 768 px stod Reagera, Fäst, Svara med citat och "Svara i tråd"
 * som lösa åtgärder under varje bubbla. Nu står en ⋮ per meddelande, med reaktionerna överst, alla åtgärder och Kopiera.
 *
 * ⛔ jsdom kör ingen CSS. Proven mäter vad som renderas och vilka brytpunktsklasser de lösa knapparna bär (`hidden` under md); att
 * ingen lös ikon syns vid 390 px och att menyn får plats mäts i en riktig webbläsare, check-skalyta 47 (6).
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];

async function underlag() {
  const kalla = levandeKalla();
  const s = /** @type {any} */ (createSamtalskalla({ kalla, tradar: "tradar", reaktioner: "reaktioner", citat: true, fasta: "fasta" }));
  const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
  const m1 = await s.skicka(g.id, { text: "Hej gruppen", av: "bo" });
  const m2 = await s.skicka(g.id, { text: "Fäst den här", av: "bo" });
  await s.fast(g.id, { mid: m2.id, av: "anna" });
  const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  await s.skicka(p.id, { text: "Lunch i morgon?", av: "bo" });
  return { s, g, p, m1, m2 };
}

/** Den lösa knappen är dold under md och syns från md: telefonens rad bär den inte. */
const baraDator = (/** @type {Element} */ el) => {
  const k = el.className.split(/\s+/);
  return k.includes("hidden") && k.includes("md:inline-flex") && !k.includes("inline-flex");
};

const ursprung = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => {
  if (ursprung) Object.defineProperty(navigator, "clipboard", ursprung);
  else delete (/** @type {any} */ (navigator)).clipboard;
});

describe("en Mer-knapp per meddelande på telefon", () => {
  it("⛔ varje meddelande har en ⋮ som bara syns på telefon, och de lösa åtgärderna syns bara på dator", async () => {
    const { s, g } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    const logg = await screen.findByRole("log");
    await within(logg).findByText("Fäst den här");
    await waitFor(() => expect(document.querySelectorAll("[data-tradmarke='ny']").length).toBe(2));
    const rader = document.querySelectorAll("[data-meddelande]");
    expect(rader.length).toBe(2);
    for (const rad of rader) {
      const mer = rad.querySelectorAll("[data-mer]");
      expect(mer.length).toBe(1);
      expect(mer[0].className.split(/\s+/)).toContain("md:hidden");
      expect(within(/** @type {HTMLElement} */ (mer[0])).getByRole("button").getAttribute("aria-label")).toBe("Åtgärder för Meddelande från Bo Lind");
    }
    // Golv: fyra sorters lösa åtgärder, och varje är dold under md.
    const losa = [...document.querySelectorAll("[data-reagera], [data-tradmarke='ny'], [data-fast][aria-pressed='false']")];
    expect(losa.length).toBe(5);
    expect(losa.filter((el) => !baraDator(el)).map((el) => el.outerHTML.slice(0, 80))).toEqual([]);
    // Nålen på det fästa meddelandet är innehåll och står kvar.
    const nal = /** @type {HTMLElement} */ (document.querySelector("[data-fast][aria-pressed='true']"));
    expect(nal.className.split(/\s+/)).toContain("inline-flex");
    expect(nal.className.split(/\s+/)).not.toContain("hidden");
  });

  it("⛔ menyn har reaktionerna överst, Svara i tråd, Fäst och Kopiera, och en reaktion i menyn sparas", async () => {
    const { s, g } = await underlag();
    const onValjTrad = vi.fn();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} onValjTrad={onValjTrad} />);
    await within(await screen.findByRole("log")).findByText("Hej gruppen");
    const forsta = /** @type {HTMLElement} */ (document.querySelector("[data-meddelande]"));
    fireEvent.click(within(forsta).getByRole("button", { name: "Åtgärder för Meddelande från Bo Lind" }));
    const meny = await screen.findByRole("menu");
    expect(within(meny).getAllByRole("menuitem").map((b) => b.textContent)).toEqual(["Svara i tråd", "Fäst", "Kopiera"]);
    const reaktioner = /** @type {HTMLElement} */ (document.querySelector("[data-mer-reaktioner]"));
    expect(within(reaktioner).getAllByRole("button").length).toBe(6);
    fireEvent.click(within(reaktioner).getByRole("button", { name: "Tummen upp" }));
    await waitFor(() => expect(forsta.querySelector("[data-reaktion='tumme']")).toBeTruthy());
    expect(screen.queryByRole("menu")).toBeNull();
    // Svara i tråd öppnar tråden.
    fireEvent.click(within(forsta).getByRole("button", { name: "Åtgärder för Meddelande från Bo Lind" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Svara i tråd" }));
    await waitFor(() => expect(onValjTrad).toHaveBeenCalledWith(forsta.querySelector("[data-tradrot]")?.getAttribute("data-tradrot")));
  });

  it("⛔ i ett privat samtal står Svara med citat i menyn, och Kopiera lägger texten i urklippet och säger det", async () => {
    const { s, p } = await underlag();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} />);
    await within(await screen.findByRole("log")).findByText("Lunch i morgon?");
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Meddelande från Bo Lind" }));
    expect((await screen.findAllByRole("menuitem")).map((b) => b.textContent)).toEqual(["Svara med citat", "Fäst", "Kopiera"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Kopiera" }));
    expect(writeText).toHaveBeenCalledWith("Lunch i morgon?");
    expect((await screen.findByRole("status", { name: "" })).textContent).toBe("Kopierat");
    // Svara med citat i menyn lägger citatet ovanför skrivfältet.
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Meddelande från Bo Lind" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Svara med citat" }));
    expect(document.querySelector("[data-svarar-pa]")).toBeTruthy();
  });

  it("⛔ ett urklipp som inte släpper in sägs, och tystnar inte", async () => {
    const { s, p } = await underlag();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("nekad")) } });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} />);
    await within(await screen.findByRole("log")).findByText("Lunch i morgon?");
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Meddelande från Bo Lind" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Kopiera" }));
    await waitFor(() => expect(document.querySelector("[data-kopierat='fel']")?.textContent).toBe("Texten kunde inte kopieras."));
  });
});
