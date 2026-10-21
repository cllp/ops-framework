import { describe, expect, it } from "vitest";
import { MAX_NYCKELID, MAX_SKAPARNAMN, ORD_SKAPARE, SKAPARFALT, SKAPARFALT_SERVER, VIAFALT, byggSkapare, byggVia, laesSkapare, namnMedVia, skaparensNamn, viaFel } from "../lib/skapare.js";
import { byggMeddelande, MEDDELANDEFALT } from "../lib/samtal.js";
import { byggPost, postFel } from "../lib/bibliotek.js";
import { SPRAK } from "../lib/sprak.js";

/**
 * `via` på skaparen (0.135.0, cllp/lifehub.app#409, CP 2026-10-21 "Ja på alla").
 *
 * En personlig API-nyckel skriver SOM personen, och det den skriver ska alltid synas som skrivet via nyckeln:
 * "Miranda via Byggagent". Proven mäter vad som avvisas och vad som INTE får ändras för den som inte använder fältet.
 */

const via = { nyckelId: "0123456789abcdef", namn: "Byggagent" };
const miranda = { uid: "uid-miranda", namn: "Miranda", typ: "manniska", kalla: "api" };

describe("byggSkapare med via", () => {
  it("utan via är resultatet exakt de fyra fälten som förut, utan en nyckel som heter via", () => {
    const s = byggSkapare(miranda);
    expect(Object.keys(s).sort()).toEqual([...SKAPARFALT].sort());
    expect(Object.hasOwn(s, "via")).toBe(false);
    // null och undefined är "inget via": en server som bygger ur ett dokument utan fältet ska inte behöva grena.
    expect(Object.hasOwn(byggSkapare({ ...miranda, via: null }), "via")).toBe(false);
    expect(Object.hasOwn(byggSkapare({ ...miranda, via: undefined }), "via")).toBe(false);
  });

  it("med via bär stämpeln personen OCH nyckeln, och namnet trimmas", () => {
    const s = byggSkapare({ ...miranda, via: { nyckelId: via.nyckelId, namn: "  Byggagent " } });
    expect(s).toEqual({ ...miranda, via });
    expect(Object.keys(s).sort()).toEqual([...SKAPARFALT_SERVER].sort());
  });

  it("kastar på ett via som inte håller, med skälet", () => {
    const bygg = (/** @type {any} */ v) => () => byggSkapare({ ...miranda, via: v });
    expect(bygg("Byggagent")).toThrow("via ska vara ett objekt");
    expect(bygg([])).toThrow("via ska vara ett objekt");
    expect(bygg({ namn: "Byggagent" })).toThrow("via.nyckelId saknas");
    expect(bygg({ nyckelId: "", namn: "Byggagent" })).toThrow("via.nyckelId saknas");
    expect(bygg({ nyckelId: 17, namn: "Byggagent" })).toThrow("via.nyckelId saknas");
    expect(bygg({ nyckelId: "0123456789ABCDEF", namn: "Byggagent" })).toThrow("gemena hexsiffror");
    expect(bygg({ nyckelId: "lh_0123", namn: "Byggagent" })).toThrow("gemena hexsiffror");
    expect(bygg({ nyckelId: "a".repeat(MAX_NYCKELID + 1), namn: "Byggagent" })).toThrow(`Högst ${MAX_NYCKELID}`);
    expect(bygg({ nyckelId: via.nyckelId })).toThrow("via.namn saknas");
    expect(bygg({ nyckelId: via.nyckelId, namn: "   " })).toThrow("via.namn saknas");
    expect(bygg({ nyckelId: via.nyckelId, namn: "x".repeat(MAX_SKAPARNAMN + 1) })).toThrow(`Högst ${MAX_SKAPARNAMN}`);
    expect(bygg({ ...via, hemlighet: "lh_0123_abc" })).toThrow("hemlighet");
  });

  it("taken håller på gränsen: 64 tecken i id och 100 i namn går igenom", () => {
    expect(() => byggVia({ nyckelId: "f".repeat(MAX_NYCKELID), namn: "x".repeat(MAX_SKAPARNAMN) })).not.toThrow();
    expect(viaFel({ nyckelId: "f".repeat(MAX_NYCKELID), namn: "x".repeat(MAX_SKAPARNAMN) })).toBeNull();
  });

  it("⛔ kräver uid: ett märke om att en nyckel skrev åt ingen är ingen stämpel", () => {
    expect(() => byggSkapare({ namn: "Miranda", typ: "manniska", via })).toThrow("via kräver uid");
    expect(() => byggSkapare({ uid: "  ", namn: "Miranda", typ: "manniska", via })).toThrow("via kräver uid");
  });
});

describe("SKAPARFALT är klientens fält och får inte innehålla via", () => {
  /*
   * ⛔ Regelfragmentens `hasOnly` är HÄRLEDDA ur SKAPARFALT. Lägger någon `via` där öppnas varje regel för en klient som skriver
   * ett märke om att en nyckel skrev raden, eller utelämnar märket på en rad från en nyckel. Provet pekar på just den fällan.
   */
  it("fyra fält, inget av dem via, och serverformen är samma lista plus via", () => {
    expect([...SKAPARFALT]).toEqual(["uid", "namn", "typ", "kalla"]);
    expect(SKAPARFALT).not.toContain("via");
    expect([...SKAPARFALT_SERVER]).toEqual(["uid", "namn", "typ", "kalla", "via"]);
    expect([...VIAFALT]).toEqual(["nyckelId", "namn"]);
  });
});

