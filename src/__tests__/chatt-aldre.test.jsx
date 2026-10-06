import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden, OpsMeddelandeLank } from "../components/OpsMeddelanden.jsx";
import { OpsCountBadge } from "../components/counter.jsx";
import { applyQuery, foreVillkor } from "../data/contract.js";
import { createMemorySource } from "../data/adapters.js";
import { createFirestoreSource } from "../data/firestore.js";
import { createPostgresSource } from "../data/postgres.js";
import { createHttpSource } from "../data/http.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { levandeKalla } from "./levandeKalla.js";

/**
 * Etapp 2 av chattens nattskiva: "Visa äldre" och "50+".
 *
 * ⛔ HÄR MÄTS BETEENDE: att kontraktets `fore` filtrerar strikt i varje adapter eller kastar, att källan når meddelande 51 och
 * bakåt utan att tappa två med samma millisekund, att loggen visar äldre överst utan hål när någon skriver, och att olästräknaren
 * säger "50+" när räkningen nådde sidans storlek.
 */

describe("kontraktets fore", () => {
  const rader = [1, 2, 3, 4].map((t) => ({ id: `m${t}`, tid: t }));
  it("⛔ strikt mindre än, och bara mot samma typ", () => {
    expect(applyQuery(rader, { fore: { falt: "tid", varde: 3 } }).map((r) => r.id)).toEqual(["m1", "m2"]);
    expect(applyQuery([...rader, { id: "s", tid: "1" }], { fore: { falt: "tid", varde: 3 } }).map((r) => r.id)).toEqual(["m1", "m2"]);
  });
  it("⛔ fel form kastar, ett saknat villkor är inget villkor", () => {
    expect(foreVillkor(undefined)).toBeNull();
    expect(() => foreVillkor({ falt: "", varde: 1 })).toThrow(/falt krävs/);
    expect(() => foreVillkor({ falt: "tid", varde: { x: 1 } })).toThrow(/tal eller en sträng/);
    expect(() => foreVillkor({ falt: "tid", varde: 1, inklusive: true })).toThrow(/okända fält/);
  });
  it("⛔ Firestore översätter till where(<), Postgres till en parameter, och http kastar", async () => {
    const where = vi.fn(() => ({}));
    const sdk = {
      collection: () => ({}), doc: () => ({}), getDoc: async () => ({ exists: () => false }), getDocs: async () => ({ docs: [] }),
      addDoc: async () => ({ id: "x" }), setDoc: async () => {}, updateDoc: async () => {}, deleteDoc: async () => {},
      query: () => ({}), where, orderBy: () => ({}), limit: () => ({}), onSnapshot: () => () => {},
    };
    await createFirestoreSource({ db: {}, sdk }).list("s/x/meddelanden", { fore: { falt: "tid", varde: 9 }, sortBy: "tid", direction: "desc", limit: 50 });
    expect(where).toHaveBeenCalledWith("tid", "<", 9);
    const query = vi.fn(async () => []);
    await createPostgresSource({ query }).list("meddelanden", { where: { sid: "a" }, fore: { falt: "tid", varde: 9 }, limit: 5 });
    expect(query.mock.calls[0]).toEqual(['SELECT * FROM "meddelanden" WHERE "sid" = $1 AND "tid" < $2 LIMIT $3', ["a", 9, 5]]);
    await expect(createPostgresSource({ query }).list("m", { fore: { falt: "tid; DROP", varde: 1 } })).rejects.toThrow();
    const http = createHttpSource({ baseUrl: "https://api.exempel.se", load: /** @type {any} */ (async () => new Response("[]")) });
    await expect(http.list("m", { fore: { falt: "tid", varde: 1 } })).rejects.toThrow(/fore stöds inte/);
  });
});

/** @param {number} n @param {{ av?: string, kalla?: any, start?: number }} [val] */
async function samtalMed(n, val = {}) {
  const kalla = val.kalla ?? createMemorySource({});
  let t = val.start ?? Date.now() - 10_000_000;
  const s = createSamtalskalla({ kalla, klocka: () => (t += 1000) });
  const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  for (let i = 1; i <= n; i += 1) await s.skicka(p.id, { text: `Meddelande ${i}`, av: val.av ?? (i % 2 ? "bo" : "anna") });
  return { kalla, s, p, klocka: () => (t += 1000) };
}

