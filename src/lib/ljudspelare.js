import { lasLjudbytes } from "../data/ljudbytes.js";
import { LJUD_STOLPAR } from "./bibliotek.js";

/**
 * Räkningen bakom `OpsLjudspelare`.
 *
 * ⛔ EN SPELARE, MÅNGA RADER (mätt i SessionStudio `packages/shared/audioPlayerHelpers.js`
 * och `deriveAudioRowState`, #3829). En rad som bara vet sin adress kan rita en
 * startknapp, men inte veta om det är just den som spelar. Utan det svaret
 * startar ett andra tryck om från noll, och två rader kan låta samtidigt.
 * Spärren här är samma fråga som inspelningens: en i taget, de andra pausas.
 *
 * Talen är sekunder, som `HTMLAudioElement`. SessionStudio räknar i millisekunder
 * för att dela kod med mobilens expo-av. Här finns ingen andra klocka att hålla
 * i takt, så en omräkning hade varit en andra sanning.
 */

/**
 * Stolpar i vågen. Talet ägs av posten (`LJUD_STOLPAR`): det som sparas och
 * det som ritas är samma lista.
 */
export const STOLPAR = LJUD_STOLPAR;

/** Hopp bakåt och framåt, samma tio sekunder som SessionStudios fullskärmsspelare. */
export const HOPP_SEKUNDER = 10;
/** Vad en piltangent på spolreglaget flyttar, i sekunder. Reglagets `step` är 1 (en tusendel), så pilarna sköts av spelaren. */
export const PILHOPP_SEKUNDER = 5;

/** Hastigheterna, i den ordning knappen växlar. 1 är varvets början. */
export const HASTIGHETER = Object.freeze([1, 1.25, 1.5, 2]);

/** Nyckeln i `localStorage` för den senast valda hastigheten (#375). Samma för alla spelare: hastigheten är personens, inte modulens. */
export const HASTIGHET_NYCKEL = "ops.spelare.hastighet";

/**
 * Den hastighet personen senast valde på den här enheten, eller 1 (#375).
 *
 * ⛔ EN BEKVÄMLIGHET, ALDRIG DATA. Ligger i `localStorage`, får försvinna (privat fönster, rensad webbplatsdata), och då är det 1×.
 * Ett värde som inte finns i `HASTIGHETER` räknas som 1, så knappens varv aldrig hamnar utanför listan.
 *
 * @returns {number}
 */
export function sparadHastighet() {
  try {
    const varde = Number(globalThis.localStorage?.getItem(HASTIGHET_NYCKEL));
    return HASTIGHETER.includes(varde) ? varde : 1;
  } catch {
    return 1;
  }
}

/**
 * Kom ihåg vald hastighet till nästa gång en spelare öppnas (#375). Tyst om lagringen saknas: att glömma är ofarligt.
 *
 * @param {number} hastighet
 */
export function sparaHastighet(hastighet) {
  if (!HASTIGHETER.includes(hastighet)) return;
  try {
    globalThis.localStorage?.setItem(HASTIGHET_NYCKEL, String(hastighet));
  } catch {
    /* privat läge: glöm */
  }
}

/**
 * En längd webbläsaren faktiskt vet. `Infinity` är det MediaRecorder lämnar
 * på iOS och i webm/mp4, och det är inte en längd.
 *
 * @param {unknown} sekunder
 * @returns {sekunder is number}
 */
export function langdArKand(sekunder) {
  return typeof sekunder === "number" && Number.isFinite(sekunder) && sekunder > 0;
}

/**
 * @param {number} sekunder
 * @returns {string}
 */
export function formateraTid(sekunder) {
  if (!langdArKand(sekunder)) return "0:00";
  const s = Math.floor(sekunder);
  const min = Math.floor(s / 60);
  const sek = s % 60;
  return `${min}:${String(sek).padStart(2, "0")}`;
}

/**
 * @param {number} hastighet
 * @returns {string}
 */
export function hastighetText(hastighet) {
  if (hastighet === 1.25) return "1,25×";
  if (hastighet === 1.5) return "1,5×";
  if (hastighet === 2) return "2×";
  return "1×";
}

/**
 * @param {number} hastighet
 * @returns {number}
 */
export function nastaHastighet(hastighet) {
  const i = HASTIGHETER.indexOf(hastighet);
  return HASTIGHETER[(i + 1) % HASTIGHETER.length];
}

/**
 * @param {number} mal
 * @param {number} langd 0 när längden inte är känd: då gäller bara att tiden inte är negativ.
 * @returns {number}
 */
