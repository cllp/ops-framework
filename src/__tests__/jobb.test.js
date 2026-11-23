import { describe, expect, it, vi } from "vitest";
import { JOBBSTEG, jobbKorningsId, jobbTidpunkt, nastaKorning, validateJobbschema } from "../lib/jobb.js";
import { korForfallnaJobb, korJobbNu, slutforJobb, tilldelaJobb, vitlistaUtfall } from "../node/jobb.js";

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
 * ═══ En Firestore i minnet med Admin SDK:s form ══════════════════════════════════════════════════════════════════════════
 * `collection(namn).doc(id)` med `get`, `runTransaction` (läsningar direkt, skrivningar när återanropet är klart, som i Firestore),
 * och en fråga med `where("in" | "<=")`, `orderBy`, `limit` och `get`. Tiderna jämförs som tidpunkter, som Firestores Timestamp.
 */
function minnesDb(/** @type {Record<string, Record<string, any>>} */ start = {}) {
  /** @type {Map<string, Map<string, any>>} */
  const samlingar = new Map(Object.entries(start).map(([n, d]) => [n, new Map(Object.entries(d).map(([id, v]) => [id, structuredClone(v)]))]));
  const sam = (/** @type {string} */ n) => {
    if (!samlingar.has(n)) samlingar.set(n, new Map());
    return /** @type {Map<string, any>} */ (samlingar.get(n));
  };
  const snap = (/** @type {string} */ id, /** @type {any} */ v) => ({ id, exists: v !== undefined, data: () => (v === undefined ? undefined : structuredClone(v)) });
  const varde = (/** @type {any} */ v) => (v instanceof Date ? v.getTime() : v);
  const db = {
    transaktioner: 0,
    collection(/** @type {string} */ n) {
      /** @type {Array<(d: any) => boolean>} */
      const villkor = [];
      /** @type {string | null} */
      let ordning = null;
      let tak = Infinity;
      const fraga = {
        where(/** @type {string} */ f, /** @type {string} */ op, /** @type {any} */ v) {
          if (op === "in") villkor.push((d) => v.includes(d[f]));
          else if (op === "<=") villkor.push((d) => d[f] != null && varde(d[f]) <= varde(v));
          else throw new Error(`minnesDb: ${op} stöds inte`);
          return fraga;
        },
        orderBy(/** @type {string} */ f) {
          ordning = f;
          return fraga;
        },
        limit(/** @type {number} */ n2) {
          tak = n2;
          return fraga;
        },
        async get() {
          let rader = [...sam(n).entries()].filter(([, d]) => villkor.every((v) => v(d)));
          if (ordning) rader.sort((a, b) => varde(a[1][/** @type {string} */ (ordning)]) - varde(b[1][/** @type {string} */ (ordning)]));
          return { docs: rader.slice(0, tak).map(([id, d]) => snap(id, d)) };
        },
        doc(/** @type {string} */ id) {
          return { samling: n, id, get: async () => snap(id, sam(n).get(id)) };
        },
      };
      return fraga;
    },
    async runTransaction(/** @type {(tx: any) => Promise<any>} */ fn) {
      db.transaktioner += 1;
      /** @type {Array<() => void>} */
      const skrivningar = [];
      const tx = {
        get: async (/** @type {any} */ ref) => snap(ref.id, sam(ref.samling).get(ref.id)),
        update: (/** @type {any} */ ref, /** @type {any} */ data) => skrivningar.push(() => sam(ref.samling).set(ref.id, { ...sam(ref.samling).get(ref.id), ...data })),
      };
      const svar = await fn(tx);
      for (const s of skrivningar) s();
      return svar;
    },
    las: (/** @type {string} */ n, /** @type {string} */ id) => sam(n).get(id),
  };
  return db;
}

const NU = U("2026-11-23T05:20:00Z");
const SAMLING = "appensJobb";
const jobbet = (/** @type {Record<string, any>} */ extra = {}) => ({ groupId: "g1", typ: "bank", lage: "skarp", schema: { steg: "dag", tid: "06:15" }, nastaKorning: U("2026-11-23T05:15:00Z"), ...extra });

