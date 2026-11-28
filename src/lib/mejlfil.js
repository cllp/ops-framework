/**
 * Ett sparat mejl (`.eml`) tolkat: avsändaren, mottagarna, datumet, ämnet, texten och bilagornas namn (cllp/lifehub.app#884, punkt 4).
 *
 * ══ ⛔ VARFÖR ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-18, "Kör alla i ett svep", med punkten "Mejl (`.eml`, `.msg`): visa avsändare, mottagare, datum, ämne och text. Bilagor listas ... Ingen
 * fjärrladdning av bilder i mejlet." Som rå text är ett mejl rubrikrader, `=?utf-8?B?...?=`, base64 och quoted-printable. Fram till 0.270.0 nekades filen.
 *
 * ⛔ REN LOGIK UTAN BEROENDEN, som `lib/sie.js` och `lib/kalenderfil.js`. ⛔ INGEN HTML RITAS: har mejlet bara en HTML-del blir den text
 * (`htmlSomText`), så ingen bild, inget formulär och inget skript i mejlet når sidan. ⛔ `.msg` (Outlook) ÄR ETT BINÄRT FORMAT och tolkas inte här: den
 * laddas ned som förut. ⛔ BILAGORNA SPARAS INTE HÄR: att lägga en bilaga i Biblioteket skriver data och är ett eget steg.
 *
 * ══ HUR ═════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Byten läses som latin1, en byte per tecken, så att base64 och quoted-printable avkodas till de byte de står för, och först därefter blir text med
 * delens egen teckenkodning (`charset`, UTF-8 som förval). Rubrikerna vecklas ut (RFC 5322), och kodade ord (`=?charset?B|Q?...?=`, RFC 2047) avkodas.
 * Multipart läses rekursivt med sin gräns (`boundary`), högst `MEJL_DJUP` nivåer. Texten är den första `text/plain`, annars den första `text/html` som text.
 */

/** Hur djupt nästlade delar läses. Ett mejl med fler nivåer är trasigt eller fientligt. */
export const MEJL_DJUP = 8;

/** Typen ett sparat mejl har. */
export const MEJLFIL_MIME = "message/rfc822";

/** @param {Uint8Array} bytes */
const latin1 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return s;
};
/** @param {string} s */
const somBytes = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

/** Byte som text i en teckenkodning, med UTF-8 och sedan latin1 som reserv. @param {Uint8Array} bytes @param {string} [charset] */
function somText(bytes, charset) {
  const namn = String(charset || "utf-8").trim().toLowerCase().replace(/^"|"$/g, "");
  try {
    return new TextDecoder(namn === "us-ascii" ? "utf-8" : namn).decode(bytes);
  } catch {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return latin1(bytes);
    }
  }
}

/** Base64 som byte, med radbrytningar och skräp bortplockade. @param {string} s */
function base64(s) {
  const ren = s.replace(/[^A-Za-z0-9+/=]/g, "");
  try {
    return somBytes(atob(ren));
  } catch {
    return new Uint8Array();
  }
}

/** Quoted-printable som byte. `Q` i ett kodat ord gör dessutom `_` till mellanslag. @param {string} s @param {boolean} [ord] */
function qp(s, ord = false) {
  const t = (ord ? s.replace(/_/g, " ") : s).replace(/=\r?\n/g, "");
  const ut = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) {
      ut.push(parseInt(t.slice(i + 1, i + 3), 16));
      i += 2;
    } else ut.push(t.charCodeAt(i) & 0xff);
  }
  return new Uint8Array(ut);
}

/**
 * En rubrik med kodade ord (RFC 2047) som läsbar text. Mellanrum mellan två kodade ord tas bort, som standarden säger.
 * @param {string} v
 */
export function avkodaRubrik(v) {
  return String(v ?? "")
    .replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?)/g, "$1")
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, k, data) => somText(k.toUpperCase() === "B" ? base64(data) : qp(data, true), cs.split("*")[0]));
}

/**
 * Rubrikerna och kroppen i en del. Rubriknamnen i gemener, och en rubrik som står flera gånger behåller den första.
 * @param {string} s latin1
 */
