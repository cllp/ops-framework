import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsCalendar, VECKONUMMER_NYCKEL } from "../components/OpsCalendar.jsx";
import {
  KALENDERFALT,
  KALENDERPOST_HANDELSEPREFIX,
  MAX_GITHUBETIKETT,
  STANDARDKALENDER_ID,
  STANDARDKALENDER_NAMN,
  byggGruppkalender,
  byggKalenderpost,
  byggMinKalender,
  forvaldKalender,
  giltigtDatum,
  githubEtikettNyckel,
  gruppkalendernyckel,
  idagI,
  kalenderForEtikett,
  kontrolleraGithubEtiketter,
  kontrolleraTidszon,
  postHandelseId,
  postIdUrHandelseId,
  postTillHandelse,
  postTillRad,
  standardGruppkalender,
  validateGruppkalendrar,
  validateMinaKalendrar,
} from "../lib/kalendrar.js";
import { KATEGORIFALT } from "../lib/katalog.js";
import { bandIVecka, datumOmfang, isoVecka, kalenderfonster, perDay, reserveradeFiler, traffar, valjDag, valjIntervall, valjVecka } from "../lib/calendar.js";

/*
 * 0.36.0 (#179 F0 och F1). Datakontraktet för kalendrarna och de delar av månadsvyn som är logik. Regelproven ligger i
 * `rules/__tests__/kalendrar.test.mjs`, och det som bara syns i en riktig webbläsare (höjder, band, piller vid 390 och
 * 1280) mäts i `check-skalyta` avsnitt 30.
 */

const gk = (extra = {}) => ({ id: "styrelse", namn: { sv: "Styrelsen" }, farg: 4, ikon: "kalender", groupId: "cps-ab", ...extra });

describe("gruppens kalendrar: en katalog på typernas motor (F0)", () => {
  it("bygger en kalender utan fas, med forvald och iFlodet som riktiga booleaner", () => {
    const k = byggGruppkalender(gk({ forvald: true }));
    expect(k).toEqual({ id: "styrelse", namn: { sv: "Styrelsen" }, farg: 4, ikon: "kalender", ordning: 0, arkiverad: false, texter: {}, groupId: "cps-ab", forvald: true, iFlodet: false });
    // ⛔ Ingen `fas`-nyckel alls, inte `fas: null`: regelns `hasOnly` tillåter den inte.
    expect("fas" in k).toBe(false);
  });

  it("härleder fälten ur katalogens och lägger till tre, så att en ändring i katalogen följer med", () => {
    expect(KALENDERFALT).toEqual([...KATEGORIFALT.filter((f) => f !== "fas"), "forvald", "iFlodet", "githubEtikett"]);
    // ⛔ Och varje fält bygget skriver finns i listan regeln läser.
    expect(Object.keys(byggGruppkalender(gk())).every((f) => KALENDERFALT.includes(f))).toBe(true);
  });

  it("⛔ kräver groupId, avvisar fas, en sjunde färg, en okänd ikon och en sträng som boolean", () => {
    expect(() => byggGruppkalender({ ...gk(), groupId: undefined })).toThrow(/groupId/);
    expect(() => byggGruppkalender(gk({ fas: "aktiv" }))).toThrow(/fas/);
    expect(() => byggGruppkalender(gk({ farg: 7 }))).toThrow(/farg/);
    expect(() => byggGruppkalender(gk({ ikon: "gitarr" }))).toThrow(/ikon/);
    expect(() => byggGruppkalender(gk({ forvald: "true" }))).toThrow(/forvald/);
  });

  it("⛔ tillåter högst en förvald, aldrig en arkiverad förvald, och bara en grupp per lista", () => {
    expect(() => validateGruppkalendrar([gk({ forvald: true }), gk({ id: "resor", forvald: true })])).toThrow(/2 kalendrar är förvalda/);
    expect(() => validateGruppkalendrar([gk({ forvald: true, arkiverad: true })])).toThrow(/arkiverad/);
    expect(() => validateGruppkalendrar([gk(), gk({ id: "annan", groupId: "miranda-ab" })])).toThrow(/2 grupper/);
    expect(() => validateGruppkalendrar([gk(), gk()])).toThrow(/två gånger/);
  });

  it("härleder den förvalda ur ordningen när ingen valt, och tar den markerade när någon gjort det", () => {
    const lista = validateGruppkalendrar([gk({ id: "b", ordning: 2 }), gk({ id: "a", ordning: 1 }), gk({ id: "c", ordning: 0, arkiverad: true })]);
    expect(forvaldKalender(lista)?.id).toBe("a");
    expect(forvaldKalender(validateGruppkalendrar([gk({ id: "a", ordning: 1 }), gk({ id: "b", ordning: 2, forvald: true })]))?.id).toBe("b");
    expect(forvaldKalender([])).toBeNull();
  });
});

