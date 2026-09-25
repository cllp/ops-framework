import { describe, expect, it } from "vitest";
import { SKAPARTYPER, arGammalForm, byggSkapare, laesSkapare, skaparensNamn } from "../lib/skapare.js";

/**
 * Vem som skapade en post (cllp/ops-framework#106).
 *
 * ⛔ DEN GAMLA FORMEN PROVAS LIKA HÅRT SOM DEN NYA. Hela poängen med läsaren är
 * migreringsordningen: läsaren måste tåla strängen INNAN skrivaren byter, annars
 * visar varje vy tomt för varje omigrerat dokument i samma sekund.
 */

describe("byggSkapare", () => {
  it("bygger hela formen", () => {
    expect(byggSkapare({ uid: "abc123", namn: "CP", typ: "manniska", kalla: "InboxView" })).toEqual({
      uid: "abc123",
      namn: "CP",
      typ: "manniska",
      kalla: "InboxView",
    });
  });

  it("gör ett tomt uid till null, inte till tom sträng", () => {
    /*
     * ⛔ Firestore-regeln jämför `skapadAv.uid == request.auth.uid`. En tom
     * sträng är ett värde, och en regel som råkar jämföra två tomma strängar
     * svarar sant. `null` kan aldrig vara lika med ett uid.
     */
    expect(byggSkapare({ namn: "Importen", typ: "agent", kalla: "import.mjs" }).uid).toBeNull();
    expect(byggSkapare({ uid: "   ", typ: "agent" }).uid).toBeNull();
  });

  it("kastar på en okänd typ i stället för att skriva den vidare", () => {
    // "människa" med ä är stavfelet som ligger närmast till hands.
    expect(() => byggSkapare({ typ: "människa" })).toThrow(/okänd typ/);
    expect(() => byggSkapare({ typ: "human" })).toThrow(/manniska, agent, okand/);
  });

  it("faller till okand när typ inte anges", () => {
    expect(byggSkapare({}).typ).toBe("okand");
  });

  it("har precis tre sorter", () => {
    expect([...SKAPARTYPER]).toEqual(["manniska", "agent", "okand"]);
  });
});

describe("laesSkapare tål båda formerna", () => {
  it("läser den nya formen oförändrad", () => {
    const nytt = { uid: "abc123", namn: "CP", typ: "manniska", kalla: "InboxView" };
    expect(laesSkapare(nytt)).toEqual(nytt);
  });

  it("⛔ läser den gamla strängen som okand, inte som manniska", () => {
    /*
     * Strängen var oftast en e-postadress, men `"ops-agent"` skrevs i SAMMA
     * fält. Att kalla båda människor hade gjort agentens rader omöjliga att
     * skilja ut, alltså förstört precis den spårbarhet fältet byggs om för.
     */
    expect(laesSkapare("claes-philip@staiger.se")).toEqual({
      uid: null,
      namn: "claes-philip@staiger.se",
      typ: "okand",
      kalla: "",
    });
    expect(laesSkapare("ops-agent").typ).toBe("okand");
  });

  it("behåller namnet ur den gamla strängen", () => {
    // En migrering som gör raden tommare än den var läses som att data försvunnit.
    expect(laesSkapare("ops-agent").namn).toBe("ops-agent");
  });

  it("svarar med den tomma formen på null, tomt och skräp", () => {
    for (const v of [null, undefined, "", "   ", 17, [], true]) {
      expect(laesSkapare(v)).toEqual({ uid: null, namn: "", typ: "okand", kalla: "" });
    }
  });

  it("⛔ kastar ALDRIG på ett halvt objekt ur en halvfärdig migrering", () => {
    /*
     * Läsaren körs i en vy. En vy som kastar på en enda trasig rad tar ned hela
     * listan, alltså gör ett fel på en post till ett fel på allt.
     */
    expect(() => laesSkapare({ typ: "människa" })).not.toThrow();
    expect(laesSkapare({ typ: "människa", namn: "CP" })).toEqual({ uid: null, namn: "CP", typ: "okand", kalla: "" });
    expect(laesSkapare({ uid: 17, namn: null })).toEqual({ uid: null, namn: "", typ: "okand", kalla: "" });
  });
});

describe("skaparensNamn", () => {
  it("ger namnet när det finns", () => {
    expect(skaparensNamn({ uid: "abc123", namn: "CP", typ: "manniska", kalla: "" })).toBe("CP");
    expect(skaparensNamn("claes-philip@staiger.se")).toBe("claes-philip@staiger.se");
  });

  it("⛔ faller till uid:ts början och aldrig till hela uid:t", () => {
    // Ett uid är 28 tecken utan mening för en människa, och ett sådant i en
    // metarad ser ut som ett fel.
    expect(skaparensNamn({ uid: "eA2ILzNei5TQ2rcHy68aBZPpR1B3", typ: "manniska" })).toBe("eA2ILzNe");
  });

  it("ger tom sträng när ingenting finns, aldrig ordet okänd", () => {
    // Vad tomheten ska HETA är vyns beslut, inte ramverkets: "Okänd", "Systemet"
    // och ett streck är alla rimliga, och de betyder olika saker i olika appar.
    expect(skaparensNamn(null)).toBe("");
    expect(skaparensNamn({ typ: "okand" })).toBe("");
  });
});

describe("arGammalForm, för bakfyllnaden", () => {
  it("känner igen strängen och bara strängen", () => {
    expect(arGammalForm("claes-philip@staiger.se")).toBe(true);
    expect(arGammalForm({ uid: "abc", typ: "manniska" })).toBe(false);
  });

  it("räknar inte tomt som gammalt, så en omkörning inte rör det", () => {
    // Bakfyllnaden ska vara omkörbar, och en räkning efteråt ska kunna visa noll.
    expect(arGammalForm("")).toBe(false);
    expect(arGammalForm("   ")).toBe(false);
    expect(arGammalForm(null)).toBe(false);
    expect(arGammalForm(undefined)).toBe(false);
  });
});