describe("tilldelaJobb", () => {
  it("tar ett förfallet jobb: låset bär tidsgränsen och körningens id", async () => {
    const db = minnesDb({ [SAMLING]: { a: jobbet() } });
    const svar = await tilldelaJobb({ db, samling: SAMLING, jobbId: "a", nu: NU, tidsgransMs: 60_000 });
    expect(svar?.korningId).toBe("a@2026-11-23T05:15:00.000Z");
    expect(svar?.jobb.id).toBe("a");
    expect(db.las(SAMLING, "a").las).toEqual({ till: U("2026-11-23T05:21:00Z"), korning: "a@2026-11-23T05:15:00.000Z" });
  });

  it("hoppar över ett giltigt lås, men tar ett som löpt ut", async () => {
    const db = minnesDb({ [SAMLING]: { a: jobbet({ las: { till: U("2026-11-23T05:25:00Z"), korning: "x" } }), b: jobbet({ las: { till: U("2026-11-23T05:19:00Z"), korning: "x" } }) } });
    expect(await tilldelaJobb({ db, samling: SAMLING, jobbId: "a", nu: NU })).toBeNull();
    expect(db.las(SAMLING, "a").las.korning).toBe("x");
    expect((await tilldelaJobb({ db, samling: SAMLING, jobbId: "b", nu: NU }))?.korningId).toBe("b@2026-11-23T05:15:00.000Z");
  });

  it("tar inte ett jobb som inte är förfallet, är av eller saknas; direkt tar ett som inte är förfallet men aldrig ett avslaget", async () => {
    const db = minnesDb({ [SAMLING]: { senare: jobbet({ nastaKorning: U("2026-11-24T05:15:00Z") }), av: jobbet({ lage: "av" }), utan: jobbet({ nastaKorning: null }) } });
    expect(await tilldelaJobb({ db, samling: SAMLING, jobbId: "senare", nu: NU })).toBeNull();
    expect(await tilldelaJobb({ db, samling: SAMLING, jobbId: "av", nu: NU })).toBeNull();
    expect(await tilldelaJobb({ db, samling: SAMLING, jobbId: "utan", nu: NU })).toBeNull();
    expect(await tilldelaJobb({ db, samling: SAMLING, jobbId: "finns-inte", nu: NU })).toBeNull();
    expect((await tilldelaJobb({ db, samling: SAMLING, jobbId: "senare", nu: NU, direkt: true }))?.korningId).toBe("senare@2026-11-23T05:20:00.000Z");
    expect(await tilldelaJobb({ db, samling: SAMLING, jobbId: "av", nu: NU, direkt: true })).toBeNull();
  });

  it("kastar utan db eller samling: ramverket känner inga", async () => {
    await expect(tilldelaJobb({ db: {}, samling: SAMLING, jobbId: "a", nu: NU })).rejects.toThrow(/Firestore-lik db/);
    await expect(tilldelaJobb({ db: minnesDb(), samling: "", jobbId: "a", nu: NU })).rejects.toThrow(/samlingens namn/);
  });
});

describe("slutforJobb", () => {
  it("skriver senast och nästa körning och släpper låset när körningen är låsets", async () => {
    const db = minnesDb({ [SAMLING]: { a: jobbet({ las: { till: U("2026-11-23T05:30:00Z"), korning: "k1" } }) } });
    const skrivet = await slutforJobb({ db, samling: SAMLING, jobbId: "a", korningId: "k1", utfall: { utfall: "ok", paborjat: 12, bekraftat: 12 }, nu: NU });
    expect(skrivet).toEqual({ tid: NU, utfall: "ok", paborjat: 12, bekraftat: 12 });
    const d = db.las(SAMLING, "a");
    expect(d.las).toBeNull();
    expect(d.senast).toEqual({ tid: NU, utfall: "ok", paborjat: 12, bekraftat: 12 });
    expect(d.nastaKorning).toEqual(U("2026-11-24T05:15:00Z"));
  });

  it("gör ingenting med fel körnings-id", async () => {
    const db = minnesDb({ [SAMLING]: { a: jobbet({ las: { till: U("2026-11-23T05:30:00Z"), korning: "k2" } }) } });
    expect(await slutforJobb({ db, samling: SAMLING, jobbId: "a", korningId: "k1", utfall: { utfall: "ok" }, nu: NU })).toBeNull();
    const d = db.las(SAMLING, "a");
    expect(d.las.korning).toBe("k2");
    expect(d.senast).toBeUndefined();
    expect(d.nastaKorning).toEqual(U("2026-11-23T05:15:00Z"));
  });

  it("vitlistar senast: inga texter, belopp eller nycklar kan lagras", () => {
    const smutsigt = { utfall: "fel", paborjat: 3, bekraftat: -1, kod: "Banken svarade: konto 1234 saldo 5000 kr", meddelande: "hemligt", belopp: 5000, nyckel: "sk_live_x" };
    expect(vitlistaUtfall(smutsigt, NU)).toEqual({ tid: NU, utfall: "fel", paborjat: 3 });
    expect(vitlistaUtfall({ utfall: "ok", paborjat: 2.5, bekraftat: "12", kod: "bank-tak" }, NU)).toEqual({ tid: NU, utfall: "ok", kod: "bank-tak" });
    expect(vitlistaUtfall({ utfall: "klart" }, NU)).toEqual({ tid: NU, utfall: "fel", kod: "okant-utfall" });
    expect(vitlistaUtfall(undefined, NU)).toEqual({ tid: NU, utfall: "fel", kod: "okant-utfall" });
    expect(vitlistaUtfall({ utfall: "ok", kod: "x".repeat(41) }, NU)).toEqual({ tid: NU, utfall: "ok" });
  });

  it("ett schema som inte går att läsa stoppar jobbet synligt: ingen nästa körning, fel med koden ogiltigt-schema", async () => {
    const db = minnesDb({ [SAMLING]: { a: jobbet({ schema: { steg: "sekund" }, las: { till: U("2026-11-23T05:30:00Z"), korning: "k1" } }) } });
    await slutforJobb({ db, samling: SAMLING, jobbId: "a", korningId: "k1", utfall: { utfall: "ok" }, nu: NU });
    const d = db.las(SAMLING, "a");
    expect(d.nastaKorning).toBeNull();
    expect(d.senast).toEqual({ tid: NU, utfall: "fel", kod: "ogiltigt-schema" });
    expect(d.las).toBeNull();
  });
});

