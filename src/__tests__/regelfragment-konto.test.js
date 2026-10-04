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

  it("utan valet är regeln som förut, med hela fältlistan", () => {
    const regel = anvandarregeln(regelfragment());
    expect(regel).toContain("allow create, update:");
    expect(regel).toContain('"telefon"');
    expect(regel).not.toContain("allow create: if false;");
  });
});
