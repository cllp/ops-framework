import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla, harOmrostningar } from "../data/samtalskalla.js";
import {
  MAX_ALTERNATIV,
  MAX_ALTERNATIVTEXT,
  MAX_FRAGA,
  OMROSTNINGSROSTFALT,
  OMROSTNINGSTAK,
  OMROSTNINGSVALFALT,
  OMROSTNINGSVAL_REGEL,
  byggMeddelande,
  byggOmrostningsmeddelande,
  byggOmrostningsrost,
  byggOmrostningsval,
  omrostningsrostnyckel,
  summeraOmrostning,
} from "../lib/samtal.js";
import { samtalsregelfragment } from "../lib/regler.js";
import { levandeKalla } from "./levandeKalla.js";

/**
 * Omröstningar i chatten, skiva 1 (cllp/lifehub.app#438). CP 2026-10-22 och 10-23: ett kort i flödet med frågan och alternativen,
 * ansikten och "+N" för vem som röstat, Lägg till alternativ för alla, och rösta, byta och ta tillbaka som Facebooks omröstning.
 *
 * ⛔ HÄR MÄTS BETEENDE: nycklarna bär unikheten, antalet räknas fram ur raderna, en tryckning väljer rätt skrivning, formuläret säger
 * sina fel innan något skickas, och utan nycklarna finns ingenting av det. Reglerna mäts i `rules/__tests__/chattnatt.test.mjs`.
 */

