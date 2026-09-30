import { describe, expect, it } from "vitest";
import { byggMeddelande, byggMottagare, byggSamtal, MAX_MEDDELANDE, motpart, olastaI, samtalsnyckel, utdrag } from "../lib/samtal.js";
import { createSamtalskalla, samtalsnotiser } from "../data/samtalskalla.js";
import { applyQuery } from "../data/contract.js";
import { createMemorySource } from "../data/adapters.js";
import { samtalsregelfragment } from "../lib/regler.js";

describe("samtalsnyckel (0.34.0): härledd, sorterad, en per par och grupp", () => {
  it("samma nyckel oavsett vem som skriver till vem", () => {
    expect(samtalsnyckel({ groupId: "g", slag: "personer", deltagare: ["b", "a"] })).toBe("g|a|b");
    expect(samtalsnyckel({ groupId: "g", slag: "personer", deltagare: ["a", "b"] })).toBe("g|a|b");
  });
  it("gruppchatten har en nyckel per grupp", () => {
    expect(samtalsnyckel({ groupId: "g", slag: "grupp" })).toBe("g|grupp");
  });
  it("⛔ ett par i olika grupper är två samtal", () => {
    expect(samtalsnyckel({ groupId: "g1", slag: "personer", deltagare: ["a", "b"] })).not.toBe(samtalsnyckel({ groupId: "g2", slag: "personer", deltagare: ["a", "b"] }));
  });
  it("⛔ kodpunktsordning, samma som regelns <, inte localeCompare", () => {
    // "B" < "a" i kodpunkter men inte i svensk sortering.
    expect(samtalsnyckel({ groupId: "g", slag: "personer", deltagare: ["a", "B"] })).toBe("g|B|a");
  });
  it("⛔ kastar på en person två gånger, tre deltagare och ett uid med avgränsaren", () => {
    expect(() => samtalsnyckel({ groupId: "g", slag: "personer", deltagare: ["a", "a"] })).toThrow(/samma person/);
    expect(() => samtalsnyckel({ groupId: "g", slag: "personer", deltagare: ["a", "b", "c"] })).toThrow(/exakt två/);
    expect(() => samtalsnyckel({ groupId: "g", slag: "personer", deltagare: ["a|x", "b"] })).toThrow(/avgränsare/);
    expect(() => samtalsnyckel({ groupId: "", slag: "grupp" })).toThrow(/groupId/);
  });
});

describe("byggSamtal och byggMeddelande", () => {
  it("ett privat samtal bär sorterade deltagare och den härledda nyckeln", () => {
    const s = byggSamtal({ groupId: "g", slag: "personer", deltagare: ["b", "a"], skapadAv: "b", skapad: 5 });
    expect(s).toEqual({ id: "g|a|b", groupId: "g", slag: "personer", deltagare: ["a", "b"], skapad: 5, skapadAv: "b" });
  });
  it("⛔ skaparen måste delta, och gruppchatten har inga deltagare", () => {
    expect(() => byggSamtal({ groupId: "g", slag: "personer", deltagare: ["a", "b"], skapadAv: "c" })).toThrow(/en av deltagarna/);
    expect(() => byggSamtal({ groupId: "g", slag: "grupp", deltagare: ["a", "b"], skapadAv: "a" })).toThrow(/inga deltagare/);
    expect(() => byggSamtal({ groupId: "g", slag: "kanal", skapadAv: "a" })).toThrow(/finns inte/);
  });
  it("⛔ ett meddelande är inte tomt och inte längre än taket", () => {
    expect(() => byggMeddelande({ text: "   ", av: "a" })).toThrow(/tom/);
    expect(() => byggMeddelande({ text: "x".repeat(MAX_MEDDELANDE + 1), av: "a" })).toThrow(/taket/);
    expect(byggMeddelande({ text: " hej ", av: "a", tid: 1 })).toEqual({ text: "hej", av: "a", tid: 1 });
  });
});

