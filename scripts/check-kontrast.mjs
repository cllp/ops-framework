#!/usr/bin/env node
/**
 * Kontrasten på de text-mot-yta-par komponenterna faktiskt använder, i BÅDA
 * teman.
 *
 * ══ ⛔ VARFÖR VAKTEN FINNS ══════════════════════════════════════════════════
 *
 * CP 2026-09-25, om notispanelen i mörkt tema: "Etikettchipsen är oläsbara.
 * Ljust krämfärgat chip med ljus/nästan osynlig text."
 *
 * Rotorsaken var inte ett dåligt färgval. Chippet skrev `bg-accent
 * text-on-accent`, och **`--color-on-accent` har aldrig funnits**. Tailwind
 * skriver då `color: var(--color-on-accent)`, som resolvar till ingenting, så
 * texten ärvde föräldern. I ljust tema råkade det se rimligt ut; i mörkt blev
 * ljus text på krämfärgad yta.
 *
 * ⛔ INGEN BEFINTLIG VAKT KUNDE FÅNGA DET. `check-token-overrides` läser appens
 * CSS, inte komponenternas klasser. `check-closed-api` bryr sig om vem som får
 * ta emot `className`. Ett fantomtoken passerade alltså hela grinden och syntes
 * först när en människa tittade på en telefon i mörkt rum.
 *
 * Den här vakten gör två saker:
 *   1. VARJE token ett par pekar på måste FINNAS, i båda teman.
 *   2. Paret måste klara WCAG AA, 4.5:1 för brödtext och 3:1 för stor text.
 *
 * ══ ⛔ `ink-muted` BÄR ALDRIG INFORMATION ═══════════════════════════════════
 *
 * Den ger 3,65:1 mot `raised` i båda teman, alltså under AA. Det är med flit:
 * tokenet finns för dekor, avstängda kontroller och chevroner som ändå är
 * `aria-hidden`. Står det ett klockslag eller en rubrik i `ink-muted` är det ett
 * fel, och rättningen är `ink-secondary` och inte en sänkt ribba här.
 *
 * ⛔ Det gäller FLER YTOR ÄN DEN HÄR PANELEN, och de är inte genomgångna. Se
 * noten i PR:en till ops-framework#89.
 *
 * ⛔ PAREN STÅR UTSKRIVNA OCH HÄRLEDS INTE UR KLASSERNA. En parser som gissar
 * vilken bakgrund en text ligger på ur Tailwind-klasser blir fel i första
 * kapslade fallet, och en vakt som har fel ibland stängs av. Listan underhålls
 * för hand, och det är billigare än ett svar man inte litar på.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contrast } from "./vendor/validate_palette.js";

const HAR = path.dirname(fileURLToPath(import.meta.url));
/*
 * ⛔ SÖKVÄGEN GÅR ATT PEKA OM, av samma skäl som i de andra vakterna: en vakt
 * som bara kan köras mot en fil som råkar vara grön går inte att se falla, och
 * en vakt ingen sett faila är en förhoppning. `test-guards` pekar den mot en
 * kopia med en planterad kontrastmiss.
 */
const TOKENS = process.argv[2] ? path.resolve(process.argv[2]) : path.join(HAR, "..", "tokens", "tokens.css");

/** AA: 4.5 för brödtext, 3.0 för stor eller halvfet text från 18,66 px. */
const BROD = 4.5;
const STOR = 3.0;
/** Grafik och kontrollers ytor, alltså inte text. WCAG 1.4.11. */
const GRAFIK = 3.0;

/**
 * Paren som ska hålla. `text` mot `yta`, per tema.
 *
 * ⛔ `nivå: STOR` bara där texten FAKTISKT är stor eller halvfet och ≥ 18,66 px.
 * Att sänka ribban för en liten metarad är att skriva in felet i vakten.
 */
