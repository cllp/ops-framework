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
 * kodsnuttar, fet text, länkar, tabeller, avdelare och (utanför chatten) bilder
 * i en anteckning. Allt annat kommer igenom som den text det är, vilket är hela
 * poängen: ingen bit försvinner.
 *
 * ── ⛔ BILDEN ÄR ETT FILNAMN, ALDRIG EN ADRESS (cllp/lifehub.app#696) ──
 *
 * CP vill kunna lägga en bild i en anteckning. Bilden är en del av anteckningens
 * text, `![alt](filnamn)`, och filen ligger i postens egen mapp. Parsern ger då
 * bara namnet (`kind: "image"`, `namn`), och den som ritar frågar appen efter
 * adressen. En adress i texten hade varit ett sätt att låta en text hämta vad
 * som helst från vilken server som helst, så det gör den aldrig: ett namn som
 * inte är ett säkert segment (`sakertBildnamn`: bara A till Z, a till z, 0 till
 * 9, punkt, bindestreck och understreck, inget `..`, inte tomt) blir text som
 * förut, också `![bild](https://...)` i en issue-text, som då är ett `!` och en
 * länk precis som före bilderna.
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
const CLOSE = /[.,;:!?)\]]+$/;

/**
 * `image` (cllp/lifehub.app#696): `value` är alt-texten, kanske tom, och `namn` filnamnet i postens mapp, alltid ett säkert segment.
 * @typedef {{ kind: "text" | "link" | "code" | "bold" | "italic" | "break" | "image", value: string, url?: string, namn?: string }} Bit
 * @typedef {{ cross: boolean | null, inline: Bit[] }} ListEntry
 * @typedef {{ kind: "heading", level: number, inline: Bit[] }
 *   | { kind: "paragraph", inline: Bit[] }
 *   | { kind: "quote", inline: Bit[] }
 *   | { kind: "list", ordered: boolean, entries: ListEntry[] }
 *   | { kind: "code", text: string }
 *   | { kind: "table", header: Bit[][], rows: Bit[][][] }
 *   | { kind: "rule" }} Block
 */

