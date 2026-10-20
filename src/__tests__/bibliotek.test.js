import { describe, expect, it } from "vitest";
import { ADRESSFORM, BIBLIOTEKFALT, BIBLIOTEKFLIKAR, BIBLIOTEKTYPER, LJUD_STOLPAR, MAX_BIBLIOTEKUTSKRIFT, MAX_LJUD_MS, TOPPFORM, TOPP_NIVAER, TOPP_TECKEN, arLjudpost, filInmatningsfel, LJUDFIL_ACCEPT, mimeUrFilnamn, normaliseraMime, avkodaToppar, byggPost, farAndra, filtreraBibliotek, ideRubrik, inmatningsfel, kodaToppar, ljudDatum, ljudRubrik, normaliseraAdress, peaksGiltiga, postFel, taggfarg, toppListaGiltig, trimSomRegeln } from "../lib/bibliotek.js";
import { SKAPARFALT, byggSkapare } from "../lib/skapare.js";

/**
 * Bibliotekets form (analys 0004, #192, skiva 1).
 *
 * Proven mäter vad som avvisas. En byggare som bara provas med giltig data
 * är grön genom felet den finns för att fånga.
 */

const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const tid = 1_700_000_000_000;

const anteckning = {
  groupId: "cps-ab",
  typ: "anteckning",
  rubrik: "Protokoll",
  text: "Vi beslutade.",
  skapadAv: skapare,
  skapad: tid,
  andrad: tid,
};