export function sokTill(mal, langd) {
  const t = Number.isFinite(mal) ? mal : 0;
  const golv = Math.max(0, t);
  if (!Number.isFinite(langd) || langd <= 0) return golv;
  return Math.min(golv, langd);
}

/**
 * @param {number} tid
 * @param {number} langd
 * @param {number} delta
 * @returns {number}
 */
export function hoppa(tid, langd, delta) {
  return sokTill((Number.isFinite(tid) ? tid : 0) + delta, langd);
}

/**
 * @param {number} tid
 * @param {number} langd
 * @returns {number} 0 till 1
 */
export function andel(tid, langd) {
  if (!Number.isFinite(langd) || langd <= 0 || !Number.isFinite(tid)) return 0;
  return Math.min(1, Math.max(0, tid / langd));
}

/**
 * @param {number} kvot 0 till 1
 * @param {number} langd
 * @returns {number}
 */
export function tidUrAndel(kvot, langd) {
  const k = Number.isFinite(kvot) ? Math.min(1, Math.max(0, kvot)) : 0;
  return sokTill(k * (Number.isFinite(langd) ? langd : 0), langd);
}

/**
 * Toppar ur en kanal, normaliserade så den högsta stolpen är 1.
 * En tyst fil blir nollor: den ska inte se ut som en full våg.
 *
 * @param {ArrayLike<number>} kanal
 * @param {number} [antal]
 * @returns {number[]}
 */
export function stolparUrKanal(kanal, antal = STOLPAR) {
  const n = Math.floor(antal);
  if (!kanal || kanal.length === 0 || n < 1) return [];
  /** @type {number[]} */
  const ut = [];
  const steg = kanal.length / n;
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * steg);
    const slut = Math.min(kanal.length, Math.max(start + 1, Math.floor((i + 1) * steg)));
    let topp = 0;
    for (let j = start; j < slut; j++) {
      const v = Math.abs(kanal[j] || 0);
      if (v > topp) topp = v;
    }
    ut.push(topp);
  }
  const max = ut.reduce((m, v) => (v > m ? v : m), 0);
  if (max <= 0) return ut.map(() => 0);
  return ut.map((v) => v / max);
}

/**
 * Vågen innan topparna gått att läsa. Låg och jämn, så den inte ser ut som
 * en fras som spelats in. Raden byter till riktiga toppar så fort de finns.
 */
export function plattaStolpar(antal = STOLPAR) {
  return Array.from({ length: antal }, () => 0.12);
}

/**
 * @param {HTMLMediaElement} el
 * @returns {Promise<number>} Sekunder, eller 0 när längden fortfarande saknas.
 */
export function lasLangdMedSok(el) {
  if (langdArKand(el.duration)) return Promise.resolve(el.duration);
  return new Promise((resolve) => {
    let klar = false;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    const fardig = (/** @type {number} */ v) => {
      if (klar) return;
      klar = true;
      if (timer) clearTimeout(timer);
      el.removeEventListener("durationchange", vid);
      el.removeEventListener("timeupdate", vid);
      const kand = langdArKand(v) ? v : el.duration;
      resolve(langdArKand(kand) ? kand : 0);
    };
    const vid = () => {
      if (langdArKand(el.duration)) fardig(el.duration);
    };
    el.addEventListener("durationchange", vid);
    el.addEventListener("timeupdate", vid);
    timer = setTimeout(() => fardig(0), 2000);
    try {
      // ⛔ iOS och MediaRecorder lämnar duration = Infinity tills någon söker
      // långt förbi slutet. Då räknar webbläsaren ut längden.
      el.currentTime = 1e101;
    } catch {
      fardig(0);
    }
  });
}

/** @type {Map<string, number[]>} */
const stolpCache = new Map();

/**
 * @param {string} src
 * @returns {number[] | null}
 */
export function lasStolpar(src) {
  return stolpCache.get(src) ?? null;
}

/**
 * Längd och toppar ur avkodade sampel. AudioContext läser webm och mp4 från
 * MediaRecorder också när `<audio>.duration` är Infinity.
 *
 * @param {ArrayBuffer} data
 * @returns {Promise<{ durationMs: number, peaks: number[] } | null>}
 */
export async function metaUrBytes(data) {
  if (typeof AudioContext === "undefined") return null;
  if (!data || typeof data.slice !== "function") return null;
  const ctx = new AudioContext();
  try {
    const buffert = await ctx.decodeAudioData(data.slice(0));
    const sekunder = buffert.duration;
    const durationMs = langdArKand(sekunder) ? Math.round(sekunder * 1000) : 0;
    const peaks = stolparUrKanal(buffert.getChannelData(0), STOLPAR);
    if (peaks.length !== STOLPAR) return null;
    return { durationMs, peaks };
  } catch {
    return null;
  } finally {
    try {
      await ctx.close();
    } catch {
      /* stängningen är städning, inte ett besked till någon */
    }
  }
}

