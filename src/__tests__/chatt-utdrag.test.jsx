import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { markdownSomText } from "../lib/markdown.js";
import { utdrag } from "../lib/samtal.js";

/*
 * Granskningen av PR 286, MÅSTE 5. #273 gällde att agentens `**` syntes rått, och bubblan ritar nu markdown. Men fästraden,
 * citaten, citatraden ovanför fältet och listans rad tog texten rakt av, så stjärnorna stod kvar just där. ⛔ HÄR MÄTS ATT VARJE
 * UTDRAG ÄR TEXT UTAN MARKDOWNENS TECKEN, och att samma ord står kvar.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];

const AGENTSVAR = "**Klart:** fakturan är *attesterad*.\n- se [Bokio](https://bokio.se)\n- och `momsen`";
const UTAN = "Klart: fakturan är attesterad. se Bokio och momsen";

describe("utdraget", () => {
  it("⛔ fet, kursiv, länk, kod, listor och radbrytningar blir text, och orden står kvar", () => {
    expect(markdownSomText(AGENTSVAR)).toBe(UTAN);
    expect(utdrag(AGENTSVAR)).toBe(UTAN);
    expect(utdrag("a  b\n c")).toBe("a b c");
    // Det som inte är markdown i chatten står kvar som det skrevs.
    expect(utdrag("# 3 punkter, 2*3 = 6 och snake_case_namn")).toBe("# 3 punkter, 2*3 = 6 och snake_case_namn");
    expect(utdrag("x".repeat(100), 10)).toHaveLength(10);
    expect(utdrag("")).toBe("");
  });
});

describe("vyn", () => {
  it("⛔ fästraden, Lossa-knappens namn och listans rad visar inga stjärnor", async () => {
    const kalla = createMemorySource({});
    const s = /** @type {any} */ (createSamtalskalla({ kalla, fasta: "fasta" }));
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    const m = await s.skicka(g.id, { text: AGENTSVAR, av: "bo" });
    await s.fast(g.id, { mid: m.id, av: "bo" });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} />);
    const rad = await screen.findByRole("button", { name: /G/ });
    await waitFor(() => expect(rad.textContent).toContain("Klart: fakturan"));
    expect(rad.textContent).not.toMatch(/[*`[]/);
    fireEvent.click(rad);
    fireEvent.click(await screen.findByRole("button", { name: /1 fästa/ }));
    const post = /** @type {HTMLElement} */ (await waitFor(() => document.querySelector(`[data-fastad="${m.id}"]`)));
    await waitFor(() => expect(post.textContent).toContain("Klart: fakturan är attesterad."));
    expect(post.textContent).not.toMatch(/[*`[]/);
    const lossa = within(post).getByRole("button", { name: /^Lossa/ });
    expect(lossa.getAttribute("aria-label")).not.toMatch(/[*`[]/);
    expect(lossa.getAttribute("aria-label")).toContain("Klart: fakturan");
  });

  it("⛔ citatet i loggen och raden ovanför fältet visar inga stjärnor", async () => {
    const kalla = createMemorySource({});
    let t = Date.now() - 100000;
    const s = /** @type {any} */ (createSamtalskalla({ kalla, klocka: () => (t += 1000), citat: true }));
    const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
    const fraga = await s.skicka(p.id, { text: AGENTSVAR, av: "bo" });
    await s.skicka(p.id, { text: "Tack", av: "anna", svarPa: fraga.id });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} />);
    const logg = await screen.findByRole("log");
    await within(logg).findByText("Tack");
    const citat = /** @type {HTMLElement} */ (await waitFor(() => document.querySelector(`[data-citat="${fraga.id}"]`)));
    await waitFor(() => expect(citat.textContent).toContain("Klart: fakturan"));
    expect(citat.textContent).not.toMatch(/[*`[]/);
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector(`[data-citera="${fraga.id}"]`)));
    const svarar = /** @type {HTMLElement} */ (document.querySelector("[data-svarar-pa]"));
    expect(svarar.textContent).toContain("Klart: fakturan");
    expect(svarar.textContent).not.toMatch(/[*`[]/);
  });
});
