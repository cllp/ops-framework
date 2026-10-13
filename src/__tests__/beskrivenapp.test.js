import { describe, expect, it } from "vitest";
import {
  BESKRIVENAPPDATAFALT,
  BESKRIVNINGSDOKUMENTFALT,
  BESKRIVNINGSFALT,
  FALTTYPER,
  MAX_APPBESKRIVNING,
  MAX_BESKRIVNINGSNAMN,
  MAX_FALT,
  MAX_LISTOR,
  MAX_VAL,
  beskrivningsId,
  byggBeskrivningsdokument,
  validateBeskrivning,
  validateRad,
} from "../lib/beskrivenapp.js";
import { modulinstallningsId } from "../lib/modulinstallningar.js";

/** Utlåningen: exemplet ur beslut 0005 och ur nattens plan (lifehub.app#213). */
const utlaning = () => ({
  format: 1,
  id: "utlaning",
  namn: "Utlåning",
  ikon: "book",
  beskrivning: "Vad som är utlånat, till vem, och när det ska tillbaka.",
  listor: [
    {
      id: "saker",
      namn: "Saker",
      falt: [
        { id: "namn", namn: "Sak", typ: "text", krav: true },
        { id: "lanad-av", namn: "Lånad av", typ: "person" },
        { id: "tillbaka", namn: "Tillbaka", typ: "datum" },
        { id: "skick", namn: "Skick", typ: "val", val: ["Bra", "Sliten", "Trasig"] },
      ],
      rubrikfalt: "namn",
    },
  ],
});

/** @param {unknown} b */
const fel = (b) => {
  const r = validateBeskrivning(b);
  if (r.ok) throw new Error("beskrivningen godkändes, men skulle avvisas");
  return r.fel;
};

/** En beskrivning där `andra` ändrar listan, för att pröva ETT fel i taget. */
const medLista = (/** @type {(l: any) => void} */ andra) => {
  const b = utlaning();
  andra(b.listor[0]);
  return b;
};

describe("validateBeskrivning: det giltiga", () => {
  it("godkänner utlåningen och ger den normaliserad", () => {
    const r = validateBeskrivning(utlaning());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.beskrivning.id).toBe("utlaning");
    const lista = r.beskrivning.listor[0];
    // krav och visning är alltid satta i den normaliserade formen, så att ingen läsare behöver gissa ett förval.
    expect(lista.visning).toBe("lista");
    expect(lista.falt.map((f) => f.krav)).toEqual([true, false, false, false]);
    expect(lista.falt[3].val).toEqual(["Bra", "Sliten", "Trasig"]);
    // val finns bara på typen val.
    expect(lista.falt[0]).not.toHaveProperty("val");
  });

  it("är idempotent: en normaliserad beskrivning ger sig själv", () => {
    const forsta = validateBeskrivning(utlaning());
    expect(forsta.ok).toBe(true);
    if (!forsta.ok) return;
    const andra = validateBeskrivning(forsta.beskrivning);
    expect(andra).toEqual(forsta);
  });

  it("trimmar texter men rör inte id", () => {
    const b = utlaning();
    b.namn = "  Utlåning  ";
    b.listor[0].falt[3].val = [" Bra ", "Sliten"];
    const r = validateBeskrivning(b);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.beskrivning.namn).toBe("Utlåning");
    expect(r.beskrivning.listor[0].falt[3].val).toEqual(["Bra", "Sliten"]);
    b.id = " utlaning";
    expect(fel(b)[0]).toMatch(/^id: /);
  });

  it("godkänner gränserna: 2 och 40 tecken i ett id, 60 i ett namn, 5 listor, 20 fält, 2 och 30 alternativ", () => {
    const b = utlaning();
    b.id = "ab";
    b.namn = "n".repeat(MAX_BESKRIVNINGSNAMN);
    b.beskrivning = "b".repeat(MAX_APPBESKRIVNING);
    b.listor = Array.from({ length: MAX_LISTOR }, (_, i) => ({
      id: `lista-${i}`,
      namn: "L",
      rubrikfalt: "f-0",
      visning: i % 2 ? "tabell" : "lista",
      falt: Array.from({ length: MAX_FALT }, (_, j) => ({ id: `f-${j}`, namn: "F", typ: j === 0 ? "text" : "val", ...(j === 0 ? {} : { val: Array.from({ length: j % 2 ? 2 : MAX_VAL }, (_, k) => `a${k}`) }) })),
    }));
    b.listor[0].id = "x".repeat(40);
    expect(validateBeskrivning(b).ok).toBe(true);
  });

  it("alla åtta fälttyper går att beskriva", () => {
    const b = utlaning();
    b.listor[0].falt = FALTTYPER.map((typ) => ({ id: `f-${typ}`, namn: typ, typ, ...(typ === "val" ? { val: ["a", "b"] } : {}) }));
    b.listor[0].rubrikfalt = "f-text";
    expect(validateBeskrivning(b).ok).toBe(true);
  });
});

