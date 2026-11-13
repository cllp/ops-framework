/**
 * En instans egna färger, satta vid körning (0.218.0, cllp/lifehub.app#786).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-11, i härdningen inför att SessionStudios användare bjuds in igen: SessionStudio och My skilde sig bara i två
 * färger vid bygget (`temafarg` och `bakgrundsfarg` i appens `varumarke.json`, alltså webbläsarens kant och startskärmens
 * bakgrund). Allt inne i appen var ramverkets gemensamma palett, och SessionStudio kändes inte som SessionStudio. På frågan
 * var man ställer det: "Kan man göra det under hubbinställningar i appen där samma ställe där man bestämmer vilka appar
 * som får installeras", och sedan "Kör på färgerna i härdning".
 *
 * ══ ⛔ FYRA FÄRGER PER LÄGE, OCH ALLT ANNAT HÄRLETT ═══════════════════════════════════════════════════════════════
 *
 * Det minsta som ger en hubb en egen känsla: `bakgrund` (sidans botten), `yta` (kort, paneler, menyer), `text` och
 * `accent`, för ljust och för mörkt läge. Resten av ytstegen, den dämpade texten, linjen och accentens hover, toner och
 * kontrastfärg räknas fram här (`harledPalett`). De lagras aldrig: en härledd färg som sparas bredvid sin källa är två
 * sanningar som går isär den dag någon ändrar den ena (arbetsreglernas punkt 2).
 *
 * ⛔ STATUSFÄRGERNA RÖRS INTE (fel, varning, klart, info, märket, diagrammen, gruppkulörerna), och inte heller `line-strong`,
 * `divider`, `ink-inverse` och kontrastpanelen. Statusfärgerna är ramverkets egna, och granskningen prövar dem mot HUBBENS ytor
 * (`granskaPalett`, samma par som `check-kontrast`): en yta långt från förvalet nekas i stället för att göra felraden oläslig.
 * `line-strong` och `divider` är svart respektive vit med låg täckning och följer därför ytan av sig själva, så länge temat är
 * det det heter (granskningen kräver ljusare yta än text i ljust tema och tvärtom). `ink-inverse` står bara på kontrastpanelen,
 * som inte följer paletten. Diagrammen och gruppkulörerna mäts mot ramverkets ytor och är kvar som en känd lucka (PR-texten).
 *
 * ══ ⛔ SAMMA TOKENSYSTEM, INGET PARALLELLT ═══════════════════════════════════════════════════════════════════════════
 *
 * Färgerna skrivs över ramverkets egna token, på exakt de platser brandkontraktet anvisar (`tokens/brand-kontrakt.json`):
 * ljust läge i lagret `theme` (`--color-*`), mörkt läge olagrat i `:root` (`--dark-*`). Mörkerblocken i `tokens.css`
 * pekar `--color-x` på `--dark-x`, så ett uttryckligt val av läge (`data-theme`) och systemets val fungerar som förut.
 * ⛔ INTE `style` PÅ <html>. En inline-variabel slår varje regel i varje lager, också mörkerblocken, och då hade det ljusa
 * värdet gällt i mörkt läge.
 *
 * ⛔ VILKEN SANNING SOM GÄLLER VAR:
 *   - inne i appen: hubbens färger när de är satta, annars ramverkets token. Hubbens vinner också över en brandfils
 *     färger, eftersom stilen läggs sist i dokumentet.
 *   - webbläsarens kant (`<meta name="theme-color">`), manifestet och den inbyggda startskärmen: instansens färger vid
 *     bygget. De läses innan någon är inloggad och innan hubbens färger kan hämtas, och startskärmen går inte att byta
 *     vid körning. Den här filen rör dem därför aldrig.
 *
 * ══ ⛔ OLÄSLIGT NEKAS, INTE VARNAS ═══════════════════════════════════════════════════════════════════════════════════
 *
 * `granskaPalett` prövar samma par som `scripts/check-kontrast.mjs`, ur samma lista (`kontrastpar.js`), med samma ribbor (WCAG AA:
 * 4,5:1 för brödtext, 3:1 för grafik), på de HÄRLEDDA värdena, alltså det som ritas och inte bara det som valdes. En lista
 * med fynd betyder att paletten inte ska sparas. En tom lista är ett svar: alla par håller.
 */

