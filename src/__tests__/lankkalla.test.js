import { describe, expect, it } from "vitest";
import { KALLOR, LANKKALLOR, lankKalla, lankKallnamn, lankRubrik, lankkallaForm } from "../lib/lankkalla.js";
import { BILDFORM, byggPost, inmatningsfel, postFel } from "../lib/bibliotek.js";
import { bibliotekregelfragment, regelfragment } from "../lib/regler.js";

/**
 * Smart länk (0.128.0, cllp/lifehub.app#378): källan härleds ur adressen på ETT ställe, och modellen, Firestore-regeln och nodsidans vitlista läser samma värdlista.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const lank = (extra = {}) => ({ groupId: "cps-ab", typ: "lank", rubrik: "Låt", url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", skapadAv: skapare, skapad: tid, andrad: tid, ...extra });

describe("lankKalla", () => {
  it("känner igen de fyra källorna på deras värdar, och allt annat är `annat`", () => {
    const fall = /** @type {Array<[string, string]>} */ ([
      ["https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", "spotify"],
      ["https://open.spotify.com", "spotify"],
      ["https://open.spotify.com/album/x?si=abc#t", "spotify"],
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"],
      ["https://youtube.com/watch?v=dQw4w9WgXcQ", "youtube"],
      ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"],
      ["https://music.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"],
      ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
      ["https://music.apple.com/se/album/x/123?i=456", "applemusic"],
      ["https://soundcloud.com/forss/flickermood", "soundcloud"],
      ["https://www.soundcloud.com/forss/flickermood", "soundcloud"],
      ["https://m.soundcloud.com/forss/flickermood", "soundcloud"],
      ["https://bolagsverket.se/", "annat"],
      ["https://example.com/spotify", "annat"],
    ]);
    for (const [url, kalla] of fall) expect(lankKalla(url), url).toBe(kalla);
  });

  it("⛔ en värd som bara LIKNAR en källa är `annat`: tillägg före, efter eller som användaruppgift, en annan port och en okrypterad adress", () => {
    const falska = [
      "https://open.spotify.com.evil.se/track/x",
      "https://open.spotify.com@evil.se/track/x",
      "https://evil.se/https://open.spotify.com/",
      "https://notopen.spotify.com/track/x",
      "https://xopen.spotify.com/",
      "https://open-spotify.com/",
      "https://spotify.com/",
      "https://youtube.com.evil.se/",
      "https://youtu.be.evil.se/x",
      "https://music.apple.com:8443/x",
      "http://open.spotify.com/track/x",
      "http://youtu.be/x",
      "HTTPS://open.spotify.com/x",
      "https://OPEN.spotify.com/x",
      "ftp://open.spotify.com/x",
      "https://open.spotify.com\\@evil.se",
      "https://open.spotify.com evil",
    ];
    for (const url of falska) expect(lankKalla(url), url).toBe("annat");
  });

  it("det som inte är en adress är `annat`, aldrig ett kast", () => {
    for (const v of [undefined, null, 5, {}, "", "inte en adress", ["https://open.spotify.com/"]]) expect(lankKalla(v)).toBe("annat");
  });

  it("⛔ värdlistan har sina fyra källor (golv), varje värd bara hos EN källa, och `KALLOR` är de fyra plus `annat`", () => {
    expect(LANKKALLOR.map((k) => k.kalla)).toEqual(["spotify", "youtube", "applemusic", "soundcloud"]);
    expect([...KALLOR]).toEqual(["spotify", "youtube", "applemusic", "soundcloud", "annat"]);
    const alla = LANKKALLOR.flatMap((k) => k.vardar);
    expect(alla.length).toBeGreaterThanOrEqual(10);
    expect(new Set(alla).size).toBe(alla.length);
    for (const k of LANKKALLOR) {
      expect(k.vardar.length, k.kalla).toBeGreaterThan(0);
      for (const v of k.vardar) expect(lankKalla(`https://${v}/x`), v).toBe(k.kalla);
    }
  });

  it("`lankkallaForm` kastar för `annat`: det har ingen form, det är alla andra adresser", () => {
    expect(() => lankkallaForm(/** @type {any} */ ("annat"))).toThrow(/ingen av de fyra källorna/);
    expect(lankkallaForm("spotify").test("https://open.spotify.com/x")).toBe(true);
  });

  it("namnen som visas", () => {
    expect(lankKallnamn("spotify")).toBe("Spotify");
    expect(lankKallnamn("applemusic")).toBe("Apple Music");
    expect(lankKallnamn("soundcloud")).toBe("SoundCloud");
    expect(lankKallnamn("youtube")).toBe("YouTube");
    expect(lankKallnamn("annat")).toBeNull();
  });
});