/** @type {Map<string, { durationMs: number, peaks: number[] }>} */
const metaCache = new Map();

/**
 * Läser längd och toppar ur en adress. Ett misslyckande (CORS, ett format
 * avkodaren inte kan) är inte ett uppspelningsfel.
 *
 * @param {string} src
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ durationMs: number, peaks: number[] } | null>}
 */
export async function metaForAdress(src, signal) {
  const finns = metaCache.get(src);
  if (finns) return finns;
  const data = await lasLjudbytes(src, signal);
  const meta = await metaUrBytes(data);
  if (meta) {
    stolpCache.set(src, meta.peaks);
    metaCache.set(src, meta);
  }
  return meta;
}

/**
 * Läser topparna ur filen. Ett misslyckande (CORS, ett format avkodaren inte kan)
 * är inte ett uppspelningsfel: `<audio>` spelar utan att vi får läsa samplen.
 *
 * @param {string} src
 * @param {AbortSignal} [signal]
 * @returns {Promise<number[] | null>}
 */
export async function stolparForAdress(src, signal) {
  const finns = stolpCache.get(src);
  if (finns) return finns;
  const meta = await metaForAdress(src, signal);
  return meta ? meta.peaks : null;
}

/**
 * @typedef {{ pausa: () => void }} Spelarhandtag
 */

/** @type {Set<Spelarhandtag>} */
const registrerade = new Set();

/**
 * @param {Spelarhandtag} handtag
 * @returns {() => void}
 */
export function registreraSpelare(handtag) {
  registrerade.add(handtag);
  return () => {
    registrerade.delete(handtag);
  };
}

/**
 * Pausa alla utom den som ska låta. Den som anropar spelar själv sedan.
 *
 * @param {Spelarhandtag} den
 */
export function baraEnSpelar(den) {
  for (const annan of registrerade) {
    if (annan !== den) annan.pausa();
  }
}

/**
 * @typedef {{ hoppa: (delta: number) => void, bytHastighet: () => void, laddaNed: () => void }} Ljudstyrning
 */

/** @type {Map<string, Ljudstyrning>} */
const styrningar = new Map();

/**
 * Listans ⋯-meny och detaljens spelare delar samma ljud. Id är postens id.
 *
 * @param {string} id
 * @param {Ljudstyrning} api
 * @returns {() => void}
 */
export function registreraStyrning(id, api) {
  styrningar.set(id, api);
  return () => {
    if (styrningar.get(id) === api) styrningar.delete(id);
  };
}

/**
 * @param {string} id
 * @returns {Ljudstyrning | null}
 */
export function ljudStyrning(id) {
  return styrningar.get(id) ?? null;
}

/**
 * Texten när `play()` avvisas, eller tom när avvisningen inte är ett fel (0.102.0, utbruten ur `OpsLjudspelare`).
 *
 * ⛔ `AbortError` ÄR INGET FEL. Webbläsaren avvisar ett väntande `play()` när källan byts, när någon pausar eller när spelaren
 * stängs. Skalets spelare skrev förut "Ljudet kunde inte spelas." på det spår som faktiskt spelade (granskningen av PR 366,
 * MÅSTE 1). En funktion för båda spelarna, så att de inte säger olika saker om samma fel.
 *
 * @param {unknown} e
 * @returns {string}
 */
export function startFelText(e) {
  const namn = e && typeof e === "object" && "name" in e ? String(/** @type {any} */ (e).name) : "";
  if (namn === "AbortError") return "";
  if (namn === "NotAllowedError") return "Webbläsaren tillät inte uppspelningen. Tryck på Spela igen.";
  return "Ljudet gick inte att spela.";
}

/** Tömmer spärren och våg-cachen. Proven anropar den, appen gör det inte. */
export function nollstallSpelare() {
  registrerade.clear();
  stolpCache.clear();
  metaCache.clear();
  styrningar.clear();
}

/** Hur många byte varje stapel läser ur en stor WAV. 48 staplar gånger 64 KB är 3 MB, oavsett filens storlek. */
export const WAV_FONSTER = 64 * 1024;

