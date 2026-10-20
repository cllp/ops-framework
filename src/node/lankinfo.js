/**
 * Titel, artist och omslag för en musiklänk, ur oEmbed eller Open Graph (0.128.0, cllp/lifehub.app#378).
 *
 * ══ ⛔ VAD DEN HÄR FILEN ÄR OCH INTE ÄR ═══════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-20: "Länken blir smart: servern hämtar låtnamn och artist från Spotify, YouTube, Apple Music och SoundCloud, och posten får källans ikon och omslag." Den här funktionen är
 * serverns halva. Appen anropar den i en callable (`onLankInfo` i `OpsBibliotek` är den callablen) och skickar `hamta` in; ramverket vet ingenting om appens nätverk, dess `fetch`
 * eller dess hemligheter, och hämtar inget på egen hand. Inga fler källor än de fyra, och inget mer än titel, artist och omslag (ingen inbäddad spelare, ingen förhandsvisning).
 *
 * ══ ⛔ INGET SSRF: EN VITLISTA AV VÄRDAR, OCH BARA https ═════════════════════════════════════════════════════════════════
 *
 * En funktion som hämtar en adress en användare skrivit är en funktion som kan nå appens interna nät (metadataservern, en annan tjänst bakom brandväggen). Därför:
 *
 *   - Adressen ska vara https och ha en värd i `LANKKALLOR` (samma lista som modellen och Firestore-regeln läser, regel 2). Annars kastas ett fel INNAN något anropas.
 *   - Ändpunkterna (oEmbed) är fasta per källa och byggs inte av indata, och sidan som hämtas är adressen som just prövats. Det finns alltså inget andra led att pröva vid anropet:
 *     en andra prövning som aldrig kan slå till är en vakt som aldrig setts falla (regel 4). Det som vaktar ändpunkterna är provet som kör varje källa och kräver att varje anrop går
 *     till en värd i listan (`nod-lankinfo.test.js`): ändras en ändpunkt till en värd som inte finns i `LANKKALLOR` blir det rött.
 *   - Anropet får `redirect: "error"`. En omdirigering till en annan värd är exakt hur en vitlista kringgås, så den följs inte.
 *     ⛔ KRAV PÅ `hamta`: den ska respektera `redirect` och `signal` som `fetch` gör. En `hamta` som följer omdirigeringar öppnar vitlistan igen, och det kan den här filen inte bevisa.
 *   - Inga uppgifter i adressen (`https://x@y`), ingen port (`lankKalla` kräver att värden följs av `/`, `?`, `#` eller slut).
 *
 * ══ ⛔ TIDSGRÄNS OCH TAK ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Hela uppslaget har EN tidsgräns (`tidsgransMs`, förval 5 s), också mot en `hamta` som aldrig svarar och aldrig läser `signal`: anropet vinner över en tidsgräns med `Promise.race`,
 * inte bara med `AbortController`. Varje svar läses högst `maxByte` byte (förval 256 KiB) och resten kastas: en server som svarar med en gigabyte fyller inte appens minne. För en HTML-sida
 * räcker början (taggarna ligger i `<head>`); ett JSON-svar som klipps går inte att läsa och är ett fel.
 *
 * ⛔ VAD SOM LÄSES UR VAD (och vad som INTE är mätt: nätet var stängt för tjänsterna när det här skrevs, så formerna är skrivna efter deras dokumentation och provade mot fixturer):
 *
 *   Spotify      oEmbed (`open.spotify.com/oembed?url=`): `title`, `thumbnail_url`. Artisten ur sidans `og:description` ("Artist · Låt · 2020": första delen).
 *   YouTube      oEmbed (`www.youtube.com/oembed?format=json&url=`): `title`, `author_name` (utan ändelsen " - Topic"), `thumbnail_url`.
 *   SoundCloud   oEmbed (`soundcloud.com/oembed?format=json&url=`): `title` ("Låt by Artist": ändelsen tas bort), `author_name`, `thumbnail_url`. Reserv: Open Graph.
 *   Apple Music  Open Graph (`og:title` "Låt by Artist" eller "Låt - Single by Artist", `og:image`). Apple har ingen publik oEmbed.
 *
 * Svaret är `{ titel?, artist?, kalla, bild? }`. Saknas både titel och artist kastas ett fel med skälet: ett uppslag som lyckades utan att hitta något är inte ett svar (regel 5).
 * `bild` är en https-adress (`BILDFORM`) eller utelämnad. Den hämtas inte här: den ligger på källans bildserver och hämtas av besökarens webbläsare.
 */