export const PAR = [
  { vad: "panelens rubrik", text: "ink", yta: "raised", niva: BROD },
  { vad: "radens rubrik", text: "ink", yta: "raised", niva: BROD },
  { vad: "radens detalj", text: "ink-secondary", yta: "raised", niva: BROD },
  { vad: "radens metarad (klockslag, slag)", text: "ink-secondary", yta: "raised", niva: BROD },
  { vad: "dagsrubriken (Idag, I går)", text: "ink-secondary", yta: "raised", niva: BROD },
  /* ⛔ "Ny" ÄR `OpsPill tone="info"`, i Aktivitet OCH i Inkorgen, ur
     `STATUS_TONES` (bolag-ops #363). `info-bg` är halvgenomskinlig, så den
     mäts SAMMANSATT över ytan chippet faktiskt ligger på (`bas`), i panelen
     (`raised`) och i en lista på sidan (`surface`, `canvas`). */
  { vad: "chipset Ny i panelen", text: "info", yta: "info-bg", bas: "raised", niva: BROD },
  { vad: "chipset Ny på sidan (surface)", text: "info", yta: "info-bg", bas: "surface", niva: BROD },
  { vad: "chipset Ny på sidan (canvas)", text: "info", yta: "info-bg", bas: "canvas", niva: BROD },
  /* ⛔ RÄKNEMÄRKET, `OpsCountBadge`: samma par på klockan, inkorgen, flikarna
     och panelens rader (ops-framework #97). */
  { vad: "räknemärkets siffra", text: "badge-contrast", yta: "badge", niva: BROD },
  /* ⛔ MÄRKET MOT HEADERN. Det sitter på en ikonknapp i headern (`surface`),
     och ska synas som en egen form där. */
  { vad: "märket mot headern", text: "badge", yta: "surface", niva: GRAFIK },
  /* ⛔ MÄRKET SJÄLVT MOT PANELEN, inte bara siffran i det. Ett märke som går i
     ett med ytan syns inte, hur läsbar siffran i det än är, och det är ett
     KRAV PÅ GRAFIK och därför 3:1 och inte 4,5. */
  { vad: "märket mot panelen", text: "badge", yta: "raised", niva: GRAFIK },
  { vad: "Gick fel", text: "danger", yta: "raised", niva: BROD },
  /* ⛔ FELMÄRKET, `OpsFelBadge` (0.45.0, bolag-ops#150): utropstecknet och ringen
     i `danger` på ytans egen färg, på en ikonknapp i headern. Tecknet är 8 px,
     alltså brödtextens krav och inte grafikens. */
  { vad: "felmärkets utropstecken i headern", text: "danger", yta: "surface", niva: BROD },
  { vad: "tillbakapilen", text: "ink-secondary", yta: "raised", niva: BROD },
  { vad: "panelrad, vilande", text: "ink-secondary", yta: "raised", niva: BROD },
  { vad: "panelrad, aktiv", text: "ink", yta: "raised", niva: BROD },
  /*
   * ⛔ REGLAGET, `OpsToggle` (cllp/bolag-ops#417). CP 2026-09-26, med bild från
   * mobilen: "Går ej att se kontrast på toggle". Mätt mot tokens gällde det
   * BÅDA temana, och det var inte en knopp som var svår att se utan en knopp
   * som inte fanns:
   *
   *   spår av (sunken) mot panelen (raised)    ljust 1,17:1   mörkt 1,00:1
   *   knopp (canvas) mot spår av (sunken)      ljust 1,09:1   mörkt 1,14:1
   *
   * ⛔ DET ÄR KANTERNA SOM BÄR KRAVET, inte fyllningarna, och därför är det
   * kanterna som står här. En fyllning som `sunken` ligger per definition nära
   * ytan den vilar på, så ett par på fyllningen hade varit ett krav tokenet
   * inte kan uppfylla.
   *
   * ⛔ PÅ-LÄGET SAKNAS HÄR, OCH DET ÄR INTE EN GLÖMSKA UTAN ETT MÄTT HÅL.
   *
   * Knoppen ligger då på `accent`, och INGET befintligt token klarar 3:1 mot
   * accent i båda temana. Mätt:
   *
   *                        ljust (accent #9a9588)   mörkt (accent #e8e0d0)
   *   raised                 2,99:1                  12,46:1
   *   canvas                 2,79:1                  14,22:1
   *   accent-contrast        2,79:1                  11,56:1
   *   ink-secondary          3,17:1                   2,44:1
   *
   * Orsaken är att ljust `accent` ligger MITT i skalan: det är för mörkt för
   * en ljus knopp och för ljust för en mörk. Samma sak gör att
   * `accent-contrast` bara ger 2,79:1 på `accent` i ljust läge, vilket står
   * utskrivet vid tokenet: mörk text hade gett 5,83:1, och det ljusa värdet
   * bärs för paritet med förlagan.
   *
   * ⛔ ATT SKRIVA IN ETT PAR SOM FALLER HADE GJORT VAKTEN RÖD FÖR ETT BESLUT,
   * inte för ett fel. ⛔ BESLUTET ÄR NU TAGET: ljust `accent-contrast` är
   * mörkt, och paret står i listan nedanför. Raden om `accent-contrast` i
   * tabellen ovan gäller alltså det GAMLA värdet och är kvar som historik.
   *
   * Reglagets på-läge är ändå fortfarande ett öppet hål: knoppen är en YTA och
   * inte text, så den behöver ett token som klarar 3:1 mot accent i båda
   * teman, och `accent-contrast` klarar det bara i ljust läge nu.
   *
   * Kontrollen som ändå finns i på-läget: knoppen FLYTTAR sig, och spårets
   * kant mot panelen står kvar. Läget avgörs alltså aldrig av färg ensam.
   */
  { vad: "reglagets spårkant mot panelen", text: "ink-secondary", yta: "raised", niva: GRAFIK },
  { vad: "reglagets knoppkant mot spåret, av", text: "ink-secondary", yta: "sunken", niva: GRAFIK },
  /*
   * ⛔ PRIMÄRKNAPPEN, OCH HÅLET SOM NOTEN OVANFÖR SADE SKULLE STÄNGAS.
   *
   * Noten löd: "Hålet stängs den dag ljust `accent-contrast` blir mörkt, och
   * det är ett produktbeslut om hur varje primärknapp ser ut." Beslutet är
   * taget, och därför står paret här i stället för i en kommentar.
   *
   * Det gäller inte bara en knapp. `accent-contrast` bär texten på VARJE
   * accentfylld yta i ramverket: `OpsButton variant="primary"`, FAB:en,
   * räknemärket, den valda dagen i kalendern och kryssrutan.
   *
   * ⛔ OCH HOVER-LÄGET STÅR MED, vilket det inte gjorde i någon tidigare
   * mätning. Mätt 2026-09-27: ljust `accent-contrast` gav 2,79:1 på `accent`
   * men bara 2,44:1 på `accent-hover`, alltså SÄMRE i det läge muspekaren
   * skapar. Ett par som bara mäter viloläget godkänner en knapp som blir
   * oläsbar när man pekar på den.
   */
  { vad: "primärknappens text", text: "accent-contrast", yta: "accent", niva: BROD },
  { vad: "primärknappens text, hover", text: "accent-contrast", yta: "accent-hover", niva: BROD },
  /* Tipsraden ("håll in Kalender", CP 2026-10-23: "man ser knappt den rutan"). Accentytan med primärknappens text, och ytan ska gå att se mot sidan. */
  { vad: "tipsradens text", text: "accent-contrast", yta: "accent", niva: BROD },
  { vad: "tipsradens stängkryss, hover", text: "accent-contrast", yta: "accent-hover", niva: GRAFIK },
  { vad: "tipsradens yta mot sidan", text: "accent", yta: "canvas", niva: GRAFIK },
  { vad: "tipsradens yta mot headern", text: "accent", yta: "surface", niva: GRAFIK },
  /*
   * ⛔ MÄRKETS ORANGE (0.31.0). "HUB" i toppraden och i inloggningen är stor text
   * (13 respektive 32 px, spärrad) och ska nå 3:1, det som WCAG kräver av
   * storstil. CP:s orange (#a9925e) klarar det mot mörk yta (5,22:1) men inte
   * mot ljus (2,94:1 mot yta, 2,85:1 mot canvas): därför har ljust läge en
   * mörkare ton av samma kulör, se `marke` i tokens/sessionstudio-profil.json.
   * Paret mot canvas är inloggningens (märket står direkt på sidan), paret mot
   * surface är toppradens.
   */
  { vad: "märkets orange i toppraden", text: "marke-accent", yta: "surface", niva: STOR },
  { vad: "märkets orange i inloggningen", text: "marke-accent", yta: "canvas", niva: STOR },
  { vad: "märkets ljusgrå (ink) i toppraden", text: "ink", yta: "surface", niva: BROD },
  /*
   * ⛔ HUBKORTETS INFO-RAD OCH "INGET NYTT" (0.31.0, fynd 8 i cllp/bolag-ops#475: "svag kontrast i info-rad och Inget nytt").
   * Raden stod i `ink-muted` (12 px, normalstil, alltså BROD 4,5:1), och `ink-muted` når det inte mot kortets yta i ljust läge.
   * Den är nu `ink-secondary`. Paret mot `raised` är kortets hover.
   */
  { vad: "hubkortets info-rad", text: "ink-secondary", yta: "surface", niva: BROD },
  { vad: "hubkortets info-rad, hover", text: "ink-secondary", yta: "raised", niva: BROD },
];

