import { describe, it, expect } from "vitest";
import {
  INBJUDNINGSSTATUS,
  MEDLEMSSTATUS,
  MEDLEMSTYPER,
  ROLLER,
  TEMAN,
  byggAnvandare,
  byggGrupp,
  byggInbjudan,
  byggMedlemskap,
  medlemskapsId,
  MEDLEMSKAPSAVGRANSARE,
  MEDLEMSKAPSFALT,
} from "../lib/grupp.js";
import { generateRules, gruppadSamling, regelfragment } from "../lib/regler.js";
import { defineModule } from "../lib/modul.js";

/**
 * Fas 2.5 i epiken #92: grupper och medlemskap (#136).
 *
 * ⛔ PROVEN HANDLAR OM VAD SOM AVVISAS. Samma skäl som katalog- och
 * modulproven: en validering som bara provas med giltig data är en funktion som
 * returnerar sitt argument.
 *
 * ⛔ REGELTEXTEN PROVAS I EMULATORN, INTE HÄR. `rules/__tests__/grupper.test.mjs`
 * kör 31 prov mot den genererade texten. Det som provas här är formen på
 * texten, alltså det som går att mäta utan en databas: att samlingsnamnen tas
 * emot och att en sökväg avvisas. Ett prov som bara söker efter en sträng i
 * reglerna vore annars det arbetsreglerna kallar ett närvarogrep.
 */

const ANV = () => ({ id: "uid-1", namn: "CP", epost: "CP@Staiger.se", bild: "", sprak: "sv", tema: "system" });
const GRUPP = () => ({ id: "bolaget", namn: { sv: "Claes Philip Staiger AB" }, moduler: ["ekonomi"], arkiverad: false, skapadAv: { uid: "uid-1", namn: "CP", typ: "manniska", kalla: "prov" } });
const MEDLEM = () => ({ userId: "uid-1", groupId: "bolaget", roll: "agare", typ: "person", status: "aktiv" });
const INBJUDAN = () => ({ id: "inb-1", epost: "Ny@Example.com", groupId: "bolaget", roll: "medlem", status: "vantar", skapadAv: { uid: "uid-1", namn: "CP", typ: "manniska", kalla: "prov" } });

describe("användaren", () => {
  it("byggs och fryses", () => {
    const a = byggAnvandare(ANV());
    expect(a.id).toBe("uid-1");
    expect(Object.isFrozen(a)).toBe(true);
  });

  it("⛔ e-posten normaliseras till gemener, annars matchar inbjudan inte", () => {
    expect(byggAnvandare(ANV()).epost).toBe("cp@staiger.se");
  });

  it("id krävs", () => {
    const { id: _id, ...utan } = ANV();
    expect(() => byggAnvandare(utan)).toThrow(/users: id krävs/);
  });

  it("epost krävs", () => {
    expect(() => byggAnvandare({ ...ANV(), epost: "" })).toThrow(/users: epost krävs för "uid-1"/);
  });

  it("okända fält avvisas", () => {
    expect(() => byggAnvandare({ ...ANV(), roll: "agare" })).toThrow(/users: fälten roll för "uid-1" känns inte igen/);
  });

  it("ett okänt språk avvisas", () => {
    expect(() => byggAnvandare({ ...ANV(), sprak: "no" })).toThrow(/users: språket "no" för "uid-1" finns inte/);
  });

  it("ett okänt tema avvisas", () => {
    expect(() => byggAnvandare({ ...ANV(), tema: "gult" })).toThrow(/users: temat "gult" för "uid-1" finns inte/);
  });

  it("förvalen är svenska och system", () => {
    const { sprak: _s, tema: _t, ...utan } = ANV();
    const a = byggAnvandare(utan);
    expect([a.sprak, a.tema]).toEqual(["sv", "system"]);
    expect(TEMAN).toContain(a.tema);
  });
});