import { BILDFORM, MAX_BIBLIOTEKURL } from "../lib/bibliotek.js";
import { LANKKALLOR, lankKalla, lankKallnamn } from "../lib/lankkalla.js";

/** Längsta titel och artist som skickas tillbaka, i tecken. Rubriken i Biblioteket är högst 200 (`MAX_BIBLIOTEKRUBRIK`) och klipps där. */
const MAX_FALT = 200;

/** Värdarna något får hämtas från: unionen av källornas värdar. */
const TILLATNA_VARDAR = new Set(LANKKALLOR.flatMap((k) => k.vardar));

/**
 * Är adressen en https-adress hos en tillåten värd? Prövas före varje anrop.
 * @param {string} adress
 * @returns {boolean}
 */
function arTillaten(adress) {
  try {
    const u = new URL(adress);
    return u.protocol === "https:" && u.username === "" && u.password === "" && u.port === "" && TILLATNA_VARDAR.has(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Avkodar HTML-entiteterna som förekommer i en meta-tags innehåll.
 * @param {string} s
 */
function avkoda(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Math.min(parseInt(d, 10), 0x10ffff)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * En text som titel eller artist: strängen utan styrtecken, blanksteg i rad till ett, trimmad och klippt. `undefined` när inget finns kvar.
 * @param {unknown} v
 * @returns {string | undefined}
 */
function rensa(v) {
  if (typeof v !== "string") return undefined;
  // eslint-disable-next-line no-control-regex
  const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_FALT).trim();
  return t === "" ? undefined : t;
}

/**
 * Omslaget om det är en https-adress på rätt form, annars `undefined`.
 * @param {unknown} v
 * @returns {string | undefined}
 */
function rensaBild(v) {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t !== "" && t.length <= MAX_BIBLIOTEKURL && BILDFORM.test(t) ? t : undefined;
}

/**
 * Meta-taggarna i en HTML-sida: egenskapens (eller namnets) gemena namn mot innehållet. Första förekomsten vinner.
 * @param {string} html
 * @returns {Map<string, string>}
 */
export function metaTaggar(html) {
  /** @type {Map<string, string>} */
  const ut = new Map();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tagg = m[0];
    /** @param {string} namn */
    const attr = (namn) => {
      const r = new RegExp(`\\b${namn}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tagg);
      return r ? (r[1] ?? r[2] ?? null) : null;
    };
    const nyckel = attr("property") ?? attr("name");
    const innehall = attr("content");
    if (nyckel && innehall !== null && !ut.has(nyckel.toLowerCase())) ut.set(nyckel.toLowerCase(), avkoda(innehall));
  }
  return ut;
}

/**
 * Läser högst `maxByte` byte ur ett svar som text. Strömmar när svaret har en ström (och slutar läsa vid taket), annars `text()`.
 *
 * @param {any} svar
 * @param {number} maxByte
 * @returns {Promise<string>}
 */
async function lasBegransat(svar, maxByte) {
  const kropp = svar?.body;
  if (kropp && typeof kropp.getReader === "function") {
    const laser = kropp.getReader();
    const avkodare = new TextDecoder("utf-8");
    let totalt = 0;
    let text = "";
    try {
      for (;;) {
        const { done, value } = await laser.read();
        if (done) break;
        const rest = maxByte - totalt;
        const bit = value.byteLength > rest ? value.subarray(0, rest) : value;
        text += avkodare.decode(bit, { stream: true });
        totalt += bit.byteLength;
        if (totalt >= maxByte) break;
      }
      text += avkodare.decode();
    } finally {
      // Slutar läsa: resten av svaret kastas, och anslutningen släpps.
      try {
        await laser.cancel();
      } catch {
        /* redan stängd */
      }
    }
    return text;
  }
  const hel = await svar.text();
  return typeof hel === "string" ? hel.slice(0, maxByte) : "";
}

/**
 * @typedef {(adress: string, init: { signal: AbortSignal, redirect: "error", headers: Record<string, string> }) => Promise<{ ok: boolean, status: number, body?: any, text?: () => Promise<string> }>} Hamta
 */

/**
 * Titel, artist och omslag för en musiklänk. Kastar ett fel med skälet (på svenska, för att visas för personen) när adressen inte är en av de fyra källorna, när källan inte svarar
 * inom tidsgränsen eller med ett fel, eller när ingen titel eller artist hittas.
 *
 * @param {Hamta} hamta `fetch`, eller något med samma form. Ska respektera `signal` och `redirect: "error"`.
 * @param {string} url Adressen personen klistrade in.
 * @param {{ tidsgransMs?: number, maxByte?: number }} [val] `tidsgransMs` för hela uppslaget (förval 5000), `maxByte` per svar (förval 262144).
 * @returns {Promise<{ titel?: string, artist?: string, kalla: "spotify" | "youtube" | "applemusic" | "soundcloud", bild?: string }>}
 */
export async function lankInfoUrOembed(hamta, url, val = {}) {
  if (typeof hamta !== "function") throw new Error("lankInfoUrOembed: hamta krävs, en funktion som fetch. Ramverket hämtar inget på egen hand.");
  const tidsgransMs = val.tidsgransMs ?? 5000;
  const maxByte = val.maxByte ?? 256 * 1024;
  if (!Number.isFinite(tidsgransMs) || tidsgransMs < 1) throw new Error(`lankInfoUrOembed: tidsgransMs är ${String(val.tidsgransMs)}. Ett heltal över noll krävs.`);
  if (!Number.isInteger(maxByte) || maxByte < 1) throw new Error(`lankInfoUrOembed: maxByte är ${String(val.maxByte)}. Ett heltal över noll krävs.`);

  let adress;
  try {
    adress = new URL(String(url));
  } catch {
    throw new Error("Adressen går inte att läsa.");
  }
  if (adress.protocol !== "https:") throw new Error("Adressen ska börja med https. Titeln hämtas inte från en okrypterad adress.");
  const href = adress.href;
  const kalla = lankKalla(href);
  if (kalla === "annat" || !arTillaten(href)) {
    throw new Error("Titeln hämtas bara för länkar till Spotify, YouTube, Apple Music och SoundCloud.");
  }
  const namn = /** @type {string} */ (lankKallnamn(kalla));

  const styr = new AbortController();
  const tidsFel = new Error(`${namn} svarade inte inom ${Math.max(1, Math.round(tidsgransMs / 1000))} sekunder.`);
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  const tidsgrans = new Promise((_, avvisa) => {
    timer = setTimeout(() => {
      styr.abort();
      avvisa(tidsFel);
    }, tidsgransMs);
  });
  // Ett löfte som aldrig vinner racet ska inte ge ett ohanterat avvisande när tiden går ut efter att vi är klara.
  tidsgrans.catch(() => {});

  /**
   * Hämtar en adress som text, eller kastar.
   * @param {string} mal
   * @param {string} accept
   */
  async function hamtaText(mal, accept) {
    // Tiden är ute: inget nytt anrop startas.
    if (styr.signal.aborted) throw tidsFel;
    const jobb = (async () => {
      const svar = await hamta(mal, { signal: styr.signal, redirect: "error", headers: { accept, "user-agent": "ops-framework-lankinfo" } });
      if (!svar || svar.ok !== true) throw new Error(`${namn} svarade ${svar && typeof svar.status === "number" ? svar.status : "inte"}.`);
      return lasBegransat(svar, maxByte);
    })();
    // Vinner tidsgränsen blir `jobb` kvar och kan avvisas senare: det avvisandet är redan hanterat här och ska inte bli ett ohanterat fel.
    jobb.catch(() => {});
    return Promise.race([jobb, tidsgrans]);
  }

  /**
   * oEmbed: JSON med `title`, `author_name` och `thumbnail_url`.
   * @param {string} andpunkt
   */
  async function oembed(andpunkt) {
    const text = await hamtaText(andpunkt, "application/json");
    /** @type {any} */
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`${namn} svarade med något som inte gick att läsa.`);
    }
    if (!json || typeof json !== "object") throw new Error(`${namn} svarade med något som inte gick att läsa.`);
    return { titel: rensa(json.title), artist: rensa(json.author_name), bild: rensaBild(json.thumbnail_url) };
  }

  /** Open Graph ur sidan själv. */
  async function og() {
    const text = await hamtaText(href, "text/html");
    const m = metaTaggar(text);
    return { titel: rensa(m.get("og:title")), beskrivning: rensa(m.get("og:description")), bild: rensaBild(m.get("og:image")) };
  }

  /** @type {{ titel?: string, artist?: string, bild?: string }} */
  let info = {};
  /** @type {string[]} */
  const fel = [];
  /** @param {() => Promise<void>} steg */
  const forsok = async (steg) => {
    try {
      await steg();
    } catch (e) {
      fel.push(e instanceof Error && e.message ? e.message : String(e));
    }
  };

  try {
    const kodad = encodeURIComponent(href);
    if (kalla === "spotify") {
      await forsok(async () => {
        info = await oembed(`https://open.spotify.com/oembed?url=${kodad}`);
      });
      // Artisten står i sidans beskrivning: "Artist · Låt · 2020". Första delen. Sidan är en andra begäran, och en som faller tar inte med sig titeln.
      await forsok(async () => {
        const s = await og();
        const delar = (s.beskrivning ?? "").split(" · ").map((d) => d.trim()).filter((d) => d !== "");
        const artist = delar.length >= 2 ? rensa(delar[0]) : undefined;
        info = { titel: info.titel ?? s.titel, artist: info.artist ?? artist, bild: info.bild ?? s.bild };
      });
    } else if (kalla === "youtube") {
      // music.youtube.com och m.youtube.com har ingen egen oEmbed: adressen frågas som www.youtube.com. youtu.be frågas som den är.
      const fraga = new URL(href);
      if (fraga.hostname !== "youtu.be") fraga.hostname = "www.youtube.com";
      await forsok(async () => {
        const r = await oembed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(fraga.href)}`);
        // Auto-genererade musikkanaler heter "Artist - Topic".
        info = { ...r, artist: r.artist?.replace(/\s*-\s*Topic$/i, "") };
      });
    } else if (kalla === "soundcloud") {
      await forsok(async () => {
        const r = await oembed(`https://soundcloud.com/oembed?format=json&url=${kodad}`);
        // SoundCloud skriver titeln som "Låt by Artist".
        const titel = r.artist && r.titel ? r.titel.replace(new RegExp(`\\s+by\\s+${r.artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "") : r.titel;
        info = { ...r, titel: rensa(titel) };
      });
      if (!info.titel) {
        await forsok(async () => {
          const s = await og();
          info = { titel: s.titel, artist: info.artist, bild: info.bild ?? s.bild };
        });
      }
    } else {
      // Apple Music: Open Graph. "Låt by Artist" eller "Låt - Single by Artist", ibland med "on Apple Music" sist.
      await forsok(async () => {
        const s = await og();
        const ren = (s.titel ?? "").replace(/\s+(?:on|\|)\s+Apple Music$/i, "").trim();
        const i = ren.lastIndexOf(" by ");
        const titel = i > 0 ? ren.slice(0, i).replace(/\s+-\s+(?:Single|EP)$/i, "").trim() : ren.replace(/\s+-\s+(?:Single|EP)$/i, "").trim();
        info = { titel: rensa(titel), artist: i > 0 ? rensa(ren.slice(i + 4)) : undefined, bild: s.bild };
      });
    }
  } finally {
    clearTimeout(timer);
  }

  if (!info.titel && !info.artist) {
    const skal = fel.length > 0 ? ` ${fel[0]}` : "";
    throw new Error(`Hittade ingen titel eller artist hos ${namn}.${skal}`);
  }
  return { ...(info.titel ? { titel: info.titel } : {}), ...(info.artist ? { artist: info.artist } : {}), kalla, ...(info.bild ? { bild: info.bild } : {}) };
}