describe("korForfallnaJobb", () => {
  it("kör varje förfallet jobb, går vidare efter en typ som kastar, och räknar påbörjade och bekräftade", async () => {
    const db = minnesDb({
      [SAMLING]: {
        ok: jobbet({ typ: "bank" }),
        kastar: jobbet({ typ: "trasig" }),
        okand: jobbet({ typ: "finns-inte" }),
        hoppar: jobbet({ typ: "tom", lage: "prov" }),
        senare: jobbet({ nastaKorning: U("2026-11-24T05:15:00Z") }),
        av: jobbet({ lage: "av" }),
        last: jobbet({ las: { till: U("2026-11-23T06:00:00Z"), korning: "annan" } }),
      },
    });
    const bank = vi.fn(async () => ({ utfall: "ok", paborjat: 12, bekraftat: 12, saldo: 5000 }));
    const tom = vi.fn(async () => ({ utfall: "hoppad", kod: "inget-nytt" }));
    const onFel = vi.fn();
    const fel = Object.assign(new Error("Banken: konto 1234"), { kod: "bank-nere" });
    const typer = { bank: { kor: bank }, trasig: { kor: async () => { throw fel; } }, tom: { kor: tom } };
    const rapport = await korForfallnaJobb({ db, samling: SAMLING, nu: NU, typer, onFel });

    expect(rapport).toEqual({ paborjade: 4, bekraftade: 4, fel: 1, hoppade: 2 });
    expect(bank).toHaveBeenCalledWith(expect.objectContaining({ id: "ok" }), { lage: "skarp", korningId: "ok@2026-11-23T05:15:00.000Z" });
    expect(tom).toHaveBeenCalledWith(expect.objectContaining({ id: "hoppar" }), { lage: "prov", korningId: "hoppar@2026-11-23T05:15:00.000Z" });
    expect(onFel).toHaveBeenCalledWith("kastar", fel);
    expect(db.las(SAMLING, "ok").senast).toEqual({ tid: NU, utfall: "ok", paborjat: 12, bekraftat: 12 });
    expect(db.las(SAMLING, "kastar").senast).toEqual({ tid: NU, utfall: "fel", kod: "bank-nere" });
    expect(db.las(SAMLING, "okand").senast).toEqual({ tid: NU, utfall: "hoppad", kod: "okand-typ" });
    expect(db.las(SAMLING, "hoppar").senast).toEqual({ tid: NU, utfall: "hoppad", kod: "inget-nytt" });
    for (const id of ["ok", "kastar", "okand", "hoppar"]) {
      expect(db.las(SAMLING, id).las).toBeNull();
      expect(db.las(SAMLING, id).nastaKorning).toEqual(U("2026-11-24T05:15:00Z"));
    }
    expect(db.las(SAMLING, "senare").senast).toBeUndefined();
    expect(db.las(SAMLING, "av").senast).toBeUndefined();
    expect(db.las(SAMLING, "last").las.korning).toBe("annan");
  });

  it("ett undantag utan kod blir koden undantag, och ett fel i skrivningen räknas som påbörjat men inte bekräftat", async () => {
    const db = minnesDb({ [SAMLING]: { a: jobbet({ typ: "trasig" }), b: jobbet({ typ: "bank" }) } });
    const typer = { trasig: { kor: async () => { throw new Error("hemlig text"); } }, bank: { kor: async () => ({ utfall: "ok" }) } };
    const rapport = await korForfallnaJobb({ db, samling: SAMLING, nu: NU, typer });
    expect(rapport).toEqual({ paborjade: 2, bekraftade: 2, fel: 1, hoppade: 0 });
    expect(db.las(SAMLING, "a").senast).toEqual({ tid: NU, utfall: "fel", kod: "undantag" });

    const db2 = minnesDb({ [SAMLING]: { a: jobbet() } });
    const riktig = db2.runTransaction;
    let varv = 0;
    db2.runTransaction = async (fn) => {
      varv += 1;
      if (varv === 2) throw new Error("databasen svarade inte");
      return riktig(fn);
    };
    const onFel = vi.fn();
    const r2 = await korForfallnaJobb({ db: db2, samling: SAMLING, nu: NU, typer: { bank: { kor: async () => ({ utfall: "ok" }) } }, onFel });
    expect(r2).toEqual({ paborjade: 1, bekraftade: 0, fel: 1, hoppade: 0 });
    expect(onFel).toHaveBeenCalledWith("a", expect.any(Error));
  });

  it("en körning vars lås hann tas av ett annat varv räknas som påbörjad men inte bekräftad, och skriver inget", async () => {
    const db = minnesDb({ [SAMLING]: { a: jobbet() } });
    const kor = async () => {
      // Körningen drog över tidsgränsen och nästa varv tog låset under tiden.
      db.las(SAMLING, "a").las = { till: U("2026-11-23T06:00:00Z"), korning: "annat-varv" };
      return { utfall: "ok", paborjat: 1, bekraftat: 1 };
    };
    expect(await korForfallnaJobb({ db, samling: SAMLING, nu: NU, typer: { bank: { kor } } })).toEqual({ paborjade: 1, bekraftade: 0, fel: 0, hoppade: 0 });
    expect(db.las(SAMLING, "a").senast).toBeUndefined();
    expect(db.las(SAMLING, "a").las.korning).toBe("annat-varv");
  });

  it("tar högst max jobb, de äldsta först", async () => {
    const db = minnesDb({ [SAMLING]: { ny: jobbet({ nastaKorning: U("2026-11-23T05:10:00Z") }), gammal: jobbet({ nastaKorning: U("2026-11-22T05:15:00Z") }) } });
    const kor = vi.fn(async () => ({ utfall: "ok" }));
    expect(await korForfallnaJobb({ db, samling: SAMLING, nu: NU, typer: { bank: { kor } }, max: 1 })).toEqual({ paborjade: 1, bekraftade: 1, fel: 0, hoppade: 0 });
    expect(kor).toHaveBeenCalledWith(expect.objectContaining({ id: "gammal" }), expect.anything());
  });
});