describe("källan: aldreMeddelanden", () => {
  it("⛔ når meddelande 51 och bakåt, sida för sida, och säger när början är nådd", async () => {
    const { s, p } = await samtalMed(120);
    const forsta = await s.meddelanden(p.id);
    expect(forsta).toHaveLength(50);
    expect(forsta[0].text).toBe("Meddelande 71");
    const kanda = new Set(forsta.map((m) => m.id));
    const andra = await s.aldreMeddelanden(p.id, { tid: forsta[0].tid, kanda });
    expect(andra.rader.map((m) => m.text)[0]).toBe("Meddelande 21");
    expect(andra.rader.at(-1)?.text).toBe("Meddelande 70");
    expect(andra.fler).toBe(true);
    for (const m of andra.rader) kanda.add(m.id);
    const tredje = await s.aldreMeddelanden(p.id, { tid: andra.rader[0].tid, kanda });
    expect(tredje.rader.map((m) => m.text)).toEqual(Array.from({ length: 20 }, (_, i) => `Meddelande ${i + 1}`));
    expect(tredje.fler).toBe(false);
  });
  it("⛔ två meddelanden samma millisekund faller inte mellan sidorna", async () => {
    const kalla = createMemorySource({});
    const s = createSamtalskalla({ kalla, sida: 3 });
    const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
    const vag = `samtal/${p.id}/meddelanden`;
    for (const [id, tid] of [["a", 1], ["b", 2], ["c", 2], ["d", 3], ["e", 4]]) await kalla.create(vag, { id, text: id, av: "bo", tid });
    const forsta = await s.meddelanden(p.id); // c|b, d, e: sidan bär en av de två med tid 2
    expect(forsta.map((m) => m.tid)).toEqual([2, 3, 4]);
    const kanda = new Set(forsta.map((m) => m.id));
    const aldre = await s.aldreMeddelanden(p.id, { tid: 2, kanda });
    expect(aldre.rader.map((m) => m.id).sort()).toEqual(["a", forsta[0].id === "b" ? "c" : "b"].sort());
  });
  it("⛔ en hel sida med samma tid ger nästa sida och inte samma igen", async () => {
    const kalla = createMemorySource({});
    const s = createSamtalskalla({ kalla, sida: 2 });
    const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
    const vag = `samtal/${p.id}/meddelanden`;
    for (const [id, tid] of [["a", 1], ["b", 5], ["c", 5], ["d", 5]]) await kalla.create(vag, { id, text: id, av: "bo", tid });
    const aldre = await s.aldreMeddelanden(p.id, { tid: 5, kanda: ["c", "d"] });
    // "Till och med 5" ger d, c och b (taket är sidan plus en): b är ny. Med b också känd är alla tre kända, och då frågas
    // strikt före: a.
    expect(aldre.rader.map((m) => m.id)).toEqual(["b"]);
    const sedan = await s.aldreMeddelanden(p.id, { tid: 5, kanda: ["b", "c", "d"] });
    expect(sedan.rader.map((m) => m.id)).toEqual(["a"]);
    expect(sedan.fler).toBe(false);
  });
});

