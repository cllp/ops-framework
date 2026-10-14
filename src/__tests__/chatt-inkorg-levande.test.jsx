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

async function underlag(levandeInkorg = true, sida = 50) {
  const r = raknadKalla();
  let t = new Date(2026, 9, 14, 9, 0).getTime();
  const s = /** @type {any} */ (createSamtalskalla({ kalla: r.kalla, klocka: () => (t += 60000), sida, ...(levandeInkorg ? { levandeInkorg: true } : {}) }));
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

  it("⛔ kostnaden: en lyssnare per samtal på det senaste meddelandet, och ett nytt meddelande kostar noll läsningar", async () => {
    const { s, bo, rakning, nollstall } = await underlag();
    nollstall();
    const olasta = /** @type {number[]} */ ([]);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} onOlasta={(n) => olasta.push(n)} />);
    await waitFor(() => expect(rakning.lyssnare.filter((l) => l.c.endsWith("/meddelanden")).length).toBe(3));
    const lyssnare = rakning.lyssnare.filter((l) => l.c.endsWith("/meddelanden"));
    // Golv och form: tre samtal, tre lyssnare, var och en på de TVÅ senaste meddelandena (omgranskningen: ett slog ihop meddelanden).
    expect(lyssnare.map((l) => l.q.limit)).toEqual([2, 2, 2]);
    expect(new Set(lyssnare.map((l) => l.c)).size).toBe(3);
    await waitFor(() => expect(radFor("Bo Lind").textContent).toContain("Hej Bo"));
    nollstall();
    for (const [i, text] of ["En fråga till", "Och en till"].entries()) {
      await act(async () => {
        await s.skicka(bo.id, { text, av: "bo" });
      });
      // Golv: raden och räknaren har följt med, räknade ur meddelandet lyssnaren fick.
      await waitFor(() => expect(radFor("Bo Lind").textContent).toContain(text));
      await waitFor(() => expect(olasta.at(-1)).toBe(i + 1));
      // Tak: ingen meddelandeläsning alls för ett inkommande meddelande, bara läsmärket (ett dokument). Förut en sida (50) och läsmärket.
      expect(rakning.list).toEqual([]);
      expect(rakning.read).toEqual([`samtal/${bo.id}/last`]);
      expect(rakning.lyssnare).toEqual([]);
      nollstall();
    }
  });

  it("⛔ när olästa blir ett golv (sidan full med sin äldsta oläst) läses raden om, och bara den", async () => {
    const { s, bo, rakning, nollstall } = await underlag(true, 3);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} />);
    await waitFor(() => expect(rakning.lyssnare.filter((l) => l.c.endsWith("/meddelanden")).length).toBe(3));
    await waitFor(() => expect(radFor("Bo Lind").textContent).toContain("Hej Bo"));
    nollstall();
    // Samtalet har "Hej Bo" (eget). "Ett" ger två meddelanden i sidan om tre: räknas lokalt, noll läsningar.
    await act(async () => {
      await s.skicka(bo.id, { text: "Ett", av: "bo" });
    });
    await waitFor(() => expect(radFor("Bo Lind").textContent).toContain("Ett"));
    expect(rakning.list).toEqual([]);
    nollstall();
    // "Två" fyller sidan (3) och dess äldsta är oläst: summan är ett golv, och bara då läses raden om.
    await act(async () => {
      await s.skicka(bo.id, { text: "Två", av: "bo" });
    });
    await waitFor(() => expect(radFor("Bo Lind").textContent).toContain("Två"));
    await waitFor(() => expect(rakning.list).toEqual([`samtal/${bo.id}/meddelanden`]));
    // Läsmärket lästes av den lokala räkningen (som gav upp) och av omläsningen av raden.
    expect(rakning.read).toEqual([`samtal/${bo.id}/last`, `samtal/${bo.id}/last`]);
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