// ⛔ EN regex med alternativ, inte fyra svep. Fyra svep över samma sträng
// betyder att svep två kan träffa inuti det svep ett redan tagit, alltså en
// länk inuti en kodsnutt som plötsligt blir klickbar.
//
// ⛔ KURSIV (#273) ÄR EN STJÄRNA ELLER ETT UNDERSTRECK RUNT ORD, och understrecket bara vid ordgräns. CP 2026-10-06 såg
// agentens svar med råa `*`. Understrecket kräver ordgräns på båda sidor, annars hade `snake_case_namn` i en issue-text blivit
// kursivt mitt i ordet. Stjärnan får inte stå intill en annan stjärna, så att `**fet**` alltid är fet och aldrig kursiv i kursiv.
//
// ⛔ BILDEN (#696) ÄR SISTA ALTERNATIVET, grupp 8 och 9. Inget av de andra börjar med `!`, så på `!`-tecknets plats kan bara den
// träffa, och grupperna för de andra står kvar där de stod. Alt-texten får vara tom (`![](namn)` är vad knappen skriver).
const INLINE =
  /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|(https?:\/\/[^\s<>"'`]+)|(?<![*\p{L}\p{N}])\*(?![\s*])([^*\n]*[^\s*])\*(?![*\p{L}\p{N}])|(?<![\p{L}\p{N}_])_(?![\s_])([^_\n]*[^\s_])_(?![\p{L}\p{N}_])|!\[([^\]\n]*)\]\(([^)\s]+)\)/gu;

/**
 * Är namnet ett filnamn som får stå i en bild i en anteckning (cllp/lifehub.app#696)? Bara ett segment: A till Z, a till z, 0 till 9,
 * punkt, bindestreck och understreck, inget `..` och inte tomt. Inget snedstreck, så att namnet aldrig kan peka ut ur postens mapp.
 *
 * @param {unknown} namn
 * @returns {boolean}
 */
export function sakertBildnamn(namn) {
  return typeof namn === "string" && /^[A-Za-z0-9._-]{1,200}$/.test(namn) && !namn.includes("..") && namn !== ".";
}

/**
 * Bildernas filnamn i en anteckning, i den ordning de står och utan dubbletter (cllp/lifehub.app#696). Samma tolkning som visningen
 * (`splitMarkdown`), så ett namn i ett kodblock eller en kodsnutt räknas inte, och ett osäkert namn räknas inte heller.
 *
 * @param {string | null | undefined} text
 * @returns {string[]}
 */
export function bilderI(text) {
  /** @type {string[]} */
  const ut = [];
  /** @param {Bit[]} bitar */
  const ta = (bitar) => {
    for (const b of bitar) if (b.kind === "image" && b.namn && !ut.includes(b.namn)) ut.push(b.namn);
  };
  for (const b of splitMarkdown(text)) {
    if (b.kind === "list") for (const e of b.entries) ta(e.inline);
    else if (b.kind === "table") for (const r of [b.header, ...b.rows]) for (const c of r) ta(c);
    else if (b.kind !== "code" && b.kind !== "rule") ta(b.inline);
  }
  return ut;
}

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
 * ⛔ BILDER BARA NÄR DE BES OM (`{ bilder: true }`, #696). Förvalet är som förut: `![alt](x)` är ett `!` och resten tolkas som
 * vanligt. Chatten, länklistan och utdraget läser utan bilder, så att ingen av dem ändrar sig för att anteckningar fått bilder.
 *
 * @param {string} row @param {{ bilder?: boolean }} [val] @returns {Bit[]}
 */
export function splitInline(row, val = {}) {
  return delaMedPlats(row, val.bilder === true).map(({ fran: _f, till: _t, ...bit }) => bit);
}

/**
 * Samma delning som `splitInline`, med var i raden varje länks råa form börjar och slutar (`fran`, `till`, 0.196.0). Bara för `utanLankar`: `splitInline` ger samma bitar som förut, utan platserna.
 * @param {string} row @param {boolean} [bilder] Se `splitInline`. @returns {Array<Bit & { fran?: number, till?: number }>}
 */
function delaMedPlats(row, bilder = false) {
  if (typeof row !== "string" || row === "") return [];

  /** @type {Array<Bit & { fran?: number, till?: number }>} */
  const out = [];
  let last = 0;
  INLINE.lastIndex = 0;

  for (let m = INLINE.exec(row); m; m = INLINE.exec(row)) {
    const start = m.index;
    /** @type {(Bit & { fran?: number, till?: number }) | null} */
    let piece = null;

    if (m[8] !== undefined && m[9] !== undefined) {
      // ⛔ EN BILD ÄR EN BILD BARA MED BILDER PÅ OCH ETT SÄKERT NAMN (#696). Annars hoppar tolkningen över `!` och fortsätter vid `[`,
      // så att resten blir exakt det den var före bilderna: en länk om adressen är http eller https, annars sin råa text.
      if (bilder && sakertBildnamn(m[9])) piece = { kind: "image", value: m[8], namn: m[9] };
      else {
        INLINE.lastIndex = start + 1;
        continue;
      }
    } else if (m[1] !== undefined) piece = { kind: "code", value: m[1] };
    else if (m[2] !== undefined && m[3] !== undefined) {
      // ⛔ `[text](javascript:...)` blir TEXT, inte en länk, och behåller sin
      // råa form. Den som skrev den ska se att den inte blev en länk.
      piece = saker(m[3]) ? { kind: "link", value: m[2], url: m[3], fran: start, till: start + m[0].length } : { kind: "text", value: m[0] };
    } else if (m[4] !== undefined) piece = { kind: "bold", value: m[4] };
    else if (m[6] !== undefined) piece = { kind: "italic", value: m[6] };
    else if (m[7] !== undefined) piece = { kind: "italic", value: m[7] };
    else if (m[5] !== undefined) {
      const url = m[5].replace(CLOSE, "");
      // Hela träffen var skiljetecken efter schemat: ingen adress att länka.
      if (url === "https://" || url === "http://") continue;
      const lank = { kind: /** @type {const} */ ("link"), value: url, url, fran: start, till: start + url.length };
      if (start > last) out.push({ kind: "text", value: row.slice(last, start) });
      out.push(lank);
      last = start + url.length;
      INLINE.lastIndex = last;
      continue;
    }

    if (!piece) continue;
    if (start > last) out.push({ kind: "text", value: row.slice(last, start) });
    out.push(piece);
    last = start + m[0].length;
  }

  if (last < row.length) out.push({ kind: "text", value: row.slice(last) });
  return out;
}

/**
 * Länkarna i en text, http och https, i den ordning de står. Samma tolkning som bubblan (`splitInline`), så en
 * `javascript:`-adress inte blir en länk här heller.
 *
 * ⛔ HÄRLETT, ALDRIG LAGRA (0.80.0, #301, arbetsreglernas punkt 2). Chattinfo läser meddelandenas text. En sparad
 * länklista hade varit en andra sanning om samma text.
 *
 * @param {string | null | undefined} text
 * @returns {Array<{ url: string, text: string }>}
 */
export function lankarI(text) {
  /** @type {Array<{ url: string, text: string }>} */
  const ut = [];
  const sedda = new Set();
  for (const bit of splitInline(typeof text === "string" ? text : "")) {
    if (bit.kind !== "link" || !bit.url || sedda.has(bit.url)) continue;
    sedda.add(bit.url);
    ut.push({ url: bit.url, text: bit.value });
  }
  return ut;
}

/**
 * Texten utan de länkar som ritas som kort (0.196.0, cllp/ops-framework#527). Bara VISNINGEN: den lagrade texten behåller länken, så att en klient utan kort fortfarande har en väg till posten.
 *
 * ⛔ SAMMA TOLKNING SOM BUBBLAN (`splitInline`): det som klipps bort är exakt det bubblan hade gjort till en länk, aldrig en adress inne i en kodsnutt. En `[text](adress)` tas bort hel, eftersom kortet bär
 * postens rubrik. Bara en rad där något klipptes städas (dubbla mellanrum, ett tomt `()`, mellanrum i kanterna), så att en lista eller ett kodblock behåller sin indragning.
 *
 * @param {string | null | undefined} text
 * @param {Iterable<string>} adresser
 * @returns {string} Tom sträng när inget annat än länkarna stod i texten.
 */
export function utanLankar(text, adresser) {
  const bort = new Set(adresser);
  const kalla = typeof text === "string" ? text : "";
  if (bort.size === 0) return kalla;
  return kalla
    .split(/\r?\n/)
    .map((rad) => {
      let ut = "";
      let sist = 0;
      for (const b of delaMedPlats(rad)) {
        if (b.kind !== "link" || !b.url || !bort.has(b.url) || b.fran === undefined || b.till === undefined) continue;
        ut += rad.slice(sist, b.fran);
        sist = b.till;
      }
      if (sist === 0) return rad;
      // En rad som bara bar länken försvinner helt, i stället för att lämna en tom rad mitt i bubblan.
      return (ut + rad.slice(sist)).replace(/\(\s*\)/g, "").replace(/[ \t]{2,}/g, " ").trim() || null;
    })
    .filter((rad) => rad !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*\n|\n\s*$/g, "");
}

/** @param {string} row @returns {string[]} */
function tableCells(row) {
  const inner = row.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((c) => c.trim());
}

/** @param {string} row */
const isTableRow = (row) => /^\s*\|.*\|\s*$/.test(row);
/** @param {string} row */
const isTableRule = (row) => /^\s*\|[\s:|-]+\|\s*$/.test(row) && row.includes("-");

/**
 * Delar markdown i block.
 *
 * ⛔ TOM TEXT GER EN TOM LISTA, inte ett block med tom text. "Ingen text" och
 * "en tom rad" ser annars likadana ut för den som renderar, och då ritas en
 * tom panel som ser ut som ett laddningsfel.
 *
 * ══ ⛔ CHATTENS DELMÄNGD (`{ chatt: true }`, #273) ═══════════════════════════════════════════════════════════════
 *
 * CP 2026-10-06 20:02, i LifeHubs agentsamtal: agentens svar ritades med råa `**` och `*`. Ärendet ber om en SÄKER DELMÄNGD i
 * chatten: fetstil, kursiv, punktlistor, numrerade listor, radbrytningar och länkar. Därför, med `chatt`:
 *   - varje radbrytning är en radbrytning (`break`), inte ett mellanslag. I en chatt är raden det man skrev, och tre rader
 *     ihopslagna till en är ett annat meddelande än det som skickades;
 *   - rubriker, tabeller, citat, kodblock och avdelare känns INTE igen, och står kvar som den text de är. En `# ` först på en
 *     rad i ett meddelande är nästan alltid ett nummer eller en tanke, och en rubrik mitt i en bubbla hade varit större än
 *     samtalets eget huvud. Inget tappas (filhuvudet): bara tolkningen uteblir.
 *
 * @param {string | null | undefined} text
 * @param {{ chatt?: boolean }} [val]
 * @returns {Block[]}
 */
export function splitMarkdown(text, val = {}) {
  if (typeof text !== "string" || !text.trim()) return [];
  const chatt = val.chatt === true;
  // ⛔ Bilder (#696) bara utanför chatten: en bild i en bubbla är en bilaga, inte en rad i texten.
  /** @param {string} r */
  const inl = (r) => splitInline(r, { bilder: !chatt });

  const rows = text.replace(/\r\n?/g, "\n").split("\n");
  /** @type {Block[]} */
  const block = [];
  /** @type {string[]} */
  let paragraph = [];

  const closeParagraph = () => {
    if (paragraph.length === 0) return;
    // ⛔ Mjuka radbrytningar blir mellanslag, som i markdown. Gjorde de inte
    // det skulle varje rad i ett stycke bli ett eget stycke, och texten få
    // luft mitt i en mening.
    // ⛔ I chatten är raden det som skrevs: en `break` mellan raderna i stället för ett mellanslag (se ovan).
    const inline = chatt
      ? paragraph.flatMap((rad, i) => (i === 0 ? inl(rad) : [/** @type {Bit} */ ({ kind: "break", value: "" }), ...inl(rad)]))
      : inl(paragraph.join(" "));
    block.push({ kind: "paragraph", inline });
    paragraph = [];
  };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];

    // ── Kodblock: allt mellan staketen är text, inte markdown ──────────────
    const fence = chatt ? null : row.match(/^\s*```(.*)$/);
    if (fence) {
      closeParagraph();
      /** @type {string[]} */
      const code = [];
      i += 1;
      while (i < rows.length && !/^\s*```/.test(rows[i])) {
        code.push(rows[i]);
        i += 1;
      }
      // ⛔ Ett ostängt staket tar resten av texten, precis som i GitHub. Att i
      // stället kasta tillbaka raderna som stycken hade gett en text som ser
      // annorlunda ut här än där den skrevs.
      block.push({ kind: "code", text: code.join("\n") });
      continue;
    }

    if (!row.trim()) {
      closeParagraph();
      continue;
    }

    const title = chatt ? null : row.match(/^\s*(#{1,6})\s+(.*)$/);
    if (title) {
      closeParagraph();
      block.push({ kind: "heading", level: title[1].length, inline: inl(title[2].trim()) });
      continue;
    }

    if (!chatt && /^\s*([-*_])\s*(\1\s*){2,}$/.test(row)) {
      closeParagraph();
      block.push({ kind: "rule" });
      continue;
    }

    // ── Tabell: en radrad följd av ett streck. Utan strecket är det text ───
    if (!chatt && isTableRow(row) && i + 1 < rows.length && isTableRule(rows[i + 1])) {
      closeParagraph();
      const header = tableCells(row).map(inl);
      /** @type {Bit[][][]} */
      const body = [];
      i += 2;
      while (i < rows.length && isTableRow(rows[i])) {
        body.push(tableCells(rows[i]).map(inl));
        i += 1;
      }
      i -= 1;
      block.push({ kind: "table", header, rows: body });
      continue;
    }

    const entry = row.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/);
    if (entry) {
      closeParagraph();
      const ordered = entry[1] === undefined;
      const last = block[block.length - 1];
      const list =
        last && last.kind === "list" && last.ordered === ordered
          ? last
          : /** @type {Block & { kind: "list" }} */ (
              block[block.push({ kind: "list", ordered, entries: [] }) - 1]
            );

      // ⛔ Kryssrutan läses UR texten och blir ett fält, inte tecken i den. En
      // `- [x]` som renderas som text ser ut som en skrivfel-parentes, och en
      // lista där hälften är gjort går då inte att skumma.
      const cross = entry[3].match(/^\[([ xX])\]\s*(.*)$/);
      list.entries.push({
        cross: cross ? cross[1].toLowerCase() === "x" : null,
        inline: inl((cross ? cross[2] : entry[3]).trim()),
      });
      continue;
    }

    const quote = chatt ? null : row.match(/^\s*>\s?(.*)$/);
    if (quote) {
      closeParagraph();
      // ⛔ RÅ TEXT SAMLAS FÖRST, INLINE-DELNINGEN GÖRS EN GÅNG PÅ SLUTET. En
      // tidig version slog ihop citatrader genom att plocka isär det redan
      // delade blocket och sätta ihop strängen igen. Det såg ut att fungera
      // och tappade tyst all fet text, eftersom stjärnorna inte finns kvar i
      // en bit som redan är typad som `fet`.
      /** @type {string[]} */
      const rows2 = [quote[1].trim()];
      while (i + 1 < rows.length && /^\s*>\s?/.test(rows[i + 1])) {
        i += 1;
        rows2.push(rows[i].replace(/^\s*>\s?/, "").trim());
      }
      block.push({ kind: "quote", inline: inl(rows2.join(" ").trim()) });
      continue;
    }

    paragraph.push(row.trim());
  }

  closeParagraph();
  return block;
}

/**
 * Chattens markdown som ren text på en rad, utan formateringstecken: det ett utdrag ska visa.
 *
 * ⛔ GRANSKNINGEN AV PR 286, MÅSTE 5. Bubblan ritade markdown, men fästraden, citaten och listans rad tog texten rakt av, så
 * agentens `**fet**` stod kvar med stjärnorna just där #273 sade att de inte skulle synas. Utdraget läser samma tolkning som
 * bubblan (`splitMarkdown(text, { chatt: true })`), så att det som är fetstil i bubblan är vanlig text här och inte två tecken
 * till. En länk blir sin text, en radbrytning ett mellanslag, och en listpunkt sin text. Inget tappas utom tecknen.
 *
 * @param {string | null | undefined} text
 * @returns {string}
 */
export function markdownSomText(text) {
  /** @param {Bit[]} bitar */
  const rad = (bitar) => bitar.map((b) => (b.kind === "break" ? " " : b.value)).join("");
  return splitMarkdown(text, { chatt: true })
    .map((b) => {
      if (b.kind === "list") return b.entries.map((e) => rad(e.inline)).join(" ");
      if (b.kind === "code") return b.text;
      if (b.kind === "table") return [b.header, ...b.rows].map((r) => r.map(rad).join(" ")).join(" ");
      if (b.kind === "rule") return "";
      return rad(b.inline);
    })
    .filter(Boolean)
    .join(" ");
}
