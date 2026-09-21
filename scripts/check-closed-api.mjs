#!/usr/bin/env node
/**
 * Vakt: primitiverna har ett STÄNGT API.
 *
 * ⛔ Det här är den regel som skiljer ett ramverk från en rekommendation.
 *
 * Rörig CSS orsakas inte av teknikvalet. Den orsakas av kryphål. Så fort en
 * primitiv tar emot godtyckliga klasser lägger varje anropsställe på tre
 * utilities, och efter tre månader beskriver ramverket inte längre vad som
 * renderas. Varje enskilt tillägg är rimligt. Summan är soppan.
 *
 * Tre regler:
 *
 *   1. En primitiv TAR INTE EMOT `className`, `style` eller `...rest`. Att
 *      sätta className på sina EGNA element är däremot hela dess jobb, så
 *      vakten läser parameterlistan och inte filen som helhet. Den första
 *      versionen läste hela filen och hade gjort varje primitiv röd.
 *   2. Konsumentkod skickar inte `className` eller `style` till en primitiv.
 *   3. Ingen skriver en godtycklig färg: `bg-[#abc123]`, `text-[rgb(...)]`
 *      eller `style={{ color: ... }}`. Tokenkontraktet tar bort Tailwinds
 *      namngivna palett vid bygget, men godtyckliga värden överlever det. Den
 *      luckan är MÄTT i `check-css-build.mjs`, inte antagen, och det är därför
 *      den måste stängas här i källkoden i stället.
 *
 * Kör:  node scripts/check-closed-api.mjs <katalog eller fil> [...]
 * Exit: 0 grönt, 1 brott med fil, rad och skäl.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { utanKommentarer } from "./lib/kallkod.mjs";

const rotter = process.argv.slice(2);
if (rotter.length === 0) {
  console.error("check-closed-api: ange minst en katalog att granska");
  process.exit(1);
}

/** @type {{ fil: string, rad: number, regel: string, skal: string }[]} */
const brott = [];
let filerLasta = 0;
let primitiverSedda = 0;

/** @param {string} dir @returns {string[]} */
function filer(dir) {
  /** @type {string[]} */
  const ut = [];
  if (!fs.existsSync(dir)) return ut;
  if (fs.statSync(dir).isFile()) return /\.(jsx?|tsx?)$/.test(dir) ? [dir] : [];
  for (const post of fs.readdirSync(dir, { withFileTypes: true })) {
    // `dist` hoppas över: det är samma kod en gång till, och ett brott där är
    // ett brott i src som redan rapporterats. Dubbelräkning gör utdata oläslig.
    if (post.name === "node_modules" || post.name === "dist" || post.name.startsWith(".")) continue;
    const full = path.join(dir, post.name);
    if (post.isDirectory()) ut.push(...filer(full));
    else if (/\.(jsx?|tsx?)$/.test(post.name)) ut.push(full);
  }
  return ut;
}


/**
 * Plockar parameterlistan ur en funktionsdeklaration genom att räkna parenteser.
 * Regex över nästlade parenteser läser tyst fel halva.
 * @param {string} text @param {number} fran Index på tecknet efter "(".
 * @returns {string}
 */
function parameterlista(text, fran) {
  let djup = 1;
  for (let i = fran; i < text.length; i += 1) {
    if (text[i] === "(") djup += 1;
    else if (text[i] === ")") {
      djup -= 1;
      if (djup === 0) return text.slice(fran, i);
    }
  }
  return "";
}

/**
 * Primitivens EGNA attribut, alltså allt fram till taggens `>`, och ingenting
 * som ligger inuti ett `{...}`.
 *
 * ── ⛔ VARFÖR DEN HÄR FUNKTIONEN FINNS ──────────────────────────────────
 *
 * Regel 2 var en regex: `<(Ops[A-Za-z0-9_]*)\b[^>]*?\b(className|style)\s*=`.
 * `[^>]*?` stannar vid ett `>`, och i den här formen finns inget `>` att stanna
 * vid förrän långt inne i barnet:
 *
 *   <OpsDisclosure
 *     summary={
 *       <span className="flex w-full">...</span>
 *
 * Vakten läste alltså in i BARNET och rapporterade ett brott på en `className`
 * som satt på appens egen `span` inuti en ReactNode-prop. Det är tillåtet:
 * layout är fri, primitiverna är stängda.
 *
 * ⛔ FALSKA POSITIVER ÄR INTE OFARLIGA. `bolag-ops` main stod röd på sin egen
 * grind av precis det här skälet, och en grind som är röd av fel skäl är en
 * grind man lär sig att gå förbi. Då fångar den inte det riktiga brottet heller.
 *
 * Scannern räknar klamrar och hoppar över strängar, så att ett `>` i en
 * pilfunktion (`onClick={() => x}`) inte avslutar taggen för tidigt och döljer
 * en lappning som står EFTER den.
 *
 * @param {string} text @param {number} fran Index direkt efter taggnamnet.
 * @returns {string} Attributtexten, med varje `{...}`-uttryck utbytt mot tomrum.
 */
