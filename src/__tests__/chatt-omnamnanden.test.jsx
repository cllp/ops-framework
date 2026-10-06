import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla, harOmnamnanden, samtalsnotiser } from "../data/samtalskalla.js";
import { MAX_NAMNER, agentenNamnd, arNamnd, byggMeddelande, kravNamner, namnda } from "../lib/samtal.js";
import { samtalsregelfragment } from "../lib/regler.js";
import * as nod from "../node/index.js";

/**
 * Etapp 4 av chattens nattskiva: omnämnanden, @alla och @agent (chattanalysen 3.4).
 *
 * ⛔ HÄR MÄTS BETEENDE: formen prövas när meddelandet byggs, läsaren auktoriserar mot medlemskapet ("alla" expanderas vid läsning,
 * ett påhittat uid når ingen), agenten nämns via fältet och inte via texten, notisen "nämnd i gruppchatten" härleds, och @-listan
 * fungerar med tangentbordet. Reglerna mäts i `rules/__tests__/chattnatt.test.mjs`.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "cecilia", namn: "Cecilia Berg", typ: "person", status: "aktiv" },
  { userId: "david", namn: "David Ås", typ: "person", status: "avslutad" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];

describe("modellen", () => {
  it("⛔ formen: lista med uid, inga dubbletter, högst 20, och alla ensamt; tomt är inget fält", () => {
    expect(byggMeddelande({ text: "Hej", av: "anna", tid: 1 })).toEqual({ text: "Hej", av: "anna", tid: 1 });
    expect(byggMeddelande({ text: "Hej", av: "anna", tid: 1, namner: [] })).toEqual({ text: "Hej", av: "anna", tid: 1 });
    expect(byggMeddelande({ text: "@Bo", av: "anna", tid: 1, namner: ["bo"] }).namner).toEqual(["bo"]);
    expect(() => kravNamner(["bo", "bo"])).toThrow(/två gånger/);
    expect(() => kravNamner(["alla", "bo"])).toThrow(/ensamt/);
    expect(() => kravNamner(Array.from({ length: MAX_NAMNER + 1 }, (_, i) => `u${i}`))).toThrow(/taket/);
    expect(() => kravNamner("bo")).toThrow(/lista/);
  });
  it("⛔ läsaren auktoriserar: bara aktiva medlemmar, och alla blir gruppens aktiva personer utom avsändaren", () => {
    expect(namnda({ av: "anna", namner: ["bo", "david", "påhittad", "ops"] }, MEDLEMMAR)).toEqual(["bo", "ops"]);
    expect(namnda({ av: "anna", namner: ["alla"] }, MEDLEMMAR)).toEqual(["bo", "cecilia"]);
    expect(arNamnd({ av: "anna", namner: ["alla"] }, "cecilia", MEDLEMMAR)).toBe(true);
    expect(arNamnd({ av: "anna", namner: ["alla"] }, "anna", MEDLEMMAR)).toBe(false);
    expect(arNamnd({ av: "anna", namner: ["alla"] }, "david", MEDLEMMAR)).toBe(false);
    expect(namnda({ av: "anna" }, MEDLEMMAR)).toEqual([]);
  });
  it("⛔ agenten nämns via fältet, aldrig via texten, och alla väcker den inte; node-delen har samma funktion", () => {
    expect(agentenNamnd({ text: "@Ops-agenten hej", av: "anna" }, "ops", MEDLEMMAR)).toBe(false);
    expect(agentenNamnd({ text: "hej", av: "anna", namner: ["ops"] }, "ops", MEDLEMMAR)).toBe(true);
    expect(agentenNamnd({ text: "hej", av: "anna", namner: ["alla"] }, "ops", MEDLEMMAR)).toBe(false);
    // En person med agentens uid i en annan grupp är ingen agent här.
    expect(agentenNamnd({ text: "hej", av: "anna", namner: ["bo"] }, "bo", MEDLEMMAR)).toBe(false);
    expect(nod.agentenNamnd).toBe(agentenNamnd);
  });
});

describe("källan och regeltexten", () => {
  it("⛔ utan omnamnanden: skicka med namner kastar, och regeltexten har inga namner", async () => {
    const s = createSamtalskalla({ kalla: createMemorySource({}) });
    expect(harOmnamnanden(s)).toBe(false);
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    await expect(s.skicka(g.id, { text: "@Bo", av: "anna", namner: ["bo"] })).rejects.toThrow(/kräver omnamnanden/);
    expect(samtalsregelfragment({ tradar: "tradar" })).not.toContain("namner");
    expect(() => samtalsregelfragment({ omnamnanden: /** @type {any} */ ("ja") })).toThrow(/true eller utelämnat/);
  });
  it("⛔ med omnamnanden: fältet skrivs, i samtalet och i tråden, och regeln prövar det på båda ställena", async () => {
    const kalla = createMemorySource({});
    const s = /** @type {any} */ (createSamtalskalla({ kalla, omnamnanden: true, tradar: "tradar" }));
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    const m = await s.skicka(g.id, { text: "@Bo titta", av: "anna", namner: ["bo"] });
    expect((await kalla.read(`samtal/${g.id}/meddelanden`, m.id))?.namner).toEqual(["bo"]);
    const t = await s.skickaITrad(g.id, m.id, { text: "@alla", av: "bo", namner: ["alla"] });
    expect(t.namner).toEqual(["alla"]);
    const r = samtalsregelfragment({ omnamnanden: true, tradar: "tradar" });
    expect(r.match(/hasOnly\(\["text", "av", "tid", "namner"\]\)\n\s+&& opsGiltigaNamner\(request\.resource\.data\)/g)).toHaveLength(2);
    expect(r).toContain(`d.namner.size() <= ${MAX_NAMNER}`);
  });
  it("⛔ notisen 'nämnd i gruppchatten': härledd, auktoriserad, och bara med medlemmarna", async () => {
    const kalla = createMemorySource({});
    let tid = Date.now() - 100000;
    const s = createSamtalskalla({ kalla, omnamnanden: true, klocka: () => (tid += 1000) });
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    await s.skicka(g.id, { text: "Hej alla", av: "bo" });
    const m = await s.skicka(g.id, { text: "@Cecilia Berg kan du?", av: "bo", namner: ["cecilia"] });
    await s.skicka(g.id, { text: "Påhittad", av: "bo", namner: ["anna-falsk"] });
    const namnFor = (/** @type {string} */ u) => MEDLEMMAR.find((x) => x.userId === u)?.namn ?? "";
    expect(await samtalsnotiser({ samtal: s, uid: "cecilia", namnFor })({ groupId: "g" })).toEqual([]);
    const n = await samtalsnotiser({ samtal: s, uid: "cecilia", namnFor, medlemmar: MEDLEMMAR })({ groupId: "g" });
    expect(n).toEqual([{ id: `${g.id}|${m.id}`, titel: "Bo Lind nämnde dig i gruppchatten", text: "@Cecilia Berg kan du?", prio: "normal" }]);
    expect(await samtalsnotiser({ samtal: s, uid: "anna", namnFor, medlemmar: MEDLEMMAR })({ groupId: "g" })).toEqual([]);
    await s.markeraLast(g.id, "cecilia", Date.now() + 10_000_000);
    expect(await samtalsnotiser({ samtal: s, uid: "cecilia", namnFor, medlemmar: MEDLEMMAR })({ groupId: "g" })).toEqual([]);
    await s.skicka(g.id, { text: "@alla möte", av: "anna", namner: ["alla"] });
    const alla = await samtalsnotiser({ samtal: s, uid: "bo", namnFor, medlemmar: MEDLEMMAR })({ groupId: "g" });
    expect(alla.map((x) => x.titel)).toEqual(["Anna Ek nämnde dig i gruppchatten"]);
  });
});