import { RAMVERKETS_PARTOKEN, STANDARDPALETT } from "./standardpalett.generated.js";
import { BROD, GRAFIK, PAR } from "./kontrastpar.js";

export { STANDARDPALETT };

/** Lägena, i den ordning de står i en palett. */
export const PALETT_LAGEN = Object.freeze(/** @type {const} */ (["ljus", "mork"]));

/** De fyra färger en palett bär per läge. */
export const PALETT_NYCKLAR = Object.freeze(/** @type {const} */ (["bakgrund", "yta", "text", "accent"]));

/**
 * Formen på en sparad färg: `#rrggbb`, sex små hexsiffror. ⛔ EN FORM, INTE TRE: `#ABC`, `#AABBCC` och `rgb()` betyder
 * samma sak men hade gett tre olika värden att jämföra, i appen och i reglerna. `normaliseraHex` gör en inmatning till formen.
 */
export const PALETT_HEXFORM = /^#[0-9a-f]{6}$/;

/** Ribborna för brödtext och grafik, samma som `check-kontrast` (de bor i `kontrastpar.js`). */
export const KONTRAST_BROD = BROD;
export const KONTRAST_GRAFIK = GRAFIK;

/**
 * @typedef {{ bakgrund: string, yta: string, text: string, accent: string }} Lagesfarger
 * @typedef {{ ljus: Lagesfarger, mork: Lagesfarger }} Palett
 * @typedef {"ljus" | "mork"} Palettlage
 * @typedef {"bakgrund" | "yta" | "text" | "accent"} PalettNyckel
 */

/** @param {unknown} v */
export function arHexfarg(v) {
  return typeof v === "string" && PALETT_HEXFORM.test(v);
}

/**
 * En inmatning som formen, eller `null` när den inte är en färg. Tar `#abc`, `ABCDEF`, blanksteg runt om.
 * @param {unknown} v
 * @returns {string | null}
 */
