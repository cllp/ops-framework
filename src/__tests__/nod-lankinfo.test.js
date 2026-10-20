import { describe, expect, it, vi } from "vitest";
import { lankInfoUrOembed, metaTaggar } from "../node/lankinfo.js";
import * as nod from "../node/index.js";

/**
 * Titel, artist och omslag ur oEmbed och Open Graph (0.128.0, cllp/lifehub.app#378). Svaren här är fixturer skrivna efter tjänsternas dokumentation: nätet var stängt för dem när
 * det här skrevs, så formerna är INTE mätta mot de riktiga tjänsterna (se CHANGELOG 0.128.0).
 */

const SPOTIFY = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";
const YOUTUBE = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const SOUNDCLOUD = "https://soundcloud.com/forss/flickermood";
const APPLE = "https://music.apple.com/se/album/lose-yourself/1440903625?i=1440903636";

/** Ett svar som `fetch`: ok, status och en ström (eller bara text). */
function svar(text, { status = 200, strom = true } = {}) {
  const bytes = new TextEncoder().encode(text);
  if (!strom) return { ok: status >= 200 && status < 300, status, text: async () => text };
  let last = 0;
  const lasta = { count: 0 };
  return {
    ok: status >= 200 && status < 300,
    status,
    lasta,
    body: {
      getReader() {
        return {
          async read() {
            if (last >= bytes.length) return { done: true, value: undefined };
            const bit = bytes.slice(last, last + 1024);
            last += bit.length;
            lasta.count += bit.length;
            return { done: false, value: bit };
          },
          async cancel() {
            last = bytes.length;
          },
        };
      },
    },
  };
}

/** En `hamta` som svarar per adress och skriver upp varje anrop. */
function hamtaMed(tabell) {
  const anrop = [];
  const hamta = vi.fn(async (adress, init) => {
    anrop.push({ adress, init });
    const hit = Object.entries(tabell).find(([prefix]) => adress.startsWith(prefix));
    if (!hit) throw new Error(`ingen fixtur för ${adress}`);
    const v = hit[1];
    return typeof v === "function" ? v(adress, init) : v;
  });
  return { hamta, anrop };
}

const ogSida = (m) =>
  `<!doctype html><html><head><title>x</title>${Object.entries(m).map(([k, v]) => `<meta property="${k}" content="${v}">`).join("")}</head><body></body></html>`;

describe("lankInfoUrOembed: Spotify", () => {
  it("titel och omslag ur oEmbed, artisten ur sidans beskrivning", async () => {
    const { hamta, anrop } = hamtaMed({
      "https://open.spotify.com/oembed": svar(JSON.stringify({ title: "Lose Yourself", thumbnail_url: "https://image-cdn-ak.spotifycdn.com/image/abc" })),
      [SPOTIFY]: svar(ogSida({ "og:description": "Eminem · Lose Yourself · Song · 2002", "og:title": "Lose Yourself" })),
    });
    const r = await lankInfoUrOembed(hamta, SPOTIFY);
    expect(r).toEqual({ titel: "Lose Yourself", artist: "Eminem", kalla: "spotify", bild: "https://image-cdn-ak.spotifycdn.com/image/abc" });
    expect(anrop[0].adress).toBe(`https://open.spotify.com/oembed?url=${encodeURIComponent(SPOTIFY)}`);
  });

  it("faller sidan men inte oEmbed får posten titeln utan artist, och faller oEmbed men inte sidan används sidans titel", async () => {
    const utanSida = hamtaMed({
      "https://open.spotify.com/oembed": svar(JSON.stringify({ title: "Lose Yourself" })),
      [SPOTIFY]: svar("", { status: 500 }),
    });
    expect(await lankInfoUrOembed(utanSida.hamta, SPOTIFY)).toEqual({ titel: "Lose Yourself", kalla: "spotify" });
    const utanOembed = hamtaMed({
      "https://open.spotify.com/oembed": svar("", { status: 404 }),
      [SPOTIFY]: svar(ogSida({ "og:title": "Lose Yourself", "og:description": "Eminem · Lose Yourself · 2002", "og:image": "https://i.scdn.co/image/xyz" })),
    });
    expect(await lankInfoUrOembed(utanOembed.hamta, SPOTIFY)).toEqual({ titel: "Lose Yourself", artist: "Eminem", kalla: "spotify", bild: "https://i.scdn.co/image/xyz" });
  });
});

