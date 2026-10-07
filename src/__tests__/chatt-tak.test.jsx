import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { FASTA_TAK, REAKTIONSTAK } from "../lib/samtal.js";
import { levandeKalla } from "./levandeKalla.js";

/*
 * Granskningen av PR 286, KAN. ⛔ KÄLLAN SÄGER `fler` VID TAKET. Vyns prov stubbar källan, så där mäts bara att vyn läser fältet;
 * här mäts att källan sätter det, mot en källa med prenumeration: ett under taket är inte fler, taket självt är fler.
 */

async function samtal(/** @type {Record<string, unknown>} */ nycklar) {
  // En källa med prenumeration, så att båda vägarna mäts.
  const kalla = levandeKalla();
  const s = /** @type {any} */ (createSamtalskalla({ kalla, ...nycklar }));
  const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
  const m = await s.skicka(g.id, { text: "Hej", av: "anna" });
  return { kalla, s, g, m };
}

describe("taken i källan", () => {
  it("⛔ reaktionerna: fler först vid REAKTIONSTAK, i läsningen och i prenumerationen", async () => {
    const { kalla, s, g, m } = await samtal({ reaktioner: "reaktioner" });
    for (let i = 0; i < REAKTIONSTAK - 1; i += 1) await kalla.create(`samtal/${g.id}/reaktioner`, { id: `${m.id}|u${i}|tumme`, mid: m.id, av: `u${i}`, kod: "tumme", tid: i });
    expect(await s.lasReaktioner(g.id)).toMatchObject({ fler: false });
    await kalla.create(`samtal/${g.id}/reaktioner`, { id: `${m.id}|sist|tumme`, mid: m.id, av: "sist", kod: "tumme", tid: 9999 });
    const svar = await s.lasReaktioner(g.id);
    expect(svar.rader).toHaveLength(REAKTIONSTAK);
    expect(svar.fler).toBe(true);
    /** @type {any[]} */
    const fick = [];
    expect(typeof kalla.subscribe).toBe("function");
    const sluta = s.prenumereraReaktioner(g.id, { onData: (/** @type {any} */ d) => fick.push(d), onError: () => {} });
    await new Promise((r) => setTimeout(r, 0));
    expect(fick.at(-1)?.fler).toBe(true);
    sluta?.();
  });

  it("⛔ de fästa: fler först vid FASTA_TAK, i läsningen och i prenumerationen", async () => {
    const { kalla, s, g } = await samtal({ fasta: "fasta" });
    for (let i = 0; i < FASTA_TAK - 1; i += 1) await kalla.create(`samtal/${g.id}/fasta`, { id: `m${i}`, av: "anna", tid: i });
    expect(await s.lasFasta(g.id)).toMatchObject({ fler: false });
    await kalla.create(`samtal/${g.id}/fasta`, { id: "sist", av: "anna", tid: 9999 });
    expect(await s.lasFasta(g.id)).toMatchObject({ fler: true });
    /** @type {any[]} */
    const fick = [];
    expect(typeof kalla.subscribe).toBe("function");
    const sluta = s.prenumereraFasta(g.id, { onData: (/** @type {any} */ d) => fick.push(d), onError: () => {} });
    await new Promise((r) => setTimeout(r, 0));
    expect(fick.at(-1)?.fler).toBe(true);
    sluta?.();
  });
});

describe("länken i bubblan", () => {
  it("⛔ öppnas i en ny flik med noopener noreferrer, och bara http och https blir länkar", async () => {
    const { s, g } = await samtal({});
    await s.skicka(g.id, { text: "se [Bokio](https://bokio.se) och [fel](javascript:alert(1))", av: "anna" });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={[{ userId: "anna", namn: "Anna", typ: "person", status: "aktiv" }]} valt={g.id} />);
    const logg = await screen.findByRole("log");
    const lank = await within(logg).findByRole("link", { name: "Bokio" });
    expect(lank.getAttribute("href")).toBe("https://bokio.se");
    expect(lank.getAttribute("target")).toBe("_blank");
    expect(lank.getAttribute("rel")).toBe("noopener noreferrer");
    expect(within(logg).queryByRole("link", { name: "fel" })).toBeNull();
  });
});
