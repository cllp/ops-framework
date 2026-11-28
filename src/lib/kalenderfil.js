/**
 * En kalenderfil (`.ics`) och en kontaktfil (`.vcf`) tolkade: händelserna och kontakterna (cllp/lifehub.app#884, punkt 5).
 *
 * ══ ⛔ VARFÖR ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-18, "Kör alla i ett svep", med punkten "Kalender och kontakter (`.ics`, `.vcf`): förhandsvisa händelser och kontakter". En inbjudan i ett mejl
 * och en kontakt från telefonen är de vanligaste filerna av sitt slag, och som rå text är de `DTSTART;TZID=Europe/Stockholm:20251231T120000` och `FN:Anna`.
 * Fram till 0.269.0 nekades de vid uppladdningen.
 *
 * ⛔ REN LOGIK UTAN BEROENDEN, som `lib/sie.js`, så att förhandsvisningen och appens API kan läsa samma tolkning (regel 2).
 * ⛔ INGEN IMPORT TILL EN KALENDER HÄR. Ärendet säger "erbjud import av händelser till en LIFE Hub-kalender (ingen automatisk import)": det är ett eget steg
 * som skriver data, och den här filen läser bara.
 *
 * ══ VAD SOM LÄSES ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   .ics   VEVENT: SUMMARY, DTSTART, DTEND, LOCATION, DESCRIPTION, RRULE (bara att händelsen återkommer), STATUS. Kalenderns namn ur X-WR-CALNAME.
 *          En tid i UTC (`Z`) räknas om till svensk tid. En tid med TZID eller utan zon visas som den står, och zonen står bredvid om den inte är svensk.
 *   .vcf   VCARD: FN (eller N), ORG, TITLE, TEL, EMAIL, NOTE. PHOTO läses inte: den kan vara megabyte base64 och visas inte.
 *
 * Raderna vecklas ut enligt RFC 5545 och 6350 (en rad som börjar med mellanslag eller tabb hör till raden före), och `\n`, `\,`, `\;` och `\\` blir tecknen
 * de står för. Quoted-printable (vCard 2.1, äldre telefoner) avkodas som UTF-8.
 */

/** Den svenska tidszonen, som datum och tider visas i. */
const SVENSK_ZON = "Europe/Stockholm";

/**
 * Filens rader utvecklade, och varje rad som `{ namn, param, varde }`. Namnet i versaler.
 * @param {string} text
 * @returns {Array<{ namn: string, param: Record<string, string>, varde: string }>}
 */
export function kalenderRader(text) {
  const ut = [];
  const utvecklade = String(text ?? "").replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  for (const rad of utvecklade) {
    if (!rad.trim()) continue;
    // Kolon i ett citerat parametervärde (`TZID="a:b"`) avslutar inte namnet.
    let i = 0;
    let citat = false;
    for (; i < rad.length; i++) {
      if (rad[i] === '"') citat = !citat;
      else if (rad[i] === ":" && !citat) break;
    }
    if (i >= rad.length) continue;
    const [namn, ...delar] = rad.slice(0, i).split(";");
    /** @type {Record<string, string>} */
    const param = {};
    for (const d of delar) {
      const [k, ...v] = d.split("=");
      if (k) param[k.toUpperCase()] = v.join("=").replace(/^"|"$/g, "");
    }
    ut.push({ namn: namn.toUpperCase(), param, varde: rad.slice(i + 1) });
  }
  return ut;
}

/** `\n`, `\,`, `\;` och `\\` som tecknen de står för. @param {string} v */
export function kalenderText(v) {
  return String(v ?? "").replace(/\\([nN,;\\])/g, (_, c) => (c === "n" || c === "N" ? "\n" : c));
}

/** Quoted-printable som UTF-8 (vCard 2.1). @param {string} v */
function quotedPrintable(v) {
  const byte = [];
  const s = v.replace(/=\n/g, "");
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      byte.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else byte.push(s.charCodeAt(i) & 0xff);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(byte));
  } catch {
    return String.fromCharCode(...byte);
  }
}

/**
 * Ett datum eller en tidpunkt ur DTSTART eller DTEND, som det visas: `{ datum, tid, zon }`. `tid` är `null` för en heldag. En UTC-tid räknas om till svensk tid,
 * och `zon` är då `null`. En tid med en annan TZID än den svenska bär zonen, så att 09.00 i New York inte läses som 09.00 i Visby.
 * @param {string} varde @param {Record<string, string>} [param]
 * @returns {{ datum: string, tid: string | null, zon: string | null } | null}
 */
export function kalenderTid(varde, param = {}) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(varde ?? "").trim());
  if (!m) return null;
  if (!m[4]) return { datum: `${m[1]}-${m[2]}-${m[3]}`, tid: null, zon: null };
  if (m[7]) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)));
    const del = Object.fromEntries(
      new Intl.DateTimeFormat("sv-SE", { timeZone: SVENSK_ZON, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(d)
        .map((p) => [p.type, p.value]),
    );
    return { datum: `${del.year}-${del.month}-${del.day}`, tid: `${del.hour}:${del.minute}`, zon: null };
  }
  const zon = param.TZID && param.TZID !== SVENSK_ZON ? param.TZID : null;
  return { datum: `${m[1]}-${m[2]}-${m[3]}`, tid: `${m[4]}:${m[5]}`, zon };
}