function attributlista(text, fran) {
  let djup = 0;
  let citat = "";
  let ut = "";
  for (let i = fran; i < text.length; i += 1) {
    const tecken = text[i];

    if (citat) {
      if (tecken === citat && text[i - 1] !== "\\") citat = "";
      ut += djup === 0 ? tecken : " ";
      continue;
    }
    if (tecken === '"' || tecken === "'" || tecken === "`") {
      citat = tecken;
      ut += djup === 0 ? tecken : " ";
      continue;
    }
    if (tecken === "{") {
      djup += 1;
      ut += " ";
      continue;
    }
    if (tecken === "}") {
      djup -= 1;
      ut += " ";
      continue;
    }
    // ⛔ Taggen tar slut bara på DJUP NOLL. Ett `>` inuti ett uttryck är en
    // pilfunktion eller en nästlad tagg, och stannar scannern där missas varje
    // lappning som står efter den.
    if (tecken === ">" && djup === 0) return ut;
    ut += djup === 0 ? tecken : " ";
  }
  return ut;
}

for (const rot of rotter) {
  for (const fil of filer(rot)) {
    const text = utanKommentarer(fs.readFileSync(fil, "utf8"));
    filerLasta += 1;
    /** @param {number} i */
    const radAv = (i) => text.slice(0, i).split("\n").length;

    // ── Regel 1: primitivens parameterlista ─────────────────────────────────
    const deklaration = /(?:export\s+)?(?:function\s+(Ops[A-Za-z0-9_]*)\s*\(|const\s+(Ops[A-Za-z0-9_]*)\s*=\s*(?:function\s*)?\()/g;
    for (const m of text.matchAll(deklaration)) {
      const namn = m[1] || m[2];
      primitiverSedda += 1;
      const params = parameterlista(text, m.index + m[0].length);
      for (const forbjudet of ["className", "style"]) {
        if (new RegExp(`\\b${forbjudet}\\b`).test(params)) {
          brott.push({
            fil,
            rad: radAv(m.index),
            regel: "1. stängt API",
            skal: `${namn} tar emot "${forbjudet}". Varianter ÄR API:et: variant, tone, size. Saknas något, lägg till en variant i primitiven i stället för att lappa på anropsstället.`,
          });
        }
      }
      const spread = params.match(/\.\.\.\s*([A-Za-z0-9_$]+)/);
      if (spread) {
        brott.push({
          fil,
          rad: radAv(m.index),
          regel: "1. stängt API",
          skal: `${namn} tar "...${spread[1]}". Samma kryphål som className, bara svårare att se i en granskning. Namnge de props primitiven faktiskt stödjer.`,
        });
      }
    }

    // ── Regel 2: konsument lappar inte på anropsstället ─────────────────────
    for (const m of text.matchAll(/<(Ops[A-Za-z0-9_]*)\b/g)) {
      const attribut = attributlista(text, m.index + m[0].length);
      const lappning = attribut.match(/\b(className|style)\s*=/);
      if (!lappning) continue;
      brott.push({
        fil,
        rad: radAv(m.index),
        regel: "2. ingen lappning",
        skal: `<${m[1]}> får "${lappning[1]}" på anropsstället. Det är vägen som gör ramverket till en rekommendation. Behövs utseendet, utöka primitiven.`,
      });
    }

    // ── Regel 3: inga godtyckliga färgvärden ───────────────────────────────
    for (const m of text.matchAll(/-\[(?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|color-mix\()/g)) {
      brott.push({
        fil,
        rad: radAv(m.index),
        regel: "3. ingen ad-hoc-färg",
        skal: `Godtyckligt färgvärde i en klass. Tailwinds namngivna palett är borta vid bygget, men "bg-[#abc123]" överlever det (mätt i check-css-build.mjs). Använd ett token, eller lägg till ett.`,
      });
    }
    for (const m of text.matchAll(/style\s*=\s*\{\{[^}]*[Cc]olor\s*:/g)) {
      brott.push({
        fil,
        rad: radAv(m.index),
        regel: "3. ingen ad-hoc-färg",
        skal: "Färg satt via inline style. Den går förbi både tokenkontraktet och mörkt läge, och syns inte i någon granskning av CSS.",
      });
    }
  }
}

// ── Golv: en vakt som blir grön av att ingenting lästes säger ingenting ─────
if (filerLasta === 0) {
  console.error(`check-closed-api: noll filer lästa ur ${rotter.join(", ")}. Fel sökväg, inte ett godkänt utfall.`);
  process.exit(1);
}

if (brott.length === 0) {
  console.log(`check-closed-api: ${filerLasta} filer, ${primitiverSedda} primitiver, API:et är stängt`);
  process.exit(0);
}

console.error(`check-closed-api: ${brott.length} brott\n`);
for (const b of brott) console.error(`  [${b.regel}] ${b.fil}:${b.rad}\n      ${b.skal}`);
process.exit(1);
