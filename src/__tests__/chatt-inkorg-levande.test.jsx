import { describe, expect, it } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { useSamtal } from "../data/useSamtal.jsx";
import { levandeKalla } from "./levandeKalla.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/**
 * En inkorg som lever utan fokus (0.106.0, #386 skiva 7). Gapanalysen: räknarna för andra samtal stod still tills fönstret fick
 * fokus, så den som satt i ett samtal såg inte att någon skrivit i ett annat.
 *
 * ⛔ Inget prov här skickar `focus`. Allt som syns ska ha kommit av lyssnarna. Kostnaden räknas på källans läsningar; i Firestore
 * mäts den i emulatorn, `rules/__tests__/inkorg-levande.test.mjs`.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "cia", namn: "Cia Berg", typ: "person", status: "aktiv" },
];

/** En levande källa som räknar läsningarna: `list` och `read` per samling, och lyssnarna. */
function raknadKalla() {
  const bas = levandeKalla();
  const rakning = { list: /** @type {string[]} */ ([]), read: /** @type {string[]} */ ([]), lyssnare: /** @type {Array<{ c: string, q: any }>} */ ([]) };
  const k = /** @type {any} */ ({
    ...bas,
    list: (/** @type {string} */ c, /** @type {any} */ q) => {
      rakning.list.push(c);
      return bas.list(c, q);
    },
    read: (/** @type {string} */ c, /** @type {string} */ id) => {
      rakning.read.push(c);
      return bas.read(c, id);
    },
    subscribe: (/** @type {string} */ c, /** @type {any} */ q, /** @type {any} */ l) => {
      rakning.lyssnare.push({ c, q });
      return bas.subscribe(c, q, l);
    },
  });
  return { kalla: k, rakning, nollstall: () => Object.assign(rakning, { list: [], read: [], lyssnare: [] }) };
}

async function underlag(levandeInkorg = true) {
  const r = raknadKalla();
  let t = new Date(2026, 9, 14, 9, 0).getTime();
  const s = /** @type {any} */ (createSamtalskalla({ kalla: r.kalla, klocka: () => (t += 60000), ...(levandeInkorg ? { levandeInkorg: true } : {}) }));
  const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
  await s.skicka(g.id, { text: "God morgon", av: "anna" });
  const bo = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  await s.skicka(bo.id, { text: "Hej Bo", av: "anna" });
  const cia = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "cia" });
  await s.skicka(cia.id, { text: "Hej Cia", av: "anna" });
  return { ...r, s, g, bo, cia };
}

const radFor = (/** @type {string} */ namn) => /** @type {HTMLElement} */ (screen.getByRole("button", { name: new RegExp(namn) }));

describe("en inkorg som lever utan fokus", () => {
  it("⛔ ett meddelande från någon annan når inkorgens rad och räknaren utan att fönstret får fokus", async () => {
    const { s, bo } = await underlag();
    const olasta = /** @type {number[]} */ ([]);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} onOlasta={(n) => olasta.push(n)} />);
    await waitFor(() => expect(radFor("Bo Lind").textContent).toContain("Hej Bo"));
    await act(async () => {
      await s.skicka(bo.id, { text: "Har du sett protokollet?", av: "bo" });
    });
    await waitFor(() => expect(radFor("Bo Lind").textContent).toContain("Har du sett protokollet?"));
    expect(radFor("Bo Lind").textContent).toContain("1");
    expect(olasta.at(-1)).toBe(1);
  });

  it("⛔ kostnaden: en lyssnare per samtal på det senaste meddelandet, och ett nytt meddelande läser om bara den raden", async () => {
    const { s, bo, rakning, nollstall } = await underlag();
    nollstall();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} />);
    await waitFor(() => expect(rakning.lyssnare.filter((l) => l.c.endsWith("/meddelanden")).length).toBe(3));
    const lyssnare = rakning.lyssnare.filter((l) => l.c.endsWith("/meddelanden"));
    // Golv och form: tre samtal, tre lyssnare, var och en på ETT meddelande.
    expect(lyssnare.map((l) => l.q.limit)).toEqual([1, 1, 1]);
    expect(new Set(lyssnare.map((l) => l.c)).size).toBe(3);
    await waitFor(() => expect(radFor("Bo Lind").textContent).toContain("Hej Bo"));
    nollstall();
    await act(async () => {
      await s.skicka(bo.id, { text: "En fråga till", av: "bo" });
    });
    await waitFor(() => expect(radFor("Bo Lind").textContent).toContain("En fråga till"));
    // Bara Bos rad: dess meddelanden och dess läsmärke. Ingen samtalslista, inget annat samtal, ingen ny lyssnare.
    expect(rakning.list.filter((c) => c !== `samtal/${bo.id}/meddelanden`)).toEqual([]);
    expect(rakning.list.length).toBe(1);
    expect(rakning.read).toEqual([`samtal/${bo.id}/last`]);
    expect(rakning.lyssnare).toEqual([]);
  });

  it("⛔ ett eget meddelande i ett annat fönster läser ingenting, och raden visar det ändå", async () => {
    const { s, cia, rakning, nollstall } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} />);
    await waitFor(() => expect(radFor("Cia Berg").textContent).toContain("Hej Cia"));
    await waitFor(() => expect(rakning.lyssnare.filter((l) => l.c.endsWith("/meddelanden")).length).toBe(3));
    nollstall();
    await act(async () => {
      await s.skicka(cia.id, { text: "Skrivet i telefonen", av: "anna" });
    });
    await waitFor(() => expect(radFor("Cia Berg").textContent).toContain("Skrivet i telefonen"));
    expect(rakning.list).toEqual([]);
    expect(rakning.read).toEqual([]);
  });

  it("⛔ utan levandeInkorg lyssnar inkorgen inte, och raden står still tills fokus, som förut", async () => {
    const { s, bo, rakning } = await underlag(false);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} />);
    await waitFor(() => expect(radFor("Bo Lind").textContent).toContain("Hej Bo"));
    await act(async () => {
      await s.skicka(bo.id, { text: "Inte sedd", av: "bo" });
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(radFor("Bo Lind").textContent).not.toContain("Inte sedd");
    expect(rakning.lyssnare.filter((l) => l.c.endsWith("/meddelanden"))).toEqual([]);
  });
});