describe("validateBeskrivning: det som avvisas", () => {
  it("säger vad som är fel på ett sätt en agent kan rätta efter, med sökvägen först", () => {
    const b = utlaning();
    b.listor[0].falt.splice(2, 0, { id: "antal", namn: "Antal", typ: /** @type {any} */ ("siffra") });
    expect(fel(b)).toEqual(['listor[0].falt[2].typ: okänd typ "siffra". Giltiga: text, langtext, tal, datum, val, janej, lank, person.']);
  });

  it("samlar ALLA fel och inte bara det första", () => {
    const b = /** @type {any} */ (utlaning());
    b.format = 2;
    b.id = "Fel_Id";
    b.listor[0].falt[0].typ = "siffra";
    b.listor[0].falt[1].extra = 1;
    const f = fel(b);
    expect(f.length).toBeGreaterThanOrEqual(4);
    expect(f.some((x) => x.startsWith("format:"))).toBe(true);
    expect(f.some((x) => x.startsWith("id:"))).toBe(true);
    expect(f.some((x) => x.startsWith("listor[0].falt[0].typ:"))).toBe(true);
    expect(f.some((x) => x.startsWith("listor[0].falt[1].extra:"))).toBe(true);
  });

  it("avvisar allt som inte är ett objekt", () => {
    for (const v of [null, undefined, "text", 3, [], true]) {
      expect(fel(v)[0]).toMatch(/^beskrivningen: måste vara ett objekt/);
    }
  });

  it("okända fält är fel överallt: i beskrivningen, i en lista och i ett fält", () => {
    const b = /** @type {any} */ (utlaning());
    b.farg = "röd";
    b.listor[0].sortering = "namn";
    b.listor[0].falt[0].default = "x";
    expect(fel(b).sort()).toEqual([
      `farg: okänt fält. Tillåtna fält: ${BESKRIVNINGSFALT.join(", ")}.`,
      "listor[0].falt[0].default: okänt fält. Tillåtna fält: id, namn, typ, krav, val.",
      "listor[0].sortering: okänt fält. Tillåtna fält: id, namn, falt, rubrikfalt, visning.",
    ].sort());
  });

  it("formatet ska vara talet 1", () => {
    for (const v of [2, "1", 0, null]) {
      const b = /** @type {any} */ (utlaning());
      b.format = v;
      expect(fel(b)[0]).toMatch(/^format: måste vara talet 1/);
    }
    const b = /** @type {any} */ (utlaning());
    delete b.format;
    expect(fel(b)[0]).toBe("format: krävs. Skriv talet 1.");
  });

  it("ett id är en slug: små bokstäver, siffror, bindestreck, 2 till 40 tecken, börjar med en bokstav", () => {
    for (const id of ["Utlaning", "utlån", "lanad_av", "1saker", "-saker", "a", "x".repeat(41), "med mellanslag", "", "a.b"]) {
      const b = /** @type {any} */ (utlaning());
      b.id = id;
      expect(fel(b)[0], `id ${JSON.stringify(id)}`).toMatch(/^id: .* är inget giltigt id/);
    }
    const b = /** @type {any} */ (utlaning());
    delete b.id;
    expect(fel(b)[0]).toMatch(/^id: krävs/);
  });

  it("namn: 1 till 60 tecken, en rad", () => {
    for (const namn of ["", "   ", "n".repeat(MAX_BESKRIVNINGSNAMN + 1), "två\nrader", "tab\tbar"]) {
      const b = utlaning();
      b.namn = namn;
      expect(fel(b)[0], JSON.stringify(namn)).toMatch(/^namn: /);
    }
    const b = /** @type {any} */ (utlaning());
    b.namn = 5;
    expect(fel(b)[0]).toBe("namn: måste vara text, inte ett tal.");
  });

  it("ikon: ett namn ur gruppikonernas katalog, med förslag när den är okänd", () => {
    const b = utlaning();
    b.ikon = "bokhylla";
    expect(fel(b)[0]).toMatch(/^ikon: okänd ikon "bokhylla"\. Använd ett namn ur gruppikonernas katalog \(GRUPPIKONKATALOG\), till exempel /);
    b.ikon = "tool";
    // Ett ord som leder till en riktig ikon föreslår den.
    const f = fel(b)[0];
    expect(f).toMatch(/^ikon: okänd ikon "tool"/);
    expect(f).toMatch(/"(wrench|tool-case|hammer)"/);
    const utan = /** @type {any} */ (utlaning());
    delete utan.ikon;
    expect(fel(utan)[0]).toMatch(/^ikon: krävs\. Ett ikonnamn/);
    // Ett äldre grupp-id ("grupp") är ett gammalt värde i en grupp och inte ett ikonnamn.
    utan.ikon = "grupp";
    expect(fel(utan)[0]).toMatch(/^ikon: okänd ikon/);
  });

  it("beskrivning krävs men får vara tom, högst 500 tecken", () => {
    const b = /** @type {any} */ (utlaning());
    delete b.beskrivning;
    expect(fel(b)[0]).toBe('beskrivning: krävs. Skriv "" om appen inte behöver någon beskrivning.');
    b.beskrivning = "";
    expect(validateBeskrivning(b).ok).toBe(true);
    b.beskrivning = "x".repeat(MAX_APPBESKRIVNING + 1);
    expect(fel(b)[0]).toMatch(/^beskrivning: är för lång, 501 tecken\. Högst 500\./);
    b.beskrivning = "rad ett\nrad två";
    expect(validateBeskrivning(b).ok).toBe(true);
    b.beskrivning = "styr\u0007tecken";
    expect(fel(b)[0]).toMatch(/^beskrivning: får inte innehålla styrtecken/);
  });

  it("listor: 1 till 5, och varje lista är ett objekt", () => {
    const b = /** @type {any} */ (utlaning());
    b.listor = [];
    expect(fel(b)[0]).toBe("listor: har 0 listor. Det ska vara 1 till 5.");
    b.listor = Array.from({ length: 6 }, (_, i) => ({ id: `l-${i}` }));
    expect(fel(b)[0]).toBe("listor: har 6 listor. Det ska vara 1 till 5.");
    b.listor = "saker";
    expect(fel(b)[0]).toBe("listor: måste vara en lista, inte text.");
    b.listor = [null];
    expect(fel(b)[0]).toMatch(/^listor\[0\]: måste vara ett objekt/);
    delete b.listor;
    expect(fel(b)[0]).toMatch(/^listor: krävs/);
  });

  it("två listor eller två fält med samma id är fel, med sökvägen till det andra", () => {
    const b = /** @type {any} */ (utlaning());
    b.listor.push({ ...b.listor[0] });
    expect(fel(b)).toContain('listor[1].id: listan "saker" står två gånger. Varje id ska vara unikt.');
    const c = /** @type {any} */ (utlaning());
    c.listor[0].falt.push({ id: "namn", namn: "Igen", typ: "text" });
    expect(fel(c)).toEqual(['listor[0].falt[4].id: fältet "namn" står två gånger. Varje id ska vara unikt.']);
  });

  it("fält: 1 till 20 per lista", () => {
    const tom = medLista((l) => {
      l.falt = [];
    });
    expect(fel(tom)).toContain("listor[0].falt: har 0 fält. Det ska vara 1 till 20.");
    const manga = medLista((l) => {
      l.falt = Array.from({ length: MAX_FALT + 1 }, (_, i) => ({ id: `f-${i}`, namn: "F", typ: "text" }));
      l.rubrikfalt = "f-0";
    });
    expect(fel(manga)).toEqual([`listor[0].falt: har ${MAX_FALT + 1} fält. Det ska vara 1 till 20.`]);
  });

  it("krav är true eller false", () => {
    const b = medLista((l) => {
      l.falt[1].krav = "ja";
    });
    expect(fel(b)).toEqual(["listor[0].falt[1].krav: måste vara true eller false, inte text."]);
  });

  it("val krävs på typen val, 2 till 30 alternativ, unika, högst 60 tecken", () => {
    const utanVal = medLista((l) => {
      delete l.falt[3].val;
    });
    expect(fel(utanVal)[0]).toMatch(/^listor\[0\]\.falt\[3\]\.val: krävs för typen val\./);
    const ett = medLista((l) => {
      l.falt[3].val = ["Bra"];
    });
    expect(fel(ett)).toEqual(["listor[0].falt[3].val: har 1 alternativ. Det ska vara 2 till 30."]);
    const manga = medLista((l) => {
      l.falt[3].val = Array.from({ length: MAX_VAL + 1 }, (_, i) => `a${i}`);
    });
    expect(fel(manga)).toEqual(["listor[0].falt[3].val: har 31 alternativ. Det ska vara 2 till 30."]);
    const dubbel = medLista((l) => {
      l.falt[3].val = ["Bra", "Sliten", " Bra "];
    });
    expect(fel(dubbel)).toEqual(['listor[0].falt[3].val[2]: "Bra" står två gånger. Varje alternativ ska vara unikt.']);
    const lang = medLista((l) => {
      l.falt[3].val = ["Bra", "x".repeat(61)];
    });
    expect(fel(lang)[0]).toMatch(/^listor\[0\]\.falt\[3\]\.val\[1\]: är för lång, 61 tecken\. Högst 60\./);
    const fel1 = medLista((l) => {
      l.falt[3].val = ["Bra", 3];
    });
    expect(fel(fel1)).toEqual(["listor[0].falt[3].val[1]: måste vara text, inte ett tal."]);
    const inteLista = medLista((l) => {
      l.falt[3].val = "Bra";
    });
    expect(fel(inteLista)).toEqual(["listor[0].falt[3].val: måste vara en lista med alternativ, inte text."]);
  });

  it("val hör bara till typen val", () => {
    const b = medLista((l) => {
      l.falt[0].val = ["a", "b"];
    });
    expect(fel(b)).toEqual(['listor[0].falt[0].val: hör bara till typen val, inte "text". Ta bort fältet.']);
  });

  it("rubrikfältet krävs, måste finnas och måste vara av typen text", () => {
    const saknas = medLista((l) => {
      delete l.rubrikfalt;
    });
    expect(fel(saknas)[0]).toMatch(/^listor\[0\]\.rubrikfalt: krävs\./);
    const finnsInte = medLista((l) => {
      l.rubrikfalt = "titel";
    });
    expect(fel(finnsInte)).toEqual(['listor[0].rubrikfalt: "titel" finns inte bland fälten i listan. Fälten: namn, lanad-av, tillbaka, skick.']);
    const fel1 = medLista((l) => {
      l.rubrikfalt = "tillbaka";
    });
    expect(fel(fel1)).toEqual(['listor[0].rubrikfalt: "tillbaka" är av typen datum. Rubrikfältet måste vara av typen text.']);
    // Ett långt textfält är ingen rubrik: rubriken är en rad.
    const lang = medLista((l) => {
      l.falt[0].typ = "langtext";
    });
    expect(fel(lang)[0]).toMatch(/är av typen langtext\. Rubrikfältet måste vara av typen text\./);
  });

  it("ett fält med eget fel ger inte ett missvisande 'finns inte' på rubrikfältet", () => {
    const b = medLista((l) => {
      l.falt[0].typ = "siffra";
    });
    const f = fel(b);
    expect(f).toEqual(['listor[0].falt[0].typ: okänd typ "siffra". Giltiga: text, langtext, tal, datum, val, janej, lank, person.']);
  });

  it("visning är lista eller tabell, och lista när den utelämnas", () => {
    const tabell = medLista((l) => {
      l.visning = "tabell";
    });
    const r = validateBeskrivning(tabell);
    expect(r.ok && r.beskrivning.listor[0].visning).toBe("tabell");
    const fel1 = medLista((l) => {
      l.visning = "kort";
    });
    expect(fel(fel1)).toEqual(['listor[0].visning: okänd visning "kort". Giltiga: lista, tabell. Utelämnad blir den lista.']);
  });

  it("skriver ut högst 25 fel och räknar resten", () => {
    const b = /** @type {any} */ ({ a: 1, b: 1, c: 1, listor: Array.from({ length: 5 }, () => ({})) });
    const f = fel(b);
    // 3 okända fält, 5 obligatoriska i beskrivningen (format, id, namn, ikon, beskrivning) och 4 per tom lista.
    expect(f.length).toBe(25 + 1);
    expect(f[25]).toMatch(/^\.\.\.och \d+ fel till\./);
  });
});