describe("modellen", () => {
  it("⛔ en omröstning är ett meddelande vars text är frågan, och alternativen prövas: två till tio, inga lika", () => {
    const o = byggOmrostningsmeddelande({ fraga: "  Vilken dag?  ", alternativ: [" Fredag ", "Lördag \u{1F468}\u200d\u{1F469}\u200d\u{1F467}"], av: "anna", tid: 5 });
    expect(o.meddelande).toEqual({ text: "Vilken dag?", av: "anna", tid: 5, omrostning: true });
    expect(o.alternativ).toEqual(["Fredag", "Lördag \u{1F468}\u200d\u{1F469}\u200d\u{1F467}"]);
    expect(() => byggOmrostningsmeddelande({ fraga: "Dag?", alternativ: ["Fredag"], av: "anna" })).toThrow(/minst 2/);
    expect(() => byggOmrostningsmeddelande({ fraga: "Dag?", alternativ: Array.from({ length: 11 }, (_, i) => `D${i}`), av: "anna" })).toThrow(/Högst 10/);
    expect(() => byggOmrostningsmeddelande({ fraga: "Dag?", alternativ: ["Fredag", " fredag"], av: "anna" })).toThrow(/två gånger/);
    expect(() => byggOmrostningsmeddelande({ fraga: "", alternativ: ["a", "b"], av: "anna" })).toThrow(/frågan är tom/);
    expect(() => byggOmrostningsmeddelande({ fraga: "x".repeat(MAX_FRAGA + 1), alternativ: ["a", "b"], av: "anna" })).toThrow(/taket är 200/);
    expect(byggOmrostningsmeddelande({ fraga: "x".repeat(MAX_FRAGA), alternativ: ["a", "b"], av: "anna" }).meddelande.text).toHaveLength(MAX_FRAGA);
    expect(() => byggOmrostningsmeddelande({ fraga: "Dag?", alternativ: ["a", "x".repeat(MAX_ALTERNATIVTEXT + 1)], av: "anna" })).toThrow(/taket är 120/);
  });
  it("⛔ dolda tecken nekas i frågan och alternativen: radbrytning, tabb, nollbredd och riktningsmarkering", () => {
    for (const dolt of ["Två\nrader", "Tabb\there", "Noll\u200bbredd", "Vänd\u202etexten", "Mjukt\u00adbindestreck"]) {
      expect(() => byggOmrostningsmeddelande({ fraga: dolt, alternativ: ["a", "b"], av: "anna" })).toThrow(/dolt tecken/);
      expect(() => byggOmrostningsval({ mid: "m1", text: dolt, av: "anna" })).toThrow(/dolt tecken/);
    }
  });
  it("⛔ byggMeddelande: en omröstning bär ingen bilaga, omrostning är true eller utelämnat, och utan den är meddelandet som förut", () => {
    const bilaga = { dataUrl: "data:image/png;base64,AAAA", namn: "a.png", typ: "image/png", tecken: 26 };
    expect(() => byggMeddelande({ text: "Dag?", av: "anna", omrostning: true, bilaga })).toThrow(/ingen bilaga/);
    expect(() => byggMeddelande({ text: "Dag?", av: "anna", omrostning: /** @type {any} */ ("ja") })).toThrow(/true eller utelämnat/);
    expect(Object.keys(byggMeddelande({ text: "Hej", av: "anna", tid: 1 })).sort()).toEqual(["av", "text", "tid"]);
    expect(Object.keys(byggMeddelande({ text: "Hej", av: "anna", tid: 1, omrostning: false })).sort()).toEqual(["av", "text", "tid"]);
    // Ett vanligt meddelande får fortfarande radbrytningar: det hårdare kravet gäller bara frågan.
    expect(byggMeddelande({ text: "Rad ett\nrad två", av: "anna", tid: 1 }).text).toBe("Rad ett\nrad två");
  });
  it("⛔ ett alternativ har nyckeln mid|stycke, och med befintliga prövas taket och dubbletten", () => {
    const v = byggOmrostningsval({ mid: "m1", text: " Fredag ", av: "anna", tid: 7, stycke: "a" });
    expect(v).toEqual({ id: "m1|a", mid: "m1", text: "Fredag", av: "anna", tid: 7 });
    expect(Object.keys(v).filter((k) => k !== "id").sort()).toEqual([...OMROSTNINGSVALFALT].sort());
    const slumpad = byggOmrostningsval({ mid: "m1", text: "Lördag", av: "anna", tid: 7 });
    expect(slumpad.id.startsWith("m1|")).toBe(true);
    expect(new RegExp(`^${OMROSTNINGSVAL_REGEL}$`).test(slumpad.id.slice(3))).toBe(true);
    expect(() => byggOmrostningsval({ mid: "m1", text: "x", av: "anna", stycke: "a b" })).toThrow(/formen/);
    expect(() => byggOmrostningsval({ mid: "m|1", text: "x", av: "anna" })).toThrow(/inget meddelandes id/);
    expect(() => byggOmrostningsval({ mid: "m1", text: "fredag", av: "anna", befintliga: ["Fredag"] })).toThrow(/finns redan/);
    const fulla = Array.from({ length: MAX_ALTERNATIV }, (_, i) => `D${i}`);
    expect(() => byggOmrostningsval({ mid: "m1", text: "Ny", av: "anna", befintliga: fulla })).toThrow(/Taket är 20/);
    expect(byggOmrostningsval({ mid: "m1", text: "Ny", av: "anna", befintliga: fulla.slice(1) }).text).toBe("Ny");
  });
  it("⛔ en röst har nyckeln mid|uid, och valet är ett alternativ i samma omröstning", () => {
    expect(omrostningsrostnyckel({ mid: "m1", av: "bo" })).toBe("m1|bo");
    const r = byggOmrostningsrost({ mid: "m1", av: "bo", val: "m1|a", tid: 9 });
    expect(r).toEqual({ id: "m1|bo", mid: "m1", av: "bo", val: "m1|a", tid: 9 });
    expect(Object.keys(r).filter((k) => k !== "id").sort()).toEqual([...OMROSTNINGSROSTFALT].sort());
    expect(() => byggOmrostningsrost({ mid: "m1", av: "bo", val: "m2|a" })).toThrow(/inget alternativ i omröstningen m1/);
    expect(() => byggOmrostningsrost({ mid: "m1", av: "bo", val: "a" })).toThrow(/inget alternativ/);
    expect(() => byggOmrostningsrost({ mid: "m1", av: "b|o", val: "m1|a" })).toThrow(/avgränsare/);
  });
  it("⛔ summeringen: alternativen i den ordning de lades till, antal, egen, vilka, och totalen", () => {
    const val = [
      { id: "m1|b", mid: "m1", text: "Lördag", tid: 20 },
      { id: "m1|a", mid: "m1", text: "Fredag", tid: 10 },
      { id: "m1|c", mid: "m1", text: "Söndag", tid: 30 },
    ];
    const roster = [
      { mid: "m1", av: "bo", val: "m1|a", tid: 5 },
      { mid: "m1", av: "anna", val: "m1|a", tid: 3 },
      { mid: "m1", av: "cecilia", val: "m1|b", tid: 4 },
    ];
    const s = summeraOmrostning(val, roster, "anna");
    expect(s.alternativ.map((a) => [a.text, a.antal, a.egen, [...a.roster]])).toEqual([
      ["Fredag", 2, true, ["anna", "bo"]],
      ["Lördag", 1, false, ["cecilia"]],
      ["Söndag", 0, false, []],
    ]);
    expect(s.antalRostande).toBe(3);
    expect(s.egetVal).toBe("m1|a");
  });
  it("⛔ summeringen litar inte på raderna: okända val, en annan omröstning, trasiga rader och samma person två gånger", () => {
    const val = [{ id: "m1|a", mid: "m1", text: "Fredag", tid: 1 }, { id: "m1|x", mid: "m1", tid: 2 }, { mid: "m1", text: "Utan id", tid: 3 }];
    const roster = [
      { mid: "m1", av: "bo", val: "m1|okand", tid: 1 },
      { mid: "m2", av: "cecilia", val: "m1|a", tid: 1 },
      { mid: "m1", val: "m1|a", tid: 1 },
      { mid: "m1", av: "david", val: "m1|x", tid: 1 },
      { mid: "m1", av: "erik", val: "m1|a", tid: 1 },
      { mid: "m1", av: "erik", val: "m1|a", tid: 2 },
    ];
    const s = summeraOmrostning(val, roster, "anna");
    expect(s.alternativ.map((a) => a.id)).toEqual(["m1|a"]);
    expect(s.alternativ[0].antal).toBe(1);
    expect(s.antalRostande).toBe(1);
    expect(s.egetVal).toBeNull();
    // Golvet: en tom omröstning är noll, inte ett fel.
    expect(summeraOmrostning([], [], "anna")).toEqual({ alternativ: [], antalRostande: 0, egetVal: null });
  });
});