describe("gruppkalenderns githubEtikett (0.108.0, cllp/lifehub.app#259)", () => {
  it("fältet är valfritt: en kalender utan etikett har ingen nyckel alls, inte null och inte tom sträng", () => {
    const k = byggGruppkalender(gk());
    expect("githubEtikett" in k).toBe(false);
    expect("githubEtikett" in byggGruppkalender(gk({ githubEtikett: undefined }))).toBe(false);
  });

  it("en etikett lagras trimmad, och bygget skriver bara fält som regeln läser", () => {
    const k = byggGruppkalender(gk({ githubEtikett: "  Styrelsen " }));
    expect(k.githubEtikett).toBe("Styrelsen");
    expect(Object.keys(k).every((f) => KALENDERFALT.includes(f))).toBe(true);
  });

  it("⛔ en tom etikett, eller bara blanksteg, betyder att fältet tas bort och lagras inte", () => {
    expect("githubEtikett" in byggGruppkalender(gk({ githubEtikett: "" }))).toBe(false);
    expect("githubEtikett" in byggGruppkalender(gk({ githubEtikett: "   " }))).toBe(false);
  });

  it("⛔ högst 50 tecken: 50 går, 51 kastar, och mätt som regeln mäter (UTF-16-enheter)", () => {
    expect(MAX_GITHUBETIKETT).toBe(50);
    expect(byggGruppkalender(gk({ githubEtikett: "a".repeat(50) })).githubEtikett).toHaveLength(50);
    expect(() => byggGruppkalender(gk({ githubEtikett: "a".repeat(51) }))).toThrow(/githubEtikett.*51 tecken, taket är 50/);
    // Längden räknas efter trim: blanksteg runt en etikett på 50 tecken är inte ett fel.
    expect(byggGruppkalender(gk({ githubEtikett: ` ${"a".repeat(50)} ` })).githubEtikett).toHaveLength(50);
    // En emoji är två UTF-16-enheter och regelns size() räknar likadant (rules/__tests__/kalendrar.test.mjs): 26 av dem är 52.
    expect(byggGruppkalender(gk({ githubEtikett: "\u{1F4C5}".repeat(25) })).githubEtikett).toHaveLength(50);
    expect(() => byggGruppkalender(gk({ githubEtikett: "\u{1F4C5}".repeat(26) }))).toThrow(/52 tecken/);
  });

  it("⛔ allt som inte är en sträng kastar, också null: regeln hade nekat det", () => {
    for (const v of [null, 5, true, ["a"], {}]) expect(() => byggGruppkalender(gk({ githubEtikett: v }))).toThrow(/githubEtikett.*sträng/);
  });

  it("⛔ mina kalendrar har inget sådant fält", () => {
    expect(() => byggMinKalender({ id: "privat", namn: "Privat", farg: 2, ikon: "hjarta", githubEtikett: "privat" })).toThrow(/githubEtikett/);
  });

  it("jämförelsenyckeln: trimmad och i gemener, och tom för allt som inte är en etikett", () => {
    expect(githubEtikettNyckel("  Styrelsen ")).toBe("styrelsen");
    expect(githubEtikettNyckel("ÅTGÄRD")).toBe("åtgärd");
    expect(githubEtikettNyckel("STYRELSEN")).toBe(githubEtikettNyckel("styrelsen"));
    for (const v of [undefined, null, "", "   ", 5, {}]) expect(githubEtikettNyckel(v)).toBe("");
  });

  it("⛔ validateGruppkalendrar kastar INTE på två lika etiketter: en dubblett som slank igenom ska synas, inte stänga kalendern", () => {
    const lista = validateGruppkalendrar([gk({ id: "a", githubEtikett: "x" }), gk({ id: "b", githubEtikett: "X" })]);
    expect(lista).toHaveLength(2);
  });

  describe("kontrolleraGithubEtiketter: unikheten inom gruppen, utan skiftläge", () => {
    const lista = () => validateGruppkalendrar([gk({ id: "styrelse", namn: { sv: "Styrelsen", en: "Board" }, githubEtikett: "Styrelsen" }), gk({ id: "resor", namn: { sv: "Resor" } })]);

    it("⛔ en ny kalender med samma etikett i annat skiftläge kastar, på svenska som förval och på engelska på begäran", () => {
      const ny = byggGruppkalender(gk({ id: "moten", namn: { sv: "Möten", en: "Meetings" }, githubEtikett: " STYRELSEN " }));
      expect(() => kontrolleraGithubEtiketter(lista(), { rader: [ny] })).toThrow('GitHub-etiketten "STYRELSEN" används av både "Styrelsen" och "Möten". Varje kalender behöver en egen etikett');
      expect(() => kontrolleraGithubEtiketter(lista(), { rader: [ny], sprak: "en" })).toThrow('The GitHub label "STYRELSEN" is used by both "Board" and "Meetings". Each calendar needs its own label');
    });

    it("felet bär vilka kalendrar det gäller, så att en app kan peka ut dem", () => {
      const ny = byggGruppkalender(gk({ id: "moten", githubEtikett: "styrelsen" }));
      try {
        kontrolleraGithubEtiketter(lista(), { rader: [ny] });
        expect.unreachable();
      } catch (e) {
        expect(e).toMatchObject({ kod: "githubEtikettKrock", etikett: "styrelsen", kalendrar: ["styrelse", "moten"] });
      }
    });

    it("⛔ en kalender får behålla sin egen etikett: den ändrade raden ersätter sin gamla och krockar inte med sig själv", () => {
      const andrad = byggGruppkalender(gk({ id: "styrelse", namn: { sv: "Styrelsen" }, githubEtikett: "STYRELSEN", ordning: 5 }));
      expect(kontrolleraGithubEtiketter(lista(), { rader: [andrad] })).toHaveLength(2);
    });

    it("en arkiverad kalender håller inte kvar sin etikett, men en som tas fram går genom kontrollen", () => {
      const arkiverad = lista().map((k) => (k.id === "styrelse" ? { ...k, arkiverad: true } : k));
      const ny = byggGruppkalender(gk({ id: "moten", githubEtikett: "styrelsen" }));
      expect(kontrolleraGithubEtiketter(arkiverad, { rader: [ny] })).toHaveLength(3);
      const framtagen = { ...arkiverad[0], arkiverad: false };
      expect(() => kontrolleraGithubEtiketter([...arkiverad.slice(1), ny], { rader: [framtagen] })).toThrow(/används av både/);
    });

    it("⛔ en dubblett som redan finns hindrar inte en ändring av en tredje kalender, men fångas när någon av de två rörs", () => {
      const med = [gk({ id: "a", githubEtikett: "x" }), gk({ id: "b", githubEtikett: "X" }), gk({ id: "c" })].map((r) => byggGruppkalender(r));
      expect(kontrolleraGithubEtiketter(med, { rader: [{ ...med[2], ordning: 9 }] })).toHaveLength(3);
      expect(() => kontrolleraGithubEtiketter(med, { rader: [{ ...med[0], ordning: 9 }] })).toThrow(/används av både/);
      // Utan rader kontrolleras hela listan.
      expect(() => kontrolleraGithubEtiketter(med)).toThrow(/används av både/);
    });

    it("kalendrar utan etikett krockar aldrig med varandra, och ett $ i ett namn skrivs som det står", () => {
      expect(kontrolleraGithubEtiketter([gk({ id: "a" }), gk({ id: "b" })].map((r) => byggGruppkalender(r)))).toHaveLength(2);
      const lista2 = [byggGruppkalender(gk({ id: "a", namn: { sv: "A $& B" }, githubEtikett: "x" }))];
      expect(() => kontrolleraGithubEtiketter(lista2, { rader: [byggGruppkalender(gk({ id: "b", githubEtikett: "x" }))] })).toThrow('"A $& B"');
    });
  });
});

