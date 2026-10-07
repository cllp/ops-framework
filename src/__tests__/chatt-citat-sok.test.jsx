import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla, harCitat } from "../data/samtalskalla.js";
import { byggMeddelande } from "../lib/samtal.js";
import { samtalsregelfragment } from "../lib/regler.js";

/**
 * Etapp 5 av chattens nattskiva: svar med citat i privata samtal (chattanalysen 3.3) och sök i det öppna samtalet.
 *
 * ⛔ HÄR MÄTS BETEENDE: bara id:t lagras och citatet härleds, ett citat som inte går att läsa sägs ut, citat finns inte i gruppchatten,
 * och sökningen hittar, bläddrar och säger hur långt den når. Reglerna mäts i `rules/__tests__/chattnatt.test.mjs`.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];

/** @param {{ citat?: boolean }} [val] */
async function underlag(val = { citat: true }) {
  const kalla = createMemorySource({});
  let t = Date.now() - 100000;
  const s = /** @type {any} */ (createSamtalskalla({ kalla, klocka: () => (t += 1000), ...(val.citat ? { citat: true } : {}) }));
  const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  const fraga = await s.skicka(p.id, { text: "Kan du titta på fakturan från Bokio innan fredag?", av: "bo" });
  await s.skicka(p.id, { text: "Och momsen för augusti.", av: "bo" });
  return { kalla, s, p, fraga };
}

describe("modellen och källan", () => {
  it("⛔ svarPa är ett id, ingen kopia av texten; utan citat kastar källan", async () => {
    expect(byggMeddelande({ text: "Ja", av: "anna", tid: 1, svarPa: "m1" })).toEqual({ text: "Ja", av: "anna", tid: 1, svarPa: "m1" });
    expect(() => byggMeddelande({ text: "Ja", av: "anna", tid: 1, svarPa: "a/b" })).toThrow();
    const { s, p, fraga } = await underlag({ citat: false });
    expect(harCitat(s)).toBe(false);
    await expect(s.skicka(p.id, { text: "Ja", av: "anna", svarPa: fraga.id })).rejects.toThrow(/kräver citat/);
  });
  it("⛔ regeln: bara utanför gruppchatten, bara ett meddelande i samma samtal, och inte i tråden", () => {
    expect(samtalsregelfragment({ tradar: "tradar" })).not.toContain("svarPa");
    const r = samtalsregelfragment({ citat: true, tradar: "tradar" });
    expect(r).toContain("get(opsSamtalet(sid)).data.slag != 'grupp'");
    expect(r).toContain("exists(/databases/$(database)/documents/samtal/$(sid)/meddelanden/$(d.svarPa))");
    expect(r.match(/"svarPa"\]/g)).toHaveLength(1);
  });
});

