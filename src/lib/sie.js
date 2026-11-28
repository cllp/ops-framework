/**
 * En SIE-fil tolkad: företaget, räkenskapsåret, kontoplanen med saldon och verifikationerna (cllp/lifehub.app#884).
 *
 * ══ ⛔ VARFÖR ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-18: "Jag skulle vilja kunna ha stöd för SIE filer i biblioteket och API:et". SIE är formatet bokföringsprogrammen (Bokio,
 * Fortnox, Visma) exporterar bokföringen i. Fram till 0.268.0 nekades en `.se` redan vid uppladdningen: ändelsen var okänd, och typen blev tom.
 *
 * ⛔ REN LOGIK UTAN BEROENDEN, så att förhandsvisningen i Biblioteket och appens API läser samma tolkning (regel 2). Inget nät, inga paket.
 *
 * ══ ⛔ TECKENKODNINGEN: PC8 ENLIGT STANDARDEN, UTF-8 NÄR FILEN ÄR DET ════════════════════════════════════════════
 *
 * SIE-standarden säger `#FORMAT PC8`, alltså IBM-teckentabellen CP437, där å är 0x86, ä 0x84 och ö 0x94. De byten är ensamma ogiltig UTF-8.
 * Vissa program skriver ändå UTF-8. `avkodaSie` läser därför filen som UTF-8 när den är giltig UTF-8 och bär ett tecken utanför ASCII, och
 * annars som CP437. En fil med bara ASCII blir samma text i båda.
 *
 * ══ ⛔ BELOPPEN I ÖRE ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `1234.50` blir 123450. Ett flyttal hade gett 0.1 + 0.2 = 0.30000000000000004 i en summa av verifikationsrader, och en bokföring som inte
 * går jämnt ut är fel. Fler än två decimaler avrundas till öre.
 *
 * ══ VAD SOM LÄSES ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   #FNAMN, #ORGNR, #SIETYP, #PROGRAM, #GEN     företaget och filen
 *   #RAR                                       räkenskapsåren (0 är det aktuella, -1 det förra)
 *   #KONTO, #KTYP                              kontoplanen
 *   #IB, #UB, #RES                             saldon för år 0 (kvantiteten läses inte)
 *   #VER med #TRANS                            verifikationerna. #RTRANS och #BTRANS läses inte: i SIE 4 följs en #RTRANS av samma #TRANS
 *                                              för äldre program, så den hade räknats två gånger.
 *
 * En rad som inte går att läsa hoppas över och räknas i `varningar`, med radnumret. Allt annat (#DIM, #OBJEKT, #PSALDO, #SRU) hoppas över tyst:
 * det hör till SIE men inte till det som visas.
 */

/** CP437 för byten 0x80 till 0xFF, i ordning. */
const CP437 =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

/**
 * Filens byte som text. UTF-8 när filen är giltig UTF-8 med något utanför ASCII, annars CP437 (PC8) som standarden säger.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function avkodaSie(bytes) {
  let utf8 = null;
  if (bytes.some((b) => b > 0x7f)) {
    try {
      utf8 = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      utf8 = null;
    }
    if (utf8 !== null) return utf8.replace(/^﻿/, "");
  }
  let ut = "";
  for (const b of bytes) ut += b < 0x80 ? String.fromCharCode(b) : CP437[b - 0x80];
  return ut;
}

/**
 * En rads fält: ord, strängar inom citattecken (`\"` är ett citattecken i strängen) och objektlistor inom klamrar, som en sträng.
 * @param {string} rad
 * @returns {string[]}
 */
