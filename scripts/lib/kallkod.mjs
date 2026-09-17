/**
 * Tar bort kommentarer ur JavaScript utan att tro att strängar är kod.
 *
 * ══ ⛔ VARFÖR DEN FINNS: EN VAKT MED ETT HÅL I ══════════════════════════
 *
 * Vakterna strök kommentarer med `text.replace(/\/\*[\s\S]*?\*\//g, ...)`, alltså
 * ett reguljärt uttryck utan begrepp om strängar. Det gick bra tills en app skrev
 * en helt vanlig rad:
 *
 *     <OpsFilePicker accept="image/*,application/pdf" />
 *
 * `image/*` inuti strängen lästes som början på en kommentar, och allt fram till
 * nästa `*​/` i filen försvann.
 *
 * ⛔ DEN SYNLIGA SKADAN VAR EN FALSK POSITIV: vakten slog ihop taggen med kod
 * långt senare i filen och rapporterade ett `className` som inte fanns.
 *
 * ⛔ DEN OSYNLIGA SKADAN VAR VÄRRE, och den är hela skälet till den här filen.
 * Allt som låg i det uppslukade spannet var **osynligt för vakten**. Ett riktigt
 * `className` på en primitiv där hade passerat utan ett ord. En vakt som tystnar
 * av en `/`-tecken i en sträng är en vakt man tror skyddar en.
 *
 * ══ ⛔ VAD DEN KAN OCH INTE KAN ════════════════════════════════════════
 *
 * Den läser tecken för tecken och håller reda på strängar (`'`, `"`, backtick),
 * radkommentarer, blockkommentarer och reguljära uttryck. Det är inte en JS-parser
 * och ska inte bli en: den ska kunna svara på "är det här kod eller inte", inget
 * mer.
 *
 * ⛔ Reguljära uttryck avgörs på FÖREGÅENDE BETYDELSEBÄRANDE TECKEN, samma
 * heuristik som varje enkel JS-scanner. Efter `(`, `,`, `=` och liknande är ett
 * `/` början på ett reguljärt uttryck; efter en identifierare eller en siffra är
 * det division. Heuristiken har kända hörn (`a++ /re/` och liknande), och de
 * hörnen finns inte i den kod vakterna läser.
 *
 * ⛔ RADNUMREN BEVARAS. Det som tas bort ersätts med lika många radbrytningar,
 * annars pekar varje vaktrapport på fel rad, och en rapport med fel radnummer
 * slutar man läsa.
 */

/** Tecken som betyder att nästa `/` inleder ett reguljärt uttryck och inte en division. */
const FORE_REGEX = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^", "\n"]);

/** @param {string} text @param {number} antalRader */
function radbrytningar(text) {
  const n = (text.match(/\n/g) || []).length;
  return "\n".repeat(n);
}

/**
 * @param {string} text
 * @returns {string} Samma text med kommentarernas innehåll borta och radnumren kvar.
 */
export function utanKommentarer(text) {
  let ut = "";
  let i = 0;
  /** Senaste tecken som inte är blanksteg, för regex-heuristiken. */
  let forra = "\n";

  while (i < text.length) {
    const c = text[i];
    const nasta = text[i + 1];

    // Blockkommentar
    if (c === "/" && nasta === "*") {
      const slut = text.indexOf("*/", i + 2);
      const kropp = slut === -1 ? text.slice(i) : text.slice(i, slut + 2);
      ut += radbrytningar(kropp);
      i = slut === -1 ? text.length : slut + 2;
      continue;
    }

    // Radkommentar. ⛔ Inte när den föregås av ett kolon: `https://` är ingen
    // kommentar, och den raden kostade oss en gång redan.
    if (c === "/" && nasta === "/" && forra !== ":") {
      const slut = text.indexOf("\n", i);
      i = slut === -1 ? text.length : slut;
      continue;
    }

    // Reguljärt uttryck
    if (c === "/" && FORE_REGEX.has(forra)) {
      let j = i + 1;
      let iKlass = false;
      let slot = false;
      while (j < text.length) {
        const d = text[j];
        if (d === "\\") {
          j += 2;
          continue;
        }
        // ⛔ En radbrytning avslutar letandet. Ett reguljärt uttryck kan inte
        // spänna över rader, så ett `/` som såg ut som ett regex men inte var det
        // ska inte svälja resten av filen.
        if (d === "\n") break;
        if (d === "[") iKlass = true;
        else if (d === "]") iKlass = false;
        else if (d === "/" && !iKlass) {
          slot = true;
          j += 1;
          break;
        }
        j += 1;
      }
      if (slot) {
        ut += text.slice(i, j);
        forra = "/";
        i = j;
        continue;
      }
      // Var inget regex. Faller igenom och behandlas som ett vanligt tecken.
    }

    // Sträng eller mall
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === "\\") {
          j += 2;
          continue;
        }
        if (text[j] === c) {
          j += 1;
          break;
        }
        // En vanlig sträng kan inte spänna över rader; en mall kan.
        if (text[j] === "\n" && c !== "`") break;
        j += 1;
      }
      ut += text.slice(i, j);
      forra = c;
      i = j;
      continue;
    }

    ut += c;
    if (!/\s/.test(c) || c === "\n") forra = c;
    i += 1;
  }

  return ut;
}