describe("gruppen", () => {
  it("byggs, och moduler fryses", () => {
    const g = byggGrupp(GRUPP());
    expect(g.namn).toEqual({ sv: "Claes Philip Staiger AB" });
    expect(Object.isFrozen(g.moduler)).toBe(true);
  });

  it("id följer samma form som ett kategori-id", () => {
    expect(() => byggGrupp({ ...GRUPP(), id: "Bolaget.AB" })).toThrow(/groups: id "Bolaget.AB" får bara innehålla små bokstäver/);
  });

  it("⛔ ett namn som är en sträng kastar", () => {
    expect(() => byggGrupp({ ...GRUPP(), namn: "Bolaget" })).toThrow(/groups: namn för "bolaget" är en sträng/);
  });

  it("ett namn utan svenska kastar", () => {
    expect(() => byggGrupp({ ...GRUPP(), namn: { en: "The company" } })).toThrow(/groups: namn för "bolaget" sv krävs/);
  });

  it("moduler krävs som lista, även tom", () => {
    const { moduler: _m, ...utan } = GRUPP();
    expect(() => byggGrupp(utan)).toThrow(/groups: moduler för "bolaget" krävs och måste vara en lista/);
  });

  it("ett modul-id i fel form avvisas", () => {
    expect(() => byggGrupp({ ...GRUPP(), moduler: ["Ekonomi"] })).toThrow(/groups: moduler\[0\] för "bolaget" måste vara ett modul-id/);
  });

  it("samma modul två gånger avvisas", () => {
    expect(() => byggGrupp({ ...GRUPP(), moduler: ["ekonomi", "ekonomi"] })).toThrow(/groups: moduler\[1\] "ekonomi" för "bolaget" står två gånger/);
  });

  it("okända fält avvisas", () => {
    expect(() => byggGrupp({ ...GRUPP(), medlemmar: [] })).toThrow(/groups: fälten medlemmar för "bolaget" känns inte igen/);
  });
});

describe("gruppens moduler mot de registrerade", () => {
  /*
   * ⛔ CP 2026-09-27: "Ett påhittat modul-id går att spara." Formen var rätt
   * och innehållet påhittat, alltså sparades en flik ingen hittar.
   */
  it("avvisar ett modul-id som inte är registrerat", () => {
    expect(() => byggGrupp(GRUPP(), [{ id: "liv" }])).toThrow(/inte är registrerade/);
  });

  it("tar emot både manifest och rena id", () => {
    expect(byggGrupp(GRUPP(), [{ id: "ekonomi" }]).moduler).toEqual(["ekonomi"]);
    expect(byggGrupp(GRUPP(), ["ekonomi"]).moduler).toEqual(["ekonomi"]);
  });

  it("räknar upp vad som var känt, så felet går att rätta utan att gissa", () => {
    expect(() => byggGrupp(GRUPP(), [{ id: "liv" }])).toThrow(/Kända: liv/);
  });

  it("släpper igenom utan listan, eftersom läsvägen måste tåla en avinstallerad modul", () => {
    expect(byggGrupp(GRUPP()).moduler).toEqual(["ekonomi"]);
  });

  it("avvisar en lista som inte är en lista, i stället för att tyst släppa igenom", () => {
    expect(() => byggGrupp(GRUPP(), /** @type {any} */ ("ekonomi"))).toThrow(/måste vara en lista/);
  });

  it("en tom lista kända moduler fäller en grupp som pekar på något", () => {
    expect(() => byggGrupp(GRUPP(), [])).toThrow(/inte är registrerade/);
  });
});