describe("källan och regeltexten", () => {
  it("⛔ utan nycklarna: inga funktioner och ingen regeltext om omröstningar, och en nyckel ensam kastar", () => {
    const k = createSamtalskalla({ kalla: createMemorySource({}), reaktioner: "reaktioner" });
    expect(harOmrostningar(k)).toBe(false);
    const utan = samtalsregelfragment({ reaktioner: "reaktioner", tradar: "tradar" });
    expect(utan).not.toContain("omrostning");
    expect(() => createSamtalskalla({ kalla: createMemorySource({}), omrostningsval: "omrostningsval" })).toThrow(/tillsammans/);
    expect(() => samtalsregelfragment({ omrostningsroster: "omrostningsroster" })).toThrow(/tillsammans/);
    expect(() => samtalsregelfragment({ omrostningsval: "reaktioner", omrostningsroster: "r", reaktioner: "reaktioner" })).toThrow(/krockar med reaktioner/);
  });
  it("⛔ regeln bär fälten, taken och nyckelns form ur modellen, och omröstningen bara på samtalets meddelanden", () => {
    const r = samtalsregelfragment({ omrostningsval: "omrostningsval", omrostningsroster: "omrostningsroster", tradar: "tradar" });
    expect(r).toContain(`d.keys().hasOnly([${OMROSTNINGSVALFALT.map((f) => `"${f}"`).join(", ")}])`);
    expect(r).toContain(`d.keys().hasOnly([${OMROSTNINGSROSTFALT.map((f) => `"${f}"`).join(", ")}])`);
    expect(r).toContain(`d.text.size() <= ${MAX_FRAGA}`);
    expect(r).toContain(`d.text.size() <= ${MAX_ALTERNATIVTEXT}`);
    expect(r).toContain(`.matches('${OMROSTNINGSVAL_REGEL}')`);
    expect(r).toContain("rid == d.mid + '|' + d.av");
    expect(r).toContain("match /omrostningsval/{vid} {");
    expect(r).toContain("match /omrostningsroster/{rid} {");
    // Samtalets meddelanden bär fältet, trådens gör det inte.
    expect(r).toContain('hasOnly(["text", "av", "tid", "omrostning"])');
    expect(r).toContain('hasOnly(["text", "av", "tid"])\n            && request.resource.data.av');
  });
  it("skickaOmrostning skriver frågan och alternativen i EN batch, alternativen i skrivordning", async () => {
    const bas = createMemorySource({});
    /** @type {any[]} */
    const batcher = [];
    const kalla = { ...bas, batch: (/** @type {any} */ ops) => (batcher.push(ops), /** @type {any} */ (bas).batch(ops)) };
    let t = 1000;
    const s = /** @type {any} */ (createSamtalskalla({ kalla, klocka: () => (t += 1), omrostningsval: "omrostningsval", omrostningsroster: "omrostningsroster" }));
    expect(harOmrostningar(s)).toBe(true);
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    const m = await s.skickaOmrostning(g.id, { fraga: "Vilken dag?", alternativ: ["Fredag", "Lördag", "Söndag"], av: "anna" });
    expect(batcher).toHaveLength(1);
    const [fraga, ...val] = batcher[0];
    expect(fraga).toEqual({ op: "create", collection: `samtal/${g.id}/meddelanden`, data: { id: m.id, text: "Vilken dag?", av: "anna", tid: m.tid, omrostning: true } });
    expect(val.map((/** @type {any} */ o) => [o.collection, o.data.mid, o.data.text, o.data.tid - m.tid])).toEqual([
      [`samtal/${g.id}/omrostningsval`, m.id, "Fredag", 1],
      [`samtal/${g.id}/omrostningsval`, m.id, "Lördag", 2],
      [`samtal/${g.id}/omrostningsval`, m.id, "Söndag", 3],
    ]);
    for (const o of val) expect(o.data.id.startsWith(`${m.id}|`)).toBe(true);
    const lasta = await s.lasOmrostningsval(g.id);
    expect(summeraOmrostning(lasta.rader, [], "anna").alternativ.map((a) => a.text)).toEqual(["Fredag", "Lördag", "Söndag"]);
    // Utan batch skrivs ingenting.
    const utanBatch = /** @type {any} */ (createSamtalskalla({ kalla: { ...bas, batch: undefined }, omrostningsval: "omrostningsval", omrostningsroster: "omrostningsroster" }));
    await expect(utanBatch.skickaOmrostning(g.id, { fraga: "Dag?", alternativ: ["a", "b"], av: "anna" })).rejects.toThrow(/kräver kalla.batch/);
  });
  it("rosta skapar mid|uid, andraRost skriver bara val och tid, taBortRost tar bort den egna, och laggTillAlternativ prövar befintliga", async () => {
    const bas = createMemorySource({});
    /** @type {any[]} */
    const andringar = [];
    const kalla = { ...bas, update: (/** @type {any[]} */ ...a) => (andringar.push(a), bas.update(a[0], a[1], a[2])) };
    const s = /** @type {any} */ (createSamtalskalla({ kalla, omrostningsval: "omrostningsval", omrostningsroster: "omrostningsroster" }));
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    const m = await s.skickaOmrostning(g.id, { fraga: "Dag?", alternativ: ["Fredag", "Lördag"], av: "anna" });
    const [a, b] = summeraOmrostning((await s.lasOmrostningsval(g.id)).rader, [], "bo").alternativ;
    await s.rosta(g.id, { mid: m.id, val: a.id, av: "bo" });
    expect((await s.lasOmrostningsroster(g.id)).rader.map((/** @type {any} */ r) => [r.id, r.val])).toEqual([[`${m.id}|bo`, a.id]]);
    await s.andraRost(g.id, { mid: m.id, val: b.id, av: "bo" });
    expect(andringar).toHaveLength(1);
    expect(andringar[0][0]).toBe(`samtal/${g.id}/omrostningsroster`);
    expect(andringar[0][1]).toBe(`${m.id}|bo`);
    expect(Object.keys(andringar[0][2]).sort()).toEqual(["tid", "val"]);
    expect(andringar[0][2].val).toBe(b.id);
    await s.taBortRost(g.id, { mid: m.id, av: "bo" });
    expect((await s.lasOmrostningsroster(g.id)).rader).toHaveLength(0);
    await s.laggTillAlternativ(g.id, { mid: m.id, text: "Söndag", av: "bo", befintliga: ["Fredag", "Lördag"] });
    expect((await s.lasOmrostningsval(g.id)).rader).toHaveLength(3);
    await expect(s.laggTillAlternativ(g.id, { mid: m.id, text: "fredag", av: "bo", befintliga: ["Fredag"] })).rejects.toThrow(/finns redan/);
  });
  it("⛔ en lyssnare per samling och samtal, med taket", async () => {
    const bas = levandeKalla();
    /** @type {any[]} */
    const fragor = [];
    const kalla = { ...bas, subscribe: (/** @type {string} */ c, /** @type {any} */ q, /** @type {any} */ l) => (fragor.push([c, q]), bas.subscribe(c, q, l)) };
    const s = /** @type {any} */ (createSamtalskalla({ kalla, omrostningsval: "val", omrostningsroster: "roster" }));
    /** @type {any[]} */
    const svar = [];
    s.prenumereraOmrostningsval("g|grupp", { onData: (/** @type {any} */ x) => svar.push(x), onError: () => {} });
    s.prenumereraOmrostningsroster("g|grupp", { onData: (/** @type {any} */ x) => svar.push(x), onError: () => {} });
    await waitFor(() => expect(svar).toHaveLength(2));
    const q = { sortBy: "tid", direction: "desc", limit: OMROSTNINGSTAK };
    expect(fragor).toEqual([["samtal/g|grupp/val", q], ["samtal/g|grupp/roster", q]]);
  });
});

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "cecilia", namn: "Cecilia Ny", typ: "person", status: "aktiv" },
  { userId: "david", namn: "David Al", typ: "person", status: "aktiv" },
  { userId: "erik", namn: "Erik Ås", typ: "person", status: "aktiv" },
];

