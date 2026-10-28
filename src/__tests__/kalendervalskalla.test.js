import { describe, expect, it } from "vitest";
import { createKalendervalskalla } from "../data/kalendervalskalla.js";
import { createMemorySource } from "../data/adapters.js";
import { KALENDERVALNYCKEL_FORM, MAX_KALENDERVAL, MAX_KALENDERVALNYCKEL, TOM_SYNLIGHET, kalenderValDokument, kalenderValOgiltigNyckel, lasKalenderSynlighet, rensaKalenderSynlighet } from "../lib/kalendersynlighet.js";
import { kalendervalsregelfragment } from "../lib/regler.js";

/**
 * Kalendervalens källa och regelfragment (0.151.0). Reglerna mäts i emulatorn (`rules/__tests__/kalenderval.test.mjs`); här prövas formen på sökvägen, valideringen
 * och att namnet aldrig kommer från ramverket.
 */

describe("createKalendervalskalla", () => {
  const ny = () => createKalendervalskalla({ kalla: createMemorySource(), kalenderval: "kalenderval" });

  it("skriver och läser ett dokument per person och grupp, utan id i svaret", async () => {
    const k = ny();
    expect(await k.las("u1", "g1")).toBeNull();
    await k.skriv("u1", "g1", { v: 1, syns: { a: false }, visning: { b: "ram" } });
    expect(await k.las("u1", "g1")).toEqual({ v: 1, syns: { a: false }, visning: { b: "ram" } });
    // En annan grupp och en annan person ser ingenting.
    expect(await k.las("u1", "g2")).toBeNull();
    expect(await k.las("u2", "g1")).toBeNull();
  });

  it("⛔ sökvägen är <användare>/<uid>/<samling>/<grupp>, med namnen appen valt", async () => {
    const kalla = createMemorySource();
    const k = createKalendervalskalla({ kalla, anvandare: "personer", kalenderval: "mina-val" });
    await k.skriv("u1", "g1", TOM_SYNLIGHET);
    expect(await kalla.read("personer/u1/mina-val", "g1")).toMatchObject({ v: 1 });
    expect(await kalla.read("users/u1/kalenderval", "g1")).toBeNull();
  });

  it("'före' följer med, och ett nytt skrivande ersätter hela dokumentet", async () => {
    const k = ny();
    await k.skriv("u1", "g1", { v: 1, syns: { a: false }, visning: {}, fore: { b: false } });
    expect((await k.las("u1", "g1"))?.fore).toEqual({ b: false });
    await k.skriv("u1", "g1", { v: 1, syns: {}, visning: {} });
    expect(await k.las("u1", "g1")).toEqual({ v: 1, syns: {}, visning: {} });
  });

  it("konto(uid, grupp) är den form hooken tar", async () => {
    const k = ny();
    const konto = k.konto("u1", "g1");
    expect(await konto.las()).toBeNull();
    await konto.skriv({ v: 1, syns: { a: true }, visning: {} });
    expect(await konto.las()).toEqual({ v: 1, syns: { a: true }, visning: {} });
  });

  it("⛔ kräver ett samlingsnamn: ramverket känner det aldrig själv", () => {
    expect(() => createKalendervalskalla({ kalla: createMemorySource() })).toThrow(/kalenderval "undefined" är inte ett samlingsnamn/);
    expect(() => createKalendervalskalla({ kalla: createMemorySource(), kalenderval: "a/b" })).toThrow(/inte ett samlingsnamn/);
    expect(() => createKalendervalskalla({ kalenderval: "x" })).toThrow(/kalla krävs/);
  });

  it("kastar på ett uid eller grupp-id som inte går att använda, innan något skrivs", async () => {
    const k = ny();
    await expect(k.skriv("", "g1", TOM_SYNLIGHET)).rejects.toThrow(/uid/);
    await expect(k.skriv("u/1", "g1", TOM_SYNLIGHET)).rejects.toThrow(/uid/);
    await expect(k.skriv("u1", "Stora", TOM_SYNLIGHET)).rejects.toThrow(/grupp-id/);
    await expect(k.skriv("u1", "a".repeat(81), TOM_SYNLIGHET)).rejects.toThrow(/grupp-id/);
    expect(() => k.konto("u1", "")).toThrow(/grupp-id/);
  });

  it("kastar ett begripligt fel över MAX_KALENDERVAL i stället för att låta reglerna neka", async () => {
    const k = ny();
    const syns = Object.fromEntries(Array.from({ length: MAX_KALENDERVAL + 1 }, (_, i) => [`k${i}`, true]));
    await expect(k.skriv("u1", "g1", { v: 1, syns, visning: {} })).rejects.toThrow(/högst 200/);
  });

  it("⛔ en läsning som kastar kastar vidare: 'fanns inget' och 'kunde inte fråga' är olika saker", async () => {
    const trasig = { read: () => Promise.reject(new Error("nekad")), create: () => Promise.resolve({}) };
    const k = createKalendervalskalla({ kalla: /** @type {any} */ (trasig), kalenderval: "kalenderval" });
    await expect(k.las("u1", "g1")).rejects.toThrow("nekad");
  });
});