describe("lankInfoUrOembed: YouTube, SoundCloud och Apple Music", () => {
  it("YouTube: title och author_name, och ändelsen ' - Topic' på en auto-genererad musikkanal tas bort", async () => {
    const { hamta, anrop } = hamtaMed({
      "https://www.youtube.com/oembed": svar(JSON.stringify({ title: "Lose Yourself", author_name: "Eminem - Topic", thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg" })),
    });
    const r = await lankInfoUrOembed(hamta, YOUTUBE);
    expect(r).toEqual({ titel: "Lose Yourself", artist: "Eminem", kalla: "youtube", bild: "https://i.ytimg.com/vi/x/hqdefault.jpg" });
    expect(anrop[0].adress).toBe(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(YOUTUBE)}`);
  });

  it("YouTube Music och m.youtube.com frågas som www.youtube.com, youtu.be som den är", async () => {
    const { hamta, anrop } = hamtaMed({ "https://www.youtube.com/oembed": () => svar(JSON.stringify({ title: "T", author_name: "A" })) });
    await lankInfoUrOembed(hamta, "https://music.youtube.com/watch?v=abc");
    await lankInfoUrOembed(hamta, "https://youtu.be/abc");
    expect(decodeURIComponent(anrop[0].adress.split("url=")[1])).toBe("https://www.youtube.com/watch?v=abc");
    expect(decodeURIComponent(anrop[1].adress.split("url=")[1])).toBe("https://youtu.be/abc");
  });

  it("SoundCloud: 'Låt by Artist' blir titeln 'Låt', och artisten är author_name", async () => {
    const { hamta } = hamtaMed({
      "https://soundcloud.com/oembed": svar(JSON.stringify({ title: "Flickermood by Forss", author_name: "Forss", thumbnail_url: "https://i1.sndcdn.com/artworks-x.jpg" })),
    });
    expect(await lankInfoUrOembed(hamta, SOUNDCLOUD)).toEqual({ titel: "Flickermood", artist: "Forss", kalla: "soundcloud", bild: "https://i1.sndcdn.com/artworks-x.jpg" });
  });

  it("SoundCloud: faller oEmbed används Open Graph", async () => {
    const { hamta } = hamtaMed({
      "https://soundcloud.com/oembed": svar("", { status: 403 }),
      [SOUNDCLOUD]: svar(ogSida({ "og:title": "Flickermood", "og:image": "https://i1.sndcdn.com/a.jpg" })),
    });
    expect(await lankInfoUrOembed(hamta, SOUNDCLOUD)).toEqual({ titel: "Flickermood", kalla: "soundcloud", bild: "https://i1.sndcdn.com/a.jpg" });
  });

  it("Apple Music: Open Graph, 'Låt by Artist' delas, och '- Single' och 'on Apple Music' tas bort", async () => {
    const { hamta } = hamtaMed({
      [APPLE]: svar(ogSida({ "og:title": "Lose Yourself - Single by Eminem on Apple Music", "og:image": "https://is1-ssl.mzstatic.com/image/thumb/a/1200x630wp-60.jpg" })),
    });
    expect(await lankInfoUrOembed(hamta, APPLE)).toEqual({ titel: "Lose Yourself", artist: "Eminem", kalla: "applemusic", bild: "https://is1-ssl.mzstatic.com/image/thumb/a/1200x630wp-60.jpg" });
  });

  it("HTML-entiteter i meta-taggar avkodas, och attributen får stå i vilken ordning och med vilka citattecken som helst", () => {
    const m = metaTaggar(`<meta content="Rock &amp; Roll &#8211; live &quot;x&quot;" property='og:title'><meta name="og:image" content='https://x.se/a.jpg'><meta property="og:title" content="Andra">`);
    expect(m.get("og:title")).toBe(`Rock & Roll ${String.fromCharCode(0x2013)} live "x"`);
    expect(m.get("og:image")).toBe("https://x.se/a.jpg");
  });
});

describe("⛔ inget SSRF: bara https och bara de fyra källornas värdar, och aldrig ett anrop innan prövningen", () => {
  const farliga = [
    "http://open.spotify.com/track/x",
    "http://169.254.169.254/latest/meta-data/",
    "https://169.254.169.254/latest/meta-data/",
    "https://localhost/oembed",
    "https://10.0.0.1/",
    "https://open.spotify.com.evil.se/track/x",
    "https://open.spotify.com@evil.se/track/x",
    "https://evil.se/?https://open.spotify.com/track/x",
    "https://open.spotify.com:8443/track/x",
    "https://user:pw@open.spotify.com/track/x",
    "ftp://open.spotify.com/x",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "inte en adress",
    "",
  ];
  for (const adress of farliga) {
    it(`avvisas utan något anrop: ${adress || "(tom)"}`, async () => {
      const { hamta } = hamtaMed({});
      await expect(lankInfoUrOembed(hamta, adress)).rejects.toThrow();
      expect(hamta).not.toHaveBeenCalled();
    });
  }

  it("felen säger varför, på svenska", async () => {
    const { hamta } = hamtaMed({});
    await expect(lankInfoUrOembed(hamta, "http://open.spotify.com/x")).rejects.toThrow(/https/);
    await expect(lankInfoUrOembed(hamta, "https://bolagsverket.se/")).rejects.toThrow(/Spotify, YouTube, Apple Music och SoundCloud/);
    await expect(lankInfoUrOembed(hamta, "inte en adress")).rejects.toThrow(/går inte att läsa/);
  });

  it("varje anrop som görs går till en tillåten värd, med redirect: error och en signal", async () => {
    const { hamta, anrop } = hamtaMed({
      "https://open.spotify.com/": () => svar(JSON.stringify({ title: "T" })),
      "https://www.youtube.com/": () => svar(JSON.stringify({ title: "T", author_name: "A" })),
      "https://soundcloud.com/": () => svar(JSON.stringify({ title: "T by A", author_name: "A" })),
      "https://music.apple.com/": () => svar(ogSida({ "og:title": "T by A" })),
    });
    for (const url of [SPOTIFY, YOUTUBE, SOUNDCLOUD, APPLE]) await lankInfoUrOembed(hamta, url);
    expect(anrop.length).toBeGreaterThanOrEqual(5);
    for (const { adress, init } of anrop) {
      const u = new URL(adress);
      expect(u.protocol).toBe("https:");
      expect(["open.spotify.com", "www.youtube.com", "soundcloud.com", "music.apple.com"]).toContain(u.hostname);
      expect(init.redirect).toBe("error");
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("hamta krävs, och dåliga gränser kastas", async () => {
    await expect(lankInfoUrOembed(/** @type {any} */ (undefined), SPOTIFY)).rejects.toThrow(/hamta krävs/);
    await expect(lankInfoUrOembed(async () => svar("{}"), SPOTIFY, { tidsgransMs: 0 })).rejects.toThrow(/tidsgransMs/);
    await expect(lankInfoUrOembed(async () => svar("{}"), SPOTIFY, { maxByte: 0 })).rejects.toThrow(/maxByte/);
  });
});

describe("⛔ tidsgräns och tak på svaret", () => {
  it("en hamta som aldrig svarar och aldrig läser signalen avbryts av tidsgränsen, med ett fel som säger vilken tjänst", async () => {
    const hamta = vi.fn(() => new Promise(() => {}));
    const start = Date.now();
    await expect(lankInfoUrOembed(/** @type {any} */ (hamta), SPOTIFY, { tidsgransMs: 60 })).rejects.toThrow(/Spotify svarade inte inom 1 sekunder/);
    expect(Date.now() - start).toBeLessThan(1500);
  });

  it("tiden är ute: inget nytt anrop startas, och signalen är avbruten", async () => {
    let signal;
    const hamta = vi.fn((_adress, init) => {
      signal = init.signal;
      return new Promise(() => {});
    });
    await expect(lankInfoUrOembed(/** @type {any} */ (hamta), SPOTIFY, { tidsgransMs: 40 })).rejects.toThrow();
    expect(signal.aborted).toBe(true);
    // Spotify gör två försök (oEmbed och sidan). Efter tidsgränsen får det andra inte ha startat ett anrop.
    expect(hamta).toHaveBeenCalledTimes(1);
  });

  it("⛔ ett svar läses högst maxByte byte och inte mer, hur stort det än är", async () => {
    const stor = "x".repeat(5_000_000);
    const s = svar(`<meta property="og:title" content="Sent i svaret">${stor}`);
    const { hamta } = hamtaMed({ [APPLE]: s });
    // Taket 2048 byte: öppnings-taggen ligger inom taket och läses, resten av de 5 MB läses inte.
    const r = await lankInfoUrOembed(hamta, APPLE, { maxByte: 2048 });
    expect(r.titel).toBe("Sent i svaret");
    expect(s.lasta.count).toBeLessThanOrEqual(2048 + 1024);
    expect(s.lasta.count).toBeLessThan(10_000);
  });

  it("ett JSON-svar som klipps av taket går inte att läsa och är ett fel, inte en gissning", async () => {
    const { hamta } = hamtaMed({ "https://www.youtube.com/oembed": svar(JSON.stringify({ title: "T".repeat(5000), author_name: "A" })) });
    await expect(lankInfoUrOembed(hamta, YOUTUBE, { maxByte: 1024 })).rejects.toThrow(/Hittade ingen titel eller artist hos YouTube.*inte gick att läsa/);
  });

  it("ett svar utan ström (bara text) klipps också", async () => {
    const { hamta } = hamtaMed({ [APPLE]: svar(`${ogSida({ "og:title": "Låt by Artist" })}${"x".repeat(100_000)}`, { strom: false }) });
    expect((await lankInfoUrOembed(hamta, APPLE, { maxByte: 4096 })).titel).toBe("Låt");
  });
});

describe("⛔ ett uppslag utan innehåll är ett fel (regel 5)", () => {
  it("varken titel eller artist: kastar med tjänsten och skälet", async () => {
    const { hamta } = hamtaMed({ "https://www.youtube.com/oembed": svar(JSON.stringify({ thumbnail_url: "https://i.ytimg.com/a.jpg" })) });
    await expect(lankInfoUrOembed(hamta, YOUTUBE)).rejects.toThrow(/Hittade ingen titel eller artist hos YouTube/);
  });

  it("tjänsten svarar fel: statuskoden står i felet", async () => {
    const { hamta } = hamtaMed({ "https://www.youtube.com/oembed": svar("", { status: 404 }) });
    await expect(lankInfoUrOembed(hamta, YOUTUBE)).rejects.toThrow(/YouTube svarade 404/);
  });

  it("anropet kastar: felet sväljs inte utan blir skälet", async () => {
    const hamta = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    await expect(lankInfoUrOembed(/** @type {any} */ (hamta), YOUTUBE)).rejects.toThrow(/ECONNRESET/);
  });

  it("omslag som inte är https läggs inte med; titeln och artisten städas från styrtecken och blanksteg", async () => {
    const { hamta } = hamtaMed({
      "https://www.youtube.com/oembed": svar(JSON.stringify({ title: "  Låt\u0000 \n med   mellanrum ", author_name: "Artist", thumbnail_url: "http://i.ytimg.com/a.jpg" })),
    });
    const r = await lankInfoUrOembed(hamta, YOUTUBE);
    expect(r.titel).toBe("Låt med mellanrum");
    expect(Object.hasOwn(r, "bild")).toBe(false);
    const lang = hamtaMed({ "https://www.youtube.com/oembed": svar(JSON.stringify({ title: "T".repeat(500), author_name: "A" })) });
    expect((await lankInfoUrOembed(lang.hamta, YOUTUBE)).titel).toHaveLength(200);
  });
});

describe("nodingången", () => {
  it("exporterar funktionen och de rena hjälparna", () => {
    expect(nod.lankInfoUrOembed).toBe(lankInfoUrOembed);
    expect(typeof nod.lankKalla).toBe("function");
    expect(typeof nod.lankRubrik).toBe("function");
    expect(nod.LANKKALLOR).toHaveLength(4);
  });
});