describe("kalenderForEtikett: vem som äger en etikett, och första i ordningen vinner (0.108.0, granskningen av PR 395)", () => {
  const k = (id, extra = {}) => byggGruppkalender(gk({ id, ...extra }));

  it("träff: kalendern vars etikett matchar", () => {
    const lista = [k("styrelse", { githubEtikett: "styrelsen" }), k("resor", { githubEtikett: "resor" })];
    expect(kalenderForEtikett(lista, "resor")?.id).toBe("resor");
  });

  it("⛔ skiftläge och blanksteg spelar ingen roll, i etiketten som söks och i den som lagrats", () => {
    const lista = [k("styrelse", { githubEtikett: "Styrelsen" })];
    expect(kalenderForEtikett(lista, "  STYRELSEN ")?.id).toBe("styrelse");
    expect(kalenderForEtikett([k("a", { githubEtikett: "ÅTGÄRD" })], "åtgärd")?.id).toBe("a");
  });

  it("⛔ en dubblett: den första i ordningen vinner (ordning, sedan id), oavsett listans egen ordning", () => {
    const a = k("alfa", { githubEtikett: "x", ordning: 20 });
    const b = k("beta", { githubEtikett: "X", ordning: 10 });
    const c = k("cesar", { githubEtikett: "x", ordning: 10 });
    expect(kalenderForEtikett([a, c, b], "x")?.id).toBe("beta"); // lägst ordning, och beta före cesar på id
    expect(kalenderForEtikett([c, b, a], "x")?.id).toBe("beta");
    expect(kalenderForEtikett([a, c], "x")?.id).toBe("cesar");
  });

  it("⛔ listan ändras inte", () => {
    const lista = [k("b", { githubEtikett: "x", ordning: 2 }), k("a", { githubEtikett: "y", ordning: 1 })];
    const fore = lista.map((x) => x.id);
    kalenderForEtikett(lista, "x");
    expect(lista.map((x) => x.id)).toEqual(fore);
  });

  it("⛔ en arkiverad kalender räknas inte, så nästa i ordningen vinner", () => {
    const lista = [k("forsta", { githubEtikett: "x", ordning: 0, arkiverad: true }), k("andra", { githubEtikett: "x", ordning: 10 })];
    expect(kalenderForEtikett(lista, "x")?.id).toBe("andra");
    expect(kalenderForEtikett([lista[0]], "x")).toBeNull();
  });

  it("⛔ ingen träff ger null, och en tom etikett ger null trots att kalendrar utan etikett finns", () => {
    const lista = [k("styrelse", { githubEtikett: "styrelsen" }), k("resor")];
    expect(kalenderForEtikett(lista, "okand")).toBeNull();
    expect(kalenderForEtikett([], "x")).toBeNull();
    for (const tom of ["", "   ", undefined, null, 5]) expect(kalenderForEtikett(lista, tom)).toBeNull();
  });
});