describe("bibliotekets post", () => {
  it("bygger en anteckning utan adress och en länk utan text", () => {
    const a = byggPost(anteckning);
    expect(a.typ).toBe("anteckning");
    expect(a.text).toBe("Vi beslutade.");
    expect(Object.hasOwn(a, "url")).toBe(false);
    const l = byggPost({ ...anteckning, typ: "lank", text: undefined, url: "https://bolagsverket.se" });
    expect(l.url).toBe("https://bolagsverket.se/");
    expect(Object.hasOwn(l, "text")).toBe(false);
    expect(BIBLIOTEKTYPER).toEqual(["anteckning", "lank", "fil", "lista"]);
    expect(BIBLIOTEKFALT).toContain("groupId");
  });

  it("en idé heter Idé plus datum och tid", () => {
    expect(ideRubrik(new Date(2026, 9, 8, 21, 5))).toBe("Idé 2026-10-08 21:05");
  });

  it("ett ljud utan namn heter Röstinspelning plus datum, och ett döpt ljud behåller rubriken", () => {
    const skapad = new Date(2026, 9, 8, 21, 5).getTime();
    expect(ljudRubrik({ rubrik: "  ", skapad })).toBe(`Röstinspelning ${ljudDatum(skapad)}`);
    expect(ljudRubrik({ rubrik: "Hyllan", skapad })).toBe("Hyllan");
    expect(ljudRubrik({ rubrik: "", skapad: "igår" })).toBe("Röstinspelning");
    expect(ljudDatum(skapad)).toMatch(/2026/);
  });

  it("längd och våg hör bara till ett ljud, och vågen är en sträng med ett bestämt antal tecken", () => {
    const bas = { ...anteckning, typ: "fil", text: undefined, rubrik: "Idé" };
    const ljud = { sokvag: "grupper/cps-ab/bibliotek/p1/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 100 };
    const toppar = Array.from({ length: LJUD_STOLPAR }, (_, i) => (i === 3 ? 1 : i / 100));
    const vag = kodaToppar(toppar);
    expect(peaksGiltiga(vag)).toBe(true);
    expect(peaksGiltiga(vag.slice(0, 4))).toBe(false);
    const byggd = byggPost({ ...bas, fil: ljud, durationMs: 4200, peaks: vag });
    expect(byggd.durationMs).toBe(4200);
    expect(byggd.peaks).toBe(vag);
    expect(byggd.peaks).toHaveLength(LJUD_STOLPAR);
    expect(postFel({ ...bas, fil: ljud, durationMs: 0 })).toMatch(/durationMs/);
    expect(postFel({ ...bas, fil: ljud, durationMs: MAX_LJUD_MS + 1 })).toMatch(/durationMs/);
    expect(postFel({ ...bas, fil: ljud, peaks: "AB" })).toMatch(/topp/);
    expect(postFel({ ...bas, fil: ljud, peaks: `${vag.slice(0, -1)}!` })).toMatch(/topp/);
    // ⛔ En lista av tal är inte längre en våg: det var formen som reglerna aldrig släppte in (#349).
    expect(postFel({ ...bas, fil: ljud, peaks: toppar })).toMatch(/sträng/);
    expect(postFel({ ...anteckning, durationMs: 1000 })).toMatch(/ingen längd/);
    const bild = { sokvag: "grupper/cps-ab/bibliotek/p1/k.jpg", namn: "k.jpg", mime: "image/jpeg", byte: 100 };
    expect(postFel({ ...bas, fil: bild, durationMs: 1000 })).toMatch(/Bara ett ljud/);
    expect(postFel({ ...bas, fil: bild, peaks: vag })).toMatch(/Bara ett ljud/);
  });

  describe("vågen som sträng (#349)", () => {
    it("alfabetet är 64 olika tecken, och mönstret släpper in exakt dem", () => {
      expect(TOPP_NIVAER).toBe(64);
      expect(new Set(TOPP_TECKEN).size).toBe(TOPP_NIVAER);
      // Mönstret (som regeln också skriver) och alfabetet är samma mängd: varje tecken i alfabetet går igenom,
      // och inget annat i Latin-1 gör det. Annars hade regeln släppt in en nivå modellen inte kan avkoda.
      const enStolpe = new RegExp(`^${TOPPFORM.source.slice(1, TOPPFORM.source.indexOf("{"))}$`);
      for (const t of TOPP_TECKEN) expect(enStolpe.test(t), `alfabetet: ${t}`).toBe(true);
      for (let c = 0; c < 256; c++) {
        const t = String.fromCharCode(c);
        expect(enStolpe.test(t), `U+${c.toString(16)}`).toBe(TOPP_TECKEN.includes(t));
      }
    });

    it("omvandlingen tur och retur: varje nivå överlever, och ett tal hamnar högst en halv nivå från sig självt", () => {
      // Golv: alla 64 nivåer prövas, inte ett urval.
      const alla = Array.from({ length: TOPP_NIVAER }, (_, i) => TOPP_TECKEN[i]);
      expect(alla).toHaveLength(64);
      for (let i = 0; i < TOPP_NIVAER; i++) {
        const ritad = avkodaToppar(TOPP_TECKEN[i].repeat(LJUD_STOLPAR));
        expect(ritad).toHaveLength(LJUD_STOLPAR);
        expect(ritad?.[0], `nivå ${i}`).toBeCloseTo(i / (TOPP_NIVAER - 1), 12);
        expect(kodaToppar(/** @type {number[]} */ (ritad)), `nivå ${i}`).toBe(TOPP_TECKEN[i].repeat(LJUD_STOLPAR));
      }
      const slump = Array.from({ length: LJUD_STOLPAR }, (_, i) => ((i * 37) % 101) / 100);
      const tillbaka = /** @type {number[]} */ (avkodaToppar(kodaToppar(slump)));
      tillbaka.forEach((v, i) => expect(Math.abs(v - slump[i])).toBeLessThanOrEqual(1 / (TOPP_NIVAER - 1) / 2 + 1e-12));
    });

    it("kanterna: 0 är A, 1 är _, och en tyst våg stannar tyst", () => {
      expect(kodaToppar(Array(LJUD_STOLPAR).fill(0))).toBe("A".repeat(LJUD_STOLPAR));
      expect(kodaToppar(Array(LJUD_STOLPAR).fill(1))).toBe("_".repeat(LJUD_STOLPAR));
      expect(kodaToppar(Array(LJUD_STOLPAR).fill(0.5))).toBe(TOPP_TECKEN[32].repeat(LJUD_STOLPAR));
      expect(avkodaToppar("A".repeat(LJUD_STOLPAR))?.every((v) => v === 0)).toBe(true);
      expect(avkodaToppar("_".repeat(LJUD_STOLPAR))?.every((v) => v === 1)).toBe(true);
    });

    it("kodaToppar kastar på fel form i stället för att klippa den", () => {
      expect(() => kodaToppar([])).toThrow(/kodaToppar/);
      expect(() => kodaToppar(Array(LJUD_STOLPAR - 1).fill(0.5))).toThrow(/kodaToppar/);
      expect(() => kodaToppar(Array(LJUD_STOLPAR).fill(1.01))).toThrow(/kodaToppar/);
      expect(() => kodaToppar(Array(LJUD_STOLPAR).fill(-0.01))).toThrow(/kodaToppar/);
      expect(() => kodaToppar(Array(LJUD_STOLPAR).fill(Number.NaN))).toThrow(/kodaToppar/);
      expect(() => kodaToppar(/** @type {any} */ ("A".repeat(LJUD_STOLPAR)))).toThrow(/kodaToppar/);
    });

    it("⛔ avkodaToppar ger null för allt som inte är en sparad våg, så läsaren aldrig kastar", () => {
      const ok = "A".repeat(LJUD_STOLPAR);
      expect(avkodaToppar(ok)).not.toBeNull();
      for (const fel of [
        undefined,
        null,
        42,
        "",
        ok.slice(1),
        `${ok}A`,
        `${ok.slice(1)}!`,
        `${ok.slice(1)}\n`,
        `${ok.slice(1)}å`,
        // Den gamla formen, en lista av tal. Ingen databas bär den (varje skrivning med den nekades), men läsaren ska tåla den.
        Array.from({ length: LJUD_STOLPAR }, () => 0.5),
        { length: LJUD_STOLPAR },
      ]) {
        expect(avkodaToppar(fel), JSON.stringify(fel)).toBeNull();
        expect(peaksGiltiga(fel), JSON.stringify(fel)).toBe(false);
      }
    });

    it("toppListaGiltig är ritformen: tal mellan 0 och 1, rätt antal, och ingen sträng", () => {
      expect(toppListaGiltig(Array(LJUD_STOLPAR).fill(0.3))).toBe(true);
      expect(toppListaGiltig(Array(LJUD_STOLPAR - 1).fill(0.3))).toBe(false);
      expect(toppListaGiltig(Array(LJUD_STOLPAR).fill(2))).toBe(false);
      expect(toppListaGiltig("A".repeat(LJUD_STOLPAR))).toBe(false);
    });
  });

  it("en fil med bild, dokument eller ljud går att bygga, och fel format eller för stor fil gör det inte", () => {
    const bas = { ...anteckning, typ: "fil", text: undefined, rubrik: "Kvitto" };
    const fil = { sokvag: "grupper/cps-ab/bibliotek/p1/kvitto.jpg", namn: "kvitto.jpg", mime: "image/jpeg", byte: 1200 };
    expect(inmatningsfel({ typ: "fil", rubrik: "Kvitto", fil })).toBeNull();
    const byggd = byggPost({ ...bas, fil });
    expect(byggd.fil.mime).toBe("image/jpeg");
    expect(Object.hasOwn(byggd, "text")).toBe(false);
    expect(byggPost({ ...bas, fil: { ...fil, mime: "audio/webm;codecs=opus", namn: "ide.webm", sokvag: "grupper/cps-ab/bibliotek/p1/ide.webm" } }).fil.mime).toBe("audio/webm");
    expect(postFel({ ...bas, fil: { ...fil, mime: "application/zip" } })).toMatch(/application\/zip/);
    expect(postFel({ ...bas, fil: { ...fil, byte: 25 * 1024 * 1024 + 1 } })).toMatch(/Taket/);
    expect(postFel({ ...anteckning, fil })).toMatch(/ingen fil/);
  });

  it("⛔ ljud har ett eget tak på 250 MB, bilder och dokument behåller 25 MB (CP 2026-10-18, WAV)", () => {
    expect(filInmatningsfel({ namn: "lat.wav", mime: "audio/wav", byte: 64264206 })).toBeNull();
    expect(filInmatningsfel({ namn: "lat.wav", mime: "audio/x-wav", byte: 64264206 })).toBeNull();
    expect(filInmatningsfel({ namn: "lat.aiff", mime: "audio/x-aiff", byte: 100000000 })).toBeNull();
    expect(filInmatningsfel({ namn: "lat.flac", mime: "audio/flac", byte: 250 * 1024 * 1024 })).toBeNull();
    expect(filInmatningsfel({ namn: "lat.wav", mime: "audio/wav", byte: 250 * 1024 * 1024 + 1 })).toMatch(/Taket är 262144000 för ljud/);
    expect(filInmatningsfel({ namn: "bild.jpg", mime: "image/jpeg", byte: 64264206 })).toMatch(/Taket är 26214400/);
    expect(normaliseraMime("audio/wave")).toBe("audio/wav");
    expect(mimeUrFilnamn("Låt.AIF")).toBe("audio/aiff");
    expect(mimeUrFilnamn("bild.jpg")).toBe("");
  });

  it("⛔ ljud som en telefon eller en dator ger: m4a, mp3, aac och ogg godtas, med och utan MIME (0.133.0, Ladda upp ljudfil)", () => {
    expect(filInmatningsfel({ namn: "a.aac", mime: "audio/aac", byte: 1000 })).toBeNull();
    expect(filInmatningsfel({ namn: "a.m4a", mime: normaliseraMime("audio/x-m4a"), byte: 1000 })).toBeNull();
    expect(normaliseraMime("audio/x-m4a")).toBe("audio/mp4");
    expect(normaliseraMime("audio/m4a")).toBe("audio/mp4");
    expect(normaliseraMime("audio/mp3")).toBe("audio/mpeg");
    expect(normaliseraMime("audio/x-aac")).toBe("audio/aac");
    expect(mimeUrFilnamn("Minne.m4a")).toBe("audio/mp4");
    expect(mimeUrFilnamn("a.mp3")).toBe("audio/mpeg");
    expect(mimeUrFilnamn("a.aac")).toBe("audio/aac");
    expect(mimeUrFilnamn("a.ogg")).toBe("audio/ogg");
    expect(LJUDFIL_ACCEPT).toMatch(/^audio\/\*,/);
  });

  it("en utskrift hör bara till ett ljud, och en tom utskrift är ett svar", () => {
    const bas = { ...anteckning, typ: "fil", text: undefined, rubrik: "Idé" };
    const ljud = { sokvag: "grupper/cps-ab/bibliotek/p1/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 100 };
    const bild = { sokvag: "grupper/cps-ab/bibliotek/p1/k.jpg", namn: "k.jpg", mime: "image/jpeg", byte: 100 };
    expect(postFel({ ...bas, fil: ljud, utskrift: "Hej" })).toBeNull();
    expect(byggPost({ ...bas, fil: ljud, utskrift: "" }).utskrift).toBe("");
    expect(Object.hasOwn(byggPost({ ...bas, fil: ljud }), "utskrift")).toBe(false);
    expect(postFel({ ...bas, fil: ljud, utskrift: "x".repeat(MAX_BIBLIOTEKUTSKRIFT + 1) })).toMatch(/Taket/);
    expect(postFel({ ...bas, fil: bild, utskrift: "Hej" })).toMatch(/Bara ett ljud/);
    expect(postFel({ ...anteckning, utskrift: "Hej" })).toMatch(/ingen utskrift/);
  });

  it("avvisar javascript-adress, låt och ett fält som inte hör hit", () => {
    expect(inmatningsfel({ typ: "lank", rubrik: "X", url: "javascript:alert(1)" })).toMatch(/http eller https/);
    expect(postFel({ ...anteckning, typ: "song", text: "a" })).toMatch(/song/);
    expect(postFel({ ...anteckning, artist: "Någon" })).toMatch(/artist/);
    expect(() => byggPost({ ...anteckning, url: "https://exempel.se" })).toThrow(/ingen adress/);
  });

  it("skaparens fältlista är byggarens nycklar", () => {
    expect(Object.keys(byggSkapare(skapare)).sort()).toEqual([...SKAPARFALT].sort());
  });

  it("filtrerar på typ och sök, och noll träffar är en tom lista", () => {
    const poster = [
      { ...byggPost(anteckning), id: "a" },
      { ...byggPost({ ...anteckning, typ: "lank", text: undefined, url: "https://bolagsverket.se", rubrik: "Verket", andrad: tid + 1 }), id: "b" },
    ];
    expect(filtreraBibliotek(poster, { flik: "lank" }).map((p) => p.id)).toEqual(["b"]);
    expect(filtreraBibliotek(poster, { sok: "beslutade" }).map((p) => p.id)).toEqual(["a"]);
    expect(filtreraBibliotek(poster, { sok: "finns inte" })).toEqual([]);
  });

  it("⛔ flikarna är SessionStudios sex plus Listor (0.128.0), och Ljud, Bilder och Dokument är härledda ur MIME utan att en post syns under två (0.102.0)", () => {
    expect(BIBLIOTEKFLIKAR).toEqual(["alla", "ljud", "anteckning", "bild", "fil", "lank", "lista"]);
    const bas = { ...anteckning, typ: "fil", text: undefined };
    const ljud = {
      ...byggPost({
        ...bas,
        rubrik: "Idé",
        fil: { sokvag: "grupper/cps-ab/bibliotek/p1/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 100 },
      }),
      id: "l",
    };
    const bild = {
      ...byggPost({
        ...bas,
        rubrik: "Kvitto",
        fil: { sokvag: "grupper/cps-ab/bibliotek/p1/k.jpg", namn: "k.jpg", mime: "image/jpeg", byte: 100 },
        andrad: tid + 1,
      }),
      id: "i",
    };
    const pdf = {
      ...byggPost({
        ...bas,
        rubrik: "Avtal",
        fil: { sokvag: "grupper/cps-ab/bibliotek/p1/a.pdf", namn: "a.pdf", mime: "application/pdf", byte: 100 },
        andrad: tid + 2,
      }),
      id: "d",
    };
    const alla = [ljud, bild, pdf];
    expect(arLjudpost(ljud)).toBe(true);
    expect(arLjudpost(bild)).toBe(false);
    expect(filtreraBibliotek(alla, { flik: "ljud" }).map((p) => p.id)).toEqual(["l"]);
    expect(filtreraBibliotek(alla, { flik: "bild" }).map((p) => p.id)).toEqual(["i"]);
    // `fil` är Dokument: varken bild eller ljud.
    expect(filtreraBibliotek(alla, { flik: "fil" }).map((p) => p.id)).toEqual(["d"]);
    // Golv: varje post ligger under exakt en av filflikarna, så ingen av raderna ovan är grön av ett tomt urval.
    const per = ["ljud", "bild", "fil"].flatMap((flik) => filtreraBibliotek(alla, { flik }).map((p) => p.id));
    expect(per.sort()).toEqual(["d", "i", "l"]);
    expect(filtreraBibliotek(alla, { flik: "alla" })).toHaveLength(3);
  });

  it("⛔ taggens färg är SessionStudios hash, och samma tagg får samma färg oavsett hur den skrevs (0.102.0)", () => {
    // Värdena är SessionStudios `tagColorFromHash` för samma ord, så samma tagg har samma ton här som där.
    expect(taggfarg("idé")).toBe(7);
    expect(taggfarg("styrelse")).toBe(4);
    expect(taggfarg("2026")).toBe(3);
    expect(taggfarg("kvitto")).toBe(8);
    expect(taggfarg("bil")).toBe(6);
    expect(taggfarg("faktura")).toBe(1);
    // Taggen normaliseras först: versaler, # och NFD ("e" plus kombinerande accent, som inklistrad text från macOS kan bära) ger
    // samma färg. Utan normaliseringen ger NFD-formen 8, inte 7.
    expect(taggfarg("#Idé")).toBe(7);
    expect(taggfarg("ide\u0301")).toBe(7);
    // Alltid 1 till 8, också för tomt.
    for (const t of ["", "a", "bil 2024", "år-2025", "x".repeat(40)]) {
      expect(taggfarg(t)).toBeGreaterThanOrEqual(1);
      expect(taggfarg(t)).toBeLessThanOrEqual(8);
    }
  });

  it("mellanslag är tomt, och adressen prövas mot ADRESSFORM som regeln", () => {
    expect(postFel({ ...anteckning, rubrik: "   " })).toMatch(/Rubriken saknas/);
    expect(postFel({ ...anteckning, text: " \n\t " })).toMatch(/saknar text/);
    const lank = { ...anteckning, typ: "lank", text: undefined };
    expect(postFel({ ...lank, url: "http://exa mple" })).toMatch(/går inte att läsa/);
    expect(postFel({ ...lank, url: "https://" })).toMatch(/går inte att läsa/);
    expect(postFel({ ...lank, url: "https://bolagsverket.se/" })).toBeNull();
    expect(ADRESSFORM.test("http://exa mple")).toBe(false);
    expect(ADRESSFORM.test("javascript:alert(1)")).toBe(false);
    expect(normaliseraAdress(" https://sv.wikipedia.org/wiki/Åre ")).toBe("https://sv.wikipedia.org/wiki/%C3%85re");
    expect(ADRESSFORM.test(normaliseraAdress("https://sv.wikipedia.org/wiki/Åre"))).toBe(true);
  });

  it("tomhet räknas som Firestores trim: bara U+0000 till U+0020 (granskningen av #304)", () => {
    // Regeln släpper in de här, och emulatorn bekräftar det i rules/__tests__/bibliotek.test.mjs.
    // Med JavaScripts trim sade modellen "Rubriken saknas." och raden hamnade i trasiga för alltid.
    for (const rubrik of ["\u00A0", "\u3000", "\u2028", "\uFEFF"]) {
      expect(postFel({ ...anteckning, rubrik })).toBeNull();
      expect(inmatningsfel({ typ: "anteckning", rubrik, text: "T" })).toBeNull();
      expect(byggPost({ ...anteckning, rubrik }).rubrik).toBe(rubrik);
    }
    for (const text of ["\u00A0", "\u3000"]) {
      expect(postFel({ ...anteckning, text })).toBeNull();
      expect(byggPost({ ...anteckning, text }).text).toBe(text);
    }
    // Och tvärtom: U+001F trimmas av regeln men inte av JavaScript.
    expect(postFel({ ...anteckning, rubrik: "\u001F" })).toMatch(/Rubriken saknas/);
    expect(postFel({ ...anteckning, text: "\u0000\u001F " })).toMatch(/saknar text/);
    expect(byggPost({ ...anteckning, rubrik: "\u001F \u00A0Protokoll\u00A0\t" }).rubrik).toBe("\u00A0Protokoll\u00A0");
    expect(trimSomRegeln(42)).toBe("");
  });

  it("klockslagen är heltal, och andrad ligger inte före skapad", () => {
    expect(postFel({ ...anteckning, skapad: 1.5 })).toMatch(/heltal/);
    expect(postFel({ ...anteckning, andrad: tid - 1 })).toMatch(/före skapad/);
  });

  it("farAndra är regelns update: författaren eller ägare och admin", () => {
    const post = { ...byggPost(anteckning), id: "a" };
    expect(farAndra(post, { uid: "uid-1", roll: "medlem" })).toBe(true);
    expect(farAndra(post, { uid: "uid-2", roll: "medlem" })).toBe(false);
    expect(farAndra(post, { uid: "uid-2", roll: "admin" })).toBe(true);
    expect(farAndra(post, { uid: "uid-2", roll: "agare" })).toBe(true);
    expect(farAndra(post, { uid: "uid-2", roll: "admin", groupId: "miranda-ab" })).toBe(false);
    expect(farAndra(post, null)).toBe(false);
    // ⛔ #311: en avslutad admin och en avslutad författare är nej, samma som regeln. Utan status är svaret som förut.
    expect(farAndra(post, { uid: "uid-2", roll: "admin", status: "avslutad" })).toBe(false);
    expect(farAndra(post, { uid: "uid-1", roll: "medlem", status: "avslutad" })).toBe(false);
    expect(farAndra(post, { uid: "uid-2", roll: "admin", status: "aktiv" })).toBe(true);
  });
});