describe("laesSkapare med via", () => {
  it("tar med via när det finns ett namn, och tål ett skadat id", () => {
    expect(laesSkapare({ ...miranda, via })).toEqual({ ...miranda, via });
    expect(laesSkapare({ ...miranda, via: { namn: "Byggagent" } }).via).toEqual({ nyckelId: "", namn: "Byggagent" });
  });

  it("⛔ tappar via när det inte är ett märke, utan att kasta (en vy som kastar tar ned hela listan)", () => {
    for (const v of [null, undefined, "Byggagent", 17, [], {}, { nyckelId: "x" }, { namn: "  " }]) {
      const s = laesSkapare({ ...miranda, via: v });
      expect(Object.hasOwn(s, "via"), JSON.stringify(v)).toBe(false);
    }
  });

  it("en gammal sträng och ett tomt värde får aldrig ett via", () => {
    expect(Object.hasOwn(laesSkapare("claes-philip@staiger.se"), "via")).toBe(false);
    expect(Object.hasOwn(laesSkapare(null), "via")).toBe(false);
  });

  it("kortar ett för långt nyckelnamn vid taket i stället för att rita det i full längd", () => {
    expect(laesSkapare({ ...miranda, via: { nyckelId: "ab", namn: "y".repeat(500) } }).via?.namn).toHaveLength(MAX_SKAPARNAMN);
  });
});

describe("skaparensNamn och namnMedVia", () => {
  it("ger 'Miranda via Byggagent' när via finns, på båda språken", () => {
    expect(skaparensNamn({ ...miranda, via })).toBe("Miranda via Byggagent");
    expect(skaparensNamn({ ...miranda, via }, "sv")).toBe("Miranda via Byggagent");
    expect(skaparensNamn({ ...miranda, via }, "en")).toBe("Miranda via Byggagent");
  });

  it("ger bara namnet utan via, och är oförändrad för det den gjorde förut", () => {
    expect(skaparensNamn(miranda)).toBe("Miranda");
    expect(skaparensNamn("claes-philip@staiger.se")).toBe("claes-philip@staiger.se");
    expect(skaparensNamn(null)).toBe("");
  });

  it("⛔ tomt namn ger tomt svar även med via: en rad utan person säger inte vem", () => {
    expect(skaparensNamn({ uid: "u", typ: "manniska", via })).toBe("");
    expect(namnMedVia("", via)).toBe("");
  });

  it("namnMedVia sätter ihop ett redan löst namn med via ur raden", () => {
    expect(namnMedVia("Miranda", via, "sv")).toBe("Miranda via Byggagent");
    expect(namnMedVia("Namn saknas", via)).toBe("Namn saknas via Byggagent");
    expect(namnMedVia("Miranda", undefined)).toBe("Miranda");
    expect(namnMedVia("Miranda", { namn: "" })).toBe("Miranda");
  });

  it("ordet 'via' går genom ramverkets textlager: båda språken finns, och ett okänt språk faller till svenska", () => {
    for (const sp of SPRAK) expect(ORD_SKAPARE.via[sp], sp).toBeTruthy();
    expect(namnMedVia("Miranda", via, "xx")).toBe("Miranda via Byggagent");
  });
});

describe("biblioteksposten bär via", () => {
  const tid = 1_700_000_000_000;
  const post = { groupId: "cps-ab", typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade.", skapadAv: miranda, skapad: tid, andrad: tid };

  it("en post utan via är oförändrad", () => {
    expect(postFel(post)).toBeNull();
    expect(Object.hasOwn(byggPost(post).skapadAv, "via")).toBe(false);
  });

  it("en post med via godtas och bär via vidare", () => {
    const p = { ...post, skapadAv: { ...miranda, via } };
    expect(postFel(p)).toBeNull();
    expect(byggPost(p).skapadAv.via).toEqual(via);
  });

  it("⛔ ett via som inte håller ger en TEXT från postFel och kastar i byggPost, aldrig ett undantag ur postFel", () => {
    const p = { ...post, skapadAv: { ...miranda, via: { nyckelId: "XYZ", namn: "Byggagent" } } };
    expect(postFel(p)).toContain("gemena hexsiffror");
    expect(() => byggPost(p)).toThrow("gemena hexsiffror");
  });

  it("en okänd nyckel i skaparen avvisas fortfarande", () => {
    expect(postFel({ ...post, skapadAv: { ...miranda, hemlig: 1 } })).toContain("hemlig");
  });

  it("via utan uid avvisas som en post utan skrivare", () => {
    expect(postFel({ ...post, skapadAv: { namn: "Miranda", typ: "manniska", via } })).toBe("Posten saknar vem som skrev den.");
  });
});

describe("chattmeddelandet bär via", () => {
  it("utan via är meddelandet exakt de tre fälten som förut", () => {
    const m = byggMeddelande({ text: "Hej", av: "uid-miranda", tid: 5 });
    expect(Object.keys(m).sort()).toEqual(["av", "text", "tid"]);
  });

  it("med via bär det via, och ett via som inte håller kastar", () => {
    expect(byggMeddelande({ text: "Hej", av: "uid-miranda", tid: 5, via }).via).toEqual(via);
    expect(() => byggMeddelande({ text: "Hej", av: "uid-miranda", tid: 5, via: { nyckelId: "x y", namn: "B" } })).toThrow("gemena hexsiffror");
  });

  it("⛔ MEDDELANDEFALT har inte via: reglernas hasOnly är härledd ur den, och en klient får inte skriva fältet", () => {
    expect(MEDDELANDEFALT).not.toContain("via");
  });
});