describe("mina kalendrar och deras poster (F0)", () => {
  const min = (extra = {}) => ({ id: "privat", namn: "Privat", farg: 2, ikon: "hjarta", ...extra });

  it("bygger en av mina kalendrar utan grupp och utan texter", () => {
    expect(byggMinKalender(min())).toEqual({ id: "privat", namn: "Privat", farg: 2, ikon: "hjarta", ordning: 0, forvald: false, iFlodet: false, arkiverad: false });
    expect(() => byggMinKalender(min({ groupId: "cps-ab" }))).toThrow(/groupId/);
    expect(() => byggMinKalender(min({ namn: "" }))).toThrow(/namn/);
    expect(() => validateMinaKalendrar([min({ forvald: true }), min({ id: "b", forvald: true })])).toThrow(/förvalda/);
  });

  const post = (extra = {}) => ({ id: "p1", kalenderId: "privat", titel: "Tandläkaren", start: "2026-10-05T09:00", slut: "2026-10-05T10:00", ...extra });

  it("bygger en post med beskrivning och plats som tomma strängar när de saknas (punkt 5)", () => {
    expect(byggKalenderpost(post())).toEqual({ id: "p1", kalenderId: "privat", titel: "Tandläkaren", beskrivning: "", plats: "", start: "2026-10-05T09:00", slut: "2026-10-05T10:00", heldag: false, blockerar: false });
    // Utan slut blir slut samma som start.
    expect(byggKalenderpost(post({ slut: undefined })).slut).toBe("2026-10-05T09:00");
  });

  it("⛔ avvisar slut före start, fel form för heldag, ett datum som inte finns och en arkiverad kalender", () => {
    expect(() => byggKalenderpost(post({ slut: "2026-10-05T08:00" }))).toThrow(/före start/);
    expect(() => byggKalenderpost(post({ heldag: true }))).toThrow(/heldag/);
    expect(() => byggKalenderpost(post({ start: "2026-10-05", slut: "2026-10-05" }))).toThrow(/YYYY-MM-DDTHH:MM/);
    expect(() => byggKalenderpost(post({ heldag: true, start: "2026-02-30", slut: "2026-02-30" }))).toThrow(/finns inte/);
    expect(() => byggKalenderpost(post(), { kalendrar: [{ id: "privat", arkiverad: true }] })).toThrow(/arkiverad/);
    expect(() => byggKalenderpost(post(), { kalendrar: [{ id: "annan" }] })).toThrow(/finns inte bland/);
    expect(() => byggKalenderpost(post({ titel: " " }))).toThrow(/titel/);
    expect(giltigtDatum("2028-02-29")).toBe(true);
    expect(giltigtDatum("2026-02-29")).toBe(false);
  });

  it("gör en post till en rad i kalendern: spann, heldag och kalendern med namn och färg", () => {
    const rad = postTillRad(byggKalenderpost(post({ heldag: true, start: "2026-10-12", slut: "2026-10-14", plats: "Visby" })), [{ id: "privat", namn: "Privat", farg: 2 }]);
    expect(rad).toEqual({ id: "p1", handelseId: "post~p1", date: "2026-10-12", endDate: "2026-10-14", allDay: true, title: "Tandläkaren", not: "Visby", kalender: { id: "privat", namn: "Privat", farg: 2 } });
    expect(postTillRad(byggKalenderpost(post()), []).not).toBe("09:00-10:00");
  });

  /*
   * ⛔ 0.120.0 (cllp/lifehub.app#367): EN POST HAR ETT ÖPPNINGSBART ID. Före 0.120.0 bar raden inget `handelseId`, titeln var vanlig
   * text och kortet var ingen ingång ("Ingen text, ingen detaljvy, navigation"). Röda mot 0.119.0: `handelseId` saknades.
   */
  it("⛔ #367: en post bär ett handelseId med prefix som appen kan slå upp, och som inget händelse-id kan likna", () => {
    const rad = postTillRad(byggKalenderpost(post()), []);
    expect(rad.handelseId).toBe("post~p1");
    expect(rad.handelseId).toBe(postHandelseId("p1"));
    expect(postIdUrHandelseId(rad.handelseId)).toBe("p1");
    // Ett vanligt händelse-id, ett tomt id och prefixet ensamt är inga poster.
    expect(postIdUrHandelseId("0Zq3AbCdEf")).toBeNull();
    expect(postIdUrHandelseId(KALENDERPOST_HANDELSEPREFIX)).toBeNull();
    expect(postIdUrHandelseId(undefined)).toBeNull();
    expect(() => postHandelseId("")).toThrow(/postId krävs/);
    // Prefixet har ett tecken (`~`) som inget id i ramverket kan bära, så ett id kan inte råka börja med det.
    expect(/^[a-z0-9][a-z0-9_-]*$/.test(KALENDERPOST_HANDELSEPREFIX)).toBe(false);
  });

  it("⛔ #367: postens detaljvy får titel, dag, tid, kalender, plats och beskrivning, och inget av det en post inte har", () => {
    const kal = [{ id: "privat", namn: "Privat", farg: 2 }];
    const tidsatt = postTillHandelse(byggKalenderpost(post({ plats: "Visby", beskrivning: "Ta med kortet" })), kal);
    expect(tidsatt).toEqual({ id: "post~p1", titel: "Tandläkaren", datum: "2026-10-05", tid: "09:00", slutTid: "10:00", kalender: { namn: "Privat", farg: 2 }, plats: "Visby", beskrivning: "Ta med kortet" });
    const heldag = postTillHandelse(byggKalenderpost(post({ heldag: true, start: "2026-10-12", slut: "2026-10-14" })), kal);
    expect(heldag).toEqual({ id: "post~p1", titel: "Tandläkaren", datum: "2026-10-12", slutDatum: "2026-10-14", heldag: true, kalender: { namn: "Privat", farg: 2 } });
    expect(Object.keys(heldag)).not.toContain("typ");
    expect(Object.keys(heldag)).not.toContain("status");
  });
});