/**
 * Läser tokens för ett tema.
 *
 * ⛔ MÖRKT TEMA LÄSES UR `--dark-*`, alltså källan, och inte ur `@media`-blocket.
 * Blocket pekar bara vidare (`--color-ink: var(--dark-ink)`), så en parser som
 * läste det skulle få strängen "var(--dark-ink)" och tro att den är en färg.
 *
 * @param {string} css @param {"light"|"dark"} tema
 */
export function lasTokens(css, tema) {
  /*
   * ⛔ BARA `@theme static`-BLOCKET, och det är inte överdriven försiktighet.
   * Första versionen läste varje `--color-*` i hela filen och fick
   * `--color-raised: #3a3530` ur `.ops-contrast-panel`, en lokal inversion
   * längst ned. Utfallet var att svart text på vit yta rapporterades som
   * 1,44:1, alltså en vakt som var röd på allt och därför oanvändbar.
   */
  const bas = blocket(css, "@theme static {");
  const ljus = deklarationer(bas, "--color-");
  if (tema === "light") return ljus;

  /*
   * ⛔ `--dark-*` BOR I `:root`, INTE I `@theme static`, och det är värt en rad
   * eftersom misstaget är tyst: hittar parsern inga mörka värden faller allt
   * tillbaka på de ljusa, och vakten rapporterar två identiska teman som gröna.
   * Precis så såg första körningen ut, med 17,40:1 i BÅDA kolumnerna.
   */
  const rot = blocket(css, ":root {");
  const morka = deklarationer(rot, "--dark-");
  if (Object.keys(morka).length === 0) {
    throw new Error("check-kontrast: hittade inga --dark-*. Utan dem mäts ljust tema två gånger och vakten blir grön på fel grund.");
  }
  return { ...ljus, ...morka };
}

