import { describe, expect, it } from "vitest";
import { skrivInTal } from "../lib/talkfalt.js";

/*
 * Var det sagda skrivs in (flyttat ur `textfalt-tal.test.jsx` 0.230.0, #602: funktionen bor nu i `lib/talkfalt.js`, och TALK skriver
 * in det sagda i fältet där markören står). Oförändrade prov: logiken är densamma.
 */

describe("skrivInTal", () => {
  it("skriver in vid markören, ersätter en markering och lägger mellanslag där orden annars suttit ihop", () => {
    expect(skrivInTal("Beskriv", null, "en app", undefined)).toEqual({ varde: "Beskriv en app", markor: 14, kapat: "nej" });
    expect(skrivInTal("ab", { start: 1, slut: 1 }, "X", undefined).varde).toBe("a X b");
    expect(skrivInTal("En gammal app", { start: 3, slut: 9 }, "ny", undefined).varde).toBe("En ny app");
    expect(skrivInTal("", null, "hej", undefined)).toEqual({ varde: "hej", markor: 3, kapat: "nej" });
  });

  it("håller maxLength: kapar och säger det, och säger när inget fick plats", () => {
    expect(skrivInTal("abc", null, "defgh", 6)).toEqual({ varde: "abc de", markor: 6, kapat: "kapat" });
    expect(skrivInTal("abcdef", null, "x", 6)).toEqual({ varde: "abcdef", markor: 6, kapat: "fullt" });
  });

  /*
   * ⛔ ÄNDRAT 0.104.0 (granskningen av PR 384, KAN 6). Här stod att `skrivInTal("abcde", null, "x", 6)` ger "fullt". Fältet var inte
   * fullt: "x" fick plats, det var mellanslaget framför som inte gjorde det, och fältet sade "inget av det du sa fick plats".
   *
   * ⛔ ÄNDRAT IGEN 0.104.0 (andra granskningsvarvet av PR 384, BÖR). Rättelsen ovan gav "abcdex": det sagda limmades ihop med ordet
   * före utan besked, vilket är en tyst väg (regel 5). Nu läggs det sagda aldrig in utan avskiljare. Får det bara plats ihop med ett
   * ord utelämnas det, värdet står kvar, och fältet säger sant att det sagda inte fick plats (`fickInte`), inte att fältet är fullt.
   * Båda ändringarna av provet behöver en annan granskare (regel 9).
   */
  it("⛔ får det sagda bara plats ihop med ett ord utelämnas det, och fältet säger att det inte fick plats", () => {
    expect(skrivInTal("abcde", null, "x", 6)).toEqual({ varde: "abcde", markor: 5, kapat: "fickInte" });
  });

  // ⛔ Andra granskningsvarvet av PR 384 (BÖR): de två exemplen granskningen gav, där det sagda limmades ihop med ett ord.
  it("⛔ avskiljaren efter behålls: \"Hej världen\" med \"stora\" vid 4 och 16 tecken limmas inte till \"storavärlden\"", () => {
    const r = skrivInTal("Hej världen", { start: 4, slut: 4 }, "stora", 16);
    expect(r.varde).not.toMatch(/[a-zåäö]världen/);
    expect(r).toEqual({ varde: "Hej stor världen", markor: 9, kapat: "kapat" });
  });

  it("⛔ avskiljare på båda sidor: \"abcd\" med \"xx yy\" vid 2 och 9 tecken blir inte \"abxx yycd\"", () => {
    expect(skrivInTal("abcd", { start: 2, slut: 2 }, "xx yy", 9)).toEqual({ varde: "ab xx cd", markor: 6, kapat: "kapat" });
  });

  it("⛔ en markering som det sagda inte ryms i står kvar: inget tas bort när inget kommer in", () => {
    expect(skrivInTal("abcd", { start: 2, slut: 3 }, "x", 4)).toEqual({ varde: "abcd", markor: 2, kapat: "fickInte" });
  });

  it("⛔ kapningen klipper vid ett ordslut och lämnar inget mellanslag sist", () => {
    expect(skrivInTal("", null, "hej världen", 7)).toEqual({ varde: "hej", markor: 3, kapat: "kapat" });
    expect(skrivInTal("Notera", null, "köp mjölk i dag", 17)).toEqual({ varde: "Notera köp mjölk", markor: 16, kapat: "kapat" });
    // Ett snitt som råkar falla på ett mellanslag lämnar det inte heller kvar.
    expect(skrivInTal("", null, "en två tre", 7)).toEqual({ varde: "en två", markor: 6, kapat: "kapat" });
  });
});