/*
 * ⛔ 0.120.0 (cllp/lifehub.app#367): STANDARDKALENDERN. Raden är en vanlig gruppkalender, byggd av samma `byggGruppkalender` som
 * skrivvägen, utan `forvald`, med dokumentnyckeln `groupId|kalender` som id. Namnet och id:t är konstanter på ETT ställe.
 */
describe("standardkalendern (#367)", () => {
  it("är en giltig gruppkalender med nyckeln groupId|kalender, och inga fält utöver kalenderns", () => {
    const rad = standardGruppkalender("cps-ab");
    expect(rad.id).toBe(gruppkalendernyckel("cps-ab", STANDARDKALENDER_ID));
    expect(rad.id).toBe("cps-ab|kalender");
    expect(rad).toMatchObject({ groupId: "cps-ab", namn: { sv: "Kalender", en: "Calendar" }, arkiverad: false, forvald: false, iFlodet: false, ordning: 0 });
    expect(rad.namn).toEqual(STANDARDKALENDER_NAMN);
    expect(Object.keys(rad).every((k) => KALENDERFALT.includes(k))).toBe(true);
    // Reglernas `hasOnly`: ingen `fas` och ingen `githubEtikett` som raden inte bär.
    expect(Object.keys(rad)).not.toContain("fas");
    expect(Object.keys(rad)).not.toContain("githubEtikett");
    // Läsvägen släpper in den, och den blir gruppens förvalda (härledd, inte lagrad).
    const lasta = validateGruppkalendrar([{ ...rad, id: STANDARDKALENDER_ID }]);
    expect(forvaldKalender(lasta)?.id).toBe("kalender");
  });

  it("kastar för ett grupp-id som inte har id-formen, i stället för att skriva en nyckel som inte går att läsa", () => {
    expect(() => standardGruppkalender("Fel Id")).toThrow();
  });
});

describe("tidszonen är en inställning, inte en konstant (F0)", () => {
  it("räknar idag i zonen och inte i webbläsarens", () => {
    // 2026-10-05 23:30 UTC är redan den 6:e i Stockholm (sommartid, UTC+2) men fortfarande den 5:e i New York.
    const nu = new Date(Date.UTC(2026, 9, 5, 23, 30));
    expect(idagI("Europe/Stockholm", nu)).toBe("2026-10-06");
    expect(idagI("America/New_York", nu)).toBe("2026-10-05");
  });

  it("⛔ kastar på en zon som inte finns, vid uppstart", () => {
    expect(() => kontrolleraTidszon("Europe/Visby")).toThrow(/finns inte/);
    expect(kontrolleraTidszon("Europe/Stockholm")).toBe("Europe/Stockholm");
    expect(() => render(<OpsCalendar ariaLabel="K" entries={[]} tidszon="Mars/Olympus" />)).toThrow(/finns inte/);
  });
});