/**
 * Texten i ett block, från dess öppningsklammer till den matchande stängande.
 *
 * ⛔ RÄKNAR KLAMRAR i stället för att leta efter nästa `}`. Tokenfilen har
 * nästlade block, och en naiv sökning slutar vid den första inre stängningen.
 *
 * @param {string} css @param {string} start
 */
function blocket(css, start) {
  const i = css.indexOf(start);
  if (i < 0) throw new Error(`check-kontrast: hittade inte "${start}" i tokens.css.`);
  let djup = 0;
  for (let j = i + start.length - 1; j < css.length; j += 1) {
    if (css[j] === "{") djup += 1;
    else if (css[j] === "}") {
      djup -= 1;
      if (djup === 0) return css.slice(i, j);
    }
  }
  throw new Error(`check-kontrast: "${start}" stängs aldrig.`);
}

/**
 * Färgdeklarationerna med ett visst prefix.
 *
 * ⛔ BARA RIKTIGA FÄRGER. En `var(...)`-hänvisning är ingen färg att mäta, och
 * en parser som tog med den skulle jämföra strängen "var(--dark-ink)" med ett
 * hexvärde och svara med NaN.
 *
 * @param {string} css @param {string} prefix
 */
function deklarationer(css, prefix) {
  /** @type {Record<string, string>} */
  const ut = {};
  for (const m of css.matchAll(new RegExp(`${prefix}([a-z0-9-]+):\\s*([^;]+);`, "g"))) {
    const varde = m[2].trim();
    if (varde.startsWith("#") || varde.startsWith("rgb")) ut[m[1]] = varde;
  }
  return ut;
}