describe("medlemskapet", () => {
  it("id härleds ur userId och groupId", () => {
    expect(byggMedlemskap(MEDLEM()).id).toBe("uid-1|bolaget");
    expect(medlemskapsId("a", "b")).toBe("a|b");
  });

  /*
   * ⛔ ANROPAD DIREKT, OCH DET ÄR ETT MUTATIONSFYND. Svepet tog bort kontrollen
   * i `medlemskapsId` och ingenting blev rött, eftersom `byggMedlemskap` redan
   * kastar på ett tomt userId innan den anropar. Men funktionen är EXPORTERAD,
   * alltså en yta någon kan anropa själv, och då hade den tyst gett "_bolaget"
   * som nyckel. Kontrollen är inte en dubblett: det är provet som saknades.
   */
  it("⛔ avgränsaren gör nyckeln entydig, och det gjorde understrecket inte (#152)", () => {
    /*
     * Med understreck som avgränsare gav "a_b" + "c" och "a" + "b_c" SAMMA
     * dokument, eftersom ID_FORM tillåter understreck i ett id. Två medlemskap
     * kollapsade till ett, och vilken roll som gällde avgjordes av vem som
     * skrev sist. Ingenting kraschade: en person fick fel roll, tyst.
     */
    expect(medlemskapsId("a_b", "c")).not.toBe(medlemskapsId("a", "b_c"));
    expect(medlemskapsId("a-b", "c")).not.toBe(medlemskapsId("a", "b-c"));
  });

  it("⛔ avgränsaren i någon halva är ett fel, inte en tvetydig nyckel", () => {
    /*
     * ID_FORM släpper inte igenom den i ett grupp-id, men userId är ett
     * Firebase-uid och alltså någon annans format: med en custom token är det
     * fritt. Att lita på en annan leverantörs format är ett antagande i en rad
     * som avgör behörighet.
     */
    expect(() => medlemskapsId(`a${MEDLEMSKAPSAVGRANSARE}b`, "bolaget")).toThrow(/innehåller avgränsaren/);
    expect(() => medlemskapsId("uid-1", `a${MEDLEMSKAPSAVGRANSARE}b`)).toThrow(/innehåller avgränsaren/);
  });

  it("⛔ reglerna och koden använder SAMMA avgränsare, och det är ett värde och inte två", () => {
    /*
     * Tecknet stod förut på tre ställen: en gång i grupp.js och två gånger i
     * regelfragmentet. Tre handskrivna kopior av samma faktum, och den dag en
     * av dem ändras nekar regeln varje läsning utan att något prov är rött.
     * Nu importerar regler.js konstanten, och det här provet mäter det.
     */
    const text = regelfragment();
    expect(text).toContain(`request.auth.uid + '${MEDLEMSKAPSAVGRANSARE}' + gid`);
    expect(text).not.toContain("request.auth.uid + '_' + gid");
  });

  it("medlemskapsId kastar på en saknad halva, anropad direkt", () => {
    expect(() => medlemskapsId("", "bolaget")).toThrow(/medlemskapsId: både userId och groupId krävs/);
    expect(() => medlemskapsId("uid-1", "")).toThrow(/medlemskapsId: både userId och groupId krävs/);
  });

  it("⛔ ett inskickat id som inte stämmer avvisas, det rättas inte", () => {
    expect(() => byggMedlemskap({ ...MEDLEM(), id: "nagot-annat" })).toThrow(/memberships: id "nagot-annat" stämmer inte med userId och groupId/);
  });

  it("ett inskickat id som stämmer tas emot", () => {
    expect(byggMedlemskap({ ...MEDLEM(), id: "uid-1|bolaget" }).id).toBe("uid-1|bolaget");
  });

  it("userId krävs", () => {
    const { userId: _u, ...utan } = MEDLEM();
    expect(() => byggMedlemskap(utan)).toThrow(/memberships: userId krävs/);
  });

  it("groupId krävs", () => {
    const { groupId: _g, ...utan } = MEDLEM();
    expect(() => byggMedlemskap(utan)).toThrow(/memberships: groupId krävs/);
  });

  it("en okänd roll avvisas", () => {
    expect(() => byggMedlemskap({ ...MEDLEM(), roll: "admin" })).toThrow(/memberships: rollen "admin" för "uid-1\\|bolaget" finns inte/);
    expect(ROLLER).toEqual(["agare", "medlem"]);
  });

  it("en okänd typ avvisas", () => {
    expect(() => byggMedlemskap({ ...MEDLEM(), typ: "robot" })).toThrow(/memberships: typen "robot" för "uid-1\\|bolaget" finns inte/);
    expect(MEDLEMSTYPER).toEqual(["person", "agent"]);
  });

  it("en okänd status avvisas, och förvalet är aktiv", () => {
    expect(() => byggMedlemskap({ ...MEDLEM(), status: "kanske" })).toThrow(/memberships: statusen "kanske" för "uid-1\\|bolaget" finns inte/);
    const { status: _s, ...utan } = MEDLEM();
    expect(byggMedlemskap(utan).status).toBe("aktiv");
    expect(MEDLEMSSTATUS).toEqual(["aktiv", "avslutad"]);
  });

  it("okända fält avvisas", () => {
    expect(() => byggMedlemskap({ ...MEDLEM(), groupIds: ["a"] })).toThrow(/memberships: fälten groupIds för "uid-1\\|bolaget" känns inte igen/);
  });
});