/**
 * @typedef {{ rubrik: string, start: { datum: string, tid: string | null, zon: string | null } | null, slut: { datum: string, tid: string | null, zon: string | null } | null, plats: string, beskrivning: string, aterkommer: boolean, installd: boolean }} KalenderHandelse
 * @typedef {{ namn: string, organisation: string, titel: string, telefon: string[], epost: string[], anteckning: string }} Kontakt
 */

/**
 * En kalenderfil: kalenderns namn och händelserna, de tidigaste först. `{ ok: false }` när filen inte har `BEGIN:VCALENDAR`.
 * @param {string} text
 * @returns {{ ok: true, namn: string, handelser: KalenderHandelse[] } | { ok: false, skal: string }}
 */
export function tolkaIcs(text) {
  const rader = kalenderRader(text);
  if (!rader.some((r) => r.namn === "BEGIN" && r.varde.toUpperCase() === "VCALENDAR")) return { ok: false, skal: "Filen är inte en kalenderfil: den saknar BEGIN:VCALENDAR." };
  let namn = "";
  /** @type {KalenderHandelse[]} */
  const handelser = [];
  /** @type {KalenderHandelse | null} */
  let h = null;
  let djup = 0;
  for (const r of rader) {
    const v = r.varde.toUpperCase();
    if (r.namn === "BEGIN" && v === "VEVENT") {
      h = { rubrik: "", start: null, slut: null, plats: "", beskrivning: "", aterkommer: false, installd: false };
      djup = 0;
      continue;
    }
    if (r.namn === "END" && v === "VEVENT") {
      if (h) handelser.push(h);
      h = null;
      continue;
    }
    if (!h) {
      if (r.namn === "X-WR-CALNAME") namn = kalenderText(r.varde);
      continue;
    }
    // ⛔ ETT LARM I HÄNDELSEN (VALARM) HAR EGNA RADER, och dess DESCRIPTION är inte händelsens.
    if (r.namn === "BEGIN") djup++;
    else if (r.namn === "END") djup--;
    if (djup > 0) continue;
    if (r.namn === "SUMMARY") h.rubrik = kalenderText(r.varde);
    else if (r.namn === "DTSTART") h.start = kalenderTid(r.varde, r.param);
    else if (r.namn === "DTEND") h.slut = kalenderTid(r.varde, r.param);
    else if (r.namn === "LOCATION") h.plats = kalenderText(r.varde);
    else if (r.namn === "DESCRIPTION") h.beskrivning = kalenderText(r.varde);
    else if (r.namn === "RRULE") h.aterkommer = true;
    else if (r.namn === "STATUS") h.installd = v === "CANCELLED";
  }
  const nyckel = (/** @type {KalenderHandelse} */ x) => `${x.start?.datum ?? "9999"} ${x.start?.tid ?? "00:00"}`;
  handelser.sort((a, b) => nyckel(a).localeCompare(nyckel(b)));
  return { ok: true, namn, handelser };
}

/**
 * En kontaktfil: kontakterna i den ordning de står. `{ ok: false }` när filen inte har `BEGIN:VCARD`.
 * @param {string} text
 * @returns {{ ok: true, kontakter: Kontakt[] } | { ok: false, skal: string }}
 */
export function tolkaVcf(text) {
  const rader = kalenderRader(String(text ?? "").replace(/=\r?\n/g, "=\n"));
  if (!rader.some((r) => r.namn === "BEGIN" && r.varde.toUpperCase() === "VCARD")) return { ok: false, skal: "Filen är inte en kontaktfil: den saknar BEGIN:VCARD." };
  /** @type {Kontakt[]} */
  const kontakter = [];
  /** @type {(Kontakt & { n: string }) | null} */
  let k = null;
  for (const r of rader) {
    // Grupperade namn (`item1.TEL`, Apple) läses som namnet efter punkten.
    const namn = r.namn.includes(".") ? r.namn.slice(r.namn.lastIndexOf(".") + 1) : r.namn;
    const v = r.param.ENCODING?.toUpperCase() === "QUOTED-PRINTABLE" ? quotedPrintable(r.varde) : r.varde;
    if (namn === "BEGIN" && r.varde.toUpperCase() === "VCARD") {
      k = { namn: "", n: "", organisation: "", titel: "", telefon: [], epost: [], anteckning: "" };
      continue;
    }
    if (namn === "END" && r.varde.toUpperCase() === "VCARD") {
      if (k) {
        const { n, ...rest } = k;
        kontakter.push({ ...rest, namn: rest.namn || n });
      }
      k = null;
      continue;
    }
    if (!k) continue;
    if (namn === "FN") k.namn = kalenderText(v);
    else if (namn === "N") k.n = v.split(";").slice(0, 2).reverse().map(kalenderText).filter(Boolean).join(" ");
    else if (namn === "ORG") k.organisation = v.split(";").map(kalenderText).filter(Boolean).join(", ");
    else if (namn === "TITLE") k.titel = kalenderText(v);
    else if (namn === "TEL") k.telefon.push(kalenderText(v).replace(/^tel:/i, ""));
    else if (namn === "EMAIL") k.epost.push(kalenderText(v).replace(/^mailto:/i, ""));
    else if (namn === "NOTE") k.anteckning = kalenderText(v);
  }
  return { ok: true, kontakter };
}

// Typerna står i `filtyper.js`, så att Bibliotekets startfil inte drar in tolken (0.270.0).
export { KALENDERFIL_MIME, KONTAKTFIL_MIME } from "./filtyper.js";
