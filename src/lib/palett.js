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
 * ⛔ STATUSFÄRGERNA RÖRS INTE (fel, varning, klart, info, märket, diagrammen, gruppkulörerna). De är ramverkets egna och mätta
 * mot ramverkets ytor (`scripts/check-kontrast.mjs`, `check-gruppfarg`). En hubb som sätter en yta långt från förvalet kan
 * därför ge dem sämre kontrast än förvalet; granskningen nedan prövar bara det hubben själv väljer.
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
 * `granskaPalett` prövar de par komponenterna faktiskt ritar med samma ribba som `scripts/check-kontrast.mjs` (WCAG AA:
 * 4,5:1 för brödtext, 3:1 för grafik), på de HÄRLEDDA värdena, alltså det som ritas och inte bara det som valdes. En lista
 * med fynd betyder att paletten inte ska sparas. En tom lista är ett svar: alla par håller.
 */

import { STANDARDPALETT } from "./standardpalett.generated.js";

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

/** Taket för brödtext och grafik, samma som `scripts/check-kontrast.mjs`. */
export const KONTRAST_BROD = 4.5;
export const KONTRAST_GRAFIK = 3;

/**
 * @typedef {{ bakgrund: string, yta: string, text: string, accent: string }} Lagesfarger
 * @typedef {{ ljus: Lagesfarger, mork: Lagesfarger }} Palett
 * @typedef {"ljus" | "mork"} Palettlage
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
  if (!palett || typeof palett !== "object") throw new Error("Paletten måste vara ett ljust och ett mörkt läge.");
  const extra = Object.keys(palett).filter((k) => !PALETT_LAGEN.includes(/** @type {any} */ (k)));
  if (extra.length > 0) throw new Error(`Paletten känner inte ${extra.join(", ")}.`);
  /** @type {any} */
  const ut = {};
  for (const lage of PALETT_LAGEN) {
    const f = /** @type {any} */ (palett)[lage];
    if (!f || typeof f !== "object") throw new Error(`Paletten saknar läget ${lage}.`);
    const okanda = Object.keys(f).filter((k) => !PALETT_NYCKLAR.includes(/** @type {any} */ (k)));
    if (okanda.length > 0) throw new Error(`Paletten känner inte ${okanda.join(", ")}.`);
    ut[lage] = {};
    for (const n of PALETT_NYCKLAR) {
      const v = normaliseraHex(f[n]);
      if (!v) throw new Error(`${n} i läget ${lage} är inte en färg i formen #rrggbb.`);
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

/**
 * Paren som prövas, ur `scripts/check-kontrast.mjs` (samma par, samma ribba), uttryckta i palettens ord.
 * `text` och `yta` är tokennamn, `vad` och `rad` vad användaren läser.
 */
const PAR = Object.freeze([
  {
    text: "ink", yta: "canvas", krav: KONTRAST_BROD,
    vad: { sv: "Texten mot bakgrunden", en: "Text on the background" },
    rad: { sv: "Gör texten mörkare eller bakgrunden ljusare, eller tvärtom.", en: "Make the text darker or the background lighter, or the other way round." },
  },
  {
    text: "ink", yta: "raised", krav: KONTRAST_BROD,
    vad: { sv: "Texten mot ytan", en: "Text on the surface" },
    rad: { sv: "Gör texten mörkare eller ytan ljusare, eller tvärtom.", en: "Make the text darker or the surface lighter, or the other way round." },
  },
  {
    text: "ink-secondary", yta: "raised", krav: KONTRAST_BROD,
    vad: { sv: "Den dämpade texten mot ytan", en: "Secondary text on the surface" },
    rad: { sv: "Den dämpade texten blandas av texten och ytan. Öka skillnaden mellan dem.", en: "Secondary text is mixed from the text and the surface. Increase the difference between them." },
  },
  {
    text: "accent-contrast", yta: "accent", krav: KONTRAST_BROD,
    vad: { sv: "Texten på en knapp i accentfärgen", en: "Text on an accent button" },
    rad: { sv: "Välj en accent som är tydligt ljus eller tydligt mörk.", en: "Choose an accent that is clearly light or clearly dark." },
  },
  {
    text: "accent-contrast", yta: "accent-hover", krav: KONTRAST_BROD,
    vad: { sv: "Texten på en knapp i accentfärgen när pekaren är över", en: "Text on an accent button under the pointer" },
    rad: { sv: "Välj en accent som är tydligt ljus eller tydligt mörk.", en: "Choose an accent that is clearly light or clearly dark." },
  },
  {
    text: "accent", yta: "canvas", krav: KONTRAST_GRAFIK,
    vad: { sv: "Accenten mot bakgrunden", en: "The accent on the background" },
    rad: { sv: "Knappar och reglage syns inte. Gör accenten mer olik bakgrunden.", en: "Buttons and switches disappear. Make the accent more different from the background." },
  },
  {
    text: "accent", yta: "raised", krav: KONTRAST_GRAFIK,
    vad: { sv: "Accenten mot ytan", en: "The accent on the surface" },
    rad: { sv: "Knappar och reglage syns inte. Gör accenten mer olik ytan.", en: "Buttons and switches disappear. Make the accent more different from the surface." },
  },
]);

/** Lägenas namn för användaren. */
const LAGESNAMN = Object.freeze({ ljus: { sv: "Ljust läge", en: "Light mode" }, mork: { sv: "Mörkt läge", en: "Dark mode" } });

/**
 * @typedef {object} Kontrastfynd
 * @property {Palettlage} lage
 * @property {string} text Tokenet som är texten (eller grafiken).
 * @property {string} yta Tokenet det ligger på.
 * @property {number} kvot Uppmätt, avrundad nedåt till två decimaler.
 * @property {number} krav
 * @property {{ sv: string, en: string }} meddelande En hel mening för användaren, med läget, kvoten och vad som hjälper.
 */

/**
 * Paren som inte håller. ⛔ TOM LISTA BETYDER ATT ALLA HÅLLER, och en palett med fynd sparas inte.
 * @param {Palett} palett
 * @returns {Kontrastfynd[]}
 */
export function granskaPalett(palett) {
  const t = harledPalett(palett);
  /** @type {Kontrastfynd[]} */
  const fynd = [];
  for (const lage of PALETT_LAGEN) {
    for (const p of PAR) {
      const kvot = Math.floor(kontrastkvot(t[lage][p.text], t[lage][p.yta]) * 100) / 100;
      if (kvot >= p.krav) continue;
      const kvotSv = kvot.toFixed(2).replace(".", ",");
      const kravSv = String(p.krav).replace(".", ",");
      fynd.push({
        lage,
        text: p.text,
        yta: p.yta,
        kvot,
        krav: p.krav,
        meddelande: {
          sv: `${LAGESNAMN[lage].sv}: ${p.vad.sv.toLowerCase()} är för svag, ${kvotSv}:1 där ${kravSv}:1 behövs för att läsas. ${p.rad.sv}`,
          en: `${LAGESNAMN[lage].en}: ${p.vad.en.toLowerCase()} is too weak, ${kvot.toFixed(2)}:1 where ${p.krav}:1 is needed to read it. ${p.rad.en}`,
        },
      });
    }
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
  const t = harledPalett(palett);
  const ljus = PALETT_TOKEN.map((n) => `    --color-${n}: ${t.ljus[n]};`).join("\n");
  const mork = PALETT_TOKEN.map((n) => `  --dark-${n}: ${t.mork[n]};`).join("\n");
  return `@layer theme {\n  :root {\n${ljus}\n  }\n}\n:root {\n${mork}\n}\n`;
}

/**
 * Lägger paletten i dokumentet, eller tar bort den. `null` (ingen palett) tar bort stilen helt, så att ingenting av
 * hubbens finns kvar och appen är exakt som utan funktionen.
 * @param {Palett | null} palett
 * @param {Document} [dokument]
 */
export function tillampaPalett(palett, dokument = globalThis.document) {
  if (!dokument) return;
  const finns = dokument.getElementById(PALETT_STIL_ID);
  if (!palett) {
    finns?.remove();
    return;
  }
  const stil = finns ?? dokument.createElement("style");
  stil.id = PALETT_STIL_ID;
  stil.textContent = palettTillCss(palett);
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
  const t = harledLage(palett[lage]);
  /** @type {Record<string, string>} */
  const ut = { colorScheme: lage === "mork" ? "dark" : "light" };
  for (const n of PALETT_TOKEN) ut[`--color-${n}`] = t[n];
  return ut;
}