describe("lankRubrik: 'titel, artist'", () => {
  it("titel och artist skiljs av komma; en av dem ensam står ensam; ingen ger tom sträng", () => {
    expect(lankRubrik({ titel: "Lose Yourself", artist: "Eminem" })).toBe("Lose Yourself, Eminem");
    expect(lankRubrik({ titel: "Lose Yourself" })).toBe("Lose Yourself");
    expect(lankRubrik({ artist: "Eminem" })).toBe("Eminem");
    expect(lankRubrik({})).toBe("");
    expect(lankRubrik(null)).toBe("");
    expect(lankRubrik({ titel: 5, artist: {} })).toBe("");
  });

  it("blanksteg städas, och en artist som redan står i titeln läggs inte till en andra gång", () => {
    expect(lankRubrik({ titel: "  Lose   Yourself \n", artist: " Eminem " })).toBe("Lose Yourself, Eminem");
    expect(lankRubrik({ titel: "Eminem - Lose Yourself", artist: "Eminem" })).toBe("Eminem - Lose Yourself");
    expect(lankRubrik({ titel: "Lose Yourself (Eminem)", artist: "eminem" })).toBe("Lose Yourself (Eminem)");
  });
});

describe("posten bär källan och omslaget, och källan är härledd", () => {
  it("byggPost skriver `kalla` ur adressen, för alla fem värden", () => {
    expect(byggPost(lank()).kalla).toBe("spotify");
    expect(byggPost(lank({ url: "https://youtu.be/dQw4w9WgXcQ" })).kalla).toBe("youtube");
    expect(byggPost(lank({ url: "https://music.apple.com/se/album/x/1" })).kalla).toBe("applemusic");
    expect(byggPost(lank({ url: "https://soundcloud.com/a/b" })).kalla).toBe("soundcloud");
    expect(byggPost(lank({ url: "https://bolagsverket.se/" })).kalla).toBe("annat");
  });

  it("⛔ host med versaler normaliseras av `normaliseraAdress` före härledningen: samma sak som reglerna ser", () => {
    expect(byggPost(lank({ url: "https://OPEN.Spotify.com/Track/X" })).kalla).toBe("spotify");
  });

  it("⛔ en `kalla` som inte är den adressen ger avvisas, både i formuläret och i dokumentet", () => {
    expect(inmatningsfel(lank({ kalla: "youtube" }))).toMatch(/Källan "youtube" stämmer inte med adressen, som är "spotify"/);
    expect(postFel(lank({ kalla: "annat" }))).toMatch(/stämmer inte/);
    expect(() => byggPost(lank({ kalla: "soundcloud" }))).toThrow(/stämmer inte med adressen/);
    expect(inmatningsfel(lank({ kalla: "spotify" }))).toBeNull();
    expect(inmatningsfel(lank({ url: "https://bolagsverket.se/", kalla: "annat" }))).toBeNull();
    expect(inmatningsfel(lank({ kalla: null }))).toBeNull();
  });

  it("omslaget är en https-adress: http, mellanslag, javascript och för lång adress avvisas; en tom `bild` finns inte", () => {
    expect(byggPost(lank({ bild: "https://i.scdn.co/image/abc" })).bild).toBe("https://i.scdn.co/image/abc");
    expect(Object.hasOwn(byggPost(lank()), "bild")).toBe(false);
    expect(Object.hasOwn(byggPost(lank({ bild: null })), "bild")).toBe(false);
    for (const dalig of ["http://i.scdn.co/a.jpg", "javascript:alert(1)", "https://i.scdn.co/a b.jpg", "//i.scdn.co/a.jpg", "https://", `https://i.scdn.co/${"a".repeat(2000)}`, 5]) {
      expect(inmatningsfel(lank({ bild: dalig })), String(dalig).slice(0, 40)).toMatch(/Omslag/);
    }
    expect(BILDFORM.test("https://i.scdn.co/a.jpg")).toBe(true);
    expect(BILDFORM.test("http://i.scdn.co/a.jpg")).toBe(false);
  });

  it("`kalla` och `bild` hör bara till en länk: en anteckning, en fil och en lista med dem avvisas", () => {
    const anteckning = { groupId: "cps-ab", typ: "anteckning", rubrik: "P", text: "x", skapadAv: skapare, skapad: tid, andrad: tid };
    expect(inmatningsfel({ ...anteckning, kalla: "spotify" })).toMatch(/fältet kalla hör inte dit/);
    expect(inmatningsfel({ ...anteckning, bild: "https://i.scdn.co/a.jpg" })).toMatch(/fältet bild hör inte dit/);
    const fil = { groupId: "cps-ab", typ: "fil", rubrik: "F", fil: { sokvag: "grupper/cps-ab/bibliotek/p/a.pdf", namn: "a.pdf", mime: "application/pdf", byte: 10 }, skapadAv: skapare, skapad: tid, andrad: tid };
    expect(inmatningsfel({ ...fil, bild: "https://i.scdn.co/a.jpg" })).toMatch(/fältet bild hör inte dit/);
    expect(inmatningsfel({ groupId: "cps-ab", typ: "lista", rubrik: "L", poster: [], kalla: "spotify" })).toMatch(/fältet kalla hör inte dit/);
  });
});

