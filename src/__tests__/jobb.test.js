import { describe, expect, it, vi } from "vitest";
import { JOBBSTEG, jobbKorningsId, jobbTidpunkt, nastaKorning, validateJobbschema } from "../lib/jobb.js";
import { korForfallnaJobb, korJobbNu, slutforJobb, tilldelaJobb, vitlistaUtfall } from "../node/jobb.js";
import { createMemorySource } from "../data/adapters.js";

/**
 * Återkommande jobb (0.256.0, cllp/lifehub.app#888): schemat, nästa körning över sommartidsskiftet, låset och schemaläggarens varv.
 *
 * ⛔ SKIFTENA ÄR DE SVENSKA 2026: klockan ställs fram natten mot söndag 29 mars (01:00 UTC) och tillbaka natten mot söndag 25 oktober
 * (01:00 UTC). Ett jobb "varje dag 06:15" ska vara 06:15 svensk tid båda dagarna, alltså 05:15 UTC före skiftet i mars och 04:15 efter.
 */

const U = (/** @type {string} */ iso) => new Date(iso);

describe("validateJobbschema", () => {
  it("svarar med schemat i ren form för varje steg", () => {
    expect(validateJobbschema({ steg: "timme", minut: 5 })).toEqual({ steg: "timme", minut: 5 });
    expect(validateJobbschema({ steg: "dag", tid: "06:15" })).toEqual({ steg: "dag", tid: "06:15" });
    expect(validateJobbschema({ steg: "vecka", tid: "07:00", veckodag: 7 })).toEqual({ steg: "vecka", tid: "07:00", veckodag: 7 });
    expect(validateJobbschema({ steg: "manad", tid: "23:45", dag: 28 })).toEqual({ steg: "manad", tid: "23:45", dag: 28 });
  });

  it.each([
    [null, /Schemat saknas/],
    [{ steg: "minut" }, /steg "minut" finns inte/],
    [{ steg: "timme", minut: 60 }, /Minuten/],
    [{ steg: "timme", minut: 1.5 }, /Minuten/],
    [{ steg: "timme", minut: 5, tid: "06:00" }, /Fältet "tid" hör inte till steget "timme"/],
    [{ steg: "dag", tid: "6:15" }, /HH:MM/],
    [{ steg: "dag", tid: "24:00" }, /HH:MM/],
    [{ steg: "dag", tid: "06:15", veckodag: 1 }, /Fältet "veckodag"/],
    [{ steg: "vecka", tid: "06:15", veckodag: 0 }, /Veckodagen/],
    [{ steg: "vecka", tid: "06:15" }, /Veckodagen/],
    [{ steg: "manad", tid: "06:15", dag: 29 }, /Februari har 28 dagar/],
  ])("kastar för %j", (schema, fel) => {
    expect(() => validateJobbschema(schema)).toThrow(fel);
  });

  it("ett steg typen inte tillåter kastar (banksynken får inte timme)", () => {
    expect(() => validateJobbschema({ steg: "timme", minut: 0 }, ["dag", "vecka", "manad"])).toThrow(/inte tillåtet/);
    expect(() => validateJobbschema({ steg: "dag", tid: "06:00" }, ["sekund"])).toThrow(/tillåtna steg/);
    expect(JOBBSTEG).toEqual(["timme", "dag", "vecka", "manad"]);
  });
});

