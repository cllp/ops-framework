/**
 * Markdown till block, som ren funktion.
 *
 * ── ⛔ VARFÖR DEN FINNS ──────────────────────────────────────────────────
 *
 * CP (bolag-ops #249, med bild): ett utfällt ärendekort visade `## Context`
 * rakt av. Texten kommer från GitHub-issues, alltså från mallar som är skrivna
 * i markdown, och en app som renderar den som ren text visar läsaren
 * formateringstecken i stället för struktur. Värst är rubriken: den står
 * ensam på en rad och ser ut som ett fel, vilket den också var.
 *
 * ── ⛔ EN EGEN PARSER OCH INTE ETT BIBLIOTEK ────────────────────────────
 *
 * `marked` plus `dompurify` är omkring 30 kB gzippat och tar in HTML-strängar
 * i en kodbas som annars aldrig rör `dangerouslySetInnerHTML`. Vi behöver sex
 * blocktyper ur en text vi själva skriver, och kostnaden för dem är den här
 * filen plus en komponent som renderar riktiga React-element. Ingen HTML
 * passerar någonsin genom en sträng, så hela XSS-ytan uteblir i stället för
 * att saneras.
 *
 * ⛔ DET HÄR ÄR ALLTSÅ INTE FULL MARKDOWN, OCH SKA INTE BLI DET. Stöttat:
 * rubriker, stycken, punkt- och sifferlistor, kryssrutor, citat, kodblock,
 * kodsnuttar, fet text, länkar, tabeller och avdelare. Allt annat kommer
 * igenom som den text det är, vilket är hela poängen: ingen bit försvinner.
 *
 * ── ⛔ BARA HTTP OCH HTTPS ──────────────────────────────────────────────
 *
 * Samma regel som `bolag-ops/web/src/data/lanktext.js`, och av samma skäl: en
 * `<a href>` kör vad som helst som ser ut som ett schema, och `javascript:` är
 * det klassiska sättet att göra text till kod. Att texten kommer ur vår egen
 * datakälla är inget skydd, det är precis det antagandet som gör en injektion
 * möjlig den dagen en källa till läggs.
 */

/**
 * ⛔ TECKEN SOM AVSLUTAR EN MENING TILLHÖR MENINGEN, INTE ADRESSEN.
 * "se https://example.com/x." slutar med en punkt som är skiljetecken. Kolon
 * och semikolon FÅR förekomma inuti en URL men aldrig sist, så att klippa dem
 * i slutet kan inte göra en giltig adress ogiltig.
 */
const AVSLUT = /[.,;:!?)\]]+$/;

/**
 * @typedef {{ typ: "text" | "lank" | "kod" | "fet", varde: string, url?: string }} Bit
 * @typedef {{ kryss: boolean | null, inline: Bit[] }} Listpost
 * @typedef {{ typ: "rubrik", niva: number, inline: Bit[] }
 *   | { typ: "stycke", inline: Bit[] }
 *   | { typ: "citat", inline: Bit[] }
 *   | { typ: "lista", ordnad: boolean, poster: Listpost[] }
 *   | { typ: "kod", text: string }
 *   | { typ: "tabell", huvud: Bit[][], rader: Bit[][][] }
 *   | { typ: "linje" }} Block
 */