export function sieFalt(rad) {
  const ut = [];
  let i = 0;
  while (i < rad.length) {
    const c = rad[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (c === '"') {
      let s = "";
      i++;
      while (i < rad.length && rad[i] !== '"') {
        if (rad[i] === "\\" && i + 1 < rad.length) i++;
        s += rad[i++];
      }
      i++;
      ut.push(s);
      continue;
    }
    if (c === "{") {
      const slut = rad.indexOf("}", i);
      const s = slut === -1 ? rad.slice(i + 1) : rad.slice(i + 1, slut);
      ut.push(s.trim());
      i = slut === -1 ? rad.length : slut + 1;
      continue;
    }
    let s = "";
    while (i < rad.length && rad[i] !== " " && rad[i] !== "\t") s += rad[i++];
    ut.push(s);
  }
  return ut;
}

/**
 * Ett belopp i öre, eller `null` när fältet inte är ett belopp. Punkt eller komma som decimaltecken.
 * @param {string | undefined} falt
 * @returns {number | null}
 */
export function sieOre(falt) {
  const m = /^(-?)(\d+)(?:[.,](\d+))?$/.exec(String(falt ?? "").trim());
  if (!m) return null;
  const dec = (m[3] ?? "").padEnd(3, "0");
  const ore = Number(m[2]) * 100 + Number(dec.slice(0, 2)) + (Number(dec[2]) >= 5 ? 1 : 0);
  if (!Number.isSafeInteger(ore)) return null;
  return m[1] === "-" && ore !== 0 ? -ore : ore;
}

/** `20251231` som `2025-12-31`, eller `null`. @param {string | undefined} falt */
export function sieDatum(falt) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(falt ?? "").trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * @typedef {{ nr: string, namn: string, typ: string | null, ib: number | null, ub: number | null, res: number | null }} SieKonto
 * @typedef {{ konto: string, belopp: number, datum: string | null, text: string }} SieRad
 * @typedef {{ serie: string, nr: string, datum: string | null, text: string, rader: SieRad[], summa: number }} SieVerifikation
 * @typedef {{
 *   sietyp: string, program: string, genererad: string | null, foretag: string, orgnr: string,
 *   rakenskapsar: Array<{ ar: number, start: string | null, slut: string | null }>,
 *   konton: SieKonto[], verifikationer: SieVerifikation[], varningar: Array<{ rad: number, text: string }>
 * }} Sie
 */

/**
 * Hela filen tolkad, eller `{ ok: false }` när texten inte är en SIE-fil (ingen `#FLAGGA` eller `#SIETYP` bland de första raderna).
 * @param {string} text
 * @returns {{ ok: true, sie: Sie } | { ok: false, skal: string }}
 */
export function tolkaSie(text) {
  const rader = String(text ?? "").split(/\r?\n/);
  const borjan = rader.slice(0, 40).map((r) => r.trim());
  if (!borjan.some((r) => /^#(FLAGGA|SIETYP)\b/i.test(r))) return { ok: false, skal: "Filen är inte en SIE-fil: den saknar #FLAGGA och #SIETYP." };

  /** @type {Sie} */
  const sie = { sietyp: "", program: "", genererad: null, foretag: "", orgnr: "", rakenskapsar: [], konton: [], verifikationer: [], varningar: [] };
  /** @type {Map<string, SieKonto>} */
  const konton = new Map();
  const konto = (/** @type {string} */ nr) => {
    if (!konton.has(nr)) konton.set(nr, { nr, namn: "", typ: null, ib: null, ub: null, res: null });
    return /** @type {SieKonto} */ (konton.get(nr));
  };
  /** @type {SieVerifikation | null} */
  let ver = null;
  let iBlock = false;
  const varna = (/** @type {number} */ i, /** @type {string} */ t) => sie.varningar.push({ rad: i + 1, text: t });

  for (let i = 0; i < rader.length; i++) {
    const rad = rader[i].trim();
    if (!rad) continue;
    if (rad === "{") {
      if (ver) iBlock = true;
      continue;
    }
    if (rad === "}") {
      if (ver) {
        ver.summa = ver.rader.reduce((s, r) => s + (r.belopp > 0 ? r.belopp : 0), 0);
        sie.verifikationer.push(ver);
      }
      ver = null;
      iBlock = false;
      continue;
    }
    if (!rad.startsWith("#")) continue;
    const [etikett, ...f] = sieFalt(rad);
    const tag = etikett.toUpperCase();
    if (iBlock) {
      if (tag === "#TRANS") {
        const belopp = sieOre(f[2]);
        if (!f[0] || belopp === null) varna(i, "En #TRANS utan konto eller belopp.");
        else ver?.rader.push({ konto: f[0], belopp, datum: sieDatum(f[3]), text: f[4] ?? "" });
      }
      continue;
    }
    switch (tag) {
      case "#SIETYP":
        sie.sietyp = f[0] ?? "";
        break;
      case "#PROGRAM":
        sie.program = [f[0], f[1]].filter(Boolean).join(" ");
        break;
      case "#GEN":
        sie.genererad = sieDatum(f[0]);
        break;
      case "#FNAMN":
        sie.foretag = f[0] ?? "";
        break;
      case "#ORGNR":
        sie.orgnr = f[0] ?? "";
        break;
      case "#RAR": {
        const ar = Number(f[0]);
        if (Number.isInteger(ar)) sie.rakenskapsar.push({ ar, start: sieDatum(f[1]), slut: sieDatum(f[2]) });
        else varna(i, "En #RAR utan årsnummer.");
        break;
      }
      case "#KONTO":
        if (f[0]) konto(f[0]).namn = f[1] ?? "";
        else varna(i, "Ett #KONTO utan nummer.");
        break;
      case "#KTYP":
        if (f[0]) konto(f[0]).typ = f[1] ?? null;
        break;
      case "#IB":
      case "#UB":
      case "#RES": {
        if (f[0] !== "0") break;
        const belopp = sieOre(f[2]);
        if (!f[1] || belopp === null) {
          varna(i, `En ${tag} utan konto eller belopp.`);
          break;
        }
        const k = konto(f[1]);
        if (tag === "#IB") k.ib = belopp;
        else if (tag === "#UB") k.ub = belopp;
        else k.res = belopp;
        break;
      }
      case "#VER":
        ver = { serie: f[0] ?? "", nr: f[1] ?? "", datum: sieDatum(f[2]), text: f[3] ?? "", rader: [], summa: 0 };
        break;
      default:
        break;
    }
  }
  if (ver) varna(rader.length - 1, "Den sista verifikationen slutar aldrig med }.");
  sie.konton = [...konton.values()].sort((a, b) => a.nr.localeCompare(b.nr, "sv", { numeric: true }));
  sie.rakenskapsar.sort((a, b) => b.ar - a.ar);
  return { ok: true, sie };
}

// Typerna står i `filtyper.js`, så att Bibliotekets startfil inte drar in tolken (0.270.0).
export { SIE_ANDELSER, SIE_MIME } from "./filtyper.js";