describe("kalendervalsregelfragment", () => {
  it("bär samlingsnamnet appen skickade, och aldrig ett förval", () => {
    const t = kalendervalsregelfragment("mina-val");
    expect(t).toContain("match /users/{uid}/mina-val/{gid}");
    expect(t).not.toContain("kalenderval/");
    expect(kalendervalsregelfragment("x", { anvandare: "personer" })).toContain("match /personer/{uid}/x/{gid}");
  });

  it("kräver ett samlingsnamn, och nekar en sökväg", () => {
    expect(() => kalendervalsregelfragment(/** @type {any} */ (undefined))).toThrow(/samlingsnamn/);
    expect(() => kalendervalsregelfragment("a/b")).toThrow(/samlingsnamn/);
    expect(() => kalendervalsregelfragment("x", { anvandare: "u/v" })).toThrow(/samlingsnamn/);
  });

  it("⛔ härleder taken, fälten och visningarna ur klientens egna konstanter", () => {
    const t = kalendervalsregelfragment("kalenderval");
    expect(t).toContain(`d.syns.size() <= ${MAX_KALENDERVAL}`);
    expect(t).toContain('d.keys().hasOnly(["v", "syns", "visning", "fore"])');
    expect(t).toContain('d.visning.values().hasOnly(["handelser", "ram", "bada"])');
    expect(t).toContain("allow delete: if false;");
    expect(t).toContain("request.auth.uid == uid");
  });

  it("⛔ kräver ett aktivt medlemskap i gruppen, ur regelfragment(): ingen ny parameter, ingen samlingsnamn att skicka", () => {
    const t = kalendervalsregelfragment("kalenderval");
    expect(t).toMatch(/allow create, update: if opsInloggad\(\) && request\.auth\.uid == uid\n\s+&& gid\.matches\([^)]*\)\n\s+&& gid\.size\(\) <= 80\n\s+&& opsArMedlem\(gid\)/);
    // Läsningen kräver inget medlemskap (en list kan inte pröva ett per dokument), och radering är aldrig tillåten.
    expect(t).toContain("allow read: if opsInloggad() && request.auth.uid == uid;");
    expect(kalendervalsregelfragment.length).toBe(1);
    expect(t).toBe(kalendervalsregelfragment("kalenderval", {}));
  });

  it("⛔ prövar varje nyckel i alla tre kartorna mot kalenderradens id, härlett ur klientens form", () => {
    const t = kalendervalsregelfragment("kalenderval");
    const nyckel = `[A-Za-z0-9][A-Za-z0-9_:.-]{0,${MAX_KALENDERVALNYCKEL - 1}}`;
    expect(t).toContain(`k.keys().join(',').matches('${nyckel}(,${nyckel})*')`);
    expect(t).toContain("k.keys().join(',').split(',').size() == k.size()");
    for (const falt of ["d.syns", "d.visning", "d.fore"]) expect(t).toContain(`opsKalendervalNycklar(${falt})`);
  });
});