describe("gruppbyte", () => {
  it("⛔ ett byte av grupp öppnar inga lyssnare på den förra gruppens samtal (granskningen av PR 390)", async () => {
    const { s, g, bo, cia, rakning, nollstall } = await underlag();
    const h = await s.oppnaGrupp({ groupId: "h", uid: "anna" });
    await s.skicka(h.id, { text: "Hej h", av: "anna" });
    const { result, rerender } = renderHook((/** @type {{ groupId: string }} */ { groupId }) => useSamtal({ kalla: s, groupId, uid: "anna" }), { initialProps: { groupId: "g" } });
    // Golv: gruppen g har tre samtal och får tre lyssnare, annars mäter provet ingenting.
    await waitFor(() => expect(rakning.lyssnare.filter((l) => l.c.endsWith("/meddelanden")).length).toBe(3));
    await waitFor(() => expect(result.current.rader.length).toBe(3));
    nollstall();
    rerender({ groupId: "h" });
    await waitFor(() => expect(result.current.rader.map((r) => r.samtal.id)).toEqual([h.id]));
    const forra = new Set([g.id, bo.id, cia.id].map((id) => `samtal/${id}/meddelanden`));
    // Taket: ingen lyssnare öppnades på något av g:s samtal efter bytet. Den nya gruppens enda samtal får sin lyssnare.
    expect(rakning.lyssnare.filter((l) => forra.has(l.c))).toEqual([]);
    expect(rakning.lyssnare.filter((l) => l.c.endsWith("/meddelanden")).map((l) => l.c)).toEqual([`samtal/${h.id}/meddelanden`]);
  });
});

describe("den läsning som startade sist vinner, per rad", () => {
  it("⛔ en radläsning som startade före en hel omläsning skriver inte över den, fast den svarar sist", async () => {
    // Ett samtal med en fejkad källa där svaren styrs för hand.
    const samtal = { id: "g|anna|bo", groupId: "g", slag: "personer", deltagare: ["anna", "bo"], skapad: 1, skapadAv: "anna" };
    const rad = (/** @type {number} */ olasta, /** @type {string} */ text, /** @type {number} */ tid) => ({ samtal, senaste: { id: `m${tid}`, text, av: "bo", tid }, olasta, lastTill: 0, motpart: "bo" });
    /** @type {Array<(r: any) => void>} */
    const oversikter = [];
    /** @type {Array<(r: any) => void>} */
    const radlasningar = [];
    /** @type {any} */
    let pa = null;
    const kalla = /** @type {any} */ ({
      oversikt: () => new Promise((res) => oversikter.push(res)),
      inkorgsrad: () => new Promise((res) => radlasningar.push(res)),
      bevakaInkorg: (/** @type {string[]} */ _sids, /** @type {any} */ l) => {
        pa = l;
        return () => {};
      },
    });
    const { result } = renderHook(() => useSamtal({ kalla, groupId: "g", uid: "anna" }));
    await act(async () => oversikter[0]([rad(0, "Hej", 10)]));
    await waitFor(() => expect(pa).not.toBeNull());
    // Bo skriver: raden läses om (startar först).
    act(() => pa.onSenaste(samtal.id, { id: "m20", text: "Ny", av: "bo", tid: 20 }));
    expect(radlasningar.length).toBe(1);
    // Samtalet är öppet och markeras läst, och hela inkorgen läses om (startar sedan).
    act(() => {
      result.current.lasOm();
    });
    // Den hela omläsningen svarar först, med samtalet läst; radläsningen svarar sist, med läsmärket från innan.
    await act(async () => oversikter[1]([rad(0, "Ny", 20)]));
    await act(async () => radlasningar[0](rad(1, "Ny", 20)));
    expect(result.current.rader[0].olasta).toBe(0);
    expect(result.current.olasta).toBe(0);
  });
});