describe("olastaI: räknas fram, lagras aldrig", () => {
  const ms = [
    { av: "b", tid: 10 },
    { av: "a", tid: 20 },
    { av: "b", tid: 30 },
  ];
  it("andras meddelanden efter läsmärket", () => {
    expect(olastaI(ms, 15, "a")).toBe(1);
    expect(olastaI(ms, 0, "a")).toBe(2);
    expect(olastaI(ms, 30, "a")).toBe(0);
  });
  it("⛔ egna meddelanden är aldrig olästa", () => {
    expect(olastaI(ms, 0, "b")).toBe(1);
  });
  it("motpart och utdrag", () => {
    expect(motpart({ slag: "personer", deltagare: ["a", "b"] }, "a")).toBe("b");
    expect(motpart({ slag: "grupp" }, "a")).toBe(null);
    expect(utdrag("a  b\n c")).toBe("a b c");
    expect(utdrag("x".repeat(100), 10)).toHaveLength(10);
  });
});

describe("byggMottagare (#182): formen { slag, uid? }", () => {
  const medlemmar = [
    { userId: "a", typ: "person", status: "aktiv" },
    { userId: "x", typ: "person", status: "avslutad" },
    { userId: "bot", typ: "agent", status: "aktiv" },
  ];
  it("gruppen, en person och agenten", () => {
    expect(byggMottagare({ slag: "grupp" })).toEqual({ slag: "grupp" });
    expect(byggMottagare({ slag: "person", uid: "a" }, medlemmar)).toEqual({ slag: "person", uid: "a" });
    expect(byggMottagare({ slag: "agent" })).toEqual({ slag: "agent" });
    expect(byggMottagare({ slag: "agent", uid: "bot" }, medlemmar)).toEqual({ slag: "agent", uid: "bot" });
  });
  it("⛔ en person utan uid, en borttagen medlem, en agent som person och ett okänt fält kastar", () => {
    expect(() => byggMottagare({ slag: "person" })).toThrow(/kräver uid/);
    expect(() => byggMottagare({ slag: "person", uid: "x" }, medlemmar)).toThrow(/inte en aktiv medlem/);
    expect(() => byggMottagare({ slag: "person", uid: "bot" }, medlemmar)).toThrow(/typen person/);
    expect(() => byggMottagare({ slag: "grupp", uid: "a" })).toThrow(/inget uid/);
    expect(() => byggMottagare({ slag: "person", uid: "a", text: "x" })).toThrow(/okända fält/);
    expect(() => byggMottagare({ slag: "alla" })).toThrow(/finns inte/);
  });
});

describe("kontraktets innehaller (0.34.0)", () => {
  const rader = [
    { id: "1", g: "x", d: ["a", "b"] },
    { id: "2", g: "x", d: ["b", "c"] },
    { id: "3", g: "y", d: ["a"] },
    { id: "4", g: "x" },
  ];
  it("ett listfält som innehåller värdet, tillsammans med where", () => {
    expect(applyQuery(rader, { where: { g: "x" }, innehaller: { d: "a" } }).map((r) => r.id)).toEqual(["1"]);
  });
  it("⛔ fler än ett fält kastar, som Firestore", () => {
    expect(() => applyQuery(rader, { innehaller: { d: "a", e: "b" } })).toThrow(/högst ett/);
  });
});