describe("inkorgsradMed: när en rad inte går att räkna med säkerhet", () => {
  const samtal = { id: "g|anna|bo", groupId: "g", slag: "personer", deltagare: ["anna", "bo"], skapad: 1, skapadAv: "anna" };
  const m = (/** @type {number} */ tid, av = "bo") => ({ id: `m${tid}`, text: `t${tid}`, av, tid });
  const rad = (/** @type {any} */ over = {}) => ({ samtal, senaste: m(20), olasta: 1, olastaFler: false, olastaRader: [m(20)], lastTill: 10, motpart: "bo", fonster: [5, 20], ...over });
  /** Källan med ett läsmärke för Anna i samtalet (det en annan enhet kan ha flyttat). */
  const kallaMed = (/** @type {number} */ till) => /** @type {any} */ (createSamtalskalla({ kalla: levandeKalla({ [`samtal/${samtal.id}/last`]: [{ id: "anna", lastTill: till }] }), levandeInkorg: true, sida: 3 }));

  it("räknar in ett nytt meddelande från någon annan: senaste, olästa och rader", async () => {
    const ny = await kallaMed(10).inkorgsradMed(rad(), m(30), "anna", m(20));
    expect(ny.senaste.id).toBe("m30");
    expect(ny.olasta).toBe(2);
    expect(ny.olastaRader.map((r) => r.id)).toEqual(["m20", "m30"]);
    expect(ny.fonster).toEqual([5, 20, 30]);
  });

  it("⛔ läser om (null) när summan redan är ett golv, när sidan blir full med sin äldsta oläst, vid oordning, utan fönster och utan besked om föregående", async () => {
    const k = kallaMed(10);
    expect(await k.inkorgsradMed(rad({ olastaFler: true }), m(30), "anna", m(20))).toBeNull();
    expect(await k.inkorgsradMed(rad({ fonster: [15, 20] }), m(30), "anna", m(20))).toBeNull();
    expect(await k.inkorgsradMed(rad(), m(20), "anna", m(20))).toBeNull();
    expect(await k.inkorgsradMed(rad({ fonster: undefined }), m(30), "anna", m(20))).toBeNull();
    expect(await k.inkorgsradMed(rad(), m(30), "anna")).toBeNull();
  });

  it("⛔ lyssnaren slog ihop meddelanden: det näst senaste i bilden är inte det raden har, och raden läses om", async () => {
    const k = kallaMed(10);
    // Raden har m20. Bilden bär m40 och m30: m30 har raden aldrig sett.
    expect(await k.inkorgsradMed(rad(), m(40), "anna", m(30))).toBeNull();
    // Och bilden med bara ett meddelande, men raden har ett: det kan inte stämma.
    expect(await k.inkorgsradMed(rad(), m(40), "anna", null)).toBeNull();
    // Ett tomt samtal får sitt första meddelande utan att läsas om.
    const forsta = await k.inkorgsradMed(rad({ senaste: null, olasta: 0, olastaRader: [], fonster: [] }), m(30), "anna", null);
    expect(forsta.olasta).toBe(1);
  });

  it("⛔ läsmärket läses: en annan enhet har läst, och det som lästs räknas inte som oläst", async () => {
    const ny = await kallaMed(20).inkorgsradMed(rad(), m(30), "anna", m(20));
    expect(ny.lastTill).toBe(20);
    expect(ny.olasta).toBe(1);
    expect(ny.olastaRader.map((r) => r.id)).toEqual(["m30"]);
  });

  it("ett eget meddelande läser inget och ändrar inga olästa, och en rad utan fönster får bara ett nytt senaste", async () => {
    const k = kallaMed(10);
    const eget = await k.inkorgsradMed(rad(), m(30, "anna"), "anna", m(20));
    expect(eget.olasta).toBe(1);
    expect(eget.fonster).toEqual([5, 20, 30]);
    const utanFonster = await k.inkorgsradMed(rad({ fonster: undefined }), m(30, "anna"), "anna");
    expect(utanFonster.senaste.id).toBe("m30");
  });

  it("ett fullt fönster glider: det som faller ur räknas bort, och delad tid kräver omläsning", async () => {
    const fullt = rad({ lastTill: 12, fonster: [5, 11, 20], olastaRader: [m(20)] });
    const ny = await kallaMed(12).inkorgsradMed(fullt, m(30), "anna", m(20));
    expect(ny.fonster).toEqual([11, 20, 30]);
    expect(ny.olasta).toBe(2);
    expect(await kallaMed(12).inkorgsradMed(rad({ lastTill: 12, fonster: [5, 5, 20] }), m(30), "anna", m(20))).toBeNull();
  });
});