describe("nastaKorning", () => {
  it("dag: samma dag om tiden inte passerat, annars nästa, och strikt efter", () => {
    const s = { steg: "dag", tid: "06:15" };
    expect(nastaKorning(s, U("2026-11-23T05:00:00Z")).toISOString()).toBe("2026-11-23T05:15:00.000Z");
    expect(nastaKorning(s, U("2026-11-23T05:15:00Z")).toISOString()).toBe("2026-11-24T05:15:00.000Z");
    expect(nastaKorning(s, U("2026-11-23T05:16:00Z")).toISOString()).toBe("2026-11-24T05:15:00.000Z");
  });

  it("dag över skiftet 2026-03-29: 06:15 svensk tid båda dagarna", () => {
    const s = { steg: "dag", tid: "06:15" };
    expect(nastaKorning(s, U("2026-03-28T00:00:00Z")).toISOString()).toBe("2026-03-28T05:15:00.000Z");
    expect(nastaKorning(s, U("2026-03-28T05:15:00Z")).toISOString()).toBe("2026-03-29T04:15:00.000Z");
  });

  it("dag över skiftet 2026-10-25: 06:15 svensk tid båda dagarna", () => {
    const s = { steg: "dag", tid: "06:15" };
    expect(nastaKorning(s, U("2026-10-24T00:00:00Z")).toISOString()).toBe("2026-10-24T04:15:00.000Z");
    expect(nastaKorning(s, U("2026-10-24T04:15:00Z")).toISOString()).toBe("2026-10-25T05:15:00.000Z");
  });

  it("en tid som inte finns (02:30 den 29 mars) blir 03:30, och en som finns två gånger (02:30 den 25 oktober) körs en gång", () => {
    expect(nastaKorning({ steg: "dag", tid: "02:30" }, U("2026-03-28T12:00:00Z")).toISOString()).toBe("2026-03-29T01:30:00.000Z");
    const forsta = nastaKorning({ steg: "dag", tid: "02:30" }, U("2026-10-24T12:00:00Z"));
    const andra = nastaKorning({ steg: "dag", tid: "02:30" }, forsta);
    expect(andra.getTime() - forsta.getTime()).toBeGreaterThan(23 * 3600_000);
  });

  it("timme: nästa hela minuttal, och en timmes mellanrum också natten klockan ställs tillbaka", () => {
    const s = { steg: "timme", minut: 5 };
    expect(nastaKorning(s, U("2026-11-23T10:04:59Z")).toISOString()).toBe("2026-11-23T10:05:00.000Z");
    expect(nastaKorning(s, U("2026-11-23T10:05:00Z")).toISOString()).toBe("2026-11-23T11:05:00.000Z");
    let t = U("2026-10-24T22:30:00Z");
    /** @type {number[]} */
    const steg = [];
    for (let i = 0; i < 6; i += 1) {
      const n = nastaKorning(s, t);
      steg.push(n.getTime() - t.getTime());
      t = n;
    }
    expect(steg.slice(1).every((ms) => ms === 3600_000)).toBe(true);
  });

  it("vecka: rätt veckodag (1 måndag, 7 söndag) och över skiftet i mars", () => {
    // 2026-11-23 är en måndag.
    expect(nastaKorning({ steg: "vecka", tid: "07:00", veckodag: 1 }, U("2026-11-23T07:00:00Z")).toISOString()).toBe("2026-11-30T06:00:00.000Z");
    expect(nastaKorning({ steg: "vecka", tid: "07:00", veckodag: 3 }, U("2026-11-23T07:00:00Z")).toISOString()).toBe("2026-11-25T06:00:00.000Z");
    // Söndag 29 mars 2026 är skiftdagen: 07:00 sommartid är 05:00 UTC.
    expect(nastaKorning({ steg: "vecka", tid: "07:00", veckodag: 7 }, U("2026-03-23T00:00:00Z")).toISOString()).toBe("2026-03-29T05:00:00.000Z");
  });

  it("manad: dagen i månaden, nästa månad när den passerat, och över årsskiftet", () => {
    expect(nastaKorning({ steg: "manad", tid: "06:00", dag: 25 }, U("2026-11-23T00:00:00Z")).toISOString()).toBe("2026-11-25T05:00:00.000Z");
    expect(nastaKorning({ steg: "manad", tid: "06:00", dag: 1 }, U("2026-12-15T00:00:00Z")).toISOString()).toBe("2027-01-01T05:00:00.000Z");
    expect(nastaKorning({ steg: "manad", tid: "06:00", dag: 28 }, U("2027-01-29T00:00:00Z")).toISOString()).toBe("2027-02-28T05:00:00.000Z");
  });

  it("en annan tidszon räknas i sin egen klocka", () => {
    expect(nastaKorning({ steg: "dag", tid: "06:15" }, U("2026-11-23T00:00:00Z"), "America/New_York").toISOString()).toBe("2026-11-23T11:15:00.000Z");
    expect(() => nastaKorning({ steg: "dag", tid: "06:15" }, U("2026-11-23T00:00:00Z"), "Mars/Olympus")).toThrow(/finns inte/);
  });

  it("jobbKorningsId är jobbet plus den planerade tiden, och jobbTidpunkt läser det en databas ger tillbaka", () => {
    expect(jobbKorningsId("bank-g1", U("2026-11-23T05:15:00Z"))).toBe("bank-g1@2026-11-23T05:15:00.000Z");
    expect(() => jobbKorningsId("", U("2026-11-23T05:15:00Z"))).toThrow();
    expect(jobbTidpunkt({ toMillis: () => 5 })?.getTime()).toBe(5);
    expect(jobbTidpunkt("2026-11-23T05:15:00Z")?.toISOString()).toBe("2026-11-23T05:15:00.000Z");
    expect(jobbTidpunkt("inte en tid")).toBeNull();
    expect(jobbTidpunkt(undefined)).toBeNull();
  });
});