describe("validateRad", () => {
  const B = utlaning();

  /** @param {Record<string, unknown>} varden */
  const ok = (varden) => {
    const r = validateRad(B, "saker", varden);
    if (!r.ok) throw new Error(r.fel.join("\n"));
    return r.varden;
  };
  /** @param {Record<string, unknown>} varden */
  const nej = (varden) => {
    const r = validateRad(B, "saker", varden);
    if (r.ok) throw new Error("raden godkändes, men skulle avvisas");
    return r;
  };

  it("godkänner en rad och ger värdena normaliserade", () => {
    expect(ok({ namn: "  Borrmaskin ", "lanad-av": "uid-1", tillbaka: "2026-10-20", skick: "Sliten" })).toEqual({
      namn: "Borrmaskin",
      "lanad-av": "uid-1",
      tillbaka: "2026-10-20",
      skick: "Sliten",
    });
  });

  it("ett krävt fält som saknas, är null eller är tomt är fel, ett frivilligt utelämnas", () => {
    expect(nej({}).fel).toEqual(["varden.namn: krävs."]);
    expect(nej({ namn: "" }).faltfel).toEqual({ namn: "krävs." });
    expect(nej({ namn: "   " }).faltfel).toEqual({ namn: "krävs." });
    expect(nej({ namn: null }).faltfel).toEqual({ namn: "krävs." });
    expect(ok({ namn: "Hammare", skick: "", tillbaka: null, "lanad-av": undefined })).toEqual({ namn: "Hammare" });
  });

  it("okända fält är fel, med fälten som finns", () => {
    const r = nej({ namn: "Sak", farg: "röd" });
    expect(r.fel).toEqual(['varden.farg: okänt fält i listan "saker". Fälten: namn, lanad-av, tillbaka, skick.']);
    expect(r.faltfel.farg).toMatch(/^okänt fält/);
    // Ett nyckelnamn som kunde peka på prototypen är också bara ett okänt fält.
    const proto = JSON.parse('{"namn":"Sak","__proto__":{"x":1}}');
    expect(nej(proto).fel[0]).toMatch(/^varden\.__proto__: okänt fält/);
  });

  it("listan måste finnas och värdena måste vara ett objekt", () => {
    expect(validateRad(B, "andra", {})).toEqual({ ok: false, fel: ['lista: "andra" finns inte i appen. Listor: saker.'], faltfel: {} });
    for (const v of [null, undefined, [], "text", 4]) {
      const r = validateRad(B, "saker", v);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.fel[0]).toMatch(/^varden: måste vara ett objekt/);
    }
  });

  it("en beskrivning som inte håller ger ett fel och inte en tyst godkänd rad", () => {
    const r = validateRad({ ...utlaning(), format: 7 }, "saker", { namn: "x" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.fel[0]).toMatch(/^beskrivningen: är ogiltig\. format:/);
  });

  describe("fälttyperna", () => {
    const typer = {
      format: 1,
      id: "alla",
      namn: "Alla",
      ikon: "book",
      beskrivning: "",
      listor: [
        {
          id: "rader",
          namn: "Rader",
          rubrikfalt: "f-t",
          falt: [
            { id: "f-t", namn: "T", typ: "text" },
            { id: "f-l", namn: "L", typ: "langtext" },
            { id: "f-n", namn: "N", typ: "tal" },
            { id: "f-d", namn: "D", typ: "datum" },
            { id: "f-v", namn: "V", typ: "val", val: ["Ett", "Två"] },
            { id: "f-j", namn: "J", typ: "janej" },
            { id: "f-a", namn: "A", typ: "lank" },
            { id: "f-p", namn: "P", typ: "person" },
          ],
        },
      ],
    };
    /** @param {string} id @param {unknown} varde */
    const prova = (id, varde) => validateRad(typer, "rader", { [id]: varde });
    /** @param {string} id @param {unknown} varde */
    const skal = (id, varde) => {
      const r = prova(id, varde);
      if (r.ok) throw new Error(`${id}=${JSON.stringify(varde)} godkändes`);
      return r.faltfel[id];
    };

    it("text: högst 200 tecken, en rad", () => {
      expect(prova("f-t", "x".repeat(200)).ok).toBe(true);
      expect(skal("f-t", "x".repeat(201))).toBe("är för lång, 201 tecken. Högst 200.");
      expect(skal("f-t", "två\nrader")).toMatch(/^får inte innehålla radbrytning/);
      expect(skal("f-t", 5)).toBe("måste vara text, inte ett tal.");
    });

    it("lång text: högst 4000 tecken, flera rader", () => {
      expect(prova("f-l", `${"x".repeat(100)}\n${"y".repeat(100)}`).ok).toBe(true);
      expect(prova("f-l", "x".repeat(4000)).ok).toBe(true);
      expect(skal("f-l", "x".repeat(4001))).toBe("är för lång, 4001 tecken. Högst 4000.");
      expect(skal("f-l", "styr\u0000tecken")).toBe("får inte innehålla styrtecken.");
    });

    it("tal: ett ändligt tal, och noll är ett tal", () => {
      expect(prova("f-n", 0).ok).toBe(true);
      expect(prova("f-n", -3.5).ok).toBe(true);
      expect(skal("f-n", "12")).toBe('måste vara ett tal, inte "12".');
      expect(skal("f-n", Number.NaN)).toBe("måste vara ett ändligt tal, inte NaN.");
      expect(skal("f-n", Number.POSITIVE_INFINITY)).toBe("måste vara ett ändligt tal, inte Infinity.");
      expect(skal("f-n", true)).toBe("måste vara ett tal, inte sant eller falskt.");
    });

    it("datum: ÅÅÅÅ-MM-DD och ett riktigt kalenderdatum", () => {
      expect(prova("f-d", "2026-10-13").ok).toBe(true);
      expect(prova("f-d", "2024-02-29").ok).toBe(true);
      for (const d of ["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "2026-10-32", "26-10-13", "2026-1-13", "13/10/2026", "2026-10-13T10:00"]) {
        expect(skal("f-d", d), d).toMatch(/inget datum/);
      }
      expect(skal("f-d", 20261013)).toMatch(/^måste vara ett datum som text/);
    });

    it("val: ett av alternativen", () => {
      expect(prova("f-v", "Två").ok).toBe(true);
      expect(skal("f-v", "Tre")).toBe('"Tre" är inget av alternativen. Alternativ: Ett, Två.');
      expect(skal("f-v", 2)).toMatch(/^måste vara ett av alternativen/);
    });

    it("ja/nej: sant eller falskt, och falskt är ett värde", () => {
      expect(prova("f-j", false)).toEqual({ ok: true, varden: { "f-j": false } });
      expect(prova("f-j", true)).toEqual({ ok: true, varden: { "f-j": true } });
      expect(skal("f-j", "ja")).toBe('måste vara sant eller falskt, inte text.');
      expect(skal("f-j", 1)).toBe("måste vara sant eller falskt, inte ett tal.");
    });

    it("länk: http eller https, inga blanksteg, högst 2000 tecken, ingen kodadress", () => {
      expect(prova("f-a", "https://example.com/sida?x=1").ok).toBe(true);
      expect(prova("f-a", "http://example.com").ok).toBe(true);
      for (const a of ["javascript:alert(1)", "data:text/html,hej", "ftp://example.com", "example.com", "https://exa mple.com", "//example.com"]) {
        expect(skal("f-a", a), a).toMatch(/ingen webbadress/);
      }
      expect(skal("f-a", `https://example.com/${"x".repeat(2000)}`)).toMatch(/^är för lång/);
    });

    it("person: ett id som text, högst 128 tecken, inga blanksteg", () => {
      expect(prova("f-p", "uid-1").ok).toBe(true);
      expect(skal("f-p", "två ord")).toMatch(/inget giltigt person-id/);
      expect(skal("f-p", "u".repeat(129))).toMatch(/inget giltigt person-id/);
      expect(skal("f-p", 7)).toMatch(/^måste vara en persons id som text/);
    });
  });
});

describe("dokumentet", () => {
  it("beskrivningsId är samma schema som modulinställningarna: ett schema, inte två", () => {
    expect(beskrivningsId("cps-ab", "utlaning")).toBe(modulinstallningsId("cps-ab", "utlaning"));
    expect(beskrivningsId("cps-ab", "utlaning")).toBe("6~cps-ab~utlaning");
  });

  it("byggBeskrivningsdokument ger id och dokument, och kastar med alla fel när beskrivningen inte håller", () => {
    const d = byggBeskrivningsdokument({
      groupId: "cps-ab",
      beskrivning: utlaning(),
      skapadAv: { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "appar" },
      skapad: 1000,
    });
    expect(d.id).toBe("6~cps-ab~utlaning");
    expect(Object.keys(d.data).sort()).toEqual([...BESKRIVNINGSDOKUMENTFALT].sort());
    expect(d.data.andrad).toBe(1000);
    // Appens id står på ett ställe, i beskrivningen. Dokumentet bär ingen kopia vid sidan av.
    expect(d.data).not.toHaveProperty("id");
    expect(() => byggBeskrivningsdokument({ groupId: "cps-ab", beskrivning: { ...utlaning(), format: 9 }, skapadAv: { uid: "u", typ: "manniska" }, skapad: 1 })).toThrow(/format: måste vara talet 1/);
    expect(() => byggBeskrivningsdokument({ groupId: "", beskrivning: utlaning(), skapadAv: { uid: "u", typ: "manniska" }, skapad: 1 })).toThrow(/groupId krävs/);
  });

  it("fältlistorna är de regeln låser med hasOnly", () => {
    expect([...BESKRIVENAPPDATAFALT]).toEqual(["groupId", "appId", "lista", "varden", "skapadAv", "skapad", "andrad"]);
    expect([...BESKRIVNINGSDOKUMENTFALT]).toEqual(["groupId", "beskrivning", "skapadAv", "skapad", "andrad"]);
  });
});