describe("medlemskapets namn och bild (#138, beslut A)", () => {
  /*
   * ⛔ E-POSTEN LÄMNAR ALDRIG `users`, så medlemslistan har ingenting annat att
   * rita ur. Utan de här fälten blir listan en rad uid:n.
   */
  it("bär namn och bild", () => {
    const m = byggMedlemskap({ ...MEDLEM(), namn: "CP", bild: "https://exempel/bild.png" });
    expect(m.namn).toBe("CP");
    expect(m.bild).toBe("https://exempel/bild.png");
  });

  it("skriver ut tomma strängar när de saknas, i stället för att utelämna fälten", () => {
    const m = byggMedlemskap(MEDLEM());
    expect(m.namn).toBe("");
    expect(m.bild).toBe("");
    expect(Object.keys(m)).toContain("namn");
    expect(Object.keys(m)).toContain("bild");
  });

  it("står i fältlistan, alltså är de vaktade av check-gruppnyckel", () => {
    expect(MEDLEMSKAPSFALT).toContain("namn");
    expect(MEDLEMSKAPSFALT).toContain("bild");
  });
});

describe("inbjudan", () => {
  it("byggs, och e-posten blir gemener", () => {
    expect(byggInbjudan(INBJUDAN()).epost).toBe("ny@example.com");
  });

  it("epost krävs", () => {
    expect(() => byggInbjudan({ ...INBJUDAN(), epost: "" })).toThrow(/invitations: epost krävs för "inb-1"/);
  });

  it("groupId krävs", () => {
    const { groupId: _g, ...utan } = INBJUDAN();
    expect(() => byggInbjudan(utan)).toThrow(/invitations: groupId krävs för "inb-1"/);
  });

  it("en okänd roll avvisas", () => {
    expect(() => byggInbjudan({ ...INBJUDAN(), roll: "gast" })).toThrow(/invitations: rollen "gast" för "inb-1" finns inte/);
  });

  it("en okänd status avvisas, och förvalet är vantar", () => {
    expect(() => byggInbjudan({ ...INBJUDAN(), status: "kanske" })).toThrow(/invitations: statusen "kanske" för "inb-1" finns inte/);
    const { status: _s, ...utan } = INBJUDAN();
    expect(byggInbjudan(utan).status).toBe("vantar");
    expect(INBJUDNINGSSTATUS).toEqual(["vantar", "accepterad", "aterkallad"]);
  });
});