function delaDel(s) {
  const m = /\r?\n\r?\n/.exec(s);
  const huvud = m ? s.slice(0, m.index) : s;
  const kropp = m ? s.slice(m.index + m[0].length) : "";
  /** @type {Record<string, string>} */
  const rubriker = {};
  for (const rad of huvud.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = rad.indexOf(":");
    if (i <= 0) continue;
    const namn = rad.slice(0, i).trim().toLowerCase();
    if (!(namn in rubriker)) rubriker[namn] = rad.slice(i + 1).trim();
  }
  return { rubriker, kropp };
}

/** Värdet och parametrarna i en rubrik som `text/plain; charset="utf-8"`. @param {string | undefined} v */
function parametrar(v) {
  const [forsta, ...rest] = String(v ?? "").split(";");
  /** @type {Record<string, string>} */
  const p = {};
  for (const d of rest) {
    const i = d.indexOf("=");
    if (i > 0) p[d.slice(0, i).trim().toLowerCase().replace(/\*$/, "")] = d.slice(i + 1).trim().replace(/^"|"$/g, "").replace(/^utf-8''/i, "");
  }
  return { varde: forsta.trim().toLowerCase(), p };
}

/** HTML som text, utan att något i den laddas eller körs. @param {string} html */
export function htmlSomText(html) {
  return String(html ?? "")
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * @typedef {{ namn: string, typ: string, byte: number }} MejlBilaga
 * @typedef {{ fran: string, till: string, kopia: string, datum: string | null, amne: string, text: string, franHtml: boolean, bilagor: MejlBilaga[] }} Mejl
 */

/**
 * Ett sparat mejl tolkat, eller `{ ok: false }` när filen inte har en From- eller Subject-rubrik.
 * @param {Uint8Array} bytes
 * @returns {{ ok: true, mejl: Mejl } | { ok: false, skal: string }}
 */
export function tolkaEml(bytes) {
  const { rubriker, kropp } = delaDel(latin1(bytes));
  if (!("from" in rubriker) && !("subject" in rubriker)) return { ok: false, skal: "Filen är inte ett mejl: den saknar From och Subject." };
  /** @type {{ plain: string | null, html: string | null, bilagor: MejlBilaga[] }} */
  const fynd = { plain: null, html: null, bilagor: [] };

  /** @param {Record<string, string>} r @param {string} k @param {number} djup */
  const las = (r, k, djup) => {
    const typ = parametrar(r["content-type"] || "text/plain");
    const disp = parametrar(r["content-disposition"]);
    const kodning = String(r["content-transfer-encoding"] || "").trim().toLowerCase();
    if (typ.varde.startsWith("multipart/") && typ.p.boundary && djup < MEJL_DJUP) {
      const grans = `--${typ.p.boundary}`;
      const delar = k.split(grans).slice(1);
      for (const d of delar) {
        if (d.startsWith("--")) break;
        const del = delaDel(d.replace(/^\r?\n/, ""));
        las(del.rubriker, del.kropp, djup + 1);
      }
      return;
    }
    const innehall = kodning === "base64" ? base64(k) : kodning === "quoted-printable" ? qp(k) : somBytes(k);
    const filnamn = avkodaRubrik(disp.p.filename || typ.p.name || "");
    const arBilaga = disp.varde === "attachment" || (filnamn && !typ.varde.startsWith("text/"));
    if (arBilaga) {
      fynd.bilagor.push({ namn: filnamn || typ.varde, typ: typ.varde, byte: innehall.length });
      return;
    }
    if (typ.varde === "text/plain" && fynd.plain === null) fynd.plain = somText(innehall, typ.p.charset);
    else if (typ.varde === "text/html" && fynd.html === null) fynd.html = somText(innehall, typ.p.charset);
  };
  las(rubriker, kropp, 0);

  const datum = rubriker.date ? new Date(rubriker.date) : null;
  return {
    ok: true,
    mejl: {
      fran: avkodaRubrik(rubriker.from || ""),
      till: avkodaRubrik(rubriker.to || ""),
      kopia: avkodaRubrik(rubriker.cc || ""),
      datum: datum && !Number.isNaN(datum.getTime()) ? datum.toISOString() : null,
      amne: avkodaRubrik(rubriker.subject || ""),
      text: (fynd.plain ?? (fynd.html !== null ? htmlSomText(fynd.html) : "")).replace(/\r\n/g, "\n").trim(),
      franHtml: fynd.plain === null && fynd.html !== null,
      bilagor: fynd.bilagor,
    },
  };
}