// ⛔ EN regex med alternativ, inte fyra svep. Fyra svep över samma sträng
// betyder att svep två kan träffa inuti det svep ett redan tagit, alltså en
// länk inuti en kodsnutt som plötsligt blir klickbar.
const INLINE =
  /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|(https?:\/\/[^\s<>"'`]+)/g;

/** @param {string} url @returns {boolean} */
function saker(url) {
  return /^https?:\/\//i.test(url);
}

/**
 * Delar en rad i text, kod, fet text och länkar.
 *
 * ⛔ RETURNERAR ALLTID HELA TEXTEN. En felskriven länk syns som det den är i
 * stället för att tappas bort: en tyst nedsläppsväg är värre än en ful rad.
 *
 * @param {string} rad @returns {Bit[]}
 */
export function delaInline(rad) {
  if (typeof rad !== "string" || rad === "") return [];

  /** @type {Bit[]} */
  const ut = [];
  let sist = 0;
  INLINE.lastIndex = 0;

  for (let m = INLINE.exec(rad); m; m = INLINE.exec(rad)) {
    const start = m.index;
    /** @type {Bit | null} */
    let bit = null;

    if (m[1] !== undefined) bit = { typ: "kod", varde: m[1] };
    else if (m[2] !== undefined && m[3] !== undefined) {
      // ⛔ `[text](javascript:...)` blir TEXT, inte en länk, och behåller sin
      // råa form. Den som skrev den ska se att den inte blev en länk.
      bit = saker(m[3]) ? { typ: "lank", varde: m[2], url: m[3] } : { typ: "text", varde: m[0] };
    } else if (m[4] !== undefined) bit = { typ: "fet", varde: m[4] };
    else if (m[5] !== undefined) {
      const url = m[5].replace(AVSLUT, "");
      // Hela träffen var skiljetecken efter schemat: ingen adress att länka.
      if (url === "https://" || url === "http://") continue;
      bit = { typ: "lank", varde: url, url };
      if (start > sist) ut.push({ typ: "text", varde: rad.slice(sist, start) });
      ut.push(bit);
      sist = start + url.length;
      INLINE.lastIndex = sist;
      continue;
    }

    if (!bit) continue;
    if (start > sist) ut.push({ typ: "text", varde: rad.slice(sist, start) });
    ut.push(bit);
    sist = start + m[0].length;
  }

  if (sist < rad.length) ut.push({ typ: "text", varde: rad.slice(sist) });
  return ut;
}

/** @param {string} rad @returns {string[]} */
function tabellceller(rad) {
  const inre = rad.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inre.split("|").map((c) => c.trim());
}

/** @param {string} rad */
const arTabellrad = (rad) => /^\s*\|.*\|\s*$/.test(rad);
/** @param {string} rad */
const arTabellstreck = (rad) => /^\s*\|[\s:|-]+\|\s*$/.test(rad) && rad.includes("-");

/**
 * Delar markdown i block.
 *
 * ⛔ TOM TEXT GER EN TOM LISTA, inte ett block med tom text. "Ingen text" och
 * "en tom rad" ser annars likadana ut för den som renderar, och då ritas en
 * tom panel som ser ut som ett laddningsfel.
 *
 * @param {string | null | undefined} text @returns {Block[]}
 */
export function delaMarkdown(text) {
  if (typeof text !== "string" || !text.trim()) return [];

  const rader = text.replace(/\r\n?/g, "\n").split("\n");
  /** @type {Block[]} */
  const block = [];
  /** @type {string[]} */
  let stycke = [];

  const stangStycke = () => {
    if (stycke.length === 0) return;
    // ⛔ Mjuka radbrytningar blir mellanslag, som i markdown. Gjorde de inte
    // det skulle varje rad i ett stycke bli ett eget stycke, och texten få
    // luft mitt i en mening.
    block.push({ typ: "stycke", inline: delaInline(stycke.join(" ")) });
    stycke = [];
  };

  for (let i = 0; i < rader.length; i += 1) {
    const rad = rader[i];

    // ── Kodblock: allt mellan staketen är text, inte markdown ──────────────
    const staket = rad.match(/^\s*```(.*)$/);
    if (staket) {
      stangStycke();
      /** @type {string[]} */
      const kod = [];
      i += 1;
      while (i < rader.length && !/^\s*```/.test(rader[i])) {
        kod.push(rader[i]);
        i += 1;
      }
      // ⛔ Ett ostängt staket tar resten av texten, precis som i GitHub. Att i
      // stället kasta tillbaka raderna som stycken hade gett en text som ser
      // annorlunda ut här än där den skrevs.
      block.push({ typ: "kod", text: kod.join("\n") });
      continue;
    }

    if (!rad.trim()) {
      stangStycke();
      continue;
    }

    const rubrik = rad.match(/^\s*(#{1,6})\s+(.*)$/);
    if (rubrik) {
      stangStycke();
      block.push({ typ: "rubrik", niva: rubrik[1].length, inline: delaInline(rubrik[2].trim()) });
      continue;
    }

    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(rad)) {
      stangStycke();
      block.push({ typ: "linje" });
      continue;
    }

    // ── Tabell: en radrad följd av ett streck. Utan strecket är det text ───
    if (arTabellrad(rad) && i + 1 < rader.length && arTabellstreck(rader[i + 1])) {
      stangStycke();
      const huvud = tabellceller(rad).map(delaInline);
      /** @type {Bit[][][]} */
      const kropp = [];
      i += 2;
      while (i < rader.length && arTabellrad(rader[i])) {
        kropp.push(tabellceller(rader[i]).map(delaInline));
        i += 1;
      }
      i -= 1;
      block.push({ typ: "tabell", huvud, rader: kropp });
      continue;
    }

    const post = rad.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/);
    if (post) {
      stangStycke();
      const ordnad = post[1] === undefined;
      const sista = block[block.length - 1];
      const lista =
        sista && sista.typ === "lista" && sista.ordnad === ordnad
          ? sista
          : /** @type {Block & { typ: "lista" }} */ (
              block[block.push({ typ: "lista", ordnad, poster: [] }) - 1]
            );

      // ⛔ Kryssrutan läses UR texten och blir ett fält, inte tecken i den. En
      // `- [x]` som renderas som text ser ut som en skrivfel-parentes, och en
      // lista där hälften är gjort går då inte att skumma.
      const kryss = post[3].match(/^\[([ xX])\]\s*(.*)$/);
      lista.poster.push({
        kryss: kryss ? kryss[1].toLowerCase() === "x" : null,
        inline: delaInline((kryss ? kryss[2] : post[3]).trim()),
      });
      continue;
    }

    const citat = rad.match(/^\s*>\s?(.*)$/);
    if (citat) {
      stangStycke();
      // ⛔ RÅ TEXT SAMLAS FÖRST, INLINE-DELNINGEN GÖRS EN GÅNG PÅ SLUTET. En
      // tidig version slog ihop citatrader genom att plocka isär det redan
      // delade blocket och sätta ihop strängen igen. Det såg ut att fungera
      // och tappade tyst all fet text, eftersom stjärnorna inte finns kvar i
      // en bit som redan är typad som `fet`.
      /** @type {string[]} */
      const rader2 = [citat[1].trim()];
      while (i + 1 < rader.length && /^\s*>\s?/.test(rader[i + 1])) {
        i += 1;
        rader2.push(rader[i].replace(/^\s*>\s?/, "").trim());
      }
      block.push({ typ: "citat", inline: delaInline(rader2.join(" ").trim()) });
      continue;
    }

    stycke.push(rad.trim());
  }

  stangStycke();
  return block;
}