/** @param {{ omnamnanden?: boolean }} [val] */
async function underlag(val = { omnamnanden: true }) {
  const kalla = createMemorySource({});
  const s = /** @type {any} */ (createSamtalskalla({ kalla, ...(val.omnamnanden ? { omnamnanden: true } : {}) }));
  const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
  await s.skicka(g.id, { text: "Hej", av: "bo" });
  return { kalla, s, g };
}

describe("vyn: @-listan", () => {
  it("⛔ @ öppnar listan ur medlemmarna och agenten, pilar och Enter väljer, och namner skickas med", async () => {
    const { kalla, s, g } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    const ruta = /** @type {HTMLTextAreaElement} */ (await screen.findByRole("textbox", { name: "Skriv ett meddelande" }));
    fireEvent.change(ruta, { target: { value: "Fråga @", selectionStart: 7 } });
    const lista = await screen.findByRole("listbox", { name: "Nämn någon" });
    const namn = within(lista).getAllByRole("option").map((o) => o.textContent);
    expect(namn).toEqual(["@Bo Lind", "@Cecilia Berg", "Ops-agenten", "alla"]);
    expect(namn.some((x) => x?.includes("Anna") || x?.includes("David"))).toBe(false);
    expect(ruta.getAttribute("aria-activedescendant")).toBe(within(lista).getAllByRole("option")[0].id);
    fireEvent.change(ruta, { target: { value: "Fråga @op", selectionStart: 9 } });
    await waitFor(() => expect(within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Ops-agenten"]));
    fireEvent.keyDown(ruta, { key: "Enter" });
    expect(ruta.value).toBe("Fråga @Ops-agenten ");
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.change(ruta, { target: { value: "Fråga @Ops-agenten och @c", selectionStart: 26 } });
    await screen.findByRole("listbox");
    fireEvent.keyDown(ruta, { key: "Tab" });
    expect(ruta.value).toBe("Fråga @Ops-agenten och @Cecilia Berg ");
    fireEvent.keyDown(ruta, { key: "Enter" });
    await waitFor(async () => {
      const rader = await kalla.list(`samtal/${g.id}/meddelanden`);
      expect(rader.find((/** @type {any} */ r) => r.text.startsWith("Fråga"))?.namner).toEqual(["ops", "cecilia"]);
    });
  });
  it("⛔ ett omnämnande som raderats ur texten skickas inte, och alla står ensamt", async () => {
    const { kalla, s, g } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    const ruta = /** @type {HTMLTextAreaElement} */ (await screen.findByRole("textbox", { name: "Skriv ett meddelande" }));
    fireEvent.change(ruta, { target: { value: "@b", selectionStart: 2 } });
    await screen.findByRole("listbox");
    fireEvent.keyDown(ruta, { key: "Enter" });
    fireEvent.change(ruta, { target: { value: "Ingen nämnd längre", selectionStart: 18 } });
    fireEvent.keyDown(ruta, { key: "Enter" });
    await waitFor(async () => expect((await kalla.list(`samtal/${g.id}/meddelanden`)).some((/** @type {any} */ r) => r.text === "Ingen nämnd längre")).toBe(true));
    const utan = (await kalla.list(`samtal/${g.id}/meddelanden`)).find((/** @type {any} */ r) => r.text === "Ingen nämnd längre");
    expect(utan && "namner" in utan).toBe(false);
    fireEvent.change(ruta, { target: { value: "@b", selectionStart: 2 } });
    await screen.findByRole("listbox");
    fireEvent.keyDown(ruta, { key: "Enter" });
    fireEvent.change(ruta, { target: { value: "@Bo Lind och @al", selectionStart: 16 } });
    await screen.findByRole("listbox");
    fireEvent.keyDown(ruta, { key: "Enter" });
    fireEvent.keyDown(ruta, { key: "Enter" });
    await waitFor(async () => expect((await kalla.list(`samtal/${g.id}/meddelanden`)).find((/** @type {any} */ r) => r.text.startsWith("@Bo Lind och"))?.namner).toEqual(["alla"]));
  });
  it("⛔ Escape stänger listan utan att skicka", async () => {
    const { kalla, s, g } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    const ruta = /** @type {HTMLTextAreaElement} */ (await screen.findByRole("textbox", { name: "Skriv ett meddelande" }));
    fireEvent.change(ruta, { target: { value: "@c", selectionStart: 2 } });
    await screen.findByRole("listbox");
    fireEvent.keyDown(ruta, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect((await kalla.list(`samtal/${g.id}/meddelanden`))).toHaveLength(1);
  });
  it("⛔ utan omnamnanden, och i ett privat samtal: ingen lista", async () => {
    const { s, g } = await underlag({ omnamnanden: false });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    const ruta = await screen.findByRole("textbox", { name: "Skriv ett meddelande" });
    fireEvent.change(ruta, { target: { value: "@b", selectionStart: 2 } });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("⛔ i ett privat samtal finns ingen att nämna", async () => {
    const { s } = await underlag();
    const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} />);
    const ruta = await screen.findByRole("textbox", { name: "Skriv ett meddelande" });
    fireEvent.change(ruta, { target: { value: "@b", selectionStart: 2 } });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