describe("korJobbNu", () => {
  it("kör ett jobb som inte är förfallet, och nästa körning räknas från nu", async () => {
    const db = minnesDb({ [SAMLING]: { a: jobbet({ nastaKorning: U("2026-11-24T05:15:00Z") }) } });
    const kor = vi.fn(async () => ({ utfall: "ok", paborjat: 1, bekraftat: 1 }));
    const svar = await korJobbNu({ db, samling: SAMLING, jobbId: "a", nu: NU, typer: { bank: { kor } } });
    expect(svar).toEqual({ senast: { tid: NU, utfall: "ok", paborjat: 1, bekraftat: 1 }, bekraftad: true });
    expect(kor).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), { lage: "skarp", korningId: "a@2026-11-23T05:20:00.000Z" });
    expect(db.las(SAMLING, "a").nastaKorning).toEqual(U("2026-11-24T05:15:00Z"));
  });

  it("svarar null för ett låst eller avslaget jobb, och kör inte typen", async () => {
    const db = minnesDb({ [SAMLING]: { last: jobbet({ las: { till: U("2026-11-23T06:00:00Z"), korning: "x" } }), av: jobbet({ lage: "av" }) } });
    const kor = vi.fn();
    expect(await korJobbNu({ db, samling: SAMLING, jobbId: "last", nu: NU, typer: { bank: { kor } } })).toBeNull();
    expect(await korJobbNu({ db, samling: SAMLING, jobbId: "av", nu: NU, typer: { bank: { kor } } })).toBeNull();
    expect(kor).not.toHaveBeenCalled();
  });
});
