import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { OpsKommentarer } from "../components/OpsKommentarer.jsx";
import { identityTone } from "../lib/identity.js";

/**
 * En kommentarkomponent för händelser och ärenden (0.150.0, #381, beslut CP 2026-10-26: "Ja alla"). Datan ligger kvar där den är;
 * det som skilde ärendets tråd från händelsens var synkläget per rad, en rad om vart kommentaren tar vägen, en not under tråden
 * och att en synkad kommentar inte ska ha "Ta bort". Det är fyra frivilliga props, och utan dem är komponenten som i 0.149.0
 * (provas i `kommentarer.test.jsx`).
 */

const anna = { uid: "anna", namn: "Anna Ek" };
const bo = { uid: "bo", namn: "Bo Lind" };
/** @param {string} id @param {any} av @param {any} [extra] */
const k = (id, av, extra = {}) => ({ id, text: `text ${id}`, skapad: "2026-10-26T10:00:00.000Z", skapadAv: av, ...extra });
/** Ärendets rader bär ett synkläge; händelsens gör det inte. */
const arende = [k("a1", anna, { synk: "skickad", resultat: { url: "https://github.com/cllp/bolag-ops/issues/9#c1" } }), k("a2", anna, { synk: "fel", fel: "GitHub svarade 410" }), k("b1", bo, { synk: "lokal" })];
const synkRad = (/** @type {any} */ x) => (x.synk ? <span data-lage={x.synk}>{x.synk === "fel" ? `Kom inte fram: ${x.fel}` : x.synk === "skickad" ? <a href={x.resultat.url}>På ärendet</a> : "Bara här"}</span> : null);

describe("radFot: en rad under varje kommentar", () => {
  it("ritas under RÄTT kommentar, med den kommentarens eget läge", () => {
    render(<OpsKommentarer kommentarer={arende} uid="anna" onSkriv={() => {}} radFot={synkRad} />);
    const rader = screen.getAllByRole("listitem");
    expect(within(rader[0]).getByRole("link", { name: "På ärendet" }).getAttribute("href")).toContain("issues/9");
    expect(within(rader[1]).getByText("Kom inte fram: GitHub svarade 410")).toBeTruthy();
    expect(within(rader[2]).getByText("Bara här")).toBeTruthy();
    // ⛔ läget står på varje rad och inte på tråden: ingen rad bär en annans läge
    expect(within(rader[0]).queryByText(/Kom inte fram/)).toBeNull();
    expect(within(rader[1]).queryByRole("link", { name: "På ärendet" })).toBeNull();
  });
  it("returnerar den inget (en händelsekommentar utan läge) ritas ingen tom ruta", () => {
    const { container } = render(<OpsKommentarer kommentarer={[k("h1", anna), k("h2", bo)]} uid="anna" onSkriv={() => {}} radFot={synkRad} />);
    expect(container.querySelector("[data-kommentar-fot]")).toBeNull();
  });
  it("utan radFot är raderna som förut: ingen fotyta", () => {
    const { container } = render(<OpsKommentarer kommentarer={arende} uid="anna" onSkriv={() => {}} />);
    expect(container.querySelector("[data-kommentar-fot]")).toBeNull();
  });
});

describe("skrivHint: vart kommentaren tar vägen, innan man skrivit den", () => {
  it("står under etiketten och hör till skrivrutan (aria-describedby)", () => {
    render(<OpsKommentarer kommentarer={[]} uid="anna" onSkriv={() => {}} skrivHint="Läggs som kommentar på #9." />);
    const ruta = screen.getByRole("textbox", { name: "Skriv en kommentar" });
    expect(screen.getByText("Läggs som kommentar på #9.")).toBeTruthy();
    const id = ruta.getAttribute("aria-describedby") ?? "";
    expect(id.split(" ").some((i) => document.getElementById(i)?.textContent === "Läggs som kommentar på #9.")).toBe(true);
  });
  it("utan skrivHint finns ingen hjälptext", () => {
    render(<OpsKommentarer kommentarer={[]} uid="anna" onSkriv={() => {}} />);
    expect(screen.getByRole("textbox", { name: "Skriv en kommentar" }).getAttribute("aria-describedby")).toBeNull();
  });
});