/** @param {{ omrostningar?: boolean, bilagor?: boolean }} [val] */
async function underlag(val = { omrostningar: true }) {
  const kalla = levandeKalla();
  let t = Date.now() - 100000;
  const s = /** @type {any} */ (
    createSamtalskalla({
      kalla,
      klocka: () => (t += 1000),
      ...(val.omrostningar ? { omrostningsval: "omrostningsval", omrostningsroster: "omrostningsroster" } : {}),
      ...(val.bilagor ? { bilagor: true, bilagaSamling: "bilagor" } : {}),
    })
  );
  const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
  await s.skicka(g.id, { text: "Hej alla", av: "bo" });
  return { kalla, s, g };
}

/**
 * En omröstning av Bo med två alternativ och fem röster på Fredag (Bo, Cecilia, David, Erik och en som inte är medlem), skrivna med källan.
 * @param {any} s @param {string} sid
 */
async function medRoster(s, sid) {
  const m = await s.skickaOmrostning(sid, { fraga: "Vilken dag?", alternativ: ["Fredag", "Lördag"], av: "bo" });
  const [fre, lor] = summeraOmrostning((await s.lasOmrostningsval(sid)).rader, [], "anna").alternativ;
  for (const u of ["bo", "cecilia", "david", "erik", "frida"]) await s.rosta(sid, { mid: m.id, val: fre.id, av: u });
  return { m, fre, lor };
}