/*
 * ═══ Servern mot minneskällan ════════════════════════════════════════════════════════════════════════════════════════════
 * Samma datakälla som övriga tjänster under `src/node` provas mot (`createMemorySource`). Dess `updateIf` jämför och skriver utan att
 * vänta däremellan, som kontraktets regel 7 kräver, så två samtidiga anspråk på samma version kan inte båda lyckas. Tiderna är
 * millisekunder, som i dokumentet.
 */

const ms = (/** @type {string} */ iso) => Date.parse(iso);
const NU = U("2026-11-23T05:20:00Z");
const SAMLING = "appensJobb";
/** @param {string} id @param {Record<string, any>} [extra] */
const jobbet = (id, extra = {}) => ({ id, groupId: "g1", typ: "bank", lage: "skarp", schema: { steg: "dag", tid: "06:15" }, nastaKorning: ms("2026-11-23T05:15:00Z"), version: 0, las: null, ...extra });
/** @param {...Record<string, any>} rader */
const kalla = (...rader) => createMemorySource({ [SAMLING]: rader });
/** @param {any} k @param {string} id */
const las = (k, id) => k.read(SAMLING, id);

describe("tilldelaJobb", () => {
  it("tar ett förfallet jobb: låset bär tidsgränsen och körningens id, och versionen räknas upp", async () => {
    const k = kalla(jobbet("a"));
    const svar = await tilldelaJobb({ kalla: k, samling: SAMLING, jobbId: "a", nu: NU, tidsgransMs: 60_000 });
    expect(svar?.korningId).toBe("a@2026-11-23T05:15:00.000Z");
    expect(svar?.version).toBe(1);
    expect(svar?.jobb.id).toBe("a");
    const d = await las(k, "a");
    expect(d.las).toEqual({ till: ms("2026-11-23T05:21:00Z"), korning: "a@2026-11-23T05:15:00.000Z" });
    expect(d.version).toBe(1);
  });

  it("två samtidiga anspråk på samma version ger exakt en vinnare", async () => {
    const k = kalla(jobbet("a"));
    const svar = await Promise.all([1, 2, 3].map(() => tilldelaJobb({ kalla: k, samling: SAMLING, jobbId: "a", nu: NU })));
    expect(svar.filter(Boolean)).toHaveLength(1);
    expect((await las(k, "a")).version).toBe(1);
  });

  it("hoppar över ett giltigt lås, men tar ett som löpt ut", async () => {
    const k = kalla(jobbet("a", { las: { till: ms("2026-11-23T05:25:00Z"), korning: "x" } }), jobbet("b", { las: { till: ms("2026-11-23T05:19:00Z"), korning: "x" } }));
    expect(await tilldelaJobb({ kalla: k, samling: SAMLING, jobbId: "a", nu: NU })).toBeNull();
    expect((await las(k, "a")).las.korning).toBe("x");
    expect((await tilldelaJobb({ kalla: k, samling: SAMLING, jobbId: "b", nu: NU }))?.korningId).toBe("b@2026-11-23T05:15:00.000Z");
  });

  it("tar inte ett jobb som inte är förfallet, är av eller saknas; direkt tar ett som inte är förfallet men aldrig ett avslaget", async () => {
    const k = kalla(jobbet("senare", { nastaKorning: ms("2026-11-24T05:15:00Z") }), jobbet("av", { lage: "av" }), jobbet("utan", { nastaKorning: null }));
    expect(await tilldelaJobb({ kalla: k, samling: SAMLING, jobbId: "senare", nu: NU })).toBeNull();
    expect(await tilldelaJobb({ kalla: k, samling: SAMLING, jobbId: "av", nu: NU })).toBeNull();
    expect(await tilldelaJobb({ kalla: k, samling: SAMLING, jobbId: "utan", nu: NU })).toBeNull();
    expect(await tilldelaJobb({ kalla: k, samling: SAMLING, jobbId: "finns-inte", nu: NU })).toBeNull();
    expect((await tilldelaJobb({ kalla: k, samling: SAMLING, jobbId: "senare", nu: NU, direkt: true }))?.korningId).toBe("senare@2026-11-23T05:20:00.000Z");
    expect(await tilldelaJobb({ kalla: k, samling: SAMLING, jobbId: "av", nu: NU, direkt: true })).toBeNull();
  });

  it("säger nej utan updateIf, utan samling och för ett jobb utan version", async () => {
    const utan = { read: async () => null, list: async () => [] };
    await expect(tilldelaJobb({ kalla: /** @type {any} */ (utan), samling: SAMLING, jobbId: "a", nu: NU })).rejects.toThrow(/saknar updateIf/);
    await expect(tilldelaJobb({ kalla: kalla(), samling: "", jobbId: "a", nu: NU })).rejects.toThrow(/samlingens namn/);
    await expect(tilldelaJobb({ kalla: kalla(jobbet("a", { version: undefined })), samling: SAMLING, jobbId: "a", nu: NU })).rejects.toThrow(/saknar version/);
  });
});