describe("vyn: citat", () => {
  it("⛔ Svara med citat: raden ovanför fältet, svaret bär id:t, och citatet härleds ur det besvarade", async () => {
    const { kalla, s, p, fraga } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} />);
    const logg = await screen.findByRole("log");
    await within(logg).findByText(fraga.text);
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector(`[data-citera="${fraga.id}"]`)));
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-svarar-pa]"));
    expect(rad.textContent).toContain("Svarar på Bo Lind: Kan du titta på fakturan");
    const ruta = screen.getByRole("textbox", { name: "Skriv ett meddelande" });
    expect(document.activeElement).toBe(ruta);
    fireEvent.change(ruta, { target: { value: "Ja, i eftermiddag" } });
    fireEvent.keyDown(ruta, { key: "Enter" });
    await waitFor(() => expect(document.querySelector("[data-svarar-pa]")).toBeNull());
    const svar = (await kalla.list(`samtal/${p.id}/meddelanden`)).find((/** @type {any} */ m) => m.text === "Ja, i eftermiddag");
    expect(svar).toMatchObject({ svarPa: fraga.id });
    expect(Object.keys(svar).sort()).toEqual(["av", "id", "svarPa", "text", "tid"]);
  });
  it("⛔ citatet ritas ur meddelandet, också när det inte är laddat, och ett som inte finns sägs ut", async () => {
    const { kalla, s, p, fraga } = await underlag();
    await kalla.create(`samtal/${p.id}/meddelanden`, { text: "Ja, gjort", av: "anna", tid: Date.now() - 5000, svarPa: fraga.id });
    await kalla.create(`samtal/${p.id}/meddelanden`, { text: "Vilket?", av: "anna", tid: Date.now() - 4000, svarPa: "borta" });
    const smal = /** @type {any} */ (createSamtalskalla({ kalla, citat: true, sida: 2 }));
    render(<OpsMeddelanden kalla={smal} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} />);
    const logg = await screen.findByRole("log");
    await within(logg).findByText("Vilket?");
    await waitFor(() => expect(document.querySelector(`[data-citat="${fraga.id}"]`)?.textContent).toBe("Bo Lind: Kan du titta på fakturan från Bokio innan fredag?"));
    await waitFor(() => expect(document.querySelector('[data-citat="borta"]')?.textContent).toBe("Meddelandet går inte att läsa."));
    void s;
  });
  it("⛔ Escape och krysset avbryter citatet", async () => {
    const { s, p, fraga } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} />);
    await within(await screen.findByRole("log")).findByText(fraga.text);
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector(`[data-citera="${fraga.id}"]`)));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), { key: "Escape" });
    expect(document.querySelector("[data-svarar-pa]")).toBeNull();
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector(`[data-citera="${fraga.id}"]`)));
    fireEvent.click(screen.getByRole("button", { name: "Avbryt citatet" }));
    expect(document.querySelector("[data-svarar-pa]")).toBeNull();
  });
  it("⛔ ingen citatknapp i gruppchatten, och ingen utan citat i källan", async () => {
    const { s } = await underlag();
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    await s.skicka(g.id, { text: "Hej gruppen", av: "bo" });
    const { unmount } = render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    await within(await screen.findByRole("log")).findByText("Hej gruppen");
    expect(document.querySelector("[data-citera]")).toBeNull();
    unmount();
    const utan = await underlag({ citat: false });
    render(<OpsMeddelanden kalla={utan.s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={utan.p.id} />);
    await within(await screen.findByRole("log")).findByText(utan.fraga.text);
    expect(document.querySelectorAll("[data-bubbla]").length).toBe(2); // golv
    expect(document.querySelector("[data-citera]")).toBeNull();
  });
});

describe("vyn: sök i samtalet", () => {
  it("⛔ hittar bland de laddade, markerar den aktuella, bläddrar, och säger noll", async () => {
    const { s, p } = await underlag();
    await s.skicka(p.id, { text: "Fakturan är betald", av: "anna" });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} />);
    await within(await screen.findByRole("log")).findByText("Fakturan är betald");
    fireEvent.click(screen.getByRole("button", { name: "Sök i samtalet" }));
    const falt = screen.getByRole("searchbox", { name: "Sök i samtalet" });
    expect(document.activeElement).toBe(falt);
    fireEvent.change(falt, { target: { value: "faktura" } });
    expect(document.querySelector("[data-sok-plats]")?.textContent).toBe("1 av 2");
    expect(document.querySelectorAll('[data-traff="traff"], [data-traff="aktuell"]')).toHaveLength(2);
    expect(document.querySelector('[data-traff="aktuell"]')?.textContent).toBe("Fakturan är betald");
    fireEvent.keyDown(falt, { key: "Enter" });
    expect(document.querySelector("[data-sok-plats]")?.textContent).toBe("2 av 2");
    expect(document.querySelector('[data-traff="aktuell"]')?.textContent).toContain("Kan du titta på fakturan");
    fireEvent.click(screen.getByRole("button", { name: "Nästa träff" }));
    expect(document.querySelector('[data-traff="aktuell"]')?.textContent).toBe("Fakturan är betald");
    fireEvent.change(falt, { target: { value: "semester" } });
    expect(document.querySelector("[data-sok-ingen]")?.textContent).toBe("Ingen träff bland de laddade meddelandena.");
    fireEvent.keyDown(falt, { key: "Escape" });
    expect(screen.queryByRole("searchbox", { name: "Sök i samtalet" })).toBeNull();
    expect(document.querySelector("[data-traff]")).toBeNull();
  });
  it("⛔ när äldre finns säger sökningen hur långt den når", async () => {
    const kalla = createMemorySource({});
    let t = Date.now() - 1000000;
    const s = /** @type {any} */ (createSamtalskalla({ kalla, klocka: () => (t += 1000), sida: 3 }));
    const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
    for (let i = 1; i <= 5; i += 1) await s.skicka(p.id, { text: `Rad ${i}`, av: "bo" });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} />);
    await within(await screen.findByRole("log")).findByText("Rad 5");
    fireEvent.click(screen.getByRole("button", { name: "Sök i samtalet" }));
    expect(document.querySelector("[data-sok-omfang]")?.textContent).toBe("Söker bland de 3 laddade meddelandena. Visa äldre för att söka längre bak.");
  });
});