describe("createSamtalskalla mot minnesadaptern", () => {
  const byggKalla = () => {
    let t = 1000;
    const kalla = createMemorySource({});
    return { kalla, samtal: createSamtalskalla({ kalla, klocka: () => (t += 10) }) };
  };

  it("⛔ två som öppnar samtalet med varandra får SAMMA samtal, och meddelandena hamnar där", async () => {
    const { samtal } = byggKalla();
    const s1 = await samtal.oppnaPrivat({ groupId: "g", uid: "a", annan: "b" });
    const s2 = await samtal.oppnaPrivat({ groupId: "g", uid: "b", annan: "a" });
    expect(s2.id).toBe(s1.id);
    await samtal.skicka(s1.id, { text: "hej", av: "a" });
    await samtal.skicka(s2.id, { text: "hej själv", av: "b" });
    expect((await samtal.meddelanden(s1.id)).map((m) => m.text)).toEqual(["hej", "hej själv"]);
  });

  it("⛔ lista ger gruppchatten och MINA privata samtal, aldrig andras", async () => {
    const { samtal } = byggKalla();
    await samtal.oppnaGrupp({ groupId: "g", uid: "a" });
    await samtal.oppnaPrivat({ groupId: "g", uid: "a", annan: "b" });
    await samtal.oppnaPrivat({ groupId: "g", uid: "b", annan: "c" });
    await samtal.oppnaPrivat({ groupId: "h", uid: "a", annan: "b" });
    const ids = (await samtal.lista({ groupId: "g", uid: "a" })).map((s) => s.id).sort();
    expect(ids).toEqual(["g|a|b", "g|grupp"]);
  });

  it("översikten räknar olästa ur läsmärket, och markeraLast nollar", async () => {
    const { samtal } = byggKalla();
    const s = await samtal.oppnaPrivat({ groupId: "g", uid: "a", annan: "b" });
    await samtal.skicka(s.id, { text: "ett", av: "b" });
    await samtal.skicka(s.id, { text: "två", av: "b" });
    let r = await samtal.oversikt({ groupId: "g", uid: "a" });
    expect(r[0].olasta).toBe(2);
    expect(r[0].motpart).toBe("b");
    await samtal.markeraLast(s.id, "a", /** @type {number} */ (r[0].senaste?.tid));
    r = await samtal.oversikt({ groupId: "g", uid: "a" });
    expect(r[0].olasta).toBe(0);
    // Avsändaren har aldrig olästa av sina egna.
    expect((await samtal.oversikt({ groupId: "g", uid: "b" }))[0].olasta).toBe(0);
  });

  it("samtalsnotiser: en notis per privat samtal med olästa, gruppchatten ger ingen", async () => {
    const { samtal } = byggKalla();
    const s = await samtal.oppnaPrivat({ groupId: "g", uid: "a", annan: "b" });
    const g = await samtal.oppnaGrupp({ groupId: "g", uid: "a" });
    await samtal.skicka(s.id, { text: "Kan du titta på fakturan?", av: "b" });
    await samtal.skicka(g.id, { text: "Hej alla", av: "b" });
    const notiser = await samtalsnotiser({ samtal, uid: "a", namnFor: (u) => (u === "b" ? "Bo" : u), href: (id) => `/meddelanden/${id}` })({ groupId: "g" });
    expect(notiser).toHaveLength(1);
    expect(notiser[0]).toMatchObject({ titel: "Bo skickade ett meddelande", text: "Kan du titta på fakturan?", prio: "normal", href: "/meddelanden/g|a|b" });
    expect(await samtalsnotiser({ samtal, uid: "b", namnFor: String })({ groupId: "g" })).toEqual([]);
  });

  it("⛔ en källa utan kalla, eller med ett namn med snedstreck, kastar vid uppstart", () => {
    expect(() => createSamtalskalla(/** @type {any} */ ({}))).toThrow(/kalla krävs/);
    expect(() => createSamtalskalla({ kalla: createMemorySource({}), samtal: "a/b" })).toThrow(/samlingsnamn/);
  });
});

describe("samtalsregelfragment: fälten är härledda ur modellen, inte en kopia", () => {
  it("hasOnly-listorna och taket kommer ur samtal.js", () => {
    const text = samtalsregelfragment();
    expect(text).toContain('hasOnly(["text", "av", "tid"])');
    expect(text).toContain('hasOnly(["groupId", "slag", "deltagare", "skapad", "skapadAv"])');
    expect(text).toContain(`<= ${MAX_MEDDELANDE}`);
    expect(text).toContain("allow update, delete: if false;");
  });
  it("samlingsnamnen skickas in, och ett snedstreck kastar", () => {
    expect(samtalsregelfragment({ samtal: "chatt", medlemskap: "medlemskap" })).toContain("match /chatt/{sid}");
    expect(samtalsregelfragment({ medlemskap: "medlemskap" })).toContain("documents/medlemskap/");
    expect(() => samtalsregelfragment({ samtal: "a/b" })).toThrow(/samlingsnamn/);
  });
});