describe("slutforJobb", () => {
  it("skriver senast och nästa körning och släpper låset när versionen är låsets", async () => {
    const k = kalla(jobbet("a", { version: 1, las: { till: ms("2026-11-23T05:30:00Z"), korning: "k1" } }));
    const skrivet = await slutforJobb({ kalla: k, samling: SAMLING, jobbId: "a", version: 1, utfall: { utfall: "ok", paborjat: 12, bekraftat: 12 }, nu: NU });
    expect(skrivet).toEqual({ tid: NU.getTime(), utfall: "ok", paborjat: 12, bekraftat: 12 });
    const d = await las(k, "a");
    expect(d.las).toBeNull();
    expect(d.version).toBe(2);
    expect(d.senast).toEqual({ tid: NU.getTime(), utfall: "ok", paborjat: 12, bekraftat: 12 });
    expect(d.nastaKorning).toBe(ms("2026-11-24T05:15:00Z"));
  });

  it("ett sent avslut efter att låset löpt ut och tagits igen skriver ingenting", async () => {
    const k = kalla(jobbet("a"));
    const forsta = await tilldelaJobb({ kalla: k, samling: SAMLING, jobbId: "a", nu: NU, tidsgransMs: 60_000 });
    const senare = new Date(NU.getTime() + 2 * 60_000);
    const andra = await tilldelaJobb({ kalla: k, samling: SAMLING, jobbId: "a", nu: senare, tidsgransMs: 60_000 });
    expect(forsta?.version).toBe(1);
    expect(andra?.version).toBe(2);
    expect(await slutforJobb({ kalla: k, samling: SAMLING, jobbId: "a", version: /** @type {number} */ (forsta?.version), utfall: { utfall: "ok", paborjat: 9 }, nu: senare })).toBeNull();
    const d = await las(k, "a");
    expect(d.senast).toBeUndefined();
    expect(d.version).toBe(2);
    expect(d.las.till).toBe(senare.getTime() + 60_000);
    expect(d.nastaKorning).toBe(ms("2026-11-23T05:15:00Z"));
  });

  it("vitlistar senast: inga texter, belopp eller nycklar kan lagras", () => {
    const t = NU.getTime();
    const smutsigt = { utfall: "fel", paborjat: 3, bekraftat: -1, kod: "Banken svarade: konto 1234 saldo 5000 kr", meddelande: "hemligt", belopp: 5000, nyckel: "sk_live_x" };
    expect(vitlistaUtfall(smutsigt, NU)).toEqual({ tid: t, utfall: "fel", paborjat: 3 });
    expect(vitlistaUtfall({ utfall: "ok", paborjat: 2.5, bekraftat: "12", kod: "bank-tak" }, NU)).toEqual({ tid: t, utfall: "ok", kod: "bank-tak" });
    expect(vitlistaUtfall({ utfall: "klart" }, NU)).toEqual({ tid: t, utfall: "fel", kod: "okant-utfall" });
    expect(vitlistaUtfall(undefined, NU)).toEqual({ tid: t, utfall: "fel", kod: "okant-utfall" });
    expect(vitlistaUtfall({ utfall: "ok", kod: "x".repeat(41) }, NU)).toEqual({ tid: t, utfall: "ok" });
  });

  it("ett schema som inte går att läsa stoppar jobbet synligt, och ett jobb som slogs av under körningen får ingen nästa körning", async () => {
    const k = kalla(jobbet("a", { schema: { steg: "sekund" }, version: 1, las: { till: ms("2026-11-23T05:30:00Z"), korning: "k1" } }), jobbet("b", { lage: "av", version: 1, las: { till: ms("2026-11-23T05:30:00Z"), korning: "k1" } }));
    await slutforJobb({ kalla: k, samling: SAMLING, jobbId: "a", version: 1, utfall: { utfall: "ok" }, nu: NU });
    const d = await las(k, "a");
    expect(d.nastaKorning).toBeNull();
    expect(d.senast).toEqual({ tid: NU.getTime(), utfall: "fel", kod: "ogiltigt-schema" });
    expect(d.las).toBeNull();
    await slutforJobb({ kalla: k, samling: SAMLING, jobbId: "b", version: 1, utfall: { utfall: "ok" }, nu: NU });
    expect((await las(k, "b")).nastaKorning).toBeNull();
  });
});