/**
 * `#rrggbb` eller `rgb(a)(...)` som [r, g, b, a].
 * @param {string} v
 */
function rgba(v) {
  if (v.startsWith("#")) {
    const h = v.length === 4 ? [...v.slice(1)].map((c) => c + c).join("") : v.slice(1, 7);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  const d = v.match(/[\d.]+/g)?.map(Number) ?? [];
  if (d.length < 3) throw new Error(`check-kontrast: förstår inte färgen "${v}".`);
  return [d[0], d[1], d[2], d[3] ?? 1];
}

/**
 * Tokenets färg som hex, sammansatt över `bas` om den är genomskinlig.
 *
 * ⛔ EN GENOMSKINLIG YTA HAR INGEN KONTRAST FÖR SIG SJÄLV. `info-bg` är 10 %
 * blått, och vad det blir beror helt på vad som ligger under. Utan `bas` är en
 * genomskinlig yta därför ett fel i listan och inte ett tal att gissa.
 *
 * @param {Record<string, string>} tokens @param {string} namn @param {string} [bas]
 * @returns {string | null}
 */
export function farg(tokens, namn, bas) {
  const v = tokens[namn];
  if (!v) return null;
  const [r, g, b, a] = rgba(v);
  let ut = [r, g, b];
  if (a < 1) {
    if (!bas) throw new Error(`check-kontrast: --color-${namn} är genomskinlig och paret saknar \`bas\`.`);
    const under = farg(tokens, bas);
    if (!under) return null;
    const u = rgba(under);
    ut = [r, g, b].map((c, i) => Math.round(c * a + u[i] * (1 - a)));
  }
  return "#" + ut.map((c) => c.toString(16).padStart(2, "0")).join("");
}

/**
 * Kontrollerar alla par i ett tema.
 *
 * ⛔ ETT SAKNAT TOKEN ÄR ETT EGET FEL OCH INTE "kontrast 0". Skillnaden avgör
 * vad man gör: en dålig färg justeras, ett stavfel rättas.
 *
 * @param {Record<string, string>} tokens @param {"light"|"dark"} tema
 */
export function granska(tokens, tema) {
  const brott = [];
  for (const p of PAR) {
    for (const roll of ["text", "yta", "bas"]) {
      if (p[roll] && !tokens[p[roll]]) {
        brott.push(`${tema}: ${p.vad} pekar på --color-${p[roll]}, som inte finns. Ett fantomtoken resolvar till ingenting och texten ärver föräldern.`);
      }
    }
    const t = farg(tokens, p.text);
    const y = farg(tokens, p.yta, p.bas);
    if (!t || !y) continue;
    const kvot = contrast(t, y);
    if (kvot < p.niva) {
      brott.push(`${tema}: ${p.vad} ger ${kvot.toFixed(2)}:1 (${p.text} mot ${p.yta}). Kravet är ${p.niva}:1.`);
    }
  }
  return brott;
}

/*
 * ══ ⛔ RULLNINGSLISTENS TUMME (0.95.1) ══════════════════════════════════════
 *
 * 0.95.0 målade tummen i `ink-muted` till hälften genomskinlig. Mätt i
 * lifehub.app:s ompinning: i mörkt läge syntes den knappt i Idags ruta, sämre
 * än operativsystemets list den ersatte. Räknat efter blandningen gav den 1,77
 * till 2,34:1, och ingen vakt kunde se det: paren ovan är text mot yta, och
 * tummen är varken text eller ett token utan ett UTTRYCK i basskiktet.
 *
 * ⛔ DÄRFÖR LÄSER VAKTEN UTTRYCKET OCH INTE ETT TOKENNAMN. En rad i `PAR` med
 * "ink-muted mot canvas" hade varit grön i 0.95.0 också, eftersom tokenet i sig
 * klarar 3:1. Felet satt i `color-mix(... 50%, transparent)`, alltså är det den
 * som måste räknas: tokenets färg, sammansatt med sin genomskinlighet över
 * varje yta listen står på.
 *
 * Fyra uttryck, alla ur basskiktet i tokens.css:
 *   - standarden i vila, `* { scrollbar-color }` (Chrome, Edge, Firefox)
 *   - standarden under pekaren, `:hover { scrollbar-color }`
 *   - Safaris tumme, `::-webkit-scrollbar-thumb { background }`
 *   - Safaris tumme under pekaren, `::-webkit-scrollbar-thumb:hover`
 *
 * Kraven är WCAG 1.4.11, 3:1, i båda teman och mot varje yta i `RULLYTOR`, och
 * att hover är minst lika stark som vila mot samma yta. Ett uttryck som saknas
 * eller inte går att läsa är ett brott och inte noll mätningar.
 */

/** Ytorna en rullande lista står på. `elevated` är menyer och popovrar. */
export const RULLYTOR = ["canvas", "surface", "raised", "sunken", "elevated"];

/**
 * Basskiktets regler som `{ selektor, kropp }`, utan kommentarer.
 * @param {string} css
 */
function basregler(css) {
  const start = /@layer\s+base\s*\{/.exec(css);
  if (!start) return [];
  let djup = 0;
  let block = "";
  for (let i = start.index + start[0].length - 1; i < css.length; i += 1) {
    if (css[i] === "{") djup += 1;
    else if (css[i] === "}") {
      djup -= 1;
      if (djup === 0) {
        block = css.slice(start.index, i + 1);
        break;
      }
    }
  }
  return [...block.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{};]+)\{([^{}]*)\}/g)].map((m) => ({ selektor: m[1].trim(), kropp: m[2] }));
}

