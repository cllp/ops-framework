import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GASTGRUPPFUNKTIONER,
  GASTIDFORM,
  GASTINBJUDNINGSIDFORM,
  GASTNYCKELFORM,
  GASTPLATSNUMMER,
  GAST_PLATSER_GRATIS,
  gastId,
  gastLank,
  gastOmfangGer,
  gastStatus,
  gastomfangsnyckel,
  gastplatsId,
  normaliseraGastepost,
  sha256Hex,
  tolkaGastLank,
} from "../lib/gast.js";
import { gastregelfragment } from "../lib/regler.js";
import { gastInbjudningsId } from "../node/gast.js";

/**
 * Gästernas rena del (0.131.0, cllp/lifehub.app#389): hashen, identiteten, länken, platsformerna och statusen.
 *
 * ⛔ VARJE PROV HAR BEVISATS I BÅDA RIKTNINGARNA (arbetsreglerna, punkt 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

const NYCKEL = "A".repeat(43);
const ID = "a".repeat(64);

describe("sha256Hex mot node:crypto", () => {
  it("ger samma svar som node:crypto för 300 texter, också runt blockgränserna", () => {
    const texter = ["", "a", "abc", "åäö", "😀", "é", "Anna@Foretag.se", "x".repeat(1000)];
    // Längderna där utfyllnaden går fel först: 55, 56 (längd i bitar spiller över), 63, 64 och 119/120.
    for (const n of [54, 55, 56, 57, 63, 64, 65, 119, 120, 121, 127, 128]) texter.push("b".repeat(n));
    for (let i = 0; i < 280; i++) texter.push(randomBytes(1 + (i % 150)).toString(i % 2 ? "base64" : "latin1"));
    // Golv: provet mäter 300 texter, inte en tom lista.
    expect(texter.length).toBeGreaterThanOrEqual(300);
    for (const t of texter) {
      expect(sha256Hex(t), JSON.stringify(t).slice(0, 40)).toBe(createHash("sha256").update(t).digest("hex"));
    }
  });
});

describe("normaliseraGastepost", () => {
  it("trimmar och sätter gemener, så samma adress är samma adress", () => {
    expect(normaliseraGastepost("  Anna@Foretag.SE ")).toBe("anna@foretag.se");
  });

  it("avvisar allt som inte går att skicka till: tom, form, blanksteg, styrtecken, för lång och spärrad domän", () => {
    for (const d of [undefined, null, 5, "", "   ", "anna", "anna@", "@x.se", "a b@x.se", "a@x", "a\u0000@x.se", "anna@example.com", `${"a".repeat(250)}@x.se`]) {
      expect(normaliseraGastepost(d), String(d)).toBeNull();
    }
    expect(normaliseraGastepost("anna@exempel.se")).toBe("anna@exempel.se");
    expect(normaliseraGastepost("anna@egen-spar.se", ["egen-spar.se"])).toBeNull();
  });
});

describe("gastId", () => {
  it("är härledd ur den normaliserade adressen, med prefixet g_ och 40 hextecken", () => {
    const id = gastId("Anna@Foretag.se");
    expect(id).toMatch(GASTIDFORM);
    expect(id).toBe(`g_${createHash("sha256").update("anna@foretag.se").digest("hex").slice(0, 40)}`);
    expect(gastId("  anna@foretag.se ")).toBe(id);
    expect(gastId("bertil@foretag.se")).not.toBe(id);
  });

  it("kan inte krocka med ett Firebase-uid: 42 tecken med understreck på plats två, mot 28 utan", () => {
    expect(gastId("anna@foretag.se")).toHaveLength(42);
    expect("abcdefghijklmnopqrstuvwxyz12").not.toMatch(GASTIDFORM);
  });

  it("kastar för något som inte är en adress, så att en felskriven rad aldrig blir en gäst", () => {
    expect(() => gastId("inte en adress")).toThrow(/ingen adress/);
  });
});

describe("omfång och platser", () => {
  it("omfångsnyckeln är sak:rosta:<händelse>, och ett omfång skiva 1 inte känner kastar", () => {
    expect(gastomfangsnyckel({ slag: "sak", funktion: "rosta", handelseId: "h1" })).toBe("sak:rosta:h1");
    for (const o of [null, {}, { slag: "grupp", funktion: "rosta", handelseId: "h" }, { slag: "sak", funktion: "chatta", handelseId: "h" }, { slag: "sak", funktion: "rosta", handelseId: " " }]) {
      expect(() => gastomfangsnyckel(o), JSON.stringify(o)).toThrow();
    }
  });

  it("hela gruppen (0.132.0): omfångsnyckeln är grupp, och ett gruppomfång med något annat fält kastar", () => {
    expect(gastomfangsnyckel({ slag: "grupp" })).toBe("grupp");
    for (const o of [{ slag: "grupp", handelseId: "h1" }, { slag: "grupp", funktion: "rosta" }, { slag: "grupp", groupId: "kallan" }]) {
      expect(() => gastomfangsnyckel(o), JSON.stringify(o)).toThrow(/inga andra fält/);
    }
  });

  it("BEFINTLIGA ID ÄNDRAS ALDRIG: fem id från skiva 1 är fasta hashar, och gruppens id skiljer sig från saken och mellan grupper", () => {
    const sak = (groupId, epost, handelseId) => gastInbjudningsId({ groupId, epost, omfang: { slag: "sak", funktion: "rosta", handelseId } });
    // Hashar av JSON.stringify([grupp, adress, omfångsnyckel]) som skiva 1 (0.131.0) skrev dem. Ändras de har en inbjudan i databasen ett id ingen längre hittar.
    expect(sak("kallan", "anna@foretag.se", "h1")).toBe("7a634d83b3cac8eaf7e97a574769f642258cc45fc7006a92661e16104176510e");
    expect(sak("kallan", "anna@foretag.se", "h2")).toBe("8f58e807502a8bb4f5c879970183cf071911d34b316417e03a38b58d41470ca7");
    expect(sak("kallan", "bo@foretag.se", "h1")).toBe("03f6a912b5c6d33bcec0d2812e4d4080c20d72b0c7d64f003719066559916e48");
    expect(sak("grannen", "anna@foretag.se", "h1")).toBe("4b6b8ddf02d9e8549904e8bc21df8eb77b1ef8cb6fc5b0f0e2bb3816f1d60adf");
    expect(sak("kallan", "anna@foretag.se", "handelse-åäö")).toBe("817b026b25a00d8f31a97c00eaf321f9d5435d24402c6a307ab26d463cc19aae");
    const grupp = (groupId, epost) => gastInbjudningsId({ groupId, epost, omfang: { slag: "grupp" } });
    expect(grupp("kallan", "anna@foretag.se")).toBe("09dfc2a94a6b557c2a7b53b25fdb29dd9432d525b8ae9c8c841170070d6a5e22");
    expect(grupp("grannen", "anna@foretag.se")).toBe("a445dfe7134d94899eb6b73d55e7027043d76778fb46709372dd599466f825e2");
    expect(grupp("kallan", "anna@foretag.se")).not.toBe(sak("kallan", "anna@foretag.se", "h1"));
    // Ett händelse-id som heter "grupp" är fortfarande en sak: nyckeln har tre delar, gruppens har en.
    expect(sak("kallan", "anna@foretag.se", "grupp")).not.toBe(grupp("kallan", "anna@foretag.se"));
  });

  it("gastOmfangGer: bara en gruppinbjudan ger gruppens funktioner, bara en sak ger sin egen, och slaget i kravet måste stämma", () => {
    const grupp = { slag: "grupp" };
    const sak = { slag: "sak", funktion: "rosta", handelseId: "h1" };
    for (const f of GASTGRUPPFUNKTIONER) {
      expect(gastOmfangGer(grupp, { slag: "grupp", funktion: f }), `grupp/${f}`).toBe(true);
      expect(gastOmfangGer(grupp, { funktion: f }), `grupp utan slag/${f}`).toBe(true);
      expect(gastOmfangGer(sak, { slag: "grupp", funktion: f }), `sak/${f}`).toBe(false);
      expect(gastOmfangGer(sak, { funktion: f }), `sak utan slag/${f}`).toBe(false);
    }
    expect(gastOmfangGer(sak, { funktion: "rosta" })).toBe(true);
    expect(gastOmfangGer(sak, { slag: "sak", funktion: "rosta" })).toBe(true);
    expect(gastOmfangGer(grupp, { funktion: "rosta" })).toBe(false);
    expect(gastOmfangGer(grupp, { slag: "sak", funktion: "rosta" })).toBe(false);
    expect(gastOmfangGer(grupp, { slag: "grupp", funktion: "ekonomi" })).toBe(false);
    for (const o of [null, undefined, {}, { slag: "nytt" }, "grupp"]) expect(gastOmfangGer(o, { funktion: "chatt" })).toBe(false);
    for (const k of [null, undefined, {}, { slag: "grupp" }]) expect(gastOmfangGer(grupp, k)).toBe(false);
  });

  it("taket är 5, och platsnumren härleds ur det: 1 till 5, inte en egen lista", () => {
    expect(GAST_PLATSER_GRATIS).toBe(5);
    expect([...GASTPLATSNUMMER]).toEqual([1, 2, 3, 4, 5]);
    expect(gastplatsId("kallan", 5)).toBe("kallan|5");
    expect(() => gastplatsId("kallan", 6)).toThrow(/finns inte/);
    expect(() => gastplatsId("kallan", 0)).toThrow(/finns inte/);
    expect(() => gastplatsId("ka|llan", 1)).toThrow();
    expect(() => gastplatsId("ka/llan", 1)).toThrow();
  });
});

describe("länken", () => {
  it("nyckeln ligger i fragmentet och inte i sökvägen, och tolkas tillbaka", () => {
    const url = gastLank("https://my.life-hub.app/", { id: ID, nyckel: NYCKEL });
    expect(url).toBe(`https://my.life-hub.app/gast#i=${ID}&k=${NYCKEL}`);
    // Ingenting före # bär nyckeln: det är det som loggas, sänds som Referer och hämtas i förväg.
    expect(url.split("#")[0]).not.toContain(NYCKEL);
    expect(tolkaGastLank(new URL(url).hash)).toEqual({ id: ID, nyckel: NYCKEL });
    expect(tolkaGastLank(`i=${ID}&k=${NYCKEL}`)).toEqual({ id: ID, nyckel: NYCKEL });
    expect(tolkaGastLank(`k=${NYCKEL}&i=${ID}`)).toEqual({ id: ID, nyckel: NYCKEL });
  });

  it("en halv eller trasig länk är ingen länk, så sidan frågar efter adressen i stället för att försöka", () => {
    for (const f of [undefined, null, "", "#", `#i=${ID}`, `#k=${NYCKEL}`, `#i=kort&k=${NYCKEL}`, `#i=${ID}&k=kort`, `#i=${"G".repeat(64)}&k=${NYCKEL}`]) {
      expect(tolkaGastLank(f), String(f)).toBeNull();
    }
  });

  it("gastLank kastar för en basadress utan protokoll eller med sökväg, och för en felformad nyckel", () => {
    expect(() => gastLank("my.life-hub.app", { id: ID, nyckel: NYCKEL })).toThrow(/basadressen/);
    expect(() => gastLank("https://my.life-hub.app/app", { id: ID, nyckel: NYCKEL })).toThrow(/basadressen/);
    expect(() => gastLank("https://x.se", { id: "kort", nyckel: NYCKEL })).toThrow();
    expect(GASTNYCKELFORM.test(NYCKEL) && GASTINBJUDNINGSIDFORM.test(ID)).toBe(true);
  });
});

describe("gastStatus: härledd, aldrig lagrad", () => {
  const NU = 1_800_000_000_000;
  const levande = { aterkallad: null, forstInloggad: null, lankGiltigTill: NU + 1000 };
  it("prövas i ordningen återkallad, utgången, har röstat, inloggad, väntar", () => {
    expect(gastStatus({ ...levande }, { nu: NU })).toBe("vantar");
    expect(gastStatus({ ...levande, forstInloggad: NU - 5 }, { nu: NU })).toBe("inloggad");
    expect(gastStatus({ ...levande, forstInloggad: NU - 5 }, { nu: NU, harRostat: true })).toBe("har-rostat");
    expect(gastStatus({ ...levande, lankGiltigTill: NU - 1 }, { nu: NU })).toBe("utgangen");
    expect(gastStatus({ ...levande, aterkallad: NU - 9, forstInloggad: NU - 20 }, { nu: NU, harRostat: true })).toBe("aterkallad");
  });

  it("en länk som gått ut efter att gästen loggat in är inte utgången: åtkomsten är sessionens", () => {
    expect(gastStatus({ ...levande, forstInloggad: NU - 5, lankGiltigTill: NU - 100 }, { nu: NU })).toBe("inloggad");
  });
});

describe("gastregelfragment", () => {
  it("läser för en aktiv person i gruppen och skriver aldrig, och bär bara det ena blocket", () => {
    const f = gastregelfragment("gastinbjudningar");
    expect(f).toContain("match /gastinbjudningar/{id}");
    expect(f).toContain("allow read: if opsArMedlem(resource.data.groupId)");
    expect(f).toContain("opsMedlemskapet(resource.data.groupId).data.typ == 'person'");
    expect(f).toContain("allow write: if false;");
    // Sessionerna, platserna och räknarna har INGEN match: catch-allen nekar dem.
    expect((f.match(/match \//g) ?? []).length).toBe(1);
    expect(f).not.toMatch(/—|–/);
  });

  it("ett samlingsnamn med snedstreck är ingen samling", () => {
    expect(() => gastregelfragment("a/b")).toThrow(/samlingsnamn/);
  });
});
