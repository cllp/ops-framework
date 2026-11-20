import { describe, expect, it } from "vitest";
import { lagringsregelfragment } from "../lib/regler.js";

/**
 * Gruppens bild (0.246.0, cllp/lifehub.app#905). Regeln provas mot emulatorn i appen (`rules/__tests__/gruppbild-905.test.mjs`), där den deployas. Här mäts
 * texten: blocket finns bara med nyckeln, och utan den är fragmentet byte för byte det förra. ⛔ Rött mot 0.245.0: `gruppbilder` lästes inte, och blocket saknades.
 */
describe("lagringsregelfragment med gruppbilder", () => {
  it("⛔ med nyckeln: medlemmar läser, ägare och admin skriver och raderar, bara fyra bildtyper och under 2 MB", () => {
    const t = lagringsregelfragment({ gruppbilder: { prefix: "gruppbilder" } });
    expect(t).toContain("match /gruppbilder/{gid}/{fil} {");
    expect(t).toContain("allow read: if opsGruppbildMedlemskap(gid);");
    expect(t).toContain("allow delete: if opsGruppbildAdmin(gid);");
    expect(t).toContain("data.roll in ['agare', 'admin']");
    expect(t).toContain("contentType.matches('image/(jpeg|png|webp|gif)')");
    expect(t).toContain("request.resource.size < 2 * 1024 * 1024");
    expect(t).toContain("documents/memberships/$(request.auth.uid + '|' + gid)");
  });

  it("utan nyckeln är texten den förra, med och utan bibliotek", () => {
    const bib = { gruppPrefix: "grupper", postPrefix: "bibliotek", samling: "bibliotek" };
    expect(lagringsregelfragment({})).not.toContain("gruppbild");
    expect(lagringsregelfragment({ bibliotek: bib })).not.toContain("gruppbild");
    const med = lagringsregelfragment({ gruppbilder: { prefix: "gruppbilder" }, bibliotek: bib });
    expect(med.replace(/ {4}\/\/ ══ Ramverkets gruppbilder[\s\S]*?\n {4}}\n(?= {4}\/\/ ══ Ramverkets biblioteksfiler)/, "")).toBe(lagringsregelfragment({ bibliotek: bib }));
  });

  it("ett namn som inte är ett namn kastar, som de andra prefixen", () => {
    expect(() => lagringsregelfragment({ gruppbilder: { prefix: "grupp/bilder" } })).toThrow();
  });
});
