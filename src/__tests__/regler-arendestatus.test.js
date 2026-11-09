import { describe, expect, it } from "vitest";
import { bibliotekregelfragment, gruppadSamling, lagringsregelfragment, regelfragment } from "../lib/regler.js";

/**
 * Ramverkets regelfragment säger ingenting om ett ärendes status (0.181.0, "pagar").
 *
 * ⛔ VARFÖR PROVET FINNS. Appen äger inkorgens samling och vilka statusvärden den släpper in. Ramverkets fragment slår bara upp
 * posten (ärendets filer: finns den, hör den till gruppen) och prövar gruppens medlemskap. Skulle ett fragment någon gång få ett
 * villkor på `'ny'`, `'hanterad'`, `'avskriven'` eller `'parkerad'` måste `'pagar'` släppas in på samma ställe med samma behörighet, och det här
 * provet blir rött så att det inte glöms (regel 2: en lista över ärendets statusar, inte en som glider isär).
 */
describe("regelfragmenten och ärendets status", () => {
  const text = [
    regelfragment(),
    gruppadSamling("handelser"),
    bibliotekregelfragment("bibliotek", { handelser: "handelser", arenden: "inkorg", platser: true }),
    lagringsregelfragment({ bibliotek: { gruppPrefix: "grupper", postPrefix: "bibliotek", samling: "bibliotek", handelsefiler: true, arendefiler: true } }),
  ].join("\n");

  it("golv: texten är läst och bär ärendegrenen", () => {
    expect(text.length).toBeGreaterThan(20000);
    expect(text).toContain("inkorg");
  });

  it("⛔ inget villkor på ett ärendes statusvärde, så ingen status behöver släppas in separat", () => {
    const namn = "ny|pagar|hanterad|avskriven|parkerad";
    expect(text.match(new RegExp(`status\\s*(==|!=|in)\\s*\\[?\\s*['"](${namn})['"]`, "g"))).toBeNull();
    expect(text.match(new RegExp(`['"](${namn})['"]`, "g"))).toBeNull();
    // ⛔ Mönstret ska känna igen den nya statusen. Utan den här raden är provet grönt även om 'parkerad' slutar stå i uttrycket.
    expect("status == 'parkerad'".match(new RegExp(`['"](${namn})['"]`))).not.toBeNull();
  });
});