describe("⛔ reglerna och modellen läser samma värdlista (regel 2)", () => {
  const regler = bibliotekregelfragment("bibliotek");

  it("varje källas uttryck står i regeln, byggt ur samma lista, och `annat` är negationen av alla fyra", () => {
    for (const k of LANKKALLOR) {
      const uttryck = lankkallaForm(k.kalla).source.replace(/^\^/, "").replace(/\$$/, "").replace(/\\\//g, "/");
      // Uttrycket förekommer i grenen för källan och en gång till i grenen för `annat`.
      expect(regler.split(`d.url.matches('${uttryck}')`).length - 1, k.kalla).toBe(2);
      expect(regler).toContain(`d.kalla == '${k.kalla}' ? d.url.matches('${uttryck}')`);
    }
    expect(regler).toContain("d.kalla == 'annat' ? !(");
  });

  it("regeln och modellen är olika kod men samma värdar: varje värd i listan ger sin källa i modellen OCH ett uttryck i regeln som träffar den", () => {
    for (const k of LANKKALLOR) {
      for (const v of k.vardar) {
        const adress = `https://${v}/track/abc?x=1`;
        const regex = new RegExp(`^${lankkallaForm(k.kalla).source.replace(/^\^/, "").replace(/\$$/, "")}$`);
        expect(regex.test(adress), `${k.kalla} ${v}`).toBe(true);
        expect(lankKalla(adress)).toBe(k.kalla);
      }
    }
  });

  it("fältnamnen `kalla`, `bild` och `poster` står i `hasOnly`-listan i regeln", () => {
    expect(regler).toMatch(/hasOnly\(\[[^\]]*"kalla"[^\]]*"bild"[^\]]*"poster"/);
    expect(regelfragment()).not.toContain("opsBibliotekKalla");
  });
});
