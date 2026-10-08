import { describe, it, expect } from "vitest";
import { regelfragment } from "../lib/regler.js";

/*
 * 0.53.0, cllp/lifehub.app#32: när ett konto utanför appen äger personen är `users/{uid}` en spegel som appens server
 * skriver. Provet läser regeln för just den samlingen, inte hela texten: ett "allow create: if false" någon annanstans
 * i fragmentet hade annars gjort det grönt. Beteendet i emulatorn provas i appen, som deployar reglerna.
 */
function anvandarregeln(text) {
  const start = text.indexOf("match /users/{uid} {");
  const slut = text.indexOf("\n    }", start);
  expect(start).toBeGreaterThan(-1);
  return text.slice(start, slut);
}

describe("regelfragment, kontot äger personen", () => {
  it("klienten skapar aldrig raden och ändrar bara temat", () => {
    const regel = anvandarregeln(regelfragment({}, { kontoAgerPersonen: true }));
    expect(regel).toContain("allow create: if false;");
    expect(regel).toContain('affectedKeys().hasOnly(["tema"])');
    expect(regel).not.toContain('"telefon"');
  });

  /*
   * ⛔ #313: kontoläget skriver aldrig `epost` från klienten, alltså är det oförändrat. Provet läser att regeln inte
   * fått adressvillkoret, för det hade varit ett tecken på att läget plötsligt släpper in fältet.
   */
  it("⛔ kontoläget är oförändrat av #313: klienten skriver aldrig epost där, och regeln prövar den inte", () => {
    const regel = anvandarregeln(regelfragment({}, { kontoAgerPersonen: true }));
    expect(regel).not.toContain("opsProfilensEpost");
    expect(regel).not.toContain('"epost"');
  });

  it("utan valet är regeln hela fältlistan, och adressen prövas mot inloggningen (#313)", () => {
    const regel = anvandarregeln(regelfragment());
    expect(regel).toContain("allow create, update:");
    expect(regel).toContain("opsProfilensEpost()");
    expect(regel).toContain('"telefon"');
    expect(regel).not.toContain("allow create: if false;");
  });
});