describe("kalenderValDokument: nycklarna är kalenderrader (#459)", () => {
  it("formen är den reglerna prövar med: ett id på högst MAX_KALENDERVALNYCKEL tecken", () => {
    expect(MAX_KALENDERVALNYCKEL).toBe(80);
    for (const ok of ["a", "cps-ab", "ical:abc", "mina:privat", "app:arenden", "ical:Abc.DEF_1", "k".repeat(80)]) expect(KALENDERVALNYCKEL_FORM.test(ok), ok).toBe(true);
    for (const fel of ["", " ", "a b", "a,b", "a/b", "åäö", ":x", "-x", "k".repeat(81)]) expect(KALENDERVALNYCKEL_FORM.test(fel), JSON.stringify(fel)).toBe(false);
  });

  it("kastar med ett besked som pekar ut kartan och nyckeln, innan reglerna hinner neka", () => {
    expect(() => kalenderValDokument({ v: 1, syns: { ["k".repeat(81)]: true }, visning: {} })).toThrow(/syns har nyckeln "k{40}", som inte är ett kalender-id \(högst 80 tecken/);
    expect(() => kalenderValDokument({ v: 1, syns: {}, visning: { "a b": "ram" } })).toThrow(/visning har nyckeln "a b"/);
    expect(() => kalenderValDokument({ v: 1, syns: {}, visning: {}, fore: { "a,b": true } })).toThrow(/fore har nyckeln "a,b"/);
    expect(() => kalenderValDokument({ v: 1, syns: { "ical:abc": false, "mina:privat": true }, visning: { "app:arenden": "ram" }, fore: {} })).not.toThrow();
  });

  it("kalenderValOgiltigNyckel säger vilken karta och vilken nyckel, eller null när allt är ett id", () => {
    expect(kalenderValOgiltigNyckel({ v: 1, syns: { a: true }, visning: { "x y": "ram" } })).toEqual({ namn: "visning", nyckel: "x y" });
    expect(kalenderValOgiltigNyckel({ v: 1, syns: { a: true }, visning: {} })).toBeNull();
  });
});

describe("läsaren släpper nycklar som reglerna skulle neka (granskningen av PR 462)", () => {
  const dok = { v: 1, syns: { apple: false, "dålig nyckel": true, ["k".repeat(81)]: true, "a,b": false }, visning: { arenden: "ram", "x/y": "bada" }, fore: { apple: true, "": true } };

  it("rensaKalenderSynlighet behåller de giltiga nycklarna i alla tre kartorna och släpper resten", () => {
    expect(rensaKalenderSynlighet(dok)).toEqual({ v: 1, syns: { apple: false }, visning: { arenden: "ram" }, fore: { apple: true } });
    // Det som blir kvar går att skriva: kalenderValDokument kastar inte.
    expect(() => kalenderValDokument(/** @type {any} */ (rensaKalenderSynlighet(dok)))).not.toThrow();
    expect(kalenderValOgiltigNyckel(/** @type {any} */ (rensaKalenderSynlighet(dok)))).toBeNull();
  });

  it("samma för webbläsarens minne: en text med en ogiltig nyckel läses utan den", () => {
    expect(lasKalenderSynlighet(JSON.stringify(dok))).toEqual({ v: 1, syns: { apple: false }, visning: { arenden: "ram" }, fore: { apple: true } });
  });

  it("appens riktiga id:n släpps inte: ical:, mina:, app: och 80 tecken", () => {
    const syns = { "ical:abc": false, "mina:privat": true, "app:arenden": false, ["k".repeat(80)]: true };
    expect(rensaKalenderSynlighet({ v: 1, syns, visning: {} })?.syns).toEqual(syns);
  });
});