export function normaliseraHex(v) {
  if (typeof v !== "string") return null;
  let s = v.trim().toLowerCase();
  if (!s.startsWith("#")) s = `#${s}`;
  if (/^#[0-9a-f]{3}$/.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return PALETT_HEXFORM.test(s) ? s : null;
}

/**
 * Paletten ur ett dokument, eller `null` när den saknas eller inte har formen. ⛔ EN HALV PALETT ÄR INGEN PALETT: ett
 * dokument som saknar en färg eller bär något annat läses som om inget var satt, och appen ser ut som förvalet. Att rita
 * en halv palett hade blandat hubbens färger med förvalets på ett sätt ingen valt, och ingen granskning prövat.
 * @param {unknown} rad
 * @returns {Palett | null}
 */
export function lasPalett(rad) {
  if (!rad || typeof rad !== "object") return null;
  /** @type {any} */
  const ut = {};
  for (const lage of PALETT_LAGEN) {
    const f = /** @type {any} */ (rad)[lage];
    if (!f || typeof f !== "object") return null;
    ut[lage] = {};
    for (const n of PALETT_NYCKLAR) {
      if (!arHexfarg(f[n])) return null;
      ut[lage][n] = f[n];
    }
  }
  return /** @type {Palett} */ (ut);
}

/**
 * Det som sparas: exakt `{ ljus, mork }` med fyra färger var, i formen. Kastar på allt annat.
 * ⛔ KASTAR, TYSTAR INTE. En färg som tyst släpptes hade sett ut som sparad.
 * @param {unknown} palett
 * @returns {Palett}
 */
export function byggPalett(palett) {
  if (!palett || typeof palett !== "object") throw new Error("Paletten måste ha ett ljust och ett mörkt tema.");
  const extra = Object.keys(palett).filter((k) => !PALETT_LAGEN.includes(/** @type {any} */ (k)));
  if (extra.length > 0) throw new Error(`Paletten känner inte ${extra.join(", ")}.`);
  /** @type {any} */
  const ut = {};
  for (const lage of PALETT_LAGEN) {
    const f = /** @type {any} */ (palett)[lage];
    if (!f || typeof f !== "object") throw new Error(`Paletten saknar temat ${lage}.`);
    const okanda = Object.keys(f).filter((k) => !PALETT_NYCKLAR.includes(/** @type {any} */ (k)));
    if (okanda.length > 0) throw new Error(`Paletten känner inte ${okanda.join(", ")}.`);
    ut[lage] = {};
    for (const n of PALETT_NYCKLAR) {
      const v = normaliseraHex(f[n]);
      if (!v) throw new Error(`${n} i temat ${lage} är inte en färg i formen #rrggbb.`);
      ut[lage][n] = v;
    }
  }
  return /** @type {Palett} */ (ut);
}

// ── Färgräkning ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** @param {string} hex @returns {[number, number, number]} */
function rgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/** @param {number[]} k */
function hex(k) {
  return `#${k.map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Färgen `andel` av vägen från `a` till `b`, kanal för kanal i sRGB (det `color-mix(in srgb, ...)` gör).
 * @param {string} a @param {string} b @param {number} andel
 */
export function blanda(a, b, andel) {
  const x = rgb(a);
  const y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * andel));
}

/** @param {string} h */
function luminans(h) {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Kontrastkvoten mellan två färger enligt WCAG 2, 1 till 21.
 * @param {string} a @param {string} b
 */
export function kontrastkvot(a, b) {
  const la = luminans(a);
  const lb = luminans(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** @param {string} h @param {number} alfa */
function rgba(h, alfa) {
  const [r, g, b] = rgb(h);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

/**
 * Ramverkets token ur ett lägets fyra färger, med tokenets namn utan prefix (`canvas`, `ink-secondary`).
 *
 * ⛔ ANDELARNA ÄR MÄTTA MOT FÖRVALET, INTE VALDA. De ger ungefär ramverkets egna steg ur förvalets fyra färger (mätt
 * 2026-11-11 mot `tokens.css`: mörkt hover #363c35 mot #323a32, sunken #1c201c mot #1c221c, ljust linje #e7e3de mot #e8e2da),
 * och samma steg ur SessionStudios gamla palett (yta #1f1f25 och hover #2f2f34 mot SS #2a2a2f).
 *
 * ⛔ KONTRASTFÄRGEN PÅ ACCENTEN VÄLJS, den sätts inte: svart eller vitt, det som håller bäst mot både accenten och dess
 * hover. Ramverkets eget mörka #2a2520 är ett beslut för en känd accent; för en okänd är bara de två ändarna säkra.
 *
 * @param {Lagesfarger} f
 * @returns {Record<string, string>}
 */
export function harledLage(f) {
  const accentHover = blanda(f.accent, "#ffffff", 0.12);
  const svart = Math.min(kontrastkvot("#000000", f.accent), kontrastkvot("#000000", accentHover));
  const vitt = Math.min(kontrastkvot("#ffffff", f.accent), kontrastkvot("#ffffff", accentHover));
  return {
    canvas: f.bakgrund,
    surface: blanda(f.bakgrund, f.yta, 0.5),
    raised: f.yta,
    elevated: f.yta,
    sunken: blanda(f.bakgrund, f.yta, 0.25),
    hover: blanda(f.yta, f.text, 0.08),
    ink: f.text,
    "ink-secondary": blanda(f.text, f.yta, 0.25),
    "ink-muted": blanda(f.text, f.yta, 0.45),
    line: blanda(f.yta, f.text, 0.12),
    accent: f.accent,
    "accent-hover": accentHover,
    "accent-subtle": rgba(f.accent, 0.12),
    "accent-faint": rgba(f.accent, 0.06),
    "accent-contrast": svart >= vitt ? "#000000" : "#ffffff",
  };
}

/**
 * Båda lägenas token.
 * @param {Palett} palett
 * @returns {{ ljus: Record<string, string>, mork: Record<string, string> }}
 */
export function harledPalett(palett) {
  return { ljus: harledLage(palett.ljus), mork: harledLage(palett.mork) };
}

/** Tokennamnen paletten skriver, utan prefix. ⛔ Provet kräver att vart och ett finns i `tokens.css`, båda lägena. */
export const PALETT_TOKEN = Object.freeze(Object.keys(harledLage(STANDARDPALETT.ljus)));

// ── Granskningen ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Lägenas namn för användaren. */
const LAGESNAMN = Object.freeze({ ljus: { sv: "Ljust tema", en: "Light mode" }, mork: { sv: "Mörkt tema", en: "Dark mode" } });

/** Token paletten inte skriver, alltså ramverkets egna: statusfärgerna, märket, räknemärkets kontrast. */
const FASTA = new Set(["danger", "success", "warning", "info", "info-bg", "badge", "badge-contrast", "marke-accent"]);

/**
 * Vad som hjälper, ur vilka av palettens färger paret hänger på.
 * @param {{ text: string, yta: string }} p
 * @returns {{ sv: string, en: string }}
 */
function hjalp(p) {
  if (FASTA.has(p.text) || FASTA.has(p.yta)) {
    return {
      sv: "Fel, varning, klart och info har ramverkets egna färger. Välj en bakgrund och yta närmare standardfärgernas ljushet i det här temat.",
      en: "Error, warning, success and info keep the framework's colours. Choose a background and surface closer to the default lightness in this mode.",
    };
  }
  if (p.text.startsWith("accent") || p.yta.startsWith("accent")) {
    return {
      sv: "Välj en accent som är tydligt ljusare eller mörkare än bakgrunden och ytan, och tydligt ljus eller tydligt mörk.",
      en: "Choose an accent that is clearly lighter or darker than the background and surface, and clearly light or clearly dark.",
    };
  }
  if (p.text === "ink-secondary") {
    return {
      sv: "Den dämpade texten blandas av texten och ytan. Öka skillnaden mellan texten och bakgrunden och ytan.",
      en: "Secondary text is mixed from the text and the surface. Increase the difference between the text and the background and surface.",
    };
  }
  return { sv: "Gör texten mörkare eller bakgrunden och ytan ljusare, eller tvärtom.", en: "Make the text darker or the background and surface lighter, or the other way round." };
}

/**
 * Ett token som färg, med en halvgenomskinlig lagd över sin bas (samma sätt som `check-kontrast` räknar `info-bg`).
 * @param {Record<string, string>} t @param {string} namn @param {string} [bas]
 * @returns {string}
 */
function tokenfarg(t, namn, bas) {
  const v = t[namn];
  if (v.startsWith("#")) return v;
  const d = (v.match(/[\d.]+/g) ?? []).map(Number);
  const a = d[3] ?? 1;
  if (a >= 1 || !bas) return hex([d[0], d[1], d[2]]);
  const u = rgb(tokenfarg(t, bas));
  return hex([d[0], d[1], d[2]].map((c, i) => c * a + u[i] * (1 - a)));
}

/**
 * @typedef {object} Kontrastfynd
 * @property {Palettlage} lage
 * @property {string} text Tokenet som är texten (eller grafiken). `ordning` när bakgrunden eller ytan står på fel sida om texten.
 * @property {string} yta Tokenet det ligger på.
 * @property {string} [bas] Ytan under en halvgenomskinlig `yta` (`info-bg`), när paret har en.
 * @property {number} kvot Uppmätt, avrundad nedåt till två decimaler. 0 för `ordning`.
 * @property {number} krav
 * @property {{ sv: string, en: string }} meddelande En hel mening för användaren, med temat, kvoten och vad som hjälper.
 */

/**
 * Färgerna temats ordning gäller: i ljust tema ska bakgrunden och ytan vara ljusare än texten, i mörkt mörkare. Accenten står
 * utanför. Exporterad så att färgväljarens skala (`palettomfang.js`) vet vilka färger ett `ordning`-fynd hänger på, ur samma
 * lista som granskningen prövar (arbetsreglernas punkt 2).
 */
export const ORDNINGENS_NYCKLAR = Object.freeze(/** @type {const} */ (["bakgrund", "yta", "text"]));

/**
 * Paren som inte håller. ⛔ TOM LISTA BETYDER ATT ALLA HÅLLER, och en palett med fynd sparas inte och läggs inte på.
 *
 * ⛔ SAMMA PAR SOM `check-kontrast`, UR SAMMA LISTA (`kontrastpar.js`), mot palettens härledda token och ramverkets egna för det
 * paletten inte skriver. Första versionen hade en egen lista på sju par och släppte igenom paletter där dämpad text på sidan gav
 * 2,45:1 och felraden 1,17:1 (granskningen av 0.218.0). Se filhuvudet i `kontrastpar.js`.
 *
 * ⛔ OCH TEMAT MÅSTE VARA DET DET HETER: i ljust tema ljusare bakgrund och yta än texten, i mörkt mörkare. Annars blir ramverkets
 * linjer och avdelare (`line-strong`, `divider`: svart respektive vit med låg täckning) och mörkerplumbingen fel åt hållet, fast
 * kontrasten håller.
 *
 * @param {Palett} palett
 * @returns {Kontrastfynd[]}
 */
export function granskaPalett(palett) {
  const p = lasPalett(palett);
  if (!p) throw new Error("granskaPalett: det här är inte en palett i formen { ljus, mork } med fyra #rrggbb var.");
  return PALETT_LAGEN.flatMap((lage) => granskaLage(lage, p[lage]));
}

/**
 * Ett lägets fynd, med samma par och samma ribbor som `granskaPalett` (som är den här funktionen för båda lägena).
 *
 * ⛔ FINNS FÖR FÄRGVÄLJARENS SKALA (0.219.0, cllp/lifehub.app#798): `hallbarLjushet` prövar hundra ljusheter av en färg och
 * behöver svaret för ett läge i taget. Den prövar genom den här funktionen och inte genom en egen lista, annars hade skalan
 * kunnat säga "håller" om något granskningen nekar.
 *
 * ⛔ `val` SMALNAR AV, DET LÄGGER INTE TILL: `par` är en delmängd av `PAR` (skalan prövar bara paren som hänger på färgen den
 * flyttar, annars blev ett reglagedrag hundra granskningar av alla par), och `ordning: false` hoppar över temats ordning för en
 * färg som inte ingår i den. Utan `val` är det hela granskningen.
 *
 * @param {Palettlage} lage
 * @param {Lagesfarger} f Färgerna i formen (`#rrggbb`). Prövas inte här: anroparen har redan läst paletten.
 * @param {{ par?: typeof PAR, ordning?: boolean }} [val]
 * @returns {Kontrastfynd[]}
 */
export function granskaLage(lage, f, { par: paren = PAR, ordning = true } = {}) {
  /** @type {Kontrastfynd[]} */
  const fynd = [];
  const ljusare = (/** @type {string} */ a, /** @type {string} */ b) => luminans(a) > luminans(b);
  const ytor = ORDNINGENS_NYCKLAR.filter((n) => n !== "text").map((n) => f[n]);
  const ratt = !ordning || (lage === "ljus" ? ytor.every((y) => ljusare(y, f.text)) : ytor.every((y) => ljusare(f.text, y)));
  if (!ratt) {
    fynd.push({
      lage,
      text: "ordning",
      yta: "ordning",
      kvot: 0,
      krav: 0,
      meddelande:
        lage === "ljus"
          ? { sv: "Ljust tema: bakgrunden och ytan ska vara ljusare än texten.", en: "Light mode: the background and surface must be lighter than the text." }
          : { sv: "Mörkt tema: bakgrunden och ytan ska vara mörkare än texten.", en: "Dark mode: the background and surface must be darker than the text." },
    });
  }
  const t = { ...RAMVERKETS_PARTOKEN[lage], ...harledLage(f) };
  for (const par of paren) {
    const kvot = Math.floor(kontrastkvot(tokenfarg(t, par.text), tokenfarg(t, par.yta, par.bas)) * 100) / 100;
    if (kvot >= par.niva) continue;
    // Samma par kan stå två gånger i listan (två ställen ritar det); användaren behöver det en gång.
    if (fynd.some((x) => x.text === par.text && x.yta === par.yta && x.bas === par.bas)) continue;
    const h = hjalp(par);
    const kvotSv = kvot.toFixed(2).replace(".", ",");
    const kravSv = String(par.niva).replace(".", ",");
    fynd.push({
      lage,
      text: par.text,
      yta: par.yta,
      ...(par.bas ? { bas: par.bas } : {}),
      kvot,
      krav: par.niva,
      meddelande: {
        sv: `${LAGESNAMN[lage].sv}: ${par.vad} är för svag, ${kvotSv}:1 där ${kravSv}:1 behövs. ${h.sv}`,
        en: `${LAGESNAMN[lage].en}: ${par.text} on ${par.yta} is too weak, ${kvot.toFixed(2)}:1 where ${par.niva}:1 is needed. ${h.en}`,
      },
    });
  }
  return fynd;
}

// ── Stilen i dokumentet ─────────────────────────────────────────────────────────────────────────────────────────────

/** `id` på stilen paletten skriver. En per dokument. */
export const PALETT_STIL_ID = "ops-palett";

/**
 * Stilen för en palett: ljust läge i lagret `theme`, mörkt olagrat i `:root`. Se filhuvudet för varför just där.
 * @param {Palett} palett
 * @returns {string}
 */
export function palettTillCss(palett) {
  // ⛔ PRÖVAS FÖRST (granskningen av 0.218.0): en sträng i en färg hade annars gått rakt in i stilen, `}` och allt.
  const p = lasPalett(palett);
  if (!p) throw new Error("palettTillCss: det här är inte en palett i formen { ljus, mork } med fyra #rrggbb var.");
  const t = harledPalett(p);
  const ljus = PALETT_TOKEN.map((n) => `    --color-${n}: ${t.ljus[n]};`).join("\n");
  const mork = PALETT_TOKEN.map((n) => `  --dark-${n}: ${t.mork[n]};`).join("\n");
  return `@layer theme {\n  :root {\n${ljus}\n  }\n}\n:root {\n${mork}\n}\n`;
}

/**
 * Lägger paletten i dokumentet, eller tar bort den. `null` (ingen palett) tar bort stilen helt, så att ingenting av
 * hubbens finns kvar och appen är exakt som utan funktionen.
 * @param {unknown} palett En palett, `null`, eller något som inte är en palett (tas bort som `null`).
 * @param {Document} [dokument]
 */
export function tillampaPalett(palett, dokument = globalThis.document) {
  if (!dokument) return;
  const finns = dokument.getElementById(PALETT_STIL_ID);
  // ⛔ EN OGILTIG PALETT ÄR INGEN PALETT: stilen tas bort, som för `null`. Ett kast här hade fällt sidan för en färg.
  const p = lasPalett(palett);
  if (!p) {
    finns?.remove();
    return;
  }
  const stil = finns ?? dokument.createElement("style");
  stil.id = PALETT_STIL_ID;
  stil.textContent = palettTillCss(p);
  // ⛔ SIST I <head>, ALLTID: en senare regel med samma vikt vinner, och stilen ska stå efter ramverkets och brandfilens.
  dokument.head.appendChild(stil);
}

/**
 * Ett läges token som stil på ett element, för en förhandsvisning: allt inne i elementet ritas i paletten, oavsett vilket
 * läge resten av sidan står i. ⛔ BARA FÖR EN AVGRÄNSAD YTA. En variabel som stil på elementet ärver nedåt och vinner över
 * `:root`, vilket är precis vad en förhandsvisning behöver och precis det som gör den fel för hela dokumentet.
 * @param {Palett} palett
 * @param {Palettlage} lage
 * @returns {Record<string, string>}
 */
export function palettStil(palett, lage) {
  // ⛔ En ogiltig palett ger ingen stil (rutan ritas i sidans egna färger), aldrig en sträng rakt in i en variabel.
  const p = lasPalett(palett);
  if (!p || !PALETT_LAGEN.includes(lage)) return {};
  const t = harledLage(p[lage]);
  /** @type {Record<string, string>} */
  const ut = { colorScheme: lage === "mork" ? "dark" : "light" };
  for (const n of PALETT_TOKEN) ut[`--color-${n}`] = t[n];
  return ut;
}