describe("korForfallnaJobb", () => {
  it("kör varje förfallet jobb, går vidare efter en typ som kastar, och räknar påbörjade och bekräftade", async () => {
    const k = kalla(
      jobbet("ok", { typ: "bank" }),
      jobbet("kastar", { typ: "trasig" }),
      jobbet("okand", { typ: "finns-inte" }),
      jobbet("hoppar", { typ: "tom", lage: "prov" }),
      jobbet("senare", { nastaKorning: ms("2026-11-24T05:15:00Z") }),
      jobbet("av", { lage: "av" }),
      jobbet("last", { las: { till: ms("2026-11-23T06:00:00Z"), korning: "annan" } }),
    );
    const bank = vi.fn(async () => ({ utfall: "ok", paborjat: 12, bekraftat: 12, saldo: 5000 }));
    const tom = vi.fn(async () => ({ utfall: "hoppad", kod: "inget-nytt" }));
    const onFel = vi.fn();
    const fel = Object.assign(new Error("Banken: konto 1234"), { kod: "bank-nere" });
    const typer = { bank: { kor: bank }, trasig: { kor: async () => { throw fel; } }, tom: { kor: tom } };
    const rapport = await korForfallnaJobb({ kalla: k, samling: SAMLING, nu: NU, typer, onFel });

    const t = NU.getTime();
    expect(rapport).toEqual({ paborjade: 4, bekraftade: 4, fel: 1, hoppade: 2 });
    expect(bank).toHaveBeenCalledWith(expect.objectContaining({ id: "ok" }), { lage: "skarp", korningId: "ok@2026-11-23T05:15:00.000Z" });
    expect(tom).toHaveBeenCalledWith(expect.objectContaining({ id: "hoppar" }), { lage: "prov", korningId: "hoppar@2026-11-23T05:15:00.000Z" });
    expect(onFel).toHaveBeenCalledWith("kastar", fel);
    expect((await las(k, "ok")).senast).toEqual({ tid: t, utfall: "ok", paborjat: 12, bekraftat: 12 });
    expect((await las(k, "kastar")).senast).toEqual({ tid: t, utfall: "fel", kod: "bank-nere" });
    expect((await las(k, "okand")).senast).toEqual({ tid: t, utfall: "hoppad", kod: "okand-typ" });
    expect((await las(k, "hoppar")).senast).toEqual({ tid: t, utfall: "hoppad", kod: "inget-nytt" });
    for (const id of ["ok", "kastar", "okand", "hoppar"]) {
      const d = await las(k, id);
      expect(d.las).toBeNull();
      expect(d.version).toBe(2);
      expect(d.nastaKorning).toBe(ms("2026-11-24T05:15:00Z"));
    }
    expect((await las(k, "senare")).senast).toBeUndefined();
    expect((await las(k, "av")).senast).toBeUndefined();
    expect((await las(k, "last")).las.korning).toBe("annan");
  });

  it("ett jobb förfallet exakt nu kommer med, ett en millisekund senare gör det inte", async () => {
    const k = kalla(jobbet("nu", { nastaKorning: NU.getTime() }), jobbet("strax", { nastaKorning: NU.getTime() + 1 }));
    expect(await korForfallnaJobb({ kalla: k, samling: SAMLING, nu: NU, typer: { bank: { kor: async () => ({ utfall: "ok" }) } } })).toEqual({ paborjade: 1, bekraftade: 1, fel: 0, hoppade: 0 });
    expect((await las(k, "strax")).senast).toBeUndefined();
  });

  it("ett undantag utan kod blir koden undantag, och ett fel i skrivningen räknas som påbörjat men inte bekräftat", async () => {
    const k = kalla(jobbet("a", { typ: "trasig" }), jobbet("b", { typ: "bank" }));
    const typer = { trasig: { kor: async () => { throw new Error("hemlig text"); } }, bank: { kor: async () => ({ utfall: "ok" }) } };
    expect(await korForfallnaJobb({ kalla: k, samling: SAMLING, nu: NU, typer })).toEqual({ paborjade: 2, bekraftade: 2, fel: 1, hoppade: 0 });
    expect((await las(k, "a")).senast).toEqual({ tid: NU.getTime(), utfall: "fel", kod: "undantag" });

    const k2 = kalla(jobbet("a"));
    const riktig = k2.updateIf;
    let varv = 0;
    k2.updateIf = async (...args) => {
      varv += 1;
      if (varv === 2) throw new Error("databasen svarade inte");
      return /** @type {any} */ (riktig).apply(k2, args);
    };
    const onFel = vi.fn();
    const r2 = await korForfallnaJobb({ kalla: k2, samling: SAMLING, nu: NU, typer: { bank: { kor: async () => ({ utfall: "ok" }) } }, onFel });
    expect(r2).toEqual({ paborjade: 1, bekraftade: 0, fel: 1, hoppade: 0 });
    expect(onFel).toHaveBeenCalledWith("a", expect.any(Error));
  });

  it("en körning vars lås hann tas av ett annat varv räknas som påbörjad men inte bekräftad, och skriver inget", async () => {
    const k = kalla(jobbet("a"));
    const kor = async () => {
      // Körningen drog över tidsgränsen och nästa varv tog låset under tiden: versionen är en annan.
      await k.update(SAMLING, "a", { las: { till: ms("2026-11-23T06:00:00Z"), korning: "annat-varv" }, version: 2 });
      return { utfall: "ok", paborjat: 1, bekraftat: 1 };
    };
    expect(await korForfallnaJobb({ kalla: k, samling: SAMLING, nu: NU, typer: { bank: { kor } } })).toEqual({ paborjade: 1, bekraftade: 0, fel: 0, hoppade: 0 });
    expect((await las(k, "a")).senast).toBeUndefined();
    expect((await las(k, "a")).las.korning).toBe("annat-varv");
  });

  it("tar högst max jobb, de äldsta först", async () => {
    const k = kalla(jobbet("ny", { nastaKorning: ms("2026-11-23T05:10:00Z") }), jobbet("gammal", { nastaKorning: ms("2026-11-22T05:15:00Z") }));
    const kor = vi.fn(async () => ({ utfall: "ok" }));
    expect(await korForfallnaJobb({ kalla: k, samling: SAMLING, nu: NU, typer: { bank: { kor } }, max: 1 })).toEqual({ paborjade: 1, bekraftade: 1, fel: 0, hoppade: 0 });
    expect(kor).toHaveBeenCalledWith(expect.objectContaining({ id: "gammal" }), expect.anything());
  });
});

