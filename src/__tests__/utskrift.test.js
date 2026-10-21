import { describe, expect, it } from "vitest";
import { byggPost, inmatningsfel, postFel } from "../lib/bibliotek.js";
import {
  UTSKRIFT_FALT,
  UTSKRIFT_TAK_MS,
  UTSKRIFT_TIMEOUT_TEXT,
  UTSKRIFT_UPPSKATTNING,
  uppskattadUtskriftstid,
  utanUtskrift,
  utskriftLage,
  utskriftPagatText,
} from "../lib/utskrift.js";
import * as nod from "../node/index.js";

/**
 * Utskriftens läge på posten (0.133.0, lifehub.app#349, CP 2026-10-20). Läget ligger på posten (`utskriftJobb`) och tolkas av EN funktion, så att den som gick från sidan ser samma sak
 * när hen kommer tillbaka, och servern rensar samma fält som vyn räknar med.
 */

const NU = 1_800_000_000_000;
const MIN = 60_000;
const av = { uid: "uid-1", namn: "Kim" };
const jobb = (extra = {}) => ({ status: "pagar", startad: NU - 2 * MIN, av, ...extra });

describe("utskriftLage: de fyra lägena", () => {
  it("ingen: inget jobb och ingen utskrift", () => {
    expect(utskriftLage({}, NU)).toEqual({ lage: "ingen", startad: null, av: null, fel: "" });
    expect(utskriftLage(null, NU).lage).toBe("ingen");
    expect(utskriftLage(undefined, NU).lage).toBe("ingen");
    expect(utskriftLage({ utskrift: 5 }, NU).lage).toBe("ingen");
  });

  it("klar: en utskrift och inget jobb, också en TOM (en tyst inspelning är ett svar, inte ingen utskrift)", () => {
    expect(utskriftLage({ utskrift: "Hej" }, NU).lage).toBe("klar");
    expect(utskriftLage({ utskrift: "" }, NU).lage).toBe("klar");
  });

  it("pagar: ett jobb med status pagar, med startid och vem som startade", () => {
    expect(utskriftLage({ utskriftJobb: jobb() }, NU)).toEqual({ lage: "pagar", startad: NU - 2 * MIN, av, fel: "" });
  });

  it("⛔ pagar gäller också när posten har en gammal utskrift (utskriften körs om)", () => {
    expect(utskriftLage({ utskrift: "Gammal text", utskriftJobb: jobb() }, NU).lage).toBe("pagar");
  });

  it("fel: status fel med jobbets egen text", () => {
    expect(utskriftLage({ utskriftJobb: jobb({ status: "fel", fel: "Ljudet gick inte att läsa." }) }, NU)).toMatchObject({ lage: "fel", fel: "Ljudet gick inte att läsa." });
  });

  it("⛔ status fel utan text får ramverkets text, så att ett fel aldrig är tomt", () => {
    expect(utskriftLage({ utskriftJobb: jobb({ status: "fel" }) }, NU)).toMatchObject({ lage: "fel", fel: UTSKRIFT_TIMEOUT_TEXT });
    expect(utskriftLage({ utskriftJobb: jobb({ status: "fel", fel: "   " }) }, NU).fel).toBe(UTSKRIFT_TIMEOUT_TEXT);
  });

  it("⛔ GRÄNSEN PÅ 15 MINUTER: på gränsen pågår den, en millisekund över är den ett fel med texten 'Utskriften blev inte klar. Försök igen.'", () => {
    expect(UTSKRIFT_TAK_MS).toBe(15 * MIN);
    expect(UTSKRIFT_TIMEOUT_TEXT).toBe("Utskriften blev inte klar. Försök igen.");
    expect(utskriftLage({ utskriftJobb: jobb({ startad: NU - UTSKRIFT_TAK_MS }) }, NU).lage).toBe("pagar");
    expect(utskriftLage({ utskriftJobb: jobb({ startad: NU - UTSKRIFT_TAK_MS - 1 }) }, NU)).toMatchObject({ lage: "fel", fel: "Utskriften blev inte klar. Försök igen." });
    // Och ett fel stannar ett fel: tiden gör ingenting åt det.
    expect(utskriftLage({ utskriftJobb: jobb({ status: "fel", fel: "X", startad: NU - 5 * MIN }) }, NU).lage).toBe("fel");
  });

  it("⛔ ett jobb vi inte kan tolka är ett fel som syns, aldrig ett 'pågår' som ingen tar sig ur och aldrig 'ingen'", () => {
    for (const trasig of [{}, { status: "klar" }, { status: "pagar" }, { status: "pagar", startad: "nu" }, { status: "pagar", startad: -1 }, { status: "pagar", startad: Number.NaN }, "pagar", 5, []]) {
      expect(utskriftLage({ utskriftJobb: trasig }, NU).lage, JSON.stringify(trasig)).toBe("fel");
    }
    // En framtida starttid (klockorna går olika) är inte ett fel: den räknas som pågående.
    expect(utskriftLage({ utskriftJobb: jobb({ startad: NU + 5000 }) }, NU).lage).toBe("pagar");
  });

  it("vem som startade följer med, men bara när uid är en sträng", () => {
    expect(utskriftLage({ utskriftJobb: jobb({ av: { uid: "", namn: "X" } }) }, NU).av).toBeNull();
    expect(utskriftLage({ utskriftJobb: jobb({ av: { uid: "u" } }) }, NU).av).toEqual({ uid: "u", namn: "" });
  });
});