describe("omgranskningen av PR 390: lokal räkning som inte får ljuga", () => {
  /** Källan med en lyssnare som provet styr för hand: den riktiga ersätts, så att vad lyssnaren levererar och när är provets val. */
  function styrdKalla(/** @type {any} */ s) {
    /** @type {any} */
    let pa = null;
    const kalla = /** @type {any} */ ({ ...s, bevakaInkorg: (/** @type {string[]} */ _sids, /** @type {any} */ l) => ((pa = l), () => {}) });
    return { kalla, lyssnare: () => pa };
  }
  const boRad = (/** @type {any[]} */ rader, /** @type {string} */ id) => rader.find((r) => r.samtal.id === id);

  it("⛔ MÅSTE 1: två meddelanden som lyssnaren slår ihop ger 2 olästa, inte 1", async () => {
    const { s, bo } = await underlag();
    const { kalla, lyssnare } = styrdKalla(s);
    const { result } = renderHook(() => useSamtal({ kalla, groupId: "g", uid: "anna" }));
    await waitFor(() => expect(result.current.rader.length).toBe(3));
    await waitFor(() => expect(lyssnare()).not.toBeNull());
    // Golv: raden har inga olästa innan.
    expect(boRad(result.current.rader, bo.id).olasta).toBe(0);
    await s.skicka(bo.id, { text: "Ett", av: "bo" });
    await s.skicka(bo.id, { text: "Två", av: "bo" });
    const [tva, ett] = (await s.meddelanden(bo.id)).slice(-2).reverse();
    // Lyssnaren levererar bilden med båda på en gång: det senaste, och det näst senaste som raden inte har.
    await act(async () => lyssnare().onSenaste(bo.id, tva, ett));
    await waitFor(() => expect(boRad(result.current.rader, bo.id).olasta).toBe(2));
    expect(result.current.olasta).toBe(2);
  });

  it("⛔ BÖR 2: en annan enhet har läst samtalet, och nästa meddelande räknas mot det läsmärket", async () => {
    const { s, bo } = await underlag();
    const olasta = /** @type {number[]} */ ([]);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} onOlasta={(n) => olasta.push(n)} />);
    await waitFor(() => expect(radFor("Bo Lind").textContent).toContain("Hej Bo"));
    await act(async () => {
      await s.skicka(bo.id, { text: "Första", av: "bo" });
    });
    await waitFor(() => expect(olasta.at(-1)).toBe(1));
    // Telefonen läser samtalet: läsmärket flyttas förbi "Första".
    const forsta = (await s.meddelanden(bo.id)).at(-1);
    await act(async () => {
      await s.markeraLast(bo.id, "anna", forsta.tid);
    });
    await act(async () => {
      await s.skicka(bo.id, { text: "Andra", av: "bo" });
    });
    await waitFor(() => expect(radFor("Bo Lind").textContent).toContain("Andra"));
    // Sant: ett oläst ("Andra"). Utan läsmärket i räkningen: 2.
    await waitFor(() => expect(olasta.at(-1)).toBe(1));
  });

  it("⛔ BÖR 3: i det öppna samtalet blinkar räknaren inte till 1 för varje meddelande", async () => {
    const { s, bo } = await underlag();
    const olasta = /** @type {number[]} */ ([]);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={bo.id} onOlasta={(n) => olasta.push(n)} />);
    await waitFor(() => expect(screen.getAllByText("Hej Bo").length).toBeGreaterThan(0));
    for (const text of ["Ett", "Två", "Tre"]) {
      await act(async () => {
        await s.skicka(bo.id, { text, av: "bo" });
      });
      await waitFor(() => expect(screen.getAllByText(text).length).toBeGreaterThan(0));
      await new Promise((r) => setTimeout(r, 30));
    }
    // Golv: räknaren rapporterades, annars mäter provet ingenting.
    expect(olasta.length).toBeGreaterThan(0);
    expect(olasta.filter((n) => n !== 0)).toEqual([]);
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
    await act(async () => pa.onSenaste(samtal.id, { id: "m20", text: "Ny", av: "bo", tid: 20 }));
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
