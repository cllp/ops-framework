import { GRUPPIKONKATALOG } from "./gruppikonkatalog.generated.js";

/**
 * Sökningen i gruppikonerna (0.65.0, #265): namn, Lucides sökord och svenska synonymer.
 *
 * ⛔ SÖKORDEN AVGÖR, INTE FILNAMNET. CP 2026-10-06: "Music" ska ge not, hörlurar, högtalare, gitarr och skiva. De
 * engelska sökorden är Lucides egna (`tags.json`, genererade in i `gruppikonkatalog.generated.js`). De svenska
 * nedan översätter ett svenskt ord till de engelska sökord det betyder, så att "musik" och gruppen "Bandet" hittar
 * samma ikoner som "music". De är ramverkets enda handskrivna del av sökningen, och de pekar på sökord, aldrig på
 * en ikon: en ny ikon med rätt sökord hittas utan att listan ändras.
 */

/** Ord som räcker för en träff. Kortare ord ger brus ("ab", "i", "och"). */
const MIN_ORD = 3;

/** Svenskt ord (eller ordstam) till engelska sökord. ⛔ Stammar matchar böjningar: "band" träffar "bandet". */
export const SVENSKA_SYNONYMER = Object.freeze({
  musik: ["music", "audio", "sound"],
  band: ["music", "band", "guitar", "drum"],
  kör: ["music", "sing", "vocal"],
  sång: ["music", "sing", "vocal", "karaoke"],
  låt: ["music", "song"],
  konsert: ["concert", "music"],
  ljud: ["audio", "sound"],
  gitarr: ["guitar"],
  trumm: ["drum"],
  piano: ["piano"],
  orkester: ["music", "orchestra"],
  podd: ["podcast", "audio", "mic"],
  familj: ["family", "people", "home"],
  barn: ["child", "baby", "kid"],
  vänner: ["friends", "people", "party"],
  kompis: ["friends", "people"],
  fest: ["party", "celebration"],
  hem: ["home", "house"],
  hus: ["home", "house", "building"],
  jobb: ["work", "business", "office"],
  arbete: ["work", "business", "office"],
  bolag: ["business", "company", "office"],
  företag: ["business", "company", "office"],
  kontor: ["office", "business", "work"],
  ekonomi: ["finance", "money", "wallet"],
  pengar: ["money", "finance", "cash"],
  bank: ["bank", "money", "finance"],
  budget: ["money", "finance", "budget"],
  skola: ["school", "education", "learn"],
  studie: ["education", "learn", "study"],
  plugg: ["education", "learn", "study"],
  bok: ["book", "read", "library"],
  läs: ["book", "read"],
  forsk: ["science", "research", "lab"],
  mat: ["food", "cooking", "kitchen", "eat"],
  kök: ["kitchen", "cooking", "food"],
  kaffe: ["coffee", "drink"],
  vin: ["wine", "drink"],
  öl: ["beer", "drink"],
  resa: ["travel", "trip", "vacation"],
  semester: ["vacation", "travel", "holiday"],
  flyg: ["plane", "flight", "travel"],
  bil: ["car", "vehicle"],
  båt: ["boat", "ship", "sail"],
  segl: ["sail", "boat"],
  natur: ["nature", "tree", "plant"],
  skog: ["forest", "tree", "nature"],
  trädgård: ["garden", "plant", "flower"],
  odl: ["garden", "plant", "grow"],
  blomm: ["flower", "plant"],
  fjäll: ["mountain", "hiking"],
  vandr: ["hiking", "walk", "mountain"],
  idrott: ["sport", "sports", "fitness"],
  sport: ["sport", "sports"],
  träning: ["fitness", "gym", "workout"],
  gym: ["gym", "fitness", "workout"],
  fotboll: ["football", "soccer", "sport"],
  löp: ["running", "run", "fitness"],
  cykel: ["bike", "bicycle", "cycling"],
  fisk: ["fish", "fishing"],
  hälsa: ["health", "medical", "fitness"],
  vård: ["health", "medical", "hospital"],
  läkare: ["medical", "doctor", "health"],
  teknik: ["tech", "technology", "computer"],
  data: ["computer", "data", "code"],
  kod: ["code", "programming", "developer"],
  spel: ["game", "gaming", "play"],
  foto: ["photo", "camera", "photography"],
  film: ["film", "movie", "video", "cinema"],
  konst: ["art", "paint", "design"],
  måla: ["paint", "art", "brush"],
  design: ["design", "art"],
  teater: ["theater", "drama", "stage"],
  djur: ["animal", "pet"],
  hund: ["dog", "pet", "animal"],
  katt: ["cat", "pet", "animal"],
  häst: ["horse", "animal"],
  kyrka: ["church", "religion"],
  förening: ["community", "group", "people"],
  klubb: ["club", "community", "group"],
  grupp: ["group", "people", "team"],
  team: ["team", "group", "people"],
  styrelse: ["board", "business", "meeting"],
  projekt: ["project", "work", "plan"],
  bygg: ["construction", "build", "tools"],
  verktyg: ["tools", "tool", "repair"],
  butik: ["shop", "store", "shopping"],
  handel: ["shop", "store", "shopping", "trade"],
  post: ["mail", "post", "letter"],
  kalender: ["calendar", "date", "schedule"],
});

