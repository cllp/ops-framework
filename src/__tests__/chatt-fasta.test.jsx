import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla, harFasta } from "../data/samtalskalla.js";
import { FASTFALT, byggFastning } from "../lib/samtal.js";
import { samtalsregelfragment } from "../lib/regler.js";
import { levandeKalla } from "./levandeKalla.js";

/**
 * Etapp 6 av chattens nattskiva: fästa meddelanden (chattanalysen 3.6).
 *
 * ⛔ HÄR MÄTS BETEENDE: nyckeln är meddelandets id, raden visar antalet och fälls ut med det fästa meddelandet härlett, ett meddelande
 * som inte är laddat läses, Lossa tar bort fästningen, och fel sägs ut. Reglerna mäts i `rules/__tests__/chattnatt.test.mjs`.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];

/** @param {{ fasta?: boolean, kalla?: any, sida?: number }} [val] */
async function underlag(val = { fasta: true }) {
  const kalla = val.kalla ?? levandeKalla();
  let t = Date.now() - 100000;
  const s = /** @type {any} */ (createSamtalskalla({ kalla, klocka: () => (t += 1000), ...(val.fasta ? { fasta: "fasta" } : {}), ...(val.sida ? { sida: val.sida } : {}) }));
  const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
  const regel = await s.skicka(g.id, { text: "Så här gör vi: fakturor attesteras på måndagar.", av: "bo" });
  await s.skicka(g.id, { text: "Tack!", av: "anna" });
  return { kalla, s, g, regel };
}

describe("modellen och källan", () => {
  it("⛔ nyckeln är meddelandets id, och en andra fästning är samma dokument", async () => {
    expect(byggFastning({ mid: "m1", av: "anna", tid: 5 })).toEqual({ id: "m1", av: "anna", tid: 5 });
    expect(Object.keys(byggFastning({ mid: "m1", av: "anna", tid: 5 })).filter((k) => k !== "id").sort()).toEqual([...FASTFALT].sort());
    expect(() => byggFastning({ mid: "a/b", av: "anna" })).toThrow();
    const { kalla, s, g, regel } = await underlag();
    await s.fast(g.id, { mid: regel.id, av: "anna" });
    await s.fast(g.id, { mid: regel.id, av: "bo" });
    expect(await kalla.list(`samtal/${g.id}/fasta`)).toHaveLength(1);
    await s.lossa(g.id, regel.id);
    expect(await kalla.list(`samtal/${g.id}/fasta`)).toHaveLength(0);
  });
  it("⛔ utan fasta: inga funktioner och ingen regeltext", () => {
    expect(harFasta(createSamtalskalla({ kalla: createMemorySource({}) }))).toBe(false);
    expect(samtalsregelfragment({ tradar: "tradar" })).not.toContain("fasta");
    expect(samtalsregelfragment({ fasta: "fasta" })).toContain("match /fasta/{mid}");
    expect(() => samtalsregelfragment({ fasta: "meddelanden" })).toThrow(/krockar/);
  });
});

describe("vyn", () => {
  it("⛔ Fäst, raden med antalet, utfälld med det fästa meddelandet, och Lossa", async () => {
    const { s, g, regel } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    await within(await screen.findByRole("log")).findByText("Tack!");
    expect(document.querySelector("[data-fastarad]")).toBeNull();
    const knapp = /** @type {HTMLElement} */ (document.querySelector(`[data-fast="${regel.id}"]`));
    expect(knapp.getAttribute("aria-label")).toBe("Fäst");
    fireEvent.click(knapp);
    const rad = await screen.findByRole("button", { name: /1 fästa/ });
    await waitFor(() => expect(knapp.getAttribute("aria-pressed")).toBe("true"));
    expect(knapp.getAttribute("aria-label")).toBe("Lossa");
    fireEvent.click(rad);
    expect(rad.getAttribute("aria-expanded")).toBe("true");
    const post = /** @type {HTMLElement} */ (document.querySelector(`[data-fastad="${regel.id}"]`));
    expect(post.textContent).toContain("Bo Lind: Så här gör vi");
    fireEvent.click(within(post).getByRole("button", { name: /^Lossa/ }));
    await waitFor(() => expect(document.querySelector("[data-fastarad]")).toBeNull());
  });
  it("⛔ ett fäst meddelande som inte är laddat läses, och ett som inte finns sägs ut", async () => {
    const { kalla, s, g, regel } = await underlag({ fasta: true, kalla: createMemorySource({}) });
    for (let i = 0; i < 4; i += 1) await s.skicka(g.id, { text: `Senare ${i}`, av: "bo" });
    await s.fast(g.id, { mid: regel.id, av: "bo" });
    await kalla.create(`samtal/${g.id}/fasta`, { id: "borta", av: "bo", tid: Date.now() });
    const smal = /** @type {any} */ (createSamtalskalla({ kalla, fasta: "fasta", sida: 2 }));
    render(<OpsMeddelanden kalla={smal} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    fireEvent.click(await screen.findByRole("button", { name: /2 fästa/ }));
    await waitFor(() => expect(document.querySelector(`[data-fastad="${regel.id}"]`)?.textContent).toContain("Så här gör vi"));
    await waitFor(() => expect(document.querySelector('[data-fastad="borta"]')?.textContent).toContain("Meddelandet går inte att läsa."));
  });
  it("⛔ en nekad fästning och en läsning som föll sägs ut", async () => {
    const { s, g, regel } = await underlag();
    const nekad = { ...s, fast: async () => Promise.reject(new Error("permission-denied")) };
    const { unmount } = render(<OpsMeddelanden kalla={nekad} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    await within(await screen.findByRole("log")).findByText("Tack!");
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector(`[data-fast="${regel.id}"]`)));
    expect((await screen.findByText("Fästningen kunde inte sparas.")).getAttribute("role")).toBe("alert");
    unmount();
    const trasig = { ...s, prenumereraFasta: (/** @type {any} */ _s, /** @type {any} */ l) => (l.onError(new Error("nät")), () => {}) };
    render(<OpsMeddelanden kalla={trasig} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    expect((await screen.findByText("Fästa meddelanden kunde inte hämtas.")).getAttribute("role")).toBe("alert");
  });
  it("⛔ utan fasta i källan: ingen knapp och ingen rad", async () => {
    const { s, g } = await underlag({ fasta: false });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    await within(await screen.findByRole("log")).findByText("Tack!");
    expect(document.querySelectorAll("[data-bubbla]").length).toBe(2); // golv
    expect(document.querySelector("[data-fast]")).toBeNull();
  });
});