describe("regelfragmentet: formen, inte beteendet", () => {
  it("tar emot appens samlingsnamn", () => {
    const text = regelfragment({ medlemskap: "medlemskap", grupper: "bolag" });
    expect(text).toContain("match /bolag/{gid}");
    expect(text).toContain("documents/medlemskap/$(request.auth.uid");
  });

  it("⛔ ett samlingsnamn med snedstreck avvisas, det är en sökväg", () => {
    expect(() => regelfragment({ grupper: "kunder/x/grupper" })).toThrow(/regelfragment: grupper "kunder\/x\/grupper" är inte ett samlingsnamn/);
    expect(() => gruppadSamling("a/b")).toThrow(/regelfragment: samling "a\/b" är inte ett samlingsnamn/);
  });

  it("⛔ appens samling vaktar groupId på BÅDA sidor av en uppdatering", () => {
    const text = gruppadSamling("handelser");
    expect(text).toContain("opsArMedlem(resource.data.groupId)");
    expect(text).toContain("request.resource.data.groupId == resource.data.groupId");
  });

  it("ägarkravet går att slå på per samling", () => {
    expect(gruppadSamling("konfig", { agareKravsForSkrivning: true })).toContain("opsArAgare(request.resource.data.groupId)");
    expect(gruppadSamling("handelser")).not.toContain("opsArAgare(request.resource.data.groupId)");
  });
});

describe("generateRules: hela filen ur manifesten (#130)", () => {
  const modul = (/** @type {string} */ id, /** @type {any[]} */ samlingar) =>
    defineModule({ id, namn: { sv: id }, nav: [], routes: [], kallor: {}, samlingar });

  it("ger en komplett fil med ramverkets fragment, modulens block och catch-allen", () => {
    const t = generateRules([modul("liv", ["matningar"])]);
    expect(t.startsWith("rules_version = '2';")).toBe(true);
    expect(t).toContain("function opsArMedlem(");
    expect(t).toContain("match /matningar/{id}");
    expect(t).toContain("match /{document=**}");
    expect(t.trimEnd().endsWith("}")).toBe(true);
  });

  /*
   * ⛔ DET FARLIGASTE UTFALLET ÄR EN FIL SOM TYST BLIR KORTARE. En regelfil
   * där catch-allen är allt nekar hela appen, och den ska inte gå att
   * producera av misstag.
   */
  it("vägrar generera ur noll samlingar utan att någon sagt det uttryckligen", () => {
    expect(() => generateRules([])).toThrow(/nekar allt/);
  });

  it("tar emot noll samlingar när appen skickar extra, alltså har sagt det", () => {
    expect(generateRules([], { extra: "    // appens eget\n" })).toContain("appens eget");
  });

  it("avvisar ett rått manifest, eftersom en tyst kortare fil är det farligaste", () => {
    expect(() => generateRules([/** @type {any} */ ({ id: "liv" })])).toThrow(/byggd av defineModule/);
  });

  it("fäller två moduler som ger samma samling", () => {
    expect(() => generateRules([modul("a", ["delad"]), modul("b", ["delad"])])).toThrow(/båda samlingen "delad"/);
  });

  it("genererar formvalidering ur fältlistan, och utelämnar raden utan den", () => {
    const med = generateRules([modul("liv", [{ namn: "matningar", falt: ["id", "groupId"] }])]);
    expect(med).toContain('keys().hasOnly(["id", "groupId"])');
    expect(generateRules([modul("liv", ["matningar"])])).not.toContain("hasOnly");
  });

  it("kräver ägare för skrivning när samlingen säger det", () => {
    const t = generateRules([modul("liv", [{ namn: "konfig", agareKravsForSkrivning: true }])]);
    expect(t).toContain("allow create: if opsArAgare(request.resource.data.groupId)");
  });

  /*
   * ⛔ EN TOM FÄLTLISTA HADE GETT hasOnly([]), alltså en regel som avvisar
   * varje rad. Den sortens regel ser ut som en formvalidering och är en vägg.
   */
  it("fäller en tom fältlista i stället för att generera en vägg", () => {
    expect(() => gruppadSamling("x", { falt: [] })).toThrow(/avvisar varje rad/);
  });

  it("limmar in appens extra före catch-allen, inte efter", () => {
    const t = generateRules([modul("liv", ["matningar"])], { extra: "    // undantaget\n" });
    expect(t.indexOf("// undantaget")).toBeLessThan(t.indexOf("match /{document=**}"));
  });
});
