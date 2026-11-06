import { POSTIDFORM } from "./bibliotek.js";

/**
 * Kommentarer på en bibliotekspost, genom gruppens chatt (0.191.0, cllp/lifehub.app#663).
 *
 * ══ ⛔ EN KOMMENTAR ÄR ETT CHATTMEDDELANDE, OCH TRÅDEN ÄR CHATTENS TRÅD ═══════════════════════════════════════════════════════
 *
 * CP 2026-11-05: "Vi behöver ha kommentarer på artefakter, även för gäster." och samma kväll "Skall vi vinkla oss med chatten istället?". Svaret blev chatten: ingen ny samling,
 * inget nytt fält på meddelandet och ingen ny regel. En egen kommentarsmodell hade varit en andra chatt, med samling, regler, aviseringar och en egen serverväg för gäster (regel 2 och 13).
 *
 * Kommentarstråden för en post är ett rotmeddelande i gruppchatten vars id FÖLJER AV POSTEN, `post~<postens id>` (`kommentarRotId`), och svaren ligger i rotens tråd,
 * `<samtal>/<sid>/<tradar>/post~<id>/<meddelanden>`. Posten behöver alltså inget fält som pekar på tråden, och tråden på posten är en läsning av ett dokument och en
 * undersamling: ingen fråga och inget index.
 *
 * ⛔ VARFÖR INTE ETT FÄLT PÅ MEDDELANDET (mätt i #663): meddelandets och trådens regler har `hasOnly` på fälten. Ett fält som pekar på posten hade krävt en ny regelnyckel, och
 * att låta regeln pröva att posten finns hade krävt ett `get()` till i ett fragment som redan ligger nära taket. Ett id som går att härleda kräver ingenting av det.
 *
 * ⛔ UNIKHETEN ÄR DOKUMENT-ID:T. Den första kommentaren SKAPAR roten på id:t; finns roten redan blir kommentaren ett svar i tråden. Två som skriver samtidigt: den som får
 * "finns redan" skriver som svar (`samtalskalla.skickaPaRot`). Ingen läsning före skrivningen avgör något.
 *
 * ⛔ KORTET LAGRAS INTE. Rotens text är kommentaren och postens länk (`bibliotekslank`). Kortet i chatten slås upp ur länken när det ritas (`postkort`, `bibliotekPostkort`),
 * så en post som byter namn visar det nya namnet, och en borttagen post visar bara texten.
 */

/** Prefixet på en kommentarsrot. `~` förekommer aldrig i ett postid (`POSTIDFORM`), så en rot kan inte förväxlas med ett vanligt meddelandes id. */
export const KOMMENTARROT_PREFIX = "post~";

/**
 * Kommentarsrotens id för en post.
 * @param {string} postId
 * @returns {string}
 */
export function kommentarRotId(postId) {
  if (typeof postId !== "string" || !POSTIDFORM.test(postId)) throw new Error(`kommentarRotId: "${String(postId)}" är inget postid.`);
  return `${KOMMENTARROT_PREFIX}${postId}`;
}

/**
 * Postens id ur en kommentarsrots id, eller `null` när id:t inte är en kommentarsrot.
 * @param {unknown} id
 * @returns {string | null}
 */
export function postIdUrRot(id) {
  if (typeof id !== "string" || !id.startsWith(KOMMENTARROT_PREFIX)) return null;
  const postId = id.slice(KOMMENTARROT_PREFIX.length);
  return POSTIDFORM.test(postId) ? postId : null;
}

/**
 * Basen prövad: en absolut https- eller http-adress utan fråga och fragment, utan avslutande snedstreck. Kastar annars.
 * @param {unknown} bas
 * @param {string} vem
 */