describe("vyn: Visa äldre", () => {
  it("⛔ knappen överst hämtar sida för sida, och början sägs ut", async () => {
    const { s, p } = await samtalMed(120);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={[]} valt={p.id} />);
    const logg = await screen.findByRole("log");
    await within(logg).findByText("Meddelande 120");
    expect(within(logg).queryByText("Meddelande 70")).toBeNull();
    const knapp = within(logg).getByRole("button", { name: "Visa äldre" });
    expect(logg.firstElementChild?.contains(knapp) || logg.children[0]?.querySelector("[data-visa-aldre]") === knapp).toBe(true);
    fireEvent.click(knapp);
    await within(logg).findByText("Meddelande 21");
    fireEvent.click(within(logg).getByRole("button", { name: "Visa äldre" }));
    await within(logg).findByText("Meddelande 1");
    expect(within(logg).getByText("Inga äldre meddelanden")).toBeTruthy();
    expect(within(logg).queryByRole("button", { name: "Visa äldre" })).toBeNull();
    // Ordningen: äldst först, inget dubblerat.
    const texter = [...logg.querySelectorAll("[data-bubbla]")].map((b) => b.textContent);
    expect(texter).toHaveLength(120);
    expect(texter[0]).toBe("Meddelande 1");
    expect(texter[119]).toBe("Meddelande 120");
  });
  it("⛔ inget hål mellan den hämtade sidan och de senaste när någon skriver", async () => {
    const live = levandeKalla();
    const { s, p } = await samtalMed(60, { kalla: live });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={[]} valt={p.id} />);
    const logg = await screen.findByRole("log");
    await within(logg).findByText("Meddelande 60");
    fireEvent.click(within(logg).getByRole("button", { name: "Visa äldre" }));
    await within(logg).findByText("Meddelande 1");
    await act(async () => {
      for (let i = 61; i <= 65; i += 1) await s.skicka(p.id, { text: `Meddelande ${i}`, av: "bo" });
    });
    await within(logg).findByText("Meddelande 65");
    const texter = [...logg.querySelectorAll("[data-bubbla]")].map((b) => b.textContent);
    expect(texter).toEqual(Array.from({ length: 65 }, (_, i) => `Meddelande ${i + 1}`));
  });
  it("⛔ ett fel säger det och låter knappen stå kvar för ett nytt försök", async () => {
    const { s, p } = await samtalMed(55);
    const trasig = /** @type {any} */ ({ ...s, aldreMeddelanden: async () => Promise.reject(new Error("nät")) });
    render(<OpsMeddelanden kalla={trasig} uid="anna" groupId="g" gruppNamn="G" medlemmar={[]} valt={p.id} />);
    const logg = await screen.findByRole("log");
    fireEvent.click(await within(logg).findByRole("button", { name: "Visa äldre" }));
    expect(await within(logg).findByRole("alert")).toHaveTextContent("Äldre meddelanden kunde inte hämtas");
    expect(within(logg).getByRole("button", { name: "Visa äldre" })).toBeTruthy();
  });
  it("⛔ ett kort samtal har ingen knapp", async () => {
    const { s, p } = await samtalMed(5);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={[]} valt={p.id} />);
    const logg = await screen.findByRole("log");
    await within(logg).findByText("Meddelande 5");
    expect(within(logg).queryByRole("button", { name: "Visa äldre" })).toBeNull();
  });
});

describe("50+ i olästräkningen", () => {
  it("⛔ märket: plus och 'eller fler' när antalet är ett golv, inget plus annars", () => {
    const { container, rerender } = render(<OpsCountBadge count={50} fler text="olästa" />);
    expect(container.textContent).toBe("50+ 50 eller fler olästa");
    rerender(<OpsCountBadge count={49} text="olästa" />);
    expect(container.textContent).toBe("49 49 olästa");
    rerender(<OpsCountBadge count={150} fler text="olästa" />);
    expect(container.textContent?.startsWith("99+")).toBe(true);
  });
  it("⛔ 120 olästa visas som 50+ i raden, i filtret och i ingångens anrop", async () => {
    const { s } = await samtalMed(120, { av: "bo" });
    const onOlasta = vi.fn();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={[]} onOlasta={onOlasta} />);
    await waitFor(() => expect(onOlasta).toHaveBeenLastCalledWith(50, { fler: true }));
    const rad = /** @type {HTMLElement} */ (document.querySelector('[data-samtalsrad="personer"]'));
    expect(rad.querySelector("[data-ops-count-badge]")?.textContent).toBe("50+ 50 eller fler olästa");
    const { container } = render(<OpsMeddelandeLank href="/m" olasta={50} olastaFler />);
    expect(container.querySelector("[data-ops-count-badge]")?.textContent).toContain("50+");
  });
  it("⛔ 49 olästa är 49, utan plus", async () => {
    const { s } = await samtalMed(49, { av: "bo" });
    const onOlasta = vi.fn();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={[]} onOlasta={onOlasta} />);
    await waitFor(() => expect(onOlasta).toHaveBeenLastCalledWith(49, { fler: false }));
  });
  it("⛔ en full sida där det äldsta är läst är ett exakt antal", async () => {
    const { s, p } = await samtalMed(60, { av: "bo" });
    const forsta = await s.meddelanden(p.id);
    await s.markeraLast(p.id, "anna", forsta[9].tid); // tio av sidans femtio lästa
    const r = (await s.oversikt({ groupId: "g", uid: "anna" }))[0];
    expect(r.olasta).toBe(40);
    expect(r.olastaFler).toBe(false);
  });
});