describe("fot: en rad under tråden", () => {
  const FOT = <span>Kommentarer skrivna direkt på ärendet syns inte här.</span>;
  it("ritas ovanför skrivrutan när tråden har innehåll", () => {
    render(<OpsKommentarer kommentarer={arende} uid="anna" onSkriv={() => {}} fot={FOT} />);
    const fot = screen.getByText(/syns inte här/);
    const ruta = screen.getByRole("textbox", { name: "Skriv en kommentar" });
    expect(fot.compareDocumentPosition(ruta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("listitem")[2].compareDocumentPosition(fot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("⛔ ritas i varje läge, också tom tråd, laddning och lasfel: det den säger gäller hela tråden", () => {
    const { rerender } = render(<OpsKommentarer kommentarer={[]} uid="anna" onSkriv={() => {}} fot={FOT} />);
    expect(screen.getByText(/syns inte här/)).toBeTruthy();
    rerender(<OpsKommentarer kommentarer={[]} laddar uid="anna" onSkriv={() => {}} fot={FOT} />);
    expect(screen.getByText(/syns inte här/)).toBeTruthy();
    rerender(<OpsKommentarer kommentarer={[]} fel={new Error("nekad")} uid="anna" onSkriv={() => {}} fot={FOT} />);
    expect(screen.getByText(/syns inte här/)).toBeTruthy();
  });
  it("utan fot ritas ingen", () => {
    const { container } = render(<OpsKommentarer kommentarer={arende} uid="anna" onSkriv={() => {}} />);
    expect(container.querySelector("[data-kommentarer-fot]")).toBeNull();
  });
});

describe("kanTaBort: snäver in, vidgar aldrig", () => {
  const trad = [k("a1", anna, { synk: "skickad" }), k("a2", anna, { synk: "lokal" }), k("b1", bo, { synk: "lokal" })];
  const tabort = (/** @type {HTMLElement} */ rad) => within(rad).queryByRole("button", { name: /Ta bort/ });
  it("en synkad kommentar kan ha ingen Ta bort medan en lokal min har den", () => {
    render(<OpsKommentarer kommentarer={trad} uid="anna" onSkriv={() => {}} onTaBort={() => {}} kanTaBort={(x) => x.synk !== "skickad"} />);
    const rader = screen.getAllByRole("listitem");
    expect(tabort(rader[0])).toBeNull();
    expect(tabort(rader[1])).not.toBeNull();
  });
  it("⛔ SANT för någon annans kommentar ger ändå ingen knapp: regeln släpper bara igenom den som skrev den", () => {
    render(<OpsKommentarer kommentarer={trad} uid="anna" onSkriv={() => {}} onTaBort={() => {}} kanTaBort={() => true} />);
    expect(tabort(screen.getAllByRole("listitem")[2])).toBeNull();
  });
  it("⛔ SANT utan onTaBort ger ingen knapp", () => {
    render(<OpsKommentarer kommentarer={trad} uid="anna" onSkriv={() => {}} kanTaBort={() => true} />);
    expect(screen.queryByRole("button", { name: /Ta bort/ })).toBeNull();
  });
  it("utan kanTaBort: alla mina har Ta bort, som förut", () => {
    render(<OpsKommentarer kommentarer={trad} uid="anna" onSkriv={() => {}} onTaBort={() => {}} />);
    const rader = screen.getAllByRole("listitem");
    expect([tabort(rader[0]), tabort(rader[1]), tabort(rader[2])].map(Boolean)).toEqual([true, true, false]);
  });
  it("trycket tar bort just den kommentaren", () => {
    /** @type {string[]} */ const borta = [];
    render(<OpsKommentarer kommentarer={trad} uid="anna" onSkriv={() => {}} onTaBort={(id) => { borta.push(id); }} kanTaBort={(x) => x.synk !== "skickad"} />);
    fireEvent.click(tabort(screen.getAllByRole("listitem")[1]));
    expect(borta).toEqual(["a2"]);
  });
});

describe("den gamla formen på skapadAv (en sträng)", () => {
  it("ger namnet, inte [object Object] och inte Namn saknas, och ingen Ta bort (inget uid att jämföra)", () => {
    render(<OpsKommentarer kommentarer={[k("g1", "Claes Philip")]} uid="anna" onSkriv={() => {}} onTaBort={() => {}} />);
    const rad = screen.getByRole("listitem");
    expect(within(rad).getByText("Claes Philip")).toBeTruthy();
    expect(rad.textContent).not.toMatch(/object Object|Namn saknas/);
    expect(within(rad).queryByRole("button", { name: /Ta bort/ })).toBeNull();
  });
});

describe("avatarens färg på gamla kommentarer", () => {
  const tonen = (/** @type {HTMLElement} */ rad) => rad.innerHTML.match(/bg-identity-(\d)/)?.[1];
  it("samma namn ger samma färg när uid saknas, oavsett kommentarens id (inte ett nytt slumpval per rad)", () => {
    // c1, c2, c3 ger tre OLIKA toner som frö, så ett frö ur kommentarens id syns som tre färger.
    expect(new Set(["c1", "c2", "c3"].map(identityTone)).size).toBe(3);
    render(<OpsKommentarer kommentarer={[k("c1", "Claes Philip"), k("c2", "Claes Philip"), k("c3", "Claes Philip")]} uid="anna" onSkriv={() => {}} />);
    const toner = screen.getAllByRole("listitem").map(tonen);
    expect(new Set(toner).size).toBe(1);
    expect(toner[0]).toBe(String(identityTone("Claes Philip")));
  });
  it("med uid är frötet fortfarande uid:t, och utan både uid och namn kommentarens id", () => {
    render(<OpsKommentarer kommentarer={[k("c1", anna), k("c2", { uid: "", namn: "" })]} uid="x" onSkriv={() => {}} />);
    const rader = screen.getAllByRole("listitem");
    expect(tonen(rader[0])).toBe(String(identityTone("anna")));
    expect(tonen(rader[1])).toBe(String(identityTone("c2")));
  });
});

describe("felaktiga props kastar med ett fel som säger vad", () => {
  it("kanTaBort och radFot måste vara funktioner", () => {
    const tyst = (/** @type {any} */ f) => { const e = console.error; console.error = () => {}; try { f(); } finally { console.error = e; } };
    tyst(() => expect(() => render(<OpsKommentarer kommentarer={[]} uid="a" onSkriv={() => {}} kanTaBort={/** @type {any} */ (true)} />)).toThrow(/kanTaBort måste vara en funktion/));
    tyst(() => expect(() => render(<OpsKommentarer kommentarer={[]} uid="a" onSkriv={() => {}} radFot={/** @type {any} */ ("text")} />)).toThrow(/radFot måste vara en funktion/));
  });
});