function kravBas(bas, vem) {
  /** @type {URL} */
  let u;
  try {
    u = new URL(String(bas));
  } catch {
    throw new Error(`${vem}: bas "${String(bas)}" är ingen adress. Den är appens adress till biblioteket, till exempel https://app.exempel.se/bibliotek.`);
  }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || u.search || u.hash || String(bas).endsWith("/")) {
    throw new Error(`${vem}: bas "${String(bas)}" ska vara en http- eller https-adress utan fråga, fragment och avslutande snedstreck.`);
  }
  return `${u.origin}${u.pathname}`;
}

/**
 * Länken till en post i appens bibliotek: `<bas>?plats=<plats>&post=<id>`. Samma form som appens sökträff och agentens kvitto, så att en länk i chatten öppnar posten oavsett
 * vem som skrev den. ⛔ RAMVERKET KÄNNER INTE APPENS ADRESS: `bas` skickas in.
 *
 * @param {string} bas Appens adress till biblioteket, till exempel `https://my.life-hub.app/bibliotek`.
 * @param {{ plats: string, postId: string }} d `plats` är postens `groupId`.
 * @returns {string}
 */
export function bibliotekslank(bas, { plats, postId }) {
  const b = kravBas(bas, "bibliotekslank");
  if (typeof plats !== "string" || plats === "") throw new Error("bibliotekslank: plats krävs, postens groupId.");
  if (typeof postId !== "string" || !POSTIDFORM.test(postId)) throw new Error(`bibliotekslank: "${String(postId)}" är inget postid.`);
  return `${b}?plats=${encodeURIComponent(plats)}&post=${encodeURIComponent(postId)}`;
}

/**
 * Platsen och posten ur en länk som `bibliotekslank` gav, eller `null`. ⛔ BARA APPENS EGEN FORM: samma ursprung och sökväg som `bas`, och exakt parametrarna `plats` och
 * `post`. En adress till en annan sida med samma parametrar är ingen post.
 *
 * @param {string} bas
 * @param {unknown} url
 * @returns {{ plats: string, postId: string } | null}
 */
export function lasBibliotekslank(bas, url) {
  const b = kravBas(bas, "lasBibliotekslank");
  if (typeof url !== "string") return null;
  /** @type {URL} */
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (`${u.origin}${u.pathname}` !== b || u.hash) return null;
  const nycklar = [...u.searchParams.keys()];
  if (nycklar.length !== 2 || !nycklar.includes("plats") || !nycklar.includes("post")) return null;
  const plats = u.searchParams.get("plats") ?? "";
  const postId = u.searchParams.get("post") ?? "";
  if (plats === "" || !POSTIDFORM.test(postId)) return null;
  return { plats, postId };
}

/**
 * Adresserna i en text, i ordning och utan dubbletter: allt som börjar med `http://` eller `https://` fram till ett blanksteg. Samma enkla form som en länk i chatten, för servern
 * som inte ritar texten.
 * @param {unknown} text
 * @returns {string[]}
 */
export function adresserIText(text) {
  /** @type {string[]} */
  const ut = [];
  for (const m of String(text ?? "").matchAll(/https?:\/\/[^\s<>"]+/g)) {
    const url = m[0].replace(/[.,;:!?)\]]+$/, "");
    if (!ut.includes(url)) ut.push(url);
  }
  return ut;
}

/**
 * Rotens text: kommentaren och postens länk på en egen rad. Länken ger kortet i chatten.
 * @param {string} kommentar
 * @param {string} lank
 */
export function kommentarRotText(kommentar, lank) {
  return `${String(kommentar).trim()}\n${lank}`;
}

/**
 * Kommentarens text utan postens länk, för tråden på posten själv, där länken pekar på det som redan är öppet. Bara en rad som är EXAKT postens länk tas bort.
 * @param {unknown} text
 * @param {(url: string) => boolean} arPostensLank
 */
export function utanPostlank(text, arPostensLank) {
  return String(text ?? "")
    .split(/\r?\n/)
    .filter((rad) => !arPostensLank(rad.trim()))
    .join("\n")
    .trim();
}