/**
 * Ett färguttryck som token och täckning. Förstår `var(--color-x)` och
 * `color-mix(in srgb, var(--color-x) N%, transparent)`, de två former tummen
 * har haft. Allt annat ger null, och det blir ett brott hos den som frågar.
 * @param {string} uttryck
 * @returns {{ token: string, tackning: number } | null}
 */
export function lasFarguttryck(uttryck) {
  const u = uttryck.trim();
  const mix = /^color-mix\(\s*in\s+srgb\s*,\s*var\(--color-([a-z0-9-]+)\)\s+(\d+(?:\.\d+)?)%\s*,\s*transparent\s*\)/.exec(u);
  if (mix) return { token: mix[1], tackning: Number(mix[2]) / 100 };
  const v = /^var\(--color-([a-z0-9-]+)\)/.exec(u);
  if (v) return { token: v[1], tackning: 1 };
  return null;
}

/**
 * De fyra tumuttrycken ur basskiktet. Ett som saknas står som `uttryck: null`.
 * @param {string} css
 * @returns {{ vad: string, motor: "standard" | "webkit", lage: "vila" | "hover", uttryck: string | null }[]}
 */
export function tumuttryck(css) {
  const regler = basregler(css);
  /** @param {(r: { selektor: string, kropp: string }) => boolean} val @param {{ exec: (kropp: string) => (string | null)[] | null }} egenskap */
  const forsta = (val, egenskap) => {
    for (const r of regler.filter(val)) {
      const m = egenskap.exec(r.kropp);
      if (m && m[1]) return m[1].trim();
    }
    return null;
  };
  /*
   * ⛔ FÖRSTA VÄRDET RÄKNAS MED KLAMRAR, inte med ett mönster. Första versionen
   * läste `color-mix(in srgb, var(--color-ink-muted) 50%, transparent)` som
   * "color-mix(in", eftersom uttrycket har ett mellanslag mitt i sig och en
   * inre `var(...)` som stänger före den yttre.
   */
  const scrollbarColor = { exec: (/** @type {string} */ kropp) => {
    const m = /scrollbar-color\s*:\s*/.exec(kropp);
    if (!m) return null;
    const rest = kropp.slice(m.index + m[0].length);
    let djup = 0;
    for (let i = 0; i < rest.length; i += 1) {
      if (rest[i] === "(") djup += 1;
      else if (rest[i] === ")") djup -= 1;
      else if (djup === 0 && /[\s;]/.test(rest[i])) return [null, rest.slice(0, i)];
    }
    return [null, rest];
  } };
  const bakgrund = /background\s*:\s*([^;]+);/;
  return [
    { vad: "tummen i vila (standarden)", motor: "standard", lage: "vila", uttryck: forsta((r) => r.selektor === "*", scrollbarColor) },
    { vad: "tummen under pekaren (standarden)", motor: "standard", lage: "hover", uttryck: forsta((r) => /:hover$/.test(r.selektor) && !r.selektor.includes("::"), scrollbarColor) },
    { vad: "tummen i vila (Safari)", motor: "webkit", lage: "vila", uttryck: forsta((r) => r.selektor === "::-webkit-scrollbar-thumb", bakgrund) },
    { vad: "tummen under pekaren (Safari)", motor: "webkit", lage: "hover", uttryck: forsta((r) => r.selektor === "::-webkit-scrollbar-thumb:hover", bakgrund) },
  ];
}