/**
 * ⛔ DE VANLIGA, VISADE INNAN NÅGOT SKRIVITS. Tjugo ikoner som täcker de vanligaste sorternas grupper. Namn, aldrig
 * index. Provet `gruppikonsok.test.js` kräver att varje namn finns i katalogen.
 */
export const VANLIGA_GRUPPIKONER = Object.freeze([
  "users",
  "house",
  "briefcase",
  "building-2",
  "music",
  "heart",
  "star",
  "book-open",
  "graduation-cap",
  "trophy",
  "dumbbell",
  "utensils",
  "plane",
  "trees",
  "palette",
  "camera",
  "laptop",
  "wallet",
  "baby",
  "party-popper",
]);

/** @param {string} s */
const normalisera = (s) => s.toLocaleLowerCase("sv").trim();

/** @param {string} text @returns {string[]} */
function ord(text) {
  return normalisera(text)
    .split(/[^a-z0-9åäöéü]+/i)
    .filter((o) => o.length > 0);
}

/**
 * Engelska sökord ett ord leder till: ordet självt plus de svenska synonymer vars stam ordet börjar med (eller tvärtom).
 * @param {string} o
 */
function expandera(o) {
  const ut = new Set([o]);
  for (const [sv, en] of Object.entries(SVENSKA_SYNONYMER)) {
    if (o.startsWith(sv) || (o.length >= MIN_ORD && sv.startsWith(o))) for (const e of en) ut.add(e);
  }
  return ut;
}

/**
 * Hur väl en ikon svarar på ETT sökord. 0 är ingen träff.
 * @param {{ namn: string, taggar: ReadonlyArray<string> }} ikon
 * @param {string} sok
 */
function poang(ikon, sok) {
  const namnDelar = ikon.namn.split("-");
  if (ikon.namn === sok || namnDelar[0] === sok) return 100;
  if (ikon.namn.startsWith(sok)) return 60;
  let basta = 0;
  for (const tagg of ikon.taggar) {
    const t = tagg.toLowerCase();
    if (t === sok) basta = Math.max(basta, 40);
    else if (t.split(/\s+/).includes(sok)) basta = Math.max(basta, 30);
    else if (sok.length >= 2 && t.startsWith(sok)) basta = Math.max(basta, 20);
  }
  return basta;
}

/**
 * Söker i katalogen. Varje ord i frågan måste ge en träff (OCH), och ordningen är summan av träffarnas vikt, med namnets
 * ordning som sista skiljare så att samma fråga alltid ger samma lista.
 *
 * @param {string} fraga
 * @param {ReadonlyArray<{ namn: string, taggar: ReadonlyArray<string> }>} [katalog]
 * @returns {string[]} Ikonnamn.
 */
export function sokGruppikoner(fraga, katalog = GRUPPIKONKATALOG) {
  const delar = ord(fraga);
  if (delar.length === 0) return [];
  /** @type {Array<{ namn: string, p: number }>} */
  const traffar = [];
  for (const ikon of katalog) {
    let summa = 0;
    let alla = true;
    for (const d of delar) {
      let b = 0;
      for (const s of expandera(d)) b = Math.max(b, poang(ikon, s) * (s === d ? 1 : 0.9));
      if (b === 0) {
        alla = false;
        break;
      }
      summa += b;
    }
    if (alla) traffar.push({ namn: ikon.namn, p: summa });
  }
  return traffar.sort((a, b) => b.p - a.p || a.namn.localeCompare(b.namn)).map((t) => t.namn);
}

/**
 * Förslag ur gruppens namn: ikoner som något ord i namnet leder till (ELLER mellan orden), starkast först. "Bandet"
 * ger musikikonerna. Ett ord kortare än tre tecken räknas inte.
 *
 * @param {string} gruppnamn
 * @param {ReadonlyArray<{ namn: string, taggar: ReadonlyArray<string> }>} [katalog]
 * @returns {string[]}
 */
export function forslagUrGruppnamn(gruppnamn, katalog = GRUPPIKONKATALOG) {
  const delar = ord(gruppnamn).filter((o) => o.length >= MIN_ORD);
  if (delar.length === 0) return [];
  /** @type {Map<string, number>} */
  const summa = new Map();
  for (const d of delar) {
    /*
     * ⛔ ETT NAMN ÄR BÖJT, EN SÖKNING ÄR DET INTE. "Bandet" ska träffa sökordet "band", så här räcker det att ordet
     * BÖRJAR med ett sökord (minst tre tecken). I sökfältet gäller det omvända, att sökordet börjar med det man skrivit.
     */
    const sokord = expandera(d);
    for (const ikon of katalog) {
      let b = 0;
      for (const s of sokord) b = Math.max(b, poang(ikon, s));
      for (const tagg of ikon.taggar) {
        const t = tagg.toLowerCase();
        if (t.length >= MIN_ORD && !t.includes(" ") && d.startsWith(t)) b = Math.max(b, 25);
      }
      if (b > 0) summa.set(ikon.namn, (summa.get(ikon.namn) ?? 0) + b);
    }
  }
  return [...summa.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);
}