/**
 * Längd och toppar ur en WAV utan att läsa hela filen (CP 2026-10-18, WAV upp till 250 MB).
 *
 * ⛔ BITAR, INTE HELA FILEN. `metaUrBytes` avkodar allt med `decodeAudioData`, och en WAV på 250 MB blir då över en gigabyte
 * flyttal i minnet, vilket en telefon inte klarar. Här läses huvudet, och för varje stapel ett fönster på `WAV_FONSTER` byte
 * där stapeln börjar. Längden räknas ur datablockets storlek. Topparna är ett stickprov per stapel, inte varje sampel, och
 * det räcker för en våg på 48 staplar.
 *
 * Klarar PCM med 8, 16, 24 och 32 bitar och flyttal med 32 bitar (format 1, 3 och 0xFFFE). Annat ger `null`, och då sparas
 * filen utan våg.
 *
 * @param {{ size: number, slice: (a: number, b: number) => { arrayBuffer: () => Promise<ArrayBuffer> } }} blob
 * @param {number} [antal]
 * @returns {Promise<{ durationMs: number, peaks: number[] } | null>}
 */
export async function wavMetaUrBlob(blob, antal = STOLPAR) {
  if (!blob || typeof blob.slice !== "function" || !Number.isFinite(blob.size) || blob.size < 44) return null;
  const las = async (/** @type {number} */ a, /** @type {number} */ b) => new DataView(await blob.slice(a, Math.min(b, blob.size)).arrayBuffer());
  const huvud = await las(0, 12);
  const tagg = (/** @type {DataView} */ v, /** @type {number} */ o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tagg(huvud, 0) !== "RIFF" || tagg(huvud, 8) !== "WAVE") return null;
  let pos = 12;
  /** @type {{ format: number, kanaler: number, takt: number, block: number, bitar: number } | null} */
  let fmt = null;
  let dataStart = -1;
  let dataStorlek = 0;
  while (pos + 8 <= blob.size) {
    const c = await las(pos, pos + 8);
    const id = tagg(c, 0);
    const storlek = c.getUint32(4, true);
    if (id === "fmt ") {
      const f = await las(pos + 8, pos + 8 + Math.min(storlek, 40));
      let format = f.getUint16(0, true);
      if (format === 0xfffe && storlek >= 26) format = f.getUint16(24, true);
      fmt = { format, kanaler: f.getUint16(2, true), takt: f.getUint32(4, true), block: f.getUint16(12, true), bitar: f.getUint16(14, true) };
    } else if (id === "data") {
      dataStart = pos + 8;
      dataStorlek = Math.min(storlek, blob.size - dataStart);
      break;
    }
    pos += 8 + storlek + (storlek % 2);
  }
  if (!fmt || dataStart < 0 || fmt.block < 1 || fmt.takt < 1 || fmt.kanaler < 1) return null;
  const { format, bitar, block } = fmt;
  const bredd = bitar / 8;
  const kanlig = (format === 1 && [1, 2, 3, 4].includes(bredd)) || (format === 3 && bredd === 4);
  if (!kanlig) return null;
  /** Kanal 0 i ramen som börjar på `o`, som ett tal mellan 0 och 1. */
  const sampel = (/** @type {DataView} */ v, /** @type {number} */ o) => {
    if (format === 3) return Math.abs(v.getFloat32(o, true));
    if (bredd === 1) return Math.abs(v.getUint8(o) - 128) / 128;
    if (bredd === 2) return Math.abs(v.getInt16(o, true)) / 32768;
    if (bredd === 3) {
      const x = v.getUint8(o) | (v.getUint8(o + 1) << 8) | (v.getInt8(o + 2) << 16);
      return Math.abs(x) / 8388608;
    }
    return Math.abs(v.getInt32(o, true)) / 2147483648;
  };
  const ramar = Math.floor(dataStorlek / block);
  const durationMs = Math.round((ramar / fmt.takt) * 1000);
  const n = Math.max(1, Math.floor(antal));
  /** @type {number[]} */
  const ut = [];
  for (let i = 0; i < n; i++) {
    const startRam = Math.floor((i * ramar) / n);
    const slutRam = Math.max(startRam + 1, Math.floor(((i + 1) * ramar) / n));
    const fonsterRamar = Math.max(1, Math.min(slutRam - startRam, Math.floor(WAV_FONSTER / block)));
    const a = dataStart + startRam * block;
    const v = await las(a, a + fonsterRamar * block);
    let topp = 0;
    for (let o = 0; o + bredd <= v.byteLength; o += block) {
      const x = sampel(v, o);
      if (x > topp) topp = x;
    }
    ut.push(topp);
  }
  const max = ut.reduce((m, x) => (x > m ? x : m), 0);
  return { durationMs, peaks: max > 0 ? ut.map((x) => x / max) : ut.map(() => 0) };
}