/**
 * Tummens kontrast mot varje yta i ett tema. Ger rader att skriva ut och brott.
 *
 * ⛔ GENOMSKINLIGHETEN RÄKNAS MOT YTAN, inte mot vitt eller svart. Halva
 * `ink-muted` över mörk `raised` är en annan färg än halva `ink-muted` över
 * mörk `canvas`, och båda förekommer.
 *
 * @param {string} css @param {Record<string, string>} tokens @param {"light"|"dark"} tema
 */
export function granskaRullningslist(css, tokens, tema) {
  /** @type {string[]} */
  const brott = [];
  /** @type {{ vad: string, yta: string, kvot: number }[]} */
  const matt = [];
  const uttryck = tumuttryck(css);
  /** @type {Record<string, Record<string, number>>} */
  const vila = {};
  for (const t of uttryck) {
    if (!t.uttryck) {
      brott.push(`${tema}: ${t.vad} saknas i basskiktet. Utan uttrycket finns ingen tumme att mäta, och listen ritas i webbläsarens egen färg.`);
      continue;
    }
    const farguttryck = lasFarguttryck(t.uttryck);
    if (!farguttryck) {
      brott.push(`${tema}: ${t.vad} är \`${t.uttryck}\`, som vakten inte kan räkna. Använd var(--color-x) eller color-mix(in srgb, var(--color-x) N%, transparent).`);
      continue;
    }
    if (!tokens[farguttryck.token]) {
      brott.push(`${tema}: ${t.vad} pekar på --color-${farguttryck.token}, som inte finns.`);
      continue;
    }
    for (const yta of RULLYTOR) {
      const under = farg(tokens, yta);
      if (!under) {
        brott.push(`${tema}: ytan --color-${yta} finns inte, alltså går tummen inte att mäta mot den.`);
        continue;
      }
      const [r, g, b] = rgba(/** @type {string} */ (farg(tokens, farguttryck.token, yta)));
      const [ur, ug, ub] = rgba(under);
      const a = farguttryck.tackning;
      const tumme = "#" + [[r, ur], [g, ug], [b, ub]].map(([c, u]) => Math.round(c * a + u * (1 - a)).toString(16).padStart(2, "0")).join("");
      const kvot = contrast(tumme, under);
      matt.push({ vad: t.vad, yta, kvot });
      if (kvot < GRAFIK) {
        brott.push(`${tema}: ${t.vad} ger ${kvot.toFixed(2)}:1 mot ${yta} (\`${t.uttryck}\`). Tummen visar var man är i listan, kravet är ${GRAFIK}:1 (WCAG 1.4.11).`);
      }
      if (t.lage === "vila") {
        vila[t.motor] ??= {};
        vila[t.motor][yta] = kvot;
      } else if (vila[t.motor]?.[yta] !== undefined && kvot < vila[t.motor][yta]) {
        brott.push(`${tema}: ${t.vad} ger ${kvot.toFixed(2)}:1 mot ${yta}, svagare än vilans ${vila[t.motor][yta].toFixed(2)}:1. Hover ska vara starkare.`);
      }
    }
  }
  return { brott, matt };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!fs.existsSync(TOKENS)) {
    console.error(`check-kontrast: hittar inte ${TOKENS}. Fel sökväg i vakten, inte ett godkänt utfall.`);
    process.exit(1);
  }
  const css = fs.readFileSync(TOKENS, "utf8");
  const brott = [];
  const rader = [];
  for (const tema of /** @type {const} */ (["light", "dark"])) {
    /*
     * ⛔ ETT SAKNAT BLOCK ÄR ETT MÄTFEL, INTE EN KRASCH. `blocket` kastar när
     * `:root {` eller temat inte finns, och ett oväntat undantag är visserligen
     * rött men säger fel sak: harnessets andra villkor finns just för att
     * fånga en vakt som blir röd av fel anledning. Här räknas det i stället
     * som noll mätta par, och golvet nedan säger varför.
     */
    let tokens;
    try {
      tokens = lasTokens(css, tema);
    } catch {
      continue;
    }
    brott.push(...granska(tokens, tema));
    for (const p of PAR) {
      const t = farg(tokens, p.text);
      const y = farg(tokens, p.yta, p.bas);
      if (t && y) {
        rader.push(`  ${tema.padEnd(5)} ${p.vad.padEnd(34)} ${contrast(t, y).toFixed(2)}:1`);
      }
    }
  }

  /*
   * ⛔ GOLV. En tokenfil som saknar paren ger noll mätningar, och noll brott.
   * Det är arbetsreglernas tomma underlag: vakten blir grön av att ingenting
   * lästes, vilket är exakt hur en vakt slutar vakta utan att någon märker det.
   */
  const matta = rader.length;
  if (matta < PAR.length) {
    console.error(`check-kontrast: bara ${matta} av ${PAR.length * 2} par gick att mäta i ${TOKENS}. Tokens saknas, alltså mäter vakten inte det den påstår.`);
    process.exit(1);
  }

  /*
   * ⛔ TUMMEN HAR SITT EGET GOLV: fyra uttryck mot alla ytor i båda teman. Ett
   * saknat uttryck är redan ett brott ovan, men golvet fångar också en tokenfil
   * där ytorna inte gick att läsa och mätningen tyst blev kortare.
   */
  /** @type {string[]} */
  const tumrader = [];
  let tummatt = 0;
  for (const tema of /** @type {const} */ (["light", "dark"])) {
    let tokens;
    try {
      tokens = lasTokens(css, tema);
    } catch {
      continue;
    }
    const { brott: tb, matt } = granskaRullningslist(css, tokens, tema);
    brott.push(...tb);
    tummatt += matt.length;
    for (const m of matt) tumrader.push(`  ${tema.padEnd(5)} ${(m.vad + " mot " + m.yta).padEnd(52)} ${m.kvot.toFixed(2)}:1`);
  }
  const tumgolv = 4 * RULLYTOR.length * 2;
  if (tummatt < tumgolv && brott.length === 0) {
    console.error(`check-kontrast: bara ${tummatt} av ${tumgolv} mätningar av rullningslistens tumme gick att göra i ${TOKENS}. Tummen mäts alltså inte.`);
    process.exit(1);
  }

  if (brott.length) {
    console.error("check-kontrast: par som inte håller\n\n" + brott.map((b) => `  ${b}`).join("\n") + "\n");
    process.exit(1);
  }
  console.log(`check-kontrast: ${PAR.length} par i 2 teman, alla över AA`);
  console.log(rader.join("\n"));
  console.log(`check-kontrast: rullningslistens tumme, ${tummatt} mätningar, alla minst ${GRAFIK}:1 och hover minst som vila`);
  console.log(tumrader.join("\n"));
}