describe("månadsvyns logik (F1)", () => {
  it("räknar ISO-veckor över årsskiften", () => {
    expect(isoVecka(2026, 0, 1)).toBe(1);
    expect(isoVecka(2020, 11, 31)).toBe(53);
    expect(isoVecka(2021, 0, 3)).toBe(53);
    expect(isoVecka(2026, 9, 5)).toBe(41);
  });

  it("ger appen samma fönster som vyn ritar: tolv månader bakåt och tolv framåt", () => {
    expect(kalenderfonster("2026-10-05")).toEqual({ fran: "2025-10-01", till: "2027-10-31" });
    expect(kalenderfonster("2026-10-05", 0, 0)).toEqual({ fran: "2026-10-01", till: "2026-10-31" });
  });

  it("lägger en flerdagspost på varje dag den täcker, över ett månadsskifte", () => {
    const byKey = perDay([{ id: "s", date: "2026-10-30", endDate: "2026-11-02", title: "Semester" }]);
    expect([...byKey.keys()]).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(datumOmfang("2026-11-02", "2026-10-30")).toHaveLength(4);
  });

  it("staplar överlappande band i filer och säger var de börjar och slutar", () => {
    const vecka = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
    const bitar = bandIVecka(vecka, [
      { id: "a", date: "2026-10-01", endDate: "2026-10-07", title: "A" },
      { id: "b", date: "2026-10-06", endDate: "2026-10-20", title: "B" },
      { id: "c", date: "2026-10-09", allDay: true, title: "C" },
      { id: "d", date: "2026-10-09", title: "Inte ett band" },
    ]);
    expect(bitar.map((b) => [b.entry.id, b.startCol, b.colSpan, b.borjar, b.slutar, b.fil])).toEqual([
      ["a", 0, 3, false, true, 0],
      ["b", 1, 6, true, false, 1],
      ["c", 4, 1, true, true, 0],
    ]);
  });

  it("⛔ reserverar band-plats per dag och inte per vecka (0.106.0)", () => {
    const vecka = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
    // Ett enda heldagsband på fredagen: bara fredagen reserverar plats. Förut fick alla sju dagar en fils höjd.
    expect(reserveradeFiler(bandIVecka(vecka, [{ id: "c", date: "2026-10-09", allDay: true, title: "C" }]))).toEqual([0, 0, 0, 0, 1, 0, 0]);
    // Två band som överlappar: A täcker tisdag till torsdag (fil 0), B onsdag till lördag (fil 1). Dagen reserverar filen längst ned
    // av de band som täcker den, och en dag som bara B täcker reserverar båda filerna (B ligger i rad två).
    const tva = bandIVecka(vecka, [
      { id: "a", date: "2026-10-06", endDate: "2026-10-08", title: "A" },
      { id: "b", date: "2026-10-07", endDate: "2026-10-10", title: "B" },
    ]);
    expect(tva.map((b) => [b.entry.id, b.fil])).toEqual([["a", 0], ["b", 1]]);
    expect(reserveradeFiler(tva)).toEqual([0, 1, 2, 2, 2, 2, 0]);
    // Inga band alls: sju nollor och inte en tom lista (en tom lista går inte att skilja från "ostält").
    expect(reserveradeFiler([])).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("⛔ bara en ruta som ett band täcker får plats för bandet under siffran (0.106.0)", () => {
    kal();
    // Semestern 14-16 oktober är ett heldagsband. Rutorna den täcker reserverar plats, grannarna den 12, 13, 17 och 18 gör det inte.
    const plats = (/** @type {string} */ d) => document.querySelector(`[data-cal-day="${d}"] [data-bandplats]`);
    for (const d of ["2026-10-14", "2026-10-15", "2026-10-16"]) expect(plats(d), d).not.toBeNull();
    for (const d of ["2026-10-12", "2026-10-13", "2026-10-17", "2026-10-18"]) expect(plats(d), d).toBeNull();
  });

  it("väljer, veckar och drar som SS", () => {
    expect(valjDag(["2026-10-12"], "2026-10-05")).toEqual(["2026-10-05", "2026-10-12"]);
    expect(valjDag(["2026-10-05", "2026-10-12"], "2026-10-12")).toEqual(["2026-10-05"]);
    const v = ["2026-10-05", "2026-10-06"];
    expect(valjVecka(["2026-10-05"], v)).toEqual(v);
    expect(valjVecka(v, v)).toEqual([]);
    expect(valjIntervall(["2026-10-20"], ["2026-10-05"])).toEqual(["2026-10-20"]);
    expect(valjIntervall(["2026-10-20"], ["2026-10-05", "2026-10-06"])).toEqual(["2026-10-05", "2026-10-06", "2026-10-20"]);
  });

  it("söker i titel, not och kalenderns namn", () => {
    const e = { id: "x", date: "2026-10-05", title: "Styrelsemöte", not: "Visby", kalender: { id: "s", namn: "Styrelsen", farg: /** @type {4} */ (4) } };
    expect(traffar(e, "möte")).toBe(true);
    expect(traffar(e, "VISBY")).toBe(true);
    expect(traffar(e, "styrelsen")).toBe(true);
    expect(traffar(e, "lön")).toBe(false);
  });
});

const IDAG = new Date(2026, 9, 5, 12);
const KALENDRAR = [
  { id: "styrelse", namn: "Styrelsen", farg: /** @type {4} */ (4), grupp: true, forvald: true },
  { id: "resor", namn: "Resor", farg: /** @type {2} */ (2), grupp: true },
  { id: "privat", namn: "Privat", farg: /** @type {5} */ (5) },
];
const POSTER = [
  { id: "mote", date: "2026-10-12", title: "Styrelsemöte", typ: "mote", status: "oppet" },
  { id: "resa", date: "2026-10-12", title: "Tåg till Malmö", kalender: { id: "resor", namn: "Resor", farg: /** @type {2} */ (2) }, typ: "resa", status: "klart" },
  { id: "semester", date: "2026-10-14", endDate: "2026-10-16", allDay: true, title: "Semester", kalender: { id: "privat", namn: "Privat", farg: /** @type {5} */ (5) } },
];

/** @param {Record<string, any>} [extra] */
function kal(extra = {}) {
  return render(
    <OpsCalendar
      ariaLabel="Kalender"
      entries={POSTER}
      today={IDAG}
      monthsBack={0}
      monthsForward={0}
      kalendrar={KALENDRAR}
      typer={[{ id: "mote", namn: "Möte" }, { id: "resa", namn: "Resa" }]}
      statusWords={{ oppet: "Öppet", klart: "Klart" }}
      lagring={{ getItem: () => null, setItem: () => {} }}
      {...extra}
    />,
  );
}

describe("OpsCalendar som SS (F1)", () => {
  it("gruppen är kalendern: menyn säger inte att gruppen saknar kalendrar", async () => {
    kal({ kalendrar: [] });
    fireEvent.click(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" }));
    expect(await screen.findByText("Du har inga egna kalendrar ännu.")).toBeInTheDocument();
    expect(screen.queryByText("Gruppen har inga kalendrar ännu.")).toBeNull();
  });

  /*
   * ⛔ 0.84.0 (#309, CP:s kommentar 2026-10-08): 0.78.2 tog bort den falska raden men lät rubriken "Gruppens kalendrar" stå
   * ensam, utan något under. Mätt med Playwright i cllp/lifehub.app#134. En rubrik utan innehåll ser trasig ut. Rubriken ritas
   * nu bara när gruppen har namngivna kalendrar. Röda mot 0.82.0.
   */
  it("⛔ utan namngivna gruppkalendrar ritas ingen tom rubrik, och med dem står rubriken över dem", async () => {
    const { unmount } = kal({ kalendrar: [{ id: "privat", namn: "Privat", farg: 3, forvald: true }] });
    fireEvent.click(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" }));
    const meny = await screen.findByRole("dialog", { name: "Kalendrar" });
    expect(within(meny).getByText("Mina kalendrar")).toBeInTheDocument();
    expect(within(meny).getByRole("button", { name: "Privat" })).toBeInTheDocument();
    expect(within(meny).queryByText("Gruppens kalendrar")).toBeNull();
    unmount();
    kal();
    fireEvent.click(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" }));
    const meny2 = await screen.findByRole("dialog", { name: "Kalendrar" });
    expect(within(meny2).getByText("Gruppens kalendrar")).toBeInTheDocument();
    expect(within(meny2).getByRole("button", { name: "Styrelsen" })).toBeInTheDocument();
  });

  it("filtrerar på kalender: en bortvald kalender syns inte, och syns igen när den väljs", async () => {
    kal();
    expect(screen.getByRole("button", { name: "12, 2 poster" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Styrelsen" }));
    // ⛔ En post utan `kalender` hör till den förvalda, alltså syns mötet och inte resan.
    expect(screen.getByRole("button", { name: "12, 1 post" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resor" }));
    expect(screen.getByRole("button", { name: "12, 2 poster" })).toBeInTheDocument();
  });

  it("⛔ ett tomt kalenderurval är Alla, inte Inga", async () => {
    // Bortvald sista kalender hade annars ritat en tom månad som ser ut som att posterna saknas.
    kal();
    fireEvent.click(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Styrelsen" }));
    fireEvent.click(screen.getByRole("button", { name: "Styrelsen" }));
    expect(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12, 2 poster" })).toBeInTheDocument();
  });

  it("⛔ ramar in idag i appens tidszon och inte i webbläsarens", () => {
    // 5 oktober 23:30 UTC är den 6:e i Stockholm och den 5:e i New York.
    const nu = new Date(Date.UTC(2026, 9, 5, 23, 30));
    const idagsSiffra = () => [...document.querySelectorAll("[data-dagnummer]")].filter((n) => String(n.className).includes("rounded-full")).map((n) => n.textContent);
    const { unmount } = kal({ today: nu, tidszon: "America/New_York" });
    expect(idagsSiffra()).toEqual(["5"]);
    unmount();
    kal({ today: nu });
    expect(idagsSiffra()).toEqual(["6"]);
  });

  // ⛔ 0.37.0 (#179 F2): raden som sade att Hantera kalendrar kom i nästa steg är borta. Med `onHanteraKalendrar` är den en
  // knapp som öppnar hanteringen, utan den finns ingen rad (en kontroll finns bara när den gör något).
  it("Hantera kalendrar är en knapp med onHanteraKalendrar, och ingen rad utan den", async () => {
    let oppnad = 0;
    const { unmount } = kal({ onHanteraKalendrar: () => { oppnad += 1; } });
    fireEvent.click(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Hantera kalendrar" }));
    expect(oppnad).toBe(1);
    unmount();
    kal();
    fireEvent.click(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" }));
    await screen.findByRole("button", { name: "Styrelsen" });
    expect(screen.queryByText(/Hantera kalendrar/)).toBeNull();
  });

  it("filtrerar på typ och status i samma meny", async () => {
    kal();
    fireEvent.click(screen.getByRole("button", { name: "Typ och status" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resa" }));
    expect(screen.getByRole("button", { name: "12, 1 post" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Öppet" }));
    expect(screen.getByRole("button", { name: "12" })).toBeInTheDocument();
  });

  it("visar filtrets dolda poster i snabbtitten, märkta Dold", async () => {
    kal();
    fireEvent.click(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Styrelsen" }));
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.contextMenu(screen.getByRole("button", { name: "12, 1 post" }));
    const titt = document.querySelector("[data-snabbtitt]");
    expect(titt).not.toBeNull();
    expect([...titt.querySelectorAll("[data-titt-rad]")].map((r) => r.getAttribute("data-titt-rad"))).toEqual(["synlig", "dold"]);
    expect(within(/** @type {HTMLElement} */ (titt)).getByText("Dold")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector("[data-snabbtitt]")).toBeNull();
  });

  it("väljer hela veckan på veckonumret, och sparar veckonumren per enhet", () => {
    /** @type {Record<string, string>} */
    const minne = {};
    kal({ lagring: { getItem: (n) => minne[n] ?? null, setItem: (n, v) => void (minne[n] = v) } });
    fireEvent.click(screen.getByRole("button", { name: "Veckonummer" }));
    expect(minne[VECKONUMMER_NYCKEL]).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Välj vecka 42" }));
    expect(screen.getByRole("region", { name: "Poster för 7 valda dagar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Välj vecka 42" })).toHaveAttribute("aria-pressed", "true");
  });

  /** jsdom saknar `PointerEvent`: ett vanligt `Event` med pekarens fält räcker för fönstrets lyssnare. */
  const pekar = (/** @type {string} */ typ, /** @type {Record<string, number | string>} */ f) => Object.assign(new Event(typ, { bubbles: true }), f);

  it("drar över dagarna och lägger intervallet i urvalet, först efter 12 px", () => {
    kal();
    const fran = screen.getByRole("button", { name: "12, 2 poster" });
    const till = screen.getByRole("button", { name: "13" });
    const org = document.elementFromPoint;
    document.elementFromPoint = () => till;
    try {
      fireEvent(fran, pekar("pointerdown", { pointerId: 1, clientX: 10, clientY: 10, button: 0, pointerType: "mouse" }));
      // Under tröskeln: inget drag.
      act(() => void window.dispatchEvent(pekar("pointermove", { pointerId: 1, clientX: 15, clientY: 12 })));
      act(() => void window.dispatchEvent(pekar("pointermove", { pointerId: 1, clientX: 60, clientY: 10 })));
      act(() => void window.dispatchEvent(pekar("pointerup", { pointerId: 1, clientX: 60, clientY: 10 })));
      fireEvent.click(fran);
    } finally {
      document.elementFromPoint = org;
    }
    expect(screen.getByRole("region", { name: "Poster för 2 valda dagar" })).toBeInTheDocument();
  });

  it("⛔ sväljer inte nästa tryck efter ett drag som slutade på en annan ruta", () => {
    // Mätt i check-skalyta avsnitt 30: ett drag från en ruta till en annan ger inget klick på någon ruta, och flaggan som
    // skulle svälja det stod kvar och åt upp nästa riktiga tryck.
    kal();
    const fran = screen.getByRole("button", { name: "12, 2 poster" });
    const till = screen.getByRole("button", { name: "13" });
    const org = document.elementFromPoint;
    document.elementFromPoint = () => till;
    try {
      fireEvent(fran, pekar("pointerdown", { pointerId: 2, clientX: 10, clientY: 10, button: 0, pointerType: "mouse" }));
      act(() => void window.dispatchEvent(pekar("pointermove", { pointerId: 2, clientX: 60, clientY: 10 })));
      act(() => void window.dispatchEvent(pekar("pointerup", { pointerId: 2, clientX: 60, clientY: 10 })));
    } finally {
      document.elementFromPoint = org;
    }
    const tjugo = screen.getByRole("button", { name: "20" });
    fireEvent(tjugo, pekar("pointerdown", { pointerId: 3, clientX: 5, clientY: 5, button: 0, pointerType: "mouse" }));
    act(() => void window.dispatchEvent(pekar("pointerup", { pointerId: 3, clientX: 5, clientY: 5 })));
    fireEvent.click(tjugo);
    expect(screen.getByRole("region", { name: "Poster för 3 valda dagar" })).toBeInTheDocument();
  });

  it("ritar heldag och flerdag som band, och räknar semestern på varje dag den täcker", () => {
    kal();
    expect(document.querySelectorAll('[data-bandbit="semester"]').length).toBe(1);
    for (const d of ["14", "15", "16"]) expect(screen.getByRole("button", { name: `${d}, 1 post` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "15, 1 post" }));
    expect(within(screen.getByRole("region", { name: "Poster den 15 oktober" })).getByText(/14 oktober till 16 oktober · Heldag/)).toBeInTheDocument();
  });

  it("tonar ned dagar utan träff när man söker, och säger antalet, också noll", () => {
    kal();
    fireEvent.click(screen.getByRole("button", { name: "Sök i kalendern" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Sök i kalendern" }), { target: { value: "malmö" } });
    expect(screen.getByRole("button", { name: "12, 2 poster" }).querySelector("[data-nedtonad]")).toBeNull();
    expect(screen.getByRole("button", { name: "20" }).querySelector("[data-nedtonad]")?.getAttribute("data-nedtonad")).toBe("sok");
    expect(document.querySelector("[data-sok-antal]")?.textContent).toBe("1 dag");
    fireEvent.change(screen.getByRole("searchbox", { name: "Sök i kalendern" }), { target: { value: "finns inte" } });
    expect(document.querySelector("[data-sok-antal]")?.textContent).toBe("Inga träffar");
  });

  it("ger + de valda dagarna, och idag när ingen är vald", () => {
    /** @type {string[][]} */
    const fatt = [];
    kal({ onSkapa: (/** @type {string[]} */ d) => fatt.push(d) });
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "12, 2 poster" }));
    fireEvent.click(screen.getByRole("button", { name: "Skapa den 12 oktober" }));
    expect(fatt).toEqual([["2026-10-05"], ["2026-10-12"]]);
  });

  it("utan kalendrar, typer och onSkapa finns inga av de kontrollerna, men veckonummer och sök finns", () => {
    render(<OpsCalendar ariaLabel="K" entries={[]} today={IDAG} monthsBack={0} monthsForward={0} lagring={{ getItem: () => null, setItem: () => {} }} />);
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-kalender-verktyg]"));
    expect(within(rad).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Veckonummer", "Sök i kalendern"]);
  });
});