describe("uppskattningen är en bedömning och är märkt så", () => {
  it("ur ljudets längd: en fast del plus en andel, avrundat uppåt och aldrig under en minut", () => {
    expect(UTSKRIFT_UPPSKATTNING).toEqual({ fastMs: 30_000, andel: 0.25 });
    expect(uppskattadUtskriftstid(10_000)).toBe(1);
    expect(uppskattadUtskriftstid(180_000)).toBe(2);
    expect(uppskattadUtskriftstid(10 * MIN)).toBe(3);
    expect(uppskattadUtskriftstid(60 * MIN)).toBe(16);
  });
  it("⛔ en okänd längd ger ingen siffra (null), aldrig en gissning", () => {
    for (const v of [undefined, null, 0, -5, Number.NaN, Infinity, "180000"]) expect(uppskattadUtskriftstid(v), String(v)).toBeNull();
  });
  it("hur länge det pågått: mindre än en minut, annars hela minuter", () => {
    expect(utskriftPagatText(NU - 10_000, NU)).toBe("mindre än en minut");
    expect(utskriftPagatText(NU - 59_999, NU)).toBe("mindre än en minut");
    expect(utskriftPagatText(NU - MIN, NU)).toBe("1 min");
    expect(utskriftPagatText(NU - 7 * MIN - 30_000, NU)).toBe("7 min");
    expect(utskriftPagatText(NU + 1000, NU)).toBe("mindre än en minut");
    expect(utskriftPagatText(null, NU)).toBe("");
  });
});

describe("fälten som rensas: ETT hem som servern delar", () => {
  it("är utskriften och jobbet, och inget annat", () => {
    expect([...UTSKRIFT_FALT]).toEqual(["utskrift", "utskriftJobb"]);
  });
  it("utanUtskrift tar bort exakt de fälten och rör inte originalet", () => {
    const post = { rubrik: "Idé", utskrift: "Text", utskriftJobb: jobb(), durationMs: 5, taggar: ["a"] };
    const ut = utanUtskrift(post);
    expect(ut).toEqual({ rubrik: "Idé", durationMs: 5, taggar: ["a"] });
    expect(post.utskrift).toBe("Text");
    expect(Object.keys(post).filter((k) => !(k in ut)).sort()).toEqual([...UTSKRIFT_FALT].sort());
  });
  it("⛔ servern når samma lista och samma tolkning genom ops-framework/node", () => {
    expect(nod.UTSKRIFT_FALT).toBe(UTSKRIFT_FALT);
    expect(nod.utskriftLage).toBe(utskriftLage);
    expect(nod.utanUtskrift).toBe(utanUtskrift);
  });
});

describe("utskriftJobb på posten: ett ljud kan bära det, och postens modell fäller inte posten för det", () => {
  const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
  const ljud = (extra = {}) => ({ groupId: "cps-ab", typ: "fil", rubrik: "Idé", fil: { sokvag: "grupper/cps-ab/bibliotek/p/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 4000 }, skapadAv: skapare, skapad: 1, andrad: 1, ...extra });

  it("⛔ en post med ett jobb är giltig och jobbet följer med byggPost (annars hade appen aldrig sett det)", () => {
    const d = ljud({ utskriftJobb: jobb() });
    expect(postFel(d)).toBeNull();
    expect(byggPost(d).utskriftJobb).toEqual(jobb());
  });
  it("⛔ ett jobb med konstig form fäller inte posten (utskriftLage tolkar det som ett fel som syns)", () => {
    expect(postFel(ljud({ utskriftJobb: { status: "vad", startad: "i går" } }))).toBeNull();
  });
  it("jobbet hör bara till ett ljud: en anteckning, en länk, en lista och en bild nekas", () => {
    expect(inmatningsfel({ typ: "anteckning", rubrik: "A", text: "t", utskriftJobb: jobb() })).toMatch(/inget utskriftsjobb/);
    expect(inmatningsfel({ typ: "lank", rubrik: "A", url: "https://exempel.se", utskriftJobb: jobb() })).toMatch(/inget utskriftsjobb/);
    expect(inmatningsfel({ typ: "lista", rubrik: "A", poster: [], utskriftJobb: jobb() })).toMatch(/utskriftJobb/);
    expect(postFel(ljud({ fil: { sokvag: "grupper/cps-ab/bibliotek/p/k.jpg", namn: "k.jpg", mime: "image/jpeg", byte: 100 }, utskriftJobb: jobb() }))).toMatch(/Bara ett ljud har ett utskriftsjobb/);
  });
  it("jobbet ska vara ett objekt", () => {
    for (const v of ["pagar", 5, true, [jobb()]]) expect(postFel(ljud({ utskriftJobb: v })), String(v)).toMatch(/objekt/);
  });
});