describe("korJobbNu", () => {
  it("kör ett jobb som inte är förfallet, och nästa körning räknas från nu", async () => {
    const k = kalla(jobbet("a", { nastaKorning: ms("2026-11-24T05:15:00Z") }));
    const kor = vi.fn(async () => ({ utfall: "ok", paborjat: 1, bekraftat: 1 }));
    const svar = await korJobbNu({ kalla: k, samling: SAMLING, jobbId: "a", nu: NU, typer: { bank: { kor } } });
    expect(svar).toEqual({ senast: { tid: NU.getTime(), utfall: "ok", paborjat: 1, bekraftat: 1 }, bekraftad: true });
    expect(kor).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), { lage: "skarp", korningId: "a@2026-11-23T05:20:00.000Z" });
    expect((await las(k, "a")).nastaKorning).toBe(ms("2026-11-24T05:15:00Z"));
  });

  it("svarar null för ett låst eller avslaget jobb, och kör inte typen", async () => {
    const k = kalla(jobbet("last", { las: { till: ms("2026-11-23T06:00:00Z"), korning: "x" } }), jobbet("av", { lage: "av" }));
    const kor = vi.fn();
    expect(await korJobbNu({ kalla: k, samling: SAMLING, jobbId: "last", nu: NU, typer: { bank: { kor } } })).toBeNull();
    expect(await korJobbNu({ kalla: k, samling: SAMLING, jobbId: "av", nu: NU, typer: { bank: { kor } } })).toBeNull();
    expect(kor).not.toHaveBeenCalled();
  });
});