/**
 * Kortet, när det ritats. ⛔ `waitFor` väntar bara på ett kast, så en tom träff kastar här i stället för att lösa med `null`.
 * @param {string} [mid]
 * @returns {Promise<HTMLElement>}
 */
const hittaKort = (mid) =>
  waitFor(() => {
    const k = document.querySelector(mid ? `[data-omrostning="${mid}"]` : "[data-omrostning]");
    if (!(k instanceof HTMLElement)) throw new Error("inget kort än");
    return k;
  });

describe("vyn", () => {
  it("⛔ utan omröstningar i källan: inget plus (utan bilagor), och en omröstning står som en vanlig bubbla med frågan", async () => {
    const med = await underlag();
    await med.s.skickaOmrostning(med.g.id, { fraga: "Vilken dag?", alternativ: ["Fredag", "Lördag"], av: "bo" });
    // Samma data, läst av en källa utan nycklarna: en app som inte slagit på omröstningarna, eller gästens chatt.
    const utan = /** @type {any} */ (createSamtalskalla({ kalla: med.kalla }));
    render(<OpsMeddelanden kalla={utan} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={med.g.id} />);
    const logg = await screen.findByRole("log");
    await within(logg).findByText("Vilken dag?");
    expect(document.querySelector("[data-omrostning]")).toBeNull();
    expect(document.querySelectorAll("[data-bubbla]").length).toBe(2); // golv: båda meddelandena står där
    expect(document.querySelector("[data-plus]")).toBeNull();
  });
  it("⛔ pluset har Omröstning, och formuläret skickar frågan och alternativen till källan", async () => {
    const { s, g } = await underlag();
    const skickaOmrostning = vi.fn(s.skickaOmrostning);
    render(<OpsMeddelanden kalla={{ ...s, skickaOmrostning }} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Bifoga" }));
    // Utan bilagor står bara omröstningen i menyn.
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((r) => r.textContent)).toEqual(["Omröstning"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Omröstning" }));
    const formular = await screen.findByRole("form", { name: "Ny omröstning" });
    fireEvent.change(within(formular).getByLabelText("Fråga"), { target: { value: "Vilken dag?" } });
    fireEvent.change(within(formular).getByLabelText("Alternativ 1"), { target: { value: "Fredag" } });
    fireEvent.change(within(formular).getByLabelText("Alternativ 2"), { target: { value: "Lördag" } });
    fireEvent.click(within(formular).getByRole("button", { name: "Lägg till alternativ" }));
    fireEvent.change(within(formular).getByLabelText("Alternativ 3"), { target: { value: "Söndag" } });
    fireEvent.click(within(formular).getByRole("button", { name: "Skicka" }));
    await waitFor(() => expect(skickaOmrostning).toHaveBeenCalledTimes(1));
    expect(skickaOmrostning).toHaveBeenCalledWith(g.id, { fraga: "Vilken dag?", alternativ: ["Fredag", "Lördag", "Söndag"], av: "anna" });
    await waitFor(() => expect(screen.queryByRole("form", { name: "Ny omröstning" })).toBeNull());
    const kort = await hittaKort();
    expect(within(kort).getByText("Vilken dag?")).toBeTruthy();
    await within(kort).findByRole("button", { name: "Söndag, 0 röster" });
  });
  it("⛔ pluset med bilagor har filerna och omröstningen", async () => {
    const { s, g } = await underlag({ omrostningar: true, bilagor: true });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Bifoga" }));
    const rader = within(screen.getByRole("menu")).getAllByRole("menuitem").map((r) => r.getAttribute("data-plusrad"));
    expect(rader).toContain("fil");
    expect(rader).toContain("omrostning");
  });
  it("⛔ formuläret säger sina fel och skickar ingenting: ingen fråga, ett alternativ, två lika", async () => {
    const { s, g } = await underlag();
    const skickaOmrostning = vi.fn(s.skickaOmrostning);
    render(<OpsMeddelanden kalla={{ ...s, skickaOmrostning }} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Bifoga" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Omröstning" }));
    const formular = await screen.findByRole("form", { name: "Ny omröstning" });
    const skicka = within(formular).getByRole("button", { name: "Skicka" });
    fireEvent.click(skicka);
    expect((await within(formular).findByRole("alert")).textContent).toBe("Skriv en fråga.");
    fireEvent.change(within(formular).getByLabelText("Fråga"), { target: { value: "Vilken dag?" } });
    fireEvent.change(within(formular).getByLabelText("Alternativ 1"), { target: { value: "Fredag" } });
    fireEvent.click(skicka);
    await waitFor(() => expect(within(formular).getByRole("alert").textContent).toBe("Skriv minst två alternativ."));
    fireEvent.change(within(formular).getByLabelText("Alternativ 2"), { target: { value: " fredag" } });
    fireEvent.click(skicka);
    await waitFor(() => expect(within(formular).getByRole("alert").textContent).toBe("Två alternativ har samma text."));
    // ⛔ Granskningen av PR 566: samma jämförelse som byggaren, så två mellanslag inne i texten är samma alternativ och inte ett allmänt fel.
    fireEvent.change(within(formular).getByLabelText("Alternativ 1"), { target: { value: "Fre dag" } });
    fireEvent.change(within(formular).getByLabelText("Alternativ 2"), { target: { value: "fre  dag" } });
    fireEvent.click(skicka);
    await waitFor(() => expect(within(formular).getByRole("alert").textContent).toBe("Två alternativ har samma text."));
    fireEvent.change(within(formular).getByLabelText("Alternativ 2"), { target: { value: "x".repeat(MAX_ALTERNATIVTEXT + 1) } });
    fireEvent.click(skicka);
    await waitFor(() => expect(within(formular).getByRole("alert").textContent).toBe("Högst 120 tecken."));
    expect(skickaOmrostning).not.toHaveBeenCalled();
    fireEvent.click(within(formular).getByRole("button", { name: "Avbryt" }));
    expect(screen.queryByRole("form", { name: "Ny omröstning" })).toBeNull();
  });
  it("⛔ kortet: antal, tre ansikten och +N, och hur många som röstat", async () => {
    const { s, g } = await underlag();
    const { m } = await medRoster(s, g.id);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    const kort = await hittaKort(m.id);
    const fre = await within(kort).findByRole("button", { name: "Fredag, 5 röster" });
    expect(fre.getAttribute("aria-pressed")).toBe("false");
    const ansikten = /** @type {HTMLElement} */ (fre.querySelector("[data-ansikten]"));
    expect(ansikten.querySelectorAll("[data-fler-ansikten]")).toHaveLength(1);
    expect(ansikten.children).toHaveLength(4); // tre ansikten och +N
    expect(/** @type {HTMLElement} */ (ansikten.querySelector("[data-fler-ansikten]")).textContent).toBe("+2");
    const lor = within(kort).getByRole("button", { name: "Lördag, 0 röster" });
    expect(lor.querySelector("[data-ansikten]")).toBeNull();
    // Stapeln är andelen av dem som röstat: alla fem på Fredag.
    expect(/** @type {HTMLElement} */ (fre.querySelector("[data-stapel]")).style.width).toBe("100%");
    expect(/** @type {HTMLElement} */ (lor.querySelector("[data-stapel]")).style.width).toBe("0%");
    expect(/** @type {HTMLElement} */ (kort.querySelector("[data-omrostning-antal]")).textContent).toBe("5 har röstat");
  });
  it("⛔ en tryckning röstar, en annan rad byter, samma rad tar tillbaka: tre olika skrivningar", async () => {
    const { s, g } = await underlag();
    const { m, fre, lor } = await medRoster(s, g.id);
    const rosta = vi.fn(s.rosta);
    const andraRost = vi.fn(s.andraRost);
    const taBortRost = vi.fn(s.taBortRost);
    render(<OpsMeddelanden kalla={{ ...s, rosta, andraRost, taBortRost }} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    const kort = await hittaKort(m.id);
    fireEvent.click(await within(kort).findByRole("button", { name: "Lördag, 0 röster" }));
    await waitFor(() => expect(rosta).toHaveBeenCalledWith(g.id, { mid: m.id, val: lor.id, av: "anna" }));
    const min = await within(kort).findByRole("button", { name: "Lördag, 1 röst, du har röstat" });
    expect(min.getAttribute("aria-pressed")).toBe("true");
    expect(/** @type {HTMLElement} */ (min.querySelector("[data-stapel]")).style.width).toBe("17%");
    expect(/** @type {HTMLElement} */ (kort.querySelector("[data-omrostning-antal]")).textContent).toBe("6 har röstat");
    fireEvent.click(within(kort).getByRole("button", { name: "Fredag, 5 röster" }));
    await waitFor(() => expect(andraRost).toHaveBeenCalledWith(g.id, { mid: m.id, val: fre.id, av: "anna" }));
    const bytt = await within(kort).findByRole("button", { name: "Fredag, 6 röster, du har röstat" });
    fireEvent.click(bytt);
    await waitFor(() => expect(taBortRost).toHaveBeenCalledWith(g.id, { mid: m.id, av: "anna" }));
    await within(kort).findByRole("button", { name: "Fredag, 5 röster" });
    expect(rosta).toHaveBeenCalledTimes(1);
    expect(andraRost).toHaveBeenCalledTimes(1);
  });
  it("⛔ ett andra tryck medan rösten skrivs släpps: en skrivning, inte en ny röst på ett gammalt val (granskningen av PR 566)", async () => {
    const { s, g } = await underlag();
    const { m, lor } = await medRoster(s, g.id);
    /** @type {() => void} */
    let slapp = () => {};
    const rosta = vi.fn(async (/** @type {any[]} */ ...a) => {
      await new Promise((r) => {
        slapp = () => r(undefined);
      });
      return s.rosta(...a);
    });
    const taBortRost = vi.fn(s.taBortRost);
    render(<OpsMeddelanden kalla={{ ...s, rosta, taBortRost }} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    const kort = await hittaKort(m.id);
    const knapp = await within(kort).findByRole("button", { name: "Lördag, 0 röster" });
    fireEvent.click(knapp);
    fireEvent.click(knapp);
    await waitFor(() => expect(rosta).toHaveBeenCalledTimes(1));
    slapp();
    await within(kort).findByRole("button", { name: "Lördag, 1 röst, du har röstat" });
    expect(rosta).toHaveBeenCalledWith(g.id, { mid: m.id, val: lor.id, av: "anna" });
    expect(rosta).toHaveBeenCalledTimes(1);
    expect(taBortRost).not.toHaveBeenCalled();
  });
  it("⛔ Lägg till alternativ: fältet i kortet skriver till källan, och en dubblett sägs i stället", async () => {
    const { s, g } = await underlag();
    const { m } = await medRoster(s, g.id);
    const laggTillAlternativ = vi.fn(s.laggTillAlternativ);
    render(<OpsMeddelanden kalla={{ ...s, laggTillAlternativ }} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    const kort = await hittaKort(m.id);
    fireEvent.click(await within(kort).findByRole("button", { name: "Lägg till alternativ" }));
    const falt = within(kort).getByLabelText("Nytt alternativ");
    fireEvent.change(falt, { target: { value: "lördag" } });
    fireEvent.submit(falt.closest("form") ?? falt);
    expect((await within(kort).findByRole("alert")).textContent).toBe("Alternativet finns redan.");
    expect(laggTillAlternativ).not.toHaveBeenCalled();
    fireEvent.change(falt, { target: { value: "Söndag" } });
    fireEvent.submit(falt.closest("form") ?? falt);
    await waitFor(() => expect(laggTillAlternativ).toHaveBeenCalledWith(g.id, { mid: m.id, text: "Söndag", av: "anna", befintliga: ["Fredag", "Lördag"] }));
    await within(kort).findByRole("button", { name: "Söndag, 0 röster" });
    expect(within(kort).queryByLabelText("Nytt alternativ")).toBeNull();
  });
  it("⛔ en nekad röst och en läsning som föll säger det", async () => {
    const { s, g } = await underlag();
    const { m } = await medRoster(s, g.id);
    const trasig = { ...s, rosta: async () => Promise.reject(new Error("permission-denied")) };
    const { unmount } = render(<OpsMeddelanden kalla={trasig} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    const kort = await hittaKort(m.id);
    fireEvent.click(await within(kort).findByRole("button", { name: "Lördag, 0 röster" }));
    expect((await screen.findByText("Rösten kunde inte sparas.")).getAttribute("role")).toBe("alert");
    unmount();
    const fallen = { ...s, prenumereraOmrostningsroster: (/** @type {any} */ _sid, /** @type {any} */ l) => (l.onError(new Error("permission-denied")), () => {}) };
    render(<OpsMeddelanden kalla={fallen} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    expect((await screen.findByText("Omröstningarna kunde inte hämtas.")).getAttribute("role")).toBe("alert");
  });
});
